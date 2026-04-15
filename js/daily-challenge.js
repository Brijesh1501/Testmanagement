// ============================================================
// daily-challenge.js — Daily Challenge: admin generates via Groq AI,
//                      students answer on dashboard, results saved to DB
// ============================================================

// ─── State ───────────────────────────────────────────────────
let dcState = null; // { questions, answers, currentIndex, startTime, submitted }

// ─── TABLE / DATE HELPERS ────────────────────────────────────
function todayKey() {
  return new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
}

// ─── LOAD DAILY CHALLENGE WIDGET (Dashboard) ─────────────────
async function loadDailyChallengeWidget() {
  const container = document.getElementById('daily-challenge-widget');
  if (!container) return;

  container.innerHTML = `<div style="color:var(--muted);font-size:13px;padding:8px 0;">Checking today's challenge…</div>`;

  const today = todayKey();

  // Fetch today's challenge
  const { data: challenge, error } = await sb
    .from('daily_challenges')
    .select('*')
    .eq('challenge_date', today)
    .eq('is_active', true)
    .single();

  if (error || !challenge) {
    container.innerHTML = `
      <div style="text-align:center;padding:32px 0;color:var(--muted);">
        <div style="font-size:36px;margin-bottom:12px;">🌅</div>
        <div style="font-size:14px;font-weight:600;margin-bottom:6px;color:var(--text);">No Challenge Today</div>
        <div style="font-size:12px;">Check back later — an admin will set today's challenge soon.</div>
      </div>`;
    return;
  }

  // Check if student already attempted today
  const { data: attempt } = await sb
    .from('daily_challenge_attempts')
    .select('*')
    .eq('challenge_id', challenge.id)
    .eq('user_id', currentUser.id)
    .single();

  if (attempt) {
    renderDailyChallengeResult(container, attempt, challenge);
    return;
  }

  // Fetch questions for this challenge
  const { data: questions } = await sb
    .from('daily_challenge_questions')
    .select('*')
    .eq('challenge_id', challenge.id)
    .order('order_index');

  if (!questions || !questions.length) {
    container.innerHTML = `<div style="color:var(--muted);font-size:13px;">Challenge has no questions yet.</div>`;
    return;
  }

  renderDailyChallengeStart(container, challenge, questions);
}

