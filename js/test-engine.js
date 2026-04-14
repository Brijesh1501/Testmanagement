// ============================================================
// test-engine.js — Test start, question render, timer, submit, results
// ============================================================

// ─── START TEST ──────────────────────────────────────────────
async function startTest(seriesId) {
  const { data: series } = await sb.from('test_series').select('*').eq('id', seriesId).single();
  const questions        = await fetchAllQuestionsForSeries(seriesId);
  if (!questions?.length) { showToast('No questions in this series yet!', 'error'); return; }

  const shuffled = [...questions].sort(() => Math.random() - 0.5).slice(0, series.total_questions);
  currentTest = series;
  testState   = {
    questions:        shuffled,
    answers:          new Array(shuffled.length).fill(null),
    marked:           new Array(shuffled.length).fill(false),
    currentIndex:     0,
    startTime:        Date.now(),
    totalSeconds:     series.duration_minutes * 60,
    remainingSeconds: series.duration_minutes * 60,
    submitted:        false,
  };

  document.getElementById('test-interface').style.display = '';
  document.getElementById('test-title').textContent       = series.name;
  renderQuestion();
  buildPalette();
  startTimer();
}

async function fetchAllQuestionsForSeries(seriesId) {
  const PAGE = 1000; let from = 0; const all = [];
  while (true) {
    const { data, error } = await sb.from('questions').select('*').eq('series_id', seriesId).range(from, from + PAGE - 1);
    if (error || !data || !data.length) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

// ─── RENDER QUESTION ─────────────────────────────────────────
function renderQuestion() {
  const { questions, answers, currentIndex } = testState;
  const q     = questions[currentIndex];
  const total = questions.length;

  document.getElementById('q-num-badge').textContent       = 'Q' + (currentIndex + 1);
  document.getElementById('question-text').textContent     = q.question;
  document.getElementById('test-q-counter').textContent    = `${currentIndex + 1}/${total}`;
  document.getElementById('test-progress-bar').style.width = ((currentIndex + 1) / total * 100) + '%';

  const qImg = document.getElementById('question-image-container');
  if (q.image_url) {
    qImg.innerHTML  = `<img src="${q.image_url}" alt="Question image" style="max-width:100%;max-height:260px;border-radius:10px;object-fit:contain;border:1px solid var(--border);">`;
    qImg.style.display = '';
  } else { qImg.innerHTML = ''; qImg.style.display = 'none'; }

  const isLast = currentIndex === total - 1;
  document.getElementById('next-btn').style.display   = isLast ? 'none' : '';
  document.getElementById('submit-btn').style.display = isLast ? '' : 'none';
  document.getElementById('prev-btn').disabled        = currentIndex === 0;

  const marked = testState.marked[currentIndex];
  const mb     = document.getElementById('mark-btn');
  mb.style.background   = marked ? 'rgba(245,158,11,0.2)' : '';
  mb.style.borderColor  = marked ? '#f59e0b' : '';
  mb.style.color        = marked ? '#f59e0b' : '';

  document.getElementById('clear-btn').style.opacity = answers[currentIndex] ? '1' : '0.4';

  const opts = document.getElementById('options-container');
  opts.innerHTML = ['A', 'B', 'C', 'D'].map(letter => {
    const text     = q['option_' + letter.toLowerCase()];
    const selected = answers[currentIndex] === letter;
    return `<button class="option-btn ${selected ? 'selected' : ''}" onclick="selectAnswer('${letter}')">
      <span class="option-label" style="${selected ? 'background:var(--accent);color:white;' : ''}">${letter}</span>
      <span>${text}</span>
    </button>`;
  }).join('');

  document.getElementById('explanation-box').classList.add('hidden');
}

// ─── ANSWER SELECTION ────────────────────────────────────────
function selectAnswer(letter) {
  if (testState.submitted) return;
  testState.answers[testState.currentIndex] = letter;
  updatePaletteBtn(testState.currentIndex);

  document.querySelectorAll('.option-btn').forEach((btn, i) => {
    const l = ['A', 'B', 'C', 'D'][i];
    btn.classList.toggle('selected', l === letter);
    const lbl = btn.querySelector('.option-label');
    lbl.style.background = l === letter ? 'var(--accent)' : '';
    lbl.style.color      = l === letter ? 'white' : '';
  });
  document.getElementById('clear-btn').style.opacity = '1';
}

function clearCurrentResponse() {
  if (testState.submitted) return;
  const idx = testState.currentIndex;
  if (!testState.answers[idx]) return;
  testState.answers[idx] = null;
  updatePaletteBtn(idx);

  document.querySelectorAll('.option-btn').forEach(btn => {
    btn.classList.remove('selected');
    btn.querySelector('.option-label').style.background = '';
    btn.querySelector('.option-label').style.color      = '';
  });
  document.getElementById('clear-btn').style.opacity = '0.4';
  showToast('Response cleared', 'info');
}

// ─── NAVIGATION ──────────────────────────────────────────────
function nextQuestion()  { if (testState.currentIndex < testState.questions.length - 1) { testState.currentIndex++; renderQuestion(); updatePaletteActive(); } }
function prevQuestion()  { if (testState.currentIndex > 0) { testState.currentIndex--; renderQuestion(); updatePaletteActive(); } }
function markForReview() { testState.marked[testState.currentIndex] = !testState.marked[testState.currentIndex]; renderQuestion(); updatePaletteBtn(testState.currentIndex); }
function jumpToQuestion(i) { testState.currentIndex = i; renderQuestion(); updatePaletteActive(); }

// ─── PALETTE ─────────────────────────────────────────────────
function buildPalette() {
  document.getElementById('q-palette').innerHTML = testState.questions.map((_, i) =>
    `<button class="q-nav-btn ${i === 0 ? 'current' : ''}" id="pq-${i}" onclick="jumpToQuestion(${i})">${i + 1}</button>`
  ).join('');
}

function updatePaletteBtn(index) {
  const btn     = document.getElementById('pq-' + index);
  if (!btn) return;
  const answered = testState.answers[index] !== null;
  const marked   = testState.marked[index];
  const current  = index === testState.currentIndex;

  btn.className = 'q-nav-btn';
  btn.style.background = btn.style.borderColor = btn.style.color = '';

  if (current)  { btn.classList.add('current'); return; }
  if (marked)   { btn.style.background = 'rgba(245,158,11,0.2)'; btn.style.borderColor = '#f59e0b'; btn.style.color = '#f59e0b'; return; }
  if (answered) btn.classList.add('answered');
}

function updatePaletteActive() { testState.questions.forEach((_, i) => updatePaletteBtn(i)); }

// ─── TIMER ───────────────────────────────────────────────────
function startTimer() {
  clearInterval(timerInterval);
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    testState.remainingSeconds--;
    updateTimerDisplay();
    if (testState.remainingSeconds <= 0) { clearInterval(timerInterval); submitTest(true); }
  }, 1000);
}

