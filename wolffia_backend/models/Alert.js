import mongoose from 'mongoose';
import crypto from 'crypto';

const alertSchema = new mongoose.Schema({
    alert_id: {
        type: String,
        required: true,
        unique: true,
        default: () => crypto.randomUUID()
    },
    device_id: {
        type: String,
        required: true,
        ref: 'Device'
    },
    data_id: {
        type: String,
        ref: 'SensorData'
    },
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    alert_type: {
        type: String,
        required: true
    },
    parameter: {
        type: String,
        required: true
    },
    threshold_value: {
        type: Number,
        required: true
    },
    actual_value: {
        type: Number,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    severity: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium'
    },
    status: {
        type: String,
        enum: ['active', 'acknowledged', 'resolved'],
        default: 'active'
    },
    resolved_at: {
        type: Date
    }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

alertSchema.index({ device_id: 1, created_at: -1 });
alertSchema.index({ status: 1, severity: -1 });

alertSchema.virtual('id').get(function () {
    return this._id?.toString();
});

alertSchema.virtual('type').get(function () {
    return this.severity;
});

alertSchema.virtual('resolved').get(function () {
    return this.status === 'resolved';
});

alertSchema.virtual('resolvedAt').get(function () {
    return this.resolved_at;
});

alertSchema.virtual('device').get(function () {
    return this.device_id;
});

alertSchema.virtual('time').get(function () {
    return this.created_at;
});

export default mongoose.model('Alert', alertSchema);
