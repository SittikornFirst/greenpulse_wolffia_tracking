import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../../models/User.js';
import Farm from '../../models/Farm.js';
import Device from '../../models/Device.js';

dotenv.config();

async function checkCounts() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const userCount = await User.countDocuments();
        const farmCount = await Farm.countDocuments();
        const deviceCount = await Device.countDocuments();

        console.log('Counts:');
        console.log('- Users:', userCount);
        console.log('- Farms:', farmCount);
        console.log('- Devices:', deviceCount);

        const users = await User.find().limit(1);
        console.log('Sample User:', users[0]);

        await mongoose.disconnect();
    } catch (err) {
        console.error('Error:', err);
    }
}

checkCounts();
