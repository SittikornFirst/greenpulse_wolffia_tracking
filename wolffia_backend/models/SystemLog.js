import mongoose from 'mongoose';

const systemLogSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false // Optional, as some events might be system-generated
    },
    device_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Device',
        required: false // Optional, as events can target users, farms, or alerts
    },
    config_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DeviceConfiguration'
    },
    target_type: {
        type: String, // 'User', 'Device', 'Farm', 'Alert', 'System'
        required: false
    },
    target_id: {
        type: mongoose.Schema.Types.ObjectId, // The ID of the affected resource
        required: false
    },
    action_type: {
        type: String, // 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'REGISTER', etc.
        required: false
    },
    log_type: {
        type: String,
        enum: ['INFO', 'WARNING', 'ERROR'],
        default: 'INFO'
    },
    event: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

systemLogSchema.index({ device_id: 1, created_at: -1 });

export default mongoose.model('SystemLog', systemLogSchema);

