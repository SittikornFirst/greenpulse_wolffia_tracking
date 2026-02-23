import express from "express";
import Farm from "../models/Farm.js";
import Device from "../models/Device.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// Farm routes with ownership and role-based access control

// Get all farms
router.get("/", async (req, res) => {
  try {
    const query = {};
    if (req.user.role !== "admin") {
      query.user_id = req.user._id;
    }

    const farms = await Farm.find(query)
      .sort({ created_at: -1 })
      .populate("user_id", "user_name email");

    // Get device counts for each farm
    const farmsWithStats = await Promise.all(
      farms.map(async (farm) => {
        const deviceCount = await Device.countDocuments({ farm_id: farm._id });
        const activeDeviceCount = await Device.countDocuments({
          farm_id: farm._id,
          status: "active",
        });

        return {
          _id: farm._id,
          id: farm._id.toString(),
          name: farm.farm_name,
          user: farm.user_id,
          location: farm.location,
          deviceCount,
          activeDeviceCount,
        };
      }),
    );

    res.json(farmsWithStats);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get single farm
router.get("/:id", async (req, res) => {
  try {
    const farm = await Farm.findById(req.params.id);

    if (!farm) {
      return res
        .status(404)
        .json({ success: false, message: "Farm not found" });
    }

    // Authorization check
    if (
      farm.user_id.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res
        .status(403)
        .json({ success: false, message: "Access denied to this farm" });
    }

    // Re-populate for the response
    await farm.populate("user_id", "user_name email");

    const deviceCount = await Device.countDocuments({ farm_id: farm._id });
    const devices = await Device.find({ farm_id: farm._id });

    res.json({
      ...farm.toObject(),
      deviceCount,
      devices,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create farm
router.post("/", async (req, res) => {
  try {
    // If farmer, force user_id to self. If admin, allow overriding.
    const ownerId =
      req.user.role === "admin"
        ? req.body.user_id || req.user._id
        : req.user._id;

    // Check if user already has a farm
    const existingFarm = await Farm.findOne({ user_id: ownerId });
    if (existingFarm) {
      return res
        .status(400)
        .json({ success: false, message: "User already has a farm." });
    }

    const farmData = {
      farm_name: req.body.name || req.body.farm_name,
      user_id: ownerId,
      location: req.body.location || req.body.address || "",
    };

    const farm = new Farm(farmData);
    await farm.save();

    res.status(201).json(farm);
  } catch (error) {
    // Handle duplicate key error explicitly just in case race condition
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "User already has a farm (duplicate).",
      });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update farm
router.put("/:id", async (req, res) => {
  try {
    const updateData = { ...req.body };

    // Map frontend fields to backend fields
    if (updateData.name && !updateData.farm_name) {
      updateData.farm_name = updateData.name;
    }
    if (
      updateData.location?.address &&
      typeof updateData.location !== "string"
    ) {
      updateData.location = updateData.location.address;
    }

    let farm = await Farm.findById(req.params.id);

    if (!farm) {
      return res
        .status(404)
        .json({ success: false, message: "Farm not found" });
    }

    // Authorization check
    if (
      farm.user_id.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res
        .status(403)
        .json({ success: false, message: "Access denied to this farm" });
    }

    const farmUpdated = await Farm.findByIdAndUpdate(
      req.params.id,
      updateData,
      {
        new: true,
        runValidators: true,
      },
    );

    res.json(farmUpdated);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete farm
router.delete("/:id", async (req, res) => {
  try {
    const farm = await Farm.findById(req.params.id);

    if (!farm) {
      return res
        .status(404)
        .json({ success: false, message: "Farm not found" });
    }

    // Authorization check
    if (
      farm.user_id.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res
        .status(403)
        .json({ success: false, message: "Access denied to this farm" });
    }

    // Check if farm has devices
    const deviceCount = await Device.countDocuments({ farm_id: req.params.id });

    if (deviceCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete farm with ${deviceCount} device(s). Please remove devices first.`,
      });
    }

    await Farm.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: "Farm deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get farm devices
router.get("/:farmId/devices", async (req, res) => {
  try {
    const devices = await Device.find({
      farm_id: req.params.farmId,
    });

    res.json(devices);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get farm statistics
router.get("/:farmId/statistics", async (req, res) => {
  try {
    const farm = await Farm.findById(req.params.farmId);
    if (!farm) {
      return res
        .status(404)
        .json({ success: false, message: "Farm not found" });
    }

    const deviceCount = await Device.countDocuments({
      farm_id: req.params.farmId,
    });
    const activeDeviceCount = await Device.countDocuments({
      farm_id: req.params.farmId,
      status: "active",
    });

    res.json({
      farm: farm,
      deviceCount,
      activeDeviceCount,
      inactiveDeviceCount: deviceCount - activeDeviceCount,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
