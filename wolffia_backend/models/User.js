import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
    user_name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['admin', 'farmer'],
        default: 'farmer'
    },
    phone: {
        type: String,
        trim: true
    },
    is_active: {
        type: Boolean,
        default: true
    },
    last_login: {
        type: Date
    }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

userSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model('User', userSchema);