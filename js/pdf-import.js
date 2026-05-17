// ============================================================
// pdf-import.js — PDF/DOCX upload, parsing, and bulk import
// ============================================================

// ─── Modal open / reset ──────────────────────────────────────
function openPdfUploadModal() {
  loadAdminQuestions();
  setTimeout(() => document.getElementById('pdf-upload-modal').style.display = 'flex', 100);
  resetUploadModal();
}

function resetUploadModal() {
  document.getElementById('pdf-status').style.display      = 'none';
  document.getElementById('pdf-preview').style.display     = 'none';
  document.getElementById('import-pdf-btn').disabled       = true;
  document.getElementById('pdf-batch-info').style.display  = 'none';
  const lbl = document.getElementById('pdf-file-label');
  if (lbl) lbl.textContent = 'Drop PDF or DOCX here, or click to browse';
  pdfParsedQs = [];
}

// ─── Drop / select handlers ───────────────────────────────────
function handlePdfDrop(e) {
  e.preventDefault();
  document.getElementById('pdf-drop-zone').style.borderColor = 'var(--border)';
  const file = e.dataTransfer.files[0];
  if (!file) return;
  if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) processPdfFile(file);
  else if (file.name.endsWith('.docx')) processDocxFile(file);
  else showToast('Please upload a PDF or DOCX file.', 'error');
}

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.name.endsWith('.pdf')) processPdfFile(file);
  else if (file.name.endsWith('.docx')) processDocxFile(file);
  else showToast('Unsupported file type. Use PDF or DOCX.', 'error');
}
const handlePdfSelect = handleFileSelect;

// ─── Status helper ────────────────────────────────────────────
function makeSetStatus() {
  return (msg, type = 'info') => {
    const status = document.getElementById('pdf-status');
    status.style.display    = '';
    status.style.background = type === 'ok'  ? 'rgba(16,185,129,0.1)' : type === 'err' ? 'rgba(239,68,68,0.1)' : 'rgba(59,130,246,0.1)';
    status.style.border     = `1px solid ${type === 'ok' ? 'rgba(16,185,129,0.2)' : type === 'err' ? 'rgba(239,68,68,0.2)' : 'rgba(59,130,246,0.2)'}`;
    status.style.color      = type === 'ok'  ? '#34d399' : type === 'err' ? '#f87171' : '#60a5fa';
    status.style.borderRadius = '8px'; status.style.padding = '12px';
    status.textContent      = msg;
  };
}

// ─── DOCX processing ─────────────────────────────────────────
async function processDocxFile(file) {
  const setStatus = makeSetStatus();
  const lbl = document.getElementById('pdf-file-label');
  if (lbl) lbl.textContent = `📄 ${file.name}`;
  setStatus('⏳ Reading DOCX file…');
  try {
    if (!window.mammoth) { setStatus('❌ mammoth.js not loaded. Refresh and try again.', 'err'); return; }
    const arrayBuffer = await file.arrayBuffer();
    const result      = await mammoth.extractRawText({ arrayBuffer });
    const rawText     = result.value;
    if (!rawText || rawText.trim().length < 50) { setStatus('❌ No readable text found.', 'err'); return; }
    setStatus(`⏳ Extracted ${rawText.length} characters. Parsing questions…`);
    pdfParsedQs = parsePdfText(rawText);
    showParseResults(setStatus, file.name);
  } catch (err) { setStatus('❌ Error reading DOCX: ' + err.message, 'err'); }
}

// ─── PDF processing ──────────────────────────────────────────
async function processPdfFile(file) {
  const setStatus = makeSetStatus();
  const lbl = document.getElementById('pdf-file-label');
  if (lbl) lbl.textContent = `📄 ${file.name}`;
  setStatus('⏳ Parsing PDF…');
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    let fullText = ''; let totalChars = 0;

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
      const lines    = Object.keys(byY).sort((a, b) => b - a)
        .map(y => byY[y].sort((a, b) => a.x - b.x).map(it => it.str).join(' '));
      const pageText = lines.join('\n');
      totalChars    += pageText.length;
      fullText      += pageText + '\n';
    }

    if (totalChars / pdf.numPages < 80) {
      setStatus(`⚠️ Scanned PDF detected (${totalChars} chars from ${pdf.numPages} pages). Run OCR first then re-upload.`, 'err');
      return;
    }
    setStatus(`⏳ Extracted ${totalChars} characters from ${pdf.numPages} pages. Parsing questions…`);
    pdfParsedQs = parsePdfText(fullText);
    showParseResults(setStatus, file.name);
  } catch (err) { setStatus('❌ Error reading PDF: ' + err.message, 'err'); }
}

