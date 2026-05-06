import express from "express";
import mongoose from "mongoose";
import crypto from "crypto";
import SensorData from "../models/SensorData.js";
import Device from "../models/Device.js";
import Alert from "../models/Alert.js";
import DeviceConfiguration from "../models/DeviceConfiguration.js";
import SystemLog from "../models/SystemLog.js";
import { authenticate } from "../middleware/auth.js";
import { broadcastToDevice, broadcastToUser } from "../server.js";

const router = express.Router();


const attachVirtualMetrics = (reading) => {
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
    if (reading[field] !== undefined && reading[field] !== null) {
      let val = Number(reading[field]);
      if (alias === 'ec' && !isNaN(val) && val > 20) {
        val = val / 1000;
      }
      reading[alias] = { value: val, status: "normal" };
    }
  });

  reading.timestamp = reading.timestamp || reading.created_at;
  return reading;
};

const buildAlert = (device, dataId, parameter, readingValue, min, max) => {
  if (min === undefined && max === undefined) return null;
  let alertType = `${parameter}_normal`;
  let threshold = null;

  if (min !== undefined && readingValue < min) {
    alertType = `${parameter}_low`;
    threshold = min;
  } else if (max !== undefined && readingValue > max) {
    alertType = `${parameter}_high`;
    threshold = max;
  } else {
    return null;
  }

  return {
    device_id: device.device_id,
    data_id: dataId,
    user_id: device.user_id,
    alert_type: alertType,
    parameter,
    threshold_value: threshold,
    actual_value: readingValue,
    message: `${parameter} measured ${readingValue} while threshold is ${threshold}`,
    severity: "caution",
  };
};

const checkThresholds = async (device, config, sensorPayload) => {
  if (!config?.alert_enabled) return;

  const parameterMap = [
    { key: "ph_value", min: config.ph_min, max: config.ph_max },
    { key: "ec_value", min: config.ec_value_min, max: config.ec_value_max },
    {
      key: "light_intensity",
      min: config.light_intensity_min,
      max: config.light_intensity_max,
    },
    {
      key: "air_temperature_c",
      min: config.air_temp_min,
      max: config.air_temp_max,
    },
    {
      key: "water_temperature_c",
      min: config.water_temp_min,
      max: config.water_temp_max,
    },
    {
      key: "air_humidity",
      min: config.air_humidity_min,
      max: config.air_humidity_max,
    },
  ];

  for (const { key, min, max } of parameterMap) {
    const value = sensorPayload[key];
    if (value === undefined) continue;

    const alertData = buildAlert(
      device,
      sensorPayload.data_id,
      key,
      value,
      min,
      max
    );
    if (!alertData) continue;

    const existingAlert = await Alert.findOne({
      device_id: alertData.device_id,
      parameter: alertData.parameter,
      status: "active",
    });

    if (existingAlert) {
      continue;
    }

    const alert = await Alert.create(alertData);
    device.latest_alert_id = alert._id;
    await device.save();

    // Broadcast to the device owner so the toast fires on any page,
    // not just when the client happens to be subscribed to this device.
    broadcastToUser(device.user_id, {
      type: "alert",
      data: alert,
    });
  }
};

