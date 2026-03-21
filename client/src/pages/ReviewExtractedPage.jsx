import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../state/AuthContext.jsx";

export default function ReviewExtractedPage() {
  const { api } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const initialQuestions = location.state?.questions || [];
  const fileName = location.state?.fileName || "Uploaded file";
  const extractionMethod = location.state?.method || "unknown";

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState(initialQuestions);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // If no questions were passed, redirect back
  if (initialQuestions.length === 0) {
    return (
      <div className="qc-page">
        <div className="qc-empty-state">
          <div className="qc-empty-icon">⚠️</div>
          <h2 className="qc-empty-title">No extracted questions</h2>
          <p className="qc-empty-desc">No questions were found. Please go back and upload a file.</p>
          <button className="qc-save-btn" style={{ marginTop: 16 }} onClick={() => navigate("/teacher/quizzes/new")}>
            ← Back to quiz creation
          </button>
        </div>
      </div>
    );
  }

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

  const removeQuestion = (index) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const addQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      { text: "", options: ["", "", "", ""], correctIndex: -1, timeLimitSeconds: 30, points: 100, marks: 1 },
    ]);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError("Please enter a quiz title.");
      return;
    }
    if (questions.length === 0) {
      setError("No questions to save.");
      return;
    }
    // Validate: every question must have a correct answer selected
    const missing = questions.findIndex((q) => q.correctIndex < 0 || q.correctIndex > 3);
    if (missing !== -1) {
      setError(`Please select the correct answer for Question ${missing + 1}.`);
      return;
    }
    setError("");
    setSaving(true);
    try {
      const payload = {
        title,
        description,
        questions: questions.map((q) => ({
          text: q.text,
          options: q.options,
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

  return (
    <form className="qc-page" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
      {/* Header */}
      <div className="qc-hero">
        <h1 className="qc-greeting">
          🤖 Review Extracted Questions
        </h1>
        <p className="rv-subtitle">
          <span className="rv-file-badge">📄 {fileName}</span>
          <span className="rv-count-badge">{questions.length} questions extracted</span>
          <span className="rv-method-badge">
            {extractionMethod === "ai_generate" && "✨ AI Generated"}
            {extractionMethod === "ai_extract" && "🤖 AI Extracted"}
            {extractionMethod === "local_generate" && "⚡ Smart Generated"}
            {extractionMethod === "heuristic" && "🔍 Pattern Detected"}
            {extractionMethod === "heuristic_fallback" && "🔄 Fallback"}
            {!["ai_generate", "ai_extract", "local_generate", "heuristic", "heuristic_fallback"].includes(extractionMethod) && "📊 Processed"}
          </span>
          {questions.some((q) => q.correctIndex < 0) && (
            <span className="rv-warn-badge">⚠️ Some answers need review</span>
          )}
        </p>
      </div>

      {error && <div className="qc-error-banner">{error}</div>}

      {/* Quiz details */}
      <div className="qc-form-card rv-details-card">
        <h2 className="qc-form-card-title">
          <span className="qc-form-icon">📝</span> Quiz details
        </h2>
        <div className="qc-field">
          <label className="qc-label">Title *</label>
          <input
            type="text"
            className="qc-input"
            placeholder="Give your quiz a title..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="qc-field">
          <label className="qc-label">Description (optional)</label>
          <textarea
            rows={2}
            className="qc-input qc-textarea"
            placeholder="Brief description..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </div>

      {/* Extracted questions list */}
      <div className="qc-form-card">
        <div className="qc-form-card-header">
          <h2 className="qc-form-card-title">
            <span className="qc-form-icon">✅</span> Questions ({questions.length})
          </h2>
          <button type="button" className="qc-add-btn" onClick={addQuestion}>
            + Add question
          </button>
        </div>
        <div className="qc-questions-list">
          {questions.map((q, idx) => (
            <div key={idx} className="qc-question-card rv-question-card">
              <div className="qc-question-header">
                <span className="qc-question-badge rv-badge-ai">
                  🤖 Q{idx + 1}
                </span>
                <button
                  type="button"
                  className="qc-delete-btn"
                  onClick={() => removeQuestion(idx)}
                  title="Remove question"
                >
                  🗑️
                </button>
              </div>
              <textarea
                rows={2}
                className="qc-input qc-textarea"
                value={q.text}
                onChange={(e) => handleQuestionChange(idx, "text", e.target.value)}
              />
              <div className="qc-options-grid">
                {(q.options || []).map((opt, oIdx) => (
                  <div key={oIdx} className="qc-option-row">
                    <label className={`qc-radio-label ${q.correctIndex === oIdx ? "qc-radio-correct" : ""}`}>
                      <input
                        type="radio"
                        name={`rv-correct-${idx}`}
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
                      value={opt}
                      onChange={(e) => handleOptionChange(idx, oIdx, e.target.value)}
                    />
                  </div>
                ))}
              </div>
              {q.correctIndex < 0 && (
                <div className="qc-no-answer-hint">
                  ⚠️ No correct answer detected — click a letter badge (A/B/C/D) to set it
                </div>
              )}
              <div className="qc-meta-row">
                <label className="qc-meta-label">
                  ⏱️
                  <input
                    type="number"
                    min={5}
                    className="qc-meta-input"
                    value={q.timeLimitSeconds || 30}
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
                    value={q.points || 100}
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

      {/* Actions */}
      <div className="qc-save-row">
        <button type="button" className="qc-back-btn" onClick={() => navigate("/teacher/quizzes/new")}>
          ← Back to upload
        </button>
        <button
          type="submit"
          className="qc-save-btn"
          disabled={saving}
        >
          {saving ? (
            <><span className="qc-spinner" /> Saving...</>
          ) : (
            "💾 Save quiz"
          )}
        </button>
      </div>
    </form>
  );
}
