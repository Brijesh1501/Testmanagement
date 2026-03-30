// ========================================
// OMEGATEST - Test Management System
// Supabase-powered with local fallback
// ========================================

// ─── SUPABASE CONFIG ──────────────────
// Replace with your actual Supabase project credentials
const SUPABASE_URL = 'https://njgxevvypcqlriovzzbm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qZ3hldnZ5cGNxbHJpb3Z6emJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NzcwMDgsImV4cCI6MjA5MDQ1MzAwOH0.6kPZ_EOv15c-COfEXJhnIMAOAZh567xPegsX7Tc9joc';

// ─── LOCAL STORAGE DATABASE (Demo Mode) ──────────────────
// When Supabase is not configured, we use localStorage as a full demo
const DEMO_MODE = (SUPABASE_URL.includes('YOUR_PROJECT_ID'));

// ─── APP STATE ──────────────────
let currentUser = null;
let currentTest = null;
let testState = null;
let timerInterval = null;
let allSeries = [];
let allQuestions = [];
let allUsers = [];
let allResults = [];
let pdfParsedQuestions = [];

// ─── SAMPLE QUESTIONS FROM PDF ──────────────────
const PDF_QUESTIONS = [
  {id:1,question:"Which classification of drugs is contraindicated for the client with hypertrophic cardiomyopathy?",optionA:"Positive inotropes",optionB:"Vasodilators",optionC:"Diuretics",optionD:"Antidysrhythmics",answer:"A",explanation:"Positive inotropic agents increase myocardial contractility which increases outflow tract obstruction in hypertrophic cardiomyopathy.",subject:"NCLEX RN Nursing"},
  {id:2,question:"Signs and symptoms of an allergy attack include which of the following?",optionA:"Wheezing on inspiration",optionB:"Increased respiratory rate",optionC:"Circumoral cyanosis",optionD:"Prolonged expiration",answer:"D",explanation:"Expiration is prolonged because the alveoli are greatly distended and air trapping occurs.",subject:"NCLEX RN Nursing"},
  {id:3,question:"A client confides to the nurse that he tasted poison in his evening meal. This would be an example of what type of hallucination?",optionA:"Auditory",optionB:"Gustatory",optionC:"Olfactory",optionD:"Visceral",answer:"B",explanation:"Gustatory hallucinations involve sensory perceptions of taste.",subject:"NCLEX RN Nursing"},
  {id:4,question:"Which of the following findings would be abnormal in a postpartal woman?",optionA:"Chills shortly after delivery",optionB:"Pulse rate of 60 bpm in morning on first postdelivery day",optionC:"Urinary output of 3000 mL on the second day after delivery",optionD:"An oral temperature of 101F (38.3C) on the third day after delivery",answer:"D",explanation:"A temperature of 101°F on the third postpartum day is abnormal and may indicate infection.",subject:"NCLEX RN Nursing"},
  {id:5,question:"A six-month-old infant has been admitted to the emergency room with febrile seizures. The nurse states that:",optionA:"Sustained temperature elevation over 103F is generally related to febrile seizures",optionB:"Febrile seizures do not usually recur",optionC:"There is little risk of neurological deficit and mental retardation as sequelae to febrile seizures",optionD:"Febrile seizures are associated with diseases of the central nervous system",answer:"C",explanation:"There is indeed little risk of neurological deficit from febrile seizures.",subject:"NCLEX RN Nursing"},
  {id:6,question:"A client with AIDS has developed anorexia and weight loss. Which of the following interventions will be most helpful in improving his nutritional intake?",optionA:"Small, frequent feedings of foods that can be carried",optionB:"Tube feedings with nutritional supplements",optionC:"Allowing him to eat when and what he wants",optionD:"Giving him a quiet place where he can sit down to eat meals",answer:"A",explanation:"Small, frequent feedings of portable foods accommodates the client's energy levels and preferences.",subject:"NCLEX RN Nursing"},
  {id:7,question:"A client on lithium shows slight tremor in his left hand and slurring of speech. The nurse should:",optionA:"Administer a stat dose of lithium as necessary",optionB:"Recognize this as an expected response to lithium",optionC:"Request an order for a stat blood lithium level",optionD:"Give an oral dose of lithium antidote",answer:"C",explanation:"Tremor and slurred speech may indicate lithium toxicity; serum level should be checked immediately.",subject:"NCLEX RN Nursing"},
  {id:8,question:"Which of the following statements regarding hepatitis C is correct?",optionA:"The potential for chronic liver disease is minimal",optionB:"The onset of symptoms is abrupt",optionC:"The incubation period is 2–26 weeks",optionD:"There is an effective vaccine for hepatitis B, but not for hepatitis C",answer:"C",explanation:"Hepatitis C has an incubation period of 2-26 weeks; there is no vaccine for it.",subject:"NCLEX RN Nursing"},
  {id:9,question:"Which body system does Wernicke's encephalopathy primarily affect?",optionA:"Kidney (urinary system)",optionB:"Brain (nervous system)",optionC:"Heart (circulatory system)",optionD:"Lungs (respiratory system)",answer:"B",explanation:"Wernicke's encephalopathy is a neurological disorder caused by thiamine deficiency.",subject:"NCLEX RN Nursing"},
  {id:10,question:"Which activity is most appropriate for a manic client?",optionA:"Playing cards with other clients",optionB:"Working crossword puzzles",optionC:"Playing tennis with a staff member",optionD:"Sewing beads on a leather belt",answer:"C",explanation:"Physical activity with staff provides energy release while maintaining supervision for a manic client.",subject:"NCLEX RN Nursing"},
  {id:11,question:"A client with narcissistic personality disorder demonstrates which characteristic?",optionA:"Short, polite responses to interview questions",optionB:"Introspection related to his present situation",optionC:"Exaggerated self-importance",optionD:"Feelings of helplessness and hopelessness",answer:"C",explanation:"Exaggerated self-importance (grandiosity) is the hallmark of narcissistic personality disorder.",subject:"NCLEX RN Nursing"},
  {id:12,question:"Normal blood glucose range (fasting) is:",optionA:"70 mg/dL and 120 mg/dL",optionB:"100 mg/dL and 200 mg/dL",optionC:"40 mg/dL and 130 mg/dL",optionD:"90 mg/dL and 200 mg/dL",answer:"A",explanation:"Normal fasting blood glucose is 70-100 mg/dL; 70-120 mg/dL covers the normal postprandial range.",subject:"NCLEX RN Nursing"},
  {id:13,question:"Which statement about shock types is correct?",optionA:"In neurogenic shock, the skin is warm and dry",optionB:"In hypovolemic shock, there is bradycardia",optionC:"In hypovolemic shock, capillary refill is less than 2 seconds",optionD:"In neurogenic shock, there is delayed capillary refill",answer:"A",explanation:"Neurogenic shock causes vasodilation leading to warm, dry skin unlike hypovolemic shock.",subject:"NCLEX RN Nursing"},
  {id:14,question:"Which group has the highest risk for suicide among healthcare workers?",optionA:"Heterosexual males",optionB:"Oncology nurses",optionC:"American Indians",optionD:"Jehovah's Witnesses",answer:"B",explanation:"Oncology nurses face extreme stress exposure to death and suffering, increasing suicide risk.",subject:"NCLEX RN Nursing"},
  {id:15,question:"A client who attributes his own faults to others is using which defense mechanism?",optionA:"Displacement",optionB:"Projection",optionC:"Reaction formation",optionD:"Suppression",answer:"B",explanation:"Projection involves attributing one's own unacceptable thoughts or feelings to others.",subject:"NCLEX RN Nursing"},
  {id:16,question:"Which STI is characterized by painless chancre as its primary lesion?",optionA:"Chlamydia",optionB:"Herpes genitalis",optionC:"Syphilis",optionD:"Gonorrhea",answer:"C",explanation:"The painless chancre (hard ulcer) is the hallmark primary lesion of syphilis.",subject:"NCLEX RN Nursing"},
  {id:17,question:"A client with COPD is experiencing difficulty breathing. The most effective nursing action is:",optionA:"Increase his nasal O2 to 6 L/min",optionB:"Place him in a lateral Sims' position",optionC:"Encourage pursed-lip breathing",optionD:"Have him breathe into a paper bag",answer:"C",explanation:"Pursed-lip breathing helps slow exhalation and reduces air trapping in COPD.",subject:"NCLEX RN Nursing"},
  {id:18,question:"To detect tension pneumothorax, the priority assessment is:",optionA:"Auscultating bilateral breath sounds",optionB:"Palpating for presence of crepitus",optionC:"Palpating for tracheal deviation",optionD:"Auscultating heart sounds",answer:"C",explanation:"Tracheal deviation away from the affected side indicates tension pneumothorax.",subject:"NCLEX RN Nursing"},
  {id:19,question:"Classic signs of right-sided heart failure include:",optionA:"Elevated central venous pressure and peripheral edema",optionB:"Dyspnea and jaundice",optionC:"Hypotension and hepatomegaly",optionD:"Decreased peripheral perfusion and rales",answer:"A",explanation:"Right-sided heart failure causes backup into systemic circulation, causing elevated CVP and peripheral edema.",subject:"NCLEX RN Nursing"},
  {id:20,question:"Mitral stenosis leads to which hemodynamic consequence?",optionA:"Decreased pulmonary blood flow and cyanosis",optionB:"Increased pressure in the pulmonary veins and pulmonary edema",optionC:"Systemic venous engorgement",optionD:"Increased left ventricular systolic pressures and hypertrophy",answer:"B",explanation:"Mitral stenosis obstructs flow from lungs to LV, increasing pulmonary venous pressure and causing pulmonary edema.",subject:"NCLEX RN Nursing"},
  {id:21,question:"Secondary syphilis is characterized by:",optionA:"A decreased urinary output and flank pain",optionB:"A fever of over 103°F occurring over the last 2–3 weeks",optionC:"Rashes covering the palms of the hands and the soles of the feet",optionD:"Headaches, malaise, or sore throat",answer:"D",explanation:"Secondary syphilis presents with flu-like symptoms; the rash on palms/soles is a key feature but headache and malaise are systemic hallmarks.",subject:"NCLEX RN Nursing"},
  {id:22,question:"Stevens-Johnson syndrome is most commonly associated with which drug class?",optionA:"Stephens-Johnson syndrome",optionB:"Folate deficiency",optionC:"Leukopenic aplastic anemia",optionD:"Granulocytosis and nephrosis",answer:"A",explanation:"Anticonvulsants and sulfonamides are common triggers of Stevens-Johnson syndrome.",subject:"NCLEX RN Nursing"},
  {id:23,question:"The most important prognostic factor in breast cancer is:",optionA:"Tumor size",optionB:"Axillary node status",optionC:"Client's previous history of disease",optionD:"Client's level of estrogen-progesterone receptor assays",answer:"B",explanation:"Axillary lymph node status is the single most important prognostic factor in breast cancer.",subject:"NCLEX RN Nursing"},
  {id:24,question:"A suicidal client says he feels worthless. The best therapeutic response is:",optionA:"I don't think you are worthless. I'm glad to see you, and we will help you.",optionB:"Don't you think this is a sign of your illness?",optionC:"I know with your wife and new baby that you do have a lot to live for.",optionD:"You've been feeling sad and alone for some time now?",answer:"D",explanation:"Reflecting the client's feelings using open-ended statements encourages further expression and shows empathy.",subject:"NCLEX RN Nursing"},
  {id:25,question:"Client education for someone recovering from hepatitis A should include:",optionA:"He should take aspirin as needed for muscle and joint pain",optionB:"He may become a blood donor when his liver enzymes return to normal",optionC:"He should avoid alcoholic beverages during his recovery period",optionD:"He should use disposable dishes for eating and drinking",answer:"C",explanation:"Alcohol is hepatotoxic and must be avoided during hepatitis recovery to prevent further liver damage.",subject:"NCLEX RN Nursing"},
  {id:26,question:"Priority treatment for a hydrofluoric acid chemical burn is:",optionA:"Irrigate the area with neutralizing solutions",optionB:"Flush the exposed area with large amounts of water",optionC:"Inject calcium chloride into the burned area",optionD:"Apply lanolin ointment to the area",answer:"B",explanation:"Immediate copious water flushing is the first-line treatment for all chemical burns.",subject:"NCLEX RN Nursing"},
  {id:27,question:"The recommended macronutrient distribution for a client with type 2 diabetes is:",optionA:"50% complex carbohydrate, 20–25% protein, 20–25% fat",optionB:"45% complex carbohydrate, 25–30% protein, 30–35% fat",optionC:"70% complex carbohydrate, 20–30% protein, 10–20% fat",optionD:"60% complex carbohydrate, 12–15% protein, 20–25% fat",answer:"D",explanation:"The ADA recommends approximately 60% carbohydrate, 12-15% protein, and 20-25% fat for diabetics.",subject:"NCLEX RN Nursing"},
  {id:28,question:"The primary purpose of a pressure garment in burn rehabilitation is to:",optionA:"Decrease hypertrophic scar formation",optionB:"Assist with ambulation",optionC:"Cover burn scars and decrease psychological impact",optionD:"Increase venous return and cardiac output",answer:"A",explanation:"Pressure garments apply continuous pressure to control and prevent hypertrophic scar formation.",subject:"NCLEX RN Nursing"},
  {id:29,question:"The treatment of choice for coccidioidomycosis is:",optionA:"Complete bed rest for 6–8 weeks",optionB:"Tetracycline treatment",optionC:"IV amphotericin B",optionD:"High-protein diet with limited fluids",answer:"C",explanation:"Amphotericin B is the primary antifungal agent used for systemic coccidioidomycosis.",subject:"NCLEX RN Nursing"},
  {id:30,question:"A pregnant client refuses hospitalization despite physician advice. The nurse should:",optionA:"Stress to the client that her husband would want her to do what is best for her health",optionB:"Explore with the client her perceptions of why she is unable to go to the hospital",optionC:"Repeat the physician's reasons for advising immediate hospitalization",optionD:"Explain to the client that she is ultimately responsible for her own welfare",answer:"B",explanation:"Exploring the client's perceptions respects autonomy while identifying potential barriers to care.",subject:"NCLEX RN Nursing"},
  {id:31,question:"A client receiving magnesium sulfate shows decreased urine output. The initial nursing intervention is:",optionA:"Discontinue the IV",optionB:"Stop the medication, and begin a normal saline infusion",optionC:"Take all vital signs, and report to the physician",optionD:"Assess urinary output, and if it is 30 mL an hour, maintain current treatment",answer:"B",explanation:"Decreased urine output with mag sulfate indicates possible toxicity; stop infusion and give saline.",subject:"NCLEX RN Nursing"},
  {id:32,question:"What is the maximum Apgar score at 1 minute for a newborn to be considered normal?",optionA:"7",optionB:"10",optionC:"8",optionD:"9",answer:"B",explanation:"The maximum Apgar score is 10 (2 points each for 5 criteria); 7-10 is considered normal.",subject:"NCLEX RN Nursing"},
  {id:33,question:"The primary purpose of magnesium sulfate in preeclampsia is:",optionA:"Prevention of seizures",optionB:"Prevention of uterine contractions",optionC:"Sedation",optionD:"Fetal lung protection",answer:"A",explanation:"Magnesium sulfate is used as an anticonvulsant to prevent seizures (eclampsia) in preeclampsia.",subject:"NCLEX RN Nursing"},
  {id:34,question:"Sinus tachycardia most commonly occurs with occlusion of which coronary artery?",optionA:"Right coronary artery",optionB:"Left main coronary artery",optionC:"Circumflex coronary artery",optionD:"Left anterior descending coronary artery",answer:"A",explanation:"The right coronary artery supplies the SA node; occlusion affects heart rate regulation.",subject:"NCLEX RN Nursing"},
  {id:35,question:"Which finding best reflects hemoconcentration in the postburn phase?",optionA:"Elevated serum sodium",optionB:"Elevated serum calcium",optionC:"Elevated serum protein",optionD:"Elevated hematocrit",answer:"D",explanation:"Elevated hematocrit reflects hemoconcentration as plasma shifts out of vessels in the burn response.",subject:"NCLEX RN Nursing"},
  {id:36,question:"The most important breast cancer screening tool recommended for all women is:",optionA:"Mammograms every 3 years",optionB:"Yearly checkups performed by physician",optionC:"Ultrasounds every 3 years",optionD:"Monthly breast self-examination",answer:"D",explanation:"Monthly breast self-examination enables early detection of changes between professional screenings.",subject:"NCLEX RN Nursing"},
  {id:37,question:"For a client with cervical spine injury, what is the highest priority intervention?",optionA:"Stabilization of the cervical spine",optionB:"Airway assessment and stabilization",optionC:"Confirmation of spinal cord injury",optionD:"Normalization of intravascular volume",answer:"B",explanation:"Airway takes priority in all emergency situations (ABCs: Airway first).",subject:"NCLEX RN Nursing"},
  {id:38,question:"A common side effect of sublingual nitroglycerin is:",optionA:"Stinging, burning when placed under the tongue",optionB:"Temporary blurring of vision",optionC:"Generalized urticaria with prolonged use",optionD:"Urinary frequency",answer:"A",explanation:"Sublingual nitroglycerin typically causes a stinging/burning sensation under the tongue when effective.",subject:"NCLEX RN Nursing"},
  {id:39,question:"The priority nursing intervention for a client with subarachnoid hemorrhage is:",optionA:"Maintaining seizure precautions",optionB:"Restricting fluid intake",optionC:"Increasing sensory stimuli",optionD:"Applying ankle and wrist restraints",answer:"A",explanation:"Seizure precautions are essential as subarachnoid hemorrhage frequently triggers seizure activity.",subject:"NCLEX RN Nursing"},
  {id:40,question:"Which response is most therapeutic for a depressed client who says he feels hopeless?",optionA:"It concerns me that you feel so badly when you have so many positive things in your life.",optionB:"It will take a few weeks for you to feel better, so you need to be patient.",optionC:"You are telling me that you are feeling hopeless at this point?",optionD:"Let's play cards with some of the other clients to get your mind off your problems for now.",answer:"C",explanation:"Reflecting and clarifying feelings validates the client's experience and encourages further communication.",subject:"NCLEX RN Nursing"},
  {id:41,question:"Which instruction is correct for a client self-administering insulin glargine?",optionA:"Weigh once a week and report any weight gain of 10 lb",optionB:"Limit fluid intake to 500 mL/day",optionC:"Store the medication in a refrigerator and allow to stand at room temperature for 30 minutes",optionD:"Hold the vial under warm water for 10–15 minutes and shake vigorously before drawing medication",answer:"D",explanation:"Insulin that has been refrigerated should be warmed before use; shaking ensures uniform suspension.",subject:"NCLEX RN Nursing"},
  {id:42,question:"Correct positioning after hip replacement surgery includes:",optionA:"Both hips flexed at a 90-degree angle with the knees extended and the buttocks elevated",optionB:"Both legs extended, and the hips are not flexed",optionC:"The affected leg extended with slight hip flexion",optionD:"Both hips and knees maintained at a 90-degree flexion angle, and the back flat on the bed",answer:"A",explanation:"After hip replacement, maintaining 90-degree hip flexion with extended knees prevents dislocation.",subject:"NCLEX RN Nursing"},
  {id:43,question:"The primary purpose of the Apgar score is to:",optionA:"Determine gross abnormal motor function",optionB:"Obtain a baseline for comparison with the infant's future adaptation",optionC:"Evaluate the infant's vital functions",optionD:"Determine the extent of congenital malformations",answer:"C",explanation:"The Apgar score evaluates five vital signs to assess the newborn's physiological status at birth.",subject:"NCLEX RN Nursing"},
  {id:44,question:"Battle's sign (bruising behind the ear) indicates:",optionA:"Basilar skull fracture",optionB:"Subdural hematoma",optionC:"Epidural hematoma",optionD:"Frontal lobe fracture",answer:"A",explanation:"Battle's sign is ecchymosis over the mastoid process and is a classic sign of basilar skull fracture.",subject:"NCLEX RN Nursing"},
  {id:45,question:"Which factor is the greatest risk for developing breast cancer?",optionA:"Menarche after age 13",optionB:"Nulliparity",optionC:"Maternal family history of breast cancer",optionD:"Early menopause",answer:"C",explanation:"First-degree family history (mother/sister) of breast cancer significantly increases risk.",subject:"NCLEX RN Nursing"},
  {id:46,question:"A client gains 10 lb in 2 months during pregnancy with normal exam. The nurse interprets this as:",optionA:"She is compliant with her diet as previously taught",optionB:"She needs further instruction and reinforcement",optionC:"She needs to increase her caloric intake",optionD:"She needs to be placed on a restrictive diet immediately",answer:"B",explanation:"10 lb weight gain in 2 months during pregnancy is excessive; further dietary teaching is needed.",subject:"NCLEX RN Nursing"},
  {id:47,question:"The priority nursing goal when working with an autistic child is:",optionA:"To establish trust with the child",optionB:"To maintain communication with the family",optionC:"To promote involvement in school activities",optionD:"To maintain nutritional requirements",answer:"A",explanation:"Building a trusting relationship is the foundation for all therapeutic interventions with autistic children.",subject:"NCLEX RN Nursing"},
  {id:48,question:"Which medication requires monitoring of serum glucose due to its effects on glycogenolysis and insulin release?",optionA:"Norepinephrine (Levophed)",optionB:"Dobutamine (Dobutrex)",optionC:"Propranolol (Inderal)",optionD:"Epinephrine (Adrenalin)",answer:"D",explanation:"Epinephrine stimulates glycogenolysis and inhibits insulin release, causing hyperglycemia.",subject:"NCLEX RN Nursing"},
  {id:49,question:"When explaining exercise ECG to a client, the nurse's response should be based on:",optionA:"The test provides a baseline for further tests",optionB:"The procedure simulates usual daily activity and myocardial performance",optionC:"The client can be monitored while cardiac conditioning and heart toning are done",optionD:"Ischemia can be diagnosed because exercise increases myocardial oxygen demand",answer:"D",explanation:"Exercise stress testing reveals ischemia by increasing myocardial oxygen demand, unmasking coronary artery disease.",subject:"NCLEX RN Nursing"},
  {id:50,question:"Which medication would most likely elevate serum digoxin levels?",optionA:"KCl",optionB:"Thyroid agents",optionC:"Quinidine",optionD:"Theophylline",answer:"C",explanation:"Quinidine displaces digoxin from tissue binding sites and reduces renal clearance, raising digoxin levels.",subject:"NCLEX RN Nursing"}
];

