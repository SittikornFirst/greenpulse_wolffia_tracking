import express from 'express';
import Alert from '../models/Alert.js';
import { authenticate } from '../middleware/auth.js';
import { auditLog } from '../utils/logger.js';

const router = express.Router();

router.use(authenticate);

// Get all alerts
router.get('/', async (req, res) => {
    try {
        const { resolved, deviceId, severity } = req.query;
        const query = { user_id: req.user._id };

        if (resolved !== undefined) {
            query.status = resolved === 'true' ? 'resolved' : { $ne: 'resolved' };
        }
        if (deviceId) query.device_id = deviceId;
        if (severity) query.severity = severity;

        const alerts = await Alert.find(query)
            .sort({ created_at: -1 })
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
        }).sort({ created_at: -1 });

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
        }).sort({ created_at: -1 });

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
            severity: req.body.severity || req.body.priority || 'medium',
            user_id: req.user._id
        };

        const alert = new Alert(alertData);
        await alert.save();

        await auditLog({
            user_id: req.user._id,
            target_type: "Alert",
            target_id: alert._id,
            action_type: "CREATE",
            event: "Alert Created",
            message: `User ${req.user.email} created an alert.`
        });

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

        await auditLog({
            user_id: req.user._id,
            target_type: "Alert",
            target_id: alert._id,
            action_type: "UPDATE",
            event: "Alert Resolved",
            message: `User ${req.user.email} resolved alert ${alert.alert_type || alert.message || alert._id}.`
        });

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

        await auditLog({
            user_id: req.user._id,
            target_type: "Alert",
            target_id: alert._id,
            action_type: "DELETE",
            event: "Alert Deleted",
            message: `User ${req.user.email} deleted alert ${alert.alert_type || alert.message || alert._id}.`
        });

        res.json({ success: true, message: 'Alert deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;