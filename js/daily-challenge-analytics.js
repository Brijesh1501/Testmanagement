// ============================================================
// daily-challenge-analytics.js
// ─ DC Analytics page (student & admin)
// ─ Admin: View Questions modal per challenge
// ─ Admin: Download PDF report for any / all challenges
// ============================================================

// ─── Guard: ensure jsPDF is available ────────────────────────
function ensureJsPDF() {
  if (window.jspdf && window.jspdf.jsPDF) return true;
  if (window.jsPDF) return true;
  return false;
}

// ─── Entry point called from navigateTo('admin-daily-challenge-analytics') ───
async function loadDCAnalytics() {
  const isAdmin = currentProfile?.role === 'admin';
  const containerId = isAdmin ? 'admin-dc-analytics-content' : 'dc-analytics-content';
  const loadingId   = isAdmin ? 'admin-dc-analytics-loading' : 'dc-analytics-loading';

  const loadingEl = document.getElementById(loadingId);
  const contentEl = document.getElementById(containerId);
  if (!contentEl) return;

  if (loadingEl) loadingEl.style.display = '';
  contentEl.style.display = 'none';
  contentEl.innerHTML = '';

  if (isAdmin) {
    await loadAdminDCAnalytics(contentEl);
  } else {
    await loadStudentDCAnalytics(contentEl);
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
    .select('*, daily_challenges(title, challenge_date, topics, time_limit_minutes)')
    .eq('user_id', currentUser.id)
    .order('submitted_at', { ascending: true });

  if (!attempts || !attempts.length) {
    container.innerHTML = `<div style="text-align:center;padding:60px 20px;color:var(--muted);">
      <div style="font-size:48px;margin-bottom:16px;">📊</div>
      <div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:8px;">No Data Yet</div>
      <div style="font-size:13px;">Complete your first Daily Challenge to see analytics here.</div>
    </div>`;
    return;
  }

  const total    = attempts.length;
  const avgPct   = +(attempts.reduce((s, a) => s + +a.percentage, 0) / total).toFixed(1);
  const bestPct  = Math.max(...attempts.map(a => +a.percentage));
  const streak   = await loadStudentStreak();
  const over70   = attempts.filter(a => +a.percentage >= 70).length;

  container.innerHTML = `
    <!-- Summary Cards -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      ${dcAnalyticsCard('🗓️', 'Total Attempted', total, '#3b82f6')}
      ${dcAnalyticsCard('📈', 'Average Score', avgPct + '%', '#10b981')}
      ${dcAnalyticsCard('🏆', 'Best Score', bestPct + '%', '#f59e0b')}
      ${dcAnalyticsCard('🔥', 'Current Streak', streak + ' day' + (streak !== 1 ? 's' : ''), '#ef4444')}
    </div>

    <!-- Score Trend Chart -->
    <div class="glass p-5 mb-5">
      <div style="font-size:14px;font-weight:700;margin-bottom:16px;">📉 Score Trend</div>
      <canvas id="dc-score-trend-chart" height="90"></canvas>
    </div>

    <!-- Score Distribution + Topic breakdown -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
      <div class="glass p-5">
        <div style="font-size:14px;font-weight:700;margin-bottom:16px;">🎯 Score Bands</div>
        <canvas id="dc-score-band-chart" height="160"></canvas>
      </div>
      <div class="glass p-5">
        <div style="font-size:14px;font-weight:700;margin-bottom:16px;">📅 Completion Heatmap (last 30 days)</div>
        <div id="dc-heatmap" style="display:flex;flex-wrap:wrap;gap:4px;padding:4px 0;"></div>
        <div style="display:flex;gap:12px;margin-top:12px;font-size:11px;color:var(--muted);align-items:center;">
          <span style="display:flex;align-items:center;gap:4px;"><span style="width:12px;height:12px;border-radius:3px;background:rgba(16,185,129,.6);display:inline-block;"></span>Completed</span>
          <span style="display:flex;align-items:center;gap:4px;"><span style="width:12px;height:12px;border-radius:3px;background:var(--surface2);display:inline-block;"></span>Missed</span>
        </div>
      </div>
    </div>

    <!-- Recent history table -->
    <div class="glass p-5">
      <div style="font-size:14px;font-weight:700;margin-bottom:16px;">📋 Recent Attempts</div>
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead><tr><th>Date</th><th>Challenge</th><th>Score</th><th>Time</th><th>Result</th></tr></thead>
          <tbody>
            ${[...attempts].reverse().slice(0, 20).map(a => {
              const pct   = +a.percentage;
              const color = pct >= 70 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
              const ch    = a.daily_challenges;
              return `<tr>
                <td class="mono" style="font-size:12px;">${ch?.challenge_date || '—'}</td>
                <td style="font-size:13px;font-weight:600;">${ch?.title || 'Daily Challenge'}</td>
                <td><span style="font-weight:800;color:${color};">${pct}%</span> <span style="font-size:11px;color:var(--muted);">(${a.score}/${a.total_questions})</span></td>
                <td style="font-size:12px;color:var(--muted);">${fmtDuration(a.time_taken_secs)}</td>
                <td><span class="badge ${pct >= 70 ? 'badge-green' : pct >= 50 ? '' : 'badge-red'}" style="${pct >= 50 && pct < 70 ? 'background:rgba(245,158,11,.15);color:#f59e0b;border:1px solid rgba(245,158,11,.3);' : ''}">${pct >= 70 ? '🏆 Excellent' : pct >= 50 ? '👍 Good' : '💪 Keep Going'}</span></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;

  // Render charts after DOM is painted
  requestAnimationFrame(() => {
    renderDCScoreTrend(attempts);
    renderDCScoreBands(attempts);
    renderDCHeatmap(attempts);
  });
}

function dcAnalyticsCard(icon, label, value, color) {
  return `<div class="glass p-5" style="border-left:3px solid ${color};">
    <div style="font-size:22px;margin-bottom:8px;">${icon}</div>
    <div style="font-size:24px;font-weight:800;color:${color};margin-bottom:2px;">${value}</div>
    <div style="font-size:12px;color:var(--muted);">${label}</div>
  </div>`;
}

function renderDCScoreTrend(attempts) {
  const ctx = document.getElementById('dc-score-trend-chart');
  if (!ctx) return;
  if (chartInstances['dc-trend']) { try { chartInstances['dc-trend'].destroy(); } catch(e){} }
  const labels = attempts.map(a => a.daily_challenges?.challenge_date || fmtDate(a.submitted_at));
  const data   = attempts.map(a => +a.percentage);
  chartInstances['dc-trend'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Score %',
        data,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59,130,246,.12)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: data.map(v => v >= 70 ? '#10b981' : v >= 50 ? '#f59e0b' : '#ef4444'),
        pointRadius: 5,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#94a3b8', font: { size: 10 }, maxTicksLimit: 10 } },
        y: { min: 0, max: 100, ticks: { color: '#94a3b8', callback: v => v + '%' }, grid: { color: 'rgba(148,163,184,.1)' } }
      }
    }
  });
}

