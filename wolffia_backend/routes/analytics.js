import mongoose from "mongoose";
import express from "express";
import SensorData from "../models/SensorData.js";
import Device from "../models/Device.js";
import User from "../models/User.js";
import Farm from "../models/Farm.js";
import Alert from "../models/Alert.js";
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

    // Get counts (exclude deleted items)
    const query = { is_deleted: { $ne: true } };
    
    // DEBUG LOGS
    console.log("[ADMIN_STATS] Fetching counts for database:", mongoose.connection.name);
    
    const [totalUsers, totalFarms, totalDevices, activeAlertsCount, activeDevicesCount] = await Promise.all([
      User.countDocuments(query),
      Farm.countDocuments(query),
      Device.countDocuments(query),
      Alert.countDocuments({ status: { $ne: "resolved" } }),
      Device.countDocuments({ ...query, status: "active" })
    ]);

    const db = mongoose.connection.db;
    const [uRaw, fRaw, dRaw] = await Promise.all([
      db.collection('users').countDocuments(query),
      db.collection('farms').countDocuments(query),
      db.collection('devices').countDocuments(query)
    ]);

    console.log("[ADMIN_STATS] Found counts:", { 
      dbName: db.databaseName,
      mongoose: { totalUsers, totalFarms, totalDevices, activeAlertsCount },
      raw: { uRaw, fRaw, dRaw }
    });

    const finalUsers = totalUsers || uRaw;
    const finalFarms = totalFarms || fRaw;
    const finalDevices = totalDevices || dRaw;

    // Get last sensor data
    const rawSensorData = await SensorData.find()
      .sort({ created_at: -1 })
      .limit(10);
    
    console.log("[ADMIN_STATS] rawSensorData count:", rawSensorData.length);

    const deviceIdsInData = [...new Set(rawSensorData.map(d => d.device_id))];
    const devices = await Device.find({ device_id: { $in: deviceIdsInData } }).populate("farm_id");
    const deviceMap = devices.reduce((map, d) => {
      map[d.device_id] = d;
      return map;
    }, {});

    const lastSensorData = rawSensorData.map(data => {
      const device = deviceMap[data.device_id];
      return {
        device_id: data.device_id,
        device_name: device?.device_name || "Unknown Device",
        farm_name: device?.farm_id?.farm_name || "Unknown Farm",
        timestamp: data.created_at,
      };
    });

    // Get device activity status
    const deviceActivity = await Device.aggregate([
      { $match: { is_deleted: { $ne: true } } },
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
        totalUsers: finalUsers,
        totalFarms: finalFarms,
        totalDevices: finalDevices,
        activeAlerts: activeAlertsCount,
        activeDevices: activeDevicesCount,
        inactiveDevices: Math.max(0, finalDevices - activeDevicesCount),
        recentSensorEvents: rawSensorData.length,
      },
      lastSensorData,
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
