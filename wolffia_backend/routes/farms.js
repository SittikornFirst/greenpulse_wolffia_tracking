import express from 'express';
import Farm from '../models/Farm.js';
import Device from '../models/Device.js';

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

// Get all farms
router.get('/', async (req, res) => {
    try {
        const query = {}; // No user filter - show all farms

        const farms = await Farm.find(query).sort({ created_at: -1 });

        // Get device counts for each farm
        const farmsWithStats = await Promise.all(
            farms.map(async (farm) => {
                const deviceCount = await Device.countDocuments({ farm_id: farm._id });
                const activeDeviceCount = await Device.countDocuments({
                    farm_id: farm._id,
                    status: 'active'
                });

                return {
                    _id: farm._id,
                    id: farm._id.toString(),
                    name: farm.farm_name,
                    location: farm.location,
                    deviceCount,
                    activeDeviceCount
                };
            })
        );

        res.json(farmsWithStats);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get single farm
router.get('/:id', async (req, res) => {
    try {
        const farm = await Farm.findById(req.params.id);

        if (!farm) {
            return res.status(404).json({ success: false, message: 'Farm not found' });
        }

        const deviceCount = await Device.countDocuments({ farm_id: farm._id });
        const devices = await Device.find({ farm_id: farm._id });

        res.json({
            ...farm.toObject(),
            deviceCount,
            devices
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Create farm
router.post('/', async (req, res) => {
    try {
        const ownerId = req.user?._id || req.body.user_id;
        if (!ownerId) {
            return res.status(400).json({ success: false, message: 'user_id is required' });
        }

        const farmData = {
            farm_name: req.body.name || req.body.farm_name,
            user_id: ownerId,
            location: req.body.location || req.body.address || ''
        };

        const farm = new Farm(farmData);
        await farm.save();

        res.status(201).json(farm);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Update farm
router.put('/:id', async (req, res) => {
    try {
        const updateData = { ...req.body };

        // Map frontend fields to backend fields
        if (updateData.name && !updateData.farm_name) {
            updateData.farm_name = updateData.name;
        }
        if (updateData.location?.address && typeof updateData.location !== 'string') {
            updateData.location = updateData.location.address;
        }

        const farm = await Farm.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        );

        if (!farm) {
            return res.status(404).json({ success: false, message: 'Farm not found' });
        }

        res.json(farm);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Delete farm
router.delete('/:id', async (req, res) => {
    try {
        // Check if farm has devices
        const deviceCount = await Device.countDocuments({ farm_id: req.params.id });

        if (deviceCount > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete farm with ${deviceCount} device(s). Please remove devices first.`
            });
        }

        const farm = await Farm.findByIdAndDelete(req.params.id);

        if (!farm) {
            return res.status(404).json({ success: false, message: 'Farm not found' });
        }

        res.json({ success: true, message: 'Farm deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get farm devices
router.get('/:farmId/devices', async (req, res) => {
    try {
        const devices = await Device.find({
            farm_id: req.params.farmId
        });

        res.json(devices);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get farm statistics
router.get('/:farmId/statistics', async (req, res) => {
    try {
        const farm = await Farm.findById(req.params.farmId);
        if (!farm) {
            return res.status(404).json({ success: false, message: 'Farm not found' });
        }

        const deviceCount = await Device.countDocuments({ farm_id: req.params.farmId });
        const activeDeviceCount = await Device.countDocuments({
            farm_id: req.params.farmId,
            status: 'active'
        });

        res.json({
            farm: farm,
            deviceCount,
            activeDeviceCount,
            inactiveDeviceCount: deviceCount - activeDeviceCount
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;