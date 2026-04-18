// ============================================================
// daily-challenge-analytics.js
// - DC Analytics page  (student & admin)
// - Admin: View Questions modal per challenge
// - Admin: Download PDF  (light background, highlighted answers)
// ============================================================

// ─── Entry point ─────────────────────────────────────────────
async function loadDCAnalytics() {
  const isAdmin     = currentProfile?.role === 'admin';
  const containerId = isAdmin ? 'admin-dc-analytics-content' : 'dc-analytics-content';
  const loadingId   = isAdmin ? 'admin-dc-analytics-loading'  : 'dc-analytics-loading';

  const loadingEl = document.getElementById(loadingId);
  const contentEl = document.getElementById(containerId);
  if (!contentEl) return;

  // Show loading, hide + clear content
  if (loadingEl) loadingEl.style.display = '';
  contentEl.style.display = 'none';
  contentEl.innerHTML = '<div style="padding:20px;color:var(--muted);font-size:13px;text-align:center;">Loading…</div>';

  try {
    if (isAdmin) {
      await loadAdminDCAnalytics(contentEl);
    } else {
      await loadStudentDCAnalytics(contentEl);
    }
  } catch (err) {
    contentEl.innerHTML = `<div style="color:#f87171;padding:24px;text-align:center;">Error loading analytics: ${err.message}</div>`;
    console.error('DC Analytics error:', err);
  }

  if (loadingEl) loadingEl.style.display = 'none';
  contentEl.style.display = '';
}

// ══════════════════════════════════════════════════════════════
// STUDENT DC ANALYTICS
// ══════════════════════════════════════════════════════════════
async function loadStudentDCAnalytics(container) {
  const { data: attempts } = await sb
    .from('daily_challenge_attempts')
    .select('*, daily_challenges(title, challenge_date, topics)')
    .eq('user_id', currentUser.id)
    .order('submitted_at', { ascending: true });

  if (!attempts || !attempts.length) {
    container.innerHTML = `
      <div style="text-align:center;padding:60px 20px;color:var(--muted);">
        <div style="font-size:48px;margin-bottom:16px;">📊</div>
        <div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:8px;">No Data Yet</div>
        <div style="font-size:13px;">Complete your first Daily Challenge to see analytics here.</div>
      </div>`;
    return;
  }

  const total   = attempts.length;
  const avgPct  = +(attempts.reduce((s, a) => s + +a.percentage, 0) / total).toFixed(1);
  const bestPct = Math.max(...attempts.map(a => +a.percentage));
  const streak  = await loadStudentStreak();

  container.innerHTML = `
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      ${dcCard('🗓️', 'Total Attempted', total,          '#3b82f6')}
      ${dcCard('📈', 'Average Score',   avgPct + '%',   '#10b981')}
      ${dcCard('🏆', 'Best Score',      bestPct + '%',  '#f59e0b')}
      ${dcCard('🔥', 'Current Streak',  streak + ' day' + (streak !== 1 ? 's' : ''), '#ef4444')}
    </div>

    <div class="glass p-5 mb-5">
      <div style="font-size:14px;font-weight:700;margin-bottom:16px;">Score Trend</div>
      <canvas id="dc-score-trend-chart" height="90"></canvas>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
      <div class="glass p-5">
        <div style="font-size:14px;font-weight:700;margin-bottom:16px;">Score Bands</div>
        <canvas id="dc-score-band-chart" height="160"></canvas>
      </div>
      <div class="glass p-5">
        <div style="font-size:14px;font-weight:700;margin-bottom:16px;">Completion Heatmap (last 30 days)</div>
        <div id="dc-heatmap" style="display:flex;flex-wrap:wrap;gap:4px;padding:4px 0;"></div>
        <div style="display:flex;gap:16px;margin-top:10px;font-size:11px;color:var(--muted);align-items:center;">
          <span style="display:flex;align-items:center;gap:5px;">
            <span style="width:12px;height:12px;border-radius:3px;background:rgba(16,185,129,.7);display:inline-block;"></span>Completed
          </span>
          <span style="display:flex;align-items:center;gap:5px;">
            <span style="width:12px;height:12px;border-radius:3px;background:var(--surface2);display:inline-block;"></span>Missed
          </span>
        </div>
      </div>
    </div>

    <div class="glass p-5">
      <div style="font-size:14px;font-weight:700;margin-bottom:16px;">Recent Attempts</div>
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead><tr><th>Date</th><th>Challenge</th><th>Score</th><th>Time</th><th>Result</th></tr></thead>
          <tbody>
            ${[...attempts].reverse().slice(0, 20).map(a => {
              const pct = +a.percentage;
              const col = pct >= 70 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
              const ch  = a.daily_challenges;
              return `<tr>
                <td class="mono" style="font-size:12px;">${ch?.challenge_date || '—'}</td>
                <td style="font-size:13px;font-weight:600;">${ch?.title || 'Daily Challenge'}</td>
                <td><span style="font-weight:800;color:${col};">${pct}%</span>
                    <span style="font-size:11px;color:var(--muted);"> (${a.score}/${a.total_questions})</span></td>
                <td style="font-size:12px;color:var(--muted);">${fmtDuration(a.time_taken_secs)}</td>
                <td><span style="padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;
                    background:${pct >= 70 ? 'rgba(16,185,129,.15)' : pct >= 50 ? 'rgba(245,158,11,.15)' : 'rgba(239,68,68,.15)'};
                    color:${col};border:1px solid ${pct >= 70 ? 'rgba(16,185,129,.3)' : pct >= 50 ? 'rgba(245,158,11,.3)' : 'rgba(239,68,68,.3)'};">
                  ${pct >= 70 ? 'Excellent' : pct >= 50 ? 'Good' : 'Needs Work'}</span></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;

  requestAnimationFrame(() => {
    renderDCScoreTrend(attempts);
    renderDCScoreBands(attempts);
    renderDCHeatmap(attempts);
  });
}

