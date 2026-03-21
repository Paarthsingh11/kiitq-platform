import React, { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { io } from "socket.io-client";
import { useAuth } from "../state/AuthContext.jsx";
import { useTheme } from "../state/ThemeContext.jsx";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:4000";

export default function MultiplayerBattlePage() {
  const { joinCode } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const { themes, themeId, activeTheme, setThemeId, resetTheme } = useTheme();

  const [socket, setSocket] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [connected, setConnected] = useState(false);
  const [players, setPlayers] = useState([]);
  const [quizTitle, setQuizTitle] = useState(location.state?.quizTitle || "");
  const [question, setQuestion] = useState(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [score, setScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState([]);
  const [totalMarks, setTotalMarks] = useState(0);
  const [status, setStatus] = useState("lobby");
  const [submitting, setSubmitting] = useState(false);
  const [powerReady, setPowerReady] = useState(false);
  const [showPowerBar, setShowPowerBar] = useState(false);
  const [powerEvent, setPowerEvent] = useState(null);
  const [taunts, setTaunts] = useState([]);
  const [tauntInput, setTauntInput] = useState("");
  const [attackMode, setAttackMode] = useState(false);
  const [answerLocked, setAnswerLocked] = useState(false);
  const [answerResult, setAnswerResult] = useState(null);
  const [correctIndex, setCorrectIndex] = useState(null);
  const [powerToast, setPowerToast] = useState(null);
  const [powerAnim, setPowerAnim] = useState(null);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [cheatWarning, setCheatWarning] = useState("");
  const [cheatAlerts, setCheatAlerts] = useState([]);
  const hasCheatedRef = useRef(false);

  const accentClass = activeTheme?.accent
    ? `question-box-accent-${activeTheme.accent}`
    : "";

  useEffect(() => {
    if (!token) return;
    const s = io(SOCKET_URL, {
      auth: { token: `Bearer ${token}` }
    });

    s.on("connect", () => {
      setConnected(true);
      s.emit("join_room", { joinCode }, (res) => {
        if (res?.error) {
          navigate("/multiplayer/lobby", { state: { joinCode } });
          return;
        }
        setIsHost(res.isHost);
        if (!quizTitle && res.quizTitle) setQuizTitle(res.quizTitle);
      });
    });
    s.on("disconnect", () => setConnected(false));
    s.on("lobby_update", (payload) => {
      setPlayers(payload.players || []);
    });
    s.on("quiz_started", () => {
      setStatus("in_progress");
    });
    s.on("question", (payload) => {
      setStatus("in_progress");
      setQuestion({
        text: payload.text,
        options: payload.options,
        points: payload.points
      });
      setQuestionIndex(payload.questionIndex);
      setTotalQuestions(payload.totalQuestions);
      setTimeLeft(payload.timeLimitSeconds || 30);
      setSelectedIndex(null);
      setAnswerLocked(false);
      setAnswerResult(null);
      setCorrectIndex(null);
    });
    s.on("score_update", (payload) => {
      setLeaderboard(payload.leaderboard || []);
      if (payload.totalMarks !== undefined) setTotalMarks(payload.totalMarks);
    });
    s.on("power_unlocked", () => {
      setPowerReady(true);
      setShowPowerBar(true);
    });
    s.on("power_event", (payload) => {
      setPowerEvent(payload);
      setPowerAnim(payload.type === "shield_block" ? "shield" : payload.type);
      setTimeout(() => { setPowerEvent(null); setPowerAnim(null); }, 3500);
    });
    s.on("taunt", (payload) => {
      setTaunts((prev) => {
        const next = [...prev, payload];
        return next.slice(-6);
      });
    });
    s.on("cheat_alert", (payload) => {
      setCheatAlerts((prev) => [...prev, payload]);
      setTimeout(() => {
        setCheatAlerts((prev) => prev.filter(c => c !== payload));
      }, 5000);
    });
    s.on("quiz_finished", (payload) => {
      setStatus("finished");
      setLeaderboard(payload.leaderboard || []);
      if (payload.totalMarks !== undefined) setTotalMarks(payload.totalMarks);
    });

    setSocket(s);
    return () => {
      s.disconnect();
    };
  }, [joinCode, navigate, quizTitle, score, token]);

  useEffect(() => {
    if (!question || status !== "in_progress") return;
    if (timeLeft <= 0) {
      handleAutoSubmitTimeout();
      return;
    }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, question, status]);

  // Anti-cheat detection for students
  useEffect(() => {
    if (!socket || status !== "in_progress" || isHost) return;

    let timeout;
    const handleVisibilityChange = () => {
      if (document.hidden || !document.hasFocus()) {
        if (hasCheatedRef.current) return;
        hasCheatedRef.current = true;
        
        socket.emit("report_cheat", { joinCode }, (res) => {
          if (res?.action === "warned") {
            setCheatWarning("Warning: Please do not change tabs or minimize! Next time you will be kicked.");
            setTimeout(() => setCheatWarning(""), 7000);
          } else if (res?.action === "kicked") {
            setCheatWarning("You have been kicked for repeated cheating.");
            setTimeout(() => setStatus("finished"), 3000);
          }
        });

        timeout = setTimeout(() => {
          hasCheatedRef.current = false;
        }, 5000);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleVisibilityChange);
      clearTimeout(timeout);
    };
  }, [socket, status, isHost, joinCode]);

  const handleStart = () => {
    if (!socket) return;
    socket.emit("start_quiz", { joinCode }, () => {});
  };

  const handleOptionClick = (idx) => {
    if (answerLocked || submitting || !socket || !question) return;
    setSelectedIndex(idx);
    setAnswerLocked(true);
    setSubmitting(true);
    socket.emit(
      "submit_answer",
      {
        joinCode,
        questionIndex,
        selectedIndex: idx
      },
      (res) => {
        setSubmitting(false);
        if (!res || res.error) {
          setAnswerLocked(false);
          return;
        }
        setAnswerResult("submitted");
        if (res.gained) {
          setScore((s) => s + res.gained);
        }
        // If this student has finished all questions, go to leaderboard after brief feedback
        if (res.finished) {
          setTimeout(() => setStatus("finished"), 2500);
        }
      }
    );
  };

  const handleAutoSubmitTimeout = () => {
    if (answerLocked || submitting) return;
    if (!socket || !question) return;
    setAnswerLocked(true);
    setSubmitting(true);
    socket.emit(
      "submit_answer",
      {
        joinCode,
        questionIndex,
        selectedIndex: selectedIndex ?? -1
      },
      (res) => {
        setSubmitting(false);
        if (!res || res.error) return;
        setAnswerResult("submitted");
        if (res.gained) {
          setScore((s) => s + res.gained);
        }
        if (res.finished) {
          setTimeout(() => setStatus("finished"), 2500);
        }
      }
    );
  };

  const showPowerToastMsg = (msg, type) => {
    setPowerToast({ msg, type });
    setTimeout(() => setPowerToast(null), 2500);
  };

  const handleSelectPower = (type) => {
    if (!socket) return;
    if (type === "attack") {
      // For attack, emit select_power then show target list
      socket.emit("select_power", { joinCode, powerType: type }, (res) => {
        if (!res || res.error) return;
        setShowPowerBar(false);
        setAttackMode(true);
        setPowerReady(false);
      });
      return;
    }
    // Self-powers: instant activation
    socket.emit("select_power", { joinCode, powerType: type }, (res) => {
      if (!res || res.error) return;
      setShowPowerBar(false);
      setPowerReady(false);
      setPowerAnim(type);
      setTimeout(() => setPowerAnim(null), 2500);
      const msgs = {
        shield: "🛡️ Shield activated!",
        double: "✨ Double Points activated!",
        time: "⏱️ Time Freeze activated!"
      };
      showPowerToastMsg(msgs[type] || "Power activated!", type);
    });
  };

  const handleUseAttackOn = (targetId, targetName) => {
    if (!socket || !attackMode) return;
    socket.emit("use_power", { joinCode, powerType: "attack", targetPlayerId: targetId }, (res) => {
      setAttackMode(false);
      if (!res || res.error) return;
      setPowerAnim("attack");
      setTimeout(() => setPowerAnim(null), 2500);
      if (res.blocked) {
        showPowerToastMsg(`🛡️ ${targetName}'s shield blocked your attack!`, "shield");
      } else {
        showPowerToastMsg(`⚡ Attack on ${targetName} — 500 pts deducted!`, "attack");
      }
    });
  };

  const handleSendTaunt = (emoji, text) => {
    if (!socket) return;
    const message = text || tauntInput;
    if (!message && !emoji) return;
    socket.emit("taunt", { joinCode, emoji, message });
    setTauntInput("");
  };

  const handleEndQuiz = () => {
    if (!socket || !isHost) return;
    socket.emit("end_quiz", { joinCode }, () => {});
  };

  const stageTitle =
    status === "lobby"
      ? "Waiting in lobby"
      : status === "in_progress"
      ? "Quiz in progress"
      : "Quiz finished";

  /* ── LOBBY VIEW ── */
  if (status === "lobby") {
    return (
      <div className="mp-lobby-spread">

        {/* Top bar */}
        <div className="mp-lobby-topbar">
          <div>
            <div className="mp-lobby-status-chip">
              <span className="mp-lobby-pulse" />
              <span>{stageTitle}</span>
            </div>
            <h1 className="mp-lobby-title">{quizTitle || "Multiplayer quiz"}</h1>
          </div>
          <div className="mp-lobby-room-badge">
            <span className="mp-lobby-room-label">Room</span>
            <span className="mp-lobby-room-code">{joinCode}</span>
          </div>
        </div>

        {/* Theme picker – right aligned between topbar and content */}
        <div className="theme-picker-wrapper">
          <button
            type="button"
            className="theme-picker-icon"
            onClick={() => setShowThemePicker(!showThemePicker)}
            title="Change theme"
          >
            🎨
          </button>
          {showThemePicker && (
            <div className="theme-picker-panel">
              <button
                type="button"
                className={`theme-picker-item ${themeId === "default" ? "theme-picker-active" : ""}`}
                onClick={() => { setThemeId("default"); setShowThemePicker(false); }}
              >
                <div className="theme-picker-thumb" style={{ background: "linear-gradient(135deg, #334155, #1e293b)" }} />
                {themeId === "default" && <span className="theme-picker-check">✓</span>}
              </button>
              {themes.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`theme-picker-item ${themeId === t.id ? "theme-picker-active" : ""}`}
                  onClick={() => { setThemeId(t.id); setShowThemePicker(false); }}
                >
                  <img src={t.image} alt={t.name} className="theme-picker-thumb" />
                  {themeId === t.id && <span className="theme-picker-check">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Main two-column area */}
        <div className="mp-lobby-columns">
          {/* LEFT – Players */}
          <div className="mp-lobby-panel mp-lobby-players-panel">
            <div className="mp-lobby-panel-header">
              <h2 className="mp-lobby-panel-title">
                <span className="mp-lobby-icon">👥</span> Crew
              </h2>
              <span className="mp-lobby-count-badge">{players.length} online</span>
            </div>
            <div className="mp-lobby-player-list">
              {players.length === 0 && (
                <p className="mp-lobby-empty">Waiting for players to join…</p>
              )}
              {players.map((p, idx) => {
                const hue = (idx * 47) % 360;
                const isYou = p.name === user?.name;
                return (
                  <div
                    key={p.id || `${p.name}-${idx}`}
                    className={`mp-lobby-player-card ${isYou ? "mp-lobby-player-you" : ""}`}
                  >
                    <div
                      className="mp-lobby-avatar"
                      style={{
                        background: `conic-gradient(from 180deg, hsl(${hue},80%,60%), hsl(${(hue + 60) % 360},80%,55%), hsl(${(hue + 120) % 360},80%,60%))`
                      }}
                    >
                      <div className="mp-lobby-avatar-inner">
                        <span className="mp-lobby-avatar-line" />
                        <span className="mp-lobby-avatar-line" />
                      </div>
                    </div>
                    <div className="mp-lobby-player-info">
                      <span className="mp-lobby-player-name">
                        {p.name}
                        {isYou && <span className="mp-lobby-you-tag">you</span>}
                      </span>
                      <span className="mp-lobby-player-score">{p.score} pts</span>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Waiting + Start */}
            <div className="mp-lobby-action-area">
              <div className="mp-lobby-waiting-indicator">
                <span className="mp-lobby-pulse" />
                <span>Waiting for the host to start…</span>
              </div>
              {isHost && (
                <button
                  className="mp-lobby-start-btn"
                  onClick={handleStart}
                  disabled={!connected}
                >
                  🚀 Launch quiz
                </button>
              )}
            </div>
          </div>

          {/* RIGHT – Taunts */}
          <div className="mp-lobby-panel mp-lobby-taunts-panel">
            <div className="mp-lobby-panel-header">
              <h2 className="mp-lobby-panel-title">
                <span className="mp-lobby-icon">💬</span> Taunts
              </h2>
            </div>
            <div className="mp-lobby-taunt-list">
              {taunts.length === 0 && (
                <p className="mp-lobby-empty">Send a quick taunt to the room.</p>
              )}
              {taunts.map((t, idx) => (
                <div key={idx} className="mp-lobby-taunt-bubble">
                  <span className="mp-lobby-taunt-emoji">{t.emoji}</span>
                  <span className="mp-lobby-taunt-text">
                    <strong>{t.from}</strong>
                    {t.message && `: ${t.message}`}
                  </span>
                </div>
              ))}
            </div>
            <div className="mp-lobby-taunt-input-row">
              <div className="mp-lobby-emoji-bar">
                {["😎", "🚀", "🔥", "😂"].map((e) => (
                  <button
                    key={e}
                    type="button"
                    className="mp-lobby-emoji-btn"
                    onClick={() => handleSendTaunt(e, "")}
                  >
                    {e}
                  </button>
                ))}
              </div>
              <form 
                className="mp-lobby-taunt-send-row"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendTaunt("", tauntInput);
                }}
              >
                <input
                  type="text"
                  maxLength={40}
                  value={tauntInput}
                  onChange={(e) => setTauntInput(e.target.value)}
                  placeholder="Ready to lose?"
                  className="mp-lobby-taunt-input"
                />
                <button
                  type="submit"
                  className="mp-lobby-send-btn"
                  disabled={!tauntInput.trim()}
                >
                  Send
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Perks info strip */}
        <div className="mp-lobby-perks-strip">
          <div className="mp-lobby-perk mp-lobby-perk-amber">
            <span className="mp-lobby-perk-name">Shield</span>
            <span className="mp-lobby-perk-desc">Block attacks</span>
          </div>
          <div className="mp-lobby-perk mp-lobby-perk-sky">
            <span className="mp-lobby-perk-name">Double pts</span>
            <span className="mp-lobby-perk-desc">2× next answer</span>
          </div>
          <div className="mp-lobby-perk mp-lobby-perk-rose">
            <span className="mp-lobby-perk-name">Attack</span>
            <span className="mp-lobby-perk-desc">-500 to rival</span>
          </div>
          <div className="mp-lobby-perk mp-lobby-perk-indigo">
            <span className="mp-lobby-perk-name">Time bonus</span>
            <span className="mp-lobby-perk-desc">Extra seconds</span>
          </div>
        </div>
      </div>
    );
  }

  /* ── FINISHED / LEADERBOARD VIEW ── */
  if (status === "finished") {
    const rankEmojis = ["🥇", "🥈", "🥉"];
    const myRank = leaderboard.findIndex((p) => p.name === user?.name);
    return (
      <div className="lb-container">
        <div className="lb-header">
          <div className="lb-header-glow" />
          <h1 className="lb-title">🏆 Final Standings</h1>
          <p className="lb-subtitle">{quizTitle || "Multiplayer Quiz"} • Room {joinCode}</p>
        </div>

        {/* Podium for top 3 */}
        {leaderboard.length >= 2 && (
          <div className="lb-podium">
            {/* 2nd place */}
            {leaderboard[1] && (
              <div className="lb-podium-slot lb-podium-2">
                <div className="lb-podium-avatar lb-podium-avatar-silver">
                  <span className="lb-podium-rank">2</span>
                </div>
                <span className="lb-podium-name">{leaderboard[1].name}</span>
                <span className="lb-podium-score">
                  {leaderboard[1].score} pts<br/>
                  <span className="text-xs opacity-80 font-normal">({leaderboard[1].marksObtained}/{totalMarks} marks)</span>
                </span>
                <div className="lb-podium-bar lb-podium-bar-2" />
              </div>
            )}
            {/* 1st place */}
            {leaderboard[0] && (
              <div className="lb-podium-slot lb-podium-1">
                <div className="lb-podium-crown">👑</div>
                <div className="lb-podium-avatar lb-podium-avatar-gold">
                  <span className="lb-podium-rank">1</span>
                </div>
                <span className="lb-podium-name lb-podium-name-gold">{leaderboard[0].name}</span>
                <span className="lb-podium-score lb-podium-score-gold">
                  {leaderboard[0].score} pts<br/>
                  <span className="text-xs opacity-80 font-normal">({leaderboard[0].marksObtained}/{totalMarks} marks)</span>
                </span>
                <div className="lb-podium-bar lb-podium-bar-1" />
              </div>
            )}
            {/* 3rd place */}
            {leaderboard[2] && (
              <div className="lb-podium-slot lb-podium-3">
                <div className="lb-podium-avatar lb-podium-avatar-bronze">
                  <span className="lb-podium-rank">3</span>
                </div>
                <span className="lb-podium-name">{leaderboard[2].name}</span>
                <span className="lb-podium-score">
                  {leaderboard[2].score} pts<br/>
                  <span className="text-xs opacity-80 font-normal">({leaderboard[2].marksObtained}/{totalMarks} marks)</span>
                </span>
                <div className="lb-podium-bar lb-podium-bar-3" />
              </div>
            )}
          </div>
        )}

        {/* Your score highlight */}
        {myRank >= 0 && (
          <div className="lb-my-score">
            <span className="lb-my-rank">#{myRank + 1}</span>
            <span className="lb-my-label">Your Score</span>
            <span className="lb-my-points">
              {leaderboard[myRank]?.score || score} pts <span className="text-sm font-normal opacity-80">({leaderboard[myRank]?.marksObtained || 0}/{totalMarks} marks)</span>
            </span>
          </div>
        )}

        {/* Student specific stats */}
        {myRank >= 0 && (
          <div className="flex items-center justify-center gap-6 mt-4 mb-6 bg-slate-900/50 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-lg mx-auto max-w-sm">
            <div className="flex flex-col items-center">
              <span className="text-2xl mb-1" title="Correct">✅</span>
              <span className="text-xs text-slate-200 font-bold">{leaderboard[myRank]?.correctAnswers || 0} Correct</span>
            </div>
            <div className="w-px h-10 bg-white/10"></div>
            <div className="flex flex-col items-center">
              <span className="text-2xl mb-1" title="Wrong">❌</span>
              <span className="text-xs text-slate-200 font-bold">{leaderboard[myRank]?.wrongAnswers || 0} Wrong</span>
            </div>
            <div className="w-px h-10 bg-white/10"></div>
            <div className="flex flex-col items-center">
              <span className="text-2xl mb-1" title="Skipped">⏭️</span>
              <span className="text-xs text-slate-200 font-bold">{leaderboard[myRank]?.skippedQuestions || 0} Skipped</span>
            </div>
          </div>
        )}

        {/* Full ranking list */}
        <div className="lb-list">
          {leaderboard.map((p, idx) => {
            const isYou = p.name === user?.name;
            return (
              <div key={`${p.name}-${idx}`} className={`lb-row ${isYou ? "lb-row-you" : ""} ${idx < 3 ? "lb-row-top" : ""}`}>
                <div className="lb-row-rank">
                  {idx < 3 ? rankEmojis[idx] : <span className="lb-row-rank-num">#{idx + 1}</span>}
                </div>
                <div className="lb-row-info">
                  <span className="lb-row-name">
                    {p.name}
                    {isYou && <span className="lb-row-you-tag">you</span>}
                  </span>
                </div>
                <span className="lb-row-score" style={{textAlign:"right"}}>
                  {p.score} pts<br/>
                  <span className="text-[10px] font-normal opacity-80">({p.marksObtained}/{totalMarks} marks)</span>
                </span>
              </div>
            );
          })}
        </div>

        {/* Action buttons */}
        <div className="lb-actions">
          <button className="lb-btn-lobby" onClick={() => { resetTheme(); navigate("/dashboard"); }}>
            🏠 Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  /* ── IN-PROGRESS VIEW ── */
  return (
    <div className="grid lg:grid-cols-[1.2fr,0.9fr] gap-5 relative">
      {cheatWarning && (
        <div className="absolute top-0 right-0 left-0 z-50 bg-rose-600/90 backdrop-blur-md text-white px-5 py-4 rounded-2xl shadow-[0_0_30px_rgba(225,29,72,0.4)] border border-rose-400 font-bold flex items-center justify-between mx-auto max-w-lg mb-4 animate-fade-down mt-2">
          <span>⚠️ {cheatWarning}</span>
          <button onClick={() => setCheatWarning("")} className="text-white opacity-80 hover:opacity-100 text-xl leading-none">✕</button>
        </div>
      )}
      <div className="glass-card p-5 space-y-4 relative overflow-hidden">
        <div className="flex items-center justify-between gap-3 relative z-10">
          <div>
            <div className="text-xs text-slate-300 font-medium mb-1 drop-shadow-md">{stageTitle}</div>
            <h1 className="text-xl font-bold text-white text-glow mb-1">
              {quizTitle || "Multiplayer quiz"}
            </h1>
            <div className="text-xs text-slate-300 font-medium drop-shadow-md">
              Room code:{" "}
              <span className="font-mono font-semibold text-slate-100">{joinCode}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isHost && (
              <button
                type="button"
                className="lb-end-quiz-btn"
                onClick={handleEndQuiz}
              >
                🛑 End Quiz
              </button>
            )}
            <div className="text-right">
              <div className="text-xs text-slate-300 font-medium drop-shadow-md">You</div>
              <div className="text-xs text-white font-semibold drop-shadow-md">{user?.name}</div>
              <div className="text-xs text-slate-300 font-medium mt-1 drop-shadow-md">Score</div>
              <div className="text-lg font-bold text-white text-glow">Hidden</div>
            </div>
          </div>
        </div>
        {question && (
          <>
            <div className="flex items-center justify-between gap-3 text-xs text-slate-200 font-medium drop-shadow-md">
              <span>
                Question {questionIndex + 1} of {totalQuestions}
              </span>
              <span className="font-mono px-2 py-1 rounded-lg bg-slate-950/50 border border-white/20 backdrop-blur-md shadow-lg text-white font-bold">
                {timeLeft}s
              </span>
            </div>
            <div className={`question-box p-4 relative z-10 ${accentClass}`}>
              <p className="text-sm text-slate-100 mb-3">{question.text}</p>
              <div className="space-y-2">
                {question.options.map((opt, idx) => {
                  const isSelected = selectedIndex === idx;
                  const isCorrectOption = answerResult && correctIndex === idx;
                  const isWrongSelected = isSelected && answerResult === "incorrect";
                  const isCorrectSelected = isSelected && answerResult === "correct";

                  let btnClass = "quiz-option";
                  if (isCorrectSelected) btnClass += " quiz-option-correct";
                  else if (isWrongSelected) btnClass += " quiz-option-incorrect";
                  else if (isCorrectOption && answerResult === "incorrect") btnClass += " quiz-option-reveal-correct";
                  else if (isSelected && !answerResult) btnClass += " quiz-option-selected";
                  else btnClass += " quiz-option-default";

                  if (answerLocked) btnClass += " quiz-option-locked";

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleOptionClick(idx)}
                      disabled={answerLocked}
                      className={btnClass}
                    >
                      <span className="quiz-option-letter">{String.fromCharCode(65 + idx)}</span>
                      <span>{opt}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2 text-[11px]">
                {powerReady && (
                  <button
                    type="button"
                    className="power-trigger-btn"
                    onClick={() => setShowPowerBar(!showPowerBar)}
                  >
                    <span className="power-trigger-glow" />
                    ⚡ Power Ready
                  </button>
                )}
                {attackMode && (
                  <span className="power-attack-hint">
                    ⚡ Select a target on the right →
                  </span>
                )}
              </div>
              {answerResult && (
                <div className={`quiz-feedback-badge ${answerResult === "correct" ? "quiz-feedback-correct" : answerResult === "submitted" ? "bg-blue-500/20 text-blue-300 border-blue-500/50" : "quiz-feedback-incorrect"}`}>
                  {answerResult === "correct" ? "✓ Correct!" : answerResult === "submitted" ? "Answer locked!" : "✗ Wrong"}
                </div>
              )}
            </div>
            {/* Inline power bar */}
            {showPowerBar && (
              <div className="power-bar">
                <button type="button" className="power-bar-btn power-bar-attack" onClick={() => handleSelectPower("attack")}>
                  <span className="power-bar-icon">⚡</span>
                  <span className="power-bar-label">Attack</span>
                </button>
                <button type="button" className="power-bar-btn power-bar-shield" onClick={() => handleSelectPower("shield")}>
                  <span className="power-bar-icon">🛡️</span>
                  <span className="power-bar-label">Shield</span>
                </button>
                <button type="button" className="power-bar-btn power-bar-double" onClick={() => handleSelectPower("double")}>
                  <span className="power-bar-icon">✨</span>
                  <span className="power-bar-label">2× Points</span>
                </button>
                <button type="button" className="power-bar-btn power-bar-close" onClick={() => setShowPowerBar(false)}>
                  <span className="power-bar-icon">✕</span>
                  <span className="power-bar-label">Cancel</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>
      {/* Right panel – players, leaderboard, taunts (during game) */}
      <div className="glass-card p-5 space-y-3 relative overflow-hidden">
        <div className="flex items-center justify-between relative z-10">
          <h2 className="text-base font-bold text-white text-glow">Crew in lobby</h2>
          <span className="text-xs text-slate-300 font-medium drop-shadow-md">
            {players.length} in lobby • {leaderboard.length} ranked
          </span>
        </div>
        <div className="space-y-2 text-xs relative z-10">
          {players.length === 0 && (
            <p className="text-slate-400">Waiting for players to join using this room code.</p>
          )}
          {players.map((p, idx) => {
            const hue = (idx * 47) % 360;
            const isYou = p.name === user?.name;
            return (
              <div
                key={p.id || `${p.name}-${idx}`}
                className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-950/40 backdrop-blur-sm border border-white/10"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="h-8 w-8 rounded-2xl border border-slate-800 flex items-center justify-center animate-float"
                    style={{
                      background: `conic-gradient(from 180deg, hsl(${hue},80%,60%), hsl(${(hue + 60) % 360},80%,55%), hsl(${(hue + 120) % 360},80%,60%))`
                    }}
                  >
                    <div className="h-5 w-3 rounded-lg bg-slate-950/90 flex flex-col items-center justify-center gap-0.5">
                      <span className="h-0.5 w-2 rounded-full bg-slate-300" />
                      <span className="h-0.5 w-2 rounded-full bg-slate-300" />
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-100 font-semibold drop-shadow-sm">
                      {p.name} {isYou && <span className="text-[10px] text-emerald-300 ml-1">(you)</span>}
                    </span>
                    <div className="text-[11px] text-slate-400 drop-shadow-sm font-medium italic">Score hidden</div>
                  </div>
                </div>
                {attackMode && p.name !== user?.name && (
                  <button
                    className="power-target-btn"
                    onClick={() => handleUseAttackOn(p.id, p.name)}
                  >
                    ⚡ Attack
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <div className="border-t border-white/20 pt-3 mt-2">
          <h3 className="text-sm font-bold text-white text-glow mb-2">Live leaderboard</h3>
          <div className="space-y-1.5 text-xs relative z-10">
            {leaderboard.length === 0 && (
              <p className="text-slate-300 font-medium drop-shadow-md">Scores will appear once players answer.</p>
            )}
            {leaderboard.map((p, idx) => (
              <div
                key={`${p.name}-${idx}`}
                className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-950/40 backdrop-blur-md border border-white/10 shadow-md hover:border-white/20 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <span className="w-5 text-sm font-extrabold text-slate-300 drop-shadow-md">#{idx + 1}</span>
                  <span className="text-base font-semibold text-slate-100 drop-shadow-md">{p.name}</span>
                </span>
                <span className="text-xs font-medium text-slate-400 italic">Score hidden</span>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-white/20 pt-3 mt-3 relative z-10">
          <h3 className="text-sm font-bold text-white text-glow mb-2">Taunts</h3>
          <div className="space-y-1.5 text-[11px] max-h-32 overflow-y-auto pr-1 custom-scrollbar">
            {taunts.map((t, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-950/40 backdrop-blur-md border border-white/10 shadow-sm"
              >
                <span className="text-lg leading-none drop-shadow-md">{t.emoji}</span>
                <span className="text-slate-200 text-xs font-medium drop-shadow-sm">
                  <span className="font-bold text-white">{t.from}</span>
                  {t.message && `: ${t.message}`}
                </span>
              </div>
            ))}
            {taunts.length === 0 && (
              <p className="text-slate-300 font-medium drop-shadow-md">Send a quick taunt to the room.</p>
            )}
          </div>
          <form 
            className="flex items-center gap-2 mt-2"
            onSubmit={(e) => {
              e.preventDefault();
              handleSendTaunt("", tauntInput);
            }}
          >
            <div className="flex gap-1">
              {["😎", "🚀", "🔥", "😂"].map((e) => (
                <button
                  key={e}
                  type="button"
                  className="h-7 w-7 rounded-full bg-slate-950/50 backdrop-blur-sm border border-white/10 flex items-center justify-center text-base hover:border-white/30 transition-colors"
                  onClick={() => handleSendTaunt(e, "")}
                >
                  {e}
                </button>
              ))}
            </div>
            <input
              type="text"
              maxLength={40}
              value={tauntInput}
              onChange={(e) => setTauntInput(e.target.value)}
              placeholder="Short taunt (e.g. Ready to lose?)"
              className="flex-1 rounded-lg bg-slate-950/50 backdrop-blur-sm border border-white/10 px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary/70 placeholder-slate-400"
            />
            <button
              type="submit"
              className="px-2 py-1 rounded-lg bg-primary/80 text-[11px] text-white hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!tauntInput.trim()}
            >
              Send
            </button>
          </form>
        </div>
        {/* Power toast notification */}
        {powerToast && (
          <div className="power-toast-container">
            <div className={`power-toast power-toast-${powerToast.type}`}>
              {powerToast.msg}
            </div>
          </div>
        )}
        {/* Power event from other players */}
        {powerEvent && (
          <div className="power-event-banner">
            <div className={`power-event-card power-event-${powerEvent.type}`}>
              {powerEvent.type === "attack" && (
                <span>⚡ <strong>{powerEvent.from}</strong> attacked <strong>{powerEvent.to}</strong> (−500 pts)</span>
              )}
              {powerEvent.type === "shield_block" && (
                <span>🛡️ <strong>{powerEvent.to}</strong>&apos;s shield blocked <strong>{powerEvent.from}</strong>&apos;s attack!</span>
              )}
            </div>
          </div>
        )}
        {/* Power animation overlay */}
        {powerAnim && <div className={`power-anim-overlay power-anim-${powerAnim}`} />}
      </div>
      
      {/* Cheat Alerts for Teacher */}
      {isHost && cheatAlerts.length > 0 && (
        <div className="fixed bottom-6 left-6 z-50 flex flex-col gap-3 pointer-events-none">
          {cheatAlerts.map((alert, idx) => (
            <div key={idx} className="bg-rose-600/95 text-white backdrop-blur-xl px-5 py-3.5 rounded-2xl shadow-[0_10px_40px_rgba(225,29,72,0.4)] border border-rose-400 font-medium animate-fade-up pointer-events-auto flex items-center gap-3">
              <span className="text-2xl">🚨</span>
              <span>
                <strong>{alert.playerName}</strong> {alert.cheatCount >= 2 ? "has been kicked for cheating." : "is acting unfairly (tab changed/minimized)."}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
