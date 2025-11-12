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
    password_hash: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['admin', 'farmer', 'viewer'],
        default: 'farmer'
    },
    phone: {
        type: String,
        trim: true
    },
    notification_preferences: {
        email: { type: Boolean, default: true },
        sms: { type: Boolean, default: false },
        push: { type: Boolean, default: true }
    },
    is_active: {
        type: Boolean,
        default: true
    },
    last_login: {
        type: Date
    }
}, {
    timestamps: true
});

userSchema.methods.comparePassword = async function (password) {
    return bcrypt.compare(password, this.password_hash);
};

export default mongoose.model('User', userSchema);