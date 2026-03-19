import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/Layout.jsx";
import { useAuth } from "./state/AuthContext.jsx";
import LandingPage from "./pages/LandingPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import SignupPage from "./pages/SignupPage.jsx";
import TeacherDashboard from "./pages/TeacherDashboard.jsx";
import StudentDashboard from "./pages/StudentDashboard.jsx";
import QuizCreatePage from "./pages/QuizCreatePage.jsx";
import ReviewExtractedPage from "./pages/ReviewExtractedPage.jsx";
import SinglePlayerQuizPage from "./pages/SinglePlayerQuizPage.jsx";
import MultiplayerLobbyPage from "./pages/MultiplayerLobbyPage.jsx";
import MultiplayerBattlePage from "./pages/MultiplayerBattlePage.jsx";
import ResultPage from "./pages/ResultPage.jsx";

function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route
          path="/teacher"
          element={
            <ProtectedRoute role="teacher">
              <TeacherDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher/quizzes/new"
          element={
            <ProtectedRoute role="teacher">
              <QuizCreatePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher/quizzes/review"
          element={
            <ProtectedRoute role="teacher">
              <ReviewExtractedPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student"
          element={
            <ProtectedRoute role="student">
              <StudentDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/quiz/:id"
          element={
            <ProtectedRoute>
              <SinglePlayerQuizPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/multiplayer/lobby"
          element={
            <ProtectedRoute>
              <MultiplayerLobbyPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/multiplayer/battle/:joinCode"
          element={
            <ProtectedRoute>
              <MultiplayerBattlePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/results"
          element={
            <ProtectedRoute>
              <ResultPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  );
}

