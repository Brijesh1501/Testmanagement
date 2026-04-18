// ============================================================
// question-reports.js — Report questions + comment system
// ============================================================
// DB tables needed (run in Supabase SQL editor):
//
// CREATE TABLE question_reports (
//   id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//   question_id     UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
//   user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
//   reason          TEXT NOT NULL,
//   description     TEXT,
//   status          TEXT NOT NULL DEFAULT 'open',   -- open | reviewing | resolved | dismissed
//   created_at      TIMESTAMPTZ DEFAULT NOW()
// );
//
// CREATE TABLE report_comments (
//   id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//   report_id   UUID NOT NULL REFERENCES question_reports(id) ON DELETE CASCADE,
//   user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
//   comment     TEXT NOT NULL,
//   created_at  TIMESTAMPTZ DEFAULT NOW()
// );
//
// ALTER TABLE question_reports ENABLE ROW LEVEL SECURITY;
// ALTER TABLE report_comments  ENABLE ROW LEVEL SECURITY;
//
// -- Students can insert/view their own; admins can view all
// CREATE POLICY "insert_own_report"  ON question_reports FOR INSERT WITH CHECK (auth.uid() = user_id);
// CREATE POLICY "select_own_report"  ON question_reports FOR SELECT USING (auth.uid() = user_id OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
// CREATE POLICY "update_admin_report" ON question_reports FOR UPDATE USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
//
// CREATE POLICY "insert_comment"  ON report_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
// CREATE POLICY "select_comment"  ON report_comments FOR SELECT USING (
//   auth.uid() = user_id
//   OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
//   OR auth.uid() IN (SELECT user_id FROM question_reports WHERE id = report_id)
// );
// ============================================================

const REPORT_REASONS = [
  { value: 'wrong_answer',    label: '❌ Wrong correct answer' },
  { value: 'typo',            label: '✏️ Typo / spelling error' },
  { value: 'unclear',         label: '🤔 Unclear or ambiguous question' },
  { value: 'wrong_image',     label: '🖼️ Wrong or missing image' },
  { value: 'bad_explanation', label: '📖 Bad or missing explanation' },
  { value: 'duplicate',       label: '🔁 Duplicate question' },
  { value: 'other',           label: '💬 Other issue' },
];

// ─── Open the report modal (called from test or review) ──────
function openReportModal(questionId, questionText) {
  document.getElementById('report-question-id').value    = questionId;
  document.getElementById('report-question-text').textContent = questionText;
  document.getElementById('report-reason').value         = '';
  document.getElementById('report-description').value    = '';
  document.getElementById('report-modal-error').textContent = '';
  document.getElementById('report-success-msg').style.display = 'none';
  document.getElementById('report-form-body').style.display   = '';
  document.getElementById('report-modal').style.display = 'flex';
}

// ─── Submit a report ─────────────────────────────────────────
async function submitQuestionReport(e) {
  e.preventDefault();
  const questionId  = document.getElementById('report-question-id').value;
  const reason      = document.getElementById('report-reason').value;
  const description = document.getElementById('report-description').value.trim();
  const errEl       = document.getElementById('report-modal-error');

  if (!reason) { errEl.textContent = 'Please select a reason.'; return; }

  const btn = document.getElementById('report-submit-btn');
  btn.disabled = true; btn.textContent = 'Submitting…';

  // Check for duplicate report from same user
  const { data: existing } = await sb.from('question_reports')
    .select('id').eq('question_id', questionId).eq('user_id', currentUser.id).eq('status', 'open').single();
  if (existing) {
    errEl.textContent = 'You already have an open report for this question.';
    btn.disabled = false; btn.textContent = 'Submit Report';
    return;
  }

  const { error } = await sb.from('question_reports').insert({
    question_id: questionId,
    user_id:     currentUser.id,
    reason,
    description: description || null,
    status:      'open',
  });

  btn.disabled = false; btn.textContent = 'Submit Report';

  if (error) { errEl.textContent = 'Error: ' + error.message; return; }

  document.getElementById('report-form-body').style.display   = 'none';
  document.getElementById('report-success-msg').style.display = '';
  showToast('Report submitted — thank you!', 'success');
  setTimeout(() => closeModal('report-modal'), 2000);
}

