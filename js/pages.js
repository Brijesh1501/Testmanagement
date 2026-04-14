// ============================================================
// pages.js — Dashboard, Test Series listing, Results, Profile
// ============================================================

// ─── DASHBOARD ───────────────────────────────────────────────
async function loadDashboard() {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  document.getElementById('dash-greeting').textContent = `${greeting}, ${currentProfile.full_name || 'there'}! 👋`;

  // Set daily challenge date label
  const dcDateEl = document.getElementById('dc-date-label');
  if (dcDateEl) dcDateEl.textContent = new Date().toLocaleDateString('en-IN', { weekday:'long', day:'2-digit', month:'short', year:'numeric' });

  const { data: attempts } = await sb.from('test_attempts')
    .select('*, test_series(name)')
    .eq('user_id', currentUser.id)
    .order('submitted_at', { ascending: false });

  const total   = attempts?.length || 0;
  const avgPct  = total ? +(attempts.reduce((s, a) => s + +a.percentage, 0) / total).toFixed(1) : 0;
  const bestPct = total ? Math.max(...attempts.map(a => +a.percentage)) : 0;
  const totalQ  = attempts?.reduce((s, a) => s + a.total_questions, 0) || 0;

  document.getElementById('dash-stats').innerHTML =
    statCard('Total Tests',    total,          '#3b82f6', iconClip)  +
    statCard('Avg Score',      avgPct + '%',   '#10b981', iconWave)  +
    statCard('Best Score',     bestPct + '%',  '#f59e0b', iconStar)  +
    statCard('Qs Attempted',   totalQ,         '#06b6d4', iconClock);

  const recent = (attempts || []).slice(0, 5);
  document.getElementById('dash-recent-attempts').innerHTML = recent.length
    ? recent.map(a => `
      <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);">
        <div style="width:40px;height:40px;border-radius:10px;background:${+a.percentage >= 60 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:${+a.percentage >= 60 ? '#10b981' : '#ef4444'};">${a.percentage}%</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${a.test_series?.name || '—'}</div>
          <div style="font-size:11px;color:var(--muted);">${a.score}/${a.total_questions} correct · ${fmtDate(a.submitted_at)}</div>
        </div>
        <span class="badge ${+a.percentage >= 60 ? 'badge-green' : 'badge-red'}">${+a.percentage >= 60 ? 'Pass' : 'Fail'}</span>
      </div>`).join('')
    : emptyState('No tests taken yet. Start practising!');

  if ((attempts || []).length >= 2) {
    const trend = [...(attempts || [])].reverse().slice(-6);
    document.getElementById('dash-performance').innerHTML = `
      <div style="display:flex;align-items:flex-end;gap:6px;height:110px;padding:8px 0;">
        ${trend.map(a => `
          <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;">
            <div style="font-size:10px;color:var(--muted);">${a.percentage}%</div>
            <div style="width:28px;border-radius:4px 4px 0 0;background:linear-gradient(to top,#3b82f6,#06b6d4);height:${Math.max(4, +a.percentage * 0.8)}px;"></div>
            <div style="font-size:9px;color:var(--muted);text-align:center;">${(a.test_series?.name || '').substring(0, 8)}</div>
          </div>`).join('')}
      </div>`;
  }

  // Load daily challenge widget — runs async in background
  loadDailyChallengeWidget();
  checkDCNavBadge();
}

// ─── Check if today's challenge is pending (nav dot) ──────────
async function checkDCNavBadge() {
  const badge = document.getElementById('dc-nav-badge');
  if (!badge) return;
  const today = new Date().toLocaleDateString('en-CA');
  const { data: challenge } = await sb.from('daily_challenges').select('id').eq('challenge_date', today).eq('is_active', true).single();
  if (!challenge) return;
  const { data: attempt } = await sb.from('daily_challenge_attempts').select('id').eq('challenge_id', challenge.id).eq('user_id', currentUser.id).single();
  badge.style.display = attempt ? 'none' : '';
}

