// ============================================================
// admin.js — Admin dashboard, users, series, questions
// ============================================================

// ─── ADMIN DASHBOARD ─────────────────────────────────────────
async function loadAdminDashboard() {
  const [
    { count: userCount   },
    { count: seriesCount },
    { count: qCount      },
    { count: attCount    },
    { data: recentUsers  },
    { data: topSeries    }
  ] = await Promise.all([
    sb.from('profiles').select('*',    { count: 'exact', head: true }).neq('role', 'admin'),
    sb.from('test_series').select('*', { count: 'exact', head: true }),
    sb.from('questions').select('*',   { count: 'exact', head: true }),
    sb.from('test_attempts').select('*',{ count: 'exact', head: true }),
    sb.from('profiles').select('*').order('created_at', { ascending: false }).limit(5),
    sb.from('series_stats').select('*').order('attempt_count', { ascending: false }).limit(5),
  ]);

  document.getElementById('admin-stats').innerHTML =
    statCard('Total Users',  userCount   || 0, '#3b82f6', iconUser) +
    statCard('Test Series',  seriesCount || 0, '#10b981', iconClip) +
    statCard('Total Qs',     qCount      || 0, '#f59e0b', iconQ)    +
    statCard('Attempts',     attCount    || 0, '#06b6d4', iconWave);

  document.getElementById('admin-recent-users').innerHTML = (recentUsers || []).map(u => `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);">
      <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#06b6d4);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;">${(u.full_name || 'U')[0].toUpperCase()}</div>
      <div style="flex:1;">
        <div style="font-size:13px;font-weight:600;">${u.full_name || '—'}</div>
        <span class="badge ${u.role === 'admin' ? 'badge-yellow' : 'badge-blue'}" style="font-size:10px;">${u.role}</span>
      </div>
      <div style="font-size:11px;color:var(--muted);">${fmtDate(u.created_at)}</div>
    </div>`).join('') || emptyState('No users yet');

  document.getElementById('admin-top-tests').innerHTML = (topSeries || []).map(s => `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);">
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${s.series_name}</div>
        <div style="font-size:11px;color:var(--muted);">Avg: ${s.avg_percentage || 0}% · Pass: ${s.pass_rate || 0}%</div>
      </div>
      <span class="badge badge-blue">${s.attempt_count} attempts</span>
    </div>`).join('') || emptyState('No attempts yet');
}

// ─── ADMIN USERS ─────────────────────────────────────────────
async function loadAdminUsers() {
  const { data: users } = await sb.from('user_stats').select('*').order('created_at', { ascending: false });
  window._usersCache = users || [];
  renderUsersTable(users || []);
}

function renderUsersTable(users) {
  document.getElementById('users-body').innerHTML = users.map(u => `
    <tr>
      <td><div style="display:flex;align-items:center;gap:10px;">
        <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#06b6d4);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;">${(u.full_name || 'U')[0].toUpperCase()}</div>
        <span style="font-weight:600;font-size:13px;">${u.full_name || '—'}</span>
      </div></td>
      <td style="font-size:12px;color:var(--muted);">${u.user_id}</td>
      <td><span class="badge ${u.role === 'admin' ? 'badge-yellow' : 'badge-blue'}">${u.role}</span></td>
      <td style="font-size:13px;">${u.tests_taken || 0}</td>
      <td style="font-size:13px;">${u.avg_score ? u.avg_score + '%' : '—'}</td>
      <td style="font-size:13px;color:var(--muted);">${fmtDate(u.created_at)}</td>
      <td><div style="display:flex;gap:6px;">
        <button onclick="viewUserDetail('${u.user_id}','${(u.full_name || '').replace(/'/g, "\\'")}')" class="btn-primary" style="font-size:11px;padding:6px 10px;">👁 View</button>
        ${u.role !== 'admin'
          ? `<button onclick="setUserRole('${u.user_id}','admin')"   class="btn-success"   style="font-size:11px;padding:6px 10px;">Make Admin</button>`
          : `<button onclick="setUserRole('${u.user_id}','student')" class="btn-secondary" style="font-size:11px;padding:6px 10px;">Revoke</button>`}
        ${u.user_id !== currentUser.id ? `<button onclick="openResetPasswordModal('${u.user_id}','${(u.full_name || '').replace(/'/g, "\\'")}')" class="btn-secondary" style="font-size:11px;padding:6px 10px;">🔑 Password</button>` : ''}
        ${u.user_id !== currentUser.id ? `<button onclick="deleteUser('${u.user_id}')" class="btn-danger" style="font-size:11px;padding:6px 10px;">Delete</button>` : ''}
      </div></td>
    </tr>`).join('')
    || `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--muted);">No users found.</td></tr>`;
}

