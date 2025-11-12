import mongoose from 'mongoose';

const farmSchema = new mongoose.Schema({
    farm_name: {
        type: String,
        required: true,
        trim: true
    },
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    location: {
        name: String,
        address: {
            type: String,
            required: true
        },
        coordinates: {
            lat: Number,
            lng: Number
        },
        city: String,
        province: String,
        country: {
            type: String,
            default: 'Thailand'
        }
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'maintenance'],
        default: 'active'
    },
    description: String,
    area: {
        type: Number,
        default: 0
    },
    tank_count: {
        type: Number,
        default: 0
    },
    metadata: {
        notes: String,
        established_date: Date
    }
}, {
    timestamps: true
});

farmSchema.index({ user_id: 1, status: 1 });
farmSchema.index({ farm_name: 1 });

export default mongoose.model('Farm', farmSchema);
