// ============================================================
// OmegaTest — app.js
// Features: image questions, smart PDF batch split, admin
//           rename series/categories, admin-controlled duration,
//           50-question batches, Supabase Storage image upload,
//           Format 3 NCLEX/Rationale PDF parser,
//           DOCX import support (via mammoth.js)
// ============================================================

// ─── CONFIGURATION ───────────────────────────────────────────
const SUPABASE_URL      = 'https://boefgqdudwpflltdxgav.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvZWZncWR1ZHdwZmxsdGR4Z2F2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzODk5ODYsImV4cCI6MjA5MDk2NTk4Nn0.Mlh6O-qLEHXSqJABN7kFNTHUSIu89L8w-QFjpwRmPYY';
const STORAGE_BUCKET    = 'question-images';
const QUESTIONS_PER_SET = 50;

// ─── SUPABASE CLIENT ─────────────────────────────────────────
const { createClient } = window.supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
});

// ─── APP STATE ───────────────────────────────────────────────
let currentUser    = null;
let currentProfile = null;
let currentTest    = null;
let testState      = null;
let timerInterval  = null;
let pdfParsedQs    = [];
let questionImageFile = null;

// ─── BOOT ────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', boot);

async function boot() {
  document.getElementById('auth-container').style.display = 'none';
  document.getElementById('app-container').style.display  = 'none';

  const { data: { session: initialSession } } = await sb.auth.getSession();
  if (initialSession) {
    currentUser    = initialSession.user;
    currentProfile = await fetchProfileWithRetry(currentUser.id);
    if (currentProfile) {
      showApp();
    } else {
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
      if (currentProfile) {
        showApp();
      } else {
        showAuthPage('login-page');
        showError('login-error', 'Account created! Please sign in to continue.');
        await sb.auth.signOut();
      }
    } else {
      currentUser = currentProfile = null;
      document.getElementById('app-container').style.display = 'none';
      document.getElementById('auth-container').style.display = '';
      showAuthPage('login-page');
    }
  });
}

// ─── PROFILE ─────────────────────────────────────────────────
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

// ─── AUTH ────────────────────────────────────────────────────
async function handleRegister(e) {
  e.preventDefault();
  const name     = document.getElementById('reg-name').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  setLoading('reg-btn', 'reg-btn-text', true, 'Creating account…');
  hideError('register-error');
  const { data, error } = await sb.auth.signUp({ email, password, options: { data: { full_name: name, role: 'student' } } });
  setLoading('reg-btn', 'reg-btn-text', false, 'Create Account');
  if (error) { showError('register-error', error.message); return; }
  if (data.session && data.user) {
    await sb.from('profiles').upsert({ id: data.user.id, full_name: name, role: 'student' });
    return;
  }
  if (data.user && !data.session) {
    showToast('Check your email and click the confirmation link, then sign in.', 'success');
    showAuthPage('login-page');
  }
}
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
async function handleLogout() {
  await sb.auth.signOut();
  currentUser = currentProfile = null;
  document.getElementById('app-container').style.display = 'none';
  document.getElementById('auth-container').style.display = '';
  showAuthPage('login-page');
}

// ─── APP SHELL ───────────────────────────────────────────────
function showApp() {
  document.getElementById('auth-container').style.display = 'none';
  document.getElementById('app-container').style.display  = '';
  renderSidebar();
  document.getElementById('admin-nav-section').style.display =
    currentProfile.role === 'admin' ? '' : 'none';
  navigateTo('dashboard');
}
function renderSidebar() {
  const name = currentProfile.full_name || currentUser.email;
  document.getElementById('user-name-sidebar').textContent = name;
  document.getElementById('user-role-badge').textContent   = currentProfile.role === 'admin' ? 'Administrator' : 'Student';
  document.getElementById('user-avatar').textContent       = name[0].toUpperCase();
}
function navigateTo(page) {
  const adminPages = ['admin-dashboard', 'admin-users', 'admin-series', 'admin-questions'];
  if (adminPages.includes(page) && currentProfile?.role !== 'admin') {
    showToast('Access denied — admin only.', 'error');
    navigateTo('dashboard');
    return;
  }
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const pageEl = document.getElementById('page-' + page);
  if (pageEl) pageEl.classList.add('active');
  const navEl = document.getElementById('nav-' + page);
  if (navEl) navEl.classList.add('active');
  const loaders = {
    'dashboard':       loadDashboard,
    'tests':           loadTestSeries,
    'results':         loadResults,
    'profile':         loadProfile,
    'admin-dashboard': loadAdminDashboard,
    'admin-users':     loadAdminUsers,
    'admin-series':    loadAdminSeries,
    'admin-questions': loadAdminQuestions,
  };
  if (loaders[page]) loaders[page]();
}

// ─── DASHBOARD ───────────────────────────────────────────────
async function loadDashboard() {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  document.getElementById('dash-greeting').textContent =
    `${greeting}, ${currentProfile.full_name || 'there'}! 👋`;

  const { data: attempts } = await sb
    .from('test_attempts').select('*, test_series(name)')
    .eq('user_id', currentUser.id).order('submitted_at', { ascending: false });

  const total   = attempts?.length || 0;
  const avgPct  = total ? +(attempts.reduce((s,a) => s + +a.percentage, 0) / total).toFixed(1) : 0;
  const bestPct = total ? Math.max(...attempts.map(a => +a.percentage)) : 0;
  const totalQ  = attempts?.reduce((s,a) => s + a.total_questions, 0) || 0;

  document.getElementById('dash-stats').innerHTML =
    statCard('Total Tests',  total,       '#3b82f6', iconClip)  +
    statCard('Avg Score',    avgPct + '%','#10b981', iconWave)  +
    statCard('Best Score',   bestPct+'%', '#f59e0b', iconStar)  +
    statCard('Qs Attempted', totalQ,      '#06b6d4', iconClock);

  const recent = (attempts || []).slice(0, 5);
  document.getElementById('dash-recent-attempts').innerHTML = recent.length
    ? recent.map(a => `
        <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);">
          <div style="width:40px;height:40px;border-radius:10px;background:${+a.percentage>=60?'rgba(16,185,129,0.15)':'rgba(239,68,68,0.15)'};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:${+a.percentage>=60?'#10b981':'#ef4444'};">${a.percentage}%</div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${a.test_series?.name||'—'}</div>
            <div style="font-size:11px;color:var(--muted);">${a.score}/${a.total_questions} correct · ${fmtDate(a.submitted_at)}</div>
          </div>
          <span class="badge ${+a.percentage>=60?'badge-green':'badge-red'}">${+a.percentage>=60?'Pass':'Fail'}</span>
        </div>`).join('')
    : emptyState('No tests taken yet. Start practising!');

  if ((attempts || []).length >= 2) {
    const trend = [...(attempts || [])].reverse().slice(-6);
    document.getElementById('dash-performance').innerHTML = `
      <div style="display:flex;align-items:flex-end;gap:6px;height:110px;padding:8px 0;">
        ${trend.map(a => `
          <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;">
            <div style="font-size:10px;color:var(--muted);">${a.percentage}%</div>
            <div style="width:28px;border-radius:4px 4px 0 0;background:linear-gradient(to top,#3b82f6,#06b6d4);height:${Math.max(4,+a.percentage*0.8)}px;"></div>
            <div style="font-size:9px;color:var(--muted);text-align:center;">${(a.test_series?.name||'').substring(0,8)}</div>
          </div>`).join('')}
      </div>`;
  }
}

