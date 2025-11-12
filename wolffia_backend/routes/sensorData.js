import express from 'express';
import SensorData from '../models/SensorData.js';
import Device from '../models/Device.js';
import Alert from '../models/Alert.js';
// Remove auth middleware - make it optional
// import { authenticate } from '../middleware/auth.js';
import { broadcastToDevice } from '../server.js';

const router = express.Router();

// Helper function to calculate quality score
const calculateQualityScore = (data) => {
    let score = 100;

    if (data.error_flags?.sensor_error) score -= 30;
    if (data.error_flags?.communication_error) score -= 20;
    if (data.error_flags?.calibration_needed) score -= 10;

    if (data.metadata?.battery_level < 20) score -= 15;
    if (data.metadata?.signal_strength < 50) score -= 10;

    return Math.max(0, Math.min(100, score));
};

// Helper function to determine quality flag
const getQualityFlag = (score) => {
    if (score >= 90) return 'good';
    if (score >= 70) return 'acceptable';
    if (score >= 50) return 'questionable';
    return 'bad';
};

// Helper function to check thresholds and create alerts
const checkThresholds = async (device, sensorData) => {
    const alerts = [];
    const thresholds = device.thresholds || {};

    // Check pH
    if (sensorData.ph?.value !== undefined) {
        const phThreshold = thresholds.ph || { min: 6.0, max: 7.5 };
        if (sensorData.ph.value < phThreshold.min) {
            alerts.push({
                device_id: device.device_id,
                user_id: device.user_id,
                alert_type: 'ph_low',
                priority: sensorData.ph.value < 5.5 ? 'critical' : 'high',
                title: 'pH Level Too Low',
                message: `pH level is ${sensorData.ph.value}, below minimum threshold of ${phThreshold.min}`,
                sensor_reading: sensorData
            });
        } else if (sensorData.ph.value > phThreshold.max) {
            alerts.push({
                device_id: device.device_id,
                user_id: device.user_id,
                alert_type: 'ph_high',
                priority: sensorData.ph.value > 8.0 ? 'critical' : 'high',
                title: 'pH Level Too High',
                message: `pH level is ${sensorData.ph.value}, above maximum threshold of ${phThreshold.max}`,
                sensor_reading: sensorData
            });
        }
    }

    // Similar checks for EC, temperature, light...
    // (Add similar logic for other parameters)

    // Create alerts
    for (const alertData of alerts) {
        const existingAlert = await Alert.findOne({
            device_id: alertData.device_id,
            alert_type: alertData.alert_type,
            status: 'active'
        });

        if (!existingAlert) {
            const alert = new Alert(alertData);
            await alert.save();

            // Broadcast alert via WebSocket
            broadcastToDevice(device.device_id, {
                type: 'alert',
                data: alert
            });
        }
    }
};

// Submit sensor reading (from IoT device)
router.post('/', async (req, res) => {
    try {
        const { device_id, ph, ec, temperature_water_c, temperature_air_c, light_intensity, metadata } = req.body;

        const device = await Device.findOne({ device_id });
        if (!device) {
            return res.status(404).json({ success: false, message: 'Device not found' });
        }

        // Build sensor data object
        const sensorData = {
            device_id,
            ph: ph ? { value: ph.value || ph, status: 'normal' } : undefined,
            ec: ec ? { value: ec.value || ec, status: 'normal' } : undefined,
            temperature_water_c: temperature_water_c ? {
                value: temperature_water_c.value || temperature_water_c,
                status: 'normal'
            } : undefined,
            temperature_air_c: temperature_air_c ? {
                value: temperature_air_c.value || temperature_air_c,
                status: 'normal'
            } : undefined,
            light_intensity: light_intensity ? {
                value: light_intensity.value || light_intensity,
                status: 'normal'
            } : undefined,
            metadata: metadata || {},
            error_flags: {
                sensor_error: false,
                communication_error: false,
                calibration_needed: false
            }
        };

        // Calculate quality score
        const qualityScore = calculateQualityScore(sensorData);
        sensorData.quality_score = qualityScore;
        sensorData.quality_flag = getQualityFlag(qualityScore);

        // Check thresholds and create alerts
        await checkThresholds(device, sensorData);

        // Save sensor data
        const reading = new SensorData(sensorData);
        await reading.save();

        // Broadcast via WebSocket
        broadcastToDevice(device_id, {
            type: 'sensorReading',
            data: reading
        });

        res.status(201).json({
            success: true,
            data: reading
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get latest readings
router.get('/latest', async (req, res) => {
    try {
        const devices = await Device.find({ user_id: req.user._id });
        const deviceIds = devices.map(d => d.device_id);

        const latestReadings = await SensorData.aggregate([
            { $match: { device_id: { $in: deviceIds } } },
            { $sort: { timestamp: -1 } },
            {
                $group: {
                    _id: '$device_id',
                    latest: { $first: '$$ROOT' }
                }
            },
            { $replaceRoot: { newRoot: '$latest' } }
        ]);

        res.json(latestReadings);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get latest reading for specific device
router.get('/:deviceId/latest', async (req, res) => {
    try {
        const device = await Device.findOne({
            device_id: req.params.deviceId,
            user_id: req.user._id
        });

        if (!device) {
            return res.status(404).json({ success: false, message: 'Device not found' });
        }

        const latest = await SensorData.findOne({ device_id: req.params.deviceId })
            .sort({ timestamp: -1 });

        if (!latest) {
            return res.status(404).json({ success: false, message: 'No readings found' });
        }

        res.json(latest);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get historical data
router.get('/:deviceId/history', async (req, res) => {
    try {
        const { range, startDate, endDate, limit = 100 } = req.query;
        const device = await Device.findOne({
            device_id: req.params.deviceId,
            user_id: req.user._id
        });

        if (!device) {
            return res.status(404).json({ success: false, message: 'Device not found' });
        }

        let startTime;
        if (range) {
            const now = new Date();
            const ranges = {
                '1h': 60 * 60 * 1000,
                '24h': 24 * 60 * 60 * 1000,
                '7d': 7 * 24 * 60 * 60 * 1000,
                '30d': 30 * 24 * 60 * 60 * 1000
            };
            startTime = new Date(now - ranges[range]);
        } else if (startDate) {
            startTime = new Date(startDate);
        }

        const query = { device_id: req.params.deviceId };
        if (startTime) query.timestamp = { $gte: startTime };
        if (endDate) {
            query.timestamp = { ...query.timestamp, $lte: new Date(endDate) };
        }

        const data = await SensorData.find(query)
            .sort({ timestamp: -1 })
            .limit(parseInt(limit));

        res.json(data);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get aggregated data
router.get('/:deviceId/aggregate', async (req, res) => {
    try {
        const { aggregation = 'hourly' } = req.query;
        const device = await Device.findOne({
            device_id: req.params.deviceId,
            user_id: req.user._id
        });

        if (!device) {
            return res.status(404).json({ success: false, message: 'Device not found' });
        }

        // Aggregation logic here
        res.json({ message: 'Aggregation not yet implemented' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;