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
