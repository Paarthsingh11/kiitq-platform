## QuizBattle – Single & Multiplayer Quiz Platform

This is a full-stack quiz platform focused on **two modes only**:

- **Single player** quiz
- **Multiplayer** quiz (real-time, room-based)

The app mimics the core quiz flow of the referenced product while intentionally omitting:
public libraries, class management, marketplaces, analytics, global rankings, or extra game modes.

### Tech stack

- **Frontend**: React + Vite + TailwindCSS
- **Backend**: Node.js + Express
- **Database**: MongoDB (via Mongoose)
- **Auth**: JWT (email + password)
- **Realtime**: Socket.io

### Getting started

1. Create a `.env` file in the project root based on `.env.example`:

```bash
cp .env.example .env
```

2. Make sure MongoDB is running locally (or point `MONGODB_URI` to your instance).

3. Install dependencies and start both server and client:

```bash
npm install
npm run dev
```

The backend runs on `http://localhost:4000`, the frontend on `http://localhost:5173`.

### Core flows

- **Teacher**
  - Sign up as a teacher.
  - From the teacher dashboard, create quizzes:
    - Manually input questions, options, correct answer, timer, and points.
    - Optionally upload a file (PDF / text); the backend parses text and generates draft questions you can edit.
  - Save quizzes; they are stored in MongoDB.
  - Start a **multiplayer room** for any quiz:
    - Generates a **6-digit join code**.
    - Open the lobby view and share the code with students.

- **Student**
  - Sign up as a student.
  - From the student dashboard, enter a 6-digit join code to join a room.
  - Wait in the lobby until the teacher starts the quiz.

- **Single-player mode**
  - Open `/quiz/:id` for any quiz.
  - Answer questions one-by-one with a per-question timer.
  - Score is accumulated and a **simple results screen** is shown at the end.

- **Multiplayer mode**
  - Teacher starts the quiz; all connected players receive questions in **real time**.
  - Each student gets the same questions in **random order per player**.
  - Per-question timers, answer submission, and scoring are handled via Socket.io.
  - A live **leaderboard** updates as players answer.
  - When every player is finished, the room is marked finished and the final leaderboard is displayed.