function dcCard(icon, label, value, color) {
  return `<div class="glass p-5" style="border-left:3px solid ${color};">
    <div style="font-size:22px;margin-bottom:8px;">${icon}</div>
    <div style="font-size:24px;font-weight:800;color:${color};margin-bottom:2px;">${value}</div>
    <div style="font-size:12px;color:var(--muted);">${label}</div>
  </div>`;
}
// alias used by both paths
function dcAnalyticsCard(icon, label, value, color) { return dcCard(icon, label, value, color); }

function renderDCScoreTrend(attempts) {
  const ctx = document.getElementById('dc-score-trend-chart');
  if (!ctx) return;
  if (chartInstances['dc-trend']) { try { chartInstances['dc-trend'].destroy(); } catch(e){} }
  chartInstances['dc-trend'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels:   attempts.map(a => a.daily_challenges?.challenge_date || fmtDate(a.submitted_at)),
      datasets: [{
        label: 'Score %',
        data:  attempts.map(a => +a.percentage),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59,130,246,.1)',
        fill: true, tension: 0.4,
        pointBackgroundColor: attempts.map(a =>
          +a.percentage >= 70 ? '#10b981' : +a.percentage >= 50 ? '#f59e0b' : '#ef4444'),
        pointRadius: 5,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#94a3b8', font: { size: 10 }, maxTicksLimit: 10 } },
        y: { min: 0, max: 100,
          ticks: { color: '#94a3b8', callback: v => v + '%' },
          grid:  { color: 'rgba(148,163,184,.1)' } }
      }
    }
  });
}

function renderDCScoreBands(attempts) {
  const ctx = document.getElementById('dc-score-band-chart');
  if (!ctx) return;
  if (chartInstances['dc-bands']) { try { chartInstances['dc-bands'].destroy(); } catch(e){} }
  const exc = attempts.filter(a => +a.percentage >= 70).length;
  const gd  = attempts.filter(a => +a.percentage >= 50 && +a.percentage < 70).length;
  const nw  = attempts.filter(a => +a.percentage <  50).length;
  chartInstances['dc-bands'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Excellent (>=70%)', 'Good (50-69%)', 'Needs Work (<50%)'],
      datasets: [{
        data: [exc, gd, nw],
        backgroundColor: ['#10b981','#f59e0b','#ef4444'],
        borderWidth: 0, hoverOffset: 6
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11 }, padding: 12 } } }
    }
  });
}

function renderDCHeatmap(attempts) {
  const el = document.getElementById('dc-heatmap');
  if (!el) return;
  const done  = new Set(attempts.map(a => a.daily_challenges?.challenge_date).filter(Boolean));
  const today = new Date(); today.setHours(0,0,0,0);
  el.innerHTML = Array.from({ length: 30 }, (_, i) => {
    const d   = new Date(today); d.setDate(d.getDate() - (29 - i));
    const key = d.toLocaleDateString('en-CA');
    const hit = done.has(key);
    return `<div title="${key}" style="width:22px;height:22px;border-radius:4px;
      background:${hit ? 'rgba(16,185,129,.7)' : 'var(--surface2)'};
      border:1px solid ${hit ? 'rgba(16,185,129,.4)' : 'var(--border)'};"></div>`;
  }).join('');
}

// ══════════════════════════════════════════════════════════════
// ADMIN DC ANALYTICS  (fixed: two-step profile fetch, no broken join)
// ══════════════════════════════════════════════════════════════
async function loadAdminDCAnalytics(container) {

  // 1. Challenges
  const { data: challenges, error: chalErr } = await sb
    .from('daily_challenges')
    .select('*')
    .order('challenge_date', { ascending: false })
    .limit(90);

  if (chalErr || !challenges || !challenges.length) {
    container.innerHTML = `
      <div style="text-align:center;padding:60px 20px;color:var(--muted);">
        <div style="font-size:48px;margin-bottom:16px;">📊</div>
        <div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:8px;">No Challenges Yet</div>
        <div style="font-size:13px;">Create your first Daily Challenge to see analytics.</div>
      </div>`;
    return;
  }

  // 2. All attempts — without profile join (avoids RLS cross-table issue)
  const { data: rawAttempts } = await sb
    .from('daily_challenge_attempts')
    .select('id, challenge_id, user_id, score, total_questions, percentage, time_taken_secs, submitted_at')
    .order('submitted_at', { ascending: true });

  const attempts = rawAttempts || [];

  // 3. Profiles — fetched separately using .in() on collected user IDs
  const uids = [...new Set(attempts.map(a => a.user_id))];
  const profileMap = {};
  if (uids.length) {
    const { data: profs } = await sb
      .from('profiles')
      .select('id, full_name, email')
      .in('id', uids);
    (profs || []).forEach(p => { profileMap[p.id] = p; });
  }
  attempts.forEach(a => {
    const prof = profileMap[a.user_id] || null;
    if (prof && !prof._displayName) {
      prof._displayName = prof.full_name || prof.email || ('Student …' + a.user_id.slice(-6));
    }
    a._profile = prof || { _displayName: 'Student …' + a.user_id.slice(-6) };
  });

  // 4. Build per-challenge map
  const attByChallenge = {};
  attempts.forEach(a => {
    (attByChallenge[a.challenge_id] = attByChallenge[a.challenge_id] || []).push(a);
  });

  const totalAttempts   = attempts.length;
  const totalChallenges = challenges.length;
  const avgScore        = totalAttempts
    ? +(attempts.reduce((s, a) => s + +a.percentage, 0) / totalAttempts).toFixed(1)
    : 0;
  const uniqueStudents  = uids.length;

  // 5. Render
  container.innerHTML = `
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      ${dcCard('📅', 'Total Challenges',   totalChallenges, '#3b82f6')}
      ${dcCard('📝', 'Total Attempts',     totalAttempts,   '#10b981')}
      ${dcCard('👥', 'Active Students',    uniqueStudents,  '#f59e0b')}
      ${dcCard('📈', 'Platform Avg Score', avgScore + '%',  '#06b6d4')}
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
      <div class="glass p-5">
        <div style="font-size:14px;font-weight:700;margin-bottom:16px;">Avg Score Per Challenge (last 20)</div>
        <canvas id="admin-dc-score-chart" height="140"></canvas>
      </div>
      <div class="glass p-5">
        <div style="font-size:14px;font-weight:700;margin-bottom:16px;">Participation Per Challenge (last 20)</div>
        <canvas id="admin-dc-participation-chart" height="140"></canvas>
      </div>
    </div>

    <div class="glass p-5 mb-5">
      <div style="font-size:14px;font-weight:700;margin-bottom:16px;">Student Leaderboard (by avg DC score)</div>
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr><th>#</th><th>Student</th><th>Attempts</th><th>Avg Score</th><th>Best Score</th><th>Days Active</th></tr>
          </thead>
          <tbody id="admin-dc-leaderboard"></tbody>
        </table>
      </div>
    </div>

    <div class="glass p-5">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px;">
        <div style="font-size:14px;font-weight:700;">All Challenges</div>
        <input oninput="filterDCAdminTable(this.value)" placeholder="Search challenges..."
          style="padding:7px 14px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-size:12px;width:200px;">
      </div>
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr><th>Date</th><th>Title</th><th>Topics</th><th>Questions</th><th>Attempts</th><th>Avg Score</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody id="admin-dc-detail-tbody"></tbody>
        </table>
      </div>
    </div>`;

  buildDCLeaderboard(attempts);
  buildDCDetailTable(challenges, attByChallenge);

  requestAnimationFrame(() => {
    renderAdminDCScoreChart(challenges, attByChallenge);
    renderAdminDCParticipationChart(challenges, attByChallenge);
  });
}