function renderDailyChallengeStart(container, challenge, questions) {
  const topics = (challenge.topics || []).join(', ');
  container.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:16px;">
      <div style="width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#f59e0b,#ef4444);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:20px;">⚡</div>
      <div style="flex:1;">
        <div style="font-size:16px;font-weight:800;margin-bottom:2px;">${challenge.title || 'Daily Challenge'}</div>
        <div style="font-size:12px;color:var(--muted);">${questions.length} questions · ${challenge.time_limit_minutes || 15} min · Topics: ${topics || 'General'}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:11px;color:var(--muted);">Streak 🔥</div>
        <div id="dc-streak-badge" style="font-size:18px;font-weight:800;color:#f59e0b;">—</div>
      </div>
    </div>
    <div style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);border-radius:10px;padding:12px 14px;margin-bottom:16px;font-size:12px;color:#fbbf24;line-height:1.6;">
      💡 <strong>AI-Generated</strong> — These questions were crafted by Groq AI based on today's topics. Complete the challenge to earn your streak!
    </div>
    <button onclick="startDailyChallenge()" class="btn-primary" style="width:100%;justify-content:center;background:linear-gradient(135deg,#f59e0b,#ef4444);">
      🚀 Start Today's Challenge
    </button>`;

  // Load streak async
  loadStudentStreak().then(streak => {
    const el = document.getElementById('dc-streak-badge');
    if (el) el.textContent = streak + ' day' + (streak !== 1 ? 's' : '');
  });

  // Store for use in startDailyChallenge
  window._dcChallenge  = challenge;
  window._dcQuestions  = questions;
}

function renderDailyChallengeResult(container, attempt, challenge) {
  const pct   = attempt.percentage;
  const color = pct >= 70 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
  const emoji = pct >= 70 ? '🏆' : pct >= 50 ? '👍' : '💪';

  container.innerHTML = `
    <div style="text-align:center;padding:8px 0 16px;">
      <div style="font-size:32px;margin-bottom:8px;">${emoji}</div>
      <div style="font-size:13px;color:var(--muted);margin-bottom:4px;">Today's Challenge Complete!</div>
      <div style="font-size:40px;font-weight:800;color:${color};">${pct}%</div>
      <div style="font-size:13px;color:var(--muted);margin-top:4px;">${attempt.score} / ${attempt.total_questions} correct</div>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:12px;">
      <div style="flex:1;background:var(--surface2);border-radius:10px;padding:10px;text-align:center;">
        <div style="font-size:18px;font-weight:800;color:#10b981;">${attempt.score}</div>
        <div style="font-size:10px;color:var(--muted);">Correct</div>
      </div>
      <div style="flex:1;background:var(--surface2);border-radius:10px;padding:10px;text-align:center;">
        <div style="font-size:18px;font-weight:800;color:#ef4444;">${attempt.total_questions - attempt.score}</div>
        <div style="font-size:10px;color:var(--muted);">Wrong</div>
      </div>
      <div style="flex:1;background:var(--surface2);border-radius:10px;padding:10px;text-align:center;">
        <div style="font-size:18px;font-weight:800;color:#f59e0b;" id="dc-streak-done">—</div>
        <div style="font-size:10px;color:var(--muted);">Day Streak</div>
      </div>
    </div>
    <button onclick="viewDailyChallengeReview('${attempt.id}')" class="btn-secondary" style="width:100%;justify-content:center;font-size:13px;">
      📋 Review Answers
    </button>`;

  loadStudentStreak().then(s => {
    const el = document.getElementById('dc-streak-done');
    if (el) el.textContent = s;
  });
}

async function loadStudentStreak() {
  const { data } = await sb
    .from('daily_challenge_attempts')
    .select('submitted_at')
    .eq('user_id', currentUser.id)
    .order('submitted_at', { ascending: false })
    .limit(60);
  if (!data || !data.length) return 0;

  const days  = new Set(data.map(a => new Date(a.submitted_at).toLocaleDateString('en-CA')));
  let streak  = 0;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d     = new Date(today);
  while (true) {
    if (!days.has(d.toLocaleDateString('en-CA'))) break;
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

// ─── START CHALLENGE (opens full-screen modal) ────────────────
function startDailyChallenge() {
  const challenge = window._dcChallenge;
  const questions = window._dcQuestions;
  if (!challenge || !questions) return;

  // Prevent the global modal-overlay backdrop-click handler (ui.js) from
  // closing dc-modal while a challenge is in progress.
  const dcModal = document.getElementById('dc-modal');
  if (dcModal) dcModal._dcProtected = true;

  dcState = {
    challenge,
    questions,
    answers:      new Array(questions.length).fill(null),
    currentIndex: 0,
    startTime:    Date.now(),
    totalSecs:    (challenge.time_limit_minutes || 15) * 60,
    remainingSecs:(challenge.time_limit_minutes || 15) * 60,
    timerHandle:  null,
    submitted:    false,
  };

  document.getElementById('dc-modal').style.display = 'flex';
  renderDCQuestion();
  buildDCPalette();
  startDCTimer();
}

// ─── RENDER QUESTION ─────────────────────────────────────────
function renderDCQuestion() {
  const { questions, answers, currentIndex } = dcState;
  const q     = questions[currentIndex];
  const total = questions.length;

  document.getElementById('dc-q-num').textContent      = `Q${currentIndex + 1} of ${total}`;
  document.getElementById('dc-q-text').textContent     = q.question_text;
  document.getElementById('dc-progress').style.width   = ((currentIndex + 1) / total * 100) + '%';
  document.getElementById('dc-title-bar').textContent  = dcState.challenge.title || 'Daily Challenge';

  const opts = document.getElementById('dc-options');
  opts.innerHTML = ['A', 'B', 'C', 'D'].map(l => {
    const selected = answers[currentIndex] === l;
    return `<button class="dc-option ${selected ? 'selected' : ''}" onclick="selectDCAnswer('${l}')">
      <span class="dc-option-label" style="${selected ? 'background:var(--accent);color:#fff;' : ''}">${l}</span>
      <span>${q['option_' + l.toLowerCase()]}</span>
    </button>`;
  }).join('');

  const isLast = currentIndex === total - 1;
  document.getElementById('dc-next-btn').style.display   = isLast ? 'none' : '';
  document.getElementById('dc-submit-btn').style.display = isLast ? '' : 'none';
  document.getElementById('dc-prev-btn').disabled        = currentIndex === 0;

  // Update palette
  updateDCPaletteActive();
}

function selectDCAnswer(letter) {
  if (dcState.submitted) return;
  dcState.answers[dcState.currentIndex] = letter;
  renderDCQuestion();
}

function dcNext() { if (dcState.currentIndex < dcState.questions.length - 1) { dcState.currentIndex++; renderDCQuestion(); } }
function dcPrev() { if (dcState.currentIndex > 0) { dcState.currentIndex--; renderDCQuestion(); } }
function dcJump(i) { dcState.currentIndex = i; renderDCQuestion(); }

function buildDCPalette() {
  document.getElementById('dc-palette').innerHTML = dcState.questions.map((_, i) =>
    `<button class="dc-pal-btn" id="dcp-${i}" onclick="dcJump(${i})">${i + 1}</button>`
  ).join('');
}

function updateDCPaletteActive() {
  dcState.questions.forEach((_, i) => {
    const btn = document.getElementById('dcp-' + i);
    if (!btn) return;
    btn.className = 'dc-pal-btn';
    if (i === dcState.currentIndex) btn.classList.add('current');
    else if (dcState.answers[i])    btn.classList.add('answered');
  });
}

// ─── TIMER ───────────────────────────────────────────────────
function startDCTimer() {
  if (dcState.timerHandle) clearInterval(dcState.timerHandle);
  updateDCTimerDisplay();
  dcState.timerHandle = setInterval(() => {
    dcState.remainingSecs--;
    updateDCTimerDisplay();
    if (dcState.remainingSecs <= 0) {
      clearInterval(dcState.timerHandle);
      submitDailyChallenge(true);
    }
  }, 1000);
}

function updateDCTimerDisplay() {
  const s  = dcState.remainingSecs;
  const m  = Math.floor(s / 60);
  const ss = s % 60;
  const el = document.getElementById('dc-timer');
  if (!el) return;
  el.textContent = `${m}:${ss.toString().padStart(2, '0')}`;
  el.style.color = s <= 60 ? '#ef4444' : s <= 300 ? '#f59e0b' : 'var(--text)';
}

// ─── TIMEOUT HELPER ──────────────────────────────────────────
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timed out: ${label}`)), ms)
    ),
  ]);
}