// ─── INIT ──────────────────
window.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  const savedUser = localStorage.getItem('omega_current_user');
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    showApp();
  } else {
    showPage('login-page');
  }
  initDB();
}

// ─── LOCAL DB ──────────────────
function initDB() {
  if (!localStorage.getItem('omega_users')) {
    localStorage.setItem('omega_users', JSON.stringify([
      { id: 'admin-001', name: 'Admin', email: 'admin@omegaTest.com', password: 'admin123', role: 'admin', createdAt: new Date().toISOString() }
    ]));
  }
  if (!localStorage.getItem('omega_series')) {
    const series = [
      { id: 's1', name: 'NCLEX RN Mock Test 1', description: 'Comprehensive NCLEX RN practice with 50 real exam questions covering pharmacology, medical-surgical, and psychiatric nursing.', duration: 60, totalQuestions: 50, subject: 'NCLEX RN Nursing', active: true, createdAt: new Date().toISOString() },
      { id: 's2', name: 'Medical-Surgical Nursing', description: 'Focused assessment covering medical-surgical nursing concepts including cardiac, respiratory, and gastrointestinal disorders.', duration: 45, totalQuestions: 50, subject: 'Medical-Surgical', active: true, createdAt: new Date().toISOString() },
      { id: 's3', name: 'Psychiatric Nursing', description: 'Mental health nursing test covering psychiatric disorders, therapeutic communication, and psychotropic medications.', duration: 50, totalQuestions: 50, subject: 'Psychiatric Nursing', active: false, createdAt: new Date().toISOString() }
    ];
    localStorage.setItem('omega_series', JSON.stringify(series));
  }
  if (!localStorage.getItem('omega_questions')) {
    const questions = PDF_QUESTIONS.map(q => ({ ...q, seriesId: 's1' }));
    localStorage.setItem('omega_questions', JSON.stringify(questions));
  }
  if (!localStorage.getItem('omega_results')) localStorage.setItem('omega_results', JSON.stringify([]));
}