function renderDCScoreBands(attempts) {
  const ctx = document.getElementById('dc-score-band-chart');
  if (!ctx) return;
  if (chartInstances['dc-bands']) { try { chartInstances['dc-bands'].destroy(); } catch(e){} }
  const bands = { 'Excellent (≥70%)': 0, 'Good (50–69%)': 0, 'Needs Work (<50%)': 0 };
  attempts.forEach(a => {
    const p = +a.percentage;
    if (p >= 70) bands['Excellent (≥70%)']++;
    else if (p >= 50) bands['Good (50–69%)']++;
    else bands['Needs Work (<50%)']++;
  });
  chartInstances['dc-bands'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: Object.keys(bands),
      datasets: [{ data: Object.values(bands), backgroundColor: ['#10b981','#f59e0b','#ef4444'], borderWidth: 0, hoverOffset: 6 }]
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
  const completedDays = new Set(attempts.map(a => a.daily_challenges?.challenge_date).filter(Boolean));
  const today = new Date(); today.setHours(0,0,0,0);
  const cells = [];
  for (let i = 29; i >= 0; i--) {
    const d   = new Date(today); d.setDate(d.getDate() - i);
    const key = d.toLocaleDateString('en-CA');
    const done = completedDays.has(key);
    cells.push(`<div title="${key}" style="width:22px;height:22px;border-radius:4px;background:${done ? 'rgba(16,185,129,.6)' : 'var(--surface2)'};border:1px solid ${done ? 'rgba(16,185,129,.3)' : 'var(--border)'};" ></div>`);
  }
  el.innerHTML = cells.join('');
}

// ══════════════════════════════════════════════════════════════
// ADMIN DC ANALYTICS
// ══════════════════════════════════════════════════════════════
async function loadAdminDCAnalytics(container) {
  // Fetch all challenges + attempts
  const [challengesRes, attemptsRes, profilesRes] = await Promise.all([
    sb.from('daily_challenges').select('*').order('challenge_date', { ascending: false }).limit(90),
    sb.from('daily_challenge_attempts').select('*, profiles(full_name, email)').order('submitted_at', { ascending: true }),
    sb.from('profiles').select('id, full_name, email').eq('role', 'student'),
  ]);

  const challenges = challengesRes.data || [];
  const attempts   = attemptsRes.data  || [];
  const students   = profilesRes.data  || [];

  if (!challenges.length) {
    container.innerHTML = `<div style="text-align:center;padding:60px 20px;color:var(--muted);">
      <div style="font-size:48px;margin-bottom:16px;">📊</div>
      <div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:8px;">No Challenges Yet</div>
      <div style="font-size:13px;">Create your first Daily Challenge to see analytics.</div>
    </div>`;
    return;
  }

  // Build per-challenge attempt map
  const attByChallenge = {};
  attempts.forEach(a => {
    if (!attByChallenge[a.challenge_id]) attByChallenge[a.challenge_id] = [];
    attByChallenge[a.challenge_id].push(a);
  });

  const totalAttempts   = attempts.length;
  const totalChallenges = challenges.length;
  const avgScore        = totalAttempts ? +(attempts.reduce((s, a) => s + +a.percentage, 0) / totalAttempts).toFixed(1) : 0;
  const uniqueStudents  = new Set(attempts.map(a => a.user_id)).size;
  const activeDays      = new Set(attempts.map(a => a.daily_challenges?.challenge_date || a.submitted_at?.slice(0,10))).size;

  container.innerHTML = `
    <!-- Admin controls bar -->
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px;">
      <h2 style="font-size:18px;font-weight:800;margin:0;">📊 Daily Challenge Analytics</h2>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button onclick="downloadDCPDFAll()" class="btn-primary" style="font-size:12px;padding:8px 16px;">
          ⬇️ Download All Challenges PDF
        </button>
      </div>
    </div>

    <!-- KPI Summary -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      ${dcAnalyticsCard('📅', 'Total Challenges', totalChallenges, '#3b82f6')}
      ${dcAnalyticsCard('📝', 'Total Attempts', totalAttempts, '#10b981')}
      ${dcAnalyticsCard('👥', 'Active Students', uniqueStudents, '#f59e0b')}
      ${dcAnalyticsCard('📈', 'Platform Avg Score', avgScore + '%', '#06b6d4')}
    </div>

    <!-- Charts row -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
      <div class="glass p-5">
        <div style="font-size:14px;font-weight:700;margin-bottom:16px;">📉 Avg Score Per Challenge (last 20)</div>
        <canvas id="admin-dc-score-chart" height="140"></canvas>
      </div>
      <div class="glass p-5">
        <div style="font-size:14px;font-weight:700;margin-bottom:16px;">👥 Participation Per Challenge (last 20)</div>
        <canvas id="admin-dc-participation-chart" height="140"></canvas>
      </div>
    </div>

    <!-- Student Leaderboard -->
    <div class="glass p-5 mb-5">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <div style="font-size:14px;font-weight:700;">🏅 Student Leaderboard (by avg DC score)</div>
      </div>
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead><tr><th>#</th><th>Student</th><th>Attempts</th><th>Avg Score</th><th>Best Score</th><th>Streak Days</th></tr></thead>
          <tbody id="admin-dc-leaderboard"></tbody>
        </table>
      </div>
    </div>

    <!-- Per-challenge table -->
    <div class="glass p-5">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px;">
        <div style="font-size:14px;font-weight:700;">📋 All Challenges Detail</div>
        <input oninput="filterDCAdminTable(this.value)" placeholder="Search challenges…"
          style="padding:7px 14px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-size:12px;width:200px;">
      </div>
      <div style="overflow-x:auto;" id="admin-dc-table-wrap">
        <table class="data-table" id="admin-dc-detail-table">
          <thead><tr><th>Date</th><th>Title</th><th>Topics</th><th>Questions</th><th>Attempts</th><th>Avg Score</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody id="admin-dc-detail-tbody"></tbody>
        </table>
      </div>
    </div>`;

  // Build leaderboard
  buildDCLeaderboard(attempts, students);

  // Build per-challenge detail rows
  buildDCDetailTable(challenges, attByChallenge);

  // Charts
  requestAnimationFrame(() => {
    renderAdminDCScoreChart(challenges, attByChallenge);
    renderAdminDCParticipationChart(challenges, attByChallenge);
  });
}

function buildDCLeaderboard(attempts, students) {
  const tbody = document.getElementById('admin-dc-leaderboard');
  if (!tbody) return;

  const byStudent = {};
  attempts.forEach(a => {
    if (!byStudent[a.user_id]) byStudent[a.user_id] = { name: a.profiles?.full_name || a.profiles?.email || 'Unknown', attempts: [], dates: new Set() };
    byStudent[a.user_id].attempts.push(+a.percentage);
    byStudent[a.user_id].dates.add(a.submitted_at?.slice(0,10));
  });

  const rows = Object.values(byStudent).map(s => ({
    name:    s.name,
    count:   s.attempts.length,
    avg:     +(s.attempts.reduce((a,b) => a+b, 0) / s.attempts.length).toFixed(1),
    best:    Math.max(...s.attempts),
    streak:  s.dates.size,
  })).sort((a, b) => b.avg - a.avg).slice(0, 20);

  if (!rows.length) { tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--muted);">No student data yet.</td></tr>`; return; }

  const medals = ['🥇','🥈','🥉'];
  tbody.innerHTML = rows.map((r, i) => `
    <tr>
      <td style="font-size:14px;">${medals[i] || (i+1)}</td>
      <td style="font-size:13px;font-weight:600;">${r.name}</td>
      <td style="font-size:13px;">${r.count}</td>
      <td><span style="font-weight:800;color:${r.avg >= 70 ? '#10b981' : r.avg >= 50 ? '#f59e0b' : '#ef4444'};">${r.avg}%</span></td>
      <td style="font-size:13px;color:#f59e0b;font-weight:700;">${r.best}%</td>
      <td style="font-size:13px;">${r.streak} 🔥</td>
    </tr>`).join('');
}

// Store for filter
window._dcAdminRows = [];

function buildDCDetailTable(challenges, attByChallenge) {
  const today = new Date().toLocaleDateString('en-CA');
  window._dcAdminRows = challenges.map(c => {
    const atts    = attByChallenge[c.id] || [];
    const avgPct  = atts.length ? +(atts.reduce((s,a) => s + +a.percentage, 0) / atts.length).toFixed(1) : null;
    const isToday = c.challenge_date === today;
    const isFuture= c.challenge_date > today;
    const status  = c.is_active ? (isToday ? 'Live Today' : isFuture ? 'Active' : 'Active') : (isFuture ? 'Scheduled' : 'Inactive');
    const badgeClass = c.is_active ? 'badge-green' : '';
    return { c, atts, avgPct, status, badgeClass };
  });
  renderDCAdminTableRows(window._dcAdminRows);
}

function renderDCAdminTableRows(rows) {
  const tbody = document.getElementById('admin-dc-detail-tbody');
  if (!tbody) return;
  if (!rows.length) { tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--muted);">No challenges found.</td></tr>`; return; }
  tbody.innerHTML = rows.map(({ c, atts, avgPct, status, badgeClass }) => `
    <tr>
      <td class="mono" style="font-size:12px;">${c.challenge_date}</td>
      <td style="font-size:13px;font-weight:600;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${c.title || '—'}</td>
      <td style="font-size:11px;color:var(--muted);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${(c.topics||[]).slice(0,3).join(', ')}</td>
      <td style="font-size:13px;">${c.question_count || '—'}</td>
      <td style="font-size:13px;">${atts.length}</td>
      <td style="font-size:13px;font-weight:700;color:${avgPct === null ? 'var(--muted)' : avgPct >= 70 ? '#10b981' : avgPct >= 50 ? '#f59e0b' : '#ef4444'};">
        ${avgPct !== null ? avgPct + '%' : '—'}
      </td>
      <td><span class="badge ${badgeClass}" style="${!c.is_active ? 'background:rgba(245,158,11,.12);color:#fbbf24;border:1px solid rgba(245,158,11,.3);' : ''}">${status}</span></td>
      <td>
        <div style="display:flex;gap:5px;flex-wrap:wrap;">
          <button onclick="adminViewDCQuestions('${c.id}')" class="btn-secondary" style="font-size:11px;padding:5px 9px;">👁 Questions</button>
          <button onclick="downloadDCPDFSingle('${c.id}')" class="btn-primary" style="font-size:11px;padding:5px 9px;">⬇️ PDF</button>
        </div>
      </td>
    </tr>`).join('');
}

function filterDCAdminTable(query) {
  const q = query.toLowerCase();
  const filtered = (window._dcAdminRows || []).filter(({ c }) =>
    (c.title || '').toLowerCase().includes(q) ||
    (c.challenge_date || '').includes(q) ||
    (c.topics || []).join(' ').toLowerCase().includes(q)
  );
  renderDCAdminTableRows(filtered);
}

function renderAdminDCScoreChart(challenges, attByChallenge) {
  const ctx = document.getElementById('admin-dc-score-chart');
  if (!ctx) return;
  if (chartInstances['admin-dc-score']) { try { chartInstances['admin-dc-score'].destroy(); } catch(e){} }

  const slice = [...challenges].reverse().slice(-20);
  const labels = slice.map(c => c.challenge_date?.slice(5));
  const data   = slice.map(c => {
    const atts = attByChallenge[c.id] || [];
    return atts.length ? +(atts.reduce((s,a) => s + +a.percentage, 0) / atts.length).toFixed(1) : 0;
  });

  chartInstances['admin-dc-score'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Avg Score %',
        data,
        backgroundColor: data.map(v => v >= 70 ? 'rgba(16,185,129,.7)' : v >= 50 ? 'rgba(245,158,11,.7)' : 'rgba(239,68,68,.7)'),
        borderRadius: 5,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#94a3b8', font: { size: 9 } } },
        y: { min: 0, max: 100, ticks: { color: '#94a3b8', callback: v => v + '%' }, grid: { color: 'rgba(148,163,184,.1)' } }
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
  const data   = slice.map(c => (attByChallenge[c.id] || []).length);

  chartInstances['admin-dc-part'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Attempts',
        data,
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6,182,212,.12)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#06b6d4',
        pointRadius: 4,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#94a3b8', font: { size: 9 } } },
        y: { min: 0, ticks: { color: '#94a3b8', stepSize: 1 }, grid: { color: 'rgba(148,163,184,.1)' } }
      }
    }
  });
}

