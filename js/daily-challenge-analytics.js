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
  // Fetch attempts WITHOUT a join — students can only read their own attempts,
  // and the daily_challenges join fails silently for inactive/past challenges
  // due to RLS. We fetch challenges separately and merge client-side.
  const { data: rawAttempts, error: attErr } = await sb
    .from('daily_challenge_attempts')
    .select('id, challenge_id, score, total_questions, percentage, time_taken_secs, submitted_at')
    .eq('user_id', currentUser.id)
    .order('submitted_at', { ascending: true });

  if (attErr) {
    container.innerHTML = `<div style="color:#f87171;padding:24px;text-align:center;">
      Error loading attempts: ${attErr.message}</div>`;
    return;
  }

  const attempts = rawAttempts || [];

  if (!attempts.length) {
    container.innerHTML = `
      <div style="text-align:center;padding:60px 20px;color:var(--muted);">
        <div style="font-size:48px;margin-bottom:16px;">📊</div>
        <div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:8px;">No Data Yet</div>
        <div style="font-size:13px;">Complete your first Daily Challenge to see analytics here.</div>
      </div>`;
    return;
  }

  // Fetch challenge metadata separately using the challenge IDs we already have
  const challengeIds = [...new Set(attempts.map(a => a.challenge_id))];
  const challengeMap = {};
  if (challengeIds.length) {
    // Use admin-style broad select — if RLS blocks inactive ones, we just get fewer titles (graceful)
    const { data: challenges } = await sb
      .from('daily_challenges')
      .select('id, title, challenge_date, topics')
      .in('id', challengeIds);
    (challenges || []).forEach(c => { challengeMap[c.id] = c; });
  }
  // Attach challenge data to each attempt
  attempts.forEach(a => { a.daily_challenges = challengeMap[a.challenge_id] || null; });

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
    // profiles table has: id, full_name (no email column)
    const { data: profs } = await sb
      .from('profiles')
      .select('id, full_name')
      .in('id', uids);
    (profs || []).forEach(p => { profileMap[p.id] = p; });
  }
  attempts.forEach(a => {
    const prof = profileMap[a.user_id] || null;
    const displayName = prof?.full_name || ('Student #' + a.user_id.slice(0, 8));
    a._profile = { ...(prof || {}), _displayName: displayName };
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
    const displayName = a._profile?._displayName || a._profile?.full_name || ('Student #' + a.user_id.slice(0, 8));
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
      const { data: profs } = await sb.from('profiles').select('id,full_name').in('id', attempts.map(a => a.user_id));
      const pm = {}; (profs||[]).forEach(p => pm[p.id] = p);
      attempts.forEach(a => {
        const prof = pm[a.user_id] || null;
        a._profile = prof ? { ...prof, _displayName: prof.full_name || ('Student #' + a.user_id.slice(0,8)) } : { _displayName: 'Student #' + a.user_id.slice(0,8) };
      });
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
        const { data: profs } = await sb.from('profiles').select('id,full_name').in('id', attempts.map(a => a.user_id));
        const pm = {}; (profs||[]).forEach(p => pm[p.id] = p);
        attempts.forEach(a => {
          const prof = pm[a.user_id] || null;
          a._profile = prof ? { ...prof, _displayName: prof.full_name || ('Student #' + a.user_id.slice(0,8)) } : { _displayName: 'Student #' + a.user_id.slice(0,8) };
        });
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
  const ML = 12, MR = 12, MT = 18, MB = 14;
  const CW = PW - ML - MR;   // 186 mm usable width

  // ── Colour palette (light background) ──────────────────────
  const C = {
    white:       [255, 255, 255],
    pageBg:      [248, 250, 252],   // slate-50
    headerBg:    [30,  64,  175],   // blue-800
    headerText:  [255, 255, 255],
    accentBlue:  [37,  99,  235],   // blue-600
    accentLight: [219, 234, 254],   // blue-100
    accentStripe:[59,  130, 246],   // blue-500
    green:       [21,  128, 61 ],   // green-700
    greenLight:  [220, 252, 231],   // green-100
    greenBorder: [134, 239, 172],   // green-300
    greenText:   [22,  101, 52 ],   // green-800
    yellow:      [161, 98,   7 ],   // amber-700
    red:         [185,  28,  28],   // red-700
    bodyText:    [15,  23,  42 ],   // slate-900
    subText:     [51,  65,  85 ],   // slate-700
    muted:       [100, 116, 139],   // slate-500
    border:      [203, 213, 225],   // slate-300
    lightBorder: [226, 232, 240],   // slate-200
    rowEven:     [241, 245, 249],   // slate-100
    optBg:       [248, 250, 252],   // slate-50
    expBg:       [239, 246, 255],   // blue-50
    expBorder:   [147, 197, 253],   // blue-300
    expText:     [29,  78,  216],   // blue-700
    badgeBg:     [237, 233, 254],   // violet-100
    badgeText:   [109, 40,  217],   // violet-700
    statBg:      [241, 245, 249],   // slate-100
    cardBg:      [255, 255, 255],
  };

  let y = MT;

  // ── Helpers ─────────────────────────────────────────────────

  // Strip non-Latin chars that jsPDF can't render (emoji, Unicode symbols)
  function safe(str) {
    if (!str) return '';
    return String(str)
      .replace(/[^\x20-\x7E\xA0-\xFF]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // ASCII correct indicator — no Unicode, always renders
  const CORRECT_LABEL = '[Correct Answer]';

  function bgFill() {
    doc.setFillColor(...C.pageBg);
    doc.rect(0, 0, PW, PH, 'F');
  }

  function drawPageHeader() {
    doc.setFillColor(...C.headerBg);
    doc.rect(0, 0, PW, 9, 'F');
    doc.setFontSize(6.5); doc.setFont(undefined, 'normal'); doc.setTextColor(...C.headerText);
    doc.text('OmegaTest  |  Daily Challenge Report', ML, 5.8);
    doc.text('Generated: ' + new Date().toLocaleString('en-IN'), PW - MR, 5.8, { align: 'right' });
  }

  function newPage() {
    doc.addPage();
    bgFill();
    y = MT;
    drawPageHeader();
  }

  function checkPage(need) {
    if (y + need > PH - MB - 9) newPage();
  }

  function sectionBand(text) {
    checkPage(14);
    doc.setFillColor(...C.accentLight);
    doc.roundedRect(ML, y, CW, 8, 1, 1, 'F');
    doc.setDrawColor(...C.accentBlue); doc.setLineWidth(0.3);
    doc.roundedRect(ML, y, CW, 8, 1, 1, 'S');
    doc.setFontSize(8.5); doc.setFont(undefined, 'bold'); doc.setTextColor(...C.accentBlue);
    doc.text(safe(text), ML + 4, y + 5.6);
    doc.setFont(undefined, 'normal');
    y += 12;
  }

  // ── COVER PAGE ──────────────────────────────────────────────
  doc.setFillColor(...C.white);
  doc.rect(0, 0, PW, PH, 'F');

  // Hero band
  doc.setFillColor(...C.headerBg);
  doc.rect(0, 0, PW, 65, 'F');

  // Circle logo
  doc.setFillColor(...C.accentStripe);
  doc.circle(PW / 2, 32, 18, 'F');
  doc.setFontSize(17); doc.setFont(undefined, 'bold'); doc.setTextColor(...C.white);
  doc.text('OT', PW / 2, 36.5, { align: 'center' });

  // Title block
  doc.setFontSize(24); doc.setFont(undefined, 'bold'); doc.setTextColor(...C.bodyText);
  doc.text('Daily Challenge Report', PW / 2, 85, { align: 'center' });
  doc.setFontSize(10); doc.setFont(undefined, 'normal'); doc.setTextColor(...C.muted);
  doc.text('OmegaTest Platform  |  Admin Confidential Report', PW / 2, 94, { align: 'center' });

  doc.setDrawColor(...C.lightBorder); doc.setLineWidth(0.3);
  doc.line(ML + 20, 100, PW - MR - 20, 100);

  // KPI boxes
  const totalCh  = items.length;
  const totalQ   = items.reduce((s, i) => s + i.questions.length, 0);
  const totalAtt = items.reduce((s, i) => s + i.attempts.length, 0);
  const overallAvg = totalAtt
    ? +(items.flatMap(i => i.attempts).reduce((s, a) => s + +a.percentage, 0) / totalAtt).toFixed(1)
    : 0;

  const kpis = [
    { label: 'Challenges', value: String(totalCh),  color: C.accentBlue },
    { label: 'Questions',  value: String(totalQ),   color: C.green      },
    { label: 'Attempts',   value: String(totalAtt), color: C.yellow     },
    { label: 'Avg Score',  value: overallAvg + '%', color: C.red        },
  ];
  const bw = (CW - 12) / 4;
  kpis.forEach((k, i) => {
    const bx = ML + i * (bw + 4);
    doc.setFillColor(...C.statBg);
    doc.roundedRect(bx, 108, bw, 30, 2, 2, 'F');
    doc.setDrawColor(...k.color); doc.setLineWidth(0.5);
    doc.roundedRect(bx, 108, bw, 30, 2, 2, 'S');
    // color top accent bar
    doc.setFillColor(...k.color);
    doc.roundedRect(bx, 108, bw, 3, 2, 2, 'F');
    doc.rect(bx, 110, bw, 1, 'F'); // square bottom of accent
    doc.setFontSize(16); doc.setFont(undefined, 'bold'); doc.setTextColor(...k.color);
    doc.text(k.value, bx + bw / 2, 123, { align: 'center' });
    doc.setFontSize(7); doc.setFont(undefined, 'normal'); doc.setTextColor(...C.muted);
    doc.text(k.label, bx + bw / 2, 131, { align: 'center' });
  });

  // Table of contents
  doc.setFontSize(10); doc.setFont(undefined, 'bold'); doc.setTextColor(...C.bodyText);
  doc.text('Challenges in this Report:', ML, 152);
  doc.setFont(undefined, 'normal'); doc.setFontSize(8.5);
  items.slice(0, 24).forEach((item, i) => {
    const cy = 161 + i * 8;
    if (cy > PH - 20) return;
    // row bg alternating
    if (i % 2 === 0) {
      doc.setFillColor(...C.rowEven);
      doc.rect(ML, cy - 5, CW, 7.5, 'F');
    }
    doc.setTextColor(...C.muted);
    doc.text(String(i + 1) + '.', ML + 2, cy);
    doc.setTextColor(...C.bodyText);
    doc.text(safe(item.challenge.title || 'Daily Challenge'), ML + 10, cy);
    doc.setTextColor(...C.muted);
    doc.text(item.challenge.challenge_date || '', PW - MR, cy, { align: 'right' });
  });
  if (items.length > 24) {
    doc.setFontSize(7.5); doc.setTextColor(...C.muted);
    doc.text('... and ' + (items.length - 24) + ' more challenges', ML, 161 + 24 * 8);
  }

  doc.setFontSize(6.5); doc.setTextColor(...C.muted);
  doc.text(
    'CONFIDENTIAL  |  OmegaTest Admin Report  |  ' + new Date().toLocaleDateString('en-IN'),
    PW / 2, PH - 8, { align: 'center' }
  );

  // ── PER-CHALLENGE PAGES ─────────────────────────────────────
  items.forEach(({ challenge, questions, attempts }) => {
    newPage();

    // ── Challenge header card ────────────────────────────────
    const headerH = 24;
    doc.setFillColor(...C.headerBg);
    doc.roundedRect(ML, y, CW, headerH, 2, 2, 'F');

    // Left accent stripe on header
    doc.setFillColor(...C.accentStripe);
    doc.roundedRect(ML, y, 4, headerH, 2, 2, 'F');
    doc.rect(ML + 2, y, 2, headerH, 'F');

    doc.setFontSize(12); doc.setFont(undefined, 'bold'); doc.setTextColor(...C.white);
    doc.text(safe(challenge.title || 'Daily Challenge'), ML + 8, y + 9);

    doc.setFontSize(7); doc.setFont(undefined, 'normal'); doc.setTextColor(180, 210, 255);
    const metaParts = [
      'Date: ' + (challenge.challenge_date || ''),
      'Questions: ' + questions.length,
      'Time: ' + (challenge.time_limit_minutes || 15) + ' min',
      'Difficulty: ' + safe(challenge.difficulty || 'medium'),
    ];
    doc.text(metaParts.join('   |   '), ML + 8, y + 17);

    if ((challenge.topics || []).length) {
      doc.setFontSize(6.5);
      doc.text('Topics: ' + safe(challenge.topics.join(', ')), ML + 8, y + 22);
    }
    y += headerH + 6;

    // ── Stats row ────────────────────────────────────────────
    const attCount = attempts.length;
    const avgPct   = attCount ? +(attempts.reduce((s, a) => s + +a.percentage, 0) / attCount).toFixed(1) : null;
    const bestPct  = attCount ? Math.max(...attempts.map(a => +a.percentage)) : null;

    const stats = [
      { label: 'Total Attempts', value: String(attCount),                   color: C.accentBlue },
      { label: 'Avg Score',      value: avgPct  !== null ? avgPct  + '%' : 'N/A',
        color: avgPct === null ? C.muted : avgPct >= 70 ? C.green : avgPct >= 50 ? C.yellow : C.red },
      { label: 'Best Score',     value: bestPct !== null ? bestPct + '%' : 'N/A', color: C.yellow },
    ];
    const sw = (CW - 8) / 3;
    checkPage(22);
    stats.forEach((s2, i) => {
      const bx = ML + i * (sw + 4);
      doc.setFillColor(...C.statBg);
      doc.roundedRect(bx, y, sw, 16, 1.5, 1.5, 'F');
      doc.setDrawColor(...C.border); doc.setLineWidth(0.25);
      doc.roundedRect(bx, y, sw, 16, 1.5, 1.5, 'S');
      doc.setFontSize(11); doc.setFont(undefined, 'bold'); doc.setTextColor(...s2.color);
      doc.text(s2.value, bx + sw / 2, y + 9, { align: 'center' });
      doc.setFontSize(6.5); doc.setFont(undefined, 'normal'); doc.setTextColor(...C.muted);
      doc.text(s2.label, bx + sw / 2, y + 14, { align: 'center' });
    });
    y += 22;

    // ── Questions section ────────────────────────────────────
    sectionBand('Questions  (' + questions.length + ')');

    // Layout constants
    const LH     = 5.0;    // line height mm
    const INNER  = ML + 5; // left text margin inside card
    const TEXTW  = CW - 10; // available width for question text

    // Option column geometry — two columns with proper margin
    const OPT_PAD  = 3;    // padding inside option box
    const OPT_GAP  = 4;    // gap between left and right columns
    const OPT_W    = (CW - OPT_GAP - 10) / 2;   // each option box width
    const OPT_TEXTW = OPT_W - OPT_PAD * 2 - 3;  // max text width inside option
    const OPT_L_X  = ML + 5;                      // left column x
    const OPT_R_X  = OPT_L_X + OPT_W + OPT_GAP; // right column x

    questions.forEach((q, qi) => {
      // ── Pre-compute all line splits ──────────────────────
      const qLines   = doc.splitTextToSize(safe(q.question_text || ''), TEXTW - 3);

      // Each option: letter prefix + text, wrapped to column width
      const optLines = ['A', 'B', 'C', 'D'].map(l => {
        const prefix = l + '.  ';
        const text   = safe(q['option_' + l.toLowerCase()] || '');
        return doc.splitTextToSize(prefix + text, OPT_TEXTW);
      });

      const expLines = q.explanation
        ? doc.splitTextToSize('Explanation: ' + safe(q.explanation), TEXTW - 6)
        : [];

      // Height for each option row (pair of options side by side)
      // +1 line for the [Correct Answer] tag if either option in the pair is correct
      const pairCorrect = (li, ri) => {
        const ll = ['A','B','C','D'][li];
        const rl = ['A','B','C','D'][ri];
        return ll === q.correct_answer || rl === q.correct_answer;
      };
      const optRowH = (li, ri) => {
        const maxLines = Math.max(optLines[li].length, optLines[ri].length);
        const extra    = pairCorrect(li, ri) ? LH : 0;
        return maxLines * LH + extra + OPT_PAD * 2;
      };
      const row1H = optRowH(0, 1);
      const row2H = optRowH(2, 3);
      const expH  = expLines.length ? expLines.length * LH + 8 : 0;

      // Badge row: Q number + topic  (14 mm)
      // Question text block
      // Option rows  + 3mm gap between them
      // Explanation
      // Bottom padding 4mm
      const BADGE_H = 12;
      const cardH   = BADGE_H + qLines.length * LH + 4 + row1H + 3 + row2H + expH + 6;

      checkPage(cardH + 4);

      const cardY = y;

      // ── Card background + border ──────────────────────────
      doc.setFillColor(...C.cardBg);
      doc.setDrawColor(...C.lightBorder); doc.setLineWidth(0.3);
      doc.roundedRect(ML, cardY, CW, cardH, 2, 2, 'FD');

      // Left accent stripe (full card height)
      doc.setFillColor(...C.accentStripe);
      doc.rect(ML, cardY, 3, cardH, 'F');

      // ── Q-number badge ────────────────────────────────────
      const qBadgeW = doc.getStringUnitWidth('Q' + (qi + 1)) *
                       doc.getFontSize() / doc.internal.scaleFactor + 8;
      doc.setFontSize(7); doc.setFont(undefined, 'bold');
      const qBW = Math.max(14, qBadgeW);
      doc.setFillColor(...C.accentBlue);
      doc.roundedRect(ML + 5, cardY + 3, qBW, 6.5, 1, 1, 'F');
      doc.setTextColor(...C.white);
      doc.text('Q' + (qi + 1), ML + 5 + qBW / 2, cardY + 7.5, { align: 'center' });

      // ── Topic badge (right side) ──────────────────────────
      if (q.topic) {
        const tText = safe(q.topic);
        doc.setFontSize(6);
        const tW = doc.getStringUnitWidth(tText) * doc.getFontSize() / doc.internal.scaleFactor + 8;
        doc.setFillColor(...C.badgeBg);
        doc.roundedRect(ML + CW - tW - 5, cardY + 3, tW, 6.5, 1, 1, 'F');
        doc.setTextColor(...C.badgeText);
        doc.text(tText, ML + CW - 5 - tW / 2, cardY + 7.5, { align: 'center' });
      }

      // ── Question text ─────────────────────────────────────
      let ty = cardY + BADGE_H;
      doc.setFontSize(9); doc.setFont(undefined, 'bold'); doc.setTextColor(...C.bodyText);
      qLines.forEach(line => {
        doc.text(line, INNER, ty);
        ty += LH;
      });
      ty += 3; // gap before options

      // ── Option pairs ─────────────────────────────────────
      [[0, 1], [2, 3]].forEach(([li, ri], pairIdx) => {
        const ll     = ['A', 'B', 'C', 'D'][li];
        const rl     = ['A', 'B', 'C', 'D'][ri];
        const lLines = optLines[li];
        const rLines = optLines[ri];
        const rh     = pairIdx === 0 ? row1H : row2H;

        // Draw left option box
        [{letter: ll, lines: lLines, ox: OPT_L_X},
         {letter: rl, lines: rLines, ox: OPT_R_X}
        ].forEach(({letter, lines, ox}) => {
          const isCorrect = letter === q.correct_answer;

          // Box fill and border
          if (isCorrect) {
            doc.setFillColor(...C.greenLight);
            doc.setDrawColor(...C.greenBorder);
            doc.setLineWidth(0.5);
          } else {
            doc.setFillColor(...C.optBg);
            doc.setDrawColor(...C.lightBorder);
            doc.setLineWidth(0.25);
          }
          doc.roundedRect(ox, ty, OPT_W, rh, 1.5, 1.5, 'FD');

          // Option text
          doc.setFontSize(8.5);
          doc.setFont(undefined, isCorrect ? 'bold' : 'normal');
          doc.setTextColor(...(isCorrect ? C.greenText : C.subText));
          lines.forEach((line, k) => {
            doc.text(line, ox + OPT_PAD, ty + OPT_PAD + k * LH + 1.5);
          });

          // Correct answer label — on its own dedicated line after text
          if (isCorrect) {
            const tagY = ty + OPT_PAD + lines.length * LH + 1;
            // small green pill background
            const lblW = doc.getStringUnitWidth(CORRECT_LABEL) *
                         8.5 / doc.internal.scaleFactor + 6;
            doc.setFillColor(...C.green);
            doc.roundedRect(ox + OPT_PAD, tagY - 3.5, lblW, 5, 1, 1, 'F');
            doc.setFontSize(6.5); doc.setFont(undefined, 'bold'); doc.setTextColor(...C.white);
            doc.text(CORRECT_LABEL, ox + OPT_PAD + lblW / 2, tagY, { align: 'center' });
          }
        });

        ty += rh + 3; // gap between option rows
      });

      // ── Explanation box ───────────────────────────────────
      if (expLines.length) {
        const expBoxH = expLines.length * LH + 7;
        doc.setFillColor(...C.expBg);
        doc.setDrawColor(...C.expBorder); doc.setLineWidth(0.3);
        doc.roundedRect(INNER, ty, CW - 10, expBoxH, 1.5, 1.5, 'FD');

        // "Explanation:" label
        doc.setFontSize(7); doc.setFont(undefined, 'bold'); doc.setTextColor(...C.expText);
        doc.text('Explanation:', INNER + 3, ty + 4.5);

        doc.setFontSize(7.5); doc.setFont(undefined, 'normal');
        expLines.forEach((line, k) => {
          doc.text(line, INNER + 3, ty + 5 + (k + 1) * LH - 0.5);
        });
        ty += expBoxH + 3;
      }

      y += cardH + 4; // advance to next card
    });

    // ── Student Attempts table ───────────────────────────────
    if (attempts.length > 0) {
      checkPage(28);
      sectionBand('Student Attempts  (' + attempts.length + ')');

      // Column definitions
      const cols = [
        { label: 'Student', x: ML,       w: 55 },
        { label: 'Score',   x: ML + 57,  w: 35 },
        { label: 'Time',    x: ML + 94,  w: 28 },
        { label: 'Date',    x: ML + 124, w: 34 },
        { label: 'Result',  x: ML + 160, w: 38 },
      ];

      // Header row
      checkPage(10);
      doc.setFillColor(...C.headerBg);
      doc.rect(ML, y, CW, 8, 'F');
      doc.setFontSize(7); doc.setFont(undefined, 'bold'); doc.setTextColor(...C.white);
      cols.forEach(col => doc.text(col.label, col.x + 2, y + 5.5));
      y += 9;

      attempts.slice(0, 50).forEach((att, ai) => {
        checkPage(8);
        doc.setFillColor(...(ai % 2 === 0 ? C.rowEven : C.white));
        doc.rect(ML, y, CW, 7.5, 'F');
        doc.setDrawColor(...C.lightBorder); doc.setLineWidth(0.2);
        doc.line(ML, y + 7.5, ML + CW, y + 7.5);

        const pct    = +att.percentage;
        const pColor = pct >= 70 ? C.green : pct >= 50 ? C.yellow : C.red;
        const name   = safe(
          att._profile?._displayName ||
          att._profile?.full_name    ||
          ('Student #' + att.user_id.slice(0, 8))
        );

        doc.setFontSize(7.5); doc.setFont(undefined, 'normal'); doc.setTextColor(...C.bodyText);
        doc.text(doc.splitTextToSize(name, cols[0].w - 2)[0], cols[0].x + 2, y + 5);
        doc.setFont(undefined, 'bold'); doc.setTextColor(...pColor);
        doc.text(pct + '%  (' + att.score + '/' + att.total_questions + ')', cols[1].x + 2, y + 5);
        doc.setFont(undefined, 'normal'); doc.setTextColor(...C.muted);
        doc.text(fmtDuration(att.time_taken_secs), cols[2].x + 2, y + 5);
        doc.text(
          att.submitted_at ? new Date(att.submitted_at).toLocaleDateString('en-IN') : '--',
          cols[3].x + 2, y + 5
        );
        doc.setTextColor(...pColor);
        doc.text(pct >= 70 ? 'Excellent' : pct >= 50 ? 'Good' : 'Needs Work', cols[4].x + 2, y + 5);
        y += 7.5;
      });

      if (attempts.length > 50) {
        checkPage(8);
        doc.setFontSize(7); doc.setTextColor(...C.muted);
        doc.text('... and ' + (attempts.length - 50) + ' more attempts not shown.', ML, y + 5);
        y += 8;
      }
      y += 5;
    }
  });

  // ── Page numbers + footer bar ───────────────────────────────
  const pc = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pc; i++) {
    doc.setPage(i);
    doc.setFillColor(...C.headerBg);
    doc.rect(0, PH - 8, PW, 8, 'F');
    doc.setFontSize(6.5); doc.setFont(undefined, 'normal'); doc.setTextColor(...C.white);
    doc.text('OmegaTest  |  Daily Challenge Report', ML, PH - 3);
    doc.text('Page ' + i + ' of ' + pc, PW - MR, PH - 3, { align: 'right' });
  }

  return doc;
}