// ─── Admin: load all reports ──────────────────────────────────
async function loadAdminReports() {
  const container = document.getElementById('admin-reports-content');
  const loading   = document.getElementById('admin-reports-loading');
  if (loading) loading.style.display = '';
  if (container) container.innerHTML = '';

  const { data: reports, error } = await sb
    .from('question_reports')
    .select(`
      id, reason, description, status, created_at,
      questions(id, question, option_a, option_b, option_c, option_d, answer, explanation, image_url, series_id),
      profiles(full_name)
    `)
    .order('created_at', { ascending: false });

  if (loading) loading.style.display = 'none';
  if (error) { if (container) container.innerHTML = `<div style="color:#f87171;padding:20px;">Error: ${error.message}</div>`; return; }

  if (!reports?.length) {
    if (container) container.innerHTML = `<div style="text-align:center;padding:60px;color:var(--muted);">
      <div style="font-size:36px;margin-bottom:12px;">📋</div>
      <p style="font-size:14px;">No question reports yet.</p>
    </div>`;
    return;
  }

  // Group stats
  const open       = reports.filter(r => r.status === 'open').length;
  const reviewing  = reports.filter(r => r.status === 'reviewing').length;
  const resolved   = reports.filter(r => r.status === 'resolved').length;
  const dismissed  = reports.filter(r => r.status === 'dismissed').length;

  // Filter state
  const filterSel  = document.getElementById('reports-filter-status')?.value || '';
  const searchVal  = (document.getElementById('reports-search')?.value || '').toLowerCase();

  let filtered = reports;
  if (filterSel) filtered = filtered.filter(r => r.status === filterSel);
  if (searchVal) filtered = filtered.filter(r =>
    (r.questions?.question || '').toLowerCase().includes(searchVal) ||
    (r.profiles?.full_name || '').toLowerCase().includes(searchVal)
  );

  if (container) container.innerHTML = `
    <!-- Summary row -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4" style="margin-bottom:24px;">
      ${statCard('Open',      open,      '#ef4444', iconQ)}
      ${statCard('Reviewing', reviewing, '#f59e0b', iconQ)}
      ${statCard('Resolved',  resolved,  '#10b981', iconCheck)}
      ${statCard('Dismissed', dismissed, '#6b7280', iconQ)}
    </div>

    <!-- Filters -->
    <div class="glass p-4" style="margin-bottom:16px;display:flex;gap:12px;flex-wrap:wrap;align-items:center;">
      <select id="reports-filter-status" class="input-field" style="max-width:160px;" onchange="loadAdminReports()">
        <option value="">All Status</option>
        <option value="open"      ${filterSel==='open'?'selected':''}>Open</option>
        <option value="reviewing" ${filterSel==='reviewing'?'selected':''}>Reviewing</option>
        <option value="resolved"  ${filterSel==='resolved'?'selected':''}>Resolved</option>
        <option value="dismissed" ${filterSel==='dismissed'?'selected':''}>Dismissed</option>
      </select>
      <input type="text" id="reports-search" class="input-field" placeholder="Search question or user…"
        value="${searchVal}" oninput="loadAdminReports()" style="max-width:280px;">
      <span style="font-size:12px;color:var(--muted);margin-left:auto;">${filtered.length} report${filtered.length!==1?'s':''}</span>
    </div>

    <!-- Report cards -->
    <div style="display:flex;flex-direction:column;gap:16px;">
      ${filtered.map(r => renderAdminReportCard(r)).join('')}
    </div>
  `;
}

