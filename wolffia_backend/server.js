import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
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
import systemLogRoutes from "./routes/systemLogs.js";

import rateLimit from "express-rate-limit";
import Device from "./models/Device.js";


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
app.use("/api/system-logs", systemLogRoutes);

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

// Helper for formatted websocket logging
const getWsTimestamp = () => {
  const d = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};
const wsLog = (level, message) => {
  console.log(`[${getWsTimestamp()}] ${level.padEnd(5)} - ${message}`);
};

// WebSocket Server
const wss = new WebSocketServer({ server, path: "/ws" });
const clients = new Map();

wss.on("connection", (ws, req) => {
  const clientId = Math.random().toString(36).substring(7);
  clients.set(clientId, ws);
  
  wsLog('INFO', `Handshake request: ws://${req.headers.host}${req.url}`);
  wsLog('INFO', `Handshake response: 101 Switching Protocols`);
  wsLog('INFO', `Channel Registered: [Client_ID: ${clientId}, IP: ${req.socket.remoteAddress}]`);

  ws.on("message", (message) => {
    wsLog('DEBUG', `Inbound Frame (Text): ${message}`);
    try {
      const data = JSON.parse(message);

      // Handle subscription messages
      if (data.type === "subscribe" && data.deviceId) {
        ws.deviceId = data.deviceId;
      }

      // Handle Authentication
      if (data.type === "auth" && data.data?.token) {
        try {
          const decoded = jwt.verify(data.data.token, process.env.JWT_SECRET);
          ws.userId = decoded.userId; // Store user ID on the connection
          wsLog('INFO', `WebSocket authenticated for User ID: ${ws.userId}`);
        } catch (err) {
          wsLog('ERROR', `WebSocket authentication failed: ${err.message}`);
        }
      }
    } catch (error) {
      console.error("WebSocket message error:", error);
    }
  });

  ws.on("close", () => {
    clients.delete(clientId);
    wsLog('INFO', `Channel Unregistered: [Client_ID: ${clientId}, Reason: Closed]`);
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
      const payload = JSON.stringify(data);
      wsLog('DEBUG', `Outbound Frame (Text): ${payload}`);
      client.send(payload);
    }
  });
};

// Broadcast to a specific User (Global Alert)
export const broadcastToUser = (userId, data) => {
  if (!userId) return;
  clients.forEach((client) => {
    if (client.readyState === 1 && client.userId === userId.toString()) {
      const payload = JSON.stringify(data);
      wsLog('DEBUG', `Outbound Frame (Text): ${payload}`);
      client.send(payload);
    }
  });
};

const dropLegacyDeviceFarmUniqueIndex = async () => {
  try {
    const indexes = await Device.collection.indexes();
    const legacyFarmIndex = indexes.find(
      (index) => index.unique && index.key && index.key.farm_id === 1,
    );

    if (!legacyFarmIndex) {
      return;
    }

    await Device.collection.dropIndex(legacyFarmIndex.name);
    console.log(
      `Dropped legacy unique device farm index: ${legacyFarmIndex.name}`,
    );
  } catch (error) {
    console.error("Failed to drop legacy device farm index:", error.message);
  }
};

// Connect to MongoDB
mongoose
  .connect(MONGODB_URI)
  .then(async () => {
    console.log("✅ Connected to MongoDB");
    await dropLegacyDeviceFarmUniqueIndex();
    server.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📡 WebSocket server running on ws://localhost:${PORT}/ws`);
    });
  })
  .catch((error) => {
    console.error("❌ MongoDB connection error:", error);
    process.exit(1);
  });

