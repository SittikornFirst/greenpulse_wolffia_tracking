import express from 'express';
import Device from '../models/Device.js';
import Farm from '../models/Farm.js';

const router = express.Router();

// Optional auth middleware
const optionalAuth = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (token) {
            const jwt = await import('jsonwebtoken');
            const User = (await import('../models/User.js')).default;
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.userId);
            if (user && user.is_active) {
                req.user = user;
            }
        }
        next();
    } catch (error) {
        next();
    }
};

router.use(optionalAuth);

// Get all devices - no user filter
router.get('/', async (req, res) => {
    try {
        const { farmId } = req.query;
        const query = {};

        if (farmId) {
            query.farm_id = farmId;
        }

        const devices = await Device.find(query).populate('farm_id', 'farm_name location').sort({ createdAt: -1 });
        res.json(devices);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get single device
router.get('/:id', async (req, res) => {
    try {
        const device = await Device.findOne({
            $or: [
                { _id: req.params.id },
                { device_id: req.params.id }
            ]
        }).populate('farm_id', 'farm_name location');

        if (!device) {
            return res.status(404).json({ success: false, message: 'Device not found' });
        }

        res.json(device);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Create device - REQUIRE farm_id
router.post('/', async (req, res) => {
    try {
        // Validate farm_id is provided
        const farmId = req.body.farm_id || req.body.farmId;
        if (!farmId) {
            return res.status(400).json({
                success: false,
                message: 'farm_id is required. Please select a farm first.'
            });
        }

        // Verify farm exists
        const farm = await Farm.findById(farmId);
        if (!farm) {
            return res.status(404).json({
                success: false,
                message: 'Farm not found. Please create a farm first.'
            });
        }

        // Generate device_id if not provided
        const generateDeviceId = () => {
            const timestamp = Date.now().toString(36);
            const random = Math.random().toString(36).substring(2, 7);
            return `GREENPULSE-V1-${timestamp}-${random}`.toUpperCase();
        };

        // Map frontend fields to backend fields
        const deviceData = {
            device_id: req.body.device_id || req.body.id || generateDeviceId(),
            device_name: req.body.device_name || req.body.name || 'Unnamed Device',
            farm_id: farmId, // Required - must reference existing farm
            user_id: req.user?._id || req.body.user_id || null,
            location: {
                name: req.body.location?.name || req.body.location || '',
                farm_name: farm.farm_name, // Keep for backward compatibility
                address: req.body.location?.address || farm.location?.address || '',
                coordinates: req.body.location?.coordinates || {}
            },
            status: req.body.status || 'active',
            device_type: req.body.device_type || req.body.type || 'greenpulse-v1',
            firmware_version: req.body.firmware_version || '1.0.0',
            connectivity: req.body.connectivity || 'wifi'
        };

        // Set default thresholds if not provided
        if (!deviceData.thresholds) {
            deviceData.thresholds = {
                ph: { min: 6.0, max: 7.5, optimal: 6.5 },
                ec: { min: 1.0, max: 2.5, optimal: 1.8 },
                temperature_water_c: { min: 20, max: 28, optimal: 24 },
                temperature_air_c: { min: 18, max: 35, optimal: 26 },
                light_intensity: { min: 3500, max: 6000, optimal: 4500 }
            };
        }

        const device = new Device(deviceData);
        await device.save();

        // Update farm tank count if needed
        if (deviceData.device_type === 'greenpulse-v1') {
            await Farm.findByIdAndUpdate(farmId, {
                $inc: { tank_count: 1 }
            });
        }

        res.status(201).json(device);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Update device
router.put('/:id', async (req, res) => {
    try {
        const updateData = { ...req.body };
        if (updateData.name && !updateData.device_name) {
            updateData.device_name = updateData.name;
            delete updateData.name;
        }

        const device = await Device.findOneAndUpdate(
            {
                $or: [
                    { _id: req.params.id },
                    { device_id: req.params.id }
                ]
            },
            updateData,
            { new: true, runValidators: true }
        );

        if (!device) {
            return res.status(404).json({ success: false, message: 'Device not found' });
        }

        res.json(device);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Update device status
router.patch('/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        const device = await Device.findOneAndUpdate(
            {
                $or: [
                    { _id: req.params.id },
                    { device_id: req.params.id }
                ]
            },
            { status },
            { new: true }
        );

        if (!device) {
            return res.status(404).json({ success: false, message: 'Device not found' });
        }

        res.json(device);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Delete device
router.delete('/:id', async (req, res) => {
    try {
        const device = await Device.findOneAndDelete({
            $or: [
                { _id: req.params.id },
                { device_id: req.params.id }
            ]
        });

        if (!device) {
            return res.status(404).json({ success: false, message: 'Device not found' });
        }

        // Decrement farm tank count if needed
        if (device.farm_id && device.device_type === 'greenpulse-v1') {
            await Farm.findByIdAndUpdate(device.farm_id, {
                $inc: { tank_count: -1 }
            });
        }

        res.json({ success: true, message: 'Device deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;