// ─── SUBMIT ──────────────────────────────────────────────────
function confirmDCSubmit() {
  if (dcState.submitted) return;
  const answered   = dcState.answers.filter(a => a !== null).length;
  const unanswered = dcState.questions.length - answered;

  // Use an inline banner instead of the shared confirm-modal.
  // The shared modal-overlay click handler (ui.js) closes dc-modal on backdrop
  // clicks, which races with submitDailyChallenge and causes the "stuck" bug.
  const existing = document.getElementById('dc-inline-confirm');
  if (existing) { existing.remove(); return; }

  const msg = unanswered > 0
    ? `⚠️ ${unanswered} question${unanswered > 1 ? 's' : ''} unanswered. Submit anyway?`
    : '✅ All questions answered. Submit?';

  const banner = document.createElement('div');
  banner.id = 'dc-inline-confirm';
  banner.style.cssText = [
    'position:fixed', 'bottom:24px', 'left:50%', 'transform:translateX(-50%)',
    'background:var(--surface)', 'border:1px solid var(--border)', 'border-radius:14px',
    'padding:16px 20px', 'display:flex', 'align-items:center', 'gap:14px',
    'box-shadow:0 8px 32px rgba(0,0,0,.4)', 'z-index:10000',
    'font-size:14px', 'font-family:Sora,sans-serif', 'max-width:92vw'
  ].join(';');
  banner.innerHTML = `
    <span style="flex:1;line-height:1.5;">${msg}</span>
    <button id="dc-confirm-cancel-btn" style="padding:8px 16px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);cursor:pointer;font-size:13px;font-family:Sora,sans-serif;white-space:nowrap;">Cancel</button>
    <button id="dc-confirm-ok-btn" style="padding:8px 16px;border-radius:8px;border:none;background:linear-gradient(135deg,#f59e0b,#ef4444);color:#fff;cursor:pointer;font-size:13px;font-weight:700;font-family:Sora,sans-serif;white-space:nowrap;">Submit ✓</button>
  `;
  document.body.appendChild(banner);

  document.getElementById('dc-confirm-cancel-btn').onclick = () => banner.remove();
  document.getElementById('dc-confirm-ok-btn').onclick = () => {
    banner.remove();
    submitDailyChallenge(false);
  };
}

async function submitDailyChallenge(timeUp = false) {
  if (dcState.submitted) return;
  clearInterval(dcState.timerHandle);

  const { questions, answers, startTime, challenge } = dcState;
  let correct = 0;
  questions.forEach((q, i) => { if (answers[i] === q.correct_answer) correct++; });

  const timeTaken  = Math.floor((Date.now() - startTime) / 1000);
  const pct        = +(correct / questions.length * 100).toFixed(2);

  // Disable submit button and show saving state
  const submitBtn = document.getElementById('dc-submit-btn');
  const bottomSubmit = document.getElementById('dc-sidebar-submit-btn');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Saving…'; }
  if (bottomSubmit) { bottomSubmit.disabled = true; bottomSubmit.textContent = 'Saving…'; }

  try {
    // INSERT the attempt (no .select() here — avoids 406 when SELECT RLS differs from INSERT RLS)
    const { error: insertErr } = await withTimeout(
      sb.from('daily_challenge_attempts')
        .insert({
          challenge_id:    challenge.id,
          user_id:         currentUser.id,
          score:           correct,
          total_questions: questions.length,
          percentage:      pct,
          time_taken_secs: timeTaken,
        }),
      10000, 'saving attempt'
    );
    if (insertErr) throw new Error('Could not save attempt: ' + insertErr.message);

    // Fetch back the attempt we just inserted so we have its ID
    const { data: attempt, error: fetchErr } = await withTimeout(
      sb.from('daily_challenge_attempts')
        .select()
        .eq('challenge_id', challenge.id)
        .eq('user_id', currentUser.id)
        .order('submitted_at', { ascending: false })
        .limit(1)
        .single(),
      10000, 'fetching attempt'
    );
    if (fetchErr) throw new Error('Attempt saved but could not fetch it back: ' + fetchErr.message);

    // Save per-question answers (non-blocking — don't let this prevent showing results)
    try {
      const { error: ansErr } = await withTimeout(
        sb.from('daily_challenge_answers').insert(
          questions.map((q, i) => ({
            attempt_id:      attempt.id,
            question_id:     q.id,
            user_answer:     answers[i] || null,
            correct_answer:  q.correct_answer,
            is_correct:      answers[i] === q.correct_answer,
          }))
        ),
        10000, 'saving answers'
      );
      if (ansErr) console.warn('Answers save warning:', ansErr.message);
    } catch (ansEx) {
      console.warn('Answers save failed (non-fatal):', ansEx.message);
    }

    // Mark submitted only on success
    dcState.submitted = true;

    // Close challenge modal, show result modal
    const dcModalEl = document.getElementById('dc-modal');
    if (dcModalEl) dcModalEl._dcProtected = false;
    dcModalEl.style.display = 'none';
    showDCResultModal(attempt, questions, answers);
    loadDailyChallengeWidget();

  } catch (err) {
    // Re-enable buttons so user can retry
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Submit'; }
    if (bottomSubmit) { bottomSubmit.disabled = false; bottomSubmit.textContent = 'Submit ✓'; }
    showToast('❌ ' + err.message, 'error');
    console.error('submitDailyChallenge error:', err);
  }
}

