import express from 'express';
import SensorData from '../models/SensorData.js';
import Device from '../models/Device.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

const normalizeReading = (reading) => {
    if (!reading) return reading;
    const metricMap = [
        { field: 'ph_value', alias: 'ph' },
        { field: 'ec_value', alias: 'ec' },
        { field: 'tds_value', alias: 'tds' },
        { field: 'water_temperature_c', alias: 'temperature_water_c' },
        { field: 'air_temperature_c', alias: 'temperature_air_c' },
        { field: 'light_intensity', alias: 'light_intensity' }
    ];

    metricMap.forEach(({ field, alias }) => {
        if (reading[field] !== undefined) {
            reading[alias] = { value: reading[field], status: 'normal' };
        }
    });

    reading.timestamp = reading.created_at;
    return reading;
};

router.use(authenticate);

router.get('/dashboard', async (req, res) => {
    try {
        const devices = await Device.find({ user_id: req.user._id });
        const deviceIds = devices.map(d => d.device_id);

        const latestReadings = await SensorData.aggregate([
            { $match: { device_id: { $in: deviceIds } } },
            { $sort: { created_at: -1 } },
            {
                $group: {
                    _id: '$device_id',
                    latest: { $first: '$$ROOT' }
                }
            }
        ]);

        res.json({
            totalDevices: devices.length,
            activeDevices: devices.filter(d => d.status === 'active').length,
            latestReadings: latestReadings.map(r => normalizeReading(r.latest))
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;