router.post("/", async (req, res) => {
  try {
    const device = await Device.findOne({ device_id: req.body.device_id });
    if (!device) {
      return res
        .status(404)
        .json({ success: false, message: "Device not found" });
    }

    const config = await DeviceConfiguration.findById(device.config_id);

    const parseValue = (value) => {
      if (value === null || value === undefined) return undefined;
      if (typeof value === "object" && "value" in value)
        return Number(value.value);
      return Number(value);
    };

    const phValue = parseValue(req.body.ph_value ?? req.body.ph);
    let ecValue = parseValue(req.body.ec_value ?? req.body.ec);
    const tdsValueInput = parseValue(req.body.tds_value ?? req.body.tds);
    
    // Automatically convert EC from µS/cm to mS/cm if value is large
    if (ecValue > 20) {
      ecValue = ecValue / 1000;
    }

    const waterTemp = parseValue(
      req.body.water_temperature_c ?? req.body.temperature_water_c
    );
    const airTemp = parseValue(
      req.body.air_temperature_c ?? req.body.temperature_air_c
    );
    const light = parseValue(req.body.light_intensity);
    const airHumidity = parseValue(req.body.air_humidity);

    const sensorPayload = {
      device_id: device.device_id,
      data_id: crypto.randomUUID(),
      timestamp: req.body.timestamp,
      ph_value: phValue,
      ec_value: ecValue,
      tds_value:
        tdsValueInput ??
        (ecValue ? Number((ecValue * 640).toFixed(2)) : undefined),
      water_temperature_c: waterTemp,
      air_temperature_c: airTemp,
      air_humidity: airHumidity,
      light_intensity: light,
    };

    const requiredFields = [
      "ph_value",
      "ec_value",
      "tds_value",
      "water_temperature_c",
      "air_temperature_c",
      "light_intensity",
    ];
    const missingField = requiredFields.find(
      (field) =>
        sensorPayload[field] === undefined || Number.isNaN(sensorPayload[field])
    );

    if (missingField) {
      return res
        .status(400)
        .json({
          success: false,
          message: "All sensor parameters are required",
        });
    }



    const reading = await SensorData.create(sensorPayload);

    await checkThresholds(device, config, reading);

    device.last_activity = new Date();
    await device.save();

    await SystemLog.create({
      device_id: device._id,
      config_id: config?._id,
      log_type: "INFO",
      event: "SENSOR_READING",
      message: `Sensor data recorded with data_id ${reading.data_id}`,
    });

    broadcastToDevice(device.device_id, {
      type: "sensorReading",
      data: reading,
    });

    res.status(201).json({ success: true, data: reading });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.use(authenticate);

// Get activity log
router.get("/activity", async (req, res) => {
  try {
    const { filter = "all", sensor, page = 1, limit = 20, device_id, startDate, endDate } = req.query;

    const deviceQuery = { };
    if (req.user.role !== "admin") {
      deviceQuery.user_id = req.user._id;
    }
    
    const devices = await Device.find(deviceQuery).lean();
    let deviceIds = devices.map((d) => d.device_id);
    const deviceMap = devices.reduce((acc, d) => {
      acc[d.device_id] = d;
      return acc;
    }, {});

    // Filter by specific device
    if (device_id) {
      deviceIds = deviceIds.filter(id => id === device_id);
    }

    const query = { device_id: { $in: deviceIds } };

    if (filter !== "all") {
      query.quality_flag = filter === "abnormal" ? { $in: ["suspect", "error"] } : "valid";
    }
    if (sensor) {
      query[sensor] = { $exists: true, $ne: null };
    }

    // Date range filtering
    if (startDate || endDate) {
      query.created_at = {};
      if (startDate) query.created_at.$gte = new Date(startDate);
      if (endDate) query.created_at.$lte = new Date(endDate);
    }

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const skip = (pageNum - 1) * limitNum;

    const [total, data] = await Promise.all([
      SensorData.countDocuments(query),
      SensorData.find(query)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limitNum)
    ]);

    const mappedData = data.map(doc => {
      const reading = doc.toObject({ virtuals: true });
      const device = deviceMap[reading.device_id];
      return {
        ...attachVirtualMetrics(reading),
        device_name: device ? device.device_name : "Unknown Device",
        farm_id: device ? device.farm_id : null
      };
    });

    res.json({
      success: true,
      data: mappedData,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.max(1, Math.ceil(total / limitNum))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get latest readings
router.get("/latest", async (req, res) => {
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
      { $replaceRoot: { newRoot: "$latest" } },
    ]);

    res.json(latestReadings.map(attachVirtualMetrics));
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get latest reading for specific device
router.get("/:deviceId/latest", async (req, res) => {
  try {
    const device = await Device.findOne({
      device_id: req.params.deviceId,
      user_id: req.user._id,
    });

    if (!device) {
      return res
        .status(404)
        .json({ success: false, message: "Device not found" });
    }

    const latest = await SensorData.findOne({
      device_id: req.params.deviceId,
    }).sort({ created_at: -1 });

    if (!latest) {
      return res
        .status(404)
        .json({ success: false, message: "No readings found" });
    }

    res.json(attachVirtualMetrics(latest.toObject({ virtuals: true })));
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get historical data — server-side time-bucketed for chart-friendly output.
// Returns ~TARGET_POINTS evenly-spaced buckets averaging each sensor metric
// across the requested window so 5d/7d/30d/all charts render the full span
// rather than a 500-row tail near "now".
const HISTORY_RANGE_MS = {
  "1h":  60 * 60 * 1000,
  "4h":  4 * 60 * 60 * 1000,
  "12h": 12 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "5d":  5 * 24 * 60 * 60 * 1000,
  "7d":  7 * 24 * 60 * 60 * 1000,
  "15d": 15 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  "1y":  365 * 24 * 60 * 60 * 1000,
};
const HISTORY_TARGET_POINTS = 60;
const MIN_BUCKET_MS = 60 * 1000; // 1-minute floor

router.get("/:deviceId/history", async (req, res) => {
  try {
    const { range, startDate, endDate } = req.query;
    const deviceIdParam = req.params.deviceId.toUpperCase();
    const deviceQuery = { $or: [{ device_id: deviceIdParam }] };
    if (mongoose.Types.ObjectId.isValid(deviceIdParam)) {
      deviceQuery.$or.push({ _id: deviceIdParam });
    }
    if (req.user.role !== "admin") {
      deviceQuery.user_id = req.user._id;
    }
    const device = await Device.findOne(deviceQuery);

    if (!device) {
      return res.status(404).json({ success: false, message: "Device not found" });
    }

    const baseQuery = { device_id: device.device_id };
    let bucketMs = null;
    let spanMs = null;

    if (range && range !== "all" && HISTORY_RANGE_MS[range]) {
      spanMs = HISTORY_RANGE_MS[range];
      baseQuery.created_at = { $gte: new Date(Date.now() - spanMs) };
      if (endDate) baseQuery.created_at.$lte = new Date(endDate);
    } else if (range === "all") {
      // Span = (oldest reading) → now, so the chart covers the whole device history.
      const [bounds] = await SensorData.aggregate([
        { $match: { device_id: device.device_id } },
        { $group: { _id: null, min: { $min: "$created_at" }, max: { $max: "$created_at" } } },
      ]);
      if (bounds?.min && bounds?.max) {
        spanMs = new Date(bounds.max).getTime() - new Date(bounds.min).getTime();
      }
    } else if (startDate) {
      const startMs = new Date(startDate).getTime();
      const endMs = endDate ? new Date(endDate).getTime() : Date.now();
      baseQuery.created_at = { $gte: new Date(startMs) };
      if (endDate) baseQuery.created_at.$lte = new Date(endMs);
      spanMs = endMs - startMs;
    }

    if (spanMs && spanMs > 0) {
      bucketMs = Math.max(MIN_BUCKET_MS, Math.ceil(spanMs / HISTORY_TARGET_POINTS));
    }

    // No range info → fall back to a small recent slice so non-chart callers
    // still get something sensible.
    if (!bucketMs) {
      const limitNum = parseInt(req.query.limit) || 100;
      const data = await SensorData.find(baseQuery)
        .sort({ created_at: -1 })
        .limit(limitNum);
      return res.json({
        success: true,
        data: data.map((doc) => attachVirtualMetrics(doc.toObject({ virtuals: true }))),
        pagination: { total: data.length, page: 1, limit: limitNum, pages: 1 },
      });
    }

    const halfBucket = Math.floor(bucketMs / 2);
    const buckets = await SensorData.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: {
            $subtract: [
              { $toLong: "$created_at" },
              { $mod: [{ $toLong: "$created_at" }, bucketMs] },
            ],
          },
          ph_value: { $avg: "$ph_value" },
          ec_value: { $avg: "$ec_value" },
          tds_value: { $avg: "$tds_value" },
          water_temperature_c: { $avg: "$water_temperature_c" },
          air_temperature_c: { $avg: "$air_temperature_c" },
          air_humidity: { $avg: "$air_humidity" },
          light_intensity: { $avg: "$light_intensity" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          // Place point at bucket midpoint so it visually sits where the
          // averaged data actually lives.
          created_at: { $toDate: { $add: ["$_id", halfBucket] } },
          timestamp: { $toDate: { $add: ["$_id", halfBucket] } },
          ph_value: 1,
          ec_value: 1,
          tds_value: 1,
          water_temperature_c: 1,
          air_temperature_c: 1,
          air_humidity: 1,
          light_intensity: 1,
          count: 1,
        },
      },
    ]);

    const mapped = buckets.map(attachVirtualMetrics);

    res.json({
      success: true,
      data: mapped,
      pagination: { total: mapped.length, page: 1, limit: mapped.length, pages: 1 },
      meta: { range: range || null, bucketMs, points: mapped.length, spanMs },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get aggregated data
router.get("/:deviceId/aggregate", async (req, res) => {
  try {
    const { aggregation = "hourly" } = req.query;
    const device = await Device.findOne({
      device_id: req.params.deviceId,
      user_id: req.user._id,
    });

    if (!device) {
      return res
        .status(404)
        .json({ success: false, message: "Device not found" });
    }

    // Aggregation logic here
    res.json({ message: "Aggregation not yet implemented" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
