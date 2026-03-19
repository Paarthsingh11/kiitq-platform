import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../state/AuthContext.jsx";
import { useTheme } from "../state/ThemeContext.jsx";

export default function StudentDashboard() {
  const { user, api, updateProfile } = useAuth();
  const { resetTheme } = useTheme();
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState("");

  const [isEditing, setIsEditing] = useState(false);
  const [profileData, setProfileData] = useState({
    name: user?.name || "",
    rollNumber: user?.rollNumber || "",
    section: user?.section || "",
    branch: user?.branch || ""
  });
  const [isSaving, setIsSaving] = useState(false);

  // Reset theme to default when entering dashboard
  useEffect(() => { resetTheme(); }, []);

  const handleJoinLobby = () => {
    if (!joinCode || joinCode.length !== 6) return;
    navigate("/multiplayer/lobby", { state: { joinCode } });
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!profileData.name.trim()) return;
    setIsSaving(true);
    try {
      const res = await api.put("/auth/profile", profileData);
      updateProfile(res.data);
      setIsEditing(false);
    } catch (err) {
      console.error(err);
      alert("Failed to update profile.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="animate-fade-up">
        <h1 className="text-2xl font-semibold text-slate-50">Student hub</h1>
        <p className="text-sm text-slate-400">
          Welcome, <span className="text-emerald-400 font-medium">{user?.name}</span>. Join live battles instantly or update your profile.
        </p>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="glass-card p-4 space-y-3 animate-fade-up-delayed">
          <h2 className="text-sm font-semibold text-slate-200">Join multiplayer quiz</h2>
          <p className="text-xs text-slate-400">
            Enter the 6-digit code your teacher shared to join a synchronized quiz battle.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              maxLength={6}
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleJoinLobby();
                }
              }}
              className="flex-1 rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-50 tracking-[0.3em] font-mono text-center focus:outline-none focus:ring-2 focus:ring-primary/70"
              placeholder="000000"
            />
            <button
              className="btn-primary text-xs"
              onClick={handleJoinLobby}
              disabled={joinCode.length !== 6}
            >
              Join
            </button>
          </div>
        </div>
        <div className="glass-card p-4 space-y-3">
          <h2 className="text-sm font-semibold text-slate-200">Your Profile</h2>
          {!isEditing ? (
            <div className="space-y-2 text-xs">
              <div className="flex justify-between border-b border-slate-800 pb-1">
                <span className="text-slate-400">Name</span>
                <span className="text-slate-200 font-medium">{user?.name}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1">
                <span className="text-slate-400">Roll Number</span>
                <span className="text-slate-200 font-medium">{user?.rollNumber || "Not set"}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1">
                <span className="text-slate-400">Section</span>
                <span className="text-slate-200 font-medium">{user?.section || "Not set"}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1">
                <span className="text-slate-400">Branch</span>
                <span className="text-slate-200 font-medium">{user?.branch || "Not set"}</span>
              </div>
              <button
                type="button"
                className="w-full btn-secondary text-xs mt-2"
                onClick={() => setIsEditing(true)}
              >
                ✏️ Edit Profile
              </button>
            </div>
          ) : (
            <form onSubmit={handleUpdateProfile} className="space-y-2 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Name</label>
                <input
                  required
                  type="text"
                  value={profileData.name}
                  onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-1.5 text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Roll Number</label>
                <input
                  type="text"
                  value={profileData.rollNumber}
                  onChange={(e) => setProfileData({ ...profileData, rollNumber: e.target.value })}
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-1.5 text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="e.g. 21051123"
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-slate-400 mb-1">Section</label>
                  <input
                    type="text"
                    value={profileData.section}
                    onChange={(e) => setProfileData({ ...profileData, section: e.target.value })}
                    className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-1.5 text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="e.g. CSE-13"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-slate-400 mb-1">Branch</label>
                  <input
                    type="text"
                    value={profileData.branch}
                    onChange={(e) => setProfileData({ ...profileData, branch: e.target.value })}
                    className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-1.5 text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="e.g. CSE"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  className="flex-1 btn-secondary"
                  onClick={() => setIsEditing(false)}
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 btn-primary"
                  disabled={isSaving}
                >
                  {isSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