function filterUsers(q) {
  renderUsersTable((window._usersCache || []).filter(u => (u.full_name || '').toLowerCase().includes(q.toLowerCase())));
}

async function setUserRole(uid, role) {
  const { error } = await sb.from('profiles').update({ role }).eq('id', uid);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  showToast('Role updated!', 'success');
  loadAdminUsers();
}

async function deleteUser(uid) {
  showConfirm('Delete User', 'This permanently deletes the user and all their data.', async () => {
    const { error } = await sb.from('profiles').delete().eq('id', uid);
    if (error) { showToast('Error: ' + error.message, 'error'); return; }
    showToast('User deleted.', 'success');
    loadAdminUsers();
  }, '🗑️');
}

// ─── Reset password modal ─────────────────────────────────────
function openResetPasswordModal(uid, name) {
  document.getElementById('reset-pw-uid').value       = uid;
  document.getElementById('reset-pw-name').textContent = name || uid;
  document.getElementById('reset-pw-input').value     = '';
  document.getElementById('reset-pw-modal').style.display = 'flex';
}

async function handleResetPassword(e) {
  e.preventDefault();
  const uid   = document.getElementById('reset-pw-uid').value;
  const newPw = document.getElementById('reset-pw-input').value;
  if (newPw.length < 6) { showToast('Password must be at least 6 characters.', 'error'); return; }

  const { error } = await sb.rpc('admin_reset_user_password', { target_user_id: uid, new_password: newPw });
  if (error) {
    showToast('RPC not found. See console for manual SQL.', 'error');
    console.info(`To reset password manually, run in Supabase SQL editor:\nSELECT auth.admin_update_user_by_id('${uid}', '{"password":"${newPw}"}');`);
  } else {
    showToast('Password reset successfully!', 'success');
  }
  closeModal('reset-pw-modal');
}

// ─── User detail modal ────────────────────────────────────────
async function viewUserDetail(uid, name) {
  window._viewingUserId   = uid;
  window._viewingUserName = name;
  document.getElementById('user-detail-name').textContent           = name;
  document.getElementById('user-detail-loading').style.display      = '';
  document.getElementById('user-detail-content').style.display      = 'none';
  document.getElementById('user-detail-modal').style.display        = 'flex';

  const { data: attempts } = await sb.from('test_attempts')
    .select('*, test_series(name,subject)')
    .eq('user_id', uid)
    .order('submitted_at', { ascending: false });

  document.getElementById('user-detail-loading').style.display = 'none';
  document.getElementById('user-detail-content').style.display = '';

  if (!attempts || !attempts.length) {
    document.getElementById('user-detail-content').innerHTML = emptyState('This user has not taken any tests yet.');
    return;
  }

  const total  = attempts.length;
  const passed = attempts.filter(a => a.is_passed).length;
  const avg    = +(attempts.reduce((s, a) => s + +a.percentage, 0) / total).toFixed(1);
  const best   = Math.max(...attempts.map(a => +a.percentage));

  document.getElementById('user-detail-content').innerHTML = `
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3" style="margin-bottom:20px;">
      ${statCard('Tests',     total,                            '#3b82f6', iconClip)}
      ${statCard('Pass Rate', Math.round(passed / total * 100) + '%', '#10b981', iconCheck)}
      ${statCard('Avg Score', avg + '%',                        '#06b6d4', iconWave)}
      ${statCard('Best',      best + '%',                       '#f59e0b', iconStar)}
    </div>
    <div style="max-height:420px;overflow-y:auto;">
      <table class="data-table" style="width:100%;">
        <thead><tr><th>Test Series</th><th>Score</th><th>Correct</th><th>Time</th><th>Date</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${attempts.map(a => `
            <tr>
              <td style="font-size:13px;font-weight:600;">${a.test_series?.name || '—'}</td>
              <td><span style="font-size:15px;font-weight:800;color:${+a.percentage >= 60 ? '#10b981' : +a.percentage >= 40 ? '#f59e0b' : '#ef4444'}">${a.percentage}%</span></td>
              <td class="mono" style="font-size:12px;">${a.score}/${a.total_questions}</td>
              <td style="font-size:12px;color:var(--muted);">${fmtDuration(a.time_taken_secs)}</td>
              <td style="font-size:12px;color:var(--muted);">${fmtDate(a.submitted_at)}</td>
              <td><span class="badge ${a.is_passed ? 'badge-green' : 'badge-red'}">${a.is_passed ? 'Pass' : 'Fail'}</span></td>
              <td><button onclick="viewResultById('${a.id}');closeModal('user-detail-modal')" class="btn-success" style="font-size:11px;padding:5px 10px;">View</button></td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;

  // Mini chart
  setTimeout(() => {
    const ctx = document.getElementById('user-detail-chart');
    if (!ctx) return;
    if (chartInstances['userDetail']) chartInstances['userDetail'].destroy();
    const sorted = [...attempts].reverse();
    chartInstances['userDetail'] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: sorted.map(a => fmtDate(a.submitted_at)),
        datasets: [{
          label: 'Score %',
          data: sorted.map(a => +a.percentage),
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59,130,246,0.1)',
          fill: true, tension: 0.4,
          pointBackgroundColor: sorted.map(a => a.is_passed ? '#10b981' : '#ef4444'),
          pointRadius: 5, pointBorderColor: 'transparent'
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1a2235', titleColor: '#e2e8f0', bodyColor: '#94a3b8' } },
        scales: {
          x: { ticks: { color: '#64748b', font: { size: 10 }, maxRotation: 45 }, grid: { color: 'rgba(30,45,69,0.5)' } },
          y: { ticks: { color: '#64748b' }, grid: { color: 'rgba(30,45,69,0.5)' }, min: 0, max: 100 }
        }
      }
    });
  }, 100);
}

