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
        required: true
    },
    location: {
        type: String,
        required: true,
        trim: true
    }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

farmSchema.index({ user_id: 1 });
farmSchema.index({ farm_name: 1, user_id: 1 }, { unique: true });

export default mongoose.model('Farm', farmSchema);