// ─── Leaderboard ─────────────────────────────────────────────
function buildDCLeaderboard(attempts) {
  const tbody = document.getElementById('admin-dc-leaderboard');
  if (!tbody) return;

  const byStudent = {};
  attempts.forEach(a => {
    const displayName = a._profile?._displayName || a._profile?.full_name || a._profile?.email || ('Student …' + a.user_id.slice(-6));
    if (!byStudent[a.user_id]) byStudent[a.user_id] = { name: displayName, scores: [], dates: new Set() };
    byStudent[a.user_id].scores.push(+a.percentage);
    byStudent[a.user_id].dates.add(a.submitted_at?.slice(0,10));
  });

  const rows = Object.values(byStudent).map(s => ({
    name:  s.name,
    count: s.scores.length,
    avg:   +(s.scores.reduce((a,b) => a+b, 0) / s.scores.length).toFixed(1),
    best:  Math.max(...s.scores),
    days:  s.dates.size,
  })).sort((a,b) => b.avg - a.avg).slice(0, 20);

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--muted);">No student data yet.</td></tr>`;
    return;
  }
  const medals = ['🥇','🥈','🥉'];
  tbody.innerHTML = rows.map((r,i) => `
    <tr>
      <td style="font-size:14px;">${medals[i] || (i+1)}</td>
      <td style="font-size:13px;font-weight:600;">${r.name}</td>
      <td style="font-size:13px;">${r.count}</td>
      <td><span style="font-weight:800;color:${r.avg>=70?'#10b981':r.avg>=50?'#f59e0b':'#ef4444'};">${r.avg}%</span></td>
      <td style="font-size:13px;font-weight:700;color:#f59e0b;">${r.best}%</td>
      <td style="font-size:13px;">${r.days} days</td>
    </tr>`).join('');
}

// ─── Detail table ─────────────────────────────────────────────
window._dcAdminRows = [];

function buildDCDetailTable(challenges, attByChallenge) {
  const today = new Date().toLocaleDateString('en-CA');
  window._dcAdminRows = challenges.map(c => {
    const atts   = attByChallenge[c.id] || [];
    const avgPct = atts.length ? +(atts.reduce((s,a)=>s+ +a.percentage,0)/atts.length).toFixed(1) : null;
    const isToday  = c.challenge_date === today;
    const isFuture = c.challenge_date > today;
    const status   = c.is_active ? (isToday ? 'Live Today' : isFuture ? 'Active' : 'Active') : (isFuture ? 'Scheduled' : 'Inactive');
    return { c, atts, avgPct, status };
  });
  renderDCAdminTableRows(window._dcAdminRows);
}