function updateTimerDisplay() {
  const s  = testState.remainingSeconds;
  const m  = Math.floor(s / 60);
  const ss = s % 60;
  const td = document.getElementById('timer-display');
  td.textContent = `${m}:${ss.toString().padStart(2, '0')}`;
  td.style.color = s <= 60 ? '#ef4444' : s <= 300 ? '#f59e0b' : 'var(--text)';

  const pct  = s / testState.totalSeconds;
  const C    = 163.36;
  const ring = document.getElementById('timer-ring');
  ring.setAttribute('stroke-dashoffset', C * (1 - pct));
  ring.setAttribute('stroke', s <= 60 ? '#ef4444' : s <= 300 ? '#f59e0b' : '#3b82f6');
}

// ─── SUBMIT ──────────────────────────────────────────────────
function confirmSubmitTest() {
  const answered   = testState.answers.filter(a => a !== null).length;
  const unanswered = testState.questions.length - answered;
  showConfirm('Submit Test',
    unanswered > 0
      ? `You have ${unanswered} unanswered question${unanswered > 1 ? 's' : ''}. Submit anyway?`
      : 'You answered all questions. Ready to submit?',
    () => submitTest(false), '⚠️');
}

async function submitTest(timeUp = false) {
  clearInterval(timerInterval);
  testState.submitted = true;

  const { questions, answers, startTime } = testState;
  let correct = 0, incorrect = 0, skipped = 0;
  questions.forEach((q, i) => {
    if (!answers[i]) skipped++;
    else if (answers[i] === q.answer) correct++;
    else incorrect++;
  });

  const timeTaken  = Math.floor((Date.now() - startTime) / 1000);
  const total      = questions.length;
  const percentage = +(correct / total * 100).toFixed(2);
  const isPassed   = percentage >= (currentTest.pass_percentage || 60);

  const { data: attempt, error: attErr } = await sb.from('test_attempts')
    .insert({ user_id: currentUser.id, series_id: currentTest.id, score: correct, total_questions: total, percentage, time_taken_secs: timeTaken, is_passed: isPassed })
    .select().single();
  if (attErr) { showToast('Error saving result: ' + attErr.message, 'error'); return; }

  await sb.from('attempt_answers').insert(
    questions.map((q, i) => ({
      attempt_id:     attempt.id,
      question_id:    q.id,
      user_answer:    answers[i] || null,
      correct_answer: q.answer,
      is_correct:     answers[i] === q.answer,
      question_text:  q.question,
      image_url:      q.image_url || null,
      option_a:       q.option_a,
      option_b:       q.option_b,
      option_c:       q.option_c,
      option_d:       q.option_d,
      explanation:    q.explanation || '',
    }))
  );

  document.getElementById('test-interface').style.display = 'none';
  showResultScreen({
    ...attempt,
    seriesName: currentTest.name,
    correct, incorrect, skipped, total, percentage, timeTaken, isPassed,
    questions: questions.map((q, i) => ({
      ...q, user_answer: answers[i], is_correct: answers[i] === q.answer, question_text: q.question
    }))
  });
}

