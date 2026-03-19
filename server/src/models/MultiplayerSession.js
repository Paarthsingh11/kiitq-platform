import mongoose from "mongoose";

const playerSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: { type: String, required: true },
    rollNumber: { type: String, default: "" },
    section: { type: String, default: "" },
    branch: { type: String, default: "" },
    score: { type: Number, default: 0 },
    cheatCount: { type: Number, default: 0 }
  },
  { _id: false }
);

const multiplayerSessionSchema = new mongoose.Schema(
  {
    quiz: { type: mongoose.Schema.Types.ObjectId, ref: "Quiz", required: true },
    host: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    joinCode: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ["lobby", "in_progress", "finished"],
      default: "lobby"
    },
    players: [playerSchema]
  },
  { timestamps: true }
);

const MultiplayerSession = mongoose.model("MultiplayerSession", multiplayerSessionSchema);

export default MultiplayerSession;