// ─── Parse result display ─────────────────────────────────────
function showParseResults(setStatus, filename) {
  if (pdfParsedQs.length > 0) {
    const sets = Math.ceil(pdfParsedQs.length / QUESTIONS_PER_SET);
    setStatus(`✅ Found ${pdfParsedQs.length} questions in "${filename}" → will create ${sets} series (sets of ${QUESTIONS_PER_SET})`, 'ok');

    const batchInfo = document.getElementById('pdf-batch-info');
    batchInfo.style.display = '';
    batchInfo.innerHTML = `<div style="font-size:12px;color:var(--muted);margin-top:8px;">
      ${Array.from({ length: sets }, (_, i) => {
        const from = i * QUESTIONS_PER_SET + 1;
        const to   = Math.min((i + 1) * QUESTIONS_PER_SET, pdfParsedQs.length);
        return `<span style="margin-right:8px;">Set ${i + 1}: Q${from}–Q${to}</span>`;
      }).join('')}
    </div>`;

    const prev = document.getElementById('pdf-preview');
    prev.style.display = '';
    prev.innerHTML = pdfParsedQs.slice(0, 3).map((q, i) =>
      `<div style="margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid var(--border);font-size:12px;">
        <strong>Q${i + 1}:</strong> ${q.question.substring(0, 100)}…
        <span style="color:#10b981;"> [Ans: ${q.answer}]</span>
        ${q.explanation ? `<span style="color:#60a5fa;"> ✓ Rationale</span>` : ''}
      </div>`).join('');
    document.getElementById('import-pdf-btn').disabled = false;
  } else {
    setStatus('❌ No questions found. Check the format and try again.', 'err');
  }
}

