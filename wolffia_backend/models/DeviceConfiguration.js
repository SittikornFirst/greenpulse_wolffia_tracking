import mongoose from 'mongoose';

const deviceConfigurationSchema = new mongoose.Schema({
    device_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Device',
        required: true,
        unique: true
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
    water_temp_max: Number,
    relays: {
        type: [{
            relay_id: Number,     // 0-5
            name: String,         // "Relay 1", "Water Pump 1", etc.
            status: Boolean,      // true = ON, false = OFF
            pin: Number           // 5, 13, 12, 15, 2, 30
        }],
        default: [
            { relay_id: 0, name: "", status: false, pin: 25 },
            { relay_id: 1, name: "", status: false, pin: 32 }
        ]
    },
    schedules: {
        type: [{
            schedule_id: {
                type: String,
                required: true
            },
            relays: [Number],    // e.g., [0, 2] for Relays 1 and 3
            days: [Number],      // e.g., [1, 2, 3, 4, 5] for Mon-Fri (0=Sun)
            startHour: Number,
            startMinute: Number,
            stopHour: Number,
            stopMinute: Number,
            enabled: {
                type: Boolean,
                default: true
            }
        }],
        default: []
    }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

export default mongoose.model('DeviceConfiguration', deviceConfigurationSchema);

