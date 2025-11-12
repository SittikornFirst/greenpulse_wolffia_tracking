import mongoose from 'mongoose';

const alertSchema = new mongoose.Schema({
    device_id: {
        type: String,
        required: true,
        ref: 'Device'
    },
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    alert_type: {
        type: String,
        required: true,
        enum: [
            'ph_high', 'ph_low',
            'ec_high', 'ec_low',
            'temp_water_high', 'temp_water_low',
            'temp_air_high', 'temp_air_low',
            'light_high', 'light_low',
            'sensor_error',
            'device_offline',
            'calibration_needed',
            'system_error'
        ]
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium'
    },
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    sensor_reading: {
        type: mongoose.Schema.Types.Mixed
    },
    status: {
        type: String,
        enum: ['active', 'acknowledged', 'resolved', 'dismissed'],
        default: 'active'
    },
    resolved_at: Date,
    notification_sent: {
        email: Boolean,
        sms: Boolean,
        push: Boolean
    }
}, {
    timestamps: true
});

alertSchema.index({ device_id: 1, status: 1, createdAt: -1 });
alertSchema.index({ user_id: 1, status: 1, priority: -1 });

export default mongoose.model('Alert', alertSchema);