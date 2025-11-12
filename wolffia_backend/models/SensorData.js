import mongoose from 'mongoose';

const sensorDataSchema = new mongoose.Schema({
    device_id: {
        type: String,
        required: true,
        ref: 'Device'
    },
    timestamp: {
        type: Date,
        default: Date.now,
        required: true
    },
    ph: {
        value: { type: Number, required: true },
        status: { type: String, enum: ['normal', 'warning', 'critical'], default: 'normal' }
    },
    ec: {
        value: { type: Number, required: true },
        status: { type: String, enum: ['normal', 'warning', 'critical'], default: 'normal' }
    },
    temperature_water_c: {
        value: { type: Number, required: true },
        status: { type: String, enum: ['normal', 'warning', 'critical'], default: 'normal' }
    },
    temperature_air_c: {
        value: { type: Number, required: true },
        status: { type: String, enum: ['normal', 'warning', 'critical'], default: 'normal' }
    },
    light_intensity: {
        value: { type: Number, required: true },
        status: { type: String, enum: ['normal', 'warning', 'critical'], default: 'normal' }
    },
    quality_flag: {
        type: String,
        enum: ['good', 'acceptable', 'questionable', 'bad'],
        default: 'good'
    },
    quality_score: {
        type: Number,
        min: 0,
        max: 100,
        default: 100
    },
    error_flags: {
        sensor_error: Boolean,
        communication_error: Boolean,
        calibration_needed: Boolean
    },
    metadata: {
        battery_level: Number,
        signal_strength: Number,
        firmware_version: String
    }
}, {
    timestamps: true
});

sensorDataSchema.index({ device_id: 1, timestamp: -1 });
sensorDataSchema.index({ device_id: 1, quality_flag: 1, timestamp: -1 });
sensorDataSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7776000 }); // 90 days TTL

export default mongoose.model('SensorData', sensorDataSchema);