// ============================================================
// ─── JUNK FILTER (shared by all parsers) ────────────────────
// ============================================================
const JUNK_PATTERNS = [
  /^@\w+/, /^lOMoARcPSD/, /Downloaded by/i, /Distribution of this document/i,
  /Want to earn/i, /Studocu is not sponsored/i, /^\d{1,3}$/, /^NCLEX RN ACTUAL EXAM/i,
  /^BANK OF REAL QUESTIONS/i, /^ANSWERS NCLEX/i, /^NORCET \d+ SELECTION DOSE/i,
  /Granth Shree/i, /Berlin0145/i, /^\s*$/,
  // LMR / Jitu Sir booklet headers
  /^LMR\s*\(QUESTIONS BOOKLET/i, /^CONNECT WITH JITU SIR/i,
  /^-+:+\s*\d+\s*:+-+$/, /^By-JITU SIR$/i,
  // Nursing Next Live headers
  /^Nursing\s+Next\s+Li?ve/i, /^NNL\s+PRACTICE\s+PEARLS/i,
  /^The\s+Next\s+Level\s+of\s+Nursing/i,
  /^©\s*This\s+content\s+is\s+the\s+copyright/i,
  /^No\s+part\s+of\s+this\s+notes/i,
];
function isJunk(line) {
  const t = line.trim();
  if (!t) return true;
  return JUNK_PATTERNS.some(rx => rx.test(t));
}
function cleanLines(text) { return text.split('\n').filter(l => !isJunk(l)).join('\n'); }

// ============================================================
// ─── MASTER PARSER DISPATCHER ───────────────────────────────
// ============================================================
function parsePdfText(rawText) {
  const cleaned = cleanLines(rawText);

  // Format 6: Nursing Next Live / Practice Pearls style
  // — numbered Qs, lowercase a/b/c/d options (1 or 2 per line), answer key grid at bottom
  const f6  = parseFormatNursingNextLive(cleaned);  if (f6.length  >= 3) return f6;
  const f6r = parseFormatNursingNextLive(rawText);  if (f6r.length >= 3) return f6r;

  // Format 4: NNL/TAT/AHN style — "Question N:" with standalone A:/B:/C:/D: labels
  const f4  = parseFormatNNL(cleaned);              if (f4.length  >= 3) return f4;
  const f4r = parseFormatNNL(rawText);              if (f4r.length >= 3) return f4r;

  // Format 1: "QUESTION N" header blocks with A./B./C./D. options
  const f1  = parseFormatQuestion(cleaned);         if (f1.length  >= 3) return f1;

  // Format 2: NCLEX numbered with inline Rationale
  const f3  = parseFormatNCLEX(cleaned);            if (f3.length  >= 3) return f3;

  // Format 3: Numbered + Answer Key at end
  const f2  = parseFormatNumbered(cleaned);         if (f2.length  >= 3) return f2;

  // Fallbacks on raw text
  const fb3 = parseFormatNCLEX(rawText);            if (fb3.length >= 3) return fb3;
  const fb1 = parseFormatQuestion(rawText);         if (fb1.length >= 3) return fb1;

  // Format 5: LMR / Jitu Sir style — numbered Qs, A./a. options, grid answer key at end
  const f5  = parseFormatLMR(cleaned);              if (f5.length  >= 3) return f5;
  const f5r = parseFormatLMR(rawText);              if (f5r.length >= 3) return f5r;

  return [];
}

// ============================================================
// ─── FORMAT 6: NURSING NEXT LIVE / PRACTICE PEARLS ──────────
// ============================================================
//
// Layout:
//   1. Question text spanning one or more lines?
//      a. OptionA   b. OptionB        ← two options side-by-side (2+ spaces apart)
//      c. OptionC   d. OptionD
//   — OR —
//      a. OptionA
//      b. OptionB
//      c. OptionC
//      d. OptionD
//
//   Answer key block at BOTTOM of each section (not inline):
//   "1. b  2. d  3. a  4. b  5. d  6. c  7. b  8. c  9. c  10. b  11. a"
//   "12. b  13. d"
//
// Section headers ("NORCET 2023 (PRELIMS)", "FAST TRACK QUESTIONS", etc.)
// and copyright lines are stripped before parsing.
//
function parseFormatNursingNextLive(text) {

  // ── Section-header patterns specific to this format ─────────────────────────
  const NNL_HEADERS = [
    /^ANSWER\s+KEY\s*$/i,
    /^NORCET\s+\d{4}/i,
    /^FAST\s+TRACK\s+QUESTIONS\s*$/i,
    /^RECALL\s+QUESTIONS\s*$/i,
    /^PROBABLE\s+QUESTIONS\s*$/i,
    /^Applied\s+Pharmacology\s*$/i,
    /^Nursing\s+Next\s+Li?ve/i,
    /^NNL\s+PRACTICE\s+PEARLS/i,
    /^The\s+Next\s+Level/i,
    /^\d{1,3}\s*$/,                         // lone page numbers
    /^©\s*This\s+content/i,
    /^No\s+part\s+of\s+this\s+notes/i,
    /^Page\s+\d+/i,
  ];

  function isNNLHeader(line) {
    const t = line.trim();
    if (!t) return true;
    if (NNL_HEADERS.some(rx => rx.test(t))) return true;
    // Answer-key data rows: 3+ "N. letter" pairs on one line
    const pairs = [...t.matchAll(/\d{1,3}\.\s+[a-dA-D]\b/g)];
    if (pairs.length >= 3) return true;
    return false;
  }

  // ── Step 1: Harvest answer key from ALL answer-key rows in the text ──────────
  const answerKey = {};
  for (const line of text.split('\n')) {
    const t = line.trim();
    const pairs = [...t.matchAll(/(\d{1,3})\.\s+([a-dA-D])\b/g)];
    if (pairs.length >= 3) {
      for (const [, num, letter] of pairs) {
        // Don't overwrite with a later duplicate section (e.g. NORCET 2020 repeats Qs)
        const n = parseInt(num);
        if (!answerKey[n]) answerKey[n] = letter.toUpperCase();
      }
    }
  }

  // Also capture 2-pair answer key rows that appear at the very end of a section
  // (e.g. "12. b  13. d") by looking for lines adjacent to known key rows.
  // Simple approach: any line with 1–2 "N. letter" pairs that immediately follows
  // a line that was a key row.
  const rawLines = text.split('\n');
  let prevWasKeyRow = false;
  for (const line of rawLines) {
    const t = line.trim();
    const pairs = [...t.matchAll(/(\d{1,3})\.\s+([a-dA-D])\b/g)];
    if (pairs.length >= 3) {
      prevWasKeyRow = true;
      continue;
    }
    if (prevWasKeyRow && pairs.length >= 1 && pairs.length <= 4) {
      // Likely a continuation row of the answer key
      for (const [, num, letter] of pairs) {
        const n = parseInt(num);
        if (!answerKey[n]) answerKey[n] = letter.toUpperCase();
      }
    }
    prevWasKeyRow = (pairs.length >= 3);
  }

  if (Object.keys(answerKey).length < 3) return []; // Not this format

  // ── Step 2: Strip headers/key rows, then split into question blocks ──────────
  const bodyLines = rawLines.filter(l => !isNNLHeader(l));
  const bodyText  = bodyLines.join('\n');

  // Split on "^\d{1,3}\." at the start of a line
  // Match: question number + rest of block up to the next question number
  const blockRe = /(?:^|\n)(\d{1,3})\.\s+([\s\S]*?)(?=\n\d{1,3}\.\s+[^\d\s]|$)/g;
  const qs = [];
  let match;

  while ((match = blockRe.exec(bodyText)) !== null) {
    const qNum = parseInt(match[1]);
    const body = match[2];

    if (!body || body.trim().length < 8) continue;

    const bLines = body.split('\n').map(l => l.trim()).filter(Boolean);
    if (bLines.length < 2) continue;

    // ── Parse question text and a/b/c/d options ──────────────────────────────
    const opts     = { A: '', B: '', C: '', D: '' };
    const qLines   = [];
    let foundOpts  = false;

    for (const bl of bLines) {
      if (isNNLHeader(bl)) continue;

      // ── Two options on one line: "a. Text1   b. Text2" ───────────────────
      const twoOpt = bl.match(
        /^([a-dA-D])\.\s+(.+?)\s{2,}([a-dA-D])\.\s+(.+)$/
      );
      if (twoOpt) {
        foundOpts = true;
        const [, l1, t1, l2, t2] = twoOpt;
        if (!opts[l1.toUpperCase()]) opts[l1.toUpperCase()] = t1.trim();
        if (!opts[l2.toUpperCase()]) opts[l2.toUpperCase()] = t2.trim();
        continue;
      }

      // ── Single option per line: "a. Text" ────────────────────────────────
      const singleOpt = bl.match(/^([a-dA-D])\.\s+(.+)/);
      if (singleOpt) {
        foundOpts = true;
        const key = singleOpt[1].toUpperCase();
        if (!opts[key]) opts[key] = singleOpt[2].trim();
        continue;
      }

      if (!foundOpts) {
        // Still in question-text territory
        if (/^\d{1,3}$/.test(bl)) continue;  // skip stray page numbers
        qLines.push(bl);
      } else {
        // Could be a wrapped continuation of the last option
        const lastKey = ['D', 'C', 'B', 'A'].find(k => opts[k]);
        if (lastKey) opts[lastKey] += ' ' + bl;
      }
    }

    const qText  = qLines.join(' ').trim().replace(/\s{2,}/g, ' ');
    const answer = answerKey[qNum] || '';

    if (qText && answer && opts.A && opts.B && opts.C && opts.D) {
      qs.push({
        question:    qText,
        option_a:    opts.A,
        option_b:    opts.B,
        option_c:    opts.C,
        option_d:    opts.D,
        answer,
        explanation: '',
      });
    }
  }

  return qs;
}

// ============================================================
// ─── FORMAT 4: NNL / TAT / AHN STYLE ────────────────────────
// ============================================================
//
// Layout:
//   Question N: <question text, may wrap multiple lines>
//   A:
//   B:
//   C:
//   D:
//   <option A text>
//   <option B text>
//   <option C text>
//   <option D text>
//   Correct Answer: X
//   Rationale / Explanation:
//   <explanation text, multi-line>
//
function parseFormatNNL(text) {
  const qs = [];

  // Split on "Question N:" boundaries (case-insensitive, colon required)
  const blocks = text.split(/(?=^Question\s+\d+\s*:)/mi);

  for (const block of blocks) {
    if (!block.trim()) continue;

    const lines = block.split('\n').map(l => l.trim()).filter(l => l && !isJunk(l));
    if (lines.length < 6) continue;

    // ── 1. Extract question text ──────────────────────────────
    const firstLine = lines[0].replace(/^Question\s+\d+\s*:\s*/i, '').trim();
    const qLines = [firstLine];

    let i = 1;
    while (i < lines.length) {
      const l = lines[i];
      if (/^[A-D]\s*:$/.test(l)) break;
      if (/^Correct\s*Answer\s*:/i.test(l)) break;
      if (/^Rationale/i.test(l)) break;
      if (/^[A-D]\s*:\s+\S/.test(l)) break;
      i++;
      qLines.push(l);
    }
    const qText = qLines.filter(Boolean).join(' ').trim();
    if (!qText) continue;

    // ── 2. Find the four standalone option labels (A: B: C: D:) ──
    const labelPositions = {};
    for (let j = i; j < lines.length; j++) {
      const m = lines[j].match(/^([A-D])\s*:$/);
      if (m) labelPositions[m[1]] = j;
    }

    let opts = { A: '', B: '', C: '', D: '' };
    let answer = '';
    let explanation = '';

    if (Object.keys(labelPositions).length === 4) {
      // Option texts appear after the last label line, in A/B/C/D order
      const lastLabelIdx = Math.max(...Object.values(labelPositions));
      const optionValues = [];
      let j = lastLabelIdx + 1;
      while (j < lines.length && optionValues.length < 4) {
        const l = lines[j];
        if (/^Correct\s*Answer\s*:/i.test(l)) break;
        if (/^Rationale/i.test(l)) break;
        if (/^[A-D]\s*:$/.test(l)) { j++; continue; }
        optionValues.push(l);
        j++;
      }
      ['A','B','C','D'].forEach((lt, idx) => { if (optionValues[idx]) opts[lt] = optionValues[idx].trim(); });

      // Correct Answer
      for (let k = j; k < lines.length; k++) {
        const ansM = lines[k].match(/^Correct\s*Answer\s*:\s*([A-D])\b/i);
        if (ansM) { answer = ansM[1].toUpperCase(); j = k + 1; break; }
      }

      // Rationale / Explanation
      let inRationale = false;
      const rationaleLines = [];
      for (let k = j; k < lines.length; k++) {
        const l = lines[k];
        if (/^Rationale\s*[\/\\]?\s*Explanation\s*:/i.test(l) || /^Rationale\s*:/i.test(l)) {
          inRationale = true;
          const rest = l.replace(/^Rationale\s*[\/\\]?\s*Explanation\s*:/i, '')
                        .replace(/^Rationale\s*:/i, '').trim();
          if (rest) rationaleLines.push(rest);
          continue;
        }
        if (inRationale) {
          if (/^Question\s+\d+\s*:/i.test(l)) break;
          if (/^Page\s+\d+/i.test(l)) continue;
          rationaleLines.push(l);
        }
      }
      explanation = rationaleLines.join(' ').trim();

    } else {
      // Fallback: inline "A: <text>" options on same line
      let j2 = i;
      let inRationale = false;
      const rationaleLines = [];
      while (j2 < lines.length) {
        const l = lines[j2];
        const inlineOpt = l.match(/^([A-D])\s*:\s+(.+)/);
        const ansM      = l.match(/^Correct\s*Answer\s*:\s*([A-D])\b/i);
        if (/^Rationale\s*[\/\\]?\s*Explanation\s*:/i.test(l) || /^Rationale\s*:/i.test(l)) {
          inRationale = true;
          const rest = l.replace(/^Rationale\s*[\/\\]?\s*Explanation\s*:/i, '')
                        .replace(/^Rationale\s*:/i, '').trim();
          if (rest) rationaleLines.push(rest);
        } else if (inRationale) {
          if (/^Question\s+\d+\s*:/i.test(l)) break;
          if (/^Page\s+\d+/i.test(l)) { j2++; continue; }
          rationaleLines.push(l);
        } else if (ansM) {
          answer = ansM[1].toUpperCase();
        } else if (inlineOpt) {
          const lt = inlineOpt[1].toUpperCase();
          if (!opts[lt]) opts[lt] = inlineOpt[2].trim();
        }
        j2++;
      }
      explanation = rationaleLines.join(' ').trim();
    }

    if (qText && answer && opts.A && opts.B && opts.C && opts.D) {
      qs.push({
        question:    qText,
        option_a:    opts.A,
        option_b:    opts.B,
        option_c:    opts.C,
        option_d:    opts.D,
        answer,
        explanation: explanation || '',
      });
    }
  }
  return qs;
}

// ============================================================
// ─── FORMAT 1: "QUESTION N" HEADER BLOCKS ───────────────────
// ============================================================
// Format: QUESTION N → A. B. C. D. → Answer: X
function parseFormatQuestion(text) {
  const qs = []; const re = /QUESTION\s+\d+\s*\n([\s\S]*?)(?=QUESTION\s+\d+\s*\n|$)/gi; let m;
  while ((m = re.exec(text)) !== null) {
    const block = m[1];
    const lines = block.split('\n').map(l => l.trim()).filter(l => l && !isJunk(l));
    const opts  = { A: '', B: '', C: '', D: '' }; let answer = '', explanation = '';
    const qLines = []; let phase = 'question';
    for (const line of lines) {
      const optM = line.match(/^([A-D])[.)]\s+(.+)/);
      const ansM = line.match(/^Answer[:\s]+([A-D])\b/i);
      const expM = /^Explanation[:\s]*/i.test(line);
      if      (ansM)              { answer = ansM[1].toUpperCase(); phase = 'answer'; }
      else if (expM)              { phase = 'explanation'; const rest = line.replace(/^Explanation[:\s]*/i, '').trim(); if (rest) explanation += rest + ' '; }
      else if (phase === 'explanation') { explanation += line + ' '; }
      else if (optM)              { phase = 'options'; if (!opts[optM[1]]) opts[optM[1]] = optM[2].trim(); }
      else if (phase === 'question') qLines.push(line);
    }
    const qText = qLines.join(' ').trim();
    if (qText && answer && opts.A && opts.B && opts.C && opts.D)
      qs.push({ question: qText, option_a: opts.A, option_b: opts.B, option_c: opts.C, option_d: opts.D, answer, explanation: explanation.trim() });
  }
  return qs;
}