function getDB(key) { return JSON.parse(localStorage.getItem(key) || '[]'); }
function setDB(key, data) { localStorage.setItem(key, JSON.stringify(data)); }

// ─── AUTH ──────────────────
function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim().toLowerCase();
  const password = document.getElementById('login-password').value;
  const users = getDB('omega_users');
  const user = users.find(u => u.email.toLowerCase() === email && u.password === password);
  if (!user) { showError('login-error', 'Invalid email or password.'); return; }
  loginUser(user);
}

function loginUser(user) {
  currentUser = user;
  localStorage.setItem('omega_current_user', JSON.stringify(user));
  showApp();
}

function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim().toLowerCase();
  const password = document.getElementById('reg-password').value;
  const users = getDB('omega_users');
  if (users.find(u => u.email.toLowerCase() === email)) { showError('register-error', 'Email already registered.'); return; }
  const newUser = { id: 'u-' + Date.now(), name, email, password, role: 'student', createdAt: new Date().toISOString() };
  users.push(newUser);
  setDB('omega_users', users);
  loginUser(newUser);
}

function handleLogout() {
  currentUser = null;
  localStorage.removeItem('omega_current_user');
  document.getElementById('app-container').style.display = 'none';
  document.getElementById('auth-container').style.display = '';
  showPage('login-page');
}

