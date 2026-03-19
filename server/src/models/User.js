import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String },
    role: { type: String, enum: ["teacher", "student"], required: true },
    rollNumber: { type: String },
    section: { type: String },
    branch: { type: String }
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

export default User;

