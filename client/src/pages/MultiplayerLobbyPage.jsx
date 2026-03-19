import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../state/AuthContext.jsx";

export default function MultiplayerLobbyPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { api, user } = useAuth();
  const [joinCode, setJoinCode] = useState(location.state?.joinCode || "");
  const [status, setStatus] = useState("");
  const [quizInfo, setQuizInfo] = useState(null);
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!joinCode || joinCode.length !== 6) return;
    let active = true;
    const load = async () => {
      try {
        const res = await api.get(`/multiplayer/session/${joinCode}`);
        if (!active) return;
        setQuizInfo(res.data.quiz);
        setStatus(res.data.status);
      } catch {
        // ignore, lobby might not exist yet
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [api, joinCode]);

  const handleJoin = async () => {
    if (!joinCode || joinCode.length !== 6 || joining) return;
    setError("");
    setJoining(true);
    try {
      const res = await api.post("/multiplayer/join", { joinCode });
      setQuizInfo(res.data.quiz);
      navigate(`/multiplayer/battle/${joinCode}`, {
        state: { joinCode, quizTitle: res.data.quiz.title }
      });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to join room");
    } finally {
      setJoining(false);
    }
  };

  const handleCopy = () => {
    if (!joinCode) return;
    navigator.clipboard.writeText(joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-md mx-auto glass-card p-5 space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-50">Multiplayer lobby</h1>
        <p className="text-xs text-slate-400">
          Join the same room code as your teacher and classmates.
        </p>
      </div>
      {error && (
        <div className="text-xs text-rose-300 bg-rose-950/50 border border-rose-800/70 rounded-xl px-3 py-2">
          {error}
        </div>
      )}
      <div className="space-y-4">
        <div className="space-y-3">
          <div>
            <label className="flex items-center justify-between text-xs text-slate-300 mb-1.5">
              <span>Room code</span>
              {copied && <span className="text-[10px] text-emerald-400 font-medium">Copied!</span>}
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                maxLength={6}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleJoin();
                  }
                }}
                className="w-full rounded-xl bg-slate-900 border border-slate-700 pl-10 pr-10 py-2 text-sm text-slate-50 tracking-[0.35em] font-mono text-center focus:outline-none focus:ring-2 focus:ring-primary/70"
                placeholder="000000"
              />
              <button
                type="button"
                className="absolute right-3 text-slate-400 hover:text-slate-200 transition-colors"
                onClick={handleCopy}
                title="Copy code"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
            </div>
          </div>
          {quizInfo && (
            <div className="rounded-xl bg-slate-900/90 border border-slate-700/80 p-3 text-xs">
              <div className="text-slate-300 mb-1">Quiz</div>
              <div className="font-semibold text-slate-50">{quizInfo.title}</div>
              <div className="text-slate-400">
                {quizInfo.questionCount} questions • status: {status}
              </div>
            </div>
          )}
        </div>
        <button
          className="btn-primary w-full text-xs"
          onClick={handleJoin}
          disabled={!joinCode || joinCode.length !== 6 || joining}
        >
          {joining ? "Joining..." : user?.role === "teacher" ? "Enter as host" : "Join room"}
        </button>
      </div>
    </div>
  );
}