// ─── TEST SERIES (Student) ────────────────────────────────────
async function loadTestSeries() {
  const grid = document.getElementById('test-series-grid');
  grid.innerHTML = skeletonGrid(3);

  const { data: series, error } = await sb.from('test_series').select('*').eq('is_active', true).order('created_at');
  if (error) { grid.innerHTML = errorState(error.message); return; }
  if (!series?.length) { grid.innerHTML = emptyState('No test series available yet.', true); return; }

  const { data: qCounts }   = await sb.from('questions').select('series_id');
  const { data: myAttempts }= await sb.from('test_attempts').select('series_id, percentage').eq('user_id', currentUser.id);

  const qMap = {}; (qCounts||[]).forEach(q => { qMap[q.series_id] = (qMap[q.series_id]||0)+1; });
  const attMap = {}; (myAttempts||[]).forEach(a => {
    if (!attMap[a.series_id]) attMap[a.series_id] = { count: 0, best: 0 };
    attMap[a.series_id].count++;
    attMap[a.series_id].best = Math.max(attMap[a.series_id].best, +a.percentage);
  });

  grid.innerHTML = series.map(s => {
    const qc  = qMap[s.id] || 0;
    const att = attMap[s.id];
    return `
    <div class="glass p-6 flex flex-col" style="transition:all 0.2s;"
      onmouseenter="this.style.transform='translateY(-4px)';this.style.borderColor='var(--accent)'"
      onmouseleave="this.style.transform='';this.style.borderColor=''">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <div style="width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#3b82f6,#06b6d4);display:flex;align-items:center;justify-content:center;">
          ${iconClip}
        </div>
        ${att ? `<span class="badge badge-green">Best: ${att.best}%</span>` : '<span class="badge badge-blue">New</span>'}
      </div>
      <h3 style="font-size:16px;font-weight:700;margin-bottom:8px;line-height:1.3;">${s.name}</h3>
      <p style="font-size:13px;color:var(--muted);line-height:1.6;flex:1;margin-bottom:16px;">${s.description}</p>
      <div style="display:flex;gap:16px;margin-bottom:16px;font-size:12px;color:var(--muted);flex-wrap:wrap;">
        <span>⏱ ${s.duration_minutes} min</span>
        <span>📝 ${qc}/${s.total_questions} Qs</span>
        ${s.subject ? `<span>🏷 ${s.subject}</span>` : ''}
        ${att ? `<span>🔄 ${att.count} attempt${att.count>1?'s':''}</span>` : ''}
      </div>
      <button onclick="startTest('${s.id}')" class="btn-primary" style="width:100%;" ${qc===0?'disabled':''}>
        ${qc===0 ? 'No Questions Yet' : att ? 'Retake Test' : 'Start Test'}
      </button>
    </div>`;
  }).join('');
}

// ─── TEST ENGINE ─────────────────────────────────────────────
async function startTest(seriesId) {
  const { data: series }    = await sb.from('test_series').select('*').eq('id', seriesId).single();
  const { data: questions } = await sb.from('questions').select('*').eq('series_id', seriesId);

  if (!questions?.length) { showToast('No questions in this series yet!', 'error'); return; }

  const shuffled = [...questions].sort(() => Math.random() - 0.5).slice(0, series.total_questions);

  currentTest = series;
  testState = {
    questions:        shuffled,
    answers:          new Array(shuffled.length).fill(null),
    marked:           new Array(shuffled.length).fill(false),
    currentIndex:     0,
    startTime:        Date.now(),
    totalSeconds:     series.duration_minutes * 60,
    remainingSeconds: series.duration_minutes * 60,
    submitted:        false
  };

  document.getElementById('test-interface').style.display = '';
  document.getElementById('test-title').textContent = series.name;
  renderQuestion();
  buildPalette();
  startTimer();
}

function renderQuestion() {
  const { questions, answers, currentIndex } = testState;
  const q     = questions[currentIndex];
  const total = questions.length;

  document.getElementById('q-num-badge').textContent    = 'Q' + (currentIndex + 1);
  document.getElementById('question-text').textContent   = q.question;
  document.getElementById('test-q-counter').textContent  = `${currentIndex+1}/${total}`;
  document.getElementById('test-progress-bar').style.width = ((currentIndex+1)/total*100) + '%';

  const qImg = document.getElementById('question-image-container');
  if (q.image_url) {
    qImg.innerHTML = `<img src="${q.image_url}" alt="Question image"
      style="max-width:100%;max-height:260px;border-radius:10px;object-fit:contain;border:1px solid var(--border);">`;
    qImg.style.display = '';
  } else {
    qImg.innerHTML = '';
    qImg.style.display = 'none';
  }

  const isLast = currentIndex === total - 1;
  document.getElementById('next-btn').style.display   = isLast ? 'none' : '';
  document.getElementById('submit-btn').style.display  = isLast ? '' : 'none';
  document.getElementById('prev-btn').disabled         = currentIndex === 0;

  const marked = testState.marked[currentIndex];
  const mb = document.getElementById('mark-btn');
  mb.style.background  = marked ? 'rgba(245,158,11,0.2)' : '';
  mb.style.borderColor = marked ? '#f59e0b' : '';
  mb.style.color       = marked ? '#f59e0b' : '';

  const opts = document.getElementById('options-container');
  opts.innerHTML = ['A','B','C','D'].map(letter => {
    const text     = q['option_' + letter.toLowerCase()];
    const selected = answers[currentIndex] === letter;
    return `<button class="option-btn ${selected?'selected':''}" onclick="selectAnswer('${letter}')">
      <span class="option-label" style="${selected?'background:var(--accent);color:white;':''}">${letter}</span>
      <span>${text}</span>
    </button>`;
  }).join('');

  document.getElementById('explanation-box').classList.add('hidden');
}

function selectAnswer(letter) {
  if (testState.submitted) return;
  testState.answers[testState.currentIndex] = letter;
  updatePaletteBtn(testState.currentIndex);
  document.querySelectorAll('.option-btn').forEach((btn, i) => {
    const l = ['A','B','C','D'][i];
    btn.classList.toggle('selected', l === letter);
    const lbl = btn.querySelector('.option-label');
    lbl.style.background = l === letter ? 'var(--accent)' : '';
    lbl.style.color      = l === letter ? 'white' : '';
  });
}

function nextQuestion()  { if (testState.currentIndex < testState.questions.length-1) { testState.currentIndex++; renderQuestion(); updatePaletteActive(); } }
function prevQuestion()  { if (testState.currentIndex > 0) { testState.currentIndex--; renderQuestion(); updatePaletteActive(); } }
function markForReview() { testState.marked[testState.currentIndex] = !testState.marked[testState.currentIndex]; renderQuestion(); updatePaletteBtn(testState.currentIndex); }
function jumpToQuestion(i) { testState.currentIndex = i; renderQuestion(); updatePaletteActive(); }

function buildPalette() {
  document.getElementById('q-palette').innerHTML = testState.questions.map((_, i) =>
    `<button class="q-nav-btn ${i===0?'current':''}" id="pq-${i}" onclick="jumpToQuestion(${i})">${i+1}</button>`
  ).join('');
}
function updatePaletteBtn(index) {
  const btn = document.getElementById('pq-' + index);
  if (!btn) return;
  const answered = testState.answers[index] !== null;
  const marked   = testState.marked[index];
  const current  = index === testState.currentIndex;
  btn.className = 'q-nav-btn';
  btn.style.background = btn.style.borderColor = btn.style.color = '';
  if (current)  { btn.classList.add('current'); return; }
  if (marked)   { btn.style.background='rgba(245,158,11,0.2)';btn.style.borderColor='#f59e0b';btn.style.color='#f59e0b'; return; }
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
  const m  = Math.floor(s/60);
  const ss = s%60;
  const td = document.getElementById('timer-display');
  td.textContent = `${m}:${ss.toString().padStart(2,'0')}`;
  td.style.color = s<=60?'#ef4444':s<=300?'#f59e0b':'var(--text)';
  const pct  = s / testState.totalSeconds;
  const C    = 163.36;
  const ring = document.getElementById('timer-ring');
  ring.setAttribute('stroke-dashoffset', C*(1-pct));
  ring.setAttribute('stroke', s<=60?'#ef4444':s<=300?'#f59e0b':'#3b82f6');
}

// ─── SUBMIT TEST ─────────────────────────────────────────────
function confirmSubmitTest() {
  const answered   = testState.answers.filter(a => a!==null).length;
  const unanswered = testState.questions.length - answered;
  showConfirm('Submit Test',
    unanswered>0 ? `You have ${unanswered} unanswered question${unanswered>1?'s':''}. Submit anyway?` : 'You answered all questions. Ready to submit?',
    () => submitTest(false), '⚠️');
}