// ============================================================
// ─── FORMAT 2: NCLEX NUMBERED WITH RATIONALE ────────────────
// ============================================================
function parseFormatNCLEX(text) {
  const BULLET_RE = /[\u2022\u25cf\u2023\u2043\uf0b7\uf0a7\u25aa\u25ab\u2012\u2013\u2014]/g;
  const cleaned   = text.replace(BULLET_RE, '').replace(/\r\n/g, '\n');
  const blocks    = cleaned.split(/\n(?=\d{1,4}\.\s+[A-Z"(])/);
  const qs = [];
  for (const block of blocks) {
    if (!block.trim()) continue;
    const lines = block.split('\n').map(l => l.trim()).filter(l => l);
    const opts  = {}; let answer = ''; const rationaleLines = []; const qLines = []; let phase = 'q';
    for (const line of lines) {
      if (isJunk(line)) continue;
      const optM = line.match(/^([A-D])[.)]\s+"?(.+)/);
      const ansM = line.match(/^Answer:\s*([A-D])[.)"\s]/i);
      const ratM = line.match(/^(?:Rationale|Explanation)[:\s]*(.*)/i);
      if      (ratM)                                { phase = 'rationale'; if (ratM[1].trim()) rationaleLines.push(ratM[1].trim()); }
      else if (phase === 'rationale')               { rationaleLines.push(line); }
      else if (ansM)                                { answer = ansM[1].toUpperCase(); phase = 'answer'; }
      else if (optM && phase !== 'answer' && phase !== 'rationale') {
        phase = 'opts'; const letter = optM[1].toUpperCase();
        if (!opts[letter]) opts[letter] = optM[2].replace(/^"/, '').trim();
      }
      else if (phase === 'q')   { const stripped = line.replace(/^\d{1,4}\.\s+/, ''); if (stripped) qLines.push(stripped); }
      else if (phase === 'opts') { const lastLetter = Object.keys(opts).slice(-1)[0]; if (lastLetter) opts[lastLetter] += ' ' + line; }
    }
    const qText       = qLines.join(' ').trim();
    const explanation = rationaleLines.join(' ').trim();
    if (qText && answer && opts['A'] && opts['B'] && opts['C'] && opts['D'])
      qs.push({ question: qText, option_a: opts['A'], option_b: opts['B'], option_c: opts['C'], option_d: opts['D'], answer, explanation });
  }
  return qs;
}

// ============================================================
// ─── FORMAT 3: NUMBERED + ANSWER KEY AT END ─────────────────
// ============================================================
function parseFormatNumbered(text) {
  const answerKey = {};
  const answerKeySection = text.match(/Answer\s*[Kk]ey[\s\S]{0,50}\n([\s\S]+)/i);
  if (answerKeySection) {
    const keyRe = /(\d+)\.\s*([A-Da-d])/g; let km;
    while ((km = keyRe.exec(answerKeySection[1])) !== null)
      answerKey[parseInt(km[1])] = km[2].toUpperCase();
  }
  const blockRe = /^(\d{1,4})\.\s+(.+?)(?=^\d{1,4}\.\s+|\nAnswer\s*[Kk]ey|$)/gms;
  const qs = []; let m;
  while ((m = blockRe.exec(text)) !== null) {
    const qNum      = parseInt(m[1]);
    const blockText = m[0];
    if (blockText.trim().length < 15) continue;
    const lines = blockText.split('\n').map(l => l.trim()).filter(l => l && !isJunk(l));
    if (lines.length < 3) continue;
    const opts  = { A: '', B: '', C: '', D: '' };
    const optRe = /^[\(\[]?([a-dA-D])[\)\].]\s+(.+)/;
    const qLines = []; let foundOpts = false;
    for (const line of lines) {
      const optM = line.match(optRe);
      if (optM) { foundOpts = true; const key = optM[1].toUpperCase(); if (!opts[key]) opts[key] = optM[2].trim(); }
      else if (!foundOpts) { const s = line.replace(/^\d{1,4}\.\s*/, ''); if (s) qLines.push(s); }
    }
    const qText = qLines.join(' ').trim(); const answer = answerKey[qNum] || '';
    if (qText && opts.A && opts.B && opts.C && opts.D && answer)
      qs.push({ question: qText, option_a: opts.A, option_b: opts.B, option_c: opts.C, option_d: opts.D, answer, explanation: '' });
  }
  return qs;
}

// ============================================================
// ─── FORMAT 5: LMR / JITU SIR STYLE ────────────────────────
// ============================================================
//
// Layout:
//   1.  <question text (possibly multi-line)>
//       A. <option>  /  a. <option>
//       B. <option>  /  b. <option>
//       C. <option>  /  c. <option>
//       D. <option>  /  d. <option>
//   (questions may span two columns on the page)
//   ANSWER KEY section at end with grid: "1 2 3 4 5\nC D C D C"
//
function parseFormatLMR(text) {
  const qs = [];

  // ── Step 1: Extract answer key from grid at end ───────────────
  const answerKey = {};

  const akSection = text.match(/ANSWER\s+KEY[\s\S]{0,200}((?:\d+[\s\t]+){2,}[\s\S]{0,500})/i);
  if (akSection) {
    const akText = akSection[1];
    const nums = [...akText.matchAll(/(\d{1,3})/g)].map(m => parseInt(m[1]));
    const lets = [...akText.matchAll(/([A-Da-d])/g)].map(m => m[1].toUpperCase());
    if (nums.length > 0 && lets.length >= nums.length) {
      nums.forEach((n, i) => { if (lets[i]) answerKey[n] = lets[i]; });
    }
  }

  // Fallback: scan whole text for "N\nLETTER" or "N LETTER" pairs near end
  if (Object.keys(answerKey).length < 3) {
    const pairs = [...text.matchAll(/(\d{1,3})\s*\n\s*([A-Da-d])/g)];
    pairs.forEach(m => { answerKey[parseInt(m[1])] = m[2].toUpperCase(); });
  }

  // ── Step 2: Split text into question blocks ───────────────────
  const mainText = text.replace(/ANSWER\s+KEY[\s\S]*/i, '');

  const blockRe = /(?:^|\n)(\d{1,3})\.\s+([\s\S]*?)(?=\n\d{1,3}\.\s+[A-Z"(a-z]|$)/g;
  let m;
  while ((m = blockRe.exec(mainText)) !== null) {
    const qNum   = parseInt(m[1]);
    const body   = m[2];
    if (!body || body.trim().length < 10) continue;

    const lines  = body.split('\n').map(l => l.trim()).filter(l => l && !isJunk(l));
    if (lines.length < 2) continue;

    const opts   = { A: '', B: '', C: '', D: '' };
    const qLines = [];
    let   foundOpts = false;

    const optRe = /^([A-Da-d])[.)]\s+(.+)/;

    for (const line of lines) {
      const optM = line.match(optRe);
      if (optM) {
        foundOpts = true;
        const key = optM[1].toUpperCase();
        if (!opts[key]) opts[key] = optM[2].trim();
      } else if (!foundOpts) {
        if (/LMR|JITU SIR|CONNECT WITH|QUESTIONS BOOKLET/i.test(line)) continue;
        if (/^-*:+\s*\d+\s*:+-*$/.test(line)) continue;
        qLines.push(line);
      } else if (foundOpts) {
        const lastKey = ['D','C','B','A'].find(k => opts[k]);
        if (lastKey && !line.match(optRe)) opts[lastKey] += ' ' + line;
      }
    }

    const qText  = qLines.join(' ').trim().replace(/\s{2,}/g, ' ');
    const answer = answerKey[qNum] || '';

    if (qText && answer && opts.A && opts.B && opts.C && opts.D) {
      qs.push({
        question:    qText,
        option_a:    opts.A,
        option_b:    opts.B,
        option_c:    opts.C,
        option_d:    opts.D,
        answer,
        explanation: '',
      });
    }
  }
  return qs;
}

// ============================================================
// ─── IMPORT ──────────────────────────────────────────────────
// ============================================================
async function importPdfQuestions() {
  const baseName = document.getElementById('pdf-series-name').value.trim();
  if (!baseName)           { showToast('Enter a base name for the test series.', 'error'); return; }
  if (!pdfParsedQs.length) { showToast('No questions to import.', 'error'); return; }

  const durationMins = parseInt(document.getElementById('pdf-series-duration').value) || 60;
  const passPercent  = parseInt(document.getElementById('pdf-series-pass').value)     || 60;
  const subject      = document.getElementById('pdf-series-subject').value.trim();
  const btn          = document.getElementById('import-pdf-btn');
  btn.disabled = true; btn.textContent = 'Importing…';

  const sets = Math.ceil(pdfParsedQs.length / QUESTIONS_PER_SET);
  let created = 0;

  for (let s = 0; s < sets; s++) {
    const batch      = pdfParsedQs.slice(s * QUESTIONS_PER_SET, (s + 1) * QUESTIONS_PER_SET);
    const seriesName = sets > 1 ? `${baseName} — Set ${s + 1}` : baseName;

    const { data: newSeries, error: serErr } = await sb.from('test_series').insert({
      name:             seriesName,
      description:      `Imported from file. Set ${s + 1} of ${sets}. Questions ${s * QUESTIONS_PER_SET + 1}–${Math.min((s + 1) * QUESTIONS_PER_SET, pdfParsedQs.length)}.`,
      duration_minutes: durationMins,
      total_questions:  batch.length,
      pass_percentage:  passPercent,
      subject,
      is_active:        true,
      created_by:       currentUser.id,
    }).select().single();

    if (serErr) { showToast(`Error creating set ${s + 1}: ` + serErr.message, 'error'); continue; }

    const rows = batch.map((q, i) => ({ ...q, series_id: newSeries.id, order_index: i + 1 }));
    const { error: qErr } = await sb.from('questions').insert(rows);
    if (qErr) showToast(`Error inserting questions for set ${s + 1}: ` + qErr.message, 'error');
    else created++;

    document.getElementById('pdf-status').textContent = `Importing… set ${s + 1}/${sets} done`;
  }

  btn.disabled    = false;
  btn.textContent = 'Import Questions';
  closeModal('pdf-upload-modal');
  loadAdminQuestions();
  showToast(`✅ Imported ${pdfParsedQs.length} questions into ${created} series!`, 'success');
  pdfParsedQs = [];
}