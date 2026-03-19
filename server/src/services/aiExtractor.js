/**
 * AI Question Extraction Service — v3.0
 * ──────────────────────────────────────
 * Full-featured extraction engine with:
 *   • OCR for images & scanned PDFs (tesseract.js)
 *   • Excel (.xlsx) support
 *   • Smart text normalization for PDF quirks
 *   • 4-layer extraction pipeline
 *   • Enhanced local question generator
 *   • Google Gemini AI integration
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import officeparser from "officeparser";
import Tesseract from "tesseract.js";
import XLSX from "xlsx";

// ═══════════════════════════════════════════════════════════════════════════
// ── TEXT EXTRACTION (all formats) ────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extract text from an image buffer using OCR (tesseract.js).
 */
async function ocrExtractText(buffer) {
  console.log("[OCR] Starting text recognition...");
  const worker = await Tesseract.createWorker("eng");
  const { data } = await worker.recognize(buffer);
  await worker.terminate();
  console.log(`[OCR] Extracted ${data.text.length} characters, confidence: ${data.confidence}%`);
  return data.text || "";
}

/**
 * Extract text from Excel files (.xlsx, .xls).
 */
function extractTextFromExcel(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const allText = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    allText.push(`--- Sheet: ${sheetName} ---\n${csv}`);
  }

  return allText.join("\n\n");
}

/**
 * Check if a PDF is scanned (image-based) by examining text-to-size ratio.
 */
function isProbablyScanned(text, fileSizeBytes) {
  if (!text || text.trim().length < 50) return true;
  // If file is > 100KB but extracted text is < 200 chars, it's likely scanned
  if (fileSizeBytes > 100_000 && text.trim().length < 200) return true;
  // If mostly whitespace/garbage characters
  const alphaRatio = (text.match(/[a-zA-Z]/g) || []).length / Math.max(text.length, 1);
  if (alphaRatio < 0.3 && fileSizeBytes > 50_000) return true;
  return false;
}

/**
 * Main text extraction — handles ALL file formats.
 */
export async function extractTextFromFile(buffer, mimetype, originalname) {
  const ext = (originalname || "").split(".").pop().toLowerCase();

  // ── Images (OCR) ──
  if (
    ["image/png", "image/jpeg", "image/jpg", "image/bmp", "image/tiff", "image/webp", "image/gif"].includes(mimetype) ||
    ["png", "jpg", "jpeg", "bmp", "tiff", "tif", "webp", "gif"].includes(ext)
  ) {
    console.log("[Extract] Image detected, using OCR...");
    return (await ocrExtractText(buffer)).trim();
  }

  // ── PDF ──
  if (mimetype === "application/pdf" || ext === "pdf") {
    const pdfData = await pdfParse(buffer);
    let text = (pdfData.text || "").trim();

    // Check if scanned PDF
    if (isProbablyScanned(text, buffer.length)) {
      console.log("[Extract] Scanned PDF detected, trying OCR...");
      try {
        const ocrText = await ocrExtractText(buffer);
        if (ocrText.trim().length > text.length) {
          text = ocrText.trim();
          console.log(`[Extract] OCR produced ${text.length} characters`);
        }
      } catch (ocrErr) {
        console.log("[Extract] OCR failed on PDF:", ocrErr.message);
      }
    }

    return text;
  }

  // ── Word (.docx) ──
  if (
    mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ext === "docx"
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return (result.value || "").trim();
  }

  // ── Word (.doc) ──
  if (mimetype === "application/msword" || ext === "doc") {
    const text = await officeparser.parseOfficeAsync(buffer);
    return (text || "").trim();
  }

  // ── PowerPoint (.pptx / .ppt) ──
  if (
    mimetype === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    mimetype === "application/vnd.ms-powerpoint" ||
    ext === "pptx" || ext === "ppt"
  ) {
    const text = await officeparser.parseOfficeAsync(buffer);
    return (text || "").trim();
  }

  // ── Excel (.xlsx / .xls) ──
  if (
    mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimetype === "application/vnd.ms-excel" ||
    ext === "xlsx" || ext === "xls" || ext === "csv"
  ) {
    console.log("[Extract] Excel/CSV file detected...");
    if (ext === "csv") {
      return buffer.toString("utf8").trim();
    }
    return extractTextFromExcel(buffer);
  }

  // ── Plain text / markdown / other ──
  return buffer.toString("utf8").trim();
}