async function submitTest(timeUp = false) {
  clearInterval(timerInterval);
  testState.submitted = true;
  const { questions, answers, startTime } = testState;
  let correct=0, incorrect=0, skipped=0;
  questions.forEach((q,i) => {
    if (!answers[i]) skipped++;
    else if (answers[i]===q.answer) correct++;
    else incorrect++;
  });
  const timeTaken  = Math.floor((Date.now()-startTime)/1000);
  const total      = questions.length;
  const percentage = +(correct/total*100).toFixed(2);
  const isPassed   = percentage >= (currentTest.pass_percentage || 60);

  const { data: attempt, error: attErr } = await sb
    .from('test_attempts')
    .insert({ user_id:currentUser.id, series_id:currentTest.id, score:correct, total_questions:total, percentage, time_taken_secs:timeTaken, is_passed:isPassed })
    .select().single();

  if (attErr) { showToast('Error saving result: '+attErr.message,'error'); return; }

  await sb.from('attempt_answers').insert(
    questions.map((q,i) => ({
      attempt_id:    attempt.id,
      question_id:   q.id,
      user_answer:   answers[i]||null,
      correct_answer:q.answer,
      is_correct:    answers[i]===q.answer,
      question_text: q.question,
      image_url:     q.image_url||null,
      option_a:      q.option_a,
      option_b:      q.option_b,
      option_c:      q.option_c,
      option_d:      q.option_d,
      explanation:   q.explanation||''
    }))
  );

  document.getElementById('test-interface').style.display = 'none';
  showResultScreen({ ...attempt, seriesName:currentTest.name, correct, incorrect, skipped, total, percentage, timeTaken, isPassed, questions: questions.map((q,i)=>({ ...q, user_answer:answers[i], is_correct:answers[i]===q.answer, question_text:q.question })) });
}

function confirmExitTest() {
  showConfirm('Exit Test','Your progress will be lost. Are you sure?', () => {
    clearInterval(timerInterval);
    document.getElementById('test-interface').style.display = 'none';
    navigateTo('tests');
  }, '🚪');
}

// ─── RESULT SCREEN ───────────────────────────────────────────
function showResultScreen(result) {
  document.getElementById('result-screen').style.display = '';
  document.getElementById('result-test-name').textContent = result.seriesName;
  document.getElementById('result-score-pct').textContent = result.percentage + '%';
  document.getElementById('res-correct').textContent    = result.correct;
  document.getElementById('res-incorrect').textContent   = result.incorrect;
  document.getElementById('res-skipped').textContent    = result.skipped;
  document.getElementById('res-time').textContent       = fmtDuration(result.timeTaken||result.time_taken_secs);
  const color = result.percentage>=60?'#10b981':result.percentage>=40?'#f59e0b':'#ef4444';
  document.getElementById('result-score-pct').style.color = color;
  const ring = document.getElementById('score-ring');
  ring.setAttribute('stroke', color);
  setTimeout(() => ring.setAttribute('stroke-dashoffset', 439.82*(1-result.percentage/100)), 100);
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
    <div class="glass p-5" style="border-left:3px solid ${isCorrect?'#10b981':skipped?'#f59e0b':'#ef4444'};">
      <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:8px;">
        Q${i+1} · ${isCorrect?'✅ Correct':skipped?'⏭ Skipped':'❌ Incorrect'}
      </div>
      <p style="font-size:14px;font-weight:500;margin-bottom:12px;line-height:1.6;">${q.question_text||q.question}</p>
      ${q.image_url ? `<img src="${q.image_url}" alt="" style="max-width:100%;max-height:200px;border-radius:8px;margin-bottom:12px;object-fit:contain;">` : ''}
      <div class="grid grid-cols-2 gap-2 mb-3">
        ${['A','B','C','D'].map(l => `
          <div style="padding:8px 12px;border-radius:8px;font-size:13px;
            background:${l===q.correct_answer?'rgba(16,185,129,0.15)':l===q.user_answer&&!isCorrect?'rgba(239,68,68,0.1)':'var(--surface2)'};
            border:1px solid ${l===q.correct_answer?'rgba(16,185,129,0.4)':l===q.user_answer&&!isCorrect?'rgba(239,68,68,0.3)':'var(--border)'};
            color:${l===q.correct_answer?'#10b981':l===q.user_answer&&!isCorrect?'#ef4444':'var(--text)'};">
            <strong>${l}.</strong> ${q['option_'+l.toLowerCase()]}
          </div>`).join('')}
      </div>
      ${q.explanation ? `<div style="font-size:13px;color:#60a5fa;background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.2);border-radius:8px;padding:10px;line-height:1.6;"><strong>Explanation:</strong> ${q.explanation}</div>` : ''}
    </div>`;
  }).join('');
}

async function viewResultById(attemptId) {
  const { data: attempt }  = await sb.from('test_attempts').select('*, test_series(name)').eq('id', attemptId).single();
  const { data: answers }  = await sb.from('attempt_answers').select('*').eq('attempt_id', attemptId);
  let correct=0, incorrect=0, skipped=0;
  (answers||[]).forEach(a => { if(!a.user_answer) skipped++; else if(a.is_correct) correct++; else incorrect++; });
  showResultScreen({ ...attempt, seriesName:attempt.test_series?.name||'—', correct, incorrect, skipped, total:attempt.total_questions, percentage:attempt.percentage, timeTaken:attempt.time_taken_secs, isPassed:attempt.is_passed, questions:answers||[] });
  showAnswerReview();
}
function closeResultScreen() { document.getElementById('result-screen').style.display='none'; navigateTo('dashboard'); }

// ─── MY RESULTS ──────────────────────────────────────────────
async function loadResults() {
  const { data: attempts } = await sb.from('test_attempts').select('*, test_series(name)')
    .eq('user_id', currentUser.id).order('submitted_at', { ascending:false });
  window._resultsCache = attempts || [];
  renderResultsTable(attempts||[]);
}
function renderResultsTable(attempts) {
  const body = document.getElementById('results-body');
  if (!attempts.length) { body.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--muted);">No results yet. Take a test!</td></tr>`; return; }
  body.innerHTML = attempts.map(a => `
    <tr>
      <td><div style="font-weight:600;font-size:13px;">${a.test_series?.name||'—'}</div></td>
      <td><div style="font-size:16px;font-weight:800;color:${+a.percentage>=60?'#10b981':+a.percentage>=40?'#f59e0b':'#ef4444'}">${a.percentage}%</div></td>
      <td><span class="mono" style="font-size:13px;">${a.score}/${a.total_questions}</span></td>
      <td style="font-size:13px;color:var(--muted);">${fmtDuration(a.time_taken_secs)}</td>
      <td style="font-size:13px;color:var(--muted);">${fmtDate(a.submitted_at)}</td>
      <td><span class="badge ${a.is_passed?'badge-green':'badge-red'}">${a.is_passed?'Pass':'Fail'}</span></td>
      <td><button onclick="viewResultById('${a.id}')" class="btn-success" style="font-size:12px;padding:6px 12px;">View</button></td>
    </tr>`).join('');
}
function filterResults(query) {
  const q = query.toLowerCase();
  renderResultsTable((window._resultsCache||[]).filter(a => (a.test_series?.name||'').toLowerCase().includes(q)));
}

