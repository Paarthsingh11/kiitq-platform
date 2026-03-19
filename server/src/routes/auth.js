import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

import { admin, isFirebaseInitialized } from "../firebaseAdmin.js";

const router = express.Router();

const signToken = (user) => {
  const payload = { id: user._id, role: user.role, name: user.name };
  const secret = process.env.JWT_SECRET || "dev_secret";
  return jwt.sign(payload, secret, { expiresIn: "7d" });
};

router.post("/social", async (req, res) => {
  try {
    const { idToken, role } = req.body;
    if (!idToken) return res.status(400).json({ message: "No ID Token provided" });

    if (!isFirebaseInitialized) {
      return res.status(503).json({ 
        message: "Firebase Admin is not configured. Ask the developer to provide Service Account Keys." 
      });
    }

    // Verify token with Firebase
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { email, name, uid } = decodedToken;

    if (!email) {
      return res.status(400).json({ message: "Social login didn't provide an email" });
    }

    // Check if user exists
    let user = await User.findOne({ email });

    // Create user if they don't exist
    if (!user) {
      if (!role) {
        return res.status(400).json({ 
          message: "Role is required for new accounts",
          requiresRole: true 
        });
      }
      user = await User.create({ 
        name: name || "User", 
        email, 
        passwordHash: uid, // Doesn't matter, we don't auth via password
        role 
      });
    }

    // Sign our own custom JWT token
    const token = signToken(user);
    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, rollNumber: user.rollNumber, section: user.section, branch: user.branch }
    });
  } catch (err) {
    console.error("Social Auth Error:", err);
    res.status(500).json({ message: err.message || "Failed to authenticate with social provider" });
  }
});

router.post("/signup", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "Missing fields" });
    }
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "Email already in use" });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, passwordHash, role });
    const token = signToken(user);
    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, rollNumber: user.rollNumber, section: user.section, branch: user.branch }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(400).json({ message: "Invalid credentials" });
    }
    const token = signToken(user);
    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, rollNumber: user.rollNumber, section: user.section, branch: user.branch }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/profile", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: "Unauthorized" });
    const token = authHeader.split(" ")[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET || "dev_secret");
    const user = await User.findById(payload.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ id: user._id, name: user.name, email: user.email, role: user.role, rollNumber: user.rollNumber, section: user.section, branch: user.branch });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

router.put("/profile", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: "Unauthorized" });
    const token = authHeader.split(" ")[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET || "dev_secret");
    
    const { name, rollNumber, section, branch } = req.body;
    const user = await User.findById(payload.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (name) user.name = name;
    if (rollNumber !== undefined) user.rollNumber = rollNumber;
    if (section !== undefined) user.section = section;
    if (branch !== undefined) user.branch = branch;

    await user.save();
    
    // Sign a new token so the updated name reflects in multiplayer payload
    const newToken = signToken(user);

    res.json({ token: newToken, user: { id: user._id, name: user.name, email: user.email, role: user.role, rollNumber: user.rollNumber, section: user.section, branch: user.branch } });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
