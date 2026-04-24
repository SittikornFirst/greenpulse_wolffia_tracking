import express from "express";
import crypto from "crypto";
import Device from "../models/Device.js";
import Farm from "../models/Farm.js";
import DeviceConfiguration from "../models/DeviceConfiguration.js";
import SystemLog from "../models/SystemLog.js";
import { authenticate } from "../middleware/auth.js";
import { auditLog } from "../utils/logger.js";

const router = express.Router();

// Public endpoint — no JWT required — used by ESP32 to sync relay states from the backend.
// The device_id acts as the lookup key (same pattern as POST /api/sensor-data).
router.get("/:deviceId/relay-states", async (req, res) => {
  try {
    const device = await Device.findOne({
      device_id: req.params.deviceId.toUpperCase(),
      is_deleted: { $ne: true },
    });
    if (!device) return res.status(404).json({ success: false, message: "Device not found" });

    const config = await DeviceConfiguration.findById(device.config_id);
    if (!config) return res.status(404).json({ success: false, message: "No configuration" });

    res.json({
      success: true,
      relays: config.relays.map((r) => ({
        relay_id: r.relay_id,
        pin: r.pin,
        name: r.name,
        status: r.status,
      })),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Public endpoint — no JWT required — used by ESP32 to fetch full device configuration on startup.
// Returns thresholds, sampling interval, relay states, and schedules in one call.
router.get("/:deviceId/config", async (req, res) => {
  try {
    const device = await Device.findOne({
      device_id: req.params.deviceId.toUpperCase(),
      is_deleted: { $ne: true },
    });
    if (!device) return res.status(404).json({ success: false, message: "Device not found" });

    const config = await DeviceConfiguration.findById(device.config_id);
    if (!config) return res.status(404).json({ success: false, message: "No configuration" });

    res.json({
      success: true,
      device_id: device.device_id,
      sampling_interval: config.sampling_interval ?? 30,
      alert_enabled: config.alert_enabled ?? true,
      ph_min: config.ph_min ?? 6.0,
      ph_max: config.ph_max ?? 7.5,
      ec_value_min: config.ec_value_min ?? 1.0,
      ec_value_max: config.ec_value_max ?? 2.5,
      water_temp_min: config.water_temp_min ?? 20.0,
      water_temp_max: config.water_temp_max ?? 28.0,
      air_temp_min: config.air_temp_min ?? 18.0,
      air_temp_max: config.air_temp_max ?? 35.0,
      light_intensity_min: config.light_intensity_min ?? 3500.0,
      light_intensity_max: config.light_intensity_max ?? 6000.0,
      relays: config.relays.map((r) => ({
        relay_id: r.relay_id,
        pin: r.pin,
        name: r.name,
        status: r.status,
      })),
      schedules: config.schedules
        .filter((s) => s.enabled)
        .map((s) => ({
          schedule_id: s.schedule_id,
          relays: s.relays,
          days: s.days,
          startHour: s.startHour,
          startMinute: s.startMinute,
          stopHour: s.stopHour,
          stopMinute: s.stopMinute,
          enabled: s.enabled,
        })),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.use(authenticate);

// Get all devices
router.get("/", async (req, res) => {
  try {
    const { farmId, status, search, page = 1, limit = 20 } = req.query;
    const query = { is_deleted: { $ne: true } };

    // If user is not admin, only show their devices
    if (req.user.role !== "admin") {
      query.user_id = req.user._id;
    }

    if (farmId) {
      query.farm_id = farmId;
    }

    if (status) {
      query.status = status;
    }

    if (search) {
      const regex = new RegExp(search, "i");
      const matchingFarms = await Farm.find({ farm_name: regex }).select("_id");
      const matchingFarmIds = matchingFarms.map((farm) => farm._id);

      query.$or = [
        { device_name: regex },
        { device_id: regex },
        { location: regex },
        ...(matchingFarmIds.length > 0 ? [{ farm_id: { $in: matchingFarmIds } }] : []),
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [total, devices] = await Promise.all([
      Device.countDocuments(query),
      Device.find(query)
        .populate("farm_id", "farm_name location")
        .populate("config_id")
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(parseInt(limit))
    ]);
    const totalPages = Math.max(1, Math.ceil(total / parseInt(limit)));

    res.json({
      success: true,
      data: devices,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: totalPages,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get single device
router.get("/:id", async (req, res) => {
  try {
    const mongoose = await import("mongoose");
    const query = {
      is_deleted: { $ne: true }
    };
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      query.$or = [{ _id: req.params.id }, { device_id: req.params.id }];
    } else {
      query.device_id = req.params.id;
    }

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



    await auditLog({
      user_id: req.user._id,
      target_type: "Device",
      target_id: device._id,
      action_type: "CREATE",
      event: "Device Created",
      message: `${req.user.role === 'admin' ? 'Admin' : 'User'} ${req.user.email} registered device '${device.device_name}'.`
    });

    res.status(201).json(hydratedDevice);
  } catch (error) {
    if (error.code === 11000) {
      console.error("Duplicate key error details:", error);
      if (error.keyPattern && error.keyPattern.farm_id) {
        return res.status(400).json({
          success: false,
          message:
            "Device creation is blocked by a stale database constraint on farm_id. Restart the backend to apply the index cleanup, then try again.",
        });
      }
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

    await auditLog({
      user_id: req.user._id,
      target_type: "Device",
      target_id: device._id,
      action_type: "UPDATE",
      event: "Device Updated",
      message: `${req.user.role === 'admin' ? 'Admin' : 'User'} ${req.user.email} updated device '${device.device_name}'.`
    });

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

    await auditLog({
      user_id: req.user._id,
      target_type: "Device",
      target_id: device._id,
      action_type: "UPDATE",
      event: `Device Status ${status}`,
      message: `${req.user.role === 'admin' ? 'Admin' : 'User'} ${req.user.email} changed device '${device.device_name}' status to ${status}.`
    });

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
    await auditLog({
      user_id: req.user._id,
      device_id: device._id,
      target_type: "DeviceConfiguration",
      target_id: config._id,
      action_type: "UPDATE",
      event: "CONFIG_UPDATE",
      message: `${req.user.role === 'admin' ? 'Admin' : 'User'} ${req.user.email} updated configuration for device '${device.device_name}'.`
    });

    res.json(config);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete device (Soft delete by default)
router.delete("/:id", async (req, res) => {
  try {
    const mongoose = await import("mongoose");
    const query = {};
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      query.$or = [{ _id: req.params.id }, { device_id: req.params.id }];
    } else {
      query.device_id = req.params.id;
    }

    // If not admin, ensure user owns the device
    if (req.user.role !== "admin") {
      query.user_id = req.user._id;
    }

    let device;
    if (req.query.hard === "true" && req.user.role === "admin") {
      // Admin Hard Delete
      device = await Device.findOneAndDelete(query);
      if (device) {
        await DeviceConfiguration.findOneAndDelete({ device_id: device._id });
        await SystemLog.deleteMany({ device_id: device._id });
      }
    } else {
      // Soft Delete
      device = await Device.findOneAndUpdate(query, { is_deleted: true }, { new: true });
    }

    if (!device) {
      return res
        .status(404)
        .json({ success: false, message: "Device not found" });
    }

    await auditLog({
      user_id: req.user._id,
      target_type: "Device",
      target_id: req.params.id,
      action_type: "DELETE",
      event: "Device Deleted",
      message: `${req.user.role === 'admin' ? 'Admin' : 'User'} ${req.user.email} ${req.query.hard === "true" ? "permanently deleted" : "soft deleted"} device.`
    });

    res.json({ success: true, message: req.query.hard === "true" ? "Device permanently deleted" : "Device deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- Relay Control Endpoints ---

// Update Relay Configuration
router.put("/:id/relays/:relayId", async (req, res) => {
  try {
    const { name, status } = req.body;
    const relayId = parseInt(req.params.relayId);

    const mongoose = await import("mongoose");
    const query = {};
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      query.$or = [{ _id: req.params.id }, { device_id: req.params.id }];
    } else {
      query.device_id = req.params.id;
    }

    const device = await Device.findOne(query);
    if (!device) return res.status(404).json({ success: false, message: "Device not found" });

    const config = await DeviceConfiguration.findOne({ device_id: device._id });
    if (!config) return res.status(404).json({ success: false, message: "Config not found" });

    const relayIndex = config.relays.findIndex(r => r.relay_id === relayId);
    if (relayIndex === -1) return res.status(404).json({ success: false, message: "Relay not found" });

    if (name !== undefined) config.relays[relayIndex].name = name;
    if (status !== undefined) config.relays[relayIndex].status = status;
    
    await config.save();



    res.json(config.relays[relayIndex]);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- Schedule Management Endpoints ---

// Add Schedule
router.post("/:id/schedules", async (req, res) => {
  try {
    const { relays, days, startHour, startMinute, stopHour, stopMinute, enabled } = req.body;

    const mongoose = await import("mongoose");
    const query = {};
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      query.$or = [{ _id: req.params.id }, { device_id: req.params.id }];
    } else {
      query.device_id = req.params.id;
    }

    const device = await Device.findOne(query);
    if (!device) return res.status(404).json({ success: false, message: "Device not found" });

    const config = await DeviceConfiguration.findOne({ device_id: device._id });
    if (!config) return res.status(404).json({ success: false, message: "Config not found" });

    const newSchedule = {
      schedule_id: crypto.randomUUID(),
      relays: relays || [],
      days: days || [],
      startHour: startHour || 0,
      startMinute: startMinute || 0,
      stopHour: stopHour || 0,
      stopMinute: stopMinute || 0,
      enabled: enabled !== undefined ? enabled : true
    };

    config.schedules.push(newSchedule);
    await config.save();
    

    
    res.status(201).json(newSchedule);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update Schedule
router.put("/:id/schedules/:schedId", async (req, res) => {
  try {
    const { relays, days, startHour, startMinute, stopHour, stopMinute, enabled } = req.body;
    
    const mongoose = await import("mongoose");
    const query = {};
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      query.$or = [{ _id: req.params.id }, { device_id: req.params.id }];
    } else {
      query.device_id = req.params.id;
    }

    const device = await Device.findOne(query);
    if (!device) return res.status(404).json({ success: false, message: "Device not found" });

    const config = await DeviceConfiguration.findOne({ device_id: device._id });
    if (!config) return res.status(404).json({ success: false, message: "Config not found" });

    const schedIndex = config.schedules.findIndex(s => s.schedule_id === req.params.schedId);
    if (schedIndex === -1) return res.status(404).json({ success: false, message: "Schedule not found" });

    if (relays !== undefined) config.schedules[schedIndex].relays = relays;
    if (days !== undefined) config.schedules[schedIndex].days = days;
    if (startHour !== undefined) config.schedules[schedIndex].startHour = startHour;
    if (startMinute !== undefined) config.schedules[schedIndex].startMinute = startMinute;
    if (stopHour !== undefined) config.schedules[schedIndex].stopHour = stopHour;
    if (stopMinute !== undefined) config.schedules[schedIndex].stopMinute = stopMinute;
    if (enabled !== undefined) config.schedules[schedIndex].enabled = enabled;

    await config.save();
    

    
    res.json(config.schedules[schedIndex]);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete Schedule
router.delete("/:id/schedules/:schedId", async (req, res) => {
  try {
    const mongoose = await import("mongoose");
    const query = {};
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      query.$or = [{ _id: req.params.id }, { device_id: req.params.id }];
    } else {
      query.device_id = req.params.id;
    }

    const device = await Device.findOne(query);
    if (!device) return res.status(404).json({ success: false, message: "Device not found" });

    const config = await DeviceConfiguration.findOne({ device_id: device._id });
    if (!config) return res.status(404).json({ success: false, message: "Config not found" });

    config.schedules = config.schedules.filter(s => s.schedule_id !== req.params.schedId);
    await config.save();
    

    
    res.json({ success: true, message: "Schedule deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