function showDCResultModal(attempt, questions, answers) {
  const pct   = attempt.percentage;
  const color = pct >= 70 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
  const emoji = pct >= 70 ? '🏆' : pct >= 50 ? '👍' : '💪';
  const wrong = attempt.total_questions - attempt.score;

  const reviewHtml = questions.map((q, i) => {
    const isCorrect = answers[i] === q.correct_answer;
    const skipped   = !answers[i];
    return `
    <div style="padding:14px;background:var(--surface2);border-radius:10px;border-left:3px solid ${isCorrect ? '#10b981' : skipped ? '#f59e0b' : '#ef4444'};">
      <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:6px;">Q${i + 1} · ${isCorrect ? '✅ Correct' : skipped ? '⏭ Skipped' : '❌ Wrong'}</div>
      <div style="font-size:13px;font-weight:500;margin-bottom:10px;line-height:1.6;">${q.question_text}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
        ${['A','B','C','D'].map(l => `
          <div style="padding:6px 10px;border-radius:6px;font-size:12px;
            background:${l === q.correct_answer ? 'rgba(16,185,129,.15)' : l === answers[i] && !isCorrect ? 'rgba(239,68,68,.1)' : 'rgba(30,45,69,.5)'};
            border:1px solid ${l === q.correct_answer ? 'rgba(16,185,129,.4)' : l === answers[i] && !isCorrect ? 'rgba(239,68,68,.3)' : 'rgba(30,45,69,.6)'};
            color:${l === q.correct_answer ? '#10b981' : l === answers[i] && !isCorrect ? '#ef4444' : 'var(--muted)'};">
            <strong>${l}.</strong> ${q['option_' + l.toLowerCase()]}
          </div>`).join('')}
      </div>
      ${q.explanation ? `<div style="margin-top:8px;padding:8px 10px;border-radius:7px;background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.2);font-size:12px;color:#60a5fa;line-height:1.5;"><strong>💡</strong> ${q.explanation}</div>` : ''}
    </div>`;
  }).join('');

  document.getElementById('dc-result-pct').textContent   = pct + '%';
  document.getElementById('dc-result-pct').style.color   = color;
  document.getElementById('dc-result-emoji').textContent = emoji;
  document.getElementById('dc-res-correct').textContent  = attempt.score;
  document.getElementById('dc-res-wrong').textContent    = wrong;
  document.getElementById('dc-res-time').textContent     = fmtDuration(attempt.time_taken_secs);
  document.getElementById('dc-review-list').innerHTML    = reviewHtml;
  document.getElementById('dc-result-modal').style.display = 'flex';
}

async function viewDailyChallengeReview(attemptId) {
  const { data: attempt }  = await sb.from('daily_challenge_attempts').select('*').eq('id', attemptId).single();
  const { data: answerRows } = await sb.from('daily_challenge_answers').select('*, daily_challenge_questions(*)').eq('attempt_id', attemptId);

  if (!attempt || !answerRows) return;

  const questions = answerRows.map(a => a.daily_challenge_questions);
  const answers   = answerRows.map(a => a.user_answer);

  showDCResultModal(attempt, questions, answers);
}