// ─── PROFILE ─────────────────────────────────────────────────
async function loadProfile() {
  const p    = currentProfile;
  const name = p.full_name||'';
  document.getElementById('profile-avatar').textContent    = name[0]?.toUpperCase()||'U';
  document.getElementById('profile-name').textContent      = name;
  document.getElementById('profile-email').textContent     = currentUser.email;
  document.getElementById('profile-role-badge').textContent= p.role==='admin'?'Administrator':'Student';
  document.getElementById('edit-name').value               = name;
  document.getElementById('edit-email').value              = currentUser.email;
  const { data: attempts } = await sb.from('test_attempts').select('percentage, is_passed').eq('user_id', currentUser.id);
  const total   = attempts?.length||0;
  const avg     = total ? +(attempts.reduce((s,a) => s + +a.percentage,0)/total).toFixed(1) : 0;
  const best    = total ? Math.max(...attempts.map(a => +a.percentage)) : 0;
  const passRate= total ? +(attempts.filter(a => a.is_passed).length/total*100).toFixed(1) : 0;
  document.getElementById('profile-stats').innerHTML =
    statCard('Tests Taken', total,        '#3b82f6', iconClip)  +
    statCard('Avg Score',   avg+'%',      '#10b981', iconWave)  +
    statCard('Best Score',  best+'%',     '#f59e0b', iconStar)  +
    statCard('Pass Rate',   passRate+'%', '#06b6d4', iconCheck);
}
async function updateProfile(e) {
  e.preventDefault();
  const name     = document.getElementById('edit-name').value.trim();
  const password = document.getElementById('edit-password').value;
  const { error: profErr } = await sb.from('profiles').update({ full_name:name }).eq('id', currentUser.id);
  if (profErr) { showToast('Error: '+profErr.message,'error'); return; }
  if (password) {
    const { error: pwErr } = await sb.auth.updateUser({ password });
    if (pwErr) { showToast('Password error: '+pwErr.message,'error'); return; }
  }
  currentProfile.full_name = name;
  renderSidebar();
  loadProfile();
  showToast('Profile updated!','success');
}

// ─── ADMIN DASHBOARD ─────────────────────────────────────────
async function loadAdminDashboard() {
  const [
    { count:userCount  }, { count:seriesCount },
    { count:qCount     }, { count:attCount    },
    { data:recentUsers }, { data:topSeries    }
  ] = await Promise.all([
    sb.from('profiles').select('*',{count:'exact',head:true}).neq('role','admin'),
    sb.from('test_series').select('*',{count:'exact',head:true}),
    sb.from('questions').select('*',{count:'exact',head:true}),
    sb.from('test_attempts').select('*',{count:'exact',head:true}),
    sb.from('profiles').select('*').order('created_at',{ascending:false}).limit(5),
    sb.from('series_stats').select('*').order('attempt_count',{ascending:false}).limit(5)
  ]);
  document.getElementById('admin-stats').innerHTML =
    statCard('Total Users',  userCount  ||0,'#3b82f6',iconUser)  +
    statCard('Test Series',  seriesCount||0,'#10b981',iconClip)  +
    statCard('Total Qs',     qCount     ||0,'#f59e0b',iconQ   )  +
    statCard('Attempts',     attCount   ||0,'#06b6d4',iconWave);
  document.getElementById('admin-recent-users').innerHTML = (recentUsers||[]).map(u => `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);">
      <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#06b6d4);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;">${(u.full_name||'U')[0].toUpperCase()}</div>
      <div><div style="font-size:13px;font-weight:600;">${u.full_name||'—'}</div><span class="badge ${u.role==='admin'?'badge-yellow':'badge-blue'}" style="font-size:10px;">${u.role}</span></div>
      <div style="margin-left:auto;font-size:11px;color:var(--muted);">${fmtDate(u.created_at)}</div>
    </div>`).join('')||emptyState('No users yet');
  document.getElementById('admin-top-tests').innerHTML = (topSeries||[]).map(s => `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);">
      <div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${s.series_name}</div>
      <div style="font-size:11px;color:var(--muted);">Avg: ${s.avg_percentage||0}% · Pass: ${s.pass_rate||0}%</div></div>
      <span class="badge badge-blue">${s.attempt_count} attempts</span>
    </div>`).join('')||emptyState('No attempts yet');
}

// ─── ADMIN USERS ─────────────────────────────────────────────
async function loadAdminUsers() {
  const { data: users } = await sb.from('user_stats').select('*').order('created_at',{ascending:false});
  window._usersCache = users||[];
  renderUsersTable(users||[]);
}
function renderUsersTable(users) {
  document.getElementById('users-body').innerHTML = users.map(u => `
    <tr>
      <td><div style="display:flex;align-items:center;gap:10px;">
        <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#06b6d4);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;">${(u.full_name||'U')[0].toUpperCase()}</div>
        <span style="font-weight:600;font-size:13px;">${u.full_name||'—'}</span>
      </div></td>
      <td style="font-size:12px;color:var(--muted);">${u.user_id}</td>
      <td><span class="badge ${u.role==='admin'?'badge-yellow':'badge-blue'}">${u.role}</span></td>
      <td style="font-size:13px;">${u.tests_taken||0}</td>
      <td style="font-size:13px;">${u.avg_score?u.avg_score+'%':'—'}</td>
      <td style="font-size:13px;color:var(--muted);">${fmtDate(u.created_at)}</td>
      <td><div style="display:flex;gap:6px;">
        ${u.role!=='admin'?`<button onclick="setUserRole('${u.user_id}','admin')" class="btn-success" style="font-size:11px;padding:6px 10px;">Make Admin</button>`:`<button onclick="setUserRole('${u.user_id}','student')" class="btn-secondary" style="font-size:11px;padding:6px 10px;">Revoke</button>`}
        ${u.user_id!==currentUser.id?`<button onclick="deleteUser('${u.user_id}')" class="btn-danger" style="font-size:11px;padding:6px 10px;">Delete</button>`:''}
      </div></td>
    </tr>`).join('')||`<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--muted);">No users found.</td></tr>`;
}
function filterUsers(q) { renderUsersTable((window._usersCache||[]).filter(u => (u.full_name||'').toLowerCase().includes(q.toLowerCase()))); }
async function setUserRole(uid, role) {
  const { error } = await sb.from('profiles').update({ role }).eq('id', uid);
  if (error) { showToast('Error: '+error.message,'error'); return; }
  showToast('Role updated!','success'); loadAdminUsers();
}
async function deleteUser(uid) {
  showConfirm('Delete User','This permanently deletes the user and all their data.', async () => {
    const { error } = await sb.from('profiles').delete().eq('id', uid);
    if (error) { showToast('Error: '+error.message,'error'); return; }
    showToast('User deleted.','success'); loadAdminUsers();
  }, '🗑️');
}

// ─── ADMIN SERIES ─────────────────────────────────────────────
async function loadAdminSeries() {
  const { data: series }    = await sb.from('test_series').select('*').order('created_at');
  const { data: qCounts }   = await sb.from('questions').select('series_id');
  const { data: attCounts } = await sb.from('test_attempts').select('series_id');
  const qMap={};   (qCounts  ||[]).forEach(q => { qMap[q.series_id]  =(qMap[q.series_id] ||0)+1; });
  const attMap={}; (attCounts||[]).forEach(a => { attMap[a.series_id]=(attMap[a.series_id]||0)+1; });
  document.getElementById('series-list').innerHTML = (series||[]).map(s => `
    <div class="glass p-5">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <span class="badge ${s.is_active?'badge-green':'badge-red'}">${s.is_active?'Active':'Inactive'}</span>
        <div style="display:flex;gap:6px;">
          <button onclick="editSeries('${s.id}')" class="btn-success" style="font-size:11px;padding:6px 10px;">Edit</button>
          <button onclick="deleteSeries('${s.id}')" class="btn-danger" style="font-size:11px;padding:6px 10px;">Delete</button>
        </div>
      </div>
      <h3 style="font-size:15px;font-weight:700;margin-bottom:4px;">${s.name}</h3>
      ${s.subject?`<p style="font-size:11px;color:var(--accent);margin-bottom:6px;">🏷 ${s.subject}</p>`:''}
      <p style="font-size:12px;color:var(--muted);margin-bottom:12px;line-height:1.5;">${s.description}</p>
      <div style="display:flex;gap:12px;font-size:12px;color:var(--muted);flex-wrap:wrap;">
        <span>⏱ ${s.duration_minutes} min</span>
        <span>📝 ${qMap[s.id]||0}/${s.total_questions} Qs</span>
        <span>🔄 ${attMap[s.id]||0} attempts</span>
        <span>✅ Pass: ${s.pass_percentage}%</span>
      </div>
    </div>`).join('')||`<div style="text-align:center;padding:60px;color:var(--muted);grid-column:1/-1;">No series yet. Create one!</div>`;
}

