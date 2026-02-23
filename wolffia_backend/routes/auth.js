import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Farm from "../models/Farm.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

// Register
router.post("/register", async (req, res) => {
  try {
    const { user_name, email, password, role, phone } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, message: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      user_name,
      email,
      password: hashedPassword,
      role: role || "farmer",
      phone,
    });

    await user.save();

    // Auto-create farm for farmer users
    if (user.role === "farmer") {
      await Farm.create({
        farm_name: `${user.user_name}'s Farm`,
        user_id: user._id,
        location: "Default Location",
      });
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || "24h" },
    );

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        user_name: user.user_name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    const isValid = await user.comparePassword(password);
    if (!isValid) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    user.last_login = new Date();
    await user.save();

    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || "24h" },
    );

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        user_name: user.user_name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get current user
router.get("/me", authenticate, async (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user._id,
      user_name: req.user.user_name,
      email: req.user.email,
      role: req.user.role,
      phone: req.user.phone,
    },
  });
});

// Logout
router.post("/logout", authenticate, (req, res) => {
  res.json({ success: true, message: "Logged out successfully" });
});

export default router;