function renderDCAdminTableRows(rows) {
  const tbody = document.getElementById('admin-dc-detail-tbody');
  if (!tbody) return;
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--muted);">No challenges found.</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(({ c, atts, avgPct, status }) => `
    <tr>
      <td class="mono" style="font-size:12px;">${c.challenge_date}</td>
      <td style="font-size:13px;font-weight:600;">${c.title || '—'}</td>
      <td style="font-size:11px;color:var(--muted);">${(c.topics||[]).slice(0,3).join(', ')}</td>
      <td style="font-size:13px;">${c.question_count || '—'}</td>
      <td style="font-size:13px;">${atts.length}</td>
      <td style="font-size:13px;font-weight:700;color:${avgPct===null?'var(--muted)':avgPct>=70?'#10b981':avgPct>=50?'#f59e0b':'#ef4444'};">
        ${avgPct!==null?avgPct+'%':'—'}
      </td>
      <td>
        <span style="padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;
          background:${c.is_active?'rgba(16,185,129,.15)':'rgba(245,158,11,.12)'};
          color:${c.is_active?'#10b981':'#fbbf24'};
          border:1px solid ${c.is_active?'rgba(16,185,129,.3)':'rgba(245,158,11,.3)'};">
          ${status}
        </span>
      </td>
      <td>
        <div style="display:flex;gap:5px;flex-wrap:wrap;">
          <button onclick="adminViewDCQuestions('${c.id}')" class="btn-secondary" style="font-size:11px;padding:5px 9px;">View Qs</button>
          <button onclick="downloadDCPDFSingle('${c.id}')" class="btn-primary" style="font-size:11px;padding:5px 9px;">PDF</button>
        </div>
      </td>
    </tr>`).join('');
}

function filterDCAdminTable(query) {
  const q = query.toLowerCase();
  renderDCAdminTableRows((window._dcAdminRows||[]).filter(({c}) =>
    (c.title||'').toLowerCase().includes(q) ||
    (c.challenge_date||'').includes(q) ||
    (c.topics||[]).join(' ').toLowerCase().includes(q)
  ));
}

// ─── Charts ──────────────────────────────────────────────────
function renderAdminDCScoreChart(challenges, attByChallenge) {
  const ctx = document.getElementById('admin-dc-score-chart');
  if (!ctx) return;
  if (chartInstances['admin-dc-score']) { try { chartInstances['admin-dc-score'].destroy(); } catch(e){} }
  const slice  = [...challenges].reverse().slice(-20);
  const labels = slice.map(c => c.challenge_date?.slice(5));
  const data   = slice.map(c => {
    const a = attByChallenge[c.id] || [];
    return a.length ? +(a.reduce((s,x) => s + +x.percentage, 0) / a.length).toFixed(1) : 0;
  });
  chartInstances['admin-dc-score'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Avg Score %',
        data,
        backgroundColor: data.map(v => v>=70?'rgba(16,185,129,.8)':v>=50?'rgba(245,158,11,.8)':'rgba(239,68,68,.8)'),
        borderRadius: 5,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#94a3b8', font: { size: 9 } } },
        y: { min: 0, max: 100, ticks: { color: '#94a3b8', callback: v => v+'%' }, grid: { color: 'rgba(148,163,184,.08)' } }
      }
    }
  });
}

function renderAdminDCParticipationChart(challenges, attByChallenge) {
  const ctx = document.getElementById('admin-dc-participation-chart');
  if (!ctx) return;
  if (chartInstances['admin-dc-part']) { try { chartInstances['admin-dc-part'].destroy(); } catch(e){} }
  const slice  = [...challenges].reverse().slice(-20);
  const labels = slice.map(c => c.challenge_date?.slice(5));
  const data   = slice.map(c => (attByChallenge[c.id]||[]).length);
  chartInstances['admin-dc-part'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Attempts',
        data,
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6,182,212,.1)',
        fill: true, tension: 0.4,
        pointBackgroundColor: '#06b6d4', pointRadius: 4,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#94a3b8', font: { size: 9 } } },
        y: { min: 0, ticks: { color: '#94a3b8', stepSize: 1 }, grid: { color: 'rgba(148,163,184,.08)' } }
      }
    }
  });
}

// ══════════════════════════════════════════════════════════════
// ADMIN: VIEW QUESTIONS MODAL
// ══════════════════════════════════════════════════════════════
async function adminViewDCQuestions(challengeId) {
  if (currentProfile?.role !== 'admin') { showToast('Admin only.', 'error'); return; }

  let modal = document.getElementById('admin-dc-qview-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'admin-dc-qview-modal';
    modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9000;align-items:center;justify-content:center;padding:16px;';
    modal.innerHTML = `
      <div class="glass" style="width:100%;max-width:820px;max-height:90vh;display:flex;flex-direction:column;border-radius:20px;overflow:hidden;">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid var(--border);flex-shrink:0;">
          <div>
            <div id="admin-dc-qview-title" style="font-size:16px;font-weight:800;"></div>
            <div id="admin-dc-qview-meta"  style="font-size:12px;color:var(--muted);margin-top:3px;"></div>
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
            <button id="admin-dc-qview-pdf-btn" class="btn-primary"   style="font-size:12px;padding:8px 14px;">Download PDF</button>
            <button onclick="document.getElementById('admin-dc-qview-modal').style.display='none'"
                    class="btn-secondary" style="font-size:12px;padding:8px 14px;">Close</button>
          </div>
        </div>
        <div id="admin-dc-qview-body" style="overflow-y:auto;padding:20px 24px;flex:1;display:flex;flex-direction:column;gap:14px;">
          <div style="color:var(--muted);font-size:13px;text-align:center;padding:32px;">Loading...</div>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }

  modal.style.display = 'flex';
  document.getElementById('admin-dc-qview-body').innerHTML =
    `<div style="color:var(--muted);font-size:13px;text-align:center;padding:32px;">Loading questions...</div>`;

  const [chalRes, qRes] = await Promise.all([
    sb.from('daily_challenges').select('*').eq('id', challengeId).single(),
    sb.from('daily_challenge_questions').select('*').eq('challenge_id', challengeId).order('order_index'),
  ]);

  const challenge = chalRes.data;
  const questions = qRes.data || [];

  if (!challenge) {
    document.getElementById('admin-dc-qview-body').innerHTML = `<div style="color:#ef4444;">Could not load challenge.</div>`;
    return;
  }

  document.getElementById('admin-dc-qview-title').textContent = challenge.title || 'Challenge Questions';
  document.getElementById('admin-dc-qview-meta').textContent  =
    `${challenge.challenge_date}  •  ${questions.length} questions  •  Topics: ${(challenge.topics||[]).join(', ')}  •  Difficulty: ${challenge.difficulty||'medium'}`;
  document.getElementById('admin-dc-qview-pdf-btn').onclick = () => downloadDCPDFSingle(challengeId);

  if (!questions.length) {
    document.getElementById('admin-dc-qview-body').innerHTML =
      `<div style="color:var(--muted);text-align:center;padding:32px;">No questions in this challenge.</div>`;
    return;
  }

  const accents = ['#3b82f6','#10b981','#f59e0b','#06b6d4','#8b5cf6'];
  document.getElementById('admin-dc-qview-body').innerHTML = questions.map((q, i) => `
    <div style="padding:16px;background:var(--surface2);border-radius:12px;border-left:3px solid ${accents[i%5]};">
      <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:12px;">
        <span style="background:var(--accent);color:#fff;border-radius:7px;padding:3px 10px;font-size:11px;font-weight:700;flex-shrink:0;">Q${i+1}</span>
        <div style="font-size:14px;font-weight:600;line-height:1.6;flex:1;">${q.question_text}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px;">
        ${['A','B','C','D'].map(l => `
          <div style="padding:8px 12px;border-radius:8px;font-size:12px;
            background:${l===q.correct_answer?'rgba(16,185,129,.15)':'rgba(30,41,59,.5)'};
            border:1px solid ${l===q.correct_answer?'rgba(16,185,129,.5)':'var(--border)'};
            color:${l===q.correct_answer?'#10b981':'var(--text)'};
            font-weight:${l===q.correct_answer?'700':'400'};">
            <strong>${l}.</strong> ${q['option_'+l.toLowerCase()]}
            ${l===q.correct_answer?'<span style="float:right;font-size:14px;">&#10003;</span>':''}
          </div>`).join('')}
      </div>
      ${q.explanation ? `
        <div style="font-size:12px;color:#60a5fa;background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.2);border-radius:8px;padding:9px 12px;line-height:1.7;">
          <strong>Explanation:</strong> ${q.explanation}
        </div>` : ''}
      ${q.topic ? `
        <div style="margin-top:8px;">
          <span style="font-size:10px;background:rgba(139,92,246,.15);color:#a78bfa;border:1px solid rgba(139,92,246,.25);border-radius:20px;padding:3px 10px;">${q.topic}</span>
        </div>` : ''}
    </div>`).join('');
}