function showAdminLogin() {
  document.getElementById('login-email').value = 'admin@omegaTest.com';
  document.getElementById('login-password').value = 'admin123';
  showToast('Admin credentials filled!', 'info');
}

// ─── APP SHELL ──────────────────
function showApp() {
  document.getElementById('auth-container').style.display = 'none';
  document.getElementById('app-container').style.display = '';
  updateSidebar();
  if (currentUser.role === 'admin') {
    document.getElementById('admin-nav-section').style.display = '';
  }
  navigateTo('dashboard');
}

function updateSidebar() {
  const name = currentUser.name || currentUser.email;
  document.getElementById('user-name-sidebar').textContent = name;
  document.getElementById('user-role-badge').textContent = currentUser.role === 'admin' ? 'Administrator' : 'Student';
  document.getElementById('user-avatar').textContent = name[0].toUpperCase();
}

function navigateTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const pageEl = document.getElementById('page-' + page);
  if (pageEl) pageEl.classList.add('active');
  const navEl = document.getElementById('nav-' + page);
  if (navEl) navEl.classList.add('active');

  if (page === 'dashboard') loadDashboard();
  if (page === 'tests') loadTestSeries();
  if (page === 'results') loadResults();
  if (page === 'profile') loadProfile();
  if (page === 'admin-dashboard') loadAdminDashboard();
  if (page === 'admin-users') loadAdminUsers();
  if (page === 'admin-series') loadAdminSeries();
  if (page === 'admin-questions') loadAdminQuestions();
}

// ─── DASHBOARD ──────────────────
function loadDashboard() {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  document.getElementById('dash-greeting').textContent = `${greeting}, ${currentUser.name}! 👋`;

  const results = getDB('omega_results').filter(r => r.userId === currentUser.id);
  const totalTests = results.length;
  const avgScore = totalTests > 0 ? Math.round(results.reduce((a, r) => a + r.percentage, 0) / totalTests) : 0;
  const bestScore = totalTests > 0 ? Math.max(...results.map(r => r.percentage)) : 0;
  const totalQ = results.reduce((a, r) => a + r.totalQuestions, 0);

  document.getElementById('dash-stats').innerHTML = `
    ${statCard('Total Tests', totalTests, '#3b82f6', `<path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>`)}
    ${statCard('Avg Score', avgScore + '%', '#10b981', `<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>`)}
    ${statCard('Best Score', bestScore + '%', '#f59e0b', `<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>`)}
    ${statCard('Qs Attempted', totalQ, '#06b6d4', `<circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>`)}
  `;

  // Recent attempts
  const recent = results.slice(-5).reverse();
  if (recent.length > 0) {
    document.getElementById('dash-recent-attempts').innerHTML = recent.map(r => `
      <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);">
        <div style="width:40px;height:40px;border-radius:10px;background:${r.percentage>=60?'rgba(16,185,129,0.15)':'rgba(239,68,68,0.15)'};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:${r.percentage>=60?'#10b981':'#ef4444'};">${r.percentage}%</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${r.seriesName}</div>
          <div style="font-size:11px;color:var(--muted);">${r.correct}/${r.totalQuestions} correct · ${formatDate(r.date)}</div>
        </div>
        <span class="badge ${r.percentage>=60?'badge-green':'badge-red'}">${r.percentage>=60?'Pass':'Fail'}</span>
      </div>
    `).join('');
  }

  // Performance trend
  if (results.length >= 2) {
    const trend = results.slice(-6);
    const bars = trend.map(r => `
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;">
        <div style="font-size:10px;color:var(--muted);">${r.percentage}%</div>
        <div style="width:28px;border-radius:4px 4px 0 0;background:linear-gradient(to top,#3b82f6,#06b6d4);height:${r.percentage}px;max-height:80px;min-height:4px;"></div>
        <div style="font-size:9px;color:var(--muted);text-align:center;">${r.seriesName.substring(0,8)}</div>
      </div>
    `).join('');
    document.getElementById('dash-performance').innerHTML = `<div style="display:flex;align-items:flex-end;gap:6px;height:110px;padding:8px 0;">${bars}</div>`;
  }
}

function statCard(label, value, color, iconPath) {
  return `<div class="stat-card">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
      <div style="width:36px;height:36px;border-radius:9px;background:${color}22;display:flex;align-items:center;justify-content:center;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2">${iconPath}</svg>
      </div>
    </div>
    <div style="font-size:26px;font-weight:800;margin-bottom:4px;">${value}</div>
    <div style="font-size:12px;color:var(--muted);">${label}</div>
  </div>`;
}

// ─── TEST SERIES ──────────────────
function loadTestSeries() {
  allSeries = getDB('omega_series').filter(s => s.active);
  allQuestions = getDB('omega_questions');
  const grid = document.getElementById('test-series-grid');
  if (!allSeries.length) {
    grid.innerHTML = '<div style="text-align:center;padding:60px;color:var(--muted);grid-column:1/-1;">No test series available yet.</div>';
    return;
  }
  grid.innerHTML = allSeries.map(s => {
    const qCount = allQuestions.filter(q => q.seriesId === s.id).length;
    const userResults = getDB('omega_results').filter(r => r.userId === currentUser.id && r.seriesId === s.id);
    const attempts = userResults.length;
    const bestScore = attempts > 0 ? Math.max(...userResults.map(r => r.percentage)) : null;
    return `
    <div class="glass p-6 flex flex-col" style="cursor:default;transition:all 0.2s;" onmouseenter="this.style.transform='translateY(-4px)';this.style.borderColor='var(--accent)'" onmouseleave="this.style.transform='';this.style.borderColor=''">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <div style="width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#3b82f6,#06b6d4);display:flex;align-items:center;justify-content:center;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
        </div>
        ${bestScore !== null ? `<span class="badge badge-green">Best: ${bestScore}%</span>` : '<span class="badge badge-blue">New</span>'}
      </div>
      <h3 style="font-size:16px;font-weight:700;margin-bottom:8px;line-height:1.3;">${s.name}</h3>
      <p style="font-size:13px;color:var(--muted);line-height:1.6;flex:1;margin-bottom:16px;">${s.description}</p>
      <div style="display:flex;gap:16px;margin-bottom:16px;font-size:12px;color:var(--muted);">
        <span>⏱ ${s.duration} min</span>
        <span>📝 ${qCount}/${s.totalQuestions} Qs</span>
        <span>🏷 ${s.subject}</span>
        ${attempts > 0 ? `<span>🔄 ${attempts} attempts</span>` : ''}
      </div>
      <button onclick="startTest('${s.id}')" class="btn-primary" style="width:100%;" ${qCount === 0 ? 'disabled' : ''}>
        ${qCount === 0 ? 'No Questions Yet' : attempts > 0 ? 'Retake Test' : 'Start Test'}
      </button>
    </div>`;
  }).join('');
}

