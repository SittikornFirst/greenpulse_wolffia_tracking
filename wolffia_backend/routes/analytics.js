import express from "express";
import SensorData from "../models/SensorData.js";
import Device from "../models/Device.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

const normalizeReading = (reading) => {
  if (!reading) return reading;
  const metricMap = [
    { field: "ph_value", alias: "ph" },
    { field: "ec_value", alias: "ec" },
    { field: "tds_value", alias: "tds" },
    { field: "water_temperature_c", alias: "temperature_water_c" },
    { field: "air_temperature_c", alias: "temperature_air_c" },
    { field: "air_humidity", alias: "humidity" },
    { field: "light_intensity", alias: "light_intensity" },
  ];

  metricMap.forEach(({ field, alias }) => {
    if (reading[field] !== undefined) {
      reading[alias] = { value: reading[field], status: "normal" };
    }
  });

  reading.timestamp = reading.created_at;
  return reading;
};

router.use(authenticate);

router.get("/dashboard", async (req, res) => {
  try {
    const devices = await Device.find({ user_id: req.user._id });
    const deviceIds = devices.map((d) => d.device_id);

    const latestReadings = await SensorData.aggregate([
      { $match: { device_id: { $in: deviceIds } } },
      { $sort: { created_at: -1 } },
      {
        $group: {
          _id: "$device_id",
          latest: { $first: "$$ROOT" },
        },
      },
    ]);

    res.json({
      totalDevices: devices.length,
      activeDevices: devices.filter((d) => d.status === "active").length,
      latestReadings: latestReadings.map((r) => normalizeReading(r.latest)),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Admin stats endpoint - system-wide statistics
router.get("/admin/stats", async (req, res) => {
  try {
    // Log authentication status for debugging
    console.log("Admin stats request:", {
      userId: req.user?._id,
      userRole: req.user?.role,
      userName: req.user?.user_name,
    });

    // Check if user exists
    if (!req.user) {
      console.error("No user found in request");
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Check if user is admin
    if (req.user.role !== "admin") {
      console.warn(
        `Access denied for user ${req.user.user_name} with role ${req.user.role}`,
      );
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin only.",
      });
    }

    const User = (await import("../models/User.js")).default;
    const Farm = (await import("../models/Farm.js")).default;
    const Alert = (await import("../models/Alert.js")).default;

    // Get counts
    const totalUsers = await User.countDocuments();
    const totalFarms = await Farm.countDocuments();
    const totalDevices = await Device.countDocuments();
    const activeAlerts = await Alert.countDocuments({ is_resolved: false });

    // Get last sensor data with device and farm info
    const lastSensorData = await SensorData.find()
      .sort({ created_at: -1 })
      .limit(10)
      .populate({
        path: "device_id",
        select: "device_name farm_id",
        populate: {
          path: "farm_id",
          select: "farm_name",
        },
      });

    // Get device activity status
    const deviceActivity = await Device.aggregate([
      {
        $lookup: {
          from: "sensordatas",
          localField: "device_id",
          foreignField: "device_id",
          as: "readings",
        },
      },
      {
        $project: {
          device_id: 1,
          device_name: 1,
          farm_id: 1,
          lastReading: { $max: "$readings.created_at" },
        },
      },
      { $sort: { lastReading: -1 } },
      { $limit: 20 },
    ]).exec();

    // Populate farm names for device activity
    const populatedDeviceActivity = await Device.populate(deviceActivity, {
      path: "farm_id",
      select: "farm_name",
    });

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalFarms,
        totalDevices,
        activeAlerts,
      },
      lastSensorData: lastSensorData.map((data) => ({
        device_id: data.device_id?.device_id,
        device_name: data.device_id?.device_name,
        farm_name: data.device_id?.farm_id?.farm_name,
        timestamp: data.created_at,
      })),
      deviceActivity: populatedDeviceActivity.map((device) => ({
        device_id: device.device_id,
        device_name: device.device_name,
        farm_name: device.farm_id?.farm_name,
        lastReading: device.lastReading,
      })),
    });
  } catch (error) {
    console.error("Error fetching admin stats:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