function openAddSeriesModal() {
  document.getElementById('series-modal-title').textContent = 'Create Test Series';
  document.getElementById('series-edit-id').value   = '';
  document.getElementById('series-name').value      = '';
  document.getElementById('series-desc').value      = '';
  document.getElementById('series-duration').value  = '60';
  document.getElementById('series-total-q').value   = '50';
  document.getElementById('series-pass-pct').value  = '60';
  document.getElementById('series-subject').value   = '';
  document.getElementById('series-active').checked  = true;
  document.getElementById('add-series-modal').style.display = 'flex';
}
async function editSeries(id) {
  const { data: s } = await sb.from('test_series').select('*').eq('id', id).single();
  document.getElementById('series-modal-title').textContent = 'Edit Test Series';
  document.getElementById('series-edit-id').value   = id;
  document.getElementById('series-name').value      = s.name;
  document.getElementById('series-desc').value      = s.description;
  document.getElementById('series-duration').value  = s.duration_minutes;
  document.getElementById('series-total-q').value   = s.total_questions;
  document.getElementById('series-pass-pct').value  = s.pass_percentage;
  document.getElementById('series-subject').value   = s.subject;
  document.getElementById('series-active').checked  = s.is_active;
  document.getElementById('add-series-modal').style.display = 'flex';
}
async function saveSeries(e) {
  e.preventDefault();
  const editId = document.getElementById('series-edit-id').value;
  const payload = {
    name:            document.getElementById('series-name').value.trim(),
    description:     document.getElementById('series-desc').value.trim(),
    duration_minutes:parseInt(document.getElementById('series-duration').value),
    total_questions: parseInt(document.getElementById('series-total-q').value),
    pass_percentage: parseInt(document.getElementById('series-pass-pct').value),
    subject:         document.getElementById('series-subject').value.trim(),
    is_active:       document.getElementById('series-active').checked,
  };
  const query = editId
    ? sb.from('test_series').update(payload).eq('id', editId)
    : sb.from('test_series').insert({ ...payload, created_by:currentUser.id });
  const { error } = await query;
  if (error) { showToast('Error: '+error.message,'error'); return; }
  closeModal('add-series-modal'); loadAdminSeries();
  showToast(editId?'Series updated!':'Series created!','success');
}
async function deleteSeries(id) {
  showConfirm('Delete Series','This deletes the series, all its questions and attempt records.', async () => {
    const { error } = await sb.from('test_series').delete().eq('id', id);
    if (error) { showToast('Error: '+error.message,'error'); return; }
    showToast('Series deleted.','success'); loadAdminSeries();
  }, '🗑️');
}

// ─── ADMIN QUESTIONS ─────────────────────────────────────────
async function loadAdminQuestions() {
  const { data: series } = await sb.from('test_series').select('id,name').order('name');
  const filterVal = document.getElementById('q-filter-series').value;
  const opts = (series||[]).map(s => `<option value="${s.id}" ${s.id===filterVal?'selected':''}>${s.name}</option>`).join('');
  document.getElementById('q-filter-series').innerHTML  = `<option value="">All Series</option>` + opts;
  document.getElementById('question-series').innerHTML  = `<option value="">Select series...</option>` + opts;
  document.getElementById('pdf-series-select').innerHTML= `<option value="">Select series prefix...</option>` + opts;

  let qQuery = sb.from('questions').select('*, test_series(name)').order('order_index').order('created_at');
  if (filterVal) qQuery = qQuery.eq('series_id', filterVal);
  const { data: questions } = await qQuery;
  window._questionsCache = questions||[];
  renderQuestionsTable(questions||[]);
}

function renderQuestionsTable(questions) {
  document.getElementById('questions-body').innerHTML = questions.map((q, i) => `
    <tr>
      <td class="mono" style="font-size:12px;color:var(--muted);">${i+1}</td>
      <td style="max-width:280px;font-size:13px;">
        ${q.image_url?`<img src="${q.image_url}" style="width:32px;height:32px;border-radius:4px;object-fit:cover;margin-right:6px;vertical-align:middle;" alt="">`:'' }
        ${q.question.substring(0,70)}${q.question.length>70?'…':''}
      </td>
      <td style="font-size:11px;color:var(--muted);max-width:160px;">A: ${(q.option_a||'').substring(0,25)}…</td>
      <td><span class="badge badge-green mono">${q.answer}</span></td>
      <td style="font-size:12px;color:var(--muted);">${q.test_series?.name||'—'}</td>
      <td><div style="display:flex;gap:6px;">
        <button onclick="editQuestion('${q.id}')" class="btn-success" style="font-size:11px;padding:6px 10px;">Edit</button>
        <button onclick="deleteQuestion('${q.id}')" class="btn-danger" style="font-size:11px;padding:6px 10px;">Del</button>
      </div></td>
    </tr>`).join('')||`<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--muted);">No questions found.</td></tr>`;
}
function filterQuestions(q) { renderQuestionsTable((window._questionsCache||[]).filter(qu => qu.question.toLowerCase().includes(q.toLowerCase()))); }

// ─── QUESTION FORM (with image) ──────────────────────────────
function openAddQuestionModal() {
  document.getElementById('question-modal-title').textContent = 'Add Question';
  document.getElementById('question-edit-id').value = '';
  ['question-text-input','q-opt-a','q-opt-b','q-opt-c','q-opt-d','q-explanation'].forEach(id => document.getElementById(id).value='');
  document.getElementById('q-answer').value         = '';
  document.getElementById('question-series').value  = '';
  document.getElementById('q-image-preview').style.display = 'none';
  document.getElementById('q-image-preview').src    = '';
  document.getElementById('q-current-image-url').value = '';
  questionImageFile = null;
  document.getElementById('add-question-modal').style.display = 'flex';
}
async function editQuestion(id) {
  const { data: q } = await sb.from('questions').select('*').eq('id', id).single();
  await loadAdminQuestions();
  document.getElementById('question-modal-title').textContent = 'Edit Question';
  document.getElementById('question-edit-id').value    = id;
  document.getElementById('question-text-input').value  = q.question;
  document.getElementById('q-opt-a').value             = q.option_a;
  document.getElementById('q-opt-b').value             = q.option_b;
  document.getElementById('q-opt-c').value             = q.option_c;
  document.getElementById('q-opt-d').value             = q.option_d;
  document.getElementById('q-answer').value            = q.answer;
  document.getElementById('q-explanation').value       = q.explanation||'';
  document.getElementById('question-series').value     = q.series_id;
  document.getElementById('q-current-image-url').value = q.image_url||'';
  questionImageFile = null;
  const prev = document.getElementById('q-image-preview');
  if (q.image_url) { prev.src = q.image_url; prev.style.display = ''; }
  else { prev.style.display = 'none'; prev.src = ''; }
  document.getElementById('add-question-modal').style.display = 'flex';
}

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

