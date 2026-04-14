// ============================================================
// analytics.js — Analytics page: summary cards + all Chart.js charts
// ============================================================

async function loadAnalytics() {
  document.getElementById('analytics-loading').style.display  = '';
  document.getElementById('analytics-content').style.display  = 'none';
  destroyAllCharts();

  const { data: attempts } = await sb.from('test_attempts')
    .select('*, test_series(name,subject)')
    .eq('user_id', currentUser.id)
    .order('submitted_at', { ascending: true });

  document.getElementById('analytics-loading').style.display = 'none';
  document.getElementById('analytics-content').style.display = '';

  if (!attempts || attempts.length < 1) {
    document.getElementById('analytics-content').innerHTML =
      emptyState('No data yet — take at least one test to see analytics.', true);
    return;
  }

  renderAnalyticsSummary(attempts);
  renderScoreTrendChart(attempts);
  renderAccuracyDonut(attempts);
  renderSeriesBarChart(attempts);
  renderWeeklyHeatmap(attempts);
  renderSubjectRadar(attempts);
}

// ─── Summary cards ───────────────────────────────────────────
function renderAnalyticsSummary(attempts) {
  const total    = attempts.length;
  const passed   = attempts.filter(a => a.is_passed).length;
  const avg      = +(attempts.reduce((s, a) => s + +a.percentage, 0) / total).toFixed(1);
  const best     = Math.max(...attempts.map(a => +a.percentage));
  const worst    = Math.min(...attempts.map(a => +a.percentage));
  const streak   = calcStreak(attempts);

  document.getElementById('analytics-summary').innerHTML = `
    <div class="grid grid-cols-2 md:grid-cols-3 gap-4" style="margin-bottom:0;">
      ${analyticsCard('📊', 'Total Attempts',  total,              '',                           '#3b82f6')}
      ${analyticsCard('✅', 'Pass Rate',        passed + '/' + total, Math.round(passed / total * 100) + '%', '#10b981')}
      ${analyticsCard('📈', 'Average Score',   avg + '%',          '',                           '#06b6d4')}
      ${analyticsCard('🏆', 'Best Score',       best + '%',         '',                           '#f59e0b')}
      ${analyticsCard('📉', 'Lowest Score',     worst + '%',        '',                           '#ef4444')}
      ${analyticsCard('🔥', 'Current Streak',   streak + ' days',   '',                           '#8b5cf6')}
    </div>`;
}

function analyticsCard(icon, label, value, sub, color) {
  return `<div class="glass p-5" style="border-left:3px solid ${color};">
    <div style="font-size:22px;margin-bottom:8px;">${icon}</div>
    <div style="font-size:22px;font-weight:800;color:${color};margin-bottom:2px;">${value}</div>
    ${sub ? `<div style="font-size:11px;color:var(--muted);">${sub}</div>` : ''}
    <div style="font-size:12px;color:var(--muted);margin-top:4px;">${label}</div>
  </div>`;
}

function calcStreak(attempts) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days  = new Set(attempts.map(a => new Date(a.submitted_at).toDateString()));
  let streak  = 0;
  const d     = new Date(today);
  while (true) { if (!days.has(d.toDateString())) break; streak++; d.setDate(d.getDate() - 1); }
  return streak;
}

