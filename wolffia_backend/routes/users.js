import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Farm from "../models/Farm.js";
import Device from "../models/Device.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get all users (Admin only)
router.get("/", authorize("admin"), async (req, res) => {
  try {
    const { role, search, page = 1, limit = 20 } = req.query;

    const query = {};
    if (role) {
      query.role = role;
    }
    if (search) {
      query.$or = [
        { user_name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const users = await User.find(query)
      .select("-password")
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get single user (Admin only)
router.get("/:id", authorize("admin"), async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Get user's farm if farmer
    let farm = null;
    if (user.role === "farmer") {
      farm = await Farm.findOne({ user_id: user._id });
    }

    // Get user's device count
    const deviceCount = await Device.countDocuments({ user_id: user._id });

    res.json({
      success: true,
      user: {
        ...user.toObject(),
        farm,
        deviceCount,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create user (Admin only)
router.post("/", authorize("admin"), async (req, res) => {
  try {
    const { user_name, email, password, role, phone } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, message: "Email already exists" });
    }

    // Hash password
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

    res.status(201).json({
      success: true,
      user: {
        id: user._id,
        user_name: user.user_name,
        email: user.email,
        role: user.role,
        phone: user.phone,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update user (Admin only)
router.put("/:id", authorize("admin"), async (req, res) => {
  try {
    const { user_name, email, phone, role, is_active, password } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Check if email is being changed and if it already exists
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res
          .status(400)
          .json({ success: false, message: "Email already exists" });
      }
      user.email = email;
    }

    // Update fields
    if (user_name) user.user_name = user_name;
    if (phone !== undefined) user.phone = phone;
    if (role) user.role = role;
    if (is_active !== undefined) user.is_active = is_active;

    // Update password if provided
    if (password) {
      user.password = await bcrypt.hash(password, 10);
    }

    await user.save();

    res.json({
      success: true,
      user: {
        id: user._id,
        user_name: user.user_name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        is_active: user.is_active,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete user (Admin only)
router.delete("/:id", authorize("admin"), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Prevent deleting yourself
    if (user._id.toString() === req.user._id.toString()) {
      return res
        .status(400)
        .json({ success: false, message: "Cannot delete your own account" });
    }

    // Delete user's farm and devices
    await Farm.deleteMany({ user_id: user._id });
    await Device.deleteMany({ user_id: user._id });

    await user.deleteOne();

    res.json({
      success: true,
      message: "User and associated data deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Toggle user active status (Admin only)
router.patch("/:id/toggle-status", authorize("admin"), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Prevent deactivating yourself
    if (user._id.toString() === req.user._id.toString()) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Cannot deactivate your own account",
        });
    }

    user.is_active = !user.is_active;
    await user.save();

    res.json({
      success: true,
      user: {
        id: user._id,
        is_active: user.is_active,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