// ─── TEST ENGINE ──────────────────
function startTest(seriesId) {
  const series = getDB('omega_series').find(s => s.id === seriesId);
  const questions = getDB('omega_questions').filter(q => q.seriesId === seriesId);
  if (!questions.length) { showToast('No questions in this series!', 'error'); return; }

  const shuffled = [...questions].sort(() => Math.random() - 0.5).slice(0, series.totalQuestions);

  currentTest = series;
  testState = {
    questions: shuffled,
    answers: new Array(shuffled.length).fill(null),
    marked: new Array(shuffled.length).fill(false),
    currentIndex: 0,
    startTime: Date.now(),
    totalSeconds: series.duration * 60,
    remainingSeconds: series.duration * 60,
    submitted: false
  };

  document.getElementById('test-interface').style.display = '';
  document.getElementById('test-title').textContent = series.name;
  renderQuestion();
  buildPalette();
  startTimer();
}

function renderQuestion() {
  const { questions, answers, currentIndex } = testState;
  const q = questions[currentIndex];
  const total = questions.length;

  document.getElementById('q-num-badge').textContent = 'Q' + (currentIndex + 1);
  document.getElementById('question-text').textContent = q.question;
  document.getElementById('test-q-counter').textContent = `${currentIndex + 1}/${total}`;
  document.getElementById('test-progress-bar').style.width = ((currentIndex + 1) / total * 100) + '%';

  const isLast = currentIndex === total - 1;
  document.getElementById('next-btn').style.display = isLast ? 'none' : '';
  document.getElementById('submit-btn').style.display = isLast ? '' : 'none';
  document.getElementById('prev-btn').disabled = currentIndex === 0;

  // Mark button state
  const marked = testState.marked[currentIndex];
  document.getElementById('mark-btn').style.background = marked ? 'rgba(245,158,11,0.2)' : '';
  document.getElementById('mark-btn').style.borderColor = marked ? '#f59e0b' : '';
  document.getElementById('mark-btn').style.color = marked ? '#f59e0b' : '';

  const opts = document.getElementById('options-container');
  opts.innerHTML = ['A', 'B', 'C', 'D'].map(letter => {
    const text = q['option' + letter];
    const selected = answers[currentIndex] === letter;
    return `<button class="option-btn ${selected ? 'selected' : ''}" onclick="selectAnswer('${letter}')">
      <span class="option-label" style="${selected ? 'background:var(--accent);color:white;' : ''}">${letter}</span>
      <span>${text}</span>
    </button>`;
  }).join('');

  document.getElementById('explanation-box').classList.add('hidden');
}

function selectAnswer(letter) {
  if (testState.submitted) return;
  testState.answers[testState.currentIndex] = letter;
  updatePaletteBtn(testState.currentIndex);

  const opts = document.querySelectorAll('.option-btn');
  opts.forEach((btn, i) => {
    const l = ['A','B','C','D'][i];
    btn.classList.toggle('selected', l === letter);
    const label = btn.querySelector('.option-label');
    label.style.background = l === letter ? 'var(--accent)' : '';
    label.style.color = l === letter ? 'white' : '';
  });
}

function nextQuestion() {
  if (testState.currentIndex < testState.questions.length - 1) {
    testState.currentIndex++;
    renderQuestion();
    updatePaletteActive();
  }
}

function prevQuestion() {
  if (testState.currentIndex > 0) {
    testState.currentIndex--;
    renderQuestion();
    updatePaletteActive();
  }
}

function markForReview() {
  testState.marked[testState.currentIndex] = !testState.marked[testState.currentIndex];
  renderQuestion();
  updatePaletteBtn(testState.currentIndex);
}

function buildPalette() {
  const palette = document.getElementById('q-palette');
  palette.innerHTML = testState.questions.map((_, i) => `
    <button class="q-nav-btn ${i === 0 ? 'current' : ''}" id="pq-${i}" onclick="jumpToQuestion(${i})">${i+1}</button>
  `).join('');
}

function updatePaletteBtn(index) {
  const btn = document.getElementById('pq-' + index);
  if (!btn) return;
  const answered = testState.answers[index] !== null;
  const marked = testState.marked[index];
  const current = index === testState.currentIndex;
  btn.className = 'q-nav-btn';
  if (current) btn.classList.add('current');
  else if (marked) { btn.style.background = 'rgba(245,158,11,0.2)'; btn.style.borderColor = '#f59e0b'; btn.style.color = '#f59e0b'; return; }
  else if (answered) btn.classList.add('answered');
  btn.style.background = '';
  btn.style.borderColor = '';
  btn.style.color = '';
}

function updatePaletteActive() {
  testState.questions.forEach((_, i) => updatePaletteBtn(i));
}

function jumpToQuestion(index) {
  testState.currentIndex = index;
  renderQuestion();
  updatePaletteActive();
}

// ─── TIMER ──────────────────
function startTimer() {
  clearInterval(timerInterval);
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    testState.remainingSeconds--;
    updateTimerDisplay();
    if (testState.remainingSeconds <= 0) {
      clearInterval(timerInterval);
      submitTest(true);
    }
  }, 1000);
}

function updateTimerDisplay() {
  const s = testState.remainingSeconds;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  const label = `${m}:${sec.toString().padStart(2,'0')}`;
  document.getElementById('timer-display').textContent = label;
  document.getElementById('timer-display').style.color = s <= 60 ? '#ef4444' : s <= 300 ? '#f59e0b' : 'var(--text)';

  // Ring
  const pct = s / testState.totalSeconds;
  const circumference = 163.36;
  const offset = circumference * (1 - pct);
  const ring = document.getElementById('timer-ring');
  ring.setAttribute('stroke-dashoffset', offset);
  ring.setAttribute('stroke', s <= 60 ? '#ef4444' : s <= 300 ? '#f59e0b' : '#3b82f6');
}

// ─── SUBMIT TEST ──────────────────
function confirmSubmitTest() {
  const answered = testState.answers.filter(a => a !== null).length;
  const total = testState.questions.length;
  const unanswered = total - answered;
  showConfirm(
    'Submit Test',
    unanswered > 0
      ? `You have ${unanswered} unanswered question${unanswered > 1 ? 's' : ''}. Are you sure you want to submit?`
      : 'You have answered all questions. Ready to submit?',
    () => submitTest(false),
    '⚠️'
  );
}

function submitTest(timeUp = false) {
  clearInterval(timerInterval);
  testState.submitted = true;

  const { questions, answers, startTime } = testState;
  let correct = 0, incorrect = 0, skipped = 0;

  questions.forEach((q, i) => {
    if (!answers[i]) skipped++;
    else if (answers[i] === q.answer) correct++;
    else incorrect++;
  });

  const timeTaken = Math.floor((Date.now() - startTime) / 1000);
  const percentage = Math.round((correct / questions.length) * 100);

  const result = {
    id: 'r-' + Date.now(),
    userId: currentUser.id,
    seriesId: currentTest.id,
    seriesName: currentTest.name,
    correct, incorrect, skipped,
    totalQuestions: questions.length,
    percentage,
    timeTaken,
    date: new Date().toISOString(),
    questions: questions.map((q, i) => ({
      question: q.question,
      userAnswer: answers[i],
      correctAnswer: q.answer,
      options: { A: q.optionA, B: q.optionB, C: q.optionC, D: q.optionD },
      explanation: q.explanation || '',
      isCorrect: answers[i] === q.answer
    }))
  };

  const results = getDB('omega_results');
  results.push(result);
  setDB('omega_results', results);

  document.getElementById('test-interface').style.display = 'none';
  showResultScreen(result);
}

function confirmExitTest() {
  showConfirm('Exit Test', 'Your progress will be lost. Are you sure you want to exit?', () => {
    clearInterval(timerInterval);
    document.getElementById('test-interface').style.display = 'none';
    navigateTo('tests');
  }, '🚪');
}

// ─── RESULT SCREEN ──────────────────
function showResultScreen(result) {
  document.getElementById('result-screen').style.display = '';
  document.getElementById('result-test-name').textContent = result.seriesName;
  document.getElementById('result-score-pct').textContent = result.percentage + '%';
  document.getElementById('res-correct').textContent = result.correct;
  document.getElementById('res-incorrect').textContent = result.incorrect;
  document.getElementById('res-skipped').textContent = result.skipped;
  document.getElementById('res-time').textContent = formatDuration(result.timeTaken);

  // Score ring animation
  const ring = document.getElementById('score-ring');
  const circumference = 439.82;
  ring.setAttribute('stroke', result.percentage >= 60 ? '#10b981' : result.percentage >= 40 ? '#f59e0b' : '#ef4444');
  setTimeout(() => {
    ring.setAttribute('stroke-dashoffset', circumference * (1 - result.percentage / 100));
  }, 100);

  document.getElementById('result-score-pct').style.color = result.percentage >= 60 ? '#10b981' : result.percentage >= 40 ? '#f59e0b' : '#ef4444';
  document.getElementById('answer-review-section').style.display = 'none';

  // Store for review
  window._lastResult = result;
}