// ─── ADMIN SERIES ─────────────────────────────────────────────
async function loadAdminSeries() {
  const { data: series }   = await sb.from('test_series').select('*').order('created_at');
  const qMap               = await fetchQuestionCountMap();
  const { data: attCounts }= await sb.from('test_attempts').select('series_id');
  const attMap = {};
  (attCounts || []).forEach(a => { attMap[a.series_id] = (attMap[a.series_id] || 0) + 1; });

  document.getElementById('series-list').innerHTML = (series || []).map(s => `
    <div class="glass p-5">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <span class="badge ${s.is_active ? 'badge-green' : 'badge-red'}">${s.is_active ? 'Active' : 'Inactive'}</span>
        <div style="display:flex;gap:6px;">
          <button onclick="editSeries('${s.id}')"   class="btn-success" style="font-size:11px;padding:6px 10px;">Edit</button>
          <button onclick="deleteSeries('${s.id}')" class="btn-danger"  style="font-size:11px;padding:6px 10px;">Delete</button>
        </div>
      </div>
      <h3 style="font-size:15px;font-weight:700;margin-bottom:4px;">${s.name}</h3>
      ${s.subject ? `<p style="font-size:11px;color:var(--accent);margin-bottom:6px;">🏷 ${s.subject}</p>` : ''}
      <p style="font-size:12px;color:var(--muted);margin-bottom:12px;line-height:1.5;">${s.description}</p>
      <div style="display:flex;gap:12px;font-size:12px;color:var(--muted);flex-wrap:wrap;">
        <span>⏱ ${s.duration_minutes} min</span>
        <span>📝 ${qMap[s.id] || 0}/${s.total_questions} Qs</span>
        <span>🔄 ${attMap[s.id] || 0} attempts</span>
        <span>✅ Pass: ${s.pass_percentage}%</span>
      </div>
    </div>`).join('')
    || `<div style="text-align:center;padding:60px;color:var(--muted);grid-column:1/-1;">No series yet. Create one!</div>`;
}

function openAddSeriesModal() {
  document.getElementById('series-modal-title').textContent = 'Create Test Series';
  document.getElementById('series-edit-id').value           = '';
  document.getElementById('series-name').value              = '';
  document.getElementById('series-desc').value              = '';
  document.getElementById('series-duration').value          = '60';
  document.getElementById('series-total-q').value           = '50';
  document.getElementById('series-pass-pct').value          = '60';
  document.getElementById('series-subject').value           = '';
  document.getElementById('series-active').checked          = true;
  document.getElementById('add-series-modal').style.display = 'flex';
}

async function editSeries(id) {
  const { data: s } = await sb.from('test_series').select('*').eq('id', id).single();
  document.getElementById('series-modal-title').textContent = 'Edit Test Series';
  document.getElementById('series-edit-id').value           = id;
  document.getElementById('series-name').value              = s.name;
  document.getElementById('series-desc').value              = s.description;
  document.getElementById('series-duration').value          = s.duration_minutes;
  document.getElementById('series-total-q').value           = s.total_questions;
  document.getElementById('series-pass-pct').value          = s.pass_percentage;
  document.getElementById('series-subject').value           = s.subject;
  document.getElementById('series-active').checked          = s.is_active;
  document.getElementById('add-series-modal').style.display = 'flex';
}