// ═══════════════════════════════════════════════════════════════════════════
// ── TEXT PRE-PROCESSING ──────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

function normalizeText(text) {
  let n = text;

  // Normalize unicode bullets
  n = n.replace(/[▪▫◦◆◇⬥⬦►▸‣⁃∙·]/g, "•");

  // "• A. text" → "A. text" (bullet before letter option)
  n = n.replace(/•\s*([A-Da-d])\s*[\).\]:\-]\s*/g, "$1. ");

  // Split inline options: after "?" push A. to new line
  n = n.replace(/(\?)\s+([A-Da-d])\s*[\).\]]\s*/gi, "$1\n$2. ");

  // Split B/C/D options that are inline
  n = n.replace(/\s+([B-Db-d])\s*[\).\]]\s+/g, "\n$1. ");

  // Normalize multiple spaces
  n = n.replace(/[ \t]+/g, " ");

  // Ensure questions start on fresh lines
  n = n.replace(/([.?!])\s+(Q\d+|Q\s*\.\s*\d+|\d+[\).\]])\s*/gi, "$1\n$2 ");

  return n;
}

// ═══════════════════════════════════════════════════════════════════════════
// ── CONTENT ANALYSIS ─────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

function analyzeContentType(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let qScore = 0;
  let cScore = 0;

  for (const line of lines) {
    if (line.endsWith("?")) qScore += 2;
    if (/^Q\s*\.?\s*\d+|^Q\d+|^\d+[\).\]:]/i.test(line)) qScore += 1;
    if (/^[A-Da-d][\).\]]\s/i.test(line)) qScore += 1;
    if (/(?:answer|ans|correct)\s*[:=\-–]\s*[A-Da-d]/i.test(line)) qScore += 3;

    if (line.length > 150) cScore += 1;
    if (/^(chapter|unit|topic|module|lesson|section|introduction|overview)/i.test(line)) cScore += 2;
    if (/^(the |a |an |in |this |it |they |we |he |she )/i.test(line) && !line.endsWith("?")) cScore += 1;
  }

  return {
    likelyQuestions: qScore > cScore && qScore >= 3,
    likelyContent: cScore > qScore || qScore < 3,
    questionScore: qScore,
    contentScore: cScore,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ── HEURISTIC QUESTION DETECTION ─────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

export function detectExistingQuestions(rawText) {
  const text = normalizeText(rawText);
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const questions = [];

  console.log(`[Heuristic] Processing ${lines.length} lines...`);
  lines.slice(0, 15).forEach((l, i) => console.log(`  Line ${i}: "${l}"`));

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const isQuestion =
      line.endsWith("?") ||
      /^Q\s*\.?\s*\d+[\s.:\)]/i.test(line) ||
      /^Q\d+[\s.:\)]/i.test(line) ||
      /^\d+[\).\]:]\s*.{8,}/i.test(line) ||
      /^question\s*\d+[\s.:\)]/i.test(line) ||
      /^\(\d+\)\s*.{8,}/.test(line) ||
      /^\[\d+\]\s*.{8,}/.test(line);

    if (!isQuestion) continue;

    let qText = line
      .replace(/^\(\d+\)\s*/, "")
      .replace(/^\[\d+\]\s*/, "")
      .replace(/^question\s*\d+[\s.:\)]\s*/i, "")
      .replace(/^Q\s*\.?\s*\d+[\s.:\)]\s*/i, "")
      .replace(/^Q\d+[\s.:\)]\s*/i, "")
      .replace(/^\d+[\).\]:]\s*/i, "")
      .trim();

    if (!qText || qText.length < 5) continue;

    // Check for inline options
    const inlineMatch = qText.match(
      /^(.*\?)\s+([A-Da-d])[\).\s]\s*(.+?)\s+([A-Da-d])[\).\s]\s*(.+?)\s+([A-Da-d])[\).\s]\s*(.+?)\s+([A-Da-d])[\).\s]\s*(.+)$/i
    );

    if (inlineMatch) {
      questions.push({
        text: inlineMatch[1].trim(),
        options: [inlineMatch[3].trim(), inlineMatch[5].trim(), inlineMatch[7].trim(), inlineMatch[9].trim()],
        correctIndex: -1,
        timeLimitSeconds: 30,
        points: 100,
      });
      continue;
    }

    // Collect options from subsequent lines
    const optionLines = [];
    let j = i + 1;
    let detectedCorrect = -1;

    while (j < lines.length && optionLines.length < 4) {
      const candidate = lines[j];
      if (candidate.length < 1) { j++; continue; }

      // Stop if new question starts
      if (
        /^Q\s*\.?\s*\d+[\s.:\)]/i.test(candidate) ||
        /^Q\d+[\s.:\)]/i.test(candidate) ||
        /^\d+[\).\]:]\s*.{8,}/i.test(candidate) ||
        /^question\s*\d+/i.test(candidate)
      ) break;

      let optText = null;

      const m1 = candidate.match(/^([A-Da-d])\s*[\).\]:\-]\s*(.*)/i);
      const m2 = candidate.match(/^[\(\[]([A-Da-d])[\)\]]\s*(.*)/i);
      const m3 = candidate.match(/^[•·∙\-\*●]\s*(.*)/);

      if (m1) {
        optText = m1[2].trim();
      } else if (m2) {
        optText = m2[2].trim();
      } else if (m3 && m3[1].length > 0) {
        const innerLetter = m3[1].match(/^([A-Da-d])\s*[\).\]:\-]\s*(.*)/i);
        optText = innerLetter ? innerLetter[2].trim() : m3[1].trim();
      }

      if (optText !== null && optText.length > 0) {
        let cleanText = optText;

        if (/^\*+/.test(optText) || /\*+$/.test(optText)) {
          detectedCorrect = optionLines.length;
          cleanText = optText.replace(/\*+/g, "").trim();
        }
        if (/[✓✔✅]/.test(optText)) {
          detectedCorrect = optionLines.length;
          cleanText = optText.replace(/[✓✔✅]/g, "").trim();
        }
        if (/\(correct\)|\[correct\]|\(answer\)|\(right\)/i.test(optText)) {
          detectedCorrect = optionLines.length;
          cleanText = optText.replace(/\(correct\)|\[correct\]|\(answer\)|\(right\)/gi, "").trim();
        }

        optionLines.push(cleanText);
        j++;
      } else {
        break;
      }
    }

    // Look for answer key
    for (let k = j; k < Math.min(j + 3, lines.length); k++) {
      const al = lines[k];
      const am = al.match(/(?:correct\s*answer|right\s*answer|answer|ans|correct|key)\s*[.:]?\s*[:=\-–>]\s*([A-Da-d])/i);
      const am2 = al.match(/(?:correct\s*answer|answer|ans)\s*[:=\-–]\s*\(?([A-Da-d])\)?/i);
      const fm = am || am2;

      if (fm) {
        const idx = { A: 0, B: 1, C: 2, D: 3 }[fm[1].toUpperCase()];
        if (idx !== undefined && idx < optionLines.length) detectedCorrect = idx;
        j = k + 1;
        break;
      }

      if (/^[(\[]?[A-Da-d][)\]]?\.?$/i.test(al.trim())) {
        const idx = { A: 0, B: 1, C: 2, D: 3 }[al.trim().replace(/[(\[\]).\s]/g, "").toUpperCase()];
        if (idx !== undefined && idx < optionLines.length) detectedCorrect = idx;
        j = k + 1;
        break;
      }
    }

    if (optionLines.length >= 2) {
      const opts = optionLines.length === 2 ? [...optionLines, "", ""]
        : optionLines.length === 3 ? [...optionLines, ""]
        : optionLines.slice(0, 4);

      questions.push({
        text: qText,
        options: opts,
        correctIndex: detectedCorrect,
        timeLimitSeconds: 30,
        points: 100,
      });

      console.log(`[Heuristic] Found Q${questions.length}: "${qText.substring(0, 60)}..." (${optionLines.length} opts)`);
      i = j - 1;
    }
  }

  console.log(`[Heuristic] Total: ${questions.length} questions detected`);
  return { detected: questions.length > 0, questions };
}