function showAnswerReview() {
  const result = window._lastResult;
  document.getElementById('answer-review-section').style.display = '';
  document.getElementById('answer-review-list').innerHTML = result.questions.map((q, i) => `
    <div class="glass p-5" style="border-left:3px solid ${q.isCorrect ? '#10b981' : q.userAnswer ? '#ef4444' : '#f59e0b'};">
      <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:8px;">Question ${i+1} · ${q.isCorrect ? '✅ Correct' : q.userAnswer ? '❌ Incorrect' : '⏭ Skipped'}</div>
      <p style="font-size:14px;font-weight:500;margin-bottom:12px;line-height:1.6;">${q.question}</p>
      <div class="grid grid-cols-2 gap-2 mb-3">
        ${['A','B','C','D'].map(l => `
          <div style="padding:8px 12px;border-radius:8px;font-size:13px;
            background:${l === q.correctAnswer ? 'rgba(16,185,129,0.15)' : l === q.userAnswer && !q.isCorrect ? 'rgba(239,68,68,0.1)' : 'var(--surface2)'};
            border:1px solid ${l === q.correctAnswer ? 'rgba(16,185,129,0.4)' : l === q.userAnswer && !q.isCorrect ? 'rgba(239,68,68,0.3)' : 'var(--border)'};
            color:${l === q.correctAnswer ? '#10b981' : l === q.userAnswer && !q.isCorrect ? '#ef4444' : 'var(--text)'};">
            <strong>${l}.</strong> ${q.options[l]}
          </div>`).join('')}
      </div>
      ${q.explanation ? `<div style="font-size:13px;color:#60a5fa;background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.2);border-radius:8px;padding:10px;line-height:1.6;"><strong>Explanation:</strong> ${q.explanation}</div>` : ''}
    </div>
  `).join('');
}

function closeResultScreen() {
  document.getElementById('result-screen').style.display = 'none';
  navigateTo('dashboard');
}

// ─── RESULTS PAGE ──────────────────
function loadResults() {
  const results = getDB('omega_results').filter(r => r.userId === currentUser.id).reverse();
  window._allResultsCache = results;
  renderResultsTable(results);
}

function renderResultsTable(results) {
  const body = document.getElementById('results-body');
  if (!results.length) {
    body.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--muted);">No results found. Take a test to see results here.</td></tr>';
    return;
  }
  body.innerHTML = results.map(r => `
    <tr>
      <td><div style="font-weight:600;font-size:13px;">${r.seriesName}</div></td>
      <td><div style="font-size:16px;font-weight:800;color:${r.percentage>=60?'#10b981':r.percentage>=40?'#f59e0b':'#ef4444'}">${r.percentage}%</div></td>
      <td><span class="mono" style="font-size:13px;">${r.correct}/${r.totalQuestions}</span></td>
      <td style="font-size:13px;color:var(--muted);">${formatDuration(r.timeTaken)}</td>
      <td style="font-size:13px;color:var(--muted);">${formatDate(r.date)}</td>
      <td><span class="badge ${r.percentage>=60?'badge-green':'badge-red'}">${r.percentage>=60?'Pass':'Fail'}</span></td>
      <td><button onclick="viewResult('${r.id}')" class="btn-success">View</button></td>
    </tr>
  `).join('');
}

function filterResults(query) {
  const q = query.toLowerCase();
  const filtered = (window._allResultsCache || []).filter(r => r.seriesName.toLowerCase().includes(q));
  renderResultsTable(filtered);
}

function viewResult(id) {
  const result = getDB('omega_results').find(r => r.id === id);
  if (result) { showResultScreen(result); showAnswerReview(); }
}

// ─── PROFILE ──────────────────
function loadProfile() {
  const user = currentUser;
  const name = user.name || '';
  document.getElementById('profile-avatar').textContent = name[0]?.toUpperCase() || 'U';
  document.getElementById('profile-name').textContent = name;
  document.getElementById('profile-email').textContent = user.email;
  document.getElementById('profile-role-badge').textContent = user.role === 'admin' ? 'Administrator' : 'Student';
  document.getElementById('edit-name').value = name;
  document.getElementById('edit-email').value = user.email;

  const results = getDB('omega_results').filter(r => r.userId === user.id);
  const totalTests = results.length;
  const avgScore = totalTests > 0 ? Math.round(results.reduce((a, r) => a + r.percentage, 0) / totalTests) : 0;
  const bestScore = totalTests > 0 ? Math.max(...results.map(r => r.percentage)) : 0;
  const passRate = totalTests > 0 ? Math.round(results.filter(r => r.percentage >= 60).length / totalTests * 100) : 0;

  document.getElementById('profile-stats').innerHTML = `
    ${statCard('Tests Taken', totalTests, '#3b82f6', `<path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>`)}
    ${statCard('Avg Score', avgScore + '%', '#10b981', `<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>`)}
    ${statCard('Best Score', bestScore + '%', '#f59e0b', `<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>`)}
    ${statCard('Pass Rate', passRate + '%', '#06b6d4', `<path d="M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3"/>`)}
  `;
}

function updateProfile(e) {
  e.preventDefault();
  const name = document.getElementById('edit-name').value.trim();
  const password = document.getElementById('edit-password').value;
  const users = getDB('omega_users');
  const idx = users.findIndex(u => u.id === currentUser.id);
  if (idx === -1) return;
  users[idx].name = name;
  if (password) users[idx].password = password;
  setDB('omega_users', users);
  currentUser = { ...currentUser, name };
  localStorage.setItem('omega_current_user', JSON.stringify(currentUser));
  updateSidebar();
  loadProfile();
  showToast('Profile updated!', 'success');
}

