import mongoose from 'mongoose';

const deviceConfigurationSchema = new mongoose.Schema({
    device_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Device',
        required: true,
        unique: true
    },
    mqtt_topic: {
        type: String,
        required: true
    },
    alert_enabled: {
        type: Boolean,
        default: true
    },
    sampling_interval: {
        type: Number,
        required: true,
        min: 1
    },
    ph_min: Number,
    ph_max: Number,
    ec_value_min: Number,
    ec_value_max: Number,
    light_intensity_min: Number,
    light_intensity_max: Number,
    air_temp_min: Number,
    air_temp_max: Number,
    water_temp_min: Number,
    water_temp_max: Number
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

export default mongoose.model('DeviceConfiguration', deviceConfigurationSchema);