// ─── Daily Challenge full page (student) ─────────────────────
async function loadDailyChallengeFullPage() {
  // Reuse widget in page slot
  const pageWidget = document.getElementById('dc-page-widget');
  if (pageWidget) {
    pageWidget.innerHTML = `<div style="color:var(--muted);font-size:13px;">Loading…</div>`;
    // Temporarily swap target for widget loader
    const orig = document.getElementById('daily-challenge-widget');
    // Clone approach: render into dc-page-widget
    await loadDailyChallengeWidgetInto('dc-page-widget');
  }

  // Streak
  const streak = await loadStudentStreak();
  const sv = document.getElementById('dc-page-streak-val');
  if (sv) sv.textContent = streak;

  // History
  const histEl = document.getElementById('dc-history-list');
  if (!histEl) return;
  const { data: attempts } = await sb
    .from('daily_challenge_attempts')
    .select('*, daily_challenges(title, challenge_date, topics)')
    .eq('user_id', currentUser.id)
    .order('submitted_at', { ascending: false })
    .limit(20);

  if (!attempts || !attempts.length) {
    histEl.innerHTML = `<div style="color:var(--muted);font-size:13px;text-align:center;padding:24px 0;">No challenges attempted yet.</div>`;
    return;
  }

  histEl.innerHTML = attempts.map(a => {
    const pct   = +a.percentage;
    const color = pct >= 70 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
    const ch    = a.daily_challenges;
    return `
    <div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border);">
      <div style="width:44px;height:44px;border-radius:10px;background:${pct >= 70 ? 'rgba(16,185,129,.15)' : pct >= 50 ? 'rgba(245,158,11,.15)' : 'rgba(239,68,68,.15)'};display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:800;color:${color};flex-shrink:0;">${pct}%</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:600;">${ch?.title || 'Daily Challenge'}</div>
        <div style="font-size:11px;color:var(--muted);">${fmtDate(a.submitted_at)} · ${a.score}/${a.total_questions} correct · ${(ch?.topics||[]).slice(0,2).join(', ')}</div>
      </div>
      <button onclick="viewDailyChallengeReview('${a.id}')" class="btn-secondary" style="font-size:11px;padding:6px 12px;">Review</button>
    </div>`;
  }).join('');
}

// Helper: render widget into any element id
async function loadDailyChallengeWidgetInto(targetId) {
  const container = document.getElementById(targetId);
  if (!container) return;
  const today = new Date().toLocaleDateString('en-CA');
  const { data: challenge } = await sb.from('daily_challenges').select('*').eq('challenge_date', today).eq('is_active', true).single();
  if (!challenge) {
    container.innerHTML = `<div style="text-align:center;padding:32px 0;color:var(--muted);"><div style="font-size:36px;margin-bottom:12px;">🌅</div><div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:6px;">No Challenge Today</div><div style="font-size:12px;">Check back later — an admin will set today's challenge soon.</div></div>`;
    return;
  }
  const { data: attempt } = await sb.from('daily_challenge_attempts').select('*').eq('challenge_id', challenge.id).eq('user_id', currentUser.id).single();
  if (attempt) { renderDailyChallengeResult(container, attempt, challenge); return; }
  const { data: questions } = await sb.from('daily_challenge_questions').select('*').eq('challenge_id', challenge.id).order('order_index');
  if (!questions || !questions.length) { container.innerHTML = `<div style="color:var(--muted);font-size:13px;">Challenge has no questions yet.</div>`; return; }
  renderDailyChallengeStart(container, challenge, questions);
}

// ─── TEST SERIES LIST (Student) ───────────────────────────────
async function loadTestSeries() {
  const grid = document.getElementById('test-series-grid');
  grid.innerHTML = skeletonGrid(3);

  const { data: series, error } = await sb.from('test_series').select('*').eq('is_active', true).order('created_at');
  if (error) { grid.innerHTML = errorState(error.message); return; }
  if (!series?.length) { grid.innerHTML = emptyState('No test series available yet.', true); return; }

  const qMap = await fetchQuestionCountMap();
  const { data: myAttempts } = await sb.from('test_attempts').select('series_id,percentage').eq('user_id', currentUser.id);
  const attMap = {};
  (myAttempts || []).forEach(a => {
    if (!attMap[a.series_id]) attMap[a.series_id] = { count: 0, best: 0 };
    attMap[a.series_id].count++;
    attMap[a.series_id].best = Math.max(attMap[a.series_id].best, +a.percentage);
  });

  grid.innerHTML = series.map(s => {
    const qc  = qMap[s.id] || 0;
    const att = attMap[s.id];
    return `
    <div class="glass p-6 flex flex-col" style="transition:all 0.2s;"
      onmouseenter="this.style.transform='translateY(-4px)';this.style.borderColor='var(--accent)'"
      onmouseleave="this.style.transform='';this.style.borderColor=''">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <div style="width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#3b82f6,#06b6d4);display:flex;align-items:center;justify-content:center;">${iconClip}</div>
        ${att ? `<span class="badge badge-green">Best: ${att.best}%</span>` : '<span class="badge badge-blue">New</span>'}
      </div>
      <h3 style="font-size:16px;font-weight:700;margin-bottom:8px;line-height:1.3;">${s.name}</h3>
      <p style="font-size:13px;color:var(--muted);line-height:1.6;flex:1;margin-bottom:16px;">${s.description}</p>
      <div style="display:flex;gap:16px;margin-bottom:16px;font-size:12px;color:var(--muted);flex-wrap:wrap;">
        <span>⏱ ${s.duration_minutes} min</span>
        <span>📝 ${qc}/${s.total_questions} Qs</span>
        ${s.subject ? `<span>🏷 ${s.subject}</span>` : ''}
        ${att ? `<span>🔄 ${att.count} attempt${att.count > 1 ? 's' : ''}</span>` : ''}
      </div>
      <button onclick="startTest('${s.id}')" class="btn-primary" style="width:100%;" ${qc === 0 ? 'disabled' : ''}>
        ${qc === 0 ? 'No Questions Yet' : att ? 'Retake Test' : 'Start Test'}
      </button>
    </div>`;
  }).join('');
}