// ─── ADMIN: DAILY CHALLENGE PAGE ─────────────────────────────
async function loadAdminDailyChallenge() {
  document.getElementById('admin-dc-loading').style.display = '';
  document.getElementById('admin-dc-content').style.display = 'none';

  // Load all challenges ordered by date desc (includes future scheduled ones)
  const { data: challenges } = await sb
    .from('daily_challenges')
    .select('*')
    .order('challenge_date', { ascending: false })
    .limit(60);

  document.getElementById('admin-dc-loading').style.display = 'none';
  document.getElementById('admin-dc-content').style.display = '';

  const today          = todayKey();
  const todayChallenge = (challenges || []).find(c => c.challenge_date === today);
  const upcoming = (challenges || []).filter(c => c.challenge_date > today).sort((a,b) => a.challenge_date.localeCompare(b.challenge_date));

  // Today status banner
  const statusBanner = document.getElementById('admin-dc-status');
  let bannerHtml = '';
  if (todayChallenge) {
    bannerHtml += `
      <div style="background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.3);border-radius:12px;padding:16px 20px;display:flex;align-items:center;gap:16px;margin-bottom:16px;">
        <div style="width:40px;height:40px;border-radius:50%;background:rgba(16,185,129,.2);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">✅</div>
        <div style="flex:1;">
          <div style="font-size:14px;font-weight:700;color:#10b981;">Today's challenge is live!</div>
          <div style="font-size:12px;color:var(--muted);">${todayChallenge.title} · Topics: ${(todayChallenge.topics||[]).join(', ')}</div>
        </div>
        <button onclick="openDCEditModal('${todayChallenge.id}')" class="btn-success" style="font-size:12px;padding:8px 14px;">Edit</button>
        <button onclick="deleteDailyChallenge('${todayChallenge.id}')" class="btn-danger" style="font-size:12px;padding:8px 14px;">Delete</button>
      </div>`;
  } else {
    bannerHtml += `
      <div style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.25);border-radius:12px;padding:16px 20px;display:flex;align-items:center;gap:16px;margin-bottom:16px;">
        <div style="width:40px;height:40px;border-radius:50%;background:rgba(245,158,11,.15);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">⚠️</div>
        <div style="flex:1;font-size:14px;font-weight:600;color:#fbbf24;">No challenge set for today. Generate one below!</div>
      </div>`;
  }

  if (upcoming.length) {
    bannerHtml += `
      <div style="background:rgba(59,130,246,.07);border:1px solid rgba(59,130,246,.2);border-radius:12px;padding:14px 18px;margin-bottom:16px;">
        <div style="font-size:12px;font-weight:700;color:#60a5fa;margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px;">📅 Upcoming Scheduled (${upcoming.length})</div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${upcoming.map(c => `
            <div style="display:flex;align-items:center;gap:12px;padding:8px 10px;background:var(--surface2);border-radius:8px;">
              <div style="font-size:12px;font-weight:700;color:#60a5fa;min-width:80px;">${c.challenge_date}</div>
              <div style="flex:1;font-size:13px;font-weight:600;">${c.title}</div>
              <div style="font-size:11px;color:var(--muted);">${c.question_count}Q · ${(c.topics||[]).slice(0,2).join(', ')}</div>
              <span class="badge ${c.is_active ? 'badge-green' : ''}" style="${!c.is_active ? 'background:rgba(245,158,11,.12);color:#fbbf24;border:1px solid rgba(245,158,11,.3);' : ''}">${c.is_active ? 'Active' : '📅 Scheduled'}</span>
              <button onclick="openDCEditModal('${c.id}')" class="btn-success" style="font-size:11px;padding:5px 10px;">Edit</button>
              ${!c.is_active ? `<button onclick="activateDailyChallenge('${c.id}')" class="btn-primary" style="font-size:11px;padding:5px 10px;">Activate Now</button>` : ''}
              <button onclick="deleteDailyChallenge('${c.id}')" class="btn-danger" style="font-size:11px;padding:5px 10px;">✕</button>
            </div>`).join('')}
        </div>
      </div>`;
  }
  statusBanner.innerHTML = bannerHtml;

  // Past challenges table
  const pastEl = document.getElementById('admin-dc-past');
  pastEl.innerHTML = (challenges || []).length ? `
    <table class="data-table">
      <thead><tr><th>Date</th><th>Title</th><th>Topics</th><th>Questions</th><th>Attempts</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>
        ${(challenges || []).map(c => {
          const isToday    = c.challenge_date === today;
          const isFuture   = c.challenge_date > today;
          const statusBadge = c.is_active
            ? (isToday ? `<span class="badge badge-green">Live Today</span>` : isFuture ? `<span class="badge" style="background:rgba(59,130,246,.15);color:#60a5fa;border:1px solid rgba(59,130,246,.3);">Active</span>` : `<span class="badge badge-green">Active</span>`)
            : (isFuture ? `<span class="badge" style="background:rgba(245,158,11,.12);color:#fbbf24;border:1px solid rgba(245,158,11,.3);">📅 Scheduled</span>` : `<span class="badge badge-red">Inactive</span>`);
          return `
        <tr>
          <td class="mono" style="font-size:12px;">${c.challenge_date}${isFuture ? ' <span style="font-size:10px;color:#f59e0b;">future</span>' : ''}</td>
          <td style="font-size:13px;font-weight:600;">${c.title || '—'}</td>
          <td style="font-size:12px;color:var(--muted);">${(c.topics||[]).slice(0,3).join(', ')}${(c.topics||[]).length > 3 ? '…' : ''}</td>
          <td style="font-size:13px;">${c.question_count || 20}</td>
          <td><span id="dc-att-${c.id}" style="font-size:13px;color:var(--muted);">—</span></td>
          <td>${statusBadge}</td>
          <td>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <button onclick="openDCEditModal('${c.id}')" class="btn-success" style="font-size:11px;padding:6px 10px;">Edit</button>
              ${!c.is_active
                ? `<button onclick="activateDailyChallenge('${c.id}')" class="btn-primary" style="font-size:11px;padding:6px 10px;">Activate</button>`
                : `<button onclick="deactivateDailyChallenge('${c.id}')" class="btn-secondary" style="font-size:11px;padding:6px 10px;">Deactivate</button>`}
              <button onclick="deleteDailyChallenge('${c.id}')" class="btn-danger" style="font-size:11px;padding:6px 10px;">Delete</button>
            </div>
          </td>
        </tr>`;}).join('')}
      </tbody>
    </table>` : `<div style="text-align:center;padding:40px;color:var(--muted);">No challenges yet. Create your first one!</div>`;

  // Load attempt counts async
  (challenges || []).forEach(async c => {
    const { count } = await sb.from('daily_challenge_attempts').select('*', { count: 'exact', head: true }).eq('challenge_id', c.id);
    const el = document.getElementById('dc-att-' + c.id);
    if (el) el.textContent = count || 0;
  });
}

// ─── ADMIN: OPEN GENERATE MODAL ──────────────────────────────
function openDCGenerateModal() {
  document.getElementById('dc-gen-title').value    = '';
  document.getElementById('dc-gen-topics').value   = '';
  document.getElementById('dc-gen-date').value     = todayKey();
  document.getElementById('dc-gen-count').value    = '20';
  document.getElementById('dc-gen-time').value     = '15';
  document.getElementById('dc-gen-difficulty').value = 'medium';
  document.getElementById('dc-gen-status').style.display = 'none';
  delete document.getElementById('dc-generate-modal').dataset.editId;
  updateDCScheduleHint();
  document.getElementById('dc-generate-modal').style.display = 'flex';
}

async function openDCEditModal(challengeId) {
  const { data: c } = await sb.from('daily_challenges').select('*').eq('id', challengeId).single();
  if (!c) return;
  document.getElementById('dc-gen-title').value    = c.title || '';
  document.getElementById('dc-gen-topics').value   = (c.topics || []).join(', ');
  document.getElementById('dc-gen-date').value     = c.challenge_date;
  document.getElementById('dc-gen-count').value    = c.question_count || 20;
  document.getElementById('dc-gen-time').value     = c.time_limit_minutes || 15;
  document.getElementById('dc-gen-difficulty').value = c.difficulty || 'medium';
  document.getElementById('dc-gen-status').style.display = 'none';
  document.getElementById('dc-generate-modal').dataset.editId = challengeId;
  updateDCScheduleHint();
  document.getElementById('dc-generate-modal').style.display = 'flex';
}

// ─── SCHEDULE HINT (shown next to date picker) ───────────────
function updateDCScheduleHint() {
  const hintEl = document.getElementById('dc-schedule-hint');
  const infoBox = document.getElementById('dc-scheduling-info');
  const date  = document.getElementById('dc-gen-date')?.value;
  const today = todayKey();
  if (!date) {
    if (hintEl) hintEl.textContent = '';
    if (infoBox) infoBox.style.display = 'none';
    return;
  }
  const isFuture = date > today;
  const isToday  = date === today;

  if (hintEl) {
    if (isToday) {
      hintEl.innerHTML = `<span style="color:#10b981;">✅ Goes live today</span>`;
    } else if (isFuture) {
      hintEl.innerHTML = `<span style="color:#f59e0b;">📅 Scheduling for future date — saved as inactive</span>`;
    } else {
      hintEl.innerHTML = `<span style="color:#60a5fa;">📋 Backdated — will be saved as active</span>`;
    }
  }
  if (infoBox) infoBox.style.display = isFuture ? '' : 'none';
}

