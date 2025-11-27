import mongoose from 'mongoose';

const systemLogSchema = new mongoose.Schema({
    device_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Device',
        required: true
    },
    config_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DeviceConfiguration'
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

