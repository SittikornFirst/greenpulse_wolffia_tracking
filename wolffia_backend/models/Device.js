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
        required: false
    },
    farm_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Farm',
        required: true // Required - device must belong to a farm
    },
    device_name: {
        type: String,
        required: true,
        trim: true
    },
    location: {
        name: String, // e.g., "Tank A", "Row 3"
        farm_name: String, // Keep for backward compatibility
        coordinates: {
            lat: Number,
            lng: Number
        },
        address: String
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'maintenance', 'error'],
        default: 'active'
    },
    device_type: {
        type: String,
        default: 'greenpulse-v1'
    },
    firmware_version: String,
    mac_address: String,
    ip_address: String,
    connectivity: {
        type: String,
        enum: ['wifi', 'ethernet', 'cellular'],
        default: 'wifi'
    },
    calibration: {
        ph: { offset: Number, last_calibrated: Date },
        ec: { offset: Number, last_calibrated: Date },
        temperature: { offset: Number, last_calibrated: Date }
    },
    thresholds: {
        ph: { min: Number, max: Number, optimal: Number },
        ec: { min: Number, max: Number, optimal: Number },
        temperature_water_c: { min: Number, max: Number, optimal: Number },
        temperature_air_c: { min: Number, max: Number, optimal: Number },
        light_intensity: { min: Number, max: Number, optimal: Number }
    },
    metadata: {
        tank_capacity: Number,
        notes: String
    }
}, {
    timestamps: true
});

deviceSchema.index({ farm_id: 1, status: 1 });
deviceSchema.index({ device_id: 1 });
deviceSchema.index({ status: 1 });

export default mongoose.model('Device', deviceSchema);