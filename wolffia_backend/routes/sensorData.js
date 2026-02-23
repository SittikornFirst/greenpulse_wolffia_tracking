import express from "express";
import crypto from "crypto";
import SensorData from "../models/SensorData.js";
import Device from "../models/Device.js";
import Alert from "../models/Alert.js";
import DeviceConfiguration from "../models/DeviceConfiguration.js";
import SystemLog from "../models/SystemLog.js";
import { authenticate } from "../middleware/auth.js";
import { broadcastToDevice } from "../server.js";

const router = express.Router();

const getQualityFlag = (reading) => {
  const inRange = (value, min, max) => value >= min && value <= max;
  const ranges = {
    ph_value: [6.0, 7.5],
    ec_value: [1.0, 2.5],
    water_temperature_c: [20, 28],
    air_temperature_c: [18, 35],
    light_intensity: [3500, 6000],
  };

  const outOfRange = Object.entries(ranges).some(([key, [min, max]]) => {
    const value = reading[key];
    return typeof value === "number" && !inRange(value, min, max);
  });

  return outOfRange ? "suspect" : "valid";
};

const attachVirtualMetrics = (reading) => {
  if (!reading) return reading;
  const metricMap = [
    { field: "ph_value", alias: "ph" },
    { field: "ec_value", alias: "ec" },
    { field: "tds_value", alias: "tds" },
    { field: "water_temperature_c", alias: "temperature_water_c" },
    { field: "air_temperature_c", alias: "temperature_air_c" },
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

    broadcastToDevice(device.device_id, {
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
    const ecValue = parseValue(req.body.ec_value ?? req.body.ec);
    const tdsValueInput = parseValue(req.body.tds_value ?? req.body.tds);
    const waterTemp = parseValue(
      req.body.water_temperature_c ?? req.body.temperature_water_c
    );
    const airTemp = parseValue(
      req.body.air_temperature_c ?? req.body.temperature_air_c
    );
    const light = parseValue(req.body.light_intensity);

    const sensorPayload = {
      device_id: device.device_id,
      data_id: crypto.randomUUID(),
      ph_value: phValue,
      ec_value: ecValue,
      tds_value:
        tdsValueInput ??
        (ecValue ? Number((ecValue * 0.64).toFixed(2)) : undefined),
      water_temperature_c: waterTemp,
      air_temperature_c: airTemp,
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

    sensorPayload.quality_flag = getQualityFlag(sensorPayload);

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

// Get historical data
router.get("/:deviceId/history", async (req, res) => {
  try {
    const { range, startDate, endDate, limit = 100 } = req.query;
    const device = await Device.findOne({
      device_id: req.params.deviceId,
      user_id: req.user._id,
    });

    if (!device) {
      return res
        .status(404)
        .json({ success: false, message: "Device not found" });
    }

    let startTime;
    if (range) {
      const now = new Date();
      const ranges = {
        "1h": 60 * 60 * 1000,
        "24h": 24 * 60 * 60 * 1000,
        "7d": 7 * 24 * 60 * 60 * 1000,
        "30d": 30 * 24 * 60 * 60 * 1000,
      };
      startTime = new Date(now - ranges[range]);
    } else if (startDate) {
      startTime = new Date(startDate);
    }

    const query = { device_id: req.params.deviceId };
    if (startTime) query.created_at = { $gte: startTime };
    if (endDate) {
      query.created_at = { ...query.created_at, $lte: new Date(endDate) };
    }

    const data = await SensorData.find(query)
      .sort({ created_at: -1 })
      .limit(parseInt(limit));

    res.json(
      data.map((doc) => attachVirtualMetrics(doc.toObject({ virtuals: true })))
    );
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