// ─── MY RESULTS ──────────────────────────────────────────────
async function loadResults() {
  const { data: attempts } = await sb.from('test_attempts')
    .select('*, test_series(name)')
    .eq('user_id', currentUser.id)
    .order('submitted_at', { ascending: false });
  window._resultsCache = attempts || [];
  renderResultsTable(attempts || []);
}

function renderResultsTable(attempts) {
  const body = document.getElementById('results-body');
  if (!attempts.length) {
    body.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--muted);">No results yet. Take a test!</td></tr>`;
    return;
  }
  body.innerHTML = attempts.map(a => `
    <tr>
      <td><div style="font-weight:600;font-size:13px;">${a.test_series?.name || '—'}</div></td>
      <td><div style="font-size:16px;font-weight:800;color:${+a.percentage >= 60 ? '#10b981' : +a.percentage >= 40 ? '#f59e0b' : '#ef4444'}">${a.percentage}%</div></td>
      <td><span class="mono" style="font-size:13px;">${a.score}/${a.total_questions}</span></td>
      <td style="font-size:13px;color:var(--muted);">${fmtDuration(a.time_taken_secs)}</td>
      <td style="font-size:13px;color:var(--muted);">${fmtDate(a.submitted_at)}</td>
      <td><span class="badge ${a.is_passed ? 'badge-green' : 'badge-red'}">${a.is_passed ? 'Pass' : 'Fail'}</span></td>
      <td><button onclick="viewResultById('${a.id}')" class="btn-success" style="font-size:12px;padding:6px 12px;">View</button></td>
    </tr>`).join('');
}

function filterResults(query) {
  const q = query.toLowerCase();
  renderResultsTable((window._resultsCache || []).filter(a => (a.test_series?.name || '').toLowerCase().includes(q)));
}

// ─── PROFILE ─────────────────────────────────────────────────
async function loadProfile() {
  const p    = currentProfile;
  const name = p.full_name || '';
  document.getElementById('profile-avatar').textContent    = name[0]?.toUpperCase() || 'U';
  document.getElementById('profile-name').textContent      = name;
  document.getElementById('profile-email').textContent     = currentUser.email;
  document.getElementById('profile-role-badge').textContent = p.role === 'admin' ? 'Administrator' : 'Student';
  document.getElementById('edit-name').value               = name;
  document.getElementById('edit-email').value              = currentUser.email;

  const { data: attempts } = await sb.from('test_attempts')
    .select('percentage,is_passed')
    .eq('user_id', currentUser.id);

  const total    = attempts?.length || 0;
  const avg      = total ? +(attempts.reduce((s, a) => s + +a.percentage, 0) / total).toFixed(1) : 0;
  const best     = total ? Math.max(...attempts.map(a => +a.percentage)) : 0;
  const passRate = total ? +(attempts.filter(a => a.is_passed).length / total * 100).toFixed(1) : 0;

  document.getElementById('profile-stats').innerHTML =
    statCard('Tests Taken', total,          '#3b82f6', iconClip)  +
    statCard('Avg Score',   avg + '%',      '#10b981', iconWave)  +
    statCard('Best Score',  best + '%',     '#f59e0b', iconStar)  +
    statCard('Pass Rate',   passRate + '%', '#06b6d4', iconCheck);
}

async function updateProfile(e) {
  e.preventDefault();
  const name     = document.getElementById('edit-name').value.trim();
  const password = document.getElementById('edit-password').value;

  const { error: profErr } = await sb.from('profiles').update({ full_name: name }).eq('id', currentUser.id);
  if (profErr) { showToast('Error: ' + profErr.message, 'error'); return; }

  if (password) {
    const { error: pwErr } = await sb.auth.updateUser({ password });
    if (pwErr) { showToast('Password error: ' + pwErr.message, 'error'); return; }
  }

  currentProfile.full_name = name;
  renderSidebar();
  loadProfile();
  showToast('Profile updated!', 'success');
}
