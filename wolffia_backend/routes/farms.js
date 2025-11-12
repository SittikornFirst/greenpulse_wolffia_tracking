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

        const farms = await Farm.find(query).sort({ createdAt: -1 });

        // Get device counts for each farm
        const farmsWithStats = await Promise.all(
            farms.map(async (farm) => {
                const deviceCount = await Device.countDocuments({ farm_id: farm._id });
                const activeDeviceCount = await Device.countDocuments({
                    farm_id: farm._id,
                    status: 'active'
                });

                // Calculate water quality and system health (mock for now)
                const devices = await Device.find({ farm_id: farm._id });
                const latestReadings = await Device.aggregate([
                    { $match: { farm_id: farm._id } },
                    {
                        $lookup: {
                            from: 'sensordatas',
                            localField: 'device_id',
                            foreignField: 'device_id',
                            as: 'readings'
                        }
                    },
                    { $unwind: { path: '$readings', preserveNullAndEmptyArrays: true } },
                    { $sort: { 'readings.timestamp': -1 } },
                    {
                        $group: {
                            _id: '$device_id',
                            latest: { $first: '$readings' }
                        }
                    }
                ]);

                return {
                    _id: farm._id,
                    id: farm._id.toString(),
                    name: farm.farm_name,
                    location: farm.location?.address || farm.location?.name || '',
                    status: farm.status,
                    deviceCount: deviceCount,
                    activeDeviceCount: activeDeviceCount,
                    tankCount: farm.tank_count || 0,
                    waterQuality: 85 + Math.floor(Math.random() * 15), // Mock - calculate from sensor data
                    systemHealth: 80 + Math.floor(Math.random() * 20), // Mock - calculate from device status
                    area: farm.area || 0,
                    description: farm.description || ''
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
        const farmData = {
            farm_name: req.body.name || req.body.farm_name,
            user_id: req.user?._id || null,
            location: {
                name: req.body.location || req.body.location?.name || '',
                address: req.body.location || req.body.location?.address || req.body.address || '',
                coordinates: req.body.location?.coordinates || {},
                city: req.body.location?.city || '',
                province: req.body.location?.province || '',
                country: req.body.location?.country || 'Thailand'
            },
            status: req.body.status || 'active',
            description: req.body.description || '',
            area: req.body.area || 0,
            tank_count: req.body.tankCount || req.body.tank_count || 0,
            metadata: {
                notes: req.body.metadata?.notes || '',
                established_date: req.body.metadata?.established_date || new Date()
            }
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