// ─── Score Trend Line Chart ───────────────────────────────────
function renderScoreTrendChart(attempts) {
  const ctx = document.getElementById('chart-score-trend');
  if (!ctx) return;
  const labels = attempts.map(a => fmtDate(a.submitted_at));
  const scores = attempts.map(a => +a.percentage);

  if (chartInstances['trend']) chartInstances['trend'].destroy();
  chartInstances['trend'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Score %',
          data: scores,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59,130,246,0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 5,
          pointHoverRadius: 8,
          pointBackgroundColor: attempts.map(a => a.is_passed ? '#10b981' : '#ef4444'),
          pointBorderColor: 'transparent',
        },
        {
          label: 'Pass Line',
          data: new Array(scores.length).fill(60),
          borderColor: 'rgba(16,185,129,0.4)',
          borderDash: [6, 4],
          pointRadius: 0,
          fill: false,
          tension: 0,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#94a3b8', font: { family: 'Sora' } } },
        tooltip: {
          backgroundColor: '#1a2235', titleColor: '#e2e8f0', bodyColor: '#94a3b8',
          borderColor: '#1e2d45', borderWidth: 1,
          callbacks: { afterLabel: ctx => attempts[ctx.dataIndex]?.test_series?.name || '' }
        }
      },
      scales: {
        x: { ticks: { color: '#64748b', font: { size: 11 }, maxRotation: 45 }, grid: { color: 'rgba(30,45,69,0.5)' } },
        y: { ticks: { color: '#64748b' }, grid: { color: 'rgba(30,45,69,0.5)' }, min: 0, max: 100,
             title: { display: true, text: 'Score %', color: '#64748b' } }
      }
    }
  });
}

// ─── Pass/Fail Donut ─────────────────────────────────────────
function renderAccuracyDonut(attempts) {
  const ctx    = document.getElementById('chart-accuracy');
  if (!ctx) return;
  const passed = attempts.filter(a => a.is_passed).length;
  const failed = attempts.length - passed;

  if (chartInstances['donut']) chartInstances['donut'].destroy();
  chartInstances['donut'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Pass', 'Fail'],
      datasets: [{ data: [passed, failed], backgroundColor: ['#10b981', '#ef4444'], borderWidth: 0, hoverOffset: 8 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 16, font: { family: 'Sora' } } },
        tooltip: { backgroundColor: '#1a2235', titleColor: '#e2e8f0', bodyColor: '#94a3b8' }
      }
    }
  });
}

// ─── Per-Series Bar Chart ─────────────────────────────────────
function renderSeriesBarChart(attempts) {
  const ctx = document.getElementById('chart-series-bar');
  if (!ctx) return;

  const seriesMap = {};
  attempts.forEach(a => {
    const name = a.test_series?.name || 'Unknown';
    if (!seriesMap[name]) seriesMap[name] = { scores: [], count: 0 };
    seriesMap[name].scores.push(+a.percentage);
    seriesMap[name].count++;
  });

  const labels     = Object.keys(seriesMap);
  const avgScores  = labels.map(k => +(seriesMap[k].scores.reduce((s, v) => s + v, 0) / seriesMap[k].scores.length).toFixed(1));
  const attempts2  = labels.map(k => seriesMap[k].count);

  if (chartInstances['bar']) chartInstances['bar'].destroy();
  chartInstances['bar'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Avg Score %',
          data: avgScores,
          backgroundColor: avgScores.map(s => s >= 60 ? 'rgba(16,185,129,0.7)' : 'rgba(239,68,68,0.7)'),
          borderColor:     avgScores.map(s => s >= 60 ? '#10b981' : '#ef4444'),
          borderWidth: 1, borderRadius: 6, yAxisID: 'y',
        },
        {
          label: 'Attempts',
          data: attempts2,
          backgroundColor: 'rgba(59,130,246,0.3)',
          borderColor: '#3b82f6',
          borderWidth: 1, borderRadius: 6, type: 'bar', yAxisID: 'y1',
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#94a3b8', font: { family: 'Sora' } } },
        tooltip: { backgroundColor: '#1a2235', titleColor: '#e2e8f0', bodyColor: '#94a3b8' }
      },
      scales: {
        x:  { ticks: { color: '#64748b', font: { size: 10 }, maxRotation: 45 }, grid: { color: 'rgba(30,45,69,0.5)' } },
        y:  { position: 'left',  ticks: { color: '#64748b' }, grid: { color: 'rgba(30,45,69,0.5)' }, min: 0, max: 100,
              title: { display: true, text: 'Score %', color: '#64748b' } },
        y1: { position: 'right', ticks: { color: '#64748b' }, grid: { display: false },
              title: { display: true, text: 'Attempts', color: '#64748b' } }
      }
    }
  });
}

