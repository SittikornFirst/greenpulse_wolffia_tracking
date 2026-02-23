import express from "express";
import Device from "../models/Device.js";
import Farm from "../models/Farm.js";
import DeviceConfiguration from "../models/DeviceConfiguration.js";
import SystemLog from "../models/SystemLog.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

router.use(authenticate);

// Get all devices
router.get("/", async (req, res) => {
  try {
    const { farmId } = req.query;
    const query = {};

    // If user is not admin, only show their devices
    if (req.user.role !== "admin") {
      query.user_id = req.user._id;
    }

    if (farmId) {
      query.farm_id = farmId;
    }

    const devices = await Device.find(query)
      .populate("farm_id", "farm_name location")
      .populate("config_id")
      .sort({ created_at: -1 });
    res.json(devices);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get single device
router.get("/:id", async (req, res) => {
  try {
    const query = {
      $or: [{ _id: req.params.id }, { device_id: req.params.id }],
    };

    // If not admin, ensure user owns the device
    if (req.user.role !== "admin") {
      query.user_id = req.user._id;
    }

    const device = await Device.findOne(query)
      .populate("farm_id", "farm_name location")
      .populate("config_id");

    if (!device) {
      return res
        .status(404)
        .json({ success: false, message: "Device not found" });
    }

    res.json(device);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create device
router.post("/", async (req, res) => {
  try {
    const ownerId =
      req.user.role === "admin" && req.body.user_id
        ? req.body.user_id
        : req.user._id;

    // 1. Resolve Farm ID
    let farmId = req.body.farm_id || req.body.farmId;

    if (!farmId) {
      // Auto-find user's farm (use ownerId, not req.user._id)
      const userFarm = await Farm.findOne({ user_id: ownerId });
      if (!userFarm) {
        return res.status(400).json({
          success: false,
          message:
            req.user.role === "admin"
              ? "Target user does not have a farm assigned."
              : "You do not have a farm assigned. Please contact an admin.",
        });
      }
      farmId = userFarm._id;
    } else {
      // Verify provided farm exists
      const farm = await Farm.findById(farmId);
      if (!farm) {
        return res.status(404).json({
          success: false,
          message: "Farm not found.",
        });
      }
    }

    // 2. Generate Device ID
    const generateDeviceId = () => {
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).substring(2, 7);
      return `GREENPULSE-V1-${timestamp}-${random}`.toUpperCase();
    };

    // 3. Create Device
    // Handle location field - convert object to string if needed
    let locationValue = req.body.location || "Farm Location";
    if (typeof locationValue === "object" && locationValue !== null) {
      locationValue =
        locationValue.address || locationValue.name || "Farm Location";
    }

    const deviceData = {
      device_id: req.body.device_id || req.body.id || generateDeviceId(),
      device_name: req.body.device_name || req.body.name || "Unnamed Device",
      farm_id: farmId,
      user_id: ownerId,
      location: locationValue,
      status: req.body.status || "active",
    };

    const device = await Device.create(deviceData);

    // 4. Create Default Configuration
    const config = await DeviceConfiguration.create({
      device_id: device._id,
      mqtt_topic: req.body.mqtt_topic || `devices/${device.device_id}/data`,
      alert_enabled: req.body.alert_enabled ?? true,
      sampling_interval: req.body.sampling_interval || 300,
      ph_min: 6.0,
      ph_max: 7.5,
      ec_value_min: 1.0,
      ec_value_max: 2.5,
      light_intensity_min: 3500,
      light_intensity_max: 6000,
      air_temp_min: 18,
      air_temp_max: 35,
      water_temp_min: 20,
      water_temp_max: 28,
    });

    device.config_id = config._id;
    await device.save();

    const hydratedDevice = await Device.findById(device._id)
      .populate("farm_id", "farm_name location")
      .populate("config_id");

    res.status(201).json(hydratedDevice);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Device ID already exists. Please use a unique ID.",
      });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update device
router.put("/:id", async (req, res) => {
  try {
    const updateData = { ...req.body };
    if (updateData.name && !updateData.device_name) {
      updateData.device_name = updateData.name;
      delete updateData.name;
    }
    if (
      updateData.location?.address &&
      typeof updateData.location !== "string"
    ) {
      updateData.location = updateData.location.address;
    }

    // Build query - check if id is a valid ObjectId first
    const mongoose = await import("mongoose");
    const query = {};
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      query.$or = [{ _id: req.params.id }, { device_id: req.params.id }];
    } else {
      // If not a valid ObjectId, only search by device_id
      query.device_id = req.params.id;
    }

    // If not admin, ensure user owns the device
    if (req.user.role !== "admin") {
      query.user_id = req.user._id;
    }

    const device = await Device.findOneAndUpdate(query, updateData, {
      new: true,
      runValidators: true,
    })
      .populate("farm_id", "farm_name location")
      .populate("config_id");

    if (!device) {
      return res
        .status(404)
        .json({ success: false, message: "Device not found" });
    }

    res.json(device);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update device status
router.patch("/:id/status", async (req, res) => {
  try {
    const { status } = req.body;

    // Build query - check if id is a valid ObjectId first
    const mongoose = await import("mongoose");
    const query = {};
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      query.$or = [{ _id: req.params.id }, { device_id: req.params.id }];
    } else {
      // If not a valid ObjectId, only search by device_id
      query.device_id = req.params.id;
    }

    const device = await Device.findOneAndUpdate(
      query,
      { status },
      { new: true },
    )
      .populate("farm_id", "farm_name location")
      .populate("config_id");

    if (!device) {
      return res
        .status(404)
        .json({ success: false, message: "Device not found" });
    }

    res.json(device);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update device configuration/thresholds
router.put("/:id/configuration", async (req, res) => {
  try {
    const device = await Device.findOne({
      $or: [{ _id: req.params.id }, { device_id: req.params.id }],
    });

    if (!device) {
      return res
        .status(404)
        .json({ success: false, message: "Device not found" });
    }

    // Update or create configuration
    const configData = {
      device_id: device._id,
      ...req.body,
    };

    let config = await DeviceConfiguration.findOneAndUpdate(
      { device_id: device._id },
      configData,
      { new: true, upsert: true, runValidators: true },
    );

    // Update device's config_id reference
    device.config_id = config._id;
    await device.save();

    // Log the configuration change
    await SystemLog.create({
      device_id: device._id,
      config_id: config._id,
      log_type: "INFO",
      event: "CONFIG_UPDATE",
      message: "Device configuration updated",
      metadata: { updated_fields: Object.keys(req.body) },
    });

    res.json(config);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete device
router.delete("/:id", async (req, res) => {
  try {
    const query = {
      $or: [{ _id: req.params.id }, { device_id: req.params.id }],
    };

    // If not admin, ensure user owns the device
    if (req.user.role !== "admin") {
      query.user_id = req.user._id;
    }

    const device = await Device.findOneAndDelete(query);

    if (!device) {
      return res
        .status(404)
        .json({ success: false, message: "Device not found" });
    }

    await DeviceConfiguration.findOneAndDelete({ device_id: device._id });
    await SystemLog.deleteMany({ device_id: device._id });

    res.json({ success: true, message: "Device deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
