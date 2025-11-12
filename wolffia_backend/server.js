import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import authRoutes from './routes/auth.js';
import deviceRoutes from './routes/devices.js';
import sensorDataRoutes from './routes/sensorData.js';
import alertRoutes from './routes/alerts.js';
import farmRoutes from './routes/farms.js';
import analyticsRoutes from './routes/analytics.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/greenpulse_v1';

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/sensor-data', sensorDataRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/farms', farmRoutes);
app.use('/api/analytics', analyticsRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error'
    });
});

// Create HTTP server
const server = createServer(app);

// WebSocket Server
const wss = new WebSocketServer({ server, path: '/ws' });
const clients = new Map();

wss.on('connection', (ws, req) => {
    const clientId = Math.random().toString(36).substring(7);
    clients.set(clientId, ws);
    console.log(`WebSocket client connected: ${clientId}`);

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('Received:', data);

            // Handle subscription messages
            if (data.type === 'subscribe' && data.deviceId) {
                ws.deviceId = data.deviceId;
            }
        } catch (error) {
            console.error('WebSocket message error:', error);
        }
    });

    ws.on('close', () => {
        clients.delete(clientId);
        console.log(`WebSocket client disconnected: ${clientId}`);
    });

    ws.on('error', (error) => {``
        console.error('WebSocket error:', error);
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

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
    .then(() => {
        console.log('✅ Connected to MongoDB');
        server.listen(PORT, () => {
            console.log(`🚀 Server running on http://localhost:${PORT}`);
            console.log(`📡 WebSocket server running on ws://localhost:${PORT}/ws`);
        });
    })
    .catch((error) => {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    });