async function saveQuestion(e) {
  e.preventDefault();
  const editId = document.getElementById('question-edit-id').value;
  let imageUrl = document.getElementById('q-current-image-url').value || null;

  if (questionImageFile) {
    try {
      showToast('Uploading image…', 'info');
      imageUrl = await uploadQuestionImage(questionImageFile);
    } catch (err) {
      showToast(err.message, 'error'); return;
    }
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
  if (error) { showToast('Error: '+error.message,'error'); return; }
  closeModal('add-question-modal');
  loadAdminQuestions();
  showToast(editId?'Question updated!':'Question added!','success');
  questionImageFile = null;
}

async function deleteQuestion(id) {
  showConfirm('Delete Question','Permanently delete this question?', async () => {
    const { error } = await sb.from('questions').delete().eq('id', id);
    if (error) { showToast('Error: '+error.message,'error'); return; }
    showToast('Question deleted.','success'); loadAdminQuestions();
  }, '🗑️');
}

// ─── PDF / DOCX UPLOAD MODAL ─────────────────────────────────
function openPdfUploadModal() {
  loadAdminQuestions();
  setTimeout(() => document.getElementById('pdf-upload-modal').style.display='flex', 100);
  resetUploadModal();
}

function resetUploadModal() {
  document.getElementById('pdf-status').style.display    = 'none';
  document.getElementById('pdf-preview').style.display   = 'none';
  document.getElementById('import-pdf-btn').disabled     = true;
  document.getElementById('pdf-batch-info').style.display= 'none';
  // Reset file label
  const lbl = document.getElementById('pdf-file-label');
  if (lbl) lbl.textContent = 'Drop PDF or DOCX here, or click to browse';
  pdfParsedQs = [];
}

// Drag-and-drop — handles both PDF and DOCX
function handlePdfDrop(e) {
  e.preventDefault();
  document.getElementById('pdf-drop-zone').style.borderColor = 'var(--border)';
  const file = e.dataTransfer.files[0];
  if (!file) return;
  if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
    processPdfFile(file);
  } else if (
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    file.name.endsWith('.docx')
  ) {
    processDocxFile(file);
  } else {
    showToast('Please upload a PDF or DOCX file.', 'error');
  }
}

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.name.endsWith('.pdf')) {
    processPdfFile(file);
  } else if (file.name.endsWith('.docx')) {
    processDocxFile(file);
  } else {
    showToast('Unsupported file type. Use PDF or DOCX.', 'error');
  }
}

// Keep old name for backward compat
function handlePdfSelect(e) { handleFileSelect(e); }

// ─── DOCX PROCESSING ─────────────────────────────────────────
async function processDocxFile(file) {
  const status = document.getElementById('pdf-status');
  const setStatus = (msg, type='info') => {
    status.style.display    = '';
    status.style.background = type==='ok'?'rgba(16,185,129,0.1)':type==='err'?'rgba(239,68,68,0.1)':'rgba(59,130,246,0.1)';
    status.style.border     = `1px solid ${type==='ok'?'rgba(16,185,129,0.2)':type==='err'?'rgba(239,68,68,0.2)':'rgba(59,130,246,0.2)'}`;
    status.style.color      = type==='ok'?'#34d399':type==='err'?'#f87171':'#60a5fa';
    status.style.borderRadius='8px'; status.style.padding='12px';
    status.textContent      = msg;
  };

  // Update drop zone label
  const lbl = document.getElementById('pdf-file-label');
  if (lbl) lbl.textContent = `📄 ${file.name}`;

  setStatus('⏳ Reading DOCX file…');

  try {
    // mammoth.js converts docx → plain text
    if (!window.mammoth) {
      setStatus('❌ DOCX support library (mammoth.js) not loaded. Refresh and try again.', 'err');
      return;
    }
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    const rawText = result.value;

    if (!rawText || rawText.trim().length < 50) {
      setStatus('❌ No readable text found in this DOCX file. It may be empty or image-only.', 'err');
      return;
    }

    setStatus(`⏳ Extracted ${rawText.length} characters. Parsing questions…`);
    pdfParsedQs = parsePdfText(rawText);  // reuse same parser pipeline
    showParseResults(setStatus, file.name);
  } catch (err) {
    setStatus('❌ Error reading DOCX: ' + err.message, 'err');
  }
}

// ─── PDF PROCESSING ──────────────────────────────────────────
async function processPdfFile(file) {
  const status = document.getElementById('pdf-status');
  const setStatus = (msg, type='info') => {
    status.style.display    = '';
    status.style.background = type==='ok'?'rgba(16,185,129,0.1)':type==='err'?'rgba(239,68,68,0.1)':'rgba(59,130,246,0.1)';
    status.style.border     = `1px solid ${type==='ok'?'rgba(16,185,129,0.2)':type==='err'?'rgba(239,68,68,0.2)':'rgba(59,130,246,0.2)'}`;
    status.style.color      = type==='ok'?'#34d399':type==='err'?'#f87171':'#60a5fa';
    status.style.borderRadius='8px'; status.style.padding='12px';
    status.textContent      = msg;
  };

  // Update drop zone label
  const lbl = document.getElementById('pdf-file-label');
  if (lbl) lbl.textContent = `📄 ${file.name}`;

  setStatus('⏳ Parsing PDF… (this may take a moment for large files)');

  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;

    let fullText = '';
    let totalChars = 0;
    for (let i = 1; i <= pdf.numPages; i++) {
      const page    = await pdf.getPage(i);
      const content = await page.getTextContent();

      const byY = {};
      for (const item of content.items) {
        if (!item.str || !item.str.trim()) continue;
        const y = Math.round(item.transform[5]);
        if (!byY[y]) byY[y] = [];
        byY[y].push({ x: item.transform[4], str: item.str });
      }

      const lines = Object.keys(byY)
        .sort((a, b) => b - a)
        .map(y => byY[y].sort((a, b) => a.x - b.x).map(it => it.str).join(' '));

      const pageText = lines.join('\n');
      totalChars += pageText.length;
      fullText += pageText + '\n';
    }

    const avgCharsPerPage = totalChars / pdf.numPages;
    if (avgCharsPerPage < 80) {
      setStatus(
        `⚠️ This PDF appears to be a scanned image (only ${totalChars} characters from ${pdf.numPages} pages). ` +
        `Scanned PDFs cannot be parsed — text is stored as images. ` +
        `Run it through a free OCR tool first (e.g. iLovePDF → PDF OCR, or Smallpdf) to make text selectable, then re-upload.`,
        'err'
      );
      return;
    }

    setStatus(`⏳ Extracted ${totalChars} characters from ${pdf.numPages} pages. Parsing questions…`);
    pdfParsedQs = parsePdfText(fullText);
    showParseResults(setStatus, file.name);
  } catch (err) {
    setStatus('❌ Error reading PDF: ' + err.message, 'err');
  }
}

// ─── SHARED: show parse results after PDF or DOCX parsing ────
function showParseResults(setStatus, filename) {
  if (pdfParsedQs.length > 0) {
    const sets = Math.ceil(pdfParsedQs.length / QUESTIONS_PER_SET);
    setStatus(`✅ Found ${pdfParsedQs.length} questions in "${filename}" → will create ${sets} series (sets of ${QUESTIONS_PER_SET})`, 'ok');

    const batchInfo = document.getElementById('pdf-batch-info');
    batchInfo.style.display = '';
    batchInfo.innerHTML = `<div style="font-size:12px;color:var(--muted);margin-top:8px;">
      ${Array.from({length:sets},(_,i) => {
        const from = i*QUESTIONS_PER_SET+1;
        const to   = Math.min((i+1)*QUESTIONS_PER_SET, pdfParsedQs.length);
        return `<span style="margin-right:8px;">Set ${i+1}: Q${from}–Q${to}</span>`;
      }).join('')}
    </div>`;

    const prev = document.getElementById('pdf-preview');
    prev.style.display = '';
    prev.innerHTML = pdfParsedQs.slice(0,3).map((q,i) =>
      `<div style="margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid var(--border);font-size:12px;">
        <strong>Q${i+1}:</strong> ${q.question.substring(0,100)}…
        <span style="color:#10b981;"> [Ans: ${q.answer}]</span>
        ${q.explanation ? `<span style="color:#60a5fa;"> ✓ Rationale</span>` : ''}
      </div>`
    ).join('');
    document.getElementById('import-pdf-btn').disabled = false;
  } else {
    setStatus(
      '❌ No questions found. Supported formats:\n' +
      '① "QUESTION N" → A. B. C. D. → Answer: X (NCLEX classic)\n' +
      '② Numbered "N." → A. B. C. D. → Answer Key table at end (NORCET booklet)\n' +
      '③ "N. question" → indented A. B. C. D. → Answer: X. → Rationale: (NCLEX 1000-style)',
      'err'
    );
  }
}

