import express from 'express';
import Device from '../models/Device.js';
import Farm from '../models/Farm.js';
import DeviceConfiguration from '../models/DeviceConfiguration.js';
import SystemLog from '../models/SystemLog.js';

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

        const devices = await Device.find(query)
            .populate('farm_id', 'farm_name location')
            .populate('config_id')
            .sort({ created_at: -1 });
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
        }).populate('farm_id', 'farm_name location').populate('config_id');

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

        const existingFarmDevice = await Device.findOne({ farm_id: farmId });
        if (existingFarmDevice) {
            return res.status(400).json({
                success: false,
                message: 'Each farm can be linked to only one device.'
            });
        }

        // Generate device_id if not provided
        const generateDeviceId = () => {
            const timestamp = Date.now().toString(36);
            const random = Math.random().toString(36).substring(2, 7);
            return `GREENPULSE-V1-${timestamp}-${random}`.toUpperCase();
        };

        // Map frontend fields to backend fields
        const ownerId = req.user?._id || req.body.user_id;
        if (!ownerId) {
            return res.status(400).json({
                success: false,
                message: 'user_id is required to register a device.'
            });
        }

        const deviceData = {
            device_id: req.body.device_id || req.body.id || generateDeviceId(),
            device_name: req.body.device_name || req.body.name || 'Unnamed Device',
            farm_id: farmId,
            user_id: ownerId,
            location: req.body.location || farm.location,
            status: req.body.status || 'active'
        };

        const device = await Device.create(deviceData);

        const config = await DeviceConfiguration.create({
            device_id: device._id,
            mqtt_topic: req.body.mqtt_topic || `devices/${device.device_id}/data`,
            alert_enabled: req.body.alert_enabled ?? true,
            sampling_interval: req.body.sampling_interval || 300,
            ph_min: 6.0,
            ph_max: 7.5,
            ec_value_min: 1.0,
            ec_value_max: 2.5,
            light_intensity_min: 3500,
            light_intensity_max: 6000,
            air_temp_min: 18,
            air_temp_max: 35,
            water_temp_min: 20,
            water_temp_max: 28
        });

        device.config_id = config._id;
        await device.save();

        const hydratedDevice = await Device.findById(device._id)
            .populate('farm_id', 'farm_name location')
            .populate('config_id');

        res.status(201).json(hydratedDevice);
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
        if (updateData.location?.address && typeof updateData.location !== 'string') {
            updateData.location = updateData.location.address;
        }

        // Build query - check if id is a valid ObjectId first
        const mongoose = await import('mongoose');
        const query = {};
        if (mongoose.Types.ObjectId.isValid(req.params.id)) {
            query.$or = [
                { _id: req.params.id },
                { device_id: req.params.id }
            ];
        } else {
            // If not a valid ObjectId, only search by device_id
            query.device_id = req.params.id;
        }

        const device = await Device.findOneAndUpdate(
            query,
            updateData,
            { new: true, runValidators: true }
        ).populate('farm_id', 'farm_name location').populate('config_id');

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

        // Build query - check if id is a valid ObjectId first
        const mongoose = await import('mongoose');
        const query = {};
        if (mongoose.Types.ObjectId.isValid(req.params.id)) {
            query.$or = [
                { _id: req.params.id },
                { device_id: req.params.id }
            ];
        } else {
            // If not a valid ObjectId, only search by device_id
            query.device_id = req.params.id;
        }

        const device = await Device.findOneAndUpdate(
            query,
            { status },
            { new: true }
        ).populate('farm_id', 'farm_name location').populate('config_id');

        if (!device) {
            return res.status(404).json({ success: false, message: 'Device not found' });
        }

        res.json(device);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Update device configuration/thresholds
router.put('/:id/configuration', async (req, res) => {
    try {
        const device = await Device.findOne({
            $or: [
                { _id: req.params.id },
                { device_id: req.params.id }
            ]
        });

        if (!device) {
            return res.status(404).json({ success: false, message: 'Device not found' });
        }

        // Update or create configuration
        const configData = {
            device_id: device._id,
            ...req.body
        };

        let config = await DeviceConfiguration.findOneAndUpdate(
            { device_id: device._id },
            configData,
            { new: true, upsert: true, runValidators: true }
        );

        // Update device's config_id reference
        device.config_id = config._id;
        await device.save();

        // Log the configuration change
        await SystemLog.create({
            device_id: device._id,
            config_id: config._id,
            event_type: 'config_change',
            severity: 'info',
            description: 'Device configuration updated',
            details: { updated_fields: Object.keys(req.body) }
        });

        res.json(config);
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

        await DeviceConfiguration.findOneAndDelete({ device_id: device._id });
        await SystemLog.deleteMany({ device_id: device._id });

        res.json({ success: true, message: 'Device deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;