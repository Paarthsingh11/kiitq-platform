import express from "express";
import multer from "multer";
import PDFDocument from "pdfkit";
import { authRequired, requireRole } from "../middleware/auth.js";
import Quiz from "../models/Quiz.js";
import MultiplayerSession from "../models/MultiplayerSession.js";
import { processFile } from "../services/aiExtractor.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB max
});

// Create quiz manually or from client-provided questions
router.post("/", authRequired, requireRole("teacher"), async (req, res) => {
  try {
    const { title, description, questions } = req.body;
    if (!title || !questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ message: "Title and at least one question are required" });
    }
    const quiz = await Quiz.create({
      title,
      description,
      owner: req.user._id,
      questions
    });
    res.status(201).json(quiz);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get quizzes for current teacher (includes hasResults flag)
router.get("/mine", authRequired, requireRole("teacher"), async (req, res) => {
  try {
    const quizzes = await Quiz.find({ owner: req.user._id }).sort({ createdAt: -1 });

    // Check which quizzes have finished sessions
    const quizIds = quizzes.map((q) => q._id);
    const finishedSessions = await MultiplayerSession.aggregate([
      { $match: { quiz: { $in: quizIds }, status: "finished" } },
      { $group: { _id: "$quiz" } },
    ]);
    const finishedQuizIds = new Set(finishedSessions.map((s) => s._id.toString()));

    const result = quizzes.map((q) => ({
      ...q.toObject(),
      hasResults: finishedQuizIds.has(q._id.toString()),
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get single quiz (students also need this)
router.get("/:id", authRequired, async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }
    res.json(quiz);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Update quiz
router.put("/:id", authRequired, requireRole("teacher"), async (req, res) => {
  try {
    const { title, description, questions } = req.body;
    const quiz = await Quiz.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id },
      { title, description, questions },
      { new: true }
    );
    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }
    res.json(quiz);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Delete quiz
router.delete("/:id", authRequired, requireRole("teacher"), async (req, res) => {
  try {
    const quiz = await Quiz.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ── Get quiz results (all sessions) ──────────────────────────────────────
router.get("/:id/results", authRequired, requireRole("teacher"), async (req, res) => {
  try {
    const quiz = await Quiz.findOne({ _id: req.params.id, owner: req.user._id });
    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    const sessions = await MultiplayerSession.find({ quiz: req.params.id })
      .sort({ createdAt: -1 });

    const results = sessions.map((session) => ({
      sessionId: session._id,
      joinCode: session.joinCode,
      status: session.status,
      date: session.createdAt,
      players: session.players
        .map((p) => ({ name: p.name, score: p.score }))
        .sort((a, b) => b.score - a.score)
        .map((p, i) => ({ ...p, rank: i + 1 })),
    }));

    res.json({ quizTitle: quiz.title, results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ── Helper: get finished sessions with sorted players ────────────────────
async function getFinishedResults(quizId, ownerId) {
  const quiz = await Quiz.findOne({ _id: quizId, owner: ownerId });
  if (!quiz) return null;

  const sessions = await MultiplayerSession.find({ quiz: quizId, status: "finished" })
    .sort({ createdAt: -1 })
    .limit(1);

  const totalQuestions = quiz.questions?.length || 0;

  const sessionData = sessions.map((session) => {
    const sorted = [...session.players].sort((a, b) => b.score - a.score);
    return {
      joinCode: session.joinCode,
      date: session.createdAt,
      status: session.status,
      players: sorted.map((p, i) => ({
        sNo: i + 1,
        name: p.name || "Unknown",
        rollNumber: p.rollNumber || "-",
        section: p.section || "-",
        branch: p.branch || "-",
        cheatCount: p.cheatCount || 0,
        rank: i + 1,
        score: p.score,
      })),
    };
  });

  return { quiz, totalQuestions, sessions: sessionData };
}

function formatDate(d) {
  return new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

// ── Download results as CSV ──────────────────────────────────────────────
router.get("/:id/results/download", authRequired, requireRole("teacher"), async (req, res) => {
  try {
    const data = await getFinishedResults(req.params.id, req.user._id);
    if (!data) return res.status(404).json({ message: "Quiz not found" });

    const { quiz, totalQuestions, sessions } = data;

    const rows = ["S.No,Student Name,Roll No,Section,Branch,Rank,Score,Cheated,Session Code,Session Date,Total Questions"];

    for (const session of sessions) {
      const dateStr = formatDate(session.date);
      session.players.forEach((p) => {
        const safeName = `"${p.name.replace(/"/g, '""')}"`;
        const safeRoll = `"${p.rollNumber.replace(/"/g, '""')}"`;
        const safeSec = `"${p.section.replace(/"/g, '""')}"`;
        const safeBranch = `"${p.branch.replace(/"/g, '""')}"`;
        rows.push(`${p.sNo},${safeName},${safeRoll},${safeSec},${safeBranch},${p.rank},${p.score},${p.cheatCount},${session.joinCode},"${dateStr}",${totalQuestions}`);
      });
    }

    if (rows.length === 1) {
      rows.push(`1,"No students","-","-","-","-",0,0,"-","No sessions",${totalQuestions}`);
    }

    const csv = rows.join("\n");
    const filename = `${quiz.title.replace(/[^a-zA-Z0-9 ]/g, "_")}_results.csv`;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ── Download results as PDF ──────────────────────────────────────────────
router.get("/:id/results/download-pdf", authRequired, requireRole("teacher"), async (req, res) => {
  try {
    const data = await getFinishedResults(req.params.id, req.user._id);
    if (!data) return res.status(404).json({ message: "Quiz not found" });

    const { quiz, totalQuestions, sessions } = data;
    const filename = `${quiz.title.replace(/[^a-zA-Z0-9 ]/g, "_")}_results.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const doc = new PDFDocument({ margin: 40, size: "A4" });
    doc.pipe(res);

    // ── Title ──
    doc.fontSize(20).font("Helvetica-Bold").text("Quiz Results Report", { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(10).font("Helvetica").fillColor("#555")
      .text(`Generated on: ${formatDate(new Date())}`, { align: "center" });
    doc.moveDown(1);

    // ── Quiz Info Box ──
    const infoTop = doc.y;
    doc.rect(40, infoTop, doc.page.width - 80, 55).fill("#f0f4ff");
    doc.fillColor("#222").fontSize(12).font("Helvetica-Bold")
      .text(`Quiz: ${quiz.title}`, 55, infoTop + 10);
    doc.fontSize(10).font("Helvetica").fillColor("#444")
      .text(`Total Questions: ${totalQuestions}  |  Total Sessions: ${sessions.length}  |  Teacher: ${req.user.name || "N/A"}`, 55, infoTop + 30);
    doc.y = infoTop + 65;

    if (sessions.length === 0) {
      doc.moveDown(1).fontSize(12).fillColor("#888")
        .text("No completed sessions found for this quiz.", { align: "center" });
      doc.end();
      return;
    }

    // ── Render each session ──
    for (let si = 0; si < sessions.length; si++) {
      const session = sessions[si];

      // Check if we need a new page (at least 120pt needed)
      if (doc.y > doc.page.height - 140) doc.addPage();

      doc.moveDown(0.5);
      doc.fontSize(11).font("Helvetica-Bold").fillColor("#1a3a6a")
        .text(`Session ${si + 1}: Code ${session.joinCode}  —  ${formatDate(session.date)}`);
      doc.moveDown(0.3);

      // ── Table Header ──
      const colX = [40, 70, 160, 225, 275, 325, 365, 405, 445];
      const colW = [30, 90, 65, 50, 50, 40, 40, 40, 95];
      const headers = ["#", "Student", "Roll No", "Section", "Branch", "Rank", "Score", "Warns", "Date"];

      const headerY = doc.y;
      doc.rect(40, headerY, doc.page.width - 80, 20).fill("#2a4a8a");
      doc.fillColor("#fff").fontSize(9).font("Helvetica-Bold");
      headers.forEach((h, i) => {
        doc.text(h, colX[i] + 4, headerY + 5, { width: colW[i], align: "left" });
      });
      doc.y = headerY + 22;

      // ── Table Rows ──
      session.players.forEach((p, ri) => {
        if (doc.y > doc.page.height - 60) {
          doc.addPage();
          // Re-draw header on new page
          const hy = doc.y;
          doc.rect(40, hy, doc.page.width - 80, 20).fill("#2a4a8a");
          doc.fillColor("#fff").fontSize(9).font("Helvetica-Bold");
          headers.forEach((h, i) => {
            doc.text(h, colX[i] + 4, hy + 5, { width: colW[i], align: "left" });
          });
          doc.y = hy + 22;
        }

        const rowY = doc.y;
        const bg = ri % 2 === 0 ? "#f8faff" : "#ffffff";
        doc.rect(40, rowY, doc.page.width - 80, 18).fill(bg);

        doc.fillColor("#333").fontSize(9).font("Helvetica");
        const rowData = [
          String(p.sNo),
          p.name,
          p.rollNumber,
          p.section,
          p.branch,
          `#${p.rank}`,
          String(p.score),
          String(p.cheatCount),
          formatDate(session.date).split(",")[0] || formatDate(session.date)
        ];
        rowData.forEach((val, i) => {
          doc.text(val, colX[i] + 4, rowY + 4, { width: colW[i], align: "left" });
        });
        doc.y = rowY + 18;
      });

      // Bottom border line
      doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).strokeColor("#ccc").stroke();
    }

    // ── Footer ──
    doc.moveDown(1.5);
    doc.fontSize(8).fillColor("#999").font("Helvetica")
      .text("Generated by QuizBattle Platform", { align: "center" });

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ── AI-powered file extraction endpoint ──────────────────────────────────
router.post(
  "/extract",
  authRequired,
  requireRole("teacher"),
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "File is required" });
      }

      // Difficulty from form data: easy, medium, hard, mixed, questions_only
      const difficulty = req.body.difficulty || "medium";

      console.log(
        `[Extract] File: ${req.file.originalname} (${(req.file.size / 1024).toFixed(1)} KB), ` +
        `Type: ${req.file.mimetype}, Difficulty: ${difficulty}`
      );

      const result = await processFile(
        req.file.buffer,
        req.file.mimetype,
        req.file.originalname,
        difficulty
      );

      // Debug: log extracted text preview
      console.log(`[Extract] Text preview:\n${result.contentPreview}\n---`);

      console.log(
        `[Extract] Success: ${result.questions.length} questions via ${result.method}`
      );

      res.json({
        questions: result.questions,
        method: result.method,
        count: result.questions.length,
        contentPreview: result.contentPreview,
      });
    } catch (err) {
      console.error("[Extract] Error:", err.message);
      res.status(422).json({
        message: err.message || "Failed to extract questions from the file.",
        suggestion: "Try a different file format or use the manual quiz builder.",
      });
    }
  }
);

export default router;