// ─── NOISE / JUNK LINE FILTER ────────────────────────────────
const JUNK_PATTERNS = [
  /^@\w+/,
  /^lOMoARcPSD/,
  /Downloaded by/i,
  /Distribution of this document/i,
  /Want to earn/i,
  /Studocu is not sponsored/i,
  /^\d{1,3}$/,
  /^NCLEX RN ACTUAL EXAM/i,
  /^BANK OF REAL QUESTIONS/i,
  /^ANSWERS NCLEX/i,
  /^NORCET \d+ SELECTION DOSE/i,
  /Granth Shree/i,
  /Berlin0145/i,
  /^\s*$/,
];

function isJunk(line) {
  const t = line.trim();
  if (!t) return true;
  return JUNK_PATTERNS.some(rx => rx.test(t));
}

function cleanLines(text) {
  return text
    .split('\n')
    .filter(l => !isJunk(l))
    .join('\n');
}

// ─── MAIN PARSER: auto-detects format ────────────────────────
function parsePdfText(rawText) {
  const cleaned = cleanLines(rawText);

  // Format 1 first: "QUESTION N" keyword-based (Omega / NCLEX classic)
  const format1Results = parseFormatQuestion(cleaned);
  if (format1Results.length >= 3) return format1Results;

  // Format 3 (NEW): "N. question\n   A. opt\nAnswer: X.\nRationale: ..." (NCLEX 1000-style)
  const format3Results = parseFormatNCLEX(cleaned);
  if (format3Results.length >= 3) return format3Results;

  // Format 2: numbered questions with end answer key (NORCET booklet)
  const format2Results = parseFormatNumbered(cleaned);
  if (format2Results.length >= 3) return format2Results;

  // Fallbacks on raw text
  const fallback3 = parseFormatNCLEX(rawText);
  if (fallback3.length >= 3) return fallback3;

  const fallback1 = parseFormatQuestion(rawText);
  if (fallback1.length >= 3) return fallback1;

  return [];
}

// ─── FORMAT 1: "QUESTION N" keyword style ────────────────────
function parseFormatQuestion(text) {
  const qs = [];
  const re = /QUESTION\s+\d+\s*\n([\s\S]*?)(?=QUESTION\s+\d+\s*\n|$)/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const block = m[1];
    const lines = block.split('\n').map(l => l.trim()).filter(l => l && !isJunk(l));

    const opts = { A:'', B:'', C:'', D:'' };
    let answer = '', explanation = '';
    const qLines = [];
    let phase = 'question';

    for (const line of lines) {
      const optM = line.match(/^([A-D])[.)]\s+(.+)/);
      const ansM = line.match(/^Answer[:\s]+([A-D])\b/i);
      const expM = /^Explanation[:\s]*/i.test(line);

      if (ansM) {
        answer = ansM[1].toUpperCase();
        phase = 'answer';
      } else if (expM) {
        phase = 'explanation';
        const rest = line.replace(/^Explanation[:\s]*/i, '').trim();
        if (rest) explanation += rest + ' ';
      } else if (phase === 'explanation') {
        explanation += line + ' ';
      } else if (optM) {
        phase = 'options';
        if (!opts[optM[1]]) opts[optM[1]] = optM[2].trim();
      } else if (phase === 'question') {
        qLines.push(line);
      }
    }

    const qText = qLines.join(' ').trim();
    if (qText && answer && opts.A && opts.B && opts.C && opts.D) {
      qs.push({ question:qText, option_a:opts.A, option_b:opts.B, option_c:opts.C, option_d:opts.D, answer, explanation:explanation.trim() });
    }
  }
  return qs;
}

