import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../state/AuthContext.jsx";
import { auth, googleProvider, facebookProvider, appleProvider, microsoftProvider } from "../firebase.js";
import { signInWithPopup } from "firebase/auth";

export default function SignupPage() {
  const { api, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const queryParams = new URLSearchParams(location.search);
  const initialRole = queryParams.get("role") === "student" ? "student" : "teacher";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(initialRole);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [showEmailForm, setShowEmailForm] = useState(false);
  const [pendingIdToken, setPendingIdToken] = useState(null);

  // We remove getRedirectResult entirely from useEffect,
  // since signInWithPopup returns the result synchronously inline
  // and completely bypasses TrustedHTML document overwrite blocks.
  useEffect(() => {
    // This useEffect is now empty as the redirect result handling is moved to handleSocialAuth
  }, []); // Empty dependency array as it no longer depends on api, login, navigate

  const finalizeSocialSignup = async (selectedRole) => {
    if (!pendingIdToken) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/auth/social", { idToken: pendingIdToken, role: selectedRole });
      login(res.data);
      if (res.data.user.role === "teacher") {
        navigate("/teacher");
      } else {
        navigate("/student");
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || err.message || "Finalizing secure signup failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSocialAuth = async (provider) => {
    setError("");
    setLoading(true);
    try {
      // Use Popup instead of Redirect to bypass CORS/TrustedTypes reload wiping out memory context
      const result = await signInWithPopup(auth, provider); // Changed to signInWithPopup
      if (result) {
        const idToken = await result.user.getIdToken();
        try {
          const res = await api.post("/auth/social", { idToken });
          login(res.data);
          if (res.data.user.role === "teacher") {
            navigate("/teacher");
          } else {
            navigate("/student");
          }
        } catch (err) {
          if (err.response?.data?.requiresRole) {
            setPendingIdToken(idToken);
          } else {
            throw err;
          }
        }
      }
    } catch (err) {
      setError(err.message || "Could not authenticate with provider.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/auth/signup", { name, email, password, role });
      login(res.data);
      if (res.data.user.role === "teacher") {
        navigate("/teacher");
      } else {
        navigate("/student");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 md:p-8 bg-white rounded-3xl shadow-xl border border-slate-100 mt-10">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">Create a free account</h1>
        <p className="text-sm text-slate-600">
          Already have an account?{" "}
          <Link to="/login" className="text-emerald-600 font-semibold hover:underline">
            Log in
          </Link>
        </p>
      </div>

      {error && (
        <div className="mb-6 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-center">
          {error}
        </div>
      )}

      {pendingIdToken ? (
        <div className="space-y-4 animate-fade-up">
          <p className="text-sm text-slate-600 mb-6 text-center">
            Looks like you are new here! Are you a Teacher or a Student?
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => finalizeSocialSignup("teacher")}
              className="flex-1 py-4 border border-slate-200 rounded-2xl bg-white hover:bg-slate-50 transition-all group"
            >
              <span className="block text-xl mb-1">👨‍🏫</span>
              <span className="font-semibold text-slate-800 text-sm">Teacher</span>
            </button>
            <button
              type="button"
              onClick={() => finalizeSocialSignup("student")}
              className="flex-1 py-4 border border-slate-200 rounded-2xl bg-white hover:bg-slate-50 transition-all group"
            >
              <span className="block text-xl mb-1">🎓</span>
              <span className="font-semibold text-slate-800 text-sm">Student</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Social Signup Buttons */}
          <div className="space-y-3 mb-6">
        <button type="button" onClick={() => handleSocialAuth(googleProvider)} className="w-full flex items-center justify-between px-5 py-3.5 border border-slate-200 rounded-2xl bg-white hover:bg-slate-50 transition-colors group">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            <span className="font-semibold text-slate-800 text-sm">Continue with Google</span>
          </div>
          <svg className="w-5 h-5 text-slate-400 group-hover:text-slate-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      </div>

      <div className="relative flex items-center mb-6">
        <div className="flex-grow border-t border-slate-100"></div>
        <span className="flex-shrink-0 mx-4 text-slate-400 text-[10px] sm:text-xs uppercase tracking-wider">or sign up with email</span>
        <div className="flex-grow border-t border-slate-100"></div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Full Name</label>
          <input
            type="text"
            className="w-full rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all placeholder-slate-400"
            placeholder="John Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email Address</label>
          <input
            type="email"
            className="w-full rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all placeholder-slate-400"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Account Type</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setRole("teacher")}
              className={`flex-1 px-4 py-3 rounded-xl border font-semibold text-sm transition-all shadow-sm ${
                role === "teacher"
                  ? "bg-emerald-50 border-emerald-500 text-emerald-700"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              Teacher
            </button>
            <button
              type="button"
              onClick={() => setRole("student")}
              className={`flex-1 px-4 py-3 rounded-xl border font-semibold text-sm transition-all shadow-sm ${
                role === "student"
                  ? "bg-emerald-50 border-emerald-500 text-emerald-700"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              Student
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
          <input
            type="password"
            className="w-full rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all placeholder-slate-400"
            placeholder="Min. 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        
        <button 
          type="submit" 
          className="w-full py-3.5 mt-4 bg-slate-900 text-white rounded-xl font-semibold text-sm shadow-md hover:bg-slate-800 transition-colors focus:ring-4 focus:ring-slate-900/20 active:scale-[0.98]" 
          disabled={loading}
        >
          {loading ? "Creating account..." : "Complete Sign Up"}
        </button>
      </form>
      </>
      )}

      <div className="mt-8 text-center px-4">
        <p className="text-[11px] text-slate-500 leading-relaxed">
          By signing up, you agree to our <a href="#" className="text-emerald-600 hover:underline">Terms of Service</a> and{" "}
          <a href="#" className="text-emerald-600 hover:underline">Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
}