// ══════════════════════════════════════════════════════════════
// ADMIN: VIEW QUESTIONS MODAL
// ══════════════════════════════════════════════════════════════
async function adminViewDCQuestions(challengeId) {
  if (currentProfile?.role !== 'admin') { showToast('Admin only.', 'error'); return; }

  // Build or reuse modal
  let modal = document.getElementById('admin-dc-qview-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'admin-dc-qview-modal';
    modal.className = 'modal-overlay';
    modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9000;align-items:center;justify-content:center;padding:16px;';
    modal.innerHTML = `
      <div class="glass" style="width:100%;max-width:780px;max-height:90vh;display:flex;flex-direction:column;border-radius:20px;overflow:hidden;">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid var(--border);flex-shrink:0;">
          <div>
            <div id="admin-dc-qview-title" style="font-size:16px;font-weight:800;">Challenge Questions</div>
            <div id="admin-dc-qview-meta" style="font-size:12px;color:var(--muted);margin-top:2px;"></div>
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
            <button id="admin-dc-qview-pdf-btn" class="btn-primary" style="font-size:12px;padding:8px 14px;">⬇️ Download PDF</button>
            <button onclick="document.getElementById('admin-dc-qview-modal').style.display='none'" class="btn-secondary" style="font-size:12px;padding:8px 14px;">✕ Close</button>
          </div>
        </div>
        <div id="admin-dc-qview-body" style="overflow-y:auto;padding:20px 24px;flex:1;display:flex;flex-direction:column;gap:16px;">
          <div style="color:var(--muted);font-size:13px;text-align:center;padding:32px 0;">Loading…</div>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }

  modal.style.display = 'flex';
  document.getElementById('admin-dc-qview-body').innerHTML =
    `<div style="color:var(--muted);font-size:13px;text-align:center;padding:32px 0;">Loading questions…</div>`;

  const [chalRes, qRes] = await Promise.all([
    sb.from('daily_challenges').select('*').eq('id', challengeId).single(),
    sb.from('daily_challenge_questions').select('*').eq('challenge_id', challengeId).order('order_index'),
  ]);

  const challenge  = chalRes.data;
  const questions  = qRes.data || [];

  if (!challenge) { document.getElementById('admin-dc-qview-body').innerHTML = `<div style="color:#ef4444;">Could not load challenge.</div>`; return; }

  document.getElementById('admin-dc-qview-title').textContent = challenge.title || 'Challenge Questions';
  document.getElementById('admin-dc-qview-meta').textContent  =
    `${challenge.challenge_date} · ${questions.length} questions · Topics: ${(challenge.topics||[]).join(', ')} · Difficulty: ${challenge.difficulty || 'medium'}`;

  // Wire PDF button
  document.getElementById('admin-dc-qview-pdf-btn').onclick = () => downloadDCPDFSingle(challengeId);

  if (!questions.length) {
    document.getElementById('admin-dc-qview-body').innerHTML = `<div style="color:var(--muted);text-align:center;padding:32px 0;">No questions in this challenge.</div>`;
    return;
  }

  document.getElementById('admin-dc-qview-body').innerHTML = questions.map((q, i) => `
    <div style="padding:16px;background:var(--surface2);border-radius:12px;border-left:3px solid ${['#3b82f6','#10b981','#f59e0b','#06b6d4','#8b5cf6'][i % 5]};">
      <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:12px;">
        <span style="background:var(--accent);color:#fff;border-radius:7px;padding:3px 9px;font-size:11px;font-weight:700;flex-shrink:0;margin-top:1px;">Q${i+1}</span>
        <div style="font-size:14px;font-weight:600;line-height:1.6;flex:1;">${q.question_text}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px;">
        ${['A','B','C','D'].map(l => `
          <div style="padding:7px 11px;border-radius:8px;font-size:12px;
            background:${l === q.correct_answer ? 'rgba(16,185,129,.15)' : 'rgba(30,41,59,.5)'};
            border:1px solid ${l === q.correct_answer ? 'rgba(16,185,129,.5)' : 'var(--border)'};
            color:${l === q.correct_answer ? '#10b981' : 'var(--text)'};font-weight:${l === q.correct_answer ? '700' : '400'};">
            <strong>${l}.</strong> ${q['option_' + l.toLowerCase()]} ${l === q.correct_answer ? '✓' : ''}
          </div>`).join('')}
      </div>
      ${q.explanation ? `<div style="font-size:12px;color:#60a5fa;background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.2);border-radius:8px;padding:8px 12px;line-height:1.6;">💡 <strong>Explanation:</strong> ${q.explanation}</div>` : ''}
      ${q.topic ? `<div style="margin-top:8px;"><span style="font-size:10px;background:rgba(139,92,246,.15);color:#a78bfa;border:1px solid rgba(139,92,246,.25);border-radius:20px;padding:2px 10px;">🏷 ${q.topic}</span></div>` : ''}
    </div>`).join('');
}

// ══════════════════════════════════════════════════════════════
// PDF DOWNLOAD — ADMIN ONLY
// ══════════════════════════════════════════════════════════════

// Dynamically load jsPDF if not present
async function loadJsPDF() {
  if (window.jspdf?.jsPDF || window.jsPDF) return;
  await new Promise((resolve, reject) => {
    const script  = document.createElement('script');
    script.src    = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Failed to load jsPDF library'));
    document.head.appendChild(script);
  });
}

// Download PDF for a single challenge
async function downloadDCPDFSingle(challengeId) {
  if (currentProfile?.role !== 'admin') { showToast('Admin only.', 'error'); return; }
  showToast('Preparing PDF…', 'info');

  try {
    await loadJsPDF();
    const [chalRes, qRes, attRes] = await Promise.all([
      sb.from('daily_challenges').select('*').eq('id', challengeId).single(),
      sb.from('daily_challenge_questions').select('*').eq('challenge_id', challengeId).order('order_index'),
      sb.from('daily_challenge_attempts').select('*, profiles(full_name,email)').eq('challenge_id', challengeId).order('submitted_at', { ascending: false }),
    ]);

    const challenge = chalRes.data;
    const questions = qRes.data  || [];
    const attempts  = attRes.data || [];
    if (!challenge) throw new Error('Challenge not found');

    const doc = buildDCPDFDoc([{ challenge, questions, attempts }]);
    const filename = `dc_${challenge.challenge_date}_${(challenge.title||'challenge').replace(/\s+/g,'_').toLowerCase()}.pdf`;
    doc.save(filename);
    showToast('PDF downloaded!', 'success');
  } catch (err) {
    showToast('PDF error: ' + err.message, 'error');
    console.error(err);
  }
}

// Download PDF for ALL challenges
async function downloadDCPDFAll() {
  if (currentProfile?.role !== 'admin') { showToast('Admin only.', 'error'); return; }
  showToast('Building PDF for all challenges… this may take a moment.', 'info');

  try {
    await loadJsPDF();
    const { data: challenges } = await sb.from('daily_challenges').select('*').order('challenge_date', { ascending: false }).limit(60);
    if (!challenges || !challenges.length) throw new Error('No challenges found');

    const allData = await Promise.all(challenges.map(async c => {
      const [qRes, aRes] = await Promise.all([
        sb.from('daily_challenge_questions').select('*').eq('challenge_id', c.id).order('order_index'),
        sb.from('daily_challenge_attempts').select('*, profiles(full_name,email)').eq('challenge_id', c.id),
      ]);
      return { challenge: c, questions: qRes.data || [], attempts: aRes.data || [] };
    }));

    const doc = buildDCPDFDoc(allData);
    doc.save(`daily_challenges_report_${new Date().toLocaleDateString('en-CA')}.pdf`);
    showToast('PDF with all challenges downloaded!', 'success');
  } catch (err) {
    showToast('PDF error: ' + err.message, 'error');
    console.error(err);
  }
}

// Core PDF builder — accepts array of { challenge, questions, attempts }
function buildDCPDFDoc(items) {
  const jsPDF = window.jspdf?.jsPDF || window.jsPDF;
  const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const PAGE_W = 210, PAGE_H = 297;
  const ML = 14, MR = 14, MT = 16, MB = 16;
  const CW = PAGE_W - ML - MR;

  // ── Colors ──
  const C = {
    accent:  [59, 130, 246],
    green:   [16, 185, 129],
    yellow:  [245, 158, 11],
    red:     [239, 68, 68],
    dark:    [15, 23, 42],
    mid:     [71, 85, 105],
    light:   [148, 163, 184],
    surface: [30, 41, 59],
    border:  [51, 65, 85],
    white:   [255, 255, 255],
    bg:      [10, 15, 28],
  };

  let y = MT;

  function checkPageBreak(needed = 10) {
    if (y + needed > PAGE_H - MB) { doc.addPage(); y = MT; drawPageHeader(); }
  }

  function drawPageHeader() {
    doc.setFillColor(...C.accent);
    doc.rect(0, 0, PAGE_W, 8, 'F');
    doc.setFontSize(7); doc.setTextColor(...C.white);
    doc.text('OmegaTest · Daily Challenge Report', ML, 5.5);
    doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, PAGE_W - MR, 5.5, { align: 'right' });
    doc.setTextColor(...C.dark);
  }

  function hRule(color = C.border) {
    doc.setDrawColor(...color);
    doc.setLineWidth(0.3);
    doc.line(ML, y, PAGE_W - MR, y);
    y += 3;
  }

  function sectionBox(title, icon = '') {
    checkPageBreak(14);
    doc.setFillColor(...C.surface);
    doc.roundedRect(ML, y, CW, 10, 2, 2, 'F');
    doc.setFontSize(10); doc.setFont(undefined, 'bold'); doc.setTextColor(...C.accent);
    doc.text(`${icon}  ${title}`, ML + 4, y + 6.5);
    doc.setFont(undefined, 'normal');
    y += 13;
  }

  // ── COVER PAGE ──────────────────────────────────────────────
  doc.setFillColor(...C.dark);
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F');
  doc.setFillColor(...C.accent);
  doc.rect(0, 0, PAGE_W, 2, 'F');
  doc.rect(0, PAGE_H - 2, PAGE_W, 2, 'F');

  // Logo area
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(PAGE_W/2 - 20, 40, 40, 40, 6, 6, 'F');
  doc.setFontSize(26); doc.setTextColor(...C.white);
  doc.text('⚡', PAGE_W/2, 66, { align: 'center' });

  doc.setFontSize(26); doc.setFont(undefined, 'bold'); doc.setTextColor(...C.white);
  doc.text('Daily Challenge', PAGE_W/2, 100, { align: 'center' });
  doc.setFontSize(16); doc.setFont(undefined, 'normal'); doc.setTextColor(...C.light);
  doc.text('Analytics & Questions Report', PAGE_W/2, 112, { align: 'center' });

  const totalCh  = items.length;
  const totalQ   = items.reduce((s, i) => s + i.questions.length, 0);
  const totalAtt = items.reduce((s, i) => s + i.attempts.length, 0);
  const avgScore = totalAtt
    ? +(items.flatMap(i => i.attempts).reduce((s, a) => s + +a.percentage, 0) / totalAtt).toFixed(1)
    : 0;

  // KPI boxes on cover
  const kpis = [
    { label: 'Challenges', value: totalCh,       color: C.accent  },
    { label: 'Questions',  value: totalQ,         color: C.green   },
    { label: 'Attempts',   value: totalAtt,       color: C.yellow  },
    { label: 'Avg Score',  value: avgScore + '%', color: [239,68,68] },
  ];
  const bw = (CW - 9) / 4;
  kpis.forEach((k, i) => {
    const bx = ML + i * (bw + 3);
    doc.setFillColor(30, 41, 59);
    doc.roundedRect(bx, 128, bw, 24, 3, 3, 'F');
    doc.setDrawColor(...k.color);
    doc.setLineWidth(0.6);
    doc.roundedRect(bx, 128, bw, 24, 3, 3, 'S');
    doc.setFontSize(14); doc.setFont(undefined, 'bold'); doc.setTextColor(...k.color);
    doc.text(String(k.value), bx + bw/2, 138, { align: 'center' });
    doc.setFontSize(8);  doc.setFont(undefined, 'normal'); doc.setTextColor(...C.light);
    doc.text(k.label, bx + bw/2, 144, { align: 'center' });
  });

  doc.setFontSize(9); doc.setTextColor(...C.mid);
  doc.text(`Report generated: ${new Date().toLocaleString('en-IN')}`, PAGE_W/2, 170, { align: 'center' });
  doc.setFontSize(8); doc.setTextColor(40, 60, 90);
  doc.text('OmegaTest Platform — Admin Report — Confidential', PAGE_W/2, PAGE_H - 8, { align: 'center' });

  // ── PER-CHALLENGE PAGES ──────────────────────────────────────
  items.forEach(({ challenge, questions, attempts }, idx) => {
    doc.addPage();
    y = MT;
    drawPageHeader();
    y += 4;

    // Challenge header
    doc.setFillColor(...C.accent);
    doc.roundedRect(ML, y, CW, 18, 3, 3, 'F');
    doc.setFontSize(13); doc.setFont(undefined, 'bold'); doc.setTextColor(...C.white);
    doc.text(challenge.title || 'Daily Challenge', ML + 4, y + 7);
    doc.setFontSize(8); doc.setFont(undefined, 'normal');
    doc.text(`Date: ${challenge.challenge_date}  ·  Questions: ${questions.length}  ·  Time: ${challenge.time_limit_minutes || 15} min  ·  Difficulty: ${challenge.difficulty || 'medium'}`, ML + 4, y + 14);
    y += 22;

    // Topics
    if ((challenge.topics || []).length) {
      doc.setFontSize(8); doc.setTextColor(...C.light);
      doc.text('Topics: ' + challenge.topics.join(', '), ML, y);
      y += 6;
    }

    // Stats row
    const attCount = attempts.length;
    const avgPct   = attCount ? +(attempts.reduce((s, a) => s + +a.percentage, 0) / attCount).toFixed(1) : null;
    const bestPct  = attCount ? Math.max(...attempts.map(a => +a.percentage)) : null;

    const statBoxes = [
      { label: 'Attempts',  val: attCount,              color: C.accent },
      { label: 'Avg Score', val: avgPct !== null ? avgPct + '%' : '—', color: avgPct === null ? C.mid : avgPct >= 70 ? C.green : avgPct >= 50 ? C.yellow : C.red },
      { label: 'Best Score',val: bestPct !== null ? bestPct + '%' : '—', color: C.yellow },
    ];
    const sbw = (CW - 6) / 3;
    statBoxes.forEach((sb2, i) => {
      const bx = ML + i * (sbw + 3);
      doc.setFillColor(...C.surface);
      doc.roundedRect(bx, y, sbw, 16, 2, 2, 'F');
      doc.setFontSize(12); doc.setFont(undefined, 'bold'); doc.setTextColor(...sb2.color);
      doc.text(String(sb2.val), bx + sbw/2, y + 8, { align: 'center' });
      doc.setFontSize(7); doc.setFont(undefined, 'normal'); doc.setTextColor(...C.light);
      doc.text(sb2.label, bx + sbw/2, y + 13, { align: 'center' });
    });
    y += 20;

    // ── QUESTIONS ──────────────────────────────────────────────
    sectionBox(`Questions (${questions.length})`, '📝');

    questions.forEach((q, qi) => {
      const lineHeight = 5;
      const qLines     = doc.splitTextToSize(`Q${qi + 1}. ${q.question_text}`, CW - 8);
      const optLines   = ['A','B','C','D'].map(l => doc.splitTextToSize(`${l}. ${q['option_' + l.toLowerCase()]}`, CW/2 - 12));
      const expLines   = q.explanation ? doc.splitTextToSize(`💡 ${q.explanation}`, CW - 12) : [];

      const maxOptH    = Math.max(...optLines.map(o => o.length)) * lineHeight;
      const boxH       = qLines.length * lineHeight + maxOptH + (expLines.length ? expLines.length * lineHeight + 4 : 0) + 18;

      checkPageBreak(boxH + 4);

      // Question box
      doc.setFillColor(...C.surface);
      doc.roundedRect(ML, y, CW, boxH, 2, 2, 'F');

      // Q number badge
      doc.setFillColor(...C.accent);
      doc.roundedRect(ML + 2, y + 2, 14, 7, 1.5, 1.5, 'F');
      doc.setFontSize(7); doc.setFont(undefined, 'bold'); doc.setTextColor(...C.white);
      doc.text(`Q${qi+1}`, ML + 9, y + 6.5, { align: 'center' });

      // Topic tag
      if (q.topic) {
        const tW = doc.getTextWidth(q.topic) + 6;
        doc.setFillColor(139, 92, 246, 0.3);
        doc.setFillColor(60, 40, 120);
        doc.roundedRect(PAGE_W - MR - tW - 2, y + 2, tW + 2, 7, 1.5, 1.5, 'F');
        doc.setFontSize(6.5); doc.setTextColor(167, 139, 250);
        doc.text(q.topic, PAGE_W - MR - tW/2 - 1, y + 6.5, { align: 'center' });
      }

      // Question text
      doc.setFontSize(8.5); doc.setFont(undefined, 'normal'); doc.setTextColor(...C.white);
      let ty = y + 12;
      qLines.forEach(line => { doc.text(line, ML + 4, ty); ty += lineHeight; });
      ty += 2;

      // Options grid 2x2
      const opts = ['A','B','C','D'];
      const colW = CW/2 - 4;
      opts.forEach((l, oi) => {
        const col = oi % 2;
        const row = Math.floor(oi / 2);
        if (col === 0 && row > 0) ty += maxOptH / 2 + 1;
        const ox = ML + col * (colW + 8) + 2;
        const oy = ty;
        const isCorrect = l === q.correct_answer;
        doc.setFillColor(...(isCorrect ? C.green : C.border));
        doc.setFillColor(...(isCorrect ? [16,185,129] : [40,55,75]));
        doc.roundedRect(ox, oy - 3, colW, optLines[oi].length * lineHeight + 3, 1.5, 1.5, 'F');
        doc.setFontSize(7.5);
        doc.setFont(undefined, isCorrect ? 'bold' : 'normal');
        doc.setTextColor(...(isCorrect ? C.white : C.light));
        optLines[oi].forEach((line, li) => { doc.text(line, ox + 3, oy + li * lineHeight); });
        if (col === 1) ty += optLines[oi].length * lineHeight + 2;
      });

      ty += maxOptH / 2 + 3;

      // Explanation
      if (expLines.length) {
        doc.setFillColor(20, 40, 80);
        doc.roundedRect(ML + 2, ty - 2, CW - 4, expLines.length * lineHeight + 4, 1.5, 1.5, 'F');
        doc.setFontSize(7.5); doc.setFont(undefined, 'italic'); doc.setTextColor(96, 165, 250);
        expLines.forEach((line, li) => { doc.text(line, ML + 5, ty + li * lineHeight + 1); });
        ty += expLines.length * lineHeight + 4;
      }

      y += boxH + 4;
    });

    // ── ATTEMPTS TABLE ─────────────────────────────────────────
    if (attempts.length > 0) {
      checkPageBreak(20);
      sectionBox(`Student Attempts (${attempts.length})`, '👥');

      // Table header
      const cols = [
        { label: 'Student',   x: ML,        w: 60  },
        { label: 'Score',     x: ML + 63,   w: 25  },
        { label: 'Time',      x: ML + 91,   w: 28  },
        { label: 'Date',      x: ML + 122,  w: 35  },
        { label: 'Result',    x: ML + 160,  w: 30  },
      ];

      checkPageBreak(10);
      doc.setFillColor(...C.accent);
      doc.rect(ML, y, CW, 8, 'F');
      doc.setFontSize(7.5); doc.setFont(undefined, 'bold'); doc.setTextColor(...C.white);
      cols.forEach(col => doc.text(col.label, col.x + 1, y + 5.5));
      y += 9;

      attempts.slice(0, 50).forEach((att, ai) => {
        checkPageBreak(7);
        if (ai % 2 === 0) {
          doc.setFillColor(...C.surface);
          doc.rect(ML, y, CW, 7, 'F');
        }
        const pct   = +att.percentage;
        const color = pct >= 70 ? C.green : pct >= 50 ? C.yellow : C.red;
        doc.setFontSize(7); doc.setFont(undefined, 'normal'); doc.setTextColor(...C.light);
        const name = att.profiles?.full_name || att.profiles?.email || 'Unknown';
        doc.text(doc.splitTextToSize(name, 58)[0], cols[0].x + 1, y + 5);
        doc.setTextColor(...color); doc.setFont(undefined, 'bold');
        doc.text(`${pct}% (${att.score}/${att.total_questions})`, cols[1].x + 1, y + 5);
        doc.setFont(undefined, 'normal'); doc.setTextColor(...C.light);
        doc.text(fmtDuration(att.time_taken_secs), cols[2].x + 1, y + 5);
        doc.text(att.submitted_at ? new Date(att.submitted_at).toLocaleDateString('en-IN') : '—', cols[3].x + 1, y + 5);
        doc.setTextColor(...color);
        doc.text(pct >= 70 ? 'Excellent' : pct >= 50 ? 'Good' : 'Needs Work', cols[4].x + 1, y + 5);
        y += 7;
      });

      if (attempts.length > 50) {
        checkPageBreak(8);
        doc.setFontSize(7); doc.setTextColor(...C.mid);
        doc.text(`… and ${attempts.length - 50} more attempts not shown.`, ML, y + 5);
        y += 8;
      }

      y += 4;
    }

    // Page separator between challenges (not after last)
    if (idx < items.length - 1) {
      checkPageBreak(8);
      hRule(C.accent);
    }
  });

  // Page numbers
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7); doc.setTextColor(...C.mid);
    doc.text(`Page ${i} of ${pageCount}`, PAGE_W/2, PAGE_H - 4, { align: 'center' });
  }

  return doc;
}