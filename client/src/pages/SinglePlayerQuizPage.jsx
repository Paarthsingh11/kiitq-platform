import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../state/AuthContext.jsx";
import { useTheme } from "../state/ThemeContext.jsx";

export default function SinglePlayerQuizPage() {
  const { id } = useParams();
  const { api } = useAuth();
  const { activeTheme } = useTheme();
  const navigate = useNavigate();

  const accentClass = activeTheme?.accent
    ? `question-box-accent-${activeTheme.accent}`
    : "";

  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await api.get(`/quizzes/${id}`);
        if (!active) return;
        setQuiz(res.data);
        const q = res.data.questions?.[0];
        setTimeLeft(q?.timeLimitSeconds || 30);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load quiz");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [api, id]);

  const questions = useMemo(() => quiz?.questions || [], [quiz]);
  const currentQuestion = questions[currentIndex];

  useEffect(() => {
    if (!currentQuestion || finished) return;
    setSelectedIndex(null);
    setTimeLeft(currentQuestion.timeLimitSeconds || 30);
  }, [currentIndex, currentQuestion, finished]);

  useEffect(() => {
    if (!currentQuestion || finished) return;
    if (timeLeft <= 0) {
      handleNext();
      return;
    }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, currentQuestion, finished]);

  const handleAnswer = (index) => {
    setSelectedIndex(index);
  };

  const handleNext = () => {
    if (!currentQuestion) return;
    const isCorrect = selectedIndex === currentQuestion.correctIndex;
    if (isCorrect) {
      setScore((s) => s + (currentQuestion.points || 100));
    }
    if (currentIndex + 1 >= questions.length) {
      setFinished(true);
      navigate("/results", {
        state: {
          mode: "single",
          score,
          total: questions.reduce((sum, q) => sum + (q.points || 100), 0)
        }
      });
    } else {
      setCurrentIndex((i) => i + 1);
    }
  };

  if (loading) return <p className="text-sm text-slate-300">Loading quiz...</p>;
  if (error)
    return (
      <p className="text-sm text-rose-300 bg-rose-950/50 border border-rose-800/70 rounded-xl px-3 py-2">
        {error}
      </p>
    );
  if (!quiz) return null;

  return (
    <div className="max-w-2xl mx-auto glass-card p-5 space-y-4 bg-slate-900/80 backdrop-blur-xl border border-slate-700/60">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-50">{quiz.title}</h1>
          <p className="text-xs text-slate-400">
            Question {currentIndex + 1} of {questions.length}
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-400">Score</div>
          <div className="text-sm font-semibold text-slate-50">{score} pts</div>
        </div>
      </div>
      {currentQuestion && (
        <>
          <div className="flex items-center justify-between gap-3 text-xs text-slate-300">
            <span>Time left</span>
            <span className="font-mono px-2 py-1 rounded bg-slate-900 border border-slate-700">
              {timeLeft}s
            </span>
          </div>
          <div className={`question-box p-4 ${accentClass}`}>
            <p className="text-sm text-slate-100 mb-3">{currentQuestion.text}</p>
            <div className="space-y-2">
              {currentQuestion.options.map((opt, idx) => {
                const isSelected = selectedIndex === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleAnswer(idx)}
                    className={`w-full text-left px-3 py-2 rounded-xl border text-xs transition-all duration-200 ${
                      isSelected
                        ? "border-primary bg-primary/20 text-primary"
                        : "border-slate-700 bg-slate-950/80 text-slate-200 hover:border-slate-500 hover:bg-slate-900/80"
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex justify-end">
            <button
              className="btn-primary text-xs"
              onClick={handleNext}
              disabled={selectedIndex === null && timeLeft > 0}
            >
              {currentIndex + 1 >= questions.length ? "Finish quiz" : "Next question"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

