import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Device from '../models/Device.js';
import SensorData from '../models/SensorData.js';
import Alert from '../models/Alert.js';
import Farm from '../models/Farm.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/greenpulse_v1';

// Generate random value within range
const randomValue = (min, max) => Math.random() * (max - min) + min;

// Generate realistic sensor data
const generateSensorReading = (device, timestamp) => {
    const baseValues = {
        ph: 6.5,
        ec: 1.8,
        temperature_water_c: 24,
        temperature_air_c: 26,
        light_intensity: 4500
    };

    // Add some variation
    const ph = baseValues.ph + randomValue(-0.5, 0.5);
    const ec = baseValues.ec + randomValue(-0.3, 0.3);
    const tempWater = baseValues.temperature_water_c + randomValue(-2, 2);
    const tempAir = baseValues.temperature_air_c + randomValue(-3, 3);
    const light = baseValues.light_intensity + randomValue(-500, 500);

    return {
        device_id: device.device_id,
        timestamp,
        ph: { value: parseFloat(ph.toFixed(2)), status: ph < 6.0 || ph > 7.5 ? 'warning' : 'normal' },
        ec: { value: parseFloat(ec.toFixed(2)), status: ec < 1.0 || ec > 2.5 ? 'warning' : 'normal' },
        temperature_water_c: { value: parseFloat(tempWater.toFixed(1)), status: 'normal' },
        temperature_air_c: { value: parseFloat(tempAir.toFixed(1)), status: 'normal' },
        light_intensity: { value: Math.round(light), status: light < 3500 || light > 6000 ? 'warning' : 'normal' },
        quality_flag: 'good',
        quality_score: 95 + Math.floor(Math.random() * 5),
        metadata: {
            battery_level: 80 + Math.floor(Math.random() * 20),
            signal_strength: 70 + Math.floor(Math.random() * 30),
            firmware_version: '1.0.0'
        }
    };
};

const seed = async () => {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Clear existing data
        await User.deleteMany({});
        await Device.deleteMany({});
        await SensorData.deleteMany({});
        await Alert.deleteMany({});
        await Farm.deleteMany({}); // Clear farms
        console.log('��️  Cleared existing data');

        // Create users
        const adminPassword = await bcrypt.hash('admin123', 10);
        const farmerPassword = await bcrypt.hash('farmer123', 10);

        const admin = await User.create({
            user_name: 'Admin User',
            email: 'admin@greenpulse.com',
            password_hash: adminPassword,
            role: 'admin',
            phone: '+1234567890'
        });

        const farmer1 = await User.create({
            user_name: 'John Farmer',
            email: 'john@farm.com',
            password_hash: farmerPassword,
            role: 'farmer',
            phone: '+1234567891'
        });

        const farmer2 = await User.create({
            user_name: 'Mary Farmer',
            email: 'mary@greenfarm.com',
            password_hash: farmerPassword,
            role: 'farmer',
            phone: '+1234567892'
        });

        console.log('👥 Created users');

        // Create farms first
        const farms = [];
        const farmNames = ['Main Farm', 'North Farm', 'Research'];

        for (let i = 0; i < farmNames.length; i++) {
            const farm = await Farm.create({
                farm_name: farmNames[i],
                user_id: i < 2 ? farmer1._id : farmer2._id,
                location: {
                    name: i === 0 ? 'Main Farm Site' : i === 1 ? 'North Farm' : 'Research Facility',
                    address: `${i === 0 ? 'Bangkok' : i === 1 ? 'Chiang Mai' : 'Phuket'}, Thailand`,
                    coordinates: { lat: 13.7563 + randomValue(-0.1, 0.1), lng: 100.5018 + randomValue(-0.1, 0.1) }
                },
                status: i === 2 ? 'maintenance' : 'active',
                area: i === 0 ? 150 : i === 1 ? 100 : 75,
                tank_count: 0,
                description: i === 0 ? 'Primary production facility' : i === 1 ? 'Secondary production site' : 'Testing and development'
            });
            farms.push(farm);
        }

        console.log('�� Created farms');

        // Create devices and assign to farms
        const devices = [];
        const deviceIds = ['00001', '00002', '00003', '00004'];

        for (let i = 0; i < deviceIds.length; i++) {
            const deviceId = `GREENPULSE-V1-${deviceIds[i]}`;
            const farm = farms[i < 2 ? 0 : i === 2 ? 1 : 2]; // Assign to farms

            const device = await Device.create({
                device_id: deviceId,
                user_id: i < 2 ? farmer1._id : farmer2._id,
                farm_id: farm._id, // Link to farm
                device_name: i === 0 ? 'Main Tank Alpha' :
                    i === 1 ? 'Main Tank Beta' :
                        i === 2 ? 'North Farm Monitor' : 'Research Tank',
                location: {
                    name: `Tank ${String.fromCharCode(65 + i)}`, // A, B, C, D
                    farm_name: farm.farm_name,
                    address: farm.location.address
                },
                status: i === 3 ? 'maintenance' : 'active',
                device_type: 'greenpulse-v1',
                firmware_version: '1.0.0',
                thresholds: {
                    ph: { min: 6.0, max: 7.5, optimal: 6.5 },
                    ec: { min: 1.0, max: 2.5, optimal: 1.8 },
                    temperature_water_c: { min: 20, max: 28, optimal: 24 },
                    temperature_air_c: { min: 18, max: 35, optimal: 26 },
                    light_intensity: { min: 3500, max: 6000, optimal: 4500 }
                }
            });

            devices.push(device);

            // Update farm tank count
            await Farm.findByIdAndUpdate(farm._id, {
                $inc: { tank_count: 1 }
            });
        }

        console.log('�� Created devices');

        // Generate sensor data (48 hours, every 5 minutes)
        const now = new Date();
        const sensorDataPromises = [];

        for (const device of devices) {
            for (let hours = 0; hours < 48; hours++) {
                for (let minutes = 0; minutes < 60; minutes += 5) {
                    const timestamp = new Date(now - (hours * 60 + minutes) * 60 * 1000);
                    const reading = generateSensorReading(device, timestamp);
                    sensorDataPromises.push(SensorData.create(reading));
                }
            }
        }

        await Promise.all(sensorDataPromises);
        console.log('📊 Generated sensor data');

        // Create sample alerts
        const alerts = [
            {
                device_id: devices[1].device_id,
                user_id: farmer1._id,
                alert_type: 'calibration_needed',
                priority: 'medium',
                title: 'Calibration Needed',
                message: 'Device requires sensor calibration',
                status: 'active'
            },
            {
                device_id: devices[0].device_id,
                user_id: farmer1._id,
                alert_type: 'ph_low',
                priority: 'high',
                title: 'pH Level Low',
                message: 'pH level dropped below threshold',
                status: 'active'
            },
            {
                device_id: devices[2].device_id,
                user_id: farmer2._id,
                alert_type: 'temp_water_high',
                priority: 'medium',
                title: 'Water Temperature High',
                message: 'Water temperature exceeded optimal range',
                status: 'resolved',
                resolved_at: new Date()
            }
        ];

        await Alert.insertMany(alerts);
        console.log('🚨 Created alerts');

        console.log('\n✅ Seed completed successfully!');
        console.log('\nTest Credentials:');
        console.log('Admin: admin@greenpulse.com / admin123');
        console.log('Farmer 1: john@farm.com / farmer123');
        console.log('Farmer 2: mary@greenfarm.com / farmer123');

        process.exit(0);
    } catch (error) {
        console.error('❌ Seed error:', error);
        process.exit(1);
    }
};

seed();