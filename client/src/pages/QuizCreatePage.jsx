import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../state/AuthContext.jsx";

export default function QuizCreatePage() {
  const { api, user } = useAuth();
  const navigate = useNavigate();

  /* ── Mode: null | "manual" | "upload" ── */
  const [mode, setMode] = useState(null);

  /* ── Manual quiz state ── */
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState([
    { text: "", options: ["", "", "", ""], correctIndex: -1, timeLimitSeconds: 30, points: 100, marks: 1 },
  ]);
  const [saving, setSaving] = useState(false);

  /* ── Upload state ── */
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [difficulty, setDifficulty] = useState("medium");
  const fileRef = useRef(null);

  const [error, setError] = useState("");

  /* ── Question helpers ── */
  const handleQuestionChange = (index, field, value) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, [field]: value } : q))
    );
  };

  const handleOptionChange = (qIndex, optIndex, value) => {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIndex
          ? { ...q, options: q.options.map((o, j) => (j === optIndex ? value : o)) }
          : q
      )
    );
  };

  const addQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      { text: "", options: ["", "", "", ""], correctIndex: -1, timeLimitSeconds: 30, points: 100, marks: 1 },
    ]);
  };

  const removeQuestion = (index) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  /* ── Save manual quiz ── */
  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    const cleaned = questions.filter(
      (q) => q.text.trim() && q.options.some((o) => o.trim())
    );
    // Validate: every question must have a correct answer selected
    const missing = cleaned.findIndex((q) => q.correctIndex < 0 || q.correctIndex > 3);
    if (missing !== -1) {
      setError(`Please select the correct answer for Question ${missing + 1}.`);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title,
        description,
        questions: cleaned.map((q) => ({
          ...q,
          correctIndex: Number(q.correctIndex),
          timeLimitSeconds: Number(q.timeLimitSeconds) || 30,
          points: Number(q.points) || 100,
          marks: Number(q.marks) || 1,
        })),
      };
      await api.post("/quizzes", payload);
      navigate("/teacher");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save quiz");
    } finally {
      setSaving(false);
    }
  };

  /* ── Upload + extract ── */
  const handleFilePick = (selectedFile) => {
    setFile(selectedFile);
    setError("");
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) handleFilePick(dropped);
  };

  const handleExtract = async () => {
    if (!file) return;
    setError("");
    setExtracting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("difficulty", difficulty);
      const res = await api.post("/quizzes/extract", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const extracted = res.data.questions || [];
      if (extracted.length === 0) {
        setError("No questions could be extracted from this file.");
        return;
      }
      navigate("/teacher/quizzes/review", {
        state: {
          questions: extracted,
          fileName: file.name,
          method: res.data.method,
          count: res.data.count,
        },
      });
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to extract questions";
      const suggestion = err.response?.data?.suggestion || "";
      setError(suggestion ? `${msg} ${suggestion}` : msg);
    } finally {
      setExtracting(false);
    }
  };

  /* ── GREETING ── */
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <div className="qc-page">
      {/* ── Header ── */}
      <div className="qc-hero">
        <h1 className="qc-greeting">
          {greeting}, {user?.name} 👋 <span className="qc-greeting-sub">Let's create a quiz.</span>
        </h1>
      </div>

      {/* ── Mode selector cards ── */}
      <div className="qc-mode-row">
        <button
          type="button"
          className={`qc-mode-card ${mode === "manual" ? "qc-mode-active" : ""}`}
          onClick={() => { setMode("manual"); setError(""); }}
        >
          <span className="qc-mode-icon">✏️</span>
          <span className="qc-mode-label">Create</span>
          <span className="qc-mode-sub">quiz manually</span>
        </button>

        <button
          type="button"
          className={`qc-mode-card ${mode === "upload" ? "qc-mode-active" : ""}`}
          onClick={() => { setMode("upload"); setError(""); }}
        >
          <span className="qc-mode-icon qc-mode-icon-upload">📤</span>
          <span className="qc-mode-label">Upload</span>
          <span className="qc-mode-sub">& extract with AI</span>
        </button>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div className="qc-error-banner">{error}</div>
      )}

      {/* ── Content area ── */}
      <div className="qc-content-area">
        {/* ── No mode selected ── */}
        {!mode && (
          <div className="qc-empty-state">
            <div className="qc-empty-icon">📋</div>
            <h2 className="qc-empty-title">Choose a method above</h2>
            <p className="qc-empty-desc">Create questions manually or upload a document for AI extraction.</p>
          </div>
        )}

        {/* ── MANUAL MODE ── */}
        {mode === "manual" && (
          <form onSubmit={handleSave} className="qc-manual-form">
            {/* Title & Description */}
            <div className="qc-form-card">
              <h2 className="qc-form-card-title">
                <span className="qc-form-icon">📝</span> Quiz details
              </h2>
              <div className="qc-field">
                <label className="qc-label">Title</label>
                <input
                  type="text"
                  className="qc-input"
                  placeholder="e.g. History Final Review"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>
              <div className="qc-field">
                <label className="qc-label">Description (optional)</label>
                <textarea
                  rows={2}
                  className="qc-input qc-textarea"
                  placeholder="Brief description of this quiz..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>

            {/* Questions */}
            <div className="qc-form-card">
              <div className="qc-form-card-header">
                <h2 className="qc-form-card-title">
                  <span className="qc-form-icon">❓</span> Questions ({questions.length})
                </h2>
                <button type="button" className="qc-add-btn" onClick={addQuestion}>
                  + Add question
                </button>
              </div>
              <div className="qc-questions-list">
                {questions.map((q, idx) => (
                  <div key={idx} className="qc-question-card">
                    <div className="qc-question-header">
                      <span className="qc-question-badge">Q{idx + 1}</span>
                      {questions.length > 1 && (
                        <button
                          type="button"
                          className="qc-delete-btn"
                          onClick={() => removeQuestion(idx)}
                          title="Delete question"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                    <textarea
                      rows={2}
                      className="qc-input qc-textarea"
                      placeholder="Enter question text..."
                      value={q.text}
                      onChange={(e) => handleQuestionChange(idx, "text", e.target.value)}
                    />
                    <div className="qc-options-grid">
                      {q.options.map((opt, oIdx) => (
                        <div key={oIdx} className="qc-option-row">
                          <label className={`qc-radio-label ${q.correctIndex === oIdx ? "qc-radio-correct" : ""}`}>
                            <input
                              type="radio"
                              name={`correct-${idx}`}
                              checked={q.correctIndex === oIdx}
                              onChange={() => handleQuestionChange(idx, "correctIndex", oIdx)}
                              className="qc-radio"
                            />
                            <span className="qc-option-letter">
                              {["A", "B", "C", "D"][oIdx]}
                            </span>
                          </label>
                          <input
                            type="text"
                            className="qc-input qc-option-input"
                            placeholder={`Option ${["A", "B", "C", "D"][oIdx]}`}
                            value={opt}
                            onChange={(e) => handleOptionChange(idx, oIdx, e.target.value)}
                          />
                        </div>
                      ))}
                    </div>
                    {q.correctIndex < 0 && (
                      <div className="qc-no-answer-hint">
                        ⚠️ Click a letter badge (A/B/C/D) to mark the correct answer
                      </div>
                    )}
                    <div className="qc-meta-row">
                      <label className="qc-meta-label">
                        ⏱️
                        <input
                          type="number"
                          min={5}
                          className="qc-meta-input"
                          value={q.timeLimitSeconds}
                          onChange={(e) => handleQuestionChange(idx, "timeLimitSeconds", e.target.value)}
                        />
                        <span>sec</span>
                      </label>
                      <label className="qc-meta-label">
                        ⭐
                        <input
                          type="number"
                          min={10}
                          step={10}
                          className="qc-meta-input"
                          value={q.points}
                          onChange={(e) => handleQuestionChange(idx, "points", e.target.value)}
                        />
                        <span>pts</span>
                      </label>
                      <label className="qc-meta-label">
                        💯
                        <input
                          type="number"
                          min={0}
                          max={10}
                          className="qc-meta-input"
                          value={q.marks ?? 1}
                          onChange={(e) => handleQuestionChange(idx, "marks", e.target.value)}
                        />
                        <span>marks</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Save */}
            <div className="qc-save-row">
              <button type="button" className="qc-back-btn" onClick={() => navigate("/teacher")}>
                ← Back to dashboard
              </button>
              <button type="submit" className="qc-save-btn" disabled={saving}>
                {saving ? (
                  <><span className="qc-spinner" /> Saving...</>
                ) : (
                  "💾 Save quiz"
                )}
              </button>
            </div>
          </form>
        )}

        {/* ── UPLOAD MODE ── */}
        {mode === "upload" && (
          <div className="qc-upload-section">
            <div className="qc-form-card">
              <h2 className="qc-form-card-title">
                <span className="qc-form-icon">📁</span> Upload your document
              </h2>
              <p className="qc-upload-hint">
                Upload documents, slides, images, or spreadsheets — our AI will extract or generate quiz questions automatically. Supports OCR for scanned documents & images.
              </p>

              {/* Difficulty selector */}
              <div className="qc-difficulty-section">
                <label className="qc-label">Question difficulty</label>
                <div className="qc-difficulty-row">
                  {[
                    { id: "easy", label: "Easy", emoji: "🟢" },
                    { id: "medium", label: "Medium", emoji: "🟡" },
                    { id: "hard", label: "Hard", emoji: "🔴" },
                    { id: "mixed", label: "Mixed", emoji: "🎯" },
                    { id: "questions_only", label: "Detect Only", emoji: "🔍" },
                  ].map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      className={`qc-difficulty-pill ${difficulty === d.id ? "qc-difficulty-active" : ""}`}
                      onClick={() => setDifficulty(d.id)}
                    >
                      <span>{d.emoji}</span>
                      <span>{d.label}</span>
                    </button>
                  ))}
                </div>
                <p className="qc-difficulty-desc">
                  {difficulty === "easy" && "Simple recall questions — great for beginners."}
                  {difficulty === "medium" && "Moderate difficulty — tests understanding and application."}
                  {difficulty === "hard" && "Challenging questions — requires deep analysis and critical thinking."}
                  {difficulty === "mixed" && "A balanced mix of easy, medium, and hard questions."}
                  {difficulty === "questions_only" && "Only detect existing questions from the file — no AI generation."}
                </p>
              </div>

              {/* Drop zone */}
              <div
                className={`qc-dropzone ${dragOver ? "qc-dropzone-active" : ""} ${file ? "qc-dropzone-has-file" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.txt,.md,.doc,.docx,.pptx,.ppt,.xlsx,.xls,.csv,.jpg,.jpeg,.png,.bmp,.tiff,.tif,.webp,.gif"
                  className="qc-file-hidden"
                  onChange={(e) => handleFilePick(e.target.files?.[0] || null)}
                />
                {file ? (
                  <div className="qc-file-info">
                    <span className="qc-file-icon">📄</span>
                    <span className="qc-file-name">{file.name}</span>
                    <span className="qc-file-size">{(file.size / 1024).toFixed(1)} KB</span>
                    <button
                      type="button"
                      className="qc-file-remove"
                      onClick={(e) => { e.stopPropagation(); setFile(null); }}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="qc-drop-content">
                    <div className="qc-drop-icon">📂</div>
                    <p className="qc-drop-text">Drag & drop your file here</p>
                    <p className="qc-drop-or">or</p>
                    <span className="qc-browse-btn">Browse files</span>
                    <p className="qc-drop-formats">Supports PDF, Word, PowerPoint, Excel, Images, Text files (max 50 MB)</p>
                  </div>
                )}
              </div>

              {/* Upload actions */}
              <div className="qc-upload-actions">
                <button type="button" className="qc-back-btn" onClick={() => navigate("/teacher")}>
                  ← Back
                </button>
                <button
                  type="button"
                  className="qc-extract-btn"
                  onClick={handleExtract}
                  disabled={!file || extracting}
                >
                  {extracting ? (
                    <>
                      <span className="qc-spinner" />
                      <span>AI is analyzing your document...</span>
                    </>
                  ) : (
                    <>🤖 Extract with AI</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