function confirmExitTest() {
  showConfirm('Exit Test', 'Your progress will be lost. Are you sure?', () => {
    clearInterval(timerInterval);
    document.getElementById('test-interface').style.display = 'none';
    navigateTo('tests');
  }, '🚪');
}

// ─── RESULT SCREEN ───────────────────────────────────────────
function showResultScreen(result) {
  document.getElementById('result-screen').style.display    = '';
  document.getElementById('result-test-name').textContent   = result.seriesName;
  document.getElementById('result-score-pct').textContent   = result.percentage + '%';
  document.getElementById('res-correct').textContent        = result.correct;
  document.getElementById('res-incorrect').textContent      = result.incorrect;
  document.getElementById('res-skipped').textContent        = result.skipped;
  document.getElementById('res-time').textContent           = fmtDuration(result.timeTaken || result.time_taken_secs);

  const color = result.percentage >= 60 ? '#10b981' : result.percentage >= 40 ? '#f59e0b' : '#ef4444';
  document.getElementById('result-score-pct').style.color   = color;

  const ring = document.getElementById('score-ring');
  ring.setAttribute('stroke', color);
  setTimeout(() => ring.setAttribute('stroke-dashoffset', 439.82 * (1 - result.percentage / 100)), 100);

  document.getElementById('answer-review-section').style.display = 'none';
  window._lastResult = result;
}

function showAnswerReview() {
  const result = window._lastResult;
  document.getElementById('answer-review-section').style.display = '';
  document.getElementById('answer-review-list').innerHTML = result.questions.map((q, i) => {
    const isCorrect = q.is_correct;
    const skipped   = !q.user_answer;
    return `
    <div class="glass p-5" style="border-left:3px solid ${isCorrect ? '#10b981' : skipped ? '#f59e0b' : '#ef4444'};">
      <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:8px;">
        Q${i + 1} · ${isCorrect ? '✅ Correct' : skipped ? '⏭ Skipped' : '❌ Incorrect'}
      </div>
      <p style="font-size:14px;font-weight:500;margin-bottom:12px;line-height:1.6;">${q.question_text || q.question}</p>
      ${q.image_url ? `<img src="${q.image_url}" alt="" style="max-width:100%;max-height:200px;border-radius:8px;margin-bottom:12px;object-fit:contain;">` : ''}
      <div class="grid grid-cols-2 gap-2 mb-3">
        ${['A', 'B', 'C', 'D'].map(l => `
          <div style="padding:8px 12px;border-radius:8px;font-size:13px;
            background:${l === q.correct_answer ? 'rgba(16,185,129,0.15)' : l === q.user_answer && !isCorrect ? 'rgba(239,68,68,0.1)' : 'var(--surface2)'};
            border:1px solid ${l === q.correct_answer ? 'rgba(16,185,129,0.4)' : l === q.user_answer && !isCorrect ? 'rgba(239,68,68,0.3)' : 'var(--border)'};
            color:${l === q.correct_answer ? '#10b981' : l === q.user_answer && !isCorrect ? '#ef4444' : 'var(--text)'};">
            <strong>${l}.</strong> ${q['option_' + l.toLowerCase()]}
          </div>`).join('')}
      </div>
      ${q.explanation ? `<div style="font-size:13px;color:#60a5fa;background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.2);border-radius:8px;padding:10px;line-height:1.6;"><strong>Explanation:</strong> ${q.explanation}</div>` : ''}
    </div>`;
  }).join('');
}

async function viewResultById(attemptId) {
  const { data: attempt } = await sb.from('test_attempts').select('*, test_series(name)').eq('id', attemptId).single();
  const { data: answers } = await sb.from('attempt_answers').select('*').eq('attempt_id', attemptId);
  let correct = 0, incorrect = 0, skipped = 0;
  (answers || []).forEach(a => { if (!a.user_answer) skipped++; else if (a.is_correct) correct++; else incorrect++; });
  showResultScreen({
    ...attempt,
    seriesName: attempt.test_series?.name || '—',
    correct, incorrect, skipped,
    total:      attempt.total_questions,
    percentage: attempt.percentage,
    timeTaken:  attempt.time_taken_secs,
    isPassed:   attempt.is_passed,
    questions:  answers || [],
  });
  showAnswerReview();
}

function closeResultScreen() {
  document.getElementById('result-screen').style.display = 'none';
  navigateTo('dashboard');
}
