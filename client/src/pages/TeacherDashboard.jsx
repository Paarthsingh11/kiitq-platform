import React, { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../state/AuthContext.jsx";
import { useTheme } from "../state/ThemeContext.jsx";

export default function TeacherDashboard() {
  const { api, user } = useAuth();
  const { resetTheme } = useTheme();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creatingRoomId, setCreatingRoomId] = useState(null);
  const [createdJoinCode, setCreatedJoinCode] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [downloadMenuId, setDownloadMenuId] = useState(null);
  const downloadRef = useRef(null);
  const navigate = useNavigate();

  // Reset theme to default when entering dashboard
  useEffect(() => { resetTheme(); }, []);

  // Close download menu on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (downloadRef.current && !downloadRef.current.contains(e.target)) {
        setDownloadMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await api.get("/quizzes/mine");
        if (active) setQuizzes(res.data);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load quizzes");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [api]);

  const handleCreateRoom = async (quizId) => {
    setError("");
    setCreatingRoomId(quizId);
    setCreatedJoinCode("");
    try {
      const res = await api.post("/multiplayer/create-room", { quizId });
      setCreatedJoinCode(res.data.joinCode);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create room");
    } finally {
      setCreatingRoomId(null);
    }
  };

  const triggerDownload = async (url, fallbackFilename) => {
    try {
      const res = await api.get(url, { responseType: "blob" });
      const blob = new Blob([res.data], { type: res.headers["content-type"] });
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      const disposition = res.headers["content-disposition"];
      const match = disposition && disposition.match(/filename="?(.+?)"?$/);
      link.download = match ? match[1] : fallbackFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch {
      setError("Failed to download results");
    }
  };

  const handleDownloadCSV = (quizId) => {
    setDownloadMenuId(null);
    triggerDownload(`/quizzes/${quizId}/results/download`, "results.csv");
  };

  const handleDownloadPDF = (quizId) => {
    setDownloadMenuId(null);
    triggerDownload(`/quizzes/${quizId}/results/download-pdf`, "results.pdf");
  };

  const handleDeleteQuiz = async (quizId) => {
    setDeletingId(quizId);
    try {
      await api.delete(`/quizzes/${quizId}`);
      setQuizzes((prev) => prev.filter((q) => q._id !== quizId));
      setConfirmDeleteId(null);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete quiz");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 animate-fade-up">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50">Teacher workspace</h1>
          <p className="text-sm text-slate-400">
            Welcome back, {user?.name}. Create quizzes, extract questions, and host live battles.
          </p>
        </div>
        <Link to="/teacher/quizzes/new" className="btn-primary">
          New quiz
        </Link>
      </div>
      {error && (
        <div className="text-sm text-rose-300 bg-rose-950/50 border border-rose-800/70 rounded-xl px-3 py-2">
          {error}
        </div>
      )}
      <div className="glass-card p-4 animate-fade-up-delayed">
        <h2 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-primary/15 text-primary text-xs">
            Q
          </span>
          <span>Your quizzes</span>
        </h2>
        {loading ? (
          <p className="text-xs text-slate-400">Loading...</p>
        ) : quizzes.length === 0 ? (
          <p className="text-xs text-slate-400">
            You haven&apos;t created any quizzes yet. Start by creating one.
          </p>
        ) : (
          <div className="space-y-3">
            {quizzes.map((quiz) => (
              <div key={quiz._id} className="td-quiz-card">
                {/* Quiz info */}
                <div className="td-quiz-info">
                  <div className="text-sm font-medium text-slate-100">{quiz.title}</div>
                  <div className="text-xs text-slate-400">
                    {quiz.questions?.length || 0} questions
                    {quiz.hasResults && (
                      <span className="td-results-ready-badge">● Results ready</span>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="td-quiz-actions">
                  {/* Download Results — only visible after quiz completion */}
                  {quiz.hasResults && (
                    <div className="td-download-wrapper" ref={downloadMenuId === quiz._id ? downloadRef : null}>
                      <button
                        className="td-btn td-btn-download"
                        onClick={() => setDownloadMenuId(downloadMenuId === quiz._id ? null : quiz._id)}
                        title="Download results"
                      >
                        📥 Results ▾
                      </button>
                      {downloadMenuId === quiz._id && (
                        <div className="td-download-menu">
                          <button className="td-download-option" onClick={() => handleDownloadCSV(quiz._id)}>
                            <span className="td-dl-icon">📄</span>
                            <span>
                              <strong>CSV File</strong>
                              <small>Spreadsheet format</small>
                            </span>
                          </button>
                          <button className="td-download-option" onClick={() => handleDownloadPDF(quiz._id)}>
                            <span className="td-dl-icon">📑</span>
                            <span>
                              <strong>PDF Report</strong>
                              <small>Formatted document</small>
                            </span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    className="btn-secondary text-xs"
                    onClick={() => navigate(`/quiz/${quiz._id}`)}
                  >
                    Preview single player
                  </button>
                  <button
                    className="btn-primary text-xs"
                    onClick={() => handleCreateRoom(quiz._id)}
                    disabled={creatingRoomId === quiz._id}
                  >
                    {creatingRoomId === quiz._id ? "Creating..." : "Start multiplayer"}
                  </button>

                  {/* Delete button */}
                  {confirmDeleteId === quiz._id ? (
                    <div className="td-delete-confirm">
                      <span className="text-xs text-rose-300">Delete?</span>
                      <button
                        className="td-btn td-btn-delete-yes"
                        onClick={() => handleDeleteQuiz(quiz._id)}
                        disabled={deletingId === quiz._id}
                      >
                        {deletingId === quiz._id ? "..." : "Yes"}
                      </button>
                      <button
                        className="td-btn td-btn-delete-no"
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      className="td-btn td-btn-delete"
                      onClick={() => setConfirmDeleteId(quiz._id)}
                      title="Delete quiz"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {createdJoinCode && (
          <div className="mt-4 text-xs text-emerald-300 bg-emerald-950/40 border border-emerald-700/60 rounded-xl px-3 py-2 flex items-center justify-between gap-3">
            <span>
              Room created. Share this 6-digit code with students:{" "}
              <span className="font-mono font-semibold text-emerald-200">{createdJoinCode}</span>
            </span>
            <button
              className="btn-secondary text-[10px] px-2 py-1"
              onClick={() =>
                navigate("/multiplayer/lobby", {
                  state: { joinCode: createdJoinCode }
                })
              }
            >
              Open lobby
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