async function saveSeries(e) {
  e.preventDefault();
  const editId  = document.getElementById('series-edit-id').value;
  const payload = {
    name:             document.getElementById('series-name').value.trim(),
    description:      document.getElementById('series-desc').value.trim(),
    duration_minutes: parseInt(document.getElementById('series-duration').value),
    total_questions:  parseInt(document.getElementById('series-total-q').value),
    pass_percentage:  parseInt(document.getElementById('series-pass-pct').value),
    subject:          document.getElementById('series-subject').value.trim(),
    is_active:        document.getElementById('series-active').checked,
  };
  const query = editId
    ? sb.from('test_series').update(payload).eq('id', editId)
    : sb.from('test_series').insert({ ...payload, created_by: currentUser.id });
  const { error } = await query;
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  closeModal('add-series-modal');
  loadAdminSeries();
  showToast(editId ? 'Series updated!' : 'Series created!', 'success');
}

async function deleteSeries(id) {
  showConfirm('Delete Series', 'This deletes the series, all its questions and attempt records.', async () => {
    const { error } = await sb.from('test_series').delete().eq('id', id);
    if (error) { showToast('Error: ' + error.message, 'error'); return; }
    showToast('Series deleted.', 'success');
    loadAdminSeries();
  }, '🗑️');
}

// ─── ADMIN QUESTIONS ─────────────────────────────────────────
async function loadAdminQuestions() {
  const { data: series } = await sb.from('test_series').select('id,name').order('name');
  const filterVal        = document.getElementById('q-filter-series').value;
  const opts = (series || []).map(s => `<option value="${s.id}" ${s.id === filterVal ? 'selected' : ''}>${s.name}</option>`).join('');

  document.getElementById('q-filter-series').innerHTML    = `<option value="">All Series</option>` + opts;
  document.getElementById('question-series').innerHTML    = `<option value="">Select series...</option>` + opts;
  document.getElementById('pdf-series-select').innerHTML  = `<option value="">Select series prefix...</option>` + opts;

  const questions = filterVal
    ? await fetchAllQuestionsForSeriesAdmin(filterVal)
    : await fetchAllQuestionsAdmin();
  window._questionsCache = questions;
  renderQuestionsTable(questions);
}

