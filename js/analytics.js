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
  renderWeakTopicDetector(attempts);
  renderTimePerQuestionAnalysis(attempts);
  renderComparisonChart(attempts);
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

// ─── Weak Topic Detector ──────────────────────────────────────
function renderWeakTopicDetector(attempts) {
  const container = document.getElementById('weak-topic-content');
  if (!container) return;

  // Group by series name and compute accuracy
  const seriesPerf = {};
  attempts.forEach(a => {
    const key = a.test_series?.name || 'Unknown';
    if (!seriesPerf[key]) seriesPerf[key] = { scores: [], subject: a.test_series?.subject || '' };
    seriesPerf[key].scores.push(+a.percentage);
  });

  const seriesList = Object.entries(seriesPerf).map(([name, d]) => {
    const avg = +(d.scores.reduce((s, v) => s + v, 0) / d.scores.length).toFixed(1);
    const attempts_count = d.scores.length;
    const trend = d.scores.length > 1
      ? d.scores[d.scores.length - 1] - d.scores[0]
      : 0;
    return { name, avg, attempts_count, trend, subject: d.subject };
  }).sort((a, b) => a.avg - b.avg);

  const weak   = seriesList.filter(s => s.avg < 60);
  const medium = seriesList.filter(s => s.avg >= 60 && s.avg < 75);
  const strong = seriesList.filter(s => s.avg >= 75);

  if (!weak.length && !medium.length) {
    container.innerHTML = `<div style="color:#10b981;font-size:14px;padding:12px 0;">✅ Excellent! You're performing well across all series (avg ≥ 75%).</div>`;
    return;
  }

  const renderGroup = (items, color, icon, label) => items.map(s => `
    <div style="padding:12px 0;border-bottom:1px solid rgba(30,45,69,.5);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
        <div style="font-size:13px;font-weight:600;">${icon} ${s.name}</div>
        <div style="display:flex;align-items:center;gap:8px;">
          ${s.subject ? `<span class="badge badge-blue" style="font-size:10px;">${s.subject}</span>` : ''}
          <span style="font-size:13px;font-weight:700;color:${color};">${s.avg}%</span>
          ${s.trend !== 0 ? `<span style="font-size:11px;color:${s.trend > 0 ? '#10b981' : '#ef4444'};">${s.trend > 0 ? '↑' : '↓'}${Math.abs(s.trend).toFixed(1)}%</span>` : ''}
        </div>
      </div>
      <div class="weak-topic-bar"><div class="weak-topic-fill" style="width:${s.avg}%;background:${color};"></div></div>
      <div style="font-size:11px;color:var(--muted);margin-top:4px;">${s.attempts_count} attempt${s.attempts_count > 1 ? 's' : ''} · ${label}</div>
    </div>`).join('');

  container.innerHTML = `
    ${weak.length ? `<div style="margin-bottom:16px;"><div style="font-size:12px;font-weight:700;color:#ef4444;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">⚠️ Needs Urgent Attention (Below 60%)</div>${renderGroup(weak, '#ef4444', '🔴', 'Focus here first')}</div>` : ''}
    ${medium.length ? `<div style="margin-bottom:8px;"><div style="font-size:12px;font-weight:700;color:#f59e0b;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">📌 Improvement Needed (60–75%)</div>${renderGroup(medium, '#f59e0b', '🟡', 'Practice more')}</div>` : ''}
    ${strong.length ? `<div><div style="font-size:12px;font-weight:700;color:#10b981;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">✅ Strong Areas (≥ 75%)</div>${renderGroup(strong, '#10b981', '🟢', 'Keep it up')}</div>` : ''}
  `;
}

