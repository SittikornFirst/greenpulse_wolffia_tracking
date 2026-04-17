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

// Min-Max per sensor endpoint
router.get("/min-max/:deviceId", async (req, res) => {
  try {
    const { range, startDate, endDate } = req.query;
    const deviceQuery = { device_id: req.params.deviceId };

    if (req.user.role !== "admin") {
      deviceQuery.user_id = req.user._id;
    }

    const device = await Device.findOne(deviceQuery);
    if (!device) {
      return res.status(404).json({ success: false, message: "Device not found" });
    }

    let startTime;
    if (range && range !== "all") {
      const now = new Date();
      const ranges = {
        "1h": 60 * 60 * 1000,
        "6h": 6 * 60 * 60 * 1000,
        "24h": 24 * 60 * 60 * 1000,
        "7d": 7 * 24 * 60 * 60 * 1000,
        "30d": 30 * 24 * 60 * 60 * 1000,
        "1y": 365 * 24 * 60 * 60 * 1000,
      };
      if (ranges[range]) {
        startTime = new Date(now - ranges[range]);
      }
    } else if (startDate) {
      startTime = new Date(startDate);
    }

    const matchQuery = { device_id: device.device_id };
    if (startTime) matchQuery.created_at = { $gte: startTime };
    if (endDate) {
      matchQuery.created_at = { ...matchQuery.created_at, $lte: new Date(endDate) };
    }

    const stats = await SensorData.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          ph_min: { $min: "$ph_value" },
          ph_max: { $max: "$ph_value" },
          ph_avg: { $avg: "$ph_value" },
          ec_min: { $min: "$ec_value" },
          ec_max: { $max: "$ec_value" },
          ec_avg: { $avg: "$ec_value" },
          water_temp_min: { $min: "$water_temperature_c" },
          water_temp_max: { $max: "$water_temperature_c" },
          water_temp_avg: { $avg: "$water_temperature_c" },
          air_temp_min: { $min: "$air_temperature_c" },
          air_temp_max: { $max: "$air_temperature_c" },
          air_temp_avg: { $avg: "$air_temperature_c" },
          light_min: { $min: "$light_intensity" },
          light_max: { $max: "$light_intensity" },
          light_avg: { $avg: "$light_intensity" },
        }
      }
    ]);

    const result = stats.length > 0 ? stats[0] : {
      count: 0,
      ph_min: null, ph_max: null, ph_avg: null,
      ec_min: null, ec_max: null, ec_avg: null,
      water_temp_min: null, water_temp_max: null, water_temp_avg: null,
      air_temp_min: null, air_temp_max: null, air_temp_avg: null,
      light_min: null, light_max: null, light_avg: null,
    };
    
    delete result._id;

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
