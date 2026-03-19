import express from "express";
import { authRequired, requireRole } from "../middleware/auth.js";
import MultiplayerSession from "../models/MultiplayerSession.js";
import Quiz from "../models/Quiz.js";

const router = express.Router();

function generateJoinCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Teacher creates a multiplayer room for a quiz
router.post(
  "/create-room",
  authRequired,
  requireRole("teacher"),
  async (req, res) => {
    try {
      const { quizId } = req.body;
      const quiz = await Quiz.findOne({ _id: quizId, owner: req.user._id });
      if (!quiz) {
        return res.status(404).json({ message: "Quiz not found" });
      }

      let joinCode;
      let existing;
      do {
        joinCode = generateJoinCode();
        existing = await MultiplayerSession.findOne({ joinCode });
      } while (existing);

      const session = await MultiplayerSession.create({
        quiz: quiz._id,
        host: req.user._id,
        joinCode,
        status: "lobby",
        players: []
      });

      res.status(201).json({
        id: session._id,
        joinCode: session.joinCode
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Student validates join code and registers as a player
router.post("/join", authRequired, async (req, res) => {
  try {
    const { joinCode } = req.body;
    const session = await MultiplayerSession.findOne({ joinCode }).populate("quiz");
    if (!session) {
      return res.status(404).json({ message: "Room not found" });
    }
    if (session.status !== "lobby") {
      return res.status(400).json({ message: "Quiz already started" });
    }

    const existing = session.players.find(
      (p) => p.userId && p.userId.toString() === req.user._id.toString()
    );
    if (!existing) {
      session.players.push({
        userId: req.user._id,
        name: req.user.name,
        score: 0
      });
      await session.save();
    }

    res.json({
      sessionId: session._id,
      joinCode: session.joinCode,
      quiz: {
        id: session.quiz._id,
        title: session.quiz.title,
        description: session.quiz.description,
        questionCount: session.quiz.questions.length
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Basic session info + leaderboard (after quiz ends)
router.get("/session/:joinCode", authRequired, async (req, res) => {
  try {
    const session = await MultiplayerSession.findOne({ joinCode: req.params.joinCode }).populate(
      "quiz"
    );
    if (!session) {
      return res.status(404).json({ message: "Room not found" });
    }

    const leaderboard = [...session.players]
      .sort((a, b) => b.score - a.score)
      .map((p) => ({
        name: p.name,
        score: p.score
      }));

    res.json({
      joinCode: session.joinCode,
      status: session.status,
      quiz: {
        id: session.quiz._id,
        title: session.quiz.title,
        description: session.quiz.description,
        questionCount: session.quiz.questions.length
      },
      leaderboard
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;

