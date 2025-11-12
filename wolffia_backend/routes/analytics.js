import express from 'express';
import SensorData from '../models/SensorData.js';
import Device from '../models/Device.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

// Dashboard summary
router.get('/dashboard', async (req, res) => {
    try {
        const devices = await Device.find({ user_id: req.user._id });
        const deviceIds = devices.map(d => d.device_id);

        // Get latest readings for all devices
        const latestReadings = await SensorData.aggregate([
            { $match: { device_id: { $in: deviceIds } } },
            { $sort: { timestamp: -1 } },
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
            latestReadings: latestReadings.map(r => r.latest)
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;