// ─── Time-per-Question Analysis ───────────────────────────────
function renderTimePerQuestionAnalysis(attempts) {
  const container = document.getElementById('time-analysis-content');
  if (!container) return;

  const withTime = attempts.filter(a => a.time_taken_secs && a.total_questions);
  if (!withTime.length) {
    container.innerHTML = `<div style="color:var(--muted);font-size:13px;padding:12px 0;">No timing data available yet.</div>`;
    return;
  }

  const rows = withTime.map(a => {
    const secPerQ = +(a.time_taken_secs / a.total_questions).toFixed(1);
    const ideal = (currentTest?.duration_minutes || 60) * 60 / (a.total_questions || 50);
    const status = secPerQ < 20 ? 'rushed' : secPerQ > 120 ? 'slow' : 'good';
    return { name: a.test_series?.name || '—', secPerQ, pct: +a.percentage, status, date: a.submitted_at };
  }).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);

  const maxSec = Math.max(...rows.map(r => r.secPerQ));
  const avgSec = +(rows.reduce((s, r) => s + r.secPerQ, 0) / rows.length).toFixed(1);

  const colorMap = { rushed: '#ef4444', good: '#10b981', slow: '#f59e0b' };
  const labelMap = { rushed: '⚡ Too fast', good: '✅ Ideal pace', slow: '🐢 Too slow' };

  container.innerHTML = `
    <div style="display:flex;gap:24px;margin-bottom:16px;flex-wrap:wrap;">
      <div style="background:rgba(59,130,246,.1);border:1px solid rgba(59,130,246,.2);border-radius:10px;padding:10px 16px;">
        <div style="font-size:20px;font-weight:800;color:#3b82f6;">${avgSec}s</div>
        <div style="font-size:11px;color:var(--muted);">Avg per question</div>
      </div>
      <div style="background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.2);border-radius:10px;padding:10px 16px;">
        <div style="font-size:20px;font-weight:800;color:#10b981;">20–90s</div>
        <div style="font-size:11px;color:var(--muted);">Ideal range</div>
      </div>
    </div>
    ${rows.map(r => `
    <div class="time-row">
      <div style="width:120px;font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${r.name}">${r.name}</div>
      <div class="time-bar-wrap">
        <div class="time-bar-fill" style="width:${Math.min(100, r.secPerQ / maxSec * 100)}%;background:${colorMap[r.status]};"></div>
      </div>
      <div style="width:40px;font-size:12px;font-weight:700;color:${colorMap[r.status]};text-align:right;">${r.secPerQ}s</div>
      <div style="width:100px;font-size:11px;color:${colorMap[r.status]};">${labelMap[r.status]}</div>
      <div style="width:40px;font-size:12px;color:var(--muted);">${r.pct}%</div>
    </div>`).join('')}
    <div style="font-size:11px;color:var(--muted);margin-top:8px;">⚡ &lt;20s per Q = likely guessing · 🐢 &gt;90s per Q = too slow · ✅ 20–90s = ideal</div>
  `;
}

// ─── Series vs. Your Average Comparison Chart ─────────────────
function renderComparisonChart(attempts) {
  const container = document.getElementById('comparison-chart-content');
  if (!container) return;

  const seriesMap = {};
  attempts.forEach(a => {
    const key = a.test_series?.name || 'Unknown';
    if (!seriesMap[key]) seriesMap[key] = [];
    seriesMap[key].push(+a.percentage);
  });

  const labels   = Object.keys(seriesMap);
  if (labels.length < 2) {
    container.innerHTML = `<div style="color:var(--muted);font-size:13px;padding:12px 0;">Take tests in 2+ series to see comparison.</div>`;
    return;
  }

  const avgs     = labels.map(k => +(seriesMap[k].reduce((s, v) => s + v, 0) / seriesMap[k].length).toFixed(1));
  const overall  = +(avgs.reduce((s, v) => s + v, 0) / avgs.length).toFixed(1);
  const maxVal   = Math.max(...avgs, 100);

  container.innerHTML = `
    <div style="font-size:12px;color:var(--muted);margin-bottom:12px;">Your overall average: <strong style="color:var(--text);">${overall}%</strong> &nbsp;·&nbsp; Dashed line = pass threshold (60%)</div>
    ${labels.map((label, i) => {
      const avg   = avgs[i];
      const diff  = +(avg - overall).toFixed(1);
      const color = avg >= 75 ? '#10b981' : avg >= 60 ? '#3b82f6' : '#ef4444';
      return `
      <div class="compare-row">
        <div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${label}">${label}</div>
        <div style="position:relative;height:24px;background:var(--surface2);border-radius:4px;overflow:hidden;">
          <div style="position:absolute;left:${60/maxVal*100}%;width:1px;height:100%;background:rgba(16,185,129,.5);"></div>
          <div style="position:absolute;left:${overall/maxVal*100}%;width:1px;height:100%;background:rgba(59,130,246,.5);border-left:2px dashed rgba(59,130,246,.5);"></div>
          <div class="compare-bar" style="width:${avg/maxVal*100}%;background:${color};opacity:.8;"></div>
        </div>
        <div style="display:flex;align-items:center;gap:4px;">
          <span style="font-size:13px;font-weight:700;color:${color};">${avg}%</span>
          ${diff !== 0 ? `<span style="font-size:10px;color:${diff > 0 ? '#10b981' : '#ef4444'};">(${diff > 0 ? '+' : ''}${diff})</span>` : ''}
        </div>
      </div>`;
    }).join('')}
    <div style="display:flex;gap:16px;margin-top:12px;font-size:11px;color:var(--muted);">
      <span>🟦 Your overall avg (${overall}%)</span>
      <span>🟩 Pass line (60%)</span>
    </div>
  `;
}