// ─── Activity Heatmap ────────────────────────────────────────
function renderWeeklyHeatmap(attempts) {
  const container = document.getElementById('analytics-heatmap');
  if (!container) return;

  const dayMap = {};
  attempts.forEach(a => {
    const d = new Date(a.submitted_at).toLocaleDateString('en-CA');
    if (!dayMap[d]) dayMap[d] = [];
    dayMap[d].push(+a.percentage);
  });

  const weeks = 12;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = new Date(today); start.setDate(start.getDate() - (weeks * 7));
  const days  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const colors = ['rgba(30,45,69,0.5)', 'rgba(239,68,68,0.6)', 'rgba(245,158,11,0.6)', 'rgba(59,130,246,0.6)', 'rgba(16,185,129,0.8)'];

  let html = `<div style="display:grid;grid-template-columns:32px repeat(${weeks},1fr);gap:3px;align-items:center;">`;
  for (let d = 0; d < 7; d++) {
    html += `<div style="font-size:10px;color:var(--muted);text-align:right;padding-right:4px;">${d % 2 === 0 ? days[d] : ''}</div>`;
    for (let w = 0; w < weeks; w++) {
      const date        = new Date(start); date.setDate(date.getDate() + w * 7 + d);
      const key         = date.toLocaleDateString('en-CA');
      const dayAttempts = dayMap[key];
      const avg         = dayAttempts ? +(dayAttempts.reduce((s, v) => s + v, 0) / dayAttempts.length).toFixed(0) : null;
      const intensity   = avg === null ? 0 : avg >= 80 ? 4 : avg >= 60 ? 3 : avg >= 40 ? 2 : 1;
      const title       = avg !== null
        ? `${key}: ${avg}% avg (${dayAttempts.length} attempt${dayAttempts.length > 1 ? 's' : ''})`
        : `${key}: No activity`;
      html += `<div title="${title}" style="aspect-ratio:1;border-radius:3px;background:${colors[intensity]};cursor:pointer;transition:transform 0.1s;"
        onmouseenter="this.style.transform='scale(1.3)'" onmouseleave="this.style.transform=''"></div>`;
    }
  }
  html += `</div>`;
  html += `<div style="display:flex;align-items:center;gap:8px;margin-top:12px;font-size:11px;color:var(--muted);">
    <span>Less</span>
    ${colors.map(c => `<div style="width:12px;height:12px;border-radius:2px;background:${c};"></div>`).join('')}
    <span>More</span>
  </div>`;
  container.innerHTML = html;
}

// ─── Subject Radar ───────────────────────────────────────────
function renderSubjectRadar(attempts) {
  const ctx = document.getElementById('chart-subject-radar');
  if (!ctx) return;

  const subjectMap = {};
  attempts.forEach(a => {
    const subj = a.test_series?.subject || 'General';
    if (!subjectMap[subj]) subjectMap[subj] = [];
    subjectMap[subj].push(+a.percentage);
  });

  const labels = Object.keys(subjectMap);
  if (labels.length < 2) { ctx.parentElement.style.display = 'none'; return; }

  const data = labels.map(k => +(subjectMap[k].reduce((s, v) => s + v, 0) / subjectMap[k].length).toFixed(1));

  if (chartInstances['radar']) chartInstances['radar'].destroy();
  chartInstances['radar'] = new Chart(ctx, {
    type: 'radar',
    data: {
      labels,
      datasets: [{
        label: 'Avg Score %',
        data,
        backgroundColor: 'rgba(59,130,246,0.2)',
        borderColor: '#3b82f6',
        pointBackgroundColor: '#3b82f6',
        pointBorderColor: 'transparent',
        pointRadius: 4,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#94a3b8', font: { family: 'Sora' } } },
        tooltip: { backgroundColor: '#1a2235', titleColor: '#e2e8f0', bodyColor: '#94a3b8' }
      },
      scales: {
        r: {
          ticks: { color: '#64748b', backdropColor: 'transparent', stepSize: 20 },
          grid:  { color: 'rgba(30,45,69,0.8)' },
          pointLabels: { color: '#94a3b8', font: { family: 'Sora', size: 12 } },
          min: 0, max: 100
        }
      }
    }
  });
}