// ══════════════════════════════════════════════════════════════
// PDF  (light background, green correct answers, blue explanation)
// ══════════════════════════════════════════════════════════════

async function loadJsPDF() {
  if (window.jspdf?.jsPDF || window.jsPDF) return;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src   = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    s.onload  = resolve;
    s.onerror = () => reject(new Error('Failed to load jsPDF'));
    document.head.appendChild(s);
  });
}

async function downloadDCPDFSingle(challengeId) {
  if (currentProfile?.role !== 'admin') { showToast('Admin only.', 'error'); return; }
  showToast('Preparing PDF...', 'info');
  try {
    await loadJsPDF();
    const [chalRes, qRes, attRes] = await Promise.all([
      sb.from('daily_challenges').select('*').eq('id', challengeId).single(),
      sb.from('daily_challenge_questions').select('*').eq('challenge_id', challengeId).order('order_index'),
      sb.from('daily_challenge_attempts')
        .select('id,user_id,score,total_questions,percentage,time_taken_secs,submitted_at')
        .eq('challenge_id', challengeId).order('submitted_at', { ascending: false }),
    ]);
    const challenge = chalRes.data;
    let   attempts  = attRes.data || [];
    const questions = qRes.data   || [];

    if (attempts.length) {
      const { data: profs } = await sb.from('profiles').select('id,full_name,email').in('id', attempts.map(a => a.user_id));
      const pm = {}; (profs||[]).forEach(p => pm[p.id] = p);
      attempts.forEach(a => { a._profile = pm[a.user_id] || null; });
    }
    if (!challenge) throw new Error('Challenge not found');
    const doc = buildDCPDFDoc([{ challenge, questions, attempts }]);
    doc.save(`dc_${challenge.challenge_date}_${(challenge.title||'challenge').replace(/\s+/g,'_').toLowerCase()}.pdf`);
    showToast('PDF downloaded!', 'success');
  } catch(err) { showToast('PDF error: ' + err.message, 'error'); console.error(err); }
}

async function downloadDCPDFAll() {
  if (currentProfile?.role !== 'admin') { showToast('Admin only.', 'error'); return; }
  showToast('Building PDF for all challenges...', 'info');
  try {
    await loadJsPDF();
    const { data: challenges } = await sb
      .from('daily_challenges').select('*').order('challenge_date', { ascending: false }).limit(60);
    if (!challenges?.length) throw new Error('No challenges found');

    const allData = await Promise.all(challenges.map(async c => {
      const [qRes, aRes] = await Promise.all([
        sb.from('daily_challenge_questions').select('*').eq('challenge_id', c.id).order('order_index'),
        sb.from('daily_challenge_attempts')
          .select('id,user_id,score,total_questions,percentage,time_taken_secs,submitted_at')
          .eq('challenge_id', c.id),
      ]);
      let attempts = aRes.data || [];
      if (attempts.length) {
        const { data: profs } = await sb.from('profiles').select('id,full_name,email').in('id', attempts.map(a => a.user_id));
        const pm = {}; (profs||[]).forEach(p => pm[p.id] = p);
        attempts.forEach(a => { a._profile = pm[a.user_id] || null; });
      }
      return { challenge: c, questions: qRes.data || [], attempts };
    }));

    const doc = buildDCPDFDoc(allData);
    doc.save(`daily_challenges_report_${new Date().toLocaleDateString('en-CA')}.pdf`);
    showToast('All-challenges PDF downloaded!', 'success');
  } catch(err) { showToast('PDF error: ' + err.message, 'error'); console.error(err); }
}