// ─── ACTIVATE SCHEDULED CHALLENGE ────────────────────────────
async function activateDailyChallenge(id) {
  const { error } = await sb.from('daily_challenges').update({ is_active: true }).eq('id', id);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  showToast('Challenge activated!', 'success');
  loadAdminDailyChallenge();
}

async function deactivateDailyChallenge(id) {
  const { error } = await sb.from('daily_challenges').update({ is_active: false }).eq('id', id);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  showToast('Challenge deactivated.', 'info');
  loadAdminDailyChallenge();
}
async function generateDailyChallenge(e) {
  e.preventDefault();

  const title      = document.getElementById('dc-gen-title').value.trim() || 'Daily Challenge';
  const topicsRaw  = document.getElementById('dc-gen-topics').value.trim();
  const date       = document.getElementById('dc-gen-date').value;
  const count      = parseInt(document.getElementById('dc-gen-count').value) || 20;
  const timeLim    = parseInt(document.getElementById('dc-gen-time').value) || 15;
  const difficulty = document.getElementById('dc-gen-difficulty').value;
  const grokKey    = document.getElementById('dc-groq-key').value.trim();
  const editId     = document.getElementById('dc-generate-modal').dataset.editId || '';
  const today      = todayKey();
  const isScheduled = date > today; // future date = scheduled (inactive until that day)

  if (!topicsRaw) { showToast('Please enter at least one topic.', 'error'); return; }
  if (!grokKey)   { showToast('Please enter your Groq API key.', 'error'); return; }

  const topics = topicsRaw.split(',').map(t => t.trim()).filter(Boolean);

  const statusEl = document.getElementById('dc-gen-status');
  const genBtn   = document.getElementById('dc-gen-btn');

  statusEl.style.display = '';
  statusEl.innerHTML = `<div class="dc-gen-status-row">
    <div class="pulse-dot" style="background:#3b82f6;"></div>
    <span>Connecting to Groq AI…</span>
  </div>`;
  genBtn.disabled = true;

  // Helper: call Groq for a single batch of N questions
  async function fetchQuestionBatch(batchCount, batchNum, totalBatches) {
    const prompt = `You are a professional MCQ question generator for NORCET, AIIMS, and NCLEX nursing exams.

Generate exactly ${batchCount} MCQ questions on these topics: ${topics.join(', ')}.
Difficulty: ${difficulty} (easy=foundational, medium=application, hard=clinical reasoning).

Respond with ONLY valid JSON — no markdown, no extra text, no truncation:
{"questions":[{"question_text":"...","option_a":"...","option_b":"...","option_c":"...","option_d":"...","correct_answer":"A","explanation":"1-2 sentence explanation.","topic":"topic name"}]}

Rules:
- Exactly 4 options per question (A/B/C/D)
- correct_answer must be exactly "A", "B", "C", or "D"
- Keep explanations SHORT (1 sentence max) to avoid truncation
- Clinically accurate, exam-relevant
- Generate exactly ${batchCount} questions, no more, no less`;

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${grokKey}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'You are an expert MCQ generator. Output ONLY valid compact JSON. Never truncate.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Groq API error ${res.status}: ${errText}`);
    }
    const data = await res.json();
    const rawText = data.choices?.[0]?.message?.content || '';
    const cleaned = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    let parsed;
    try { parsed = JSON.parse(cleaned); }
    catch (pe) {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (!match) throw new Error(`Batch ${batchNum}: Could not parse JSON from Groq. Response may be truncated. Try fewer questions.`);
      try { parsed = JSON.parse(match[0]); }
      catch (pe2) { throw new Error(`Batch ${batchNum}: Malformed JSON from Groq. Try reducing question count.`); }
    }
    return parsed.questions || parsed;
  }

  try {
    // Split into batches of 10 max to avoid token truncation
    const BATCH_SIZE = 10;
    const batches = [];
    let remaining = count;
    while (remaining > 0) {
      batches.push(Math.min(remaining, BATCH_SIZE));
      remaining -= BATCH_SIZE;
    }

    const allQuestions = [];
    for (let i = 0; i < batches.length; i++) {
      statusEl.innerHTML = `<div class="dc-gen-status-row"><div class="pulse-dot" style="background:#f59e0b;"></div><span>Groq AI generating batch ${i+1}/${batches.length} (${batches[i]} questions)…</span></div>`;
      const batchQs = await fetchQuestionBatch(batches[i], i+1, batches.length);
      allQuestions.push(...batchQs);
      // Small delay between batches to respect rate limits
      if (i < batches.length - 1) await new Promise(r => setTimeout(r, 800));
    }

    statusEl.innerHTML = `<div class="dc-gen-status-row"><div class="pulse-dot" style="background:#10b981;"></div><span>Validating ${allQuestions.length} questions…</span></div>`;

    const questions = allQuestions;
    if (!Array.isArray(questions) || !questions.length) throw new Error('No questions in response');

    // Validate
    const valid = questions.filter(q =>
      q.question_text && q.option_a && q.option_b && q.option_c && q.option_d &&
      ['A','B','C','D'].includes((q.correct_answer || '').toUpperCase())
    ).map(q => ({ ...q, correct_answer: q.correct_answer.toUpperCase() }));

    if (!valid.length) throw new Error('No valid questions generated');

    statusEl.innerHTML = `<div class="dc-gen-status-row"><div class="pulse-dot" style="background:#10b981;"></div><span>Saving challenge… (1/2: creating challenge record)</span></div>`;

    // Save to Supabase — with progress callback to keep UI alive
    const updateStatus = (msg) => {
      statusEl.innerHTML = `<div class="dc-gen-status-row"><div class="pulse-dot" style="background:#10b981;"></div><span>${msg}</span></div>`;
    };
    await saveDailyChallenge({ title, topics, date, count: valid.length, timeLim, difficulty, questions: valid, editId, isScheduled, onProgress: updateStatus });

    const liveMsg = isScheduled
      ? `📅 Scheduled! ${valid.length} questions ready for ${date}.`
      : `🎉 ${valid.length} questions saved! Challenge is live for ${date}.`;
    statusEl.innerHTML = `<div class="dc-gen-status-row" style="color:#10b981;"><span>✅ ${liveMsg}</span></div>`;
    showToast(isScheduled ? `Challenge scheduled for ${date}!` : `Daily challenge created with ${valid.length} AI questions!`, 'success');

    setTimeout(() => {
      closeModal('dc-generate-modal');
      delete document.getElementById('dc-generate-modal').dataset.editId;
      loadAdminDailyChallenge();
    }, 1800);

  } catch (err) {
    statusEl.innerHTML = `<div class="dc-gen-status-row" style="color:#ef4444;"><span>❌ ${err.message}</span></div>`;
    showToast('Generation failed: ' + err.message, 'error');
  } finally {
    genBtn.disabled = false;
  }
}

