import express from 'express';
import Alert from '../models/Alert.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

// Get all alerts
router.get('/', async (req, res) => {
    try {
        const { resolved, deviceId, priority } = req.query;
        const query = { user_id: req.user._id };

        if (resolved !== undefined) {
            query.status = resolved === 'true' ? 'resolved' : { $ne: 'resolved' };
        }
        if (deviceId) query.device_id = deviceId;
        if (priority) query.priority = priority;

        const alerts = await Alert.find(query)
            .sort({ createdAt: -1 })
            .limit(100);

        res.json(alerts);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get unresolved alerts
router.get('/unresolved', async (req, res) => {
    try {
        const alerts = await Alert.find({
            user_id: req.user._id,
            status: { $ne: 'resolved' }
        }).sort({ createdAt: -1 });

        res.json(alerts);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get alerts by device
router.get('/device/:deviceId', async (req, res) => {
    try {
        const alerts = await Alert.find({
            device_id: req.params.deviceId,
            user_id: req.user._id
        }).sort({ createdAt: -1 });

        res.json(alerts);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get single alert
router.get('/:id', async (req, res) => {
    try {
        const alert = await Alert.findOne({
            _id: req.params.id,
            user_id: req.user._id
        });

        if (!alert) {
            return res.status(404).json({ success: false, message: 'Alert not found' });
        }

        res.json(alert);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Create alert
router.post('/', async (req, res) => {
    try {
        const alertData = {
            ...req.body,
            user_id: req.user._id
        };

        const alert = new Alert(alertData);
        await alert.save();

        res.status(201).json(alert);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Update alert
router.put('/:id', async (req, res) => {
    try {
        const alert = await Alert.findOneAndUpdate(
            { _id: req.params.id, user_id: req.user._id },
            req.body,
            { new: true }
        );

        if (!alert) {
            return res.status(404).json({ success: false, message: 'Alert not found' });
        }

        res.json(alert);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Resolve alert
router.patch('/:id/resolve', async (req, res) => {
    try {
        const alert = await Alert.findOneAndUpdate(
            { _id: req.params.id, user_id: req.user._id },
            { status: 'resolved', resolved_at: new Date() },
            { new: true }
        );

        if (!alert) {
            return res.status(404).json({ success: false, message: 'Alert not found' });
        }

        res.json(alert);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Delete alert
router.delete('/:id', async (req, res) => {
    try {
        const alert = await Alert.findOneAndDelete({
            _id: req.params.id,
            user_id: req.user._id
        });

        if (!alert) {
            return res.status(404).json({ success: false, message: 'Alert not found' });
        }

        res.json({ success: true, message: 'Alert deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;