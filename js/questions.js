// ============================================================
// questions.js — Add/edit/delete questions + image upload
// ============================================================

// ─── Open modal ──────────────────────────────────────────────
function openAddQuestionModal() {
  document.getElementById('question-modal-title').textContent = 'Add Question';
  document.getElementById('question-edit-id').value           = '';
  ['question-text-input', 'q-opt-a', 'q-opt-b', 'q-opt-c', 'q-opt-d', 'q-explanation']
    .forEach(id => document.getElementById(id).value = '');
  document.getElementById('q-answer').value             = '';
  document.getElementById('question-series').value      = '';
  document.getElementById('q-image-preview').style.display = 'none';
  document.getElementById('q-image-preview').src        = '';
  document.getElementById('q-current-image-url').value  = '';
  questionImageFile = null;
  _resetSaveBtn();
  document.getElementById('add-question-modal').style.display = 'flex';
}

// ─── Edit question ───────────────────────────────────────────
// FIXED: No longer calls loadAdminQuestions() which fetched all questions
// just to open a modal — causing freezes especially from the Reports page.
async function editQuestion(id) {
  // Open modal immediately with loading state so UI feels instant
  document.getElementById('question-modal-title').textContent = 'Edit Question';
  document.getElementById('question-edit-id').value           = id;
  _setSaveBtnState(true, 'Loading…');
  document.getElementById('add-question-modal').style.display = 'flex';

  // Fetch only the single question + series list in parallel
  const [{ data: q, error: qErr }, { data: series }] = await Promise.all([
    sb.from('questions').select('*').eq('id', id).single(),
    sb.from('test_series').select('id,name').order('name'),
  ]);

  if (qErr || !q) {
    showToast('Failed to load question: ' + (qErr?.message || 'not found'), 'error');
    closeModal('add-question-modal');
    return;
  }

  // Populate series dropdown without triggering a full table reload
  const opts = (series || []).map(s =>
    `<option value="${s.id}">${s.name}</option>`
  ).join('');
  const seriesSel = document.getElementById('question-series');
  if (seriesSel) {
    seriesSel.innerHTML = `<option value="">Select series…</option>` + opts;
    seriesSel.value = q.series_id || '';
  }

  document.getElementById('question-text-input').value = q.question    || '';
  document.getElementById('q-opt-a').value             = q.option_a    || '';
  document.getElementById('q-opt-b').value             = q.option_b    || '';
  document.getElementById('q-opt-c').value             = q.option_c    || '';
  document.getElementById('q-opt-d').value             = q.option_d    || '';
  document.getElementById('q-answer').value            = q.answer      || '';
  document.getElementById('q-explanation').value       = q.explanation || '';
  document.getElementById('q-current-image-url').value = q.image_url   || '';
  questionImageFile = null;

  const prev = document.getElementById('q-image-preview');
  if (q.image_url) { prev.src = q.image_url; prev.style.display = ''; }
  else             { prev.style.display = 'none'; prev.src = ''; }

  _resetSaveBtn();
}

// ─── Save button state helpers ───────────────────────────────
function _getSaveBtn() {
  return document.getElementById('q-save-btn');
}
function _setSaveBtnState(disabled, text) {
  const btn = _getSaveBtn();
  if (!btn) return;
  btn.disabled    = disabled;
  btn.textContent = text;
}
function _resetSaveBtn() {
  _setSaveBtnState(false, 'Save Question');
}

// ─── Image handling ──────────────────────────────────────────
function handleQuestionImageSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  questionImageFile = file;
  const reader = new FileReader();
  reader.onload = ev => {
    const prev = document.getElementById('q-image-preview');
    prev.src = ev.target.result;
    prev.style.display = '';
  };
  reader.readAsDataURL(file);
}

function removeQuestionImage() {
  questionImageFile = null;
  document.getElementById('q-current-image-url').value = '';
  const prev = document.getElementById('q-image-preview');
  prev.src = ''; prev.style.display = 'none';
  document.getElementById('q-image-input').value = '';
}

async function uploadQuestionImage(file) {
  const ext  = file.name.split('.').pop();
  const path = `questions/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await sb.storage.from(STORAGE_BUCKET).upload(path, file, { upsert: true });
  if (error) throw new Error('Image upload failed: ' + error.message);
  const { data } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// ─── Save question ───────────────────────────────────────────
async function saveQuestion(e) {
  e.preventDefault();

  const editId    = document.getElementById('question-edit-id').value;
  const seriesVal = document.getElementById('question-series').value;
  const qText     = document.getElementById('question-text-input').value.trim();
  const answer    = document.getElementById('q-answer').value;

  // Explicit validation (belt-and-suspenders on top of HTML required attrs)
  if (!seriesVal) { showToast('Please select a test series.', 'error'); return; }
  if (!qText)     { showToast('Question text cannot be empty.', 'error'); return; }
  if (!answer)    { showToast('Please select the correct answer.', 'error'); return; }

  _setSaveBtnState(true, 'Saving…');

  let imageUrl = document.getElementById('q-current-image-url').value || null;
  if (questionImageFile) {
    try {
      _setSaveBtnState(true, 'Uploading image…');
      imageUrl = await uploadQuestionImage(questionImageFile);
    } catch (err) {
      showToast(err.message, 'error');
      _resetSaveBtn();
      return;
    }
  }

  const payload = {
    series_id:   seriesVal,
    question:    qText,
    image_url:   imageUrl,
    option_a:    document.getElementById('q-opt-a').value.trim(),
    option_b:    document.getElementById('q-opt-b').value.trim(),
    option_c:    document.getElementById('q-opt-c').value.trim(),
    option_d:    document.getElementById('q-opt-d').value.trim(),
    answer,
    explanation: document.getElementById('q-explanation').value.trim(),
  };

  const { error } = editId
    ? await sb.from('questions').update(payload).eq('id', editId)
    : await sb.from('questions').insert(payload);

  if (error) {
    showToast('Error saving: ' + error.message, 'error');
    _resetSaveBtn();
    return;
  }

  questionImageFile = null;
  closeModal('add-question-modal');
  showToast(editId ? 'Question updated!' : 'Question added!', 'success');

  // Only reload what's visible — avoids freezing when opened from Reports page
  if (document.getElementById('page-admin-questions')?.classList.contains('active')) {
    loadAdminQuestions();
  } else if (document.getElementById('page-admin-reports')?.classList.contains('active')) {
    loadAdminReports();
  }
}

// ─── Delete question ─────────────────────────────────────────
async function deleteQuestion(id) {
  showConfirm('Delete Question', 'Permanently delete this question?', async () => {
    const { error } = await sb.from('questions').delete().eq('id', id);
    if (error) { showToast('Error: ' + error.message, 'error'); return; }
    showToast('Question deleted.', 'success');
    if (document.getElementById('page-admin-questions')?.classList.contains('active')) {
      loadAdminQuestions();
    }
  }, '🗑️');
}