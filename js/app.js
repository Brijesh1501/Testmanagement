// ============================================================
// app.js — App shell, sidebar render, navigation router
// ============================================================

function showApp() {
  document.getElementById('auth-container').style.display = 'none';
  document.getElementById('app-container').style.display  = '';
  renderSidebar();
  document.getElementById('admin-nav-section').style.display = currentProfile.role === 'admin' ? '' : 'none';
  navigateTo('dashboard');
}

function renderSidebar() {
  const name = currentProfile.full_name || currentUser.email;
  document.getElementById('user-name-sidebar').textContent = name;
  document.getElementById('user-role-badge').textContent   = currentProfile.role === 'admin' ? 'Administrator' : 'Student';
  document.getElementById('user-avatar').textContent       = name[0].toUpperCase();
}

function navigateTo(page) {
  const adminPages = ['admin-dashboard', 'admin-users', 'admin-series', 'admin-questions', 'admin-user-detail'];
  if (adminPages.includes(page) && currentProfile?.role !== 'admin') {
    showToast('Access denied — admin only.', 'error');
    navigateTo('dashboard');
    return;
  }

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const pageEl = document.getElementById('page-' + page);
  if (pageEl) pageEl.classList.add('active');
  const navEl  = document.getElementById('nav-' + page);
  if (navEl)   navEl.classList.add('active');

  // Destroy charts when leaving analytics page
  if (page !== 'analytics') destroyAllCharts();

  const loaders = {
    'dashboard':         loadDashboard,
    'tests':             loadTestSeries,
    'results':           loadResults,
    'profile':           loadProfile,
    'analytics':         loadAnalytics,
    'admin-dashboard':   loadAdminDashboard,
    'admin-users':       loadAdminUsers,
    'admin-series':      loadAdminSeries,
    'admin-questions':   loadAdminQuestions,
  };
  if (loaders[page]) loaders[page]();
}

function destroyAllCharts() {
  Object.values(chartInstances).forEach(c => { try { c.destroy(); } catch (e) {} });
  chartInstances = {};
}

// ─── Question count map (bypasses 1000-row limit) ─────────────
async function fetchQuestionCountMap() {
  const { data, error } = await sb.from('question_counts').select('series_id,question_count');
  if (!error && data) {
    const m = {};
    data.forEach(r => { m[r.series_id] = r.question_count; });
    return m;
  }
  return fetchQuestionCountMapFallback();
}

async function fetchQuestionCountMapFallback() {
  const PAGE = 1000; let from = 0; const m = {};
  while (true) {
    const { data, error } = await sb.from('questions').select('series_id').range(from, from + PAGE - 1);
    if (error || !data || !data.length) break;
    data.forEach(q => { m[q.series_id] = (m[q.series_id] || 0) + 1; });
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return m;
}