// Wraps a promise with a timeout so Supabase hangs don't freeze the UI forever
function withTimeout(promise, ms, label) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Timed out after ${ms/1000}s: ${label}. Check Supabase RLS policies — the admin user may not have INSERT permission on daily_challenges.`)), ms)
  );
  return Promise.race([promise, timeout]);
}

async function saveDailyChallenge({ title, topics, date, count, timeLim, difficulty, questions, editId, isScheduled = false, onProgress = () => {} }) {
  let challengeId = editId;

  if (editId) {
    // Update existing
    const { error } = await withTimeout(
      sb.from('daily_challenges').update({
        title, topics, challenge_date: date, question_count: questions.length,
        time_limit_minutes: timeLim, difficulty,
        is_active: isScheduled ? false : true,
      }).eq('id', editId),
      10000, 'updating daily_challenges'
    );
    if (error) throw new Error('DB update failed: ' + error.message + '. Check Supabase RLS policies.');
    // Delete old questions
    await withTimeout(
      sb.from('daily_challenge_questions').delete().eq('challenge_id', editId),
      10000, 'deleting old questions'
    );
  } else {
    // Insert new — do NOT chain .select().single() here.
    // Supabase executes a SELECT after INSERT to return the row, and when the
    // admin's SELECT policy uses USING (rather than WITH CHECK) it can fire
    // *before* the row is committed, causing a timeout / RLS block.
    // Instead we insert, then do a separate SELECT to retrieve the new id.
    const { error: insertErr } = await withTimeout(
      sb.from('daily_challenges').insert({
        title, topics, challenge_date: date, question_count: questions.length,
        time_limit_minutes: timeLim, difficulty,
        is_active: isScheduled ? false : true,
        scheduled_for: isScheduled ? date : null,
        created_by: currentUser?.id,
      }),
      15000, 'inserting daily_challenges'
    );
    if (insertErr) throw new Error('DB insert failed: ' + insertErr.message + '. Check Supabase RLS — admin needs INSERT on daily_challenges. Try the SQL fix below.');

    // Now fetch back the row we just inserted to get its id
    const { data: newRow, error: fetchErr } = await withTimeout(
      sb.from('daily_challenges')
        .select('id')
        .eq('challenge_date', date)
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
      10000, 'fetching new challenge id'
    );
    if (fetchErr || !newRow) throw new Error('Challenge inserted but could not retrieve its id: ' + (fetchErr?.message || 'no row'));
    challengeId = newRow.id;
  }

  // Insert questions in batches of 10 to avoid payload limits
  const rows = questions.map((q, i) => ({
    challenge_id:   challengeId,
    question_text:  q.question_text,
    option_a:       q.option_a,
    option_b:       q.option_b,
    option_c:       q.option_c,
    option_d:       q.option_d,
    correct_answer: q.correct_answer,
    explanation:    q.explanation || '',
    topic:          q.topic || '',
    order_index:    i,
  }));

  // Batch insert in chunks of 10
  const chunkSize = 10;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    onProgress(`Saving questions… (${Math.min(i + chunkSize, rows.length)}/${rows.length})`);
    const { error: qErr } = await withTimeout(
      sb.from('daily_challenge_questions').insert(chunk),
      10000, `inserting questions batch ${Math.floor(i/chunkSize)+1}`
    );
    if (qErr) throw new Error('Question insert failed: ' + qErr.message + '. Check Supabase RLS policies on daily_challenge_questions.');
  }
}

async function deleteDailyChallenge(id) {
  showConfirm('Delete Challenge', 'Delete this daily challenge and all its questions?', async () => {
    await sb.from('daily_challenge_questions').delete().eq('challenge_id', id);
    await sb.from('daily_challenge_attempts').delete().eq('challenge_id', id);
    await sb.from('daily_challenges').delete().eq('id', id);
    showToast('Challenge deleted.', 'success');
    loadAdminDailyChallenge();
  }, '🗑️');
}

// ─── SQL SCHEMA HELPER (shown in modal) ──────────────────────
function showDCSchemaSql() {
  const sql = `-- Run this in your Supabase SQL Editor:

