import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import mqtt from "mqtt";
import helmet from "helmet";
import jwt from "jsonwebtoken";
import dns from "dns";

import { createServer } from "http";
import { WebSocketServer } from "ws";
import authRoutes from "./routes/auth.js";
import deviceRoutes from "./routes/devices.js";
import sensorDataRoutes from "./routes/sensorData.js";
import alertRoutes from "./routes/alerts.js";
import farmRoutes from "./routes/farms.js";
import analyticsRoutes from "./routes/analytics.js";
import userRoutes from "./routes/users.js";

import rateLimit from "express-rate-limit";
import SensorData from "./models/SensorData.js";
import Device from "./models/Device.js";
import Alert from "./models/Alert.js";
import DeviceConfiguration from "./models/DeviceConfiguration.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

dns.setServers(["1.1.1.1"]);

// Middleware
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Security Middleware
app.use(helmet());
// app.use(mongoSanitize()); // Disabled due to Express 5 incompatibility
// app.use(xss()); // Disabled due to Express 5 incompatibility
// app.use(hpp()); // Disabled due to Express 5 incompatibility

const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 mins
  max: 10000000,
});
app.use("/api", limiter);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/devices", deviceRoutes);
app.use("/api/sensor-data", sensorDataRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/farms", farmRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/users", userRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
  });
});

// Create HTTP server
const server = createServer(app);

// WebSocket Server
const wss = new WebSocketServer({ server, path: "/ws" });
const clients = new Map();

wss.on("connection", (ws, req) => {
  const clientId = Math.random().toString(36).substring(7);
  clients.set(clientId, ws);
  console.log(`WebSocket client connected: ${clientId}`);

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      console.log("Received:", data);

      // Handle subscription messages
      if (data.type === "subscribe" && data.deviceId) {
        ws.deviceId = data.deviceId;
      }

      // Handle Authentication
      if (data.type === "auth" && data.data?.token) {
        try {
          const decoded = jwt.verify(data.data.token, process.env.JWT_SECRET);
          ws.userId = decoded.userId; // Store user ID on the connection
          console.log(`✅ WebSocket authenticated for User ID: ${ws.userId}`);
        } catch (err) {
          console.error("❌ WebSocket authentication failed:", err.message);
        }
      }
    } catch (error) {
      console.error("WebSocket message error:", error);
    }
  });

  ws.on("close", () => {
    clients.delete(clientId);
    console.log(`WebSocket client disconnected: ${clientId}`);
  });

  ws.on("error", (error) => {
    ``;
    console.error("WebSocket error:", error);
  });
});

// Broadcast function for WebSocket
export const broadcastToDevice = (deviceId, data) => {
  clients.forEach((client, id) => {
    if (client.readyState === 1 && client.deviceId === deviceId) {
      client.send(JSON.stringify(data));
    }
  });
};

// Broadcast to a specific User (Global Alert)
export const broadcastToUser = (userId, data) => {
  if (!userId) return;
  clients.forEach((client) => {
    if (client.readyState === 1 && client.userId === userId.toString()) {
      client.send(JSON.stringify(data));
    }
  });
};

// Connect to MongoDB
mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log("✅ Connected to MongoDB");
    server.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📡 WebSocket server running on ws://localhost:${PORT}/ws`);
    });
  })
  .catch((error) => {
    console.error("❌ MongoDB connection error:", error);
    process.exit(1);
  });

// MQTT Client Setup
const mqttUrl = process.env.MQTT_BROKER_URL || "mqtt://localhost:1883";
const mqttClient = mqtt.connect(mqttUrl);

mqttClient.on("connect", () => {
  console.log("✅ Connected to MQTT broker:", mqttUrl);
  mqttClient.subscribe("devices/+/sensor", { qos: 1 });
});

mqttClient.on("message", async (topic, payload) => {
  try {
    const topicParts = topic.split("/");
    const deviceIdFromTopic = topicParts[1]; // devices/:id/sensor

    const data = JSON.parse(payload.toString());
    console.log(`📡 MQTT Message from ${deviceIdFromTopic}:`, data);

    // Find device references
    const device = await Device.findOne({ device_id: deviceIdFromTopic });
    if (!device) {
      console.warn(`⚠️ Received data for unknown device: ${deviceIdFromTopic}`);
      return;
    }

    // Save Sensor Data
    const newSensorData = new SensorData({
      device_id: device._id, // Use MongoDB _id
      ph_value: data.ph,
      ec_value: data.ec,
      tds_value: data.tds,
      water_temperature_c: data.water_temp,
      air_temperature_c: data.air_temp,
      air_humidity: data.humidity, // Added based on .ino
      light_intensity: data.light,
      timestamp: new Date(),
    });

    await newSensorData.save();
    console.log("💾 Sensor data saved");

    // Broadcast to WebSocket clients
    // broadcastToDevice(deviceIdFromTopic, { type: 'sensor_update', data: newSensorData });

    // Check for Alerts
    if (device.config_id) {
      const config = await DeviceConfiguration.findById(device.config_id);

      if (config && config.alert_enabled) {
        const checkThreshold = async (param, value, min, max, unit) => {
          if (value < min || value > max) {
            const alertType = "caution"; // Only 'caution' as per simplified requirements
            const message = `${param} is ${value} ${unit} (Range: ${min}-${max})`;

            // Check if recent alert exists to prevent spamming
            const recentAlert = await Alert.findOne({
              device_id: device._id,
              parameter: param,
              status: { $ne: "resolved" },
              created_at: { $gt: new Date(Date.now() - 15 * 60 * 1000) }, // 15 min cooldown
            });

            if (!recentAlert) {
              const newAlert = new Alert({
                device_id: device._id,
                user_id: device.user_id, // Ensure device has user_id populated or fetched
                farm_id: device.farm_id,
                type: alertType,
                severity: "caution",
                message: message,
                parameter: param,
                value: value,
                threshold_min: min,
                threshold_max: max,
              });
              await newAlert.save();
              console.log(`⚠️ New Alert Created: ${message}`);

              // Populate device details for frontend toast
              const alertToSend = {
                ...newAlert.toObject(),
                device_name: device.device_name,
                device: device._id,
              };

              broadcastToUser(device.user_id, {
                type: "alert",
                data: alertToSend,
              });
            }
          }
        };

        // Check each parameter
        if (data.ph !== undefined)
          await checkThreshold(
            "pH",
            data.ph,
            config.ph_min,
            config.ph_max,
            "pH",
          );
        if (data.water_temp !== undefined)
          await checkThreshold(
            "Water Temp",
            data.water_temp,
            config.water_temp_min,
            config.water_temp_max,
            "°C",
          );
        if (data.air_temp !== undefined)
          await checkThreshold(
            "Air Temp",
            data.air_temp,
            config.air_temp_min,
            config.air_temp_max,
            "°C",
          );
        if (data.ec !== undefined)
          await checkThreshold(
            "EC",
            data.ec,
            config.ec_value_min,
            config.ec_value_max,
            "mS/cm",
          );
        if (data.light !== undefined)
          await checkThreshold(
            "Light",
            data.light,
            config.light_intensity_min,
            config.light_intensity_max,
            "lux",
          );
      }
    }
  } catch (err) {
    console.error("❌ MQTT Message Error:", err);
  }
});
