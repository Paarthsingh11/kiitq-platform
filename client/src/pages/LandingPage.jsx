import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../state/AuthContext.jsx";

export default function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="grid lg:grid-cols-[1.3fr,1fr] gap-10 items-center">
      <section className="space-y-4 animate-fade-up">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/40 text-primary text-xs font-semibold mb-4 shadow-sm shadow-primary/40">
          <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          Real-time quiz battles
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-slate-50 mb-4">
          Turn any quiz into
          <span className="text-primary"> live competition.</span>
        </h1>
        <p className="text-slate-300 max-w-xl mb-8">
          Create quizzes in seconds, play solo to practice, or launch multiplayer battles where every
          question is synchronized and scores update in real time.
        </p>
        <div className="flex flex-wrap gap-3 mb-10">
          {user ? (
            <>
              {user.role === "teacher" ? (
                <Link to="/teacher" className="btn-primary">
                  Go to Teacher Dashboard
                </Link>
              ) : (
                <Link to="/student" className="btn-primary">
                  Go to Student Dashboard
                </Link>
              )}
            </>
          ) : (
            <>
              <Link to="/signup?role=teacher" className="btn-primary">
                Sign up as Teacher
              </Link>
              <Link to="/signup?role=student" className="btn-primary">
                Sign up as Student
              </Link>
              <Link to="/login" className="btn-secondary w-full sm:w-auto">
                I already have an account
              </Link>
            </>
          )}
        </div>
        <div className="grid grid-cols-3 gap-4 max-w-md text-xs text-slate-300">
          <div className="glass-card p-3 hover:-translate-y-1 hover:shadow-primary/30 hover:shadow-xl transition-transform">
            <div className="text-slate-400 mb-1">Modes</div>
            <div className="font-semibold text-slate-50">Single & Multiplayer</div>
          </div>
          <div className="glass-card p-3 hover:-translate-y-1 hover:shadow-primary/30 hover:shadow-xl transition-transform">
            <div className="text-slate-400 mb-1">Multiplayer</div>
            <div className="font-semibold text-slate-50">6-digit room codes</div>
          </div>
          <div className="glass-card p-3 hover:-translate-y-1 hover:shadow-primary/30 hover:shadow-xl transition-transform">
            <div className="text-slate-400 mb-1">Creation</div>
            <div className="font-semibold text-slate-50">Upload & extract</div>
          </div>
        </div>
      </section>
      <section className="hidden lg:block animate-scale-in">
        <div className="glass-card p-6 h-full flex flex-col gap-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-slate-200">Multiplayer Battle</span>
            <span className="text-xs text-slate-400">Live preview</span>
          </div>
          <div className="flex-1 grid grid-rows-[auto,1fr] gap-4">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>Players</span>
              <span>Score</span>
            </div>
            <div className="space-y-2">
              {["You", "Player 2", "Player 3"].map((name, idx) => (
                <div
                  key={name}
                  className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-700/70"
                >
                  <span className="text-xs text-slate-200">{name}</span>
                  <span className="text-xs font-semibold text-slate-100">
                    {300 - idx * 40} pts
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 text-xs text-slate-400">
            This demo focuses solely on quizzes: single-player practice and synchronized
            multiplayer battles. No extra libraries, classes, or marketplaces.
          </div>
        </div>
      </section>
    </div>
  );
}

