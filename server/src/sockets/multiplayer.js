import jwt from "jsonwebtoken";
import Quiz from "../models/Quiz.js";
import MultiplayerSession from "../models/MultiplayerSession.js";

// In-memory room state for live games
const roomState = {};

function getTokenFromHandshake(socket) {
  const authHeader = socket.handshake.auth?.token || socket.handshake.headers.authorization;
  if (!authHeader) return null;
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }
  return authHeader;
}

export function initMultiplayerSockets(io) {
  io.on("connection", (socket) => {
    socket.on("join_room", async ({ joinCode }, callback) => {
      try {
        const token = getTokenFromHandshake(socket);
        if (!token) {
          return callback && callback({ error: "Unauthorized" });
        }
        const payload = jwt.verify(token, process.env.JWT_SECRET || "dev_secret");

        const session = await MultiplayerSession.findOne({ joinCode }).populate("quiz");
        if (!session) {
          return callback && callback({ error: "Room not found" });
        }

        const userId = payload.id;
        const name = payload.name;

        // Ensure player exists in session DB list
        let dbPlayer = session.players.find(
          (p) => p.userId && p.userId.toString() === userId.toString()
        );
        if (!dbPlayer) {
          dbPlayer = {
            userId,
            name,
            rollNumber: payload.rollNumber || "",
            section: payload.section || "",
            branch: payload.branch || "",
            score: 0,
            cheatCount: 0,
            marksObtained: 0,
            correctAnswers: 0,
            wrongAnswers: 0,
            skippedQuestions: 0
          };
          session.players.push(dbPlayer);
          await session.save();
        } else {
          dbPlayer.name = name;
          dbPlayer.rollNumber = payload.rollNumber || "";
          dbPlayer.section = payload.section || "";
          dbPlayer.branch = payload.branch || "";
          await session.save();
        }

        // Initialize room state if missing
        if (!roomState[joinCode]) {
          const totalMarks = session.quiz.questions.reduce((sum, q) => sum + (typeof q.marks === 'number' ? q.marks : 1), 0);
          roomState[joinCode] = {
            sessionId: session._id.toString(),
            quizId: session.quiz._id.toString(),
            hostUserId: session.host.toString(),
            totalMarks,
            players: {}
          };
        }

        const state = roomState[joinCode];
        if (!state.players[userId]) {
          const questionIndices = session.quiz.questions.map((_, idx) => idx);
          // shuffle
          for (let i = questionIndices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [questionIndices[i], questionIndices[j]] = [questionIndices[j], questionIndices[i]];
          }
          state.players[userId] = {
            socketId: socket.id,
            name,
            score: 0,
            marksObtained: 0,
            correctAnswers: 0,
            wrongAnswers: 0,
            skippedQuestions: 0,
            order: questionIndices,
            currentIndex: 0,
            finished: false,
            correctStreak: 0,
            powerAvailable: false,
            activePower: null,
            shieldActive: false,
            doubleNext: false
          };
        } else {
          state.players[userId].socketId = socket.id;
        }

        socket.join(joinCode);

        io.to(joinCode).emit("lobby_update", {
          players: Object.entries(state.players).map(([id, p]) => ({
            id,
            name: p.name,
            score: p.score,
            marksObtained: p.marksObtained,
            correctAnswers: p.correctAnswers,
            wrongAnswers: p.wrongAnswers,
            skippedQuestions: p.skippedQuestions
          }))
        });

        callback &&
          callback({
            success: true,
            isHost: state.hostUserId === userId.toString(),
            quizTitle: session.quiz.title
          });

        if (session.status === "in_progress" && !state.players[userId].finished) {
          const p = state.players[userId];
          const quiz = await Quiz.findById(state.quizId);
          if (quiz) {
            const realQuestionIndex = p.order[p.currentIndex];
            const q = quiz.questions[realQuestionIndex];
            if (q) {
              io.to(p.socketId).emit("question", {
                questionIndex: p.currentIndex,
                totalQuestions: p.order.length,
                text: q.text,
                options: q.options,
                timeLimitSeconds: q.timeLimitSeconds,
                points: 800
              });
            }
          }
        }

        if (session.status === "in_progress" || session.status === "finished") {
          const leaderboard = Object.entries(state.players)
            .map(([id, p]) => ({ 
              id, 
              name: p.name, 
              score: p.score,
              marksObtained: p.marksObtained,
              correctAnswers: p.correctAnswers,
              wrongAnswers: p.wrongAnswers,
              skippedQuestions: p.skippedQuestions
            }))
            .sort((a, b) => b.score - a.score);

          io.to(state.players[userId].socketId).emit("score_update", { leaderboard, totalMarks: state.totalMarks });

          if (session.status === "finished") {
            io.to(state.players[userId].socketId).emit("quiz_finished", { leaderboard, totalMarks: state.totalMarks });
          }
        }

      } catch (err) {
        console.error(err);
        callback && callback({ error: "Failed to join room" });
      }
    });

    socket.on("start_quiz", async ({ joinCode }, callback) => {
      try {
        const token = getTokenFromHandshake(socket);
        if (!token) {
          return callback && callback({ error: "Unauthorized" });
        }
        const payload = jwt.verify(token, process.env.JWT_SECRET || "dev_secret");
        const userId = payload.id;

        const state = roomState[joinCode];
        if (!state || state.hostUserId !== userId.toString()) {
          return callback && callback({ error: "Only host can start" });
        }

        const session = await MultiplayerSession.findOne({ joinCode });
        if (!session) {
          return callback && callback({ error: "Room not found" });
        }
        session.status = "in_progress";
        await session.save();

        const quiz = await Quiz.findById(state.quizId);
        if (!quiz) {
          return callback && callback({ error: "Quiz not found" });
        }

        // Send first question to each player individually (random order per player)
        Object.entries(state.players).forEach(([pid, p]) => {
          const firstIdx = p.order[0];
          const q = quiz.questions[firstIdx];
          io.to(p.socketId).emit("question", {
            questionIndex: 0,
            totalQuestions: p.order.length,
            text: q.text,
            options: q.options,
            timeLimitSeconds: q.timeLimitSeconds,
            points: 800
          });
        });

        io.to(joinCode).emit("quiz_started");
        callback && callback({ success: true });
      } catch (err) {
        console.error(err);
        callback && callback({ error: "Failed to start quiz" });
      }
    });

    socket.on("submit_answer", async ({ joinCode, questionIndex, selectedIndex }, callback) => {
      try {
        const token = getTokenFromHandshake(socket);
        if (!token) {
          return callback && callback({ error: "Unauthorized" });
        }
        const payload = jwt.verify(token, process.env.JWT_SECRET || "dev_secret");
        const userId = payload.id;

        const state = roomState[joinCode];
        if (!state) {
          return callback && callback({ error: "Room not found" });
        }
        const player = state.players[userId];
        if (!player || player.finished) {
          return callback && callback({ error: "Player not in room" });
        }
        if (questionIndex !== player.currentIndex) {
          return callback && callback({ error: "Out-of-sync question" });
        }

        const quiz = await Quiz.findById(state.quizId);
        if (!quiz) {
          return callback && callback({ error: "Quiz not found" });
        }

        const realQuestionIndex = player.order[questionIndex];
        const q = quiz.questions[realQuestionIndex];

        let gained = 0;
        const basePoints = 800;
        const isCorrect = q && selectedIndex === q.correctIndex;
        const questionMarks = typeof q.marks === 'number' ? q.marks : 1;

        if (isCorrect) {
          player.correctAnswers += 1;
          player.marksObtained += questionMarks;
          player.correctStreak += 1;
          gained = basePoints;
          if (player.doubleNext) {
            gained *= 2;
            player.doubleNext = false;
          }
          player.score += gained;
          if (player.correctStreak > 0 && player.correctStreak % 4 === 0 && !player.powerAvailable) {
            player.powerAvailable = true;
            io.to(player.socketId).emit("power_unlocked");
          }
        } else {
          player.correctStreak = 0;
          if (selectedIndex === -1) {
            player.skippedQuestions += 1;
          } else {
            player.wrongAnswers += 1;
          }
        }

        // Update DB session score snapshot
        const session = await MultiplayerSession.findOne({ joinCode });
        if (session) {
          const dbPlayer = session.players.find(
            (p) => p.userId && p.userId.toString() === userId.toString()
          );
          if (dbPlayer) {
            dbPlayer.score = player.score;
            dbPlayer.marksObtained = player.marksObtained;
            dbPlayer.correctAnswers = player.correctAnswers;
            dbPlayer.wrongAnswers = player.wrongAnswers;
            dbPlayer.skippedQuestions = player.skippedQuestions;
            await session.save();
          }
        }

        // Broadcast score update
        const leaderboard = Object.entries(state.players)
          .map(([id, p]) => ({ 
            id, 
            name: p.name, 
            score: p.score,
            marksObtained: p.marksObtained,
            correctAnswers: p.correctAnswers,
            wrongAnswers: p.wrongAnswers,
            skippedQuestions: p.skippedQuestions
          }))
          .sort((a, b) => b.score - a.score);

        io.to(joinCode).emit("score_update", { leaderboard, totalMarks: state.totalMarks });

        player.currentIndex += 1;

        if (player.currentIndex >= player.order.length) {
          player.finished = true;
          // Check if all finished
          const allFinished = Object.values(state.players).every((p) => p.finished);
          if (allFinished) {
            await finalizeSession(joinCode);
            setTimeout(() => {
              io.to(joinCode).emit("quiz_finished", { leaderboard, totalMarks: state.totalMarks });
            }, 2500);
          }
          callback && callback({ correct: gained > 0, gained, finished: true, correctIndex: q.correctIndex });
          return;
        }

        // Send next question with a delay so user sees feedback first
        const nextRealIdx = player.order[player.currentIndex];
        const nextQ = quiz.questions[nextRealIdx];
        
        setTimeout(() => {
          const currentPlayer = state.players[userId];
          if (currentPlayer) {
            io.to(currentPlayer.socketId).emit("question", {
              questionIndex: player.currentIndex,
              totalQuestions: player.order.length,
              text: nextQ.text,
              options: nextQ.options,
              timeLimitSeconds: nextQ.timeLimitSeconds,
              points: 800
            });
          }
        }, 2500);

        callback && callback({ correct: gained > 0, gained, finished: false, correctIndex: q.correctIndex });
      } catch (err) {
        console.error(err);
        callback && callback({ error: "Failed to submit answer" });
      }
    });

    socket.on("select_power", ({ joinCode, powerType }, callback) => {
      try {
        const token = getTokenFromHandshake(socket);
        if (!token) {
          return callback && callback({ error: "Unauthorized" });
        }
        const payload = jwt.verify(token, process.env.JWT_SECRET || "dev_secret");
        const userId = payload.id;

        const state = roomState[joinCode];
        if (!state) {
          return callback && callback({ error: "Room not found" });
        }
        const player = state.players[userId];
        if (!player || !player.powerAvailable) {
          return callback && callback({ error: "No power available" });
        }

        player.powerAvailable = false;
        player.activePower = powerType;

        if (powerType === "shield") {
          player.shieldActive = true;
          player.activePower = null;
        } else if (powerType === "double") {
          player.doubleNext = true;
          player.activePower = null;
        }

        callback && callback({ success: true, powerType });
      } catch (err) {
        console.error(err);
        callback && callback({ error: "Failed to select power" });
      }
    });

    socket.on("use_power", async ({ joinCode, powerType, targetPlayerId }, callback) => {
      try {
        const token = getTokenFromHandshake(socket);
        if (!token) {
          return callback && callback({ error: "Unauthorized" });
        }
        const payload = jwt.verify(token, process.env.JWT_SECRET || "dev_secret");
        const userId = payload.id;

        const state = roomState[joinCode];
        if (!state) {
          return callback && callback({ error: "Room not found" });
        }
        const player = state.players[userId];
        if (!player) {
          return callback && callback({ error: "Player not in room" });
        }

        if (powerType === "attack") {
          if (!targetPlayerId || !state.players[targetPlayerId]) {
            return callback && callback({ error: "Invalid target" });
          }
          const target = state.players[targetPlayerId];

          if (target.shieldActive) {
            target.shieldActive = false;
            io.to(joinCode).emit("power_event", {
              type: "shield_block",
              from: player.name,
              to: target.name
            });
            return callback && callback({ success: true, blocked: true });
          }

          target.score -= 500;
          if (target.score < 0) target.score = 0;

          const session = await MultiplayerSession.findOne({ joinCode });
          if (session) {
            const dbTarget = session.players.find(
              (p) => p.userId && p.userId.toString() === targetPlayerId.toString()
            );
            if (dbTarget) {
              dbTarget.score = target.score;
              await session.save();
            }
          }

          const leaderboard = Object.entries(state.players)
            .map(([id, p]) => ({ 
              id, 
              name: p.name, 
              score: p.score,
              marksObtained: p.marksObtained,
              correctAnswers: p.correctAnswers,
              wrongAnswers: p.wrongAnswers,
              skippedQuestions: p.skippedQuestions
            }))
            .sort((a, b) => b.score - a.score);

          io.to(joinCode).emit("score_update", { leaderboard, totalMarks: state.totalMarks });
          io.to(joinCode).emit("power_event", {
            type: "attack",
            from: player.name,
            to: target.name,
            delta: -500
          });

          callback && callback({ success: true });
        }
      } catch (err) {
        console.error(err);
        callback && callback({ error: "Failed to use power" });
      }
    });

    socket.on("report_cheat", async ({ joinCode }, callback) => {
      try {
        const token = getTokenFromHandshake(socket);
        if (!token) return;
        const payload = jwt.verify(token, process.env.JWT_SECRET || "dev_secret");
        const userId = payload.id;

        const state = roomState[joinCode];
        if (!state) return;
        const player = state.players[userId];
        if (!player) return;

        // If player is host, they shouldn't trigger anti-cheat on themselves
        if (state.hostUserId === userId.toString()) return;

        if (!player.cheatCount) player.cheatCount = 0;
        player.cheatCount += 1;

        // Save cheat count to DB instantly
        try {
          const session = await MultiplayerSession.findOne({ joinCode });
          if (session) {
            const dbPlayer = session.players.find(p => p.userId && p.userId.toString() === userId.toString());
            if (dbPlayer) {
              dbPlayer.cheatCount = player.cheatCount;
              await session.save();
            }
          }
        } catch (dbErr) {
          console.error("Failed to update cheat score in DB", dbErr);
        }

        const hostPlayer = state.players[state.hostUserId];
        if (hostPlayer) {
          io.to(hostPlayer.socketId).emit("cheat_alert", {
            playerName: player.name,
            cheatCount: player.cheatCount
          });
        }

        if (player.cheatCount >= 2) {
          player.finished = true;
          const allFinished = Object.values(state.players).every((p) => p.finished);
          if (allFinished) {
            await finalizeSession(joinCode);
            const leaderboard = Object.entries(state.players)
              .map(([id, p]) => ({ 
                id, 
                name: p.name, 
                score: p.score,
                marksObtained: p.marksObtained,
                correctAnswers: p.correctAnswers,
                wrongAnswers: p.wrongAnswers,
                skippedQuestions: p.skippedQuestions
              }))
              .sort((a, b) => b.score - a.score);
            setTimeout(() => {
              io.to(joinCode).emit("quiz_finished", { leaderboard, totalMarks: state.totalMarks });
            }, 2500);
          }
          callback && callback({ success: true, action: "kicked" });
        } else {
          callback && callback({ success: true, action: "warned" });
        }
      } catch (err) {
        console.error(err);
      }
    });

    socket.on("taunt", ({ joinCode, message, emoji }) => {
      try {
        const token = getTokenFromHandshake(socket);
        if (!token) {
          return;
        }
        const payload = jwt.verify(token, process.env.JWT_SECRET || "dev_secret");
        const state = roomState[joinCode];
        if (!state) return;
        const player = state.players[payload.id];
        if (!player) return;

        const trimmed = (message || "").toString().trim().slice(0, 40);
        io.to(joinCode).emit("taunt", {
          from: player.name,
          emoji,
          message: trimmed
        });
      } catch (err) {
        console.error(err);
      }
    });

    socket.on("end_quiz", async ({ joinCode }, callback) => {
      try {
        const token = getTokenFromHandshake(socket);
        if (!token) {
          return callback && callback({ error: "Unauthorized" });
        }
        const payload = jwt.verify(token, process.env.JWT_SECRET || "dev_secret");
        const userId = payload.id;

        const state = roomState[joinCode];
        if (!state || state.hostUserId !== userId.toString()) {
          return callback && callback({ error: "Only host can end the quiz" });
        }

        // Mark all players as finished
        Object.values(state.players).forEach((p) => {
          p.finished = true;
        });

        const leaderboard = Object.entries(state.players)
          .map(([id, p]) => ({ 
            id, 
            name: p.name, 
            score: p.score,
            marksObtained: p.marksObtained,
            correctAnswers: p.correctAnswers,
            wrongAnswers: p.wrongAnswers,
            skippedQuestions: p.skippedQuestions
          }))
          .sort((a, b) => b.score - a.score);

        await finalizeSession(joinCode);
        io.to(joinCode).emit("quiz_finished", { leaderboard, totalMarks: state.totalMarks });

        callback && callback({ success: true });
      } catch (err) {
        console.error(err);
        callback && callback({ error: "Failed to end quiz" });
      }
    });

    socket.on("disconnect", () => {
      // We keep room state; clients can reconnect with same token
    });
  });
}

async function finalizeSession(joinCode) {
  try {
    const session = await MultiplayerSession.findOne({ joinCode });
    if (session) {
      session.status = "finished";
      await session.save();
    }
  } catch (err) {
    console.error("Failed to finalize session", err);
  }
}