function renderAdminReportCard(r) {
  const q          = r.questions || {};
  const statusColor = { open:'#ef4444', reviewing:'#f59e0b', resolved:'#10b981', dismissed:'#6b7280' }[r.status] || '#6b7280';
  const reasonLabel = REPORT_REASONS.find(x => x.value === r.reason)?.label || r.reason;

  const opts = ['A','B','C','D'].map(l => {
    const isCorrect = l === q.answer;
    return `<div style="padding:6px 10px;border-radius:6px;font-size:12px;
      background:${isCorrect ? 'rgba(16,185,129,.15)' : 'var(--surface2)'};
      border:1px solid ${isCorrect ? 'rgba(16,185,129,.4)' : 'var(--border)'};
      color:${isCorrect ? '#10b981' : 'var(--text)'};">
      <strong>${l}.</strong> ${q['option_'+l.toLowerCase()]||'—'}${isCorrect ? ' ✅' : ''}
    </div>`;
  }).join('');

  return `
  <div class="glass p-5" style="border-left:3px solid ${statusColor};" id="report-card-${r.id}">
    <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:14px;flex-wrap:wrap;">
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
          <span class="badge" style="background:${statusColor}22;color:${statusColor};border-color:${statusColor}44;">${r.status.toUpperCase()}</span>
          <span class="badge badge-blue">${reasonLabel}</span>
          <span style="font-size:11px;color:var(--muted);">${fmtDate(r.created_at)} · ${r.profiles?.full_name || 'Unknown user'}</span>
        </div>
        <p style="font-size:13px;font-weight:600;line-height:1.5;margin-bottom:8px;">${q.question || 'Question deleted'}</p>
        ${q.image_url ? `<img src="${q.image_url}" alt="" style="max-height:120px;border-radius:8px;margin-bottom:8px;object-fit:contain;">` : ''}
        <div class="grid grid-cols-2 gap-2" style="margin-bottom:8px;">${opts}</div>
        ${q.explanation ? `<div style="font-size:12px;color:#60a5fa;background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.2);border-radius:6px;padding:8px;"><strong>Explanation:</strong> ${q.explanation}</div>` : ''}
        ${r.description ? `<div style="font-size:12px;color:var(--muted);margin-top:8px;padding:8px;background:var(--surface2);border-radius:6px;border:1px solid var(--border);"><strong>User note:</strong> ${r.description}</div>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0;">
        <select onchange="updateReportStatus('${r.id}', this.value)" class="input-field" style="font-size:12px;padding:6px 10px;">
          ${['open','reviewing','resolved','dismissed'].map(s =>
            `<option value="${s}" ${r.status===s?'selected':''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`
          ).join('')}
        </select>
        ${q.id ? `<button onclick="editQuestion('${q.id}')" class="btn-secondary" style="font-size:11px;padding:6px 10px;">✏️ Edit Q</button>` : ''}
      </div>
    </div>

    <!-- Comments section -->
    <div style="border-top:1px solid var(--border);padding-top:12px;">
      <div style="font-size:12px;font-weight:700;color:var(--muted);margin-bottom:8px;display:flex;align-items:center;gap:6px;">
        💬 Comments <button onclick="toggleReportComments('${r.id}')" style="background:none;border:none;color:var(--accent);font-size:11px;cursor:pointer;padding:0;">Show / Hide</button>
      </div>
      <div id="comments-${r.id}" style="display:none;">
        <div id="comments-list-${r.id}" style="margin-bottom:10px;"></div>
        <div style="display:flex;gap:8px;">
          <input type="text" id="comment-input-${r.id}" class="input-field" placeholder="Add a comment…" style="flex:1;font-size:12px;padding:8px 12px;">
          <button onclick="submitComment('${r.id}')" class="btn-primary" style="font-size:12px;padding:8px 14px;">Send</button>
        </div>
      </div>
    </div>
  </div>`;
}

async function toggleReportComments(reportId) {
  const el = document.getElementById('comments-' + reportId);
  if (!el) return;
  const isOpen = el.style.display !== 'none';
  if (isOpen) { el.style.display = 'none'; return; }
  el.style.display = '';
  await loadComments(reportId);
}

async function loadComments(reportId) {
  const listEl = document.getElementById('comments-list-' + reportId);
  if (!listEl) return;
  listEl.innerHTML = `<div style="font-size:12px;color:var(--muted);">Loading…</div>`;

  const { data: comments, error } = await sb
    .from('report_comments')
    .select('*, profiles(full_name, role)')
    .eq('report_id', reportId)
    .order('created_at', { ascending: true });

  if (error || !comments?.length) {
    listEl.innerHTML = `<div style="font-size:12px;color:var(--muted);padding:4px 0;">No comments yet.</div>`;
    return;
  }

  listEl.innerHTML = comments.map(c => {
    const isAdmin = c.profiles?.role === 'admin';
    return `
    <div style="display:flex;gap:8px;margin-bottom:8px;">
      <div style="width:28px;height:28px;border-radius:50%;background:${isAdmin ? 'linear-gradient(135deg,#3b82f6,#06b6d4)' : 'var(--surface2)'};border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;">
        ${(c.profiles?.full_name||'?')[0].toUpperCase()}
      </div>
      <div style="flex:1;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px 10px;">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">
          <span style="font-size:11px;font-weight:700;">${c.profiles?.full_name || 'Unknown'}</span>
          ${isAdmin ? `<span class="badge badge-blue" style="font-size:9px;padding:1px 5px;">Admin</span>` : ''}
          <span style="font-size:10px;color:var(--muted);margin-left:auto;">${fmtDate(c.created_at)}</span>
        </div>
        <div style="font-size:12px;line-height:1.5;">${c.comment}</div>
      </div>
    </div>`;
  }).join('');
}

async function submitComment(reportId) {
  const input = document.getElementById('comment-input-' + reportId);
  const text  = input?.value?.trim();
  if (!text) return;

  const { error } = await sb.from('report_comments').insert({
    report_id: reportId,
    user_id:   currentUser.id,
    comment:   text,
  });
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  input.value = '';
  await loadComments(reportId);
}

async function updateReportStatus(reportId, newStatus) {
  const { error } = await sb.from('question_reports').update({ status: newStatus }).eq('id', reportId);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  showToast(`Status → ${newStatus}`, 'success');
  // Update card border color live
  const card = document.getElementById('report-card-' + reportId);
  if (card) {
    const c = { open:'#ef4444', reviewing:'#f59e0b', resolved:'#10b981', dismissed:'#6b7280' }[newStatus] || '#6b7280';
    card.style.borderLeftColor = c;
  }
}

// ─── Student: view their own reports ─────────────────────────
async function loadMyReports() {
  const container = document.getElementById('my-reports-list');
  if (!container) return;
  container.innerHTML = `<div style="color:var(--muted);font-size:13px;">Loading…</div>`;

  const { data: reports, error } = await sb
    .from('question_reports')
    .select(`id, reason, description, status, created_at, questions(question, answer, option_a, option_b, option_c, option_d, explanation, image_url)`)
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false });

  if (error || !reports?.length) {
    container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--muted);">
      <div style="font-size:32px;margin-bottom:8px;">📋</div>
      <p style="font-size:13px;">You haven't reported any questions yet.</p>
    </div>`;
    return;
  }

  container.innerHTML = reports.map(r => {
    const q = r.questions || {};
    const statusColor = { open:'#ef4444', reviewing:'#f59e0b', resolved:'#10b981', dismissed:'#6b7280' }[r.status] || '#6b7280';
    const reasonLabel = REPORT_REASONS.find(x => x.value === r.reason)?.label || r.reason;

    const opts = ['A','B','C','D'].map(l => {
      const isCorrect = l === q.answer;
      return `<div style="padding:6px 10px;border-radius:6px;font-size:12px;
        background:${isCorrect ? 'rgba(16,185,129,.15)' : 'var(--surface2)'};
        border:1px solid ${isCorrect ? 'rgba(16,185,129,.4)' : 'var(--border)'};
        color:${isCorrect ? '#10b981' : 'var(--text)'};">
        <strong>${l}.</strong> ${q['option_'+l.toLowerCase()]||'—'}${isCorrect ? ' ✅ Correct' : ''}
      </div>`;
    }).join('');

    return `
    <div class="glass p-5" style="border-left:3px solid ${statusColor};margin-bottom:14px;" id="my-report-${r.id}">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
        <span class="badge" style="background:${statusColor}22;color:${statusColor};border-color:${statusColor}44;">${r.status.toUpperCase()}</span>
        <span class="badge badge-blue">${reasonLabel}</span>
        <span style="font-size:11px;color:var(--muted);">${fmtDate(r.created_at)}</span>
      </div>
      <p style="font-size:13px;font-weight:600;margin-bottom:10px;line-height:1.5;">${q.question || 'Question removed'}</p>
      ${q.image_url ? `<img src="${q.image_url}" alt="" style="max-height:100px;border-radius:8px;margin-bottom:8px;object-fit:contain;">` : ''}
      <div class="grid grid-cols-2 gap-2" style="margin-bottom:8px;">${opts}</div>
      ${q.explanation ? `<div style="font-size:12px;color:#60a5fa;background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.2);border-radius:6px;padding:8px;">📖 ${q.explanation}</div>` : ''}
      ${r.description ? `<div style="margin-top:8px;font-size:12px;color:var(--muted);padding:8px;background:var(--surface2);border-radius:6px;border:1px solid var(--border);">Your note: ${r.description}</div>` : ''}

      <!-- Comments -->
      <div style="border-top:1px solid var(--border);padding-top:10px;margin-top:12px;">
        <button onclick="toggleStudentComments('${r.id}')" style="font-size:12px;font-weight:600;color:var(--accent);background:none;border:none;cursor:pointer;padding:0;display:flex;align-items:center;gap:4px;">
          💬 View / Add Comments
        </button>
        <div id="student-comments-${r.id}" style="display:none;margin-top:10px;">
          <div id="student-comments-list-${r.id}" style="margin-bottom:10px;"></div>
          <div style="display:flex;gap:8px;">
            <input type="text" id="student-comment-input-${r.id}" class="input-field" placeholder="Add a comment…" style="flex:1;font-size:12px;padding:8px 12px;">
            <button onclick="submitStudentComment('${r.id}')" class="btn-primary" style="font-size:12px;padding:8px 14px;">Send</button>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
}

async function toggleStudentComments(reportId) {
  const el = document.getElementById('student-comments-' + reportId);
  if (!el) return;
  const isOpen = el.style.display !== 'none';
  if (isOpen) { el.style.display = 'none'; return; }
  el.style.display = '';
  await loadStudentComments(reportId);
}

async function loadStudentComments(reportId) {
  const listEl = document.getElementById('student-comments-list-' + reportId);
  if (!listEl) return;
  listEl.innerHTML = `<div style="font-size:12px;color:var(--muted);">Loading…</div>`;

  const { data: comments, error } = await sb
    .from('report_comments')
    .select('*, profiles(full_name, role)')
    .eq('report_id', reportId)
    .order('created_at', { ascending: true });

  if (error || !comments?.length) {
    listEl.innerHTML = `<div style="font-size:12px;color:var(--muted);">No comments yet.</div>`;
    return;
  }

  listEl.innerHTML = comments.map(c => {
    const isAdmin = c.profiles?.role === 'admin';
    return `
    <div style="display:flex;gap:8px;margin-bottom:8px;">
      <div style="width:26px;height:26px;border-radius:50%;background:${isAdmin ? 'linear-gradient(135deg,#3b82f6,#06b6d4)' : 'var(--surface2)'};border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;">
        ${(c.profiles?.full_name||'?')[0].toUpperCase()}
      </div>
      <div style="flex:1;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:7px 10px;">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">
          <span style="font-size:11px;font-weight:700;">${c.profiles?.full_name || 'Unknown'}</span>
          ${isAdmin ? `<span class="badge badge-blue" style="font-size:9px;padding:1px 5px;">Admin</span>` : ''}
          <span style="font-size:10px;color:var(--muted);margin-left:auto;">${fmtDate(c.created_at)}</span>
        </div>
        <div style="font-size:12px;line-height:1.5;">${c.comment}</div>
      </div>
    </div>`;
  }).join('');
}

async function submitStudentComment(reportId) {
  const input = document.getElementById('student-comment-input-' + reportId);
  const text  = input?.value?.trim();
  if (!text) return;

  const { error } = await sb.from('report_comments').insert({
    report_id: reportId,
    user_id:   currentUser.id,
    comment:   text,
  });
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  input.value = '';
  await loadStudentComments(reportId);
}
