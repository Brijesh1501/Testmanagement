// ============================================================
// questions.js — Add/edit/delete questions + image upload
// ============================================================

// ─── Open modal ──────────────────────────────────────────────
function openAddQuestionModal() {
  document.getElementById('question-modal-title').textContent = 'Add Question';
  document.getElementById('question-edit-id').value           = '';
  ['question-text-input', 'q-opt-a', 'q-opt-b', 'q-opt-c', 'q-opt-d', 'q-explanation']
    .forEach(id => document.getElementById(id).value = '');
  document.getElementById('q-answer').value          = '';
  document.getElementById('question-series').value   = '';
  document.getElementById('q-image-preview').style.display = 'none';
  document.getElementById('q-image-preview').src     = '';
  document.getElementById('q-current-image-url').value = '';
  questionImageFile = null;
  document.getElementById('add-question-modal').style.display = 'flex';
}

// ─── Edit question ───────────────────────────────────────────
async function editQuestion(id) {
  const { data: q } = await sb.from('questions').select('*').eq('id', id).single();
  await loadAdminQuestions();
  document.getElementById('question-modal-title').textContent = 'Edit Question';
  document.getElementById('question-edit-id').value           = id;
  document.getElementById('question-text-input').value        = q.question;
  document.getElementById('q-opt-a').value                    = q.option_a;
  document.getElementById('q-opt-b').value                    = q.option_b;
  document.getElementById('q-opt-c').value                    = q.option_c;
  document.getElementById('q-opt-d').value                    = q.option_d;
  document.getElementById('q-answer').value                   = q.answer;
  document.getElementById('q-explanation').value              = q.explanation || '';
  document.getElementById('question-series').value            = q.series_id;
  document.getElementById('q-current-image-url').value        = q.image_url || '';
  questionImageFile = null;

  const prev = document.getElementById('q-image-preview');
  if (q.image_url) { prev.src = q.image_url; prev.style.display = ''; }
  else             { prev.style.display = 'none'; prev.src = ''; }

  document.getElementById('add-question-modal').style.display = 'flex';
}

// ─── Image handling ──────────────────────────────────────────
function handleQuestionImageSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  questionImageFile = file;
  const reader = new FileReader();
  reader.onload = ev => {
    const prev    = document.getElementById('q-image-preview');
    prev.src      = ev.target.result;
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
  const editId = document.getElementById('question-edit-id').value;
  let imageUrl = document.getElementById('q-current-image-url').value || null;

  if (questionImageFile) {
    try { showToast('Uploading image…', 'info'); imageUrl = await uploadQuestionImage(questionImageFile); }
    catch (err) { showToast(err.message, 'error'); return; }
  }

  const payload = {
    series_id:   document.getElementById('question-series').value,
    question:    document.getElementById('question-text-input').value.trim(),
    image_url:   imageUrl,
    option_a:    document.getElementById('q-opt-a').value.trim(),
    option_b:    document.getElementById('q-opt-b').value.trim(),
    option_c:    document.getElementById('q-opt-c').value.trim(),
    option_d:    document.getElementById('q-opt-d').value.trim(),
    answer:      document.getElementById('q-answer').value,
    explanation: document.getElementById('q-explanation').value.trim(),
  };

  const query = editId
    ? sb.from('questions').update(payload).eq('id', editId)
    : sb.from('questions').insert(payload);
  const { error } = await query;
  if (error) { showToast('Error: ' + error.message, 'error'); return; }

  closeModal('add-question-modal');
  loadAdminQuestions();
  showToast(editId ? 'Question updated!' : 'Question added!', 'success');
  questionImageFile = null;
}

// ─── Delete question ─────────────────────────────────────────
async function deleteQuestion(id) {
  showConfirm('Delete Question', 'Permanently delete this question?', async () => {
    const { error } = await sb.from('questions').delete().eq('id', id);
    if (error) { showToast('Error: ' + error.message, 'error'); return; }
    showToast('Question deleted.', 'success');
    loadAdminQuestions();
  }, '🗑️');
}