// ============================================================
// ui.js — UI helpers: toasts, modals, cards, formatters
// ============================================================

// ─── Auth page toggling ──────────────────────────────────────
function showAuthPage(id) {
  document.querySelectorAll('#auth-container > div').forEach(el => el.style.display = 'none');
  document.getElementById(id).style.display = 'grid';
}
const showPage = showAuthPage;

// ─── Error display ───────────────────────────────────────────
function showError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 5000);
}
function hideError(id) {
  document.getElementById(id)?.classList.add('hidden');
}

// ─── Button loading state ────────────────────────────────────
function setLoading(btnId, textId, loading, text) {
  const btn = document.getElementById(btnId);
  const txt = document.getElementById(textId);
  if (!btn || !txt) return;
  btn.disabled = loading;
  txt.textContent = text;
}

// ─── Modal ───────────────────────────────────────────────────
function closeModal(id) {
  document.getElementById(id).style.display = 'none';
}

function showConfirm(title, message, onConfirm, icon = '⚠️') {
  document.getElementById('confirm-title').textContent   = title;
  document.getElementById('confirm-message').textContent = message;
  const iconEl = document.getElementById('confirm-icon');
  iconEl.textContent = icon;
  iconEl.style.cssText = 'width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(245,158,11,0.15);font-size:24px;margin:0 auto 16px;';
  document.getElementById('confirm-modal').style.display = 'flex';
  document.getElementById('confirm-action-btn').onclick  = () => { closeModal('confirm-modal'); onConfirm(); };
}

// ─── Toast ───────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  document.querySelector('.toast')?.remove();
  const t     = document.createElement('div');
  t.className = 'toast';
  const color = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6';
  t.innerHTML = `<div style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0;"></div>${msg}`;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

// ─── Stat card ───────────────────────────────────────────────
function statCard(label, value, color, iconSvg) {
  return `<div class="stat-card">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
      <div style="width:36px;height:36px;border-radius:9px;background:${color}22;display:flex;align-items:center;justify-content:center;color:${color};">${iconSvg}</div>
    </div>
    <div style="font-size:26px;font-weight:800;margin-bottom:4px;">${value}</div>
    <div style="font-size:12px;color:var(--muted);">${label}</div>
  </div>`;
}

// ─── Empty / error / skeleton states ─────────────────────────
function emptyState(msg, full = false) {
  return `<div style="text-align:center;padding:60px;color:var(--muted);${full ? 'grid-column:1/-1;' : ''}">
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin:0 auto 12px;opacity:0.3;display:block;"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/></svg>
    <p style="font-size:13px;">${msg}</p>
  </div>`;
}

function skeletonGrid(n) {
  return Array(n).fill(0).map(() =>
    `<div class="glass p-6" style="height:220px;background:linear-gradient(90deg,var(--surface2) 25%,var(--border) 50%,var(--surface2) 75%);background-size:200% 100%;animation:shimmer 1.5s infinite;border-radius:16px;"></div>`
  ).join('') + '<style>@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}</style>';
}

function errorState(msg) {
  return `<div style="color:#f87171;padding:20px;text-align:center;grid-column:1/-1;">Error: ${msg}</div>`;
}

// ─── Formatters ───────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtDuration(s) {
  if (s == null) return '—';
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

// ─── Admin credential quick-fill ─────────────────────────────
function showAdminLogin() {
  document.getElementById('login-email').value    = 'admin@omegaTest.com';
  document.getElementById('login-password').value = 'admin123';
  showToast('Admin credentials filled.', 'info');
}

// ─── Close modals on backdrop click ──────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.modal-overlay').forEach(el => {
    el.addEventListener('click', e => { if (e.target === el) el.style.display = 'none'; });
  });
});