import mongoose from 'mongoose';

const deviceSchema = new mongoose.Schema({
    device_id: {
        type: String,
        required: true,
        unique: true,
        uppercase: true
    },
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    farm_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Farm',
        required: true,
        unique: true
    },
    config_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DeviceConfiguration'
    },
    latest_alert_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Alert'
    },
    device_name: {
        type: String,
        required: true,
        trim: true
    },
    location: {
        type: String,
        required: true,
        trim: true
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'maintenance'],
        default: 'active'
    },
    last_activity: {
        type: Date
    }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

deviceSchema.index({ farm_id: 1 });
deviceSchema.index({ user_id: 1, status: 1 });

export default mongoose.model('Device', deviceSchema);