// ═══════════════════════════════════════════════════════════════════════════
// ── LOCAL SMART QUESTION GENERATOR ───────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

function extractKeySentences(text) {
  const raw = text.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();

  return raw
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 25 && s.length < 350)
    .filter((s) => {
      if (/^(chapter|page|figure|table|source|copyright|isbn|slide)/i.test(s)) return false;
      if (!/[a-zA-Z]{3,}/.test(s)) return false;
      if (s.split(/\s+/).length < 4) return false;
      return true;
    });
}

function extractKeyTerms(text) {
  const words = text
    .replace(/[^a-zA-Z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

  const freq = {};
  words.forEach((w) => { freq[w] = (freq[w] || 0) + 1; });

  // Also extract multi-word terms (bigrams)
  const rawWords = text.replace(/[^a-zA-Z\s]/g, " ").split(/\s+/).filter((w) => w.length > 2);
  for (let i = 0; i < rawWords.length - 1; i++) {
    const bigram = rawWords[i].charAt(0).toUpperCase() + rawWords[i].slice(1).toLowerCase() + " " +
                   rawWords[i + 1].charAt(0).toUpperCase() + rawWords[i + 1].slice(1).toLowerCase();
    if (bigram.length > 6 && bigram.length < 30) {
      freq[bigram] = (freq[bigram] || 0) + 1;
    }
  }

  return Object.entries(freq)
    .filter(([, count]) => count >= 2 && count <= 50)
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word)
    .slice(0, 150);
}

function isFactualSentence(sentence) {
  const patterns = [
    /\bis\b/i, /\bare\b/i, /\bwas\b/i, /\bwere\b/i,
    /\bhas\b/i, /\bhave\b/i, /\bcan\b/i, /\bconsists?\b/i,
    /\bcontains?\b/i, /\brefers?\b/i, /\bmeans?\b/i,
    /\bknown\s+as\b/i, /\bcalled\b/i, /\bdefined\s+as\b/i,
    /\bdiscovered\b/i, /\binvented\b/i, /\bdeveloped\b/i,
    /\bfounded\b/i, /\bcreated\b/i, /\boccurs?\b/i,
    /\bprocess\b/i, /\bfunction\b/i, /\bpurpose\b/i,
    /\btype\b/i, /\bexample\b/i, /\binclude\b/i,
    /\blargest\b/i, /\bsmallest\b/i, /\bfirst\b/i, /\bmost\b/i,
    /\bresponsible\b/i, /\bimportant\b/i, /\bessential\b/i,
    /\bproduces?\b/i, /\bcauses?\b/i, /\bresults?\b/i,
    /\bhelps?\b/i, /\bused\b/i, /\bprovides?\b/i,
    /\bstores?\b/i, /\bconverts?\b/i, /\btransforms?\b/i,
    /\bprotects?\b/i, /\bsupports?\b/i, /\bconnects?\b/i,
    /\brepresents?\b/i, /\bcomprises?\b/i, /\bbelongs?\b/i,
    /\bcompared\b/i, /\bdiffers?\b/i, /\bmeasures?\b/i,
  ];
  return patterns.some((p) => p.test(sentence));
}

function generateDistractors(correctAnswer, allTerms, count) {
  const distractors = [];
  const correctLower = correctAnswer.toLowerCase();
  const correctWords = correctLower.split(/\s+/);

  // Strategy 1: Similar-length terms from the document
  const candidates = allTerms
    .filter((t) => {
      const tLower = t.toLowerCase();
      return tLower !== correctLower && !correctWords.includes(tLower);
    })
    .sort(() => Math.random() - 0.5);

  for (const term of candidates) {
    if (distractors.length >= count) break;
    if (!distractors.includes(term)) distractors.push(term);
  }

  // Strategy 2: Generic fillers if needed
  const generics = [
    "None of the above",
    "All of the above",
    "Cannot be determined",
    "Not applicable",
    "Both A and B",
  ];
  for (const g of generics) {
    if (distractors.length >= count) break;
    if (!distractors.includes(g)) distractors.push(g);
  }

  return distractors.slice(0, count);
}

function generateFalseStatements(originalSentence, allTerms) {
  const results = [];
  const words = originalSentence.split(/\s+/);

  for (let attempt = 0; attempt < 8 && results.length < 3; attempt++) {
    const modified = [...words];
    const targets = modified
      .map((w, i) => ({ word: w, index: i }))
      .filter(({ word }) => word.length > 4 && /^[A-Z]/.test(word));

    if (targets.length > 0) {
      const target = targets[Math.floor(Math.random() * targets.length)];
      const replacement = allTerms.find(
        (t) => t.toLowerCase() !== target.word.toLowerCase() && !results.some((r) => r.includes(t))
      );
      if (replacement) {
        modified[target.index] = replacement;
        const f = modified.join(" ").replace(/\.+$/, "");
        if (f !== originalSentence.replace(/\.+$/, "")) results.push(f);
      }
    }
  }

  return results;
}

function generateQuestionFromSentence(sentence, allTerms, usedQuestions) {
  const patterns = [
    { regex: /^(.+?)\s+(?:is|are|was|were)\s+(?:a|an|the)?\s*(.+?)\.?$/i, template: "what" },
    { regex: /^(.+?)\s+(?:is|are)\s+known\s+as\s+(.+?)\.?$/i, template: "known_as" },
    { regex: /^(.+?)\s+(?:is|are)\s+called\s+(.+?)\.?$/i, template: "called" },
    { regex: /^(.+?)\s+(?:is|are)\s+defined\s+as\s+(.+?)\.?$/i, template: "defined" },
    { regex: /^(.+?)\s+(?:contains?|consists?\s+of|includes?)\s+(.+?)\.?$/i, template: "contains" },
    { regex: /^(.+?)\s+(?:was|were)\s+(?:discovered|invented|founded|created)\s+(?:by|in)\s+(.+?)\.?$/i, template: "who_when" },
    { regex: /^The\s+(.+?)\s+(?:is|are|was|were)\s+(.+?)\.?$/i, template: "the_what" },
    { regex: /^(.+?)\s+(?:can|could)\s+(.+?)\.?$/i, template: "can" },
    { regex: /^(.+?)\s+(?:has|have|had)\s+(.+?)\.?$/i, template: "has" },
    { regex: /^(.+?)\s+(?:causes?|produces?|results?\s+in)\s+(.+?)\.?$/i, template: "causes" },
    { regex: /^(.+?)\s+(?:helps?|allows?|enables?)\s+(.+?)\.?$/i, template: "helps" },
    { regex: /^(.+?)\s+(?:is\s+used\s+(?:for|to|in))\s+(.+?)\.?$/i, template: "used_for" },
    { regex: /^(.+?)\s+(?:plays?\s+(?:a|an|the)?)\s+(.+?)\.?$/i, template: "role" },
    { regex: /^(.+?)\s+(?:provides?|gives?|offers?)\s+(.+?)\.?$/i, template: "provides" },
    { regex: /^(.+?)\s+(?:belongs?\s+to)\s+(.+?)\.?$/i, template: "belongs" },
  ];

  for (const { regex, template } of patterns) {
    const match = sentence.match(regex);
    if (!match) continue;

    const subject = match[1].trim();
    const answer = match[2].trim();
    if (answer.length < 3 || answer.length > 120 || subject.length < 3) continue;

    let questionText;
    switch (template) {
      case "what": case "the_what":
        questionText = `What is ${subject.replace(/^the\s+/i, "")}?`; break;
      case "known_as":
        questionText = `What is ${subject} known as?`; break;
      case "called":
        questionText = `What is ${subject} called?`; break;
      case "defined":
        questionText = `How is ${subject} defined?`; break;
      case "contains":
        questionText = `What does ${subject} contain or include?`; break;
      case "who_when":
        questionText = `By whom or when was ${subject} discovered/invented?`; break;
      case "can":
        questionText = `What can ${subject} do?`; break;
      case "has":
        questionText = `What does ${subject} have?`; break;
      case "causes":
        questionText = `What does ${subject} cause or produce?`; break;
      case "helps":
        questionText = `What does ${subject} help or enable?`; break;
      case "used_for":
        questionText = `What is ${subject} used for?`; break;
      case "role":
        questionText = `What role does ${subject} play?`; break;
      case "provides":
        questionText = `What does ${subject} provide?`; break;
      case "belongs":
        questionText = `What does ${subject} belong to?`; break;
      default:
        questionText = `What is true about ${subject}?`;
    }

    if (usedQuestions.has(questionText)) continue;

    const distractors = generateDistractors(answer, allTerms, 3);
    if (distractors.length < 3) continue;

    const correctPos = Math.floor(Math.random() * 4);
    const options = [...distractors];
    options.splice(correctPos, 0, answer);
    usedQuestions.add(questionText);

    return {
      text: questionText,
      options: options.slice(0, 4),
      correctIndex: correctPos,
      timeLimitSeconds: 30,
      points: 100,
    };
  }

  // Fallback: "which is correct" style
  if (sentence.length > 35 && !usedQuestions.has(sentence)) {
    usedQuestions.add(sentence);
    const correctStatement = sentence.replace(/\.+$/, "");
    const falseOptions = generateFalseStatements(sentence, allTerms);

    if (falseOptions.length >= 3) {
      const correctPos = Math.floor(Math.random() * 4);
      const options = [...falseOptions.slice(0, 3)];
      options.splice(correctPos, 0, correctStatement);

      return {
        text: "Which of the following statements is correct?",
        options: options.slice(0, 4),
        correctIndex: correctPos,
        timeLimitSeconds: 30,
        points: 100,
      };
    }
  }

  return null;
}

export function generateQuestionsLocally(text, difficulty = "medium", maxQuestions = 15) {
  const sentences = extractKeySentences(text);
  const keyTerms = extractKeyTerms(text);
  const usedQuestions = new Set();
  const questions = [];

  const factual = sentences.filter(isFactualSentence);
  const others = sentences.filter((s) => !isFactualSentence(s));
  const shuffled = [...factual, ...others].sort(() => Math.random() - 0.5);

  for (const sentence of shuffled) {
    if (questions.length >= maxQuestions) break;
    const q = generateQuestionFromSentence(sentence, keyTerms, usedQuestions);
    if (q) questions.push(q);
  }

  const pointsMap = { easy: 50, medium: 100, hard: 150, mixed: 100 };
  const points = pointsMap[difficulty] || 100;
  const timeMap = { easy: 20, medium: 30, hard: 45, mixed: 30 };
  const time = timeMap[difficulty] || 30;

  return questions.map((q, i) => ({
    ...q,
    points: difficulty === "mixed" ? (i % 3 === 0 ? 50 : i % 3 === 1 ? 100 : 150) : points,
    timeLimitSeconds: difficulty === "mixed" ? (i % 3 === 0 ? 20 : i % 3 === 1 ? 30 : 45) : time,
  }));
}

// ═══════════════════════════════════════════════════════════════════════════
// ── AI ENGINE (Google Gemini) ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGeminiWithRetry(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_gemini_api_key_here") return null;

  const genAI = new GoogleGenerativeAI(apiKey);
  const models = ["gemini-2.0-flash", "gemini-1.5-flash"];

  for (const modelName of models) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[AI] Trying ${modelName} (attempt ${attempt})...`);
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        console.log(`[AI] ✅ Success with ${modelName}`);
        return result.response.text();
      } catch (err) {
        const isRetryable = err.message?.includes("429") || err.message?.includes("quota") || err.message?.includes("503");
        if (isRetryable && attempt < 2) {
          console.log(`[AI] Rate limited, waiting 10s...`);
          await sleep(10000);
          continue;
        }
        console.log(`[AI] ❌ ${modelName} failed: ${err.message}`);
        break;
      }
    }
  }
  return null;
}

async function tryAIExtraction(text, difficulty, mode) {
  const MAX_CHARS = 25000; // ~15 pages of content
  const truncated = text.length > MAX_CHARS ? text.substring(0, MAX_CHARS) + "\n...[truncated]" : text;

  const difficultyGuide = {
    easy: "Simple recall questions. Clear, straightforward language. Test basic definitions and facts.",
    medium: "Moderate difficulty. Test understanding and application of concepts.",
    hard: "Challenging questions requiring analysis, critical thinking, and deep understanding. Include tricky but fair distractors.",
    mixed: "Balanced mix: 30% easy (recall), 40% medium (application), 30% hard (analysis).",
  };

  let prompt;
  if (mode === "extract") {
    prompt = `You are an expert quiz extractor. Extract ALL questions, options, and correct answers from this document.

RULES:
- Extract every question exactly as written
- Extract all 4 options (A, B, C, D)
- Identify the correct answer index (0=A, 1=B, 2=C, 3=D)
- If correct answer is marked, use that. If not, use your knowledge to determine it.
- Do NOT skip any questions
- Do NOT modify the question text

DOCUMENT:
${truncated}

Return ONLY a JSON array:
[{"text":"Question text?","options":["Option A","Option B","Option C","Option D"],"correctIndex":0,"timeLimitSeconds":30,"points":100}]

ONLY JSON, no markdown fences, no explanation.`;
  } else {
    prompt = `You are an expert educational quiz creator for a battle arena platform.

TASK: Generate 10-15 high-quality multiple choice questions from this content.

DIFFICULTY: ${(difficulty || "medium").toUpperCase()}
${difficultyGuide[difficulty] || difficultyGuide.medium}

RULES:
- Each question: exactly 4 options, exactly 1 correct answer
- Wrong options must be plausible but clearly incorrect
- Cover different topics/sections from the content
- No duplicate or very similar questions
- Options should be similar in length
- Distribute correct answers across A(0), B(1), C(2), D(3)
- Questions should be clear and unambiguous
- Include a variety of question types: definition, comparison, application, analysis

CONTENT:
${truncated}

Return ONLY a JSON array:
[{"text":"Question text?","options":["Option A","Option B","Option C","Option D"],"correctIndex":0,"timeLimitSeconds":30,"points":100}]

ONLY JSON, no markdown fences, no explanation.`;
  }

  const responseText = await callGeminiWithRetry(prompt);
  if (!responseText) return null;

  try {
    const cleaned = responseText.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    let questions;
    try {
      questions = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\[[\s\S]*\]/);
      if (match) questions = JSON.parse(match[0]);
      else return null;
    }

    if (!Array.isArray(questions)) return null;

    return questions
      .filter((q) => q && q.text && Array.isArray(q.options) && q.options.length >= 2)
      .map((q) => ({
        text: String(q.text).trim(),
        options: q.options.map((o) => String(o || "").trim()).slice(0, 4),
        correctIndex: typeof q.correctIndex === "number" && q.correctIndex >= 0 && q.correctIndex <= 3 ? q.correctIndex : -1,
        timeLimitSeconds: Number(q.timeLimitSeconds) || 30,
        points: Number(q.points) || 100,
      }));
  } catch (e) {
    console.log("[AI] Parse error:", e.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ── MAIN ORCHESTRATOR ────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

export async function processFile(buffer, mimetype, originalname, difficulty = "medium") {
  console.log(`[Extract] ═══ Starting extraction: ${originalname} (${(buffer.length / 1024).toFixed(1)} KB) ═══`);

  const text = await extractTextFromFile(buffer, mimetype, originalname);

  if (!text || text.length < 15) {
    throw new Error("The uploaded file contains very little readable text. If this is a scanned document, ensure it has clear text.");
  }

  console.log(`[Extract] Extracted ${text.length} characters of text`);
  const contentPreview = text.substring(0, 500) + (text.length > 500 ? "..." : "");
  const contentType = analyzeContentType(text);
  console.log(`[Extract] Content analysis → Q:${contentType.questionScore} vs C:${contentType.contentScore} → ${contentType.likelyQuestions ? "QUESTIONS" : "CONTENT"}`);

  // Layer 1: Heuristic detection
  const { detected, questions: heuristicQuestions } = detectExistingQuestions(text);

  if (difficulty === "questions_only") {
    if (detected) {
      return { questions: heuristicQuestions, method: "heuristic", contentPreview };
    }
    const aiResult = await tryAIExtraction(text, "medium", "extract");
    if (aiResult && aiResult.length > 0) {
      return { questions: aiResult, method: "ai_extract", contentPreview };
    }
    if (contentType.likelyContent) {
      console.log("[Extract] Content detected → auto-generating questions...");
      const localQuestions = generateQuestionsLocally(text, "medium");
      if (localQuestions.length > 0) {
        return { questions: localQuestions, method: "local_generate", contentPreview };
      }
    }
    throw new Error("No questions found. Try Easy/Medium/Hard mode to generate questions.");
  }

  // Good heuristic results
  if (detected && heuristicQuestions.length >= 5 && heuristicQuestions.some((q) => q.correctIndex >= 0)) {
    return { questions: heuristicQuestions, method: "heuristic", contentPreview };
  }

  // Layer 2: AI generation
  const aiResult = await tryAIExtraction(text, difficulty, "generate");
  if (aiResult && aiResult.length > 0) {
    return { questions: aiResult, method: "ai_generate", contentPreview };
  }

  // Layer 3: Local generator
  console.log("[Extract] AI unavailable → local generator...");
  const localQuestions = generateQuestionsLocally(text, difficulty);
  if (localQuestions.length > 0) {
    return { questions: localQuestions, method: "local_generate", contentPreview };
  }

  // Layer 4: Heuristic fallback
  if (detected) {
    return { questions: heuristicQuestions, method: "heuristic_fallback", contentPreview };
  }

  throw new Error("Could not generate questions. The content may be too short. Try a longer document with more text.");
}