// ─── FORMAT 3 (NEW): NCLEX 1000-style ────────────────────────
// Pattern:
//   N. Question text (possibly multi-line)
//   (blank)
//      [bullet?] A. Option text
//      [bullet?] B. Option text
//      [bullet?] C. Option text
//      [bullet?] D. Option text
//   (blank)
//   Answer: X. Full answer text
//   Rationale: Explanation text (possibly multi-line)
// ─────────────────────────────────────────────────────────────
function parseFormatNCLEX(text) {
  // Remove bullet/list characters that PDFs inject before options
  const BULLET_RE = /[\u2022\u25cf\u2023\u2043\uf0b7\uf0a7\u25aa\u25ab\u2012\u2013\u2014]/g;
  const cleaned = text.replace(BULLET_RE, '').replace(/\r\n/g, '\n');

  // Split on numbered question boundaries: a line starting with "N. <Capital letter>"
  // The capital letter after the period ensures we don't split on "e.g.", "vs.", etc.
  const blocks = cleaned.split(/\n(?=\d{1,4}\.\s+[A-Z"(])/);

  const qs = [];
  for (const block of blocks) {
    if (!block.trim()) continue;

    const lines = block.split('\n').map(l => l.trim()).filter(l => l);

    const opts = {};
    let answer = '';
    const rationaleLines = [];
    const qLines = [];
    let phase = 'q'; // q → opts → answer → rationale

    for (const line of lines) {
      if (isJunk(line)) continue;

      // Option: "A. text" or "A) text"  (after bullet removal)
      const optM = line.match(/^([A-D])[.)]\s+"?(.+)/);
      // Answer: "Answer: B. text" or "Answer: B text"
      const ansM = line.match(/^Answer:\s*([A-D])[.)"\s]/i);
      // Rationale / Explanation header
      const ratM = line.match(/^(?:Rationale|Explanation)[:\s]*(.*)/i);

      if (ratM) {
        if (phase === 'q' || phase === 'opts') {
          // We may have missed the answer line — skip this block
        }
        phase = 'rationale';
        if (ratM[1].trim()) rationaleLines.push(ratM[1].trim());
      } else if (phase === 'rationale') {
        rationaleLines.push(line);
      } else if (ansM) {
        answer = ansM[1].toUpperCase();
        phase = 'answer';
      } else if (optM && phase !== 'answer' && phase !== 'rationale') {
        phase = 'opts';
        const letter = optM[1].toUpperCase();
        if (!opts[letter]) opts[letter] = optM[2].replace(/^"/, '').trim();
      } else if (phase === 'q') {
        // Strip leading "N. " from the first question line
        const stripped = line.replace(/^\d{1,4}\.\s+/, '');
        if (stripped) qLines.push(stripped);
      } else if (phase === 'opts') {
        // Continuation of last option (multiline options are rare but possible)
        const lastLetter = Object.keys(opts).slice(-1)[0];
        if (lastLetter) opts[lastLetter] += ' ' + line;
      }
    }

    const qText = qLines.join(' ').trim();
    const explanation = rationaleLines.join(' ').trim();

    if (
      qText &&
      answer &&
      opts['A'] && opts['B'] && opts['C'] && opts['D']
    ) {
      qs.push({
        question:    qText,
        option_a:    opts['A'],
        option_b:    opts['B'],
        option_c:    opts['C'],
        option_d:    opts['D'],
        answer,
        explanation,
      });
    }
  }
  return qs;
}

// ─── FORMAT 2: numbered style with end answer key ────────────
function parseFormatNumbered(text) {
  const answerKey = {};
  const answerKeySection = text.match(/Answer\s*[Kk]ey[\s\S]{0,50}\n([\s\S]+)/i);
  if (answerKeySection) {
    const keyText = answerKeySection[1];
    const keyRe = /(\d+)\.\s*([A-Da-d])/g;
    let km;
    while ((km = keyRe.exec(keyText)) !== null) {
      answerKey[parseInt(km[1])] = km[2].toUpperCase();
    }
  }

  const blockRe = /^(\d{1,4})\.\s+(.+?)(?=^\d{1,4}\.\s+|\nAnswer\s*[Kk]ey|$)/gms;
  const qs = [];
  let m;
  while ((m = blockRe.exec(text)) !== null) {
    const qNum = parseInt(m[1]);
    const blockText = m[0];
    if (blockText.trim().length < 15) continue;
    const lines = blockText.split('\n').map(l => l.trim()).filter(l => l && !isJunk(l));
    if (lines.length < 3) continue;
    const opts = { A:'', B:'', C:'', D:'' };
    const optRe = /^[\(\[]?([a-dA-D])[\)\].]\s+(.+)/;
    const qLines = [];
    let foundOpts = false;
    for (const line of lines) {
      const optM = line.match(optRe);
      if (optM) {
        foundOpts = true;
        const key = optM[1].toUpperCase();
        if (!opts[key]) opts[key] = optM[2].trim();
      } else if (!foundOpts) {
        const stripped = line.replace(/^\d{1,4}\.\s*/, '');
        if (stripped) qLines.push(stripped);
      }
    }
    const qText = qLines.join(' ').trim();
    const answer = answerKey[qNum] || '';
    if (qText && opts.A && opts.B && opts.C && opts.D && answer) {
      qs.push({ question:qText, option_a:opts.A, option_b:opts.B, option_c:opts.C, option_d:opts.D, answer, explanation:'' });
    }
  }

  if (qs.length === 0 && Object.keys(answerKey).length === 0) {
    const blockRe2 = /^(\d{1,4})\.\s+(.+?)(?=^\d{1,4}\.\s+|$)/gms;
    let m2;
    while ((m2 = blockRe2.exec(text)) !== null) {
      const blockText = m2[0];
      if (blockText.trim().length < 15) continue;
      const lines = blockText.split('\n').map(l => l.trim()).filter(l => l && !isJunk(l));
      if (lines.length < 3) continue;
      const opts = { A:'', B:'', C:'', D:'' };
      const optRe = /^[\(\[]?([a-dA-D])[\)\].]\s+(.+)/;
      const qLines = [];
      let foundOpts = false;
      for (const line of lines) {
        const optM = line.match(optRe);
        if (optM) { foundOpts = true; const key = optM[1].toUpperCase(); if (!opts[key]) opts[key] = optM[2].trim(); }
        else if (!foundOpts) { const s = line.replace(/^\d{1,4}\.\s*/, ''); if (s) qLines.push(s); }
      }
      const qText = qLines.join(' ').trim();
      if (qText && opts.A && opts.B && opts.C && opts.D)
        qs.push({ question:qText, option_a:opts.A, option_b:opts.B, option_c:opts.C, option_d:opts.D, answer:'A', explanation:'' });
    }
  }
  return qs;
}

// ─── IMPORT: create series in Supabase ───────────────────────
async function importPdfQuestions() {
  const baseName = document.getElementById('pdf-series-name').value.trim();
  if (!baseName)           { showToast('Enter a base name for the test series.','error'); return; }
  if (!pdfParsedQs.length) { showToast('No questions to import.','error'); return; }

  const durationMins  = parseInt(document.getElementById('pdf-series-duration').value)||60;
  const passPercent   = parseInt(document.getElementById('pdf-series-pass').value)||60;
  const subject       = document.getElementById('pdf-series-subject').value.trim();
  const btn           = document.getElementById('import-pdf-btn');
  btn.disabled = true;
  btn.textContent = 'Importing…';

  const sets = Math.ceil(pdfParsedQs.length / QUESTIONS_PER_SET);
  let created = 0;

  for (let s = 0; s < sets; s++) {
    const batch     = pdfParsedQs.slice(s * QUESTIONS_PER_SET, (s+1) * QUESTIONS_PER_SET);
    const setNumber = s + 1;
    const seriesName= sets > 1 ? `${baseName} — Set ${setNumber}` : baseName;

    const { data: newSeries, error: serErr } = await sb.from('test_series').insert({
      name:            seriesName,
      description:     `Imported from file. Set ${setNumber} of ${sets}. Questions ${s*QUESTIONS_PER_SET+1}–${Math.min((s+1)*QUESTIONS_PER_SET, pdfParsedQs.length)}.`,
      duration_minutes:durationMins,
      total_questions: batch.length,
      pass_percentage: passPercent,
      subject,
      is_active:       true,
      created_by:      currentUser.id
    }).select().single();

    if (serErr) { showToast(`Error creating set ${setNumber}: `+serErr.message,'error'); continue; }

    const rows = batch.map((q, i) => ({ ...q, series_id:newSeries.id, order_index:i+1 }));
    const { error: qErr } = await sb.from('questions').insert(rows);
    if (qErr) { showToast(`Error inserting questions for set ${setNumber}: `+qErr.message,'error'); }
    else created++;

    document.getElementById('pdf-status').textContent = `Importing… set ${setNumber}/${sets} done`;
  }

  btn.disabled = false; btn.textContent = 'Import Questions';
  closeModal('pdf-upload-modal');
  loadAdminQuestions();
  showToast(`✅ Imported ${pdfParsedQs.length} questions into ${created} series!`,'success');
  pdfParsedQs = [];
}

// ─── ICON SVG SNIPPETS ───────────────────────────────────────
const iconClip  = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>`;
const iconWave  = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`;
const iconStar  = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
const iconClock = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`;
const iconUser  = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8z"/></svg>`;
const iconQ     = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01"/></svg>`;
const iconCheck = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3"/></svg>`;

// ─── UI HELPERS ──────────────────────────────────────────────
function statCard(label, value, color, iconSvg) {
  return `<div class="stat-card">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
      <div style="width:36px;height:36px;border-radius:9px;background:${color}22;display:flex;align-items:center;justify-content:center;color:${color};">${iconSvg}</div>
    </div>
    <div style="font-size:26px;font-weight:800;margin-bottom:4px;">${value}</div>
    <div style="font-size:12px;color:var(--muted);">${label}</div>
  </div>`;
}
function emptyState(msg, full=false) {
  return `<div style="text-align:center;padding:60px;color:var(--muted);${full?'grid-column:1/-1;':''}">
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin:0 auto 12px;opacity:0.3;display:block;"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/></svg>
    <p style="font-size:13px;">${msg}</p>
  </div>`;
}
function skeletonGrid(n) {
  return Array(n).fill(0).map(() =>
    `<div class="glass p-6" style="height:220px;background:linear-gradient(90deg,var(--surface2) 25%,var(--border) 50%,var(--surface2) 75%);background-size:200% 100%;animation:shimmer 1.5s infinite;border-radius:16px;"></div>`
  ).join('') + '<style>@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}</style>';
}
function errorState(msg) { return `<div style="color:#f87171;padding:20px;text-align:center;grid-column:1/-1;">Error: ${msg}</div>`; }
function showAuthPage(id) {
  document.querySelectorAll('#auth-container > div').forEach(el => el.style.display='none');
  document.getElementById(id).style.display='grid';
}
const showPage = showAuthPage;
function showError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg; el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 5000);
}
function hideError(id) { document.getElementById(id)?.classList.add('hidden'); }
function setLoading(btnId, textId, loading, text) {
  const btn=document.getElementById(btnId), txt=document.getElementById(textId);
  if (!btn||!txt) return;
  btn.disabled=loading; txt.textContent=text;
}
function closeModal(id) { document.getElementById(id).style.display='none'; }
function showConfirm(title, message, onConfirm, icon='⚠️') {
  document.getElementById('confirm-title').textContent   = title;
  document.getElementById('confirm-message').textContent = message;
  document.getElementById('confirm-icon').textContent    = icon;
  document.getElementById('confirm-icon').style.cssText  = 'width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(245,158,11,0.15);font-size:24px;margin:0 auto 16px;';
  document.getElementById('confirm-modal').style.display = 'flex';
  document.getElementById('confirm-action-btn').onclick  = () => { closeModal('confirm-modal'); onConfirm(); };
}
function showToast(msg, type='success') {
  document.querySelector('.toast')?.remove();
  const t = document.createElement('div');
  t.className = 'toast';
  const color = type==='success'?'#10b981':type==='error'?'#ef4444':'#3b82f6';
  t.innerHTML = `<div style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0;"></div>${msg}`;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}
function fmtDate(d) { if (!d) return '—'; return new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}); }
function fmtDuration(s) { if (s==null) return '—'; return `${Math.floor(s/60)}m ${s%60}s`; }

document.querySelectorAll('.modal-overlay').forEach(el => {
  el.addEventListener('click', e => { if (e.target===el) el.style.display='none'; });
});
function showAdminLogin() {
  document.getElementById('login-email').value    = 'admin@omegaTest.com';
  document.getElementById('login-password').value = 'admin123';
  showToast('Admin credentials filled.','info');
}