// ─── ADMIN DASHBOARD ──────────────────
function loadAdminDashboard() {
  const users = getDB('omega_users').filter(u => u.role !== 'admin');
  const series = getDB('omega_series');
  const questions = getDB('omega_questions');
  const results = getDB('omega_results');

  document.getElementById('admin-stats').innerHTML = `
    ${statCard('Total Users', users.length, '#3b82f6', `<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8z"/>`)}
    ${statCard('Test Series', series.length, '#10b981', `<path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>`)}
    ${statCard('Total Questions', questions.length, '#f59e0b', `<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01"/>`)}
    ${statCard('Test Attempts', results.length, '#06b6d4', `<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>`)}
  `;

  document.getElementById('admin-recent-users').innerHTML = users.slice(-5).reverse().map(u => `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);">
      <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#06b6d4);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;">${(u.name||'U')[0].toUpperCase()}</div>
      <div><div style="font-size:13px;font-weight:600;">${u.name}</div><div style="font-size:11px;color:var(--muted);">${u.email}</div></div>
      <div style="margin-left:auto;font-size:11px;color:var(--muted);">${formatDate(u.createdAt)}</div>
    </div>
  `).join('') || '<div style="color:var(--muted);font-size:13px;padding:20px 0;text-align:center;">No users yet</div>';

  // Top tests by attempt count
  const countMap = {};
  results.forEach(r => { countMap[r.seriesId] = (countMap[r.seriesId] || 0) + 1; });
  const topSeries = series.sort((a,b) => (countMap[b.id]||0) - (countMap[a.id]||0)).slice(0,5);
  document.getElementById('admin-top-tests').innerHTML = topSeries.map(s => `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);">
      <div style="flex:1;"><div style="font-size:13px;font-weight:600;">${s.name}</div><div style="font-size:11px;color:var(--muted);">${s.subject}</div></div>
      <div><span class="badge badge-blue">${countMap[s.id]||0} attempts</span></div>
    </div>
  `).join('') || '<div style="color:var(--muted);font-size:13px;padding:20px 0;text-align:center;">No attempts yet</div>';
}

// ─── ADMIN USERS ──────────────────
function loadAdminUsers() {
  const users = getDB('omega_users');
  const results = getDB('omega_results');
  window._allUsersCache = users;
  renderUsersTable(users, results);
}

function renderUsersTable(users, results) {
  results = results || getDB('omega_results');
  document.getElementById('users-body').innerHTML = users.map(u => {
    const userResults = results.filter(r => r.userId === u.id);
    const avgScore = userResults.length > 0 ? Math.round(userResults.reduce((a,r) => a + r.percentage, 0) / userResults.length) : '-';
    return `<tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#06b6d4);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;">${(u.name||'U')[0].toUpperCase()}</div>
          <span style="font-weight:600;font-size:13px;">${u.name || '-'}</span>
        </div>
      </td>
      <td style="font-size:13px;color:var(--muted);">${u.email}</td>
      <td><span class="badge ${u.role==='admin'?'badge-yellow':'badge-blue'}">${u.role}</span></td>
      <td style="font-size:13px;">${userResults.length}</td>
      <td style="font-size:13px;">${avgScore !== '-' ? avgScore + '%' : '-'}</td>
      <td style="font-size:13px;color:var(--muted);">${formatDate(u.createdAt)}</td>
      <td>
        <div style="display:flex;gap:6px;">
          ${u.role !== 'admin' ? `<button onclick="toggleUserRole('${u.id}')" class="btn-success" style="font-size:11px;padding:6px 10px;">Make Admin</button>` : ''}
          ${u.id !== currentUser.id ? `<button onclick="deleteUser('${u.id}')" class="btn-danger" style="font-size:11px;padding:6px 10px;">Delete</button>` : ''}
        </div>
      </td>
    </tr>`;
  }).join('');
}

function filterUsers(query) {
  const q = query.toLowerCase();
  const filtered = (window._allUsersCache || []).filter(u => u.name?.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  renderUsersTable(filtered);
}

function toggleUserRole(uid) {
  const users = getDB('omega_users');
  const idx = users.findIndex(u => u.id === uid);
  if (idx === -1) return;
  users[idx].role = users[idx].role === 'admin' ? 'student' : 'admin';
  setDB('omega_users', users);
  loadAdminUsers();
  showToast('User role updated!', 'success');
}

function deleteUser(uid) {
  showConfirm('Delete User', 'This will permanently delete the user and all their data.', () => {
    const users = getDB('omega_users').filter(u => u.id !== uid);
    setDB('omega_users', users);
    const results = getDB('omega_results').filter(r => r.userId !== uid);
    setDB('omega_results', results);
    loadAdminUsers();
    showToast('User deleted.', 'success');
  }, '🗑️');
}

// ─── ADMIN SERIES ──────────────────
function loadAdminSeries() {
  const series = getDB('omega_series');
  const questions = getDB('omega_questions');
  document.getElementById('series-list').innerHTML = series.map(s => {
    const qCount = questions.filter(q => q.seriesId === s.id).length;
    const attempts = getDB('omega_results').filter(r => r.seriesId === s.id).length;
    return `
    <div class="glass p-5">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <span class="badge ${s.active?'badge-green':'badge-red'}">${s.active?'Active':'Inactive'}</span>
        <div style="display:flex;gap:6px;">
          <button onclick="editSeries('${s.id}')" class="btn-success" style="font-size:11px;padding:6px 10px;">Edit</button>
          <button onclick="deleteSeries('${s.id}')" class="btn-danger" style="font-size:11px;padding:6px 10px;">Delete</button>
        </div>
      </div>
      <h3 style="font-size:15px;font-weight:700;margin-bottom:6px;">${s.name}</h3>
      <p style="font-size:12px;color:var(--muted);margin-bottom:12px;line-height:1.5;">${s.description}</p>
      <div style="display:flex;gap:12px;font-size:12px;color:var(--muted);">
        <span>⏱ ${s.duration} min</span>
        <span>📝 ${qCount} Qs</span>
        <span>🔄 ${attempts} attempts</span>
      </div>
    </div>`;
  }).join('') || '<div style="text-align:center;padding:40px;color:var(--muted);grid-column:1/-1;">No series yet. Create one!</div>';
}

function openAddSeriesModal(seriesId) {
  document.getElementById('series-modal-title').textContent = 'Create Test Series';
  document.getElementById('series-edit-id').value = '';
  document.getElementById('series-name').value = '';
  document.getElementById('series-desc').value = '';
  document.getElementById('series-duration').value = '60';
  document.getElementById('series-total-q').value = '50';
  document.getElementById('series-subject').value = '';
  document.getElementById('series-active').checked = true;
  document.getElementById('add-series-modal').style.display = 'flex';
}

function editSeries(id) {
  const s = getDB('omega_series').find(s => s.id === id);
  document.getElementById('series-modal-title').textContent = 'Edit Test Series';
  document.getElementById('series-edit-id').value = id;
  document.getElementById('series-name').value = s.name;
  document.getElementById('series-desc').value = s.description;
  document.getElementById('series-duration').value = s.duration;
  document.getElementById('series-total-q').value = s.totalQuestions;
  document.getElementById('series-subject').value = s.subject;
  document.getElementById('series-active').checked = s.active;
  document.getElementById('add-series-modal').style.display = 'flex';
}

function saveSeries(e) {
  e.preventDefault();
  const editId = document.getElementById('series-edit-id').value;
  const series = getDB('omega_series');
  const data = {
    name: document.getElementById('series-name').value.trim(),
    description: document.getElementById('series-desc').value.trim(),
    duration: parseInt(document.getElementById('series-duration').value),
    totalQuestions: parseInt(document.getElementById('series-total-q').value),
    subject: document.getElementById('series-subject').value.trim(),
    active: document.getElementById('series-active').checked,
  };
  if (editId) {
    const idx = series.findIndex(s => s.id === editId);
    series[idx] = { ...series[idx], ...data };
  } else {
    series.push({ id: 's-' + Date.now(), ...data, createdAt: new Date().toISOString() });
  }
  setDB('omega_series', series);
  closeModal('add-series-modal');
  loadAdminSeries();
  showToast(editId ? 'Series updated!' : 'Series created!', 'success');
}

function deleteSeries(id) {
  showConfirm('Delete Series', 'This will delete the series and all its questions. This action cannot be undone.', () => {
    let series = getDB('omega_series').filter(s => s.id !== id);
    let questions = getDB('omega_questions').filter(q => q.seriesId !== id);
    setDB('omega_series', series);
    setDB('omega_questions', questions);
    loadAdminSeries();
    showToast('Series deleted.', 'success');
  }, '🗑️');
}

// ─── ADMIN QUESTIONS ──────────────────
function loadAdminQuestions() {
  const series = getDB('omega_series');
  const filterSeries = document.getElementById('q-filter-series').value;

  // Populate series dropdowns
  const seriesOptions = series.map(s => `<option value="${s.id}" ${s.id === filterSeries ? 'selected' : ''}>${s.name}</option>`).join('');
  document.getElementById('q-filter-series').innerHTML = '<option value="">All Series</option>' + seriesOptions;
  document.getElementById('question-series').innerHTML = '<option value="">Select series...</option>' + series.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  document.getElementById('pdf-series').innerHTML = '<option value="">Select series...</option>' + series.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

  let questions = getDB('omega_questions');
  if (filterSeries) questions = questions.filter(q => q.seriesId === filterSeries);
  window._allQuestionsCache = questions;
  renderQuestionsTable(questions);
}

function renderQuestionsTable(questions) {
  const seriesMap = {};
  getDB('omega_series').forEach(s => seriesMap[s.id] = s.name);
  document.getElementById('questions-body').innerHTML = questions.map((q, i) => `
    <tr>
      <td style="font-size:12px;color:var(--muted);" class="mono">${i+1}</td>
      <td style="max-width:300px;font-size:13px;">${q.question.substring(0,80)}${q.question.length>80?'...':''}</td>
      <td style="font-size:11px;color:var(--muted);">A: ${(q.optionA||'').substring(0,20)}...</td>
      <td><span class="badge badge-green mono">${q.answer}</span></td>
      <td style="font-size:12px;color:var(--muted);">${seriesMap[q.seriesId] || '-'}</td>
      <td>
        <div style="display:flex;gap:6px;">
          <button onclick="editQuestion('${q.id}')" class="btn-success" style="font-size:11px;padding:6px 10px;">Edit</button>
          <button onclick="deleteQuestion('${q.id}')" class="btn-danger" style="font-size:11px;padding:6px 10px;">Del</button>
        </div>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--muted);">No questions found.</td></tr>';
}

