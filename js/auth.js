// ============================================================
// auth.js — Boot, login, register, logout, profile fetch
// ============================================================

// ─── BOOT ────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', boot);

async function boot() {
  document.getElementById('auth-container').style.display = 'none';
  document.getElementById('app-container').style.display  = 'none';

  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    currentUser    = session.user;
    currentProfile = await fetchProfileWithRetry(currentUser.id);
    if (currentProfile) { showApp(); }
    else {
      await sb.auth.signOut();
      document.getElementById('auth-container').style.display = '';
      showAuthPage('login-page');
    }
  } else {
    document.getElementById('auth-container').style.display = '';
    showAuthPage('login-page');
  }

  sb.auth.onAuthStateChange(async (event, session) => {
    if (event === 'INITIAL_SESSION') return;
    if (session) {
      currentUser    = session.user;
      currentProfile = await fetchProfileWithRetry(currentUser.id);
      if (currentProfile) { showApp(); }
      else {
        showAuthPage('login-page');
        showError('login-error', 'Account created! Please sign in.');
        await sb.auth.signOut();
      }
    } else {
      currentUser = currentProfile = null;
      document.getElementById('app-container').style.display  = 'none';
      document.getElementById('auth-container').style.display = '';
      showAuthPage('login-page');
    }
  });
}

// ─── Profile helpers ─────────────────────────────────────────
async function fetchProfile(uid) {
  const { data, error } = await sb.from('profiles').select('*').eq('id', uid).single();
  return error ? null : data;
}

async function fetchProfileWithRetry(uid, attempts = 6, delayMs = 500) {
  for (let i = 0; i < attempts; i++) {
    const p = await fetchProfile(uid);
    if (p) return p;
    await new Promise(r => setTimeout(r, delayMs));
  }
  return null;
}

// ─── Register ────────────────────────────────────────────────
async function handleRegister(e) {
  e.preventDefault();
  const name     = document.getElementById('reg-name').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  setLoading('reg-btn', 'reg-btn-text', true, 'Creating account…');
  hideError('register-error');

  const { data, error } = await sb.auth.signUp({
    email, password, options: { data: { full_name: name, role: 'student' } }
  });
  setLoading('reg-btn', 'reg-btn-text', false, 'Create Account');

  if (error) { showError('register-error', error.message); return; }
  if (data.session && data.user) {
    await sb.from('profiles').upsert({ id: data.user.id, full_name: name, role: 'student' });
    return;
  }
  if (data.user && !data.session) {
    showToast('Check your email to confirm, then sign in.', 'success');
    showAuthPage('login-page');
  }
}

// ─── Login ───────────────────────────────────────────────────
async function handleLogin(e) {
  e.preventDefault();
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  setLoading('login-btn', 'login-btn-text', true, 'Signing in…');
  hideError('login-error');

  const { error } = await sb.auth.signInWithPassword({ email, password });
  setLoading('login-btn', 'login-btn-text', false, 'Sign In');
  if (error) showError('login-error', error.message);
}

// ─── Logout ──────────────────────────────────────────────────
async function handleLogout() {
  await sb.auth.signOut();
  currentUser = currentProfile = null;
  document.getElementById('app-container').style.display  = 'none';
  document.getElementById('auth-container').style.display = '';
  showAuthPage('login-page');
}