CREATE TABLE IF NOT EXISTS daily_challenges (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title             text NOT NULL DEFAULT 'Daily Challenge',
  topics            text[] NOT NULL DEFAULT '{}',
  challenge_date    date NOT NULL UNIQUE,
  question_count    int  NOT NULL DEFAULT 20,
  time_limit_minutes int NOT NULL DEFAULT 15,
  difficulty        text NOT NULL DEFAULT 'medium',
  is_active         boolean NOT NULL DEFAULT true,
  scheduled_for     date,
  created_by        uuid REFERENCES auth.users(id),
  created_at        timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS daily_challenge_questions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id    uuid REFERENCES daily_challenges(id) ON DELETE CASCADE,
  question_text   text NOT NULL,
  option_a        text NOT NULL,
  option_b        text NOT NULL,
  option_c        text NOT NULL,
  option_d        text NOT NULL,
  correct_answer  char(1) NOT NULL,
  explanation     text DEFAULT '',
  topic           text DEFAULT '',
  order_index     int  DEFAULT 0
);

CREATE TABLE IF NOT EXISTS daily_challenge_attempts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id    uuid REFERENCES daily_challenges(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES auth.users(id),
  score           int  NOT NULL,
  total_questions int  NOT NULL,
  percentage      numeric(5,2) NOT NULL,
  time_taken_secs int,
  submitted_at    timestamptz DEFAULT now(),
  UNIQUE(challenge_id, user_id)
);

CREATE TABLE IF NOT EXISTS daily_challenge_answers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id      uuid REFERENCES daily_challenge_attempts(id) ON DELETE CASCADE,
  question_id     uuid REFERENCES daily_challenge_questions(id),
  user_answer     char(1),
  correct_answer  char(1) NOT NULL,
  is_correct      boolean NOT NULL DEFAULT false
);

-- Enable RLS
ALTER TABLE daily_challenges           ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_challenge_questions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_challenge_attempts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_challenge_answers    ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES  (safe to re-run — drops first)
-- ============================================================

-- Helper: is the current user an admin?
-- (checks your profiles table where role = 'admin')
-- ============================================================

-- daily_challenges
DROP POLICY IF EXISTS "Anyone can read active challenges"  ON daily_challenges;
DROP POLICY IF EXISTS "Admins manage challenges"           ON daily_challenges;
DROP POLICY IF EXISTS "Admins select challenges"           ON daily_challenges;
DROP POLICY IF EXISTS "Admins insert challenges"           ON daily_challenges;
DROP POLICY IF EXISTS "Admins update challenges"           ON daily_challenges;
DROP POLICY IF EXISTS "Admins delete challenges"           ON daily_challenges;

CREATE POLICY "Anyone can read active challenges"
  ON daily_challenges FOR SELECT USING (is_active = true);

-- Split ALL into explicit INSERT/UPDATE/DELETE so WITH CHECK works on INSERT
CREATE POLICY "Admins insert challenges"
  ON daily_challenges FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins update challenges"
  ON daily_challenges FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins delete challenges"
  ON daily_challenges FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins select challenges"
  ON daily_challenges FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- daily_challenge_questions
DROP POLICY IF EXISTS "Anyone can read challenge questions" ON daily_challenge_questions;
DROP POLICY IF EXISTS "Admins manage questions"             ON daily_challenge_questions;
DROP POLICY IF EXISTS "Admins insert questions"             ON daily_challenge_questions;
DROP POLICY IF EXISTS "Admins update questions"             ON daily_challenge_questions;
DROP POLICY IF EXISTS "Admins delete questions"             ON daily_challenge_questions;

CREATE POLICY "Anyone can read challenge questions"
  ON daily_challenge_questions FOR SELECT USING (true);

CREATE POLICY "Admins insert questions"
  ON daily_challenge_questions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins update questions"
  ON daily_challenge_questions FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins delete questions"
  ON daily_challenge_questions FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- daily_challenge_attempts
DROP POLICY IF EXISTS "Users see own attempts"    ON daily_challenge_attempts;
DROP POLICY IF EXISTS "Users insert own attempts" ON daily_challenge_attempts;
DROP POLICY IF EXISTS "Admins see all attempts"   ON daily_challenge_attempts;

CREATE POLICY "Users see own attempts"
  ON daily_challenge_attempts FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users insert own attempts"
  ON daily_challenge_attempts FOR INSERT WITH CHECK (user_id = auth.uid());

-- Admins can see all attempts (for analytics)
CREATE POLICY "Admins see all attempts"
  ON daily_challenge_attempts FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- daily_challenge_answers
DROP POLICY IF EXISTS "Admins see all answers" ON daily_challenge_answers;

-- daily_challenge_answers
DROP POLICY IF EXISTS "Users see own answers"    ON daily_challenge_answers;
DROP POLICY IF EXISTS "Users insert own answers" ON daily_challenge_answers;

CREATE POLICY "Users see own answers"
  ON daily_challenge_answers FOR SELECT USING (
    EXISTS (SELECT 1 FROM daily_challenge_attempts WHERE id = attempt_id AND user_id = auth.uid())
  );

CREATE POLICY "Users insert own answers"
  ON daily_challenge_answers FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM daily_challenge_attempts WHERE id = attempt_id AND user_id = auth.uid())
  );

-- ============================================================
-- VERIFY your admin user has role = 'admin' in profiles:
-- SELECT id, email, role FROM profiles WHERE role = 'admin';
-- If empty, run:
-- UPDATE profiles SET role = 'admin' WHERE email = 'your@email.com';
-- ============================================================`;

  const blob = new Blob([sql], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'daily_challenge_schema.sql';
  a.click();
  URL.revokeObjectURL(url);
  showToast('SQL schema downloaded!', 'success');
}