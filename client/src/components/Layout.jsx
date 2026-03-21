import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../state/AuthContext.jsx";
import { useTheme } from "../state/ThemeContext.jsx";

export function AppLayout({ children }) {
  const { user, logout } = useAuth();
  const { activeTheme } = useTheme();
  const location = useLocation();

  const isLanding = location.pathname === "/";

  const backgroundStyle = activeTheme
    ? {
        backgroundImage: `linear-gradient(to bottom, rgba(15, 23, 42, 0.15) 0%, rgba(15, 23, 42, 0.0) 50%, rgba(15, 23, 42, 0.3) 100%), url(${activeTheme.image})`,
        backgroundSize: activeTheme.bgSize || "100% 100%",
        backgroundPosition: activeTheme.bgPosition || "center",
        backgroundRepeat: "no-repeat"
      }
    : {};

  return (
    <div
      className={activeTheme ? "min-h-screen flex flex-col text-slate-50 relative" : "min-h-screen flex flex-col bg-slate-950"}
      style={
        activeTheme
          ? {
              ...backgroundStyle,
            }
          : { background: "radial-gradient(circle at top, #059669 0%, #020617 55%, #000 100%)" }
      }
    >
      <header className="border-b border-slate-800/80 bg-slate-950/60 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-primary to-emerald-400 p-[1.5px] shadow-lg shadow-primary/30 group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
            </div>
            <span className="font-semibold tracking-tight text-slate-50 group-hover:text-primary transition-colors text-xl">
              KIITQ
            </span>
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            {!isLanding && (
              <Link
                to="/"
                className="px-3 py-1.5 rounded-full border border-slate-700/80 text-slate-300 hover:bg-slate-800/70 transition-colors"
              >
                Landing
              </Link>
            )}
            {user ? (
              <>
                {user.role === "teacher" ? (
                  <Link
                    to="/teacher"
                    className="px-3 py-1.5 rounded-full border border-slate-700/80 text-slate-300 hover:bg-slate-800/70 transition-colors"
                  >
                    Teacher Dashboard
                  </Link>
                ) : (
                  <Link
                    to="/student"
                    className="px-3 py-1.5 rounded-full border border-slate-700/80 text-slate-300 hover:bg-slate-800/70 transition-colors"
                  >
                    Student Dashboard
                  </Link>
                )}
                <button
                  onClick={logout}
                  className="px-3 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium transition-colors"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-3 py-1.5 rounded-full border border-slate-700/80 text-slate-300 hover:bg-slate-800/70 transition-colors"
                >
                  Login
                </Link>
                <Link
                  to="/signup"
                  className="px-3 py-1.5 rounded-full bg-primary hover:bg-primary-dark text-white font-medium transition-colors"
                >
                  Sign Up
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1 relative">
        <div className="max-w-6xl mx-auto px-4 py-8 page-enter page-enter-active relative z-10">
          {children}
        </div>
      </main>
    </div>
  );
}
