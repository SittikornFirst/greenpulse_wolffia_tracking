import express from 'express';
import SystemLog from '../models/SystemLog.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

// Get paginated system logs / audit trail
router.get('/', async (req, res) => {
    try {
        const { page = 1, limit = 50, action_type, target_type, search } = req.query;
        const query = {};

        // If user is not admin, only show logs relating to their own user_id
        if (req.user.role !== 'admin') {
            query.user_id = req.user._id;
        }

        if (action_type) {
            query.action_type = action_type;
        }

        if (target_type) {
            query.target_type = target_type;
        }

        if (search) {
            query.$or = [
                { event: { $regex: search, $options: 'i' } },
                { message: { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [total, logs] = await Promise.all([
            SystemLog.countDocuments(query),
            SystemLog.find(query)
                .populate('user_id', 'user_name email role')
                .populate('device_id', 'device_name')
                .sort({ created_at: -1 })
                .skip(skip)
                .limit(parseInt(limit))
        ]);

        const totalPages = Math.max(1, Math.ceil(total / parseInt(limit)));

        res.json({
            success: true,
            data: logs,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: totalPages
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;