// ─── Core PDF builder — clean light background ────────────────
function buildDCPDFDoc(items) {
  const jsPDF = window.jspdf?.jsPDF || window.jsPDF;
  const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const PW = 210, PH = 297;
  const ML = 14, MR = 14, MT = 20, MB = 14;
  const CW = PW - ML - MR;

  // Light colour palette
  const C = {
    white:       [255, 255, 255],
    pageBg:      [250, 251, 253],
    headerBg:    [30,  64,  175],   // blue-800
    headerText:  [255, 255, 255],
    accentBlue:  [37,  99,  235],   // blue-600
    accentLight: [219, 234, 254],   // blue-100
    green:       [22,  163, 74 ],   // green-600
    greenLight:  [220, 252, 231],   // green-100
    greenBorder: [134, 239, 172],   // green-300
    yellow:      [202, 138,  4 ],
    red:         [220,  38,  38],
    bodyText:    [15,  23,  42 ],   // slate-900
    muted:       [100, 116, 139],   // slate-500
    border:      [203, 213, 225],   // slate-300
    rowEven:     [241, 245, 249],   // slate-100
    optBg:       [248, 250, 252],   // slate-50
    expBg:       [239, 246, 255],   // blue-50
    expBorder:   [147, 197, 253],   // blue-300
    expText:     [29,  78,  216],   // blue-700
    badgeBg:     [237, 233, 254],   // violet-100
    badgeText:   [109, 40,  217],   // violet-700
    statBg:      [241, 245, 249],
  };

  let y = MT;

  // strip non-Latin characters so jsPDF doesn't produce garbled output
  function safe(str) {
    if (!str) return '';
    return String(str).replace(/[^\x20-\x7E\xA0-\xFF]/g, '').replace(/\s+/g,' ').trim();
  }

  function bgFill() {
    doc.setFillColor(...C.pageBg);
    doc.rect(0, 0, PW, PH, 'F');
  }

  function drawHeader() {
    doc.setFillColor(...C.headerBg);
    doc.rect(0, 0, PW, 10, 'F');
    doc.setFontSize(7); doc.setFont(undefined, 'normal'); doc.setTextColor(...C.headerText);
    doc.text('OmegaTest  |  Daily Challenge Report', ML, 6.5);
    doc.text('Generated: ' + new Date().toLocaleString('en-IN'), PW - MR, 6.5, { align: 'right' });
  }

  function newPage() {
    doc.addPage();
    bgFill();
    y = MT;
    drawHeader();
  }

  function checkPage(need = 10) {
    if (y + need > PH - MB - 8) newPage();
  }

  function hline(color = C.border, lw = 0.25) {
    doc.setDrawColor(...color); doc.setLineWidth(lw);
    doc.line(ML, y, PW - MR, y);
    y += 3;
  }

  function sectionBand(text) {
    checkPage(12);
    doc.setFillColor(...C.accentLight);
    doc.roundedRect(ML, y, CW, 9, 1.5, 1.5, 'F');
    doc.setDrawColor(...C.accentBlue); doc.setLineWidth(0.4);
    doc.roundedRect(ML, y, CW, 9, 1.5, 1.5, 'S');
    doc.setFontSize(9); doc.setFont(undefined, 'bold'); doc.setTextColor(...C.accentBlue);
    doc.text(safe(text), ML + 4, y + 6.2);
    doc.setFont(undefined, 'normal');
    y += 13;
  }

  // ── COVER ─────────────────────────────────────────────────
  doc.setFillColor(...C.white);
  doc.rect(0, 0, PW, PH, 'F');

  // top band
  doc.setFillColor(...C.headerBg);
  doc.rect(0, 0, PW, 58, 'F');

  // circle logo
  doc.setFillColor(59, 130, 246);
  doc.circle(PW/2, 30, 17, 'F');
  doc.setFontSize(16); doc.setFont(undefined,'bold'); doc.setTextColor(...C.white);
  doc.text('OT', PW/2, 34.5, { align: 'center' });

  // title
  doc.setFontSize(22); doc.setFont(undefined,'bold'); doc.setTextColor(...C.bodyText);
  doc.text('Daily Challenge Report', PW/2, 78, { align: 'center' });
  doc.setFontSize(10); doc.setFont(undefined,'normal'); doc.setTextColor(...C.muted);
  doc.text('OmegaTest Platform  |  Admin Confidential Report', PW/2, 87, { align: 'center' });

  doc.setDrawColor(...C.border); doc.setLineWidth(0.3);
  doc.line(ML, 93, PW-MR, 93);

  // KPI boxes
  const totalCh  = items.length;
  const totalQ   = items.reduce((s,i) => s + i.questions.length, 0);
  const totalAtt = items.reduce((s,i) => s + i.attempts.length,  0);
  const overallAvg = totalAtt
    ? +(items.flatMap(i=>i.attempts).reduce((s,a)=>s+ +a.percentage,0)/totalAtt).toFixed(1)
    : 0;

  const kpis = [
    { label: 'Challenges', value: String(totalCh),    color: C.accentBlue },
    { label: 'Questions',  value: String(totalQ),     color: C.green      },
    { label: 'Attempts',   value: String(totalAtt),   color: C.yellow     },
    { label: 'Avg Score',  value: overallAvg + '%',   color: C.red        },
  ];
  const bw = (CW - 9) / 4;
  kpis.forEach((k, i) => {
    const bx = ML + i * (bw + 3);
    doc.setFillColor(...C.statBg);
    doc.roundedRect(bx, 100, bw, 28, 2, 2, 'F');
    doc.setDrawColor(...k.color); doc.setLineWidth(0.6);
    doc.roundedRect(bx, 100, bw, 28, 2, 2, 'S');
    doc.setFontSize(15); doc.setFont(undefined,'bold'); doc.setTextColor(...k.color);
    doc.text(k.value, bx + bw/2, 113, { align: 'center' });
    doc.setFontSize(7.5); doc.setFont(undefined,'normal'); doc.setTextColor(...C.muted);
    doc.text(k.label, bx + bw/2, 121, { align: 'center' });
  });

  // ToC
  doc.setFontSize(10); doc.setFont(undefined,'bold'); doc.setTextColor(...C.bodyText);
  doc.text('Challenges in this report:', ML, 142);
  doc.setFont(undefined,'normal'); doc.setFontSize(8.5);
  items.slice(0, 26).forEach((item, i) => {
    const cy = 150 + i * 7;
    if (cy > PH - 20) return;
    doc.setTextColor(...C.muted);
    doc.text((i+1) + '.', ML, cy);
    doc.setTextColor(...C.bodyText);
    doc.text(safe(item.challenge.title || 'Daily Challenge'), ML + 7, cy);
    doc.setTextColor(...C.muted);
    doc.text(item.challenge.challenge_date || '', PW-MR, cy, { align: 'right' });
  });
  if (items.length > 26) {
    doc.setFontSize(7.5); doc.setTextColor(...C.muted);
    doc.text('... and ' + (items.length - 26) + ' more challenges', ML, 150 + 26*7);
  }

  doc.setFontSize(7); doc.setTextColor(...C.muted);
  doc.text('CONFIDENTIAL  |  OmegaTest Admin Report  |  ' + new Date().toLocaleDateString('en-IN'),
    PW/2, PH-8, { align: 'center' });

  // ── PER-CHALLENGE PAGES ────────────────────────────────────
  items.forEach(({ challenge, questions, attempts }) => {
    newPage();

    // Challenge header
    doc.setFillColor(...C.headerBg);
    doc.roundedRect(ML, y, CW, 21, 2, 2, 'F');
    doc.setFontSize(13); doc.setFont(undefined,'bold'); doc.setTextColor(...C.white);
    doc.text(safe(challenge.title || 'Daily Challenge'), ML+4, y+8);
    doc.setFontSize(7.5); doc.setFont(undefined,'normal');
    const meta = [
      'Date: ' + (challenge.challenge_date||''),
      'Questions: ' + questions.length,
      'Time: ' + (challenge.time_limit_minutes||15) + ' min',
      'Difficulty: ' + safe(challenge.difficulty||'medium'),
    ].join('   |   ');
    doc.text(meta, ML+4, y+16);
    y += 25;

    if ((challenge.topics||[]).length) {
      doc.setFontSize(7.5); doc.setTextColor(...C.muted);
      doc.text('Topics: ' + safe(challenge.topics.join(', ')), ML, y+4);
      y += 9;
    }

    // Stats
    const attCount = attempts.length;
    const avgPct   = attCount ? +(attempts.reduce((s,a)=>s+ +a.percentage,0)/attCount).toFixed(1) : null;
    const bestPct  = attCount ? Math.max(...attempts.map(a=> +a.percentage)) : null;

    const stats = [
      { label:'Total Attempts', value: String(attCount), color: C.accentBlue },
      { label:'Avg Score',      value: avgPct!==null ? avgPct+'%' : 'N/A',
        color: avgPct===null ? C.muted : avgPct>=70 ? C.green : avgPct>=50 ? C.yellow : C.red },
      { label:'Best Score',     value: bestPct!==null ? bestPct+'%' : 'N/A', color: C.yellow },
    ];
    const sw = (CW - 6) / 3;
    checkPage(20);
    stats.forEach((s2,i) => {
      const bx = ML + i*(sw+3);
      doc.setFillColor(...C.statBg);
      doc.roundedRect(bx, y, sw, 16, 1.5, 1.5, 'F');
      doc.setDrawColor(...C.border); doc.setLineWidth(0.3);
      doc.roundedRect(bx, y, sw, 16, 1.5, 1.5, 'S');
      doc.setFontSize(12); doc.setFont(undefined,'bold'); doc.setTextColor(...s2.color);
      doc.text(s2.value, bx+sw/2, y+9, { align:'center' });
      doc.setFontSize(7); doc.setFont(undefined,'normal'); doc.setTextColor(...C.muted);
      doc.text(s2.label, bx+sw/2, y+14, { align:'center' });
    });
    y += 20;

    // ── Questions ────────────────────────────────────────────
    sectionBand('Questions  (' + questions.length + ')');

    const LH = 4.8;

    questions.forEach((q, qi) => {
      const qLines   = doc.splitTextToSize('Q' + (qi+1) + '.  ' + safe(q.question_text), CW - 10);
      const optLines = ['A','B','C','D'].map(l =>
        doc.splitTextToSize(l + '.  ' + safe(q['option_'+l.toLowerCase()]||''), CW/2 - 14)
      );
      const expLines = q.explanation
        ? doc.splitTextToSize('Explanation:  ' + safe(q.explanation), CW - 14)
        : [];

        // row heights for the 2x2 option grid — add 1 extra LH for the "✔ Correct" tag line
        const rowH1 = Math.max(optLines[0].length, optLines[1].length) * LH + LH + 6;
        const rowH2 = Math.max(optLines[2].length, optLines[3].length) * LH + LH + 6;
      const expH  = expLines.length ? expLines.length * LH + 8 : 0;
      const topH  = q.topic ? 8 : 0;
      const cardH = qLines.length * LH + 8 + rowH1 + rowH2 + expH + topH + 10;

      checkPage(cardH + 5);

      // white card with border
      doc.setFillColor(...C.white);
      doc.setDrawColor(...C.border); doc.setLineWidth(0.4);
      doc.roundedRect(ML, y, CW, cardH, 2, 2, 'FD');

      // left accent stripe
      doc.setFillColor(...C.accentBlue);
      doc.rect(ML, y, 3, cardH, 'F');

      // Q badge
      doc.setFillColor(...C.accentBlue);
      doc.roundedRect(ML+5, y+3, 16, 7, 1.5, 1.5, 'F');
      doc.setFontSize(7); doc.setFont(undefined,'bold'); doc.setTextColor(...C.white);
      doc.text('Q'+(qi+1), ML+13, y+7.5, { align:'center' });

      // topic badge
      if (q.topic) {
        const tText = safe(q.topic);
        const tW = doc.getTextWidth(tText) + 8;
        doc.setFillColor(...C.badgeBg);
        doc.roundedRect(PW-MR-tW, y+3, tW, 7, 1.5, 1.5, 'F');
        doc.setFontSize(6.5); doc.setFont(undefined,'normal'); doc.setTextColor(...C.badgeText);
        doc.text(tText, PW-MR-tW/2, y+7.5, { align:'center' });
      }

      // question text
      let ty = y + 13;
      doc.setFontSize(9); doc.setFont(undefined,'bold'); doc.setTextColor(...C.bodyText);
      qLines.forEach(line => { doc.text(line, ML+6, ty); ty += LH; });
      ty += 3;

      // options: 2 per row
      const colW = CW/2 - 9;
      [
        { li: 0, ri: 1 },
        { li: 2, ri: 3 },
      ].forEach(({ li, ri }) => {
        const ll = ['A','B','C','D'][li];
        const rl = ['A','B','C','D'][ri];
        const lLines = optLines[li];
        const rLines = optLines[ri];
        const rh = Math.max(lLines.length, rLines.length) * LH + LH + 5;

        [
          { letter: ll, lines: lLines, ox: ML+6       },
          { letter: rl, lines: rLines, ox: ML+CW/2+4  },
        ].forEach(({ letter, lines, ox }) => {
          const isCorrect = letter === q.correct_answer;
          if (isCorrect) {
            doc.setFillColor(...C.greenLight);
            doc.setDrawColor(...C.greenBorder);
          } else {
            doc.setFillColor(...C.optBg);
            doc.setDrawColor(...C.border);
          }
          doc.setLineWidth(0.35);
          doc.roundedRect(ox, ty-1, colW, rh, 1.5, 1.5, 'FD');

          doc.setFontSize(8.5);
          doc.setFont(undefined, isCorrect ? 'bold' : 'normal');
          doc.setTextColor(...(isCorrect ? C.green : C.bodyText));
          lines.forEach((line, k) => { doc.text(line, ox+3, ty + k*LH + 3); });
          if (isCorrect) {
            // Draw (Correct) tag on its own line below option text, safely within box
            const tagY = ty + lines.length * LH + 2;
            doc.setFontSize(7.5); doc.setFont(undefined,'bold');
            doc.setTextColor(...C.green);
            doc.text('✔ Correct', ox + 3, tagY);
          }
        });
        ty += rh + 2;
      });

      // explanation
      if (expLines.length) {
        doc.setFillColor(...C.expBg);
        doc.setDrawColor(...C.expBorder); doc.setLineWidth(0.35);
        doc.roundedRect(ML+6, ty+1, CW-12, expLines.length*LH+6, 1.5, 1.5, 'FD');
        doc.setFontSize(8); doc.setFont(undefined,'italic'); doc.setTextColor(...C.expText);
        expLines.forEach((line, k) => { doc.text(line, ML+9, ty + LH + k*LH + 1); });
        ty += expLines.length*LH + 8;
      }

      y += cardH + 5;
    });

    // ── Attempts table ───────────────────────────────────────
    if (attempts.length > 0) {
      checkPage(24);
      sectionBand('Student Attempts  (' + attempts.length + ')');

      const cols = [
        { label:'Student', x: ML,      w: 56 },
        { label:'Score',   x: ML+59,   w: 32 },
        { label:'Time',    x: ML+94,   w: 26 },
        { label:'Date',    x: ML+123,  w: 34 },
        { label:'Result',  x: ML+160,  w: 32 },
      ];

      checkPage(10);
      doc.setFillColor(...C.headerBg);
      doc.rect(ML, y, CW, 8, 'F');
      doc.setFontSize(7.5); doc.setFont(undefined,'bold'); doc.setTextColor(...C.white);
      cols.forEach(col => doc.text(col.label, col.x+2, y+5.5));
      y += 9;

      attempts.slice(0,50).forEach((att, ai) => {
        checkPage(8);
        doc.setFillColor(...(ai%2===0 ? C.rowEven : C.white));
        doc.rect(ML, y, CW, 7.5, 'F');
        doc.setDrawColor(...C.border); doc.setLineWidth(0.2);
        doc.line(ML, y+7.5, ML+CW, y+7.5);

        const pct    = +att.percentage;
        const pColor = pct>=70 ? C.green : pct>=50 ? C.yellow : C.red;
        const name   = safe(att._profile?._displayName || att._profile?.full_name || att._profile?.email || ('Student …' + att.user_id.slice(-6)));

        doc.setFontSize(7.5); doc.setFont(undefined,'normal'); doc.setTextColor(...C.bodyText);
        doc.text(doc.splitTextToSize(name, 54)[0], cols[0].x+2, y+5);
        doc.setFont(undefined,'bold'); doc.setTextColor(...pColor);
        doc.text(pct+'%  ('+att.score+'/'+att.total_questions+')', cols[1].x+2, y+5);
        doc.setFont(undefined,'normal'); doc.setTextColor(...C.muted);
        doc.text(fmtDuration(att.time_taken_secs), cols[2].x+2, y+5);
        doc.text(att.submitted_at ? new Date(att.submitted_at).toLocaleDateString('en-IN') : '—', cols[3].x+2, y+5);
        doc.setTextColor(...pColor);
        doc.text(pct>=70?'Excellent':pct>=50?'Good':'Needs Work', cols[4].x+2, y+5);
        y += 7.5;
      });

      if (attempts.length > 50) {
        checkPage(8);
        doc.setFontSize(7); doc.setTextColor(...C.muted);
        doc.text('... and ' + (attempts.length-50) + ' more attempts not shown.', ML, y+5);
        y += 8;
      }
      y += 4;
    }
  });

  // ── Page numbers & footer ─────────────────────────────────
  const pc = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pc; i++) {
    doc.setPage(i);
    doc.setFillColor(...C.headerBg);
    doc.rect(0, PH-8, PW, 8, 'F');
    doc.setFontSize(7); doc.setFont(undefined,'normal'); doc.setTextColor(...C.white);
    doc.text('OmegaTest  |  Daily Challenge Report', ML, PH-3);
    doc.text('Page ' + i + ' of ' + pc, PW-MR, PH-3, { align: 'right' });
  }

  return doc;
}