function filterQuestions(q) {
  const filtered = (window._allQuestionsCache || []).filter(qu => qu.question.toLowerCase().includes(q.toLowerCase()));
  renderQuestionsTable(filtered);
}

function openAddQuestionModal() {
  document.getElementById('question-modal-title').textContent = 'Add Question';
  document.getElementById('question-edit-id').value = '';
  ['question-text-input','q-opt-a','q-opt-b','q-opt-c','q-opt-d','q-explanation'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('q-answer').value = '';
  loadAdminQuestions();
  document.getElementById('add-question-modal').style.display = 'flex';
}

function editQuestion(id) {
  const q = getDB('omega_questions').find(q => q.id === id);
  document.getElementById('question-modal-title').textContent = 'Edit Question';
  document.getElementById('question-edit-id').value = id;
  loadAdminQuestions();
  setTimeout(() => {
    document.getElementById('question-text-input').value = q.question;
    document.getElementById('q-opt-a').value = q.optionA;
    document.getElementById('q-opt-b').value = q.optionB;
    document.getElementById('q-opt-c').value = q.optionC;
    document.getElementById('q-opt-d').value = q.optionD;
    document.getElementById('q-answer').value = q.answer;
    document.getElementById('q-explanation').value = q.explanation || '';
    document.getElementById('question-series').value = q.seriesId;
    document.getElementById('add-question-modal').style.display = 'flex';
  }, 50);
}

function saveQuestion(e) {
  e.preventDefault();
  const editId = document.getElementById('question-edit-id').value;
  const questions = getDB('omega_questions');
  const data = {
    seriesId: document.getElementById('question-series').value,
    question: document.getElementById('question-text-input').value.trim(),
    optionA: document.getElementById('q-opt-a').value.trim(),
    optionB: document.getElementById('q-opt-b').value.trim(),
    optionC: document.getElementById('q-opt-c').value.trim(),
    optionD: document.getElementById('q-opt-d').value.trim(),
    answer: document.getElementById('q-answer').value,
    explanation: document.getElementById('q-explanation').value.trim(),
    subject: 'General'
  };
  if (editId) {
    const idx = questions.findIndex(q => q.id === editId);
    questions[idx] = { ...questions[idx], ...data };
  } else {
    questions.push({ id: 'q-' + Date.now(), ...data, createdAt: new Date().toISOString() });
  }
  setDB('omega_questions', questions);
  closeModal('add-question-modal');
  loadAdminQuestions();
  showToast(editId ? 'Question updated!' : 'Question added!', 'success');
}

function deleteQuestion(id) {
  showConfirm('Delete Question', 'This will permanently delete this question.', () => {
    const questions = getDB('omega_questions').filter(q => q.id !== id);
    setDB('omega_questions', questions);
    loadAdminQuestions();
    showToast('Question deleted.', 'success');
  }, '🗑️');
}

// ─── PDF IMPORT ──────────────────
function openPdfUploadModal() {
  loadAdminQuestions(); // populate series dropdown
  setTimeout(() => document.getElementById('pdf-upload-modal').style.display = 'flex', 50);
  document.getElementById('pdf-status').style.display = 'none';
  document.getElementById('pdf-preview').style.display = 'none';
  document.getElementById('import-pdf-btn').disabled = true;
  pdfParsedQuestions = [];
}

function handlePdfDrop(e) {
  e.preventDefault();
  document.getElementById('pdf-drop-zone').style.borderColor = 'var(--border)';
  const file = e.dataTransfer.files[0];
  if (file && file.type === 'application/pdf') processPdfFile(file);
  else showToast('Please upload a PDF file.', 'error');
}

function handlePdfSelect(e) {
  const file = e.target.files[0];
  if (file) processPdfFile(file);
}

async function processPdfFile(file) {
  const status = document.getElementById('pdf-status');
  status.style.display = '';
  status.style.background = 'rgba(59,130,246,0.1)';
  status.style.border = '1px solid rgba(59,130,246,0.2)';
  status.style.color = '#60a5fa';
  status.style.borderRadius = '8px';
  status.style.padding = '12px';
  status.textContent = '⏳ Parsing PDF...';

  try {
    const arrayBuffer = await file.arrayBuffer();
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      fullText += content.items.map(item => item.str).join(' ') + '\n';
    }
    pdfParsedQuestions = parsePdfQuestions(fullText);
    if (pdfParsedQuestions.length > 0) {
      status.style.background = 'rgba(16,185,129,0.1)';
      status.style.border = '1px solid rgba(16,185,129,0.2)';
      status.style.color = '#34d399';
      status.textContent = `✅ Found ${pdfParsedQuestions.length} questions in PDF`;
      const preview = document.getElementById('pdf-preview');
      preview.style.display = '';
      preview.innerHTML = pdfParsedQuestions.slice(0,3).map((q,i) => `<div style="margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid var(--border);"><strong>Q${i+1}:</strong> ${q.question.substring(0,100)}... <span style="color:#10b981;">[Ans: ${q.answer}]</span></div>`).join('');
      document.getElementById('import-pdf-btn').disabled = false;
    } else {
      status.style.background = 'rgba(239,68,68,0.1)';
      status.style.border = '1px solid rgba(239,68,68,0.2)';
      status.style.color = '#f87171';
      status.textContent = '❌ No questions found. PDF must have format: QUESTION N → options → Answer: X';
    }
  } catch (err) {
    status.style.background = 'rgba(239,68,68,0.1)';
    status.style.color = '#f87171';
    status.textContent = '❌ Error reading PDF: ' + err.message;
  }
}

function parsePdfQuestions(text) {
  const questions = [];
  const pattern = /QUESTION\s+(\d+)([\s\S]*?)(?=QUESTION\s+\d+|$)/gi;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const block = match[2];
    const lines = block.split(/\n/).map(l => l.trim()).filter(Boolean);
    const opts = { A: '', B: '', C: '', D: '' };
    let answer = '', qLines = [], foundOpt = false;

    for (const line of lines) {
      const optM = line.match(/^([ABCD])[.)]\s+(.+)/);
      const ansM = line.match(/^Answer[:\s]+([ABCD])/i);
      if (ansM) { answer = ansM[1]; }
      else if (optM) { foundOpt = true; opts[optM[1]] = optM[2]; }
      else if (!foundOpt) qLines.push(line);
    }

    const qText = qLines.join(' ').trim();
    if (qText && answer && opts.A && opts.B && opts.C && opts.D) {
      questions.push({ question: qText, optionA: opts.A, optionB: opts.B, optionC: opts.C, optionD: opts.D, answer, subject: 'Imported' });
    }
  }
  return questions;
}

function importPdfQuestions() {
  const seriesId = document.getElementById('pdf-series').value;
  if (!seriesId) { showToast('Please select a test series.', 'error'); return; }
  if (!pdfParsedQuestions.length) { showToast('No questions to import.', 'error'); return; }

  const questions = getDB('omega_questions');
  pdfParsedQuestions.forEach(q => {
    questions.push({ id: 'q-' + Date.now() + Math.random(), seriesId, ...q, createdAt: new Date().toISOString() });
  });
  setDB('omega_questions', questions);
  closeModal('pdf-upload-modal');
  loadAdminQuestions();
  showToast(`✅ Imported ${pdfParsedQuestions.length} questions!`, 'success');
  pdfParsedQuestions = [];
}

// ─── HELPERS ──────────────────
function showPage(pageId) {
  document.querySelectorAll('#auth-container > div').forEach(el => el.style.display = 'none');
  document.getElementById(pageId).style.display = 'grid';
}

function showError(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 4000);
}

function closeModal(id) { document.getElementById(id).style.display = 'none'; }

function showConfirm(title, message, onConfirm, icon = '⚠️') {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-message').textContent = message;
  document.getElementById('confirm-icon').textContent = icon;
  document.getElementById('confirm-icon').style.background = 'rgba(245,158,11,0.15)';
  document.getElementById('confirm-icon').style.fontSize = '24px';
  document.getElementById('confirm-modal').style.display = 'flex';
  document.getElementById('confirm-action-btn').onclick = () => {
    closeModal('confirm-modal');
    onConfirm();
  };
}

function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const t = document.createElement('div');
  t.className = 'toast';
  const color = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6';
  t.innerHTML = `<div style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0;"></div>${message}`;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
}

function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return '-';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', function(e) {
    if (e.target === this) this.style.display = 'none';
  });
});