async function fetchAllQuestionsAdmin() {
  const PAGE = 1000; let from = 0; const all = [];
  while (true) {
    const { data, error } = await sb.from('questions').select('*, test_series(name)').order('order_index').order('created_at').range(from, from + PAGE - 1);
    if (error || !data || !data.length) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

async function fetchAllQuestionsForSeriesAdmin(seriesId) {
  const PAGE = 1000; let from = 0; const all = [];
  while (true) {
    const { data, error } = await sb.from('questions').select('*, test_series(name)').eq('series_id', seriesId).order('order_index').order('created_at').range(from, from + PAGE - 1);
    if (error || !data || !data.length) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

function renderQuestionsTable(questions) {
  document.getElementById('questions-body').innerHTML = questions.map((q, i) => `
    <tr>
      <td class="mono" style="font-size:12px;color:var(--muted);">${i + 1}</td>
      <td style="max-width:280px;font-size:13px;">
        ${q.image_url ? `<img src="${q.image_url}" style="width:32px;height:32px;border-radius:4px;object-fit:cover;margin-right:6px;vertical-align:middle;" alt="">` : ''}
        ${q.question.substring(0, 70)}${q.question.length > 70 ? '…' : ''}
      </td>
      <td style="font-size:11px;color:var(--muted);max-width:160px;">A: ${(q.option_a || '').substring(0, 25)}…</td>
      <td><span class="badge badge-green mono">${q.answer}</span></td>
      <td style="font-size:12px;color:var(--muted);">${q.test_series?.name || '—'}</td>
      <td><div style="display:flex;gap:6px;">
        <button onclick="editQuestion('${q.id}')"   class="btn-success" style="font-size:11px;padding:6px 10px;">Edit</button>
        <button onclick="deleteQuestion('${q.id}')" class="btn-danger"  style="font-size:11px;padding:6px 10px;">Del</button>
      </div></td>
    </tr>`).join('')
    || `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--muted);">No questions found.</td></tr>`;
}

function filterQuestions(q) {
  renderQuestionsTable((window._questionsCache || []).filter(qu => qu.question.toLowerCase().includes(q.toLowerCase())));
}

// ─── DUPLICATE QUESTION DETECTION ─────────────────────────────
async function runDuplicateDetection() {
  const report = document.getElementById('duplicate-report');
  report.style.display = '';
  report.innerHTML = `<div class="glass p-4" style="color:var(--muted);font-size:13px;">🔍 Scanning for duplicate questions…</div>`;

  const questions = window._questionsCache;
  if (!questions || !questions.length) {
    report.innerHTML = `<div class="glass p-4" style="color:var(--muted);font-size:13px;">Load questions first.</div>`;
    return;
  }

  // Normalize text for comparison
  const normalize = t => t.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();

  // Compute similarity using trigrams
  const trigrams = t => {
    const s = ' ' + normalize(t) + ' ';
    const set = new Set();
    for (let i = 0; i < s.length - 2; i++) set.add(s.slice(i, i + 3));
    return set;
  };
  const similarity = (a, b) => {
    const ta = trigrams(a), tb = trigrams(b);
    const inter = [...ta].filter(x => tb.has(x)).length;
    return inter / (ta.size + tb.size - inter);
  };

  const THRESHOLD = 0.7;
  const groups = [];
  const visited = new Set();

  for (let i = 0; i < questions.length; i++) {
    if (visited.has(i)) continue;
    const group = [i];
    for (let j = i + 1; j < questions.length; j++) {
      if (visited.has(j)) continue;
      if (similarity(questions[i].question, questions[j].question) >= THRESHOLD) {
        group.push(j);
        visited.add(j);
      }
    }
    if (group.length > 1) { groups.push(group); visited.add(i); }
  }

  if (!groups.length) {
    report.innerHTML = `<div class="glass p-4" style="border-left:3px solid #10b981;"><div style="color:#10b981;font-weight:700;margin-bottom:4px;">✅ No duplicates found!</div><div style="color:var(--muted);font-size:13px;">All ${questions.length} questions appear to be unique.</div></div>`;
    return;
  }

  const totalDups = groups.reduce((s, g) => s + g.length - 1, 0);
  report.innerHTML = `
    <div class="glass p-5" style="border-left:3px solid #f59e0b;">
      <div style="font-size:15px;font-weight:700;margin-bottom:4px;color:#f59e0b;">⚠️ Found ${totalDups} potential duplicate${totalDups > 1 ? 's' : ''} in ${groups.length} group${groups.length > 1 ? 's' : ''}</div>
      <div style="font-size:13px;color:var(--muted);margin-bottom:16px;">Questions with ≥70% text similarity are flagged. Review each group and delete copies.</div>
      ${groups.map((group, gi) => `
        <div style="margin-bottom:16px;padding:12px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;">
          <div style="font-size:11px;font-weight:700;color:#f59e0b;text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;">Group ${gi + 1} · ${group.length} similar questions</div>
          ${group.map(idx => {
            const q = questions[idx];
            return `<div style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid rgba(30,45,69,.5);">
              <div style="flex:1;font-size:13px;line-height:1.5;">${q.question.substring(0, 100)}${q.question.length > 100 ? '…' : ''}<span style="font-size:11px;color:var(--muted);display:block;margin-top:2px;">${q.test_series?.name || '—'}</span></div>
              <button onclick="deleteQuestion('${q.id}')" class="btn-danger" style="font-size:11px;padding:5px 10px;flex-shrink:0;">Delete</button>
            </div>`;
          }).join('')}
        </div>`).join('')}
    </div>`;
}

// ─── ADMIN ANALYTICS DASHBOARD ───────────────────────────────
let adminAnalyticsCharts = {};

async function loadAdminAnalytics() {
  const loading = document.getElementById('admin-analytics-loading');
  const content = document.getElementById('admin-analytics-content');
  loading.style.display = '';
  content.style.display = 'none';

  // Destroy old charts
  Object.values(adminAnalyticsCharts).forEach(c => { try { c.destroy(); } catch(e){} });
  adminAnalyticsCharts = {};

  // Fetch all data
  const [
    { data: allAttempts },
    { data: allProfiles },
    { data: seriesStats },
  ] = await Promise.all([
    sb.from('test_attempts').select('*, test_series(name,subject)').order('submitted_at', { ascending: true }),
    sb.from('profiles').select('id,full_name,role').neq('role', 'admin'),
    sb.from('series_stats').select('*'),
  ]);

  loading.style.display = 'none';
  content.style.display = '';

  if (!allAttempts || !allAttempts.length) {
    content.innerHTML = '<div style="color:var(--muted);padding:40px;text-align:center;">No data yet.</div>';
    return;
  }

  // Summary cards
  const totalStudents = allProfiles?.length || 0;
  const totalAttempts = allAttempts.length;
  const avgScore      = +(allAttempts.reduce((s, a) => s + +a.percentage, 0) / totalAttempts).toFixed(1);
  const passRate      = +(allAttempts.filter(a => a.is_passed).length / totalAttempts * 100).toFixed(1);

  document.getElementById('admin-analytics-summary').innerHTML =
    statCard('Total Students', totalStudents, '#3b82f6', iconUser)  +
    statCard('Total Attempts', totalAttempts, '#10b981', iconWave)  +
    statCard('Avg Score',      avgScore + '%','#f59e0b', iconStar)  +
    statCard('Pass Rate',      passRate + '%','#06b6d4', iconCheck);

  // Store for tab renders
  window._adminAnalyticsData = { allAttempts, allProfiles, seriesStats };
  renderAdminOverviewTab(allAttempts);
  renderAdminComparisonTab(allAttempts, seriesStats);
  renderAdminUsersTab(allAttempts, allProfiles);
  renderAdminActivityTab(allAttempts);
}

function switchAdminTab(tab) {
  ['overview','comparison','users-perf','activity'].forEach(t => {
    document.getElementById('admin-tab-' + t).style.display = t === tab ? '' : 'none';
    document.getElementById('atab-' + t).classList.toggle('active', t === tab);
  });
}

function renderAdminOverviewTab(attempts) {
  // Daily attempts last 30 days
  const today = new Date(); today.setHours(23,59,59,999);
  const start = new Date(today); start.setDate(start.getDate() - 29); start.setHours(0,0,0,0);
  const dayMap = {};
  attempts.forEach(a => {
    const d = new Date(a.submitted_at).toLocaleDateString('en-CA');
    dayMap[d] = (dayMap[d] || 0) + 1;
  });
  const dailyLabels = [], dailyCounts = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(start); d.setDate(d.getDate() + i);
    const key = d.toLocaleDateString('en-CA');
    dailyLabels.push(key.slice(5)); // MM-DD
    dailyCounts.push(dayMap[key] || 0);
  }

  const ctxD = document.getElementById('chart-admin-daily');
  if (ctxD) {
    if (adminAnalyticsCharts['daily']) adminAnalyticsCharts['daily'].destroy();
    adminAnalyticsCharts['daily'] = new Chart(ctxD, {
      type: 'bar',
      data: { labels: dailyLabels, datasets: [{ label: 'Attempts', data: dailyCounts, backgroundColor: 'rgba(59,130,246,0.6)', borderColor:'#3b82f6', borderWidth:1, borderRadius:4 }] },
      options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false}, tooltip:{backgroundColor:'#1a2235',titleColor:'#e2e8f0',bodyColor:'#94a3b8'} }, scales:{ x:{ticks:{color:'#64748b',font:{size:9},maxRotation:45},grid:{display:false}}, y:{ticks:{color:'#64748b'},grid:{color:'rgba(30,45,69,.5)'}} } }
    });
  }

  // Pass rate by series
  const seriesPass = {};
  attempts.forEach(a => {
    const k = a.test_series?.name || 'Unknown';
    if (!seriesPass[k]) seriesPass[k] = { pass:0, total:0 };
    seriesPass[k].total++;
    if (a.is_passed) seriesPass[k].pass++;
  });
  const prLabels = Object.keys(seriesPass).slice(0, 8);
  const prData   = prLabels.map(k => +(seriesPass[k].pass / seriesPass[k].total * 100).toFixed(1));

  const ctxP = document.getElementById('chart-admin-passrate');
  if (ctxP) {
    if (adminAnalyticsCharts['passrate']) adminAnalyticsCharts['passrate'].destroy();
    adminAnalyticsCharts['passrate'] = new Chart(ctxP, {
      type: 'bar',
      data: { labels: prLabels, datasets: [{ label:'Pass Rate %', data: prData, backgroundColor: prData.map(v => v >= 60 ? 'rgba(16,185,129,.7)' : 'rgba(239,68,68,.7)'), borderRadius:6 }] },
      options: { responsive:true, maintainAspectRatio:false, indexAxis:'y', plugins:{ legend:{display:false}, tooltip:{backgroundColor:'#1a2235',bodyColor:'#94a3b8'} }, scales:{ x:{min:0,max:100,ticks:{color:'#64748b'},grid:{color:'rgba(30,45,69,.5)'}}, y:{ticks:{color:'#64748b',font:{size:10}},grid:{display:false}} } }
    });
  }

  // Score distribution histogram
  const buckets = new Array(10).fill(0);
  attempts.forEach(a => { const b = Math.min(9, Math.floor(+a.percentage / 10)); buckets[b]++; });
  const distLabels = ['0-9','10-19','20-29','30-39','40-49','50-59','60-69','70-79','80-89','90-100'];
  const ctxDist = document.getElementById('chart-admin-distribution');
  if (ctxDist) {
    if (adminAnalyticsCharts['dist']) adminAnalyticsCharts['dist'].destroy();
    adminAnalyticsCharts['dist'] = new Chart(ctxDist, {
      type: 'bar',
      data: { labels: distLabels, datasets: [{ label:'Students', data: buckets, backgroundColor: buckets.map((_, i) => i >= 6 ? 'rgba(16,185,129,.6)' : i >= 4 ? 'rgba(245,158,11,.6)' : 'rgba(239,68,68,.6)'), borderRadius:4 }] },
      options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false}, tooltip:{backgroundColor:'#1a2235',bodyColor:'#94a3b8'} }, scales:{ x:{ticks:{color:'#64748b'},grid:{display:false}}, y:{ticks:{color:'#64748b'},grid:{color:'rgba(30,45,69,.5)'}} } }
    });
  }
}

function renderAdminComparisonTab(attempts, seriesStats) {
  // Head-to-head comparison bars
  const seriesMap = {};
  attempts.forEach(a => {
    const k = a.test_series?.name || 'Unknown';
    if (!seriesMap[k]) seriesMap[k] = { scores:[], pass:0, total:0 };
    seriesMap[k].scores.push(+a.percentage);
    seriesMap[k].total++;
    if (a.is_passed) seriesMap[k].pass++;
  });

  const items = Object.entries(seriesMap).map(([name, d]) => ({
    name,
    avg: +(d.scores.reduce((s,v) => s+v,0) / d.scores.length).toFixed(1),
    passRate: +(d.pass / d.total * 100).toFixed(1),
    attempts: d.total,
  })).sort((a, b) => b.avg - a.avg);

  const maxAvg = Math.max(...items.map(i => i.avg), 100);
  document.getElementById('admin-comparison-chart').innerHTML = `
    <div style="margin-bottom:8px;display:flex;gap:16px;font-size:11px;color:var(--muted);">
      <span style="display:flex;align-items:center;gap:4px;"><span style="width:12px;height:12px;border-radius:2px;background:rgba(59,130,246,.6);display:inline-block;"></span>Avg Score</span>
      <span style="display:flex;align-items:center;gap:4px;"><span style="width:12px;height:12px;border-radius:2px;background:rgba(16,185,129,.4);display:inline-block;"></span>Pass Rate</span>
    </div>
    ${items.map(item => `
    <div style="margin-bottom:14px;">
      <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:600;margin-bottom:5px;">
        <span>${item.name}</span>
        <span style="color:var(--muted);font-size:11px;">${item.attempts} attempts</span>
      </div>
      <div style="position:relative;height:10px;background:var(--surface2);border-radius:5px;overflow:hidden;margin-bottom:3px;">
        <div style="width:${item.avg/maxAvg*100}%;height:100%;background:${item.avg >= 60 ? 'rgba(59,130,246,.7)' : 'rgba(239,68,68,.7)'};border-radius:5px;transition:width .6s;"></div>
      </div>
      <div style="position:relative;height:6px;background:var(--surface2);border-radius:3px;overflow:hidden;">
        <div style="width:${item.passRate}%;height:100%;background:rgba(16,185,129,.5);border-radius:3px;transition:width .6s;"></div>
      </div>
      <div style="display:flex;gap:12px;font-size:11px;color:var(--muted);margin-top:3px;">
        <span style="color:${item.avg >= 60 ? '#3b82f6' : '#ef4444'};">Avg: ${item.avg}%</span>
        <span style="color:#10b981;">Pass: ${item.passRate}%</span>
      </div>
    </div>`).join('')}
  `;

  // Leaderboard table
  document.getElementById('admin-series-leaderboard').innerHTML = `
    <table class="data-table" style="font-size:12px;">
      <thead><tr><th>Rank</th><th>Series</th><th>Avg Score</th><th>Pass Rate</th><th>Attempts</th></tr></thead>
      <tbody>${items.map((item, i) => `
        <tr>
          <td>${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</td>
          <td>${item.name}</td>
          <td style="font-weight:700;color:${item.avg >= 60 ? '#10b981' : '#ef4444'};">${item.avg}%</td>
          <td><span class="badge ${item.passRate >= 60 ? 'badge-green' : 'badge-red'}">${item.passRate}%</span></td>
          <td>${item.attempts}</td>
        </tr>`).join('')}</tbody>
    </table>`;
}

function renderAdminUsersTab(attempts, profiles) {
  const userMap = {};
  attempts.forEach(a => {
    const uid = a.user_id;
    if (!userMap[uid]) userMap[uid] = { scores:[], pass:0, total:0 };
    userMap[uid].scores.push(+a.percentage);
    userMap[uid].total++;
    if (a.is_passed) userMap[uid].pass++;
  });
  // Match with profiles
  const profileMap = {};
  (profiles || []).forEach(p => { profileMap[p.id] = p.full_name || p.id.slice(0,8); });

  const users = Object.entries(userMap).map(([uid, d]) => ({
    uid,
    name: profileMap[uid] || uid.slice(0,8),
    avg: +(d.scores.reduce((s,v) => s+v,0) / d.scores.length).toFixed(1),
    total: d.total,
    passRate: +(d.pass / d.total * 100).toFixed(0),
  }));

  const top        = [...users].sort((a, b) => b.avg - a.avg).slice(0, 8);
  const struggling = [...users].sort((a, b) => a.avg - b.avg).slice(0, 8);

  const renderUserList = (list, showGood) => list.map((u, i) => `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid rgba(30,45,69,.5);">
      <div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#06b6d4);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;">${(u.name[0] || 'U').toUpperCase()}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${u.name}</div>
        <div style="font-size:11px;color:var(--muted);">${u.total} tests · ${u.passRate}% pass</div>
      </div>
      <span style="font-size:15px;font-weight:800;color:${u.avg >= 60 ? '#10b981' : '#ef4444'};">${u.avg}%</span>
    </div>`).join('');

  document.getElementById('admin-top-students').innerHTML       = renderUserList(top, true) || '<div style="color:var(--muted);padding:20px;font-size:13px;">No data.</div>';
  document.getElementById('admin-struggling-students').innerHTML = renderUserList(struggling, false) || '<div style="color:var(--muted);padding:20px;font-size:13px;">No data.</div>';
}

function renderAdminActivityTab(attempts) {
  // Heatmap reuse
  const dayMap = {};
  attempts.forEach(a => {
    const d = new Date(a.submitted_at).toLocaleDateString('en-CA');
    if (!dayMap[d]) dayMap[d] = [];
    dayMap[d].push(+a.percentage);
  });

  const weeks = 12;
  const today = new Date(); today.setHours(0,0,0,0);
  const start = new Date(today); start.setDate(start.getDate() - weeks * 7);
  const days  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const colors= ['rgba(30,45,69,0.5)','rgba(239,68,68,0.6)','rgba(245,158,11,0.6)','rgba(59,130,246,0.6)','rgba(16,185,129,0.8)'];

  let html = `<div style="display:grid;grid-template-columns:32px repeat(${weeks},1fr);gap:3px;align-items:center;">`;
  for (let d = 0; d < 7; d++) {
    html += `<div style="font-size:10px;color:var(--muted);text-align:right;padding-right:4px;">${d % 2 === 0 ? days[d] : ''}</div>`;
    for (let w = 0; w < weeks; w++) {
      const date = new Date(start); date.setDate(date.getDate() + w * 7 + d);
      const key  = date.toLocaleDateString('en-CA');
      const da   = dayMap[key];
      const avg  = da ? +(da.reduce((s,v) => s+v,0) / da.length).toFixed(0) : null;
      const intensity = avg === null ? 0 : avg >= 80 ? 4 : avg >= 60 ? 3 : avg >= 40 ? 2 : 1;
      html += `<div title="${key}: ${avg !== null ? avg + '% avg (' + da.length + ' attempts)' : 'No activity'}" style="aspect-ratio:1;border-radius:3px;background:${colors[intensity]};cursor:pointer;transition:transform .1s;" onmouseenter="this.style.transform='scale(1.3)'" onmouseleave="this.style.transform=''"></div>`;
    }
  }
  html += `</div>`;
  document.getElementById('admin-activity-heatmap').innerHTML = html;

  // Peak hours chart
  const hourBuckets = new Array(24).fill(0);
  attempts.forEach(a => { const h = new Date(a.submitted_at).getHours(); hourBuckets[h]++; });
  const hourLabels = Array.from({length:24}, (_, i) => i + ':00');
  const ctxH = document.getElementById('chart-admin-hours');
  if (ctxH) {
    if (adminAnalyticsCharts['hours']) adminAnalyticsCharts['hours'].destroy();
    adminAnalyticsCharts['hours'] = new Chart(ctxH, {
      type: 'bar',
      data: { labels: hourLabels, datasets:[{ label:'Attempts', data: hourBuckets, backgroundColor: 'rgba(139,92,246,.6)', borderColor:'#8b5cf6', borderWidth:1, borderRadius:4 }] },
      options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false}, tooltip:{backgroundColor:'#1a2235',bodyColor:'#94a3b8'} }, scales:{ x:{ticks:{color:'#64748b',font:{size:9}},grid:{display:false}}, y:{ticks:{color:'#64748b'},grid:{color:'rgba(30,45,69,.5)'}} } }
    });
  }
}