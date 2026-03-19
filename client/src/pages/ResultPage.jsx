import React from "react";
import { useLocation, useNavigate } from "react-router-dom";

export default function ResultPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state || {};

  if (!state.mode) {
    return (
      <div className="max-w-md mx-auto glass-card p-5 text-sm text-slate-300">
        No results to show yet.
      </div>
    );
  }

  const { mode } = state;

  return (
    <div className="max-w-lg mx-auto glass-card p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-50 mb-1">
          {mode === "single" ? "Single-player results" : "Multiplayer battle results"}
        </h1>
        <p className="text-sm text-slate-400">
          {mode === "single"
            ? "Here is how you performed in this quiz."
            : `Final leaderboard for room ${state.joinCode}.`}
        </p>
      </div>
      {mode === "single" && (
        <div className="rounded-xl bg-slate-900/90 border border-slate-700/80 p-4 text-sm text-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <span>Total score</span>
            <span className="font-semibold text-slate-50">{state.score} pts</span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Maximum possible</span>
            <span>{state.total} pts</span>
          </div>
        </div>
      )}
      {mode === "multiplayer" && (
        <div className="space-y-4">
          <div className="rounded-xl bg-gradient-to-r from-slate-900/90 via-slate-900/95 to-slate-900/90 border border-slate-700/80 p-4 text-xs text-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span>Your score</span>
              <span className="font-semibold text-slate-50">{state.yourScore} pts</span>
            </div>
            <div className="text-[11px] text-slate-400">
              Final standings for this battle are shown below.
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-xs">
            {(state.leaderboard || [])
              .slice(0, 3)
              .map((p, idx) => {
                const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉";
                const glow =
                  idx === 0
                    ? "from-amber-400/30"
                    : idx === 1
                    ? "from-slate-200/25"
                    : "from-amber-700/25";
                return (
                  <div
                    key={`${p.name}-${idx}`}
                    className={`rounded-2xl border border-slate-700/80 bg-gradient-to-t ${glow} to-slate-900/95 px-3 py-3 flex flex-col items-center justify-center`}
                  >
                    <div className="text-lg mb-1">{medal}</div>
                    <div className="text-[11px] text-slate-300 mb-1">#{idx + 1}</div>
                    <div className="text-xs font-semibold text-slate-50 text-center truncate max-w-[8rem]">
                      {p.name}
                    </div>
                    <div className="text-[11px] text-slate-300 mt-1">{p.score} pts</div>
                  </div>
                );
              })}
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-300 mb-2">
              Full leaderboard
            </div>
            <div className="space-y-1 text-xs">
              {(state.leaderboard || []).map((p, idx) => (
                <div
                  key={`${p.name}-full-${idx}`}
                  className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-700/70"
                >
                  <span className="flex items-center gap-2">
                    <span className="w-5 text-[11px] text-slate-500">#{idx + 1}</span>
                    <span className="text-slate-200">{p.name}</span>
                  </span>
                  <span className="text-slate-50 font-semibold">{p.score} pts</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <div className="flex justify-end gap-2 text-xs">
        <button
          className="btn-secondary"
          onClick={() => navigate("/")}
        >
          Back to landing
        </button>
      </div>
    </div>
  );
}

