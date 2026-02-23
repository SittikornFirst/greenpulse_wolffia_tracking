import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import crypto from "crypto";
import User from "../models/User.js";
import Device from "../models/Device.js";
import SensorData from "../models/SensorData.js";
import Alert from "../models/Alert.js";
import Farm from "../models/Farm.js";
import DeviceConfiguration from "../models/DeviceConfiguration.js";
import SystemLog from "../models/SystemLog.js";

dotenv.config();

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/greenpulse_v1";

// Generate random value within range
const randomValue = (min, max) => Math.random() * (max - min) + min;

// Generate realistic sensor data
const generateSensorReading = (device, timestamp) => {
  const baseValues = {
    ph: 6.5,
    ec: 1.8,
    temperature_water_c: 24,
    temperature_air_c: 26,
    light_intensity: 4500,
  };

  // Add some variation
  const ph = baseValues.ph + randomValue(-0.5, 0.5);
  const ec = baseValues.ec + randomValue(-0.3, 0.3);
  const tempWater = baseValues.temperature_water_c + randomValue(-2, 2);
  const tempAir = baseValues.temperature_air_c + randomValue(-3, 3);
  const light = baseValues.light_intensity + randomValue(-500, 500);

  const phValue = parseFloat(ph.toFixed(2));
  const ecValue = parseFloat(ec.toFixed(2));

  return {
    device_id: device.device_id,
    data_id: crypto.randomUUID(),
    ph_value: phValue,
    ec_value: ecValue,
    tds_value: parseFloat((ecValue * 0.64).toFixed(2)),
    water_temperature_c: parseFloat(tempWater.toFixed(1)),
    air_temperature_c: parseFloat(tempAir.toFixed(1)),
    air_humidity: parseFloat(randomValue(60, 80).toFixed(1)),
    light_intensity: Math.round(light),
    quality_flag: "valid",
    created_at: timestamp,
  };
};

const seed = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Clear existing data
    await User.deleteMany({});
    await Device.deleteMany({});
    await SensorData.deleteMany({});
    await Alert.deleteMany({});
    await Farm.deleteMany({});
    await DeviceConfiguration.deleteMany({});
    await SystemLog.deleteMany({});
    console.log(" Cleared existing data");

    // Create users
    const adminPassword = await bcrypt.hash("admin123", 10);
    const farmerPassword = await bcrypt.hash("farmer123", 10);

    const admin = await User.create({
      user_name: "Admin User",
      email: "admin@greenpulse.com",
      password: adminPassword,
      role: "admin",
      phone: "+1234567890",
    });

    const farmer1 = await User.create({
      user_name: "John Farmer",
      email: "john@farm.com",
      password: farmerPassword,
      role: "farmer",
      phone: "+1234567891",
    });

    const farmer2 = await User.create({
      user_name: "Mary Farmer",
      email: "mary@greenfarm.com",
      password: farmerPassword,
      role: "farmer",
      phone: "+1234567892",
    });

    console.log("👥 Created users");

    // Create farms first
    const farms = [];
    const farmNames = ["Main Farm", "North Farm", "Research"];

    for (let i = 0; i < farmNames.length; i++) {
      const farm = await Farm.create({
        farm_name: farmNames[i],
        user_id: farmer1._id, // All farms now belong to farmer1
        location: `${
          i === 0 ? "Bangkok" : i === 1 ? "Chiang Mai" : "Phuket"
        }, Thailand`,
      });
      farms.push(farm);
    }

    console.log("🌱 Created farms");

    // Create devices and assign to farms
    const devices = [];
    const deviceIds = ["00001", "00002", "00003"];

    for (let i = 0; i < deviceIds.length; i++) {
      const deviceId = `GREENPULSE-V1-${deviceIds[i]}`;
      const farm = farms[i];

      const device = await Device.create({
        device_id: deviceId,
        user_id: farmer1._id, // All devices now belong to farmer1
        farm_id: farm._id,
        device_name: ["Main Tank Alpha", "North Farm Monitor", "Research Tank"][
          i
        ],
        location: `${farm.farm_name} - Zone ${String.fromCharCode(65 + i)}`,
      });

      const config = await DeviceConfiguration.create({
        device_id: device._id,
        mqtt_topic: `devices/${deviceId}/data`,
        alert_enabled: true,
        sampling_interval: 300,
        ph_min: 6.0,
        ph_max: 7.5,
        ec_value_min: 1.0,
        ec_value_max: 2.5,
        light_intensity_min: 3500,
        light_intensity_max: 6000,
        air_temp_min: 18,
        air_temp_max: 35,
        water_temp_min: 20,
        water_temp_max: 28,
      });

      device.config_id = config._id;
      await device.save();

      devices.push(device);
    }

    console.log("📟 Created devices and configurations");

    // Generate sensor data (7 days, every 30 minutes to reduce volume but cover range)
    const now = new Date();
    const sensorDataPromises = [];

    for (const device of devices) {
      // Generate for last 7 days
      for (let hours = 0; hours < 24 * 7; hours++) {
        // Every 15 minutes
        for (let minutes = 0; minutes < 60; minutes += 15) {
          const timestamp = new Date(now - (hours * 60 + minutes) * 60 * 1000);
          const reading = generateSensorReading(device, timestamp);
          sensorDataPromises.push(SensorData.create(reading));
        }
      }
    }

    await Promise.all(sensorDataPromises);
    console.log("📊 Generated sensor data");

    // Create sample alerts
    const alerts = [
      {
        device_id: devices[0].device_id,
        data_id: crypto.randomUUID(),
        user_id: farmer1._id,
        alert_type: "ph_value_low",
        parameter: "pH",
        threshold_value: 6.0,
        actual_value: 5.4,
        message: "pH level dropped below minimum threshold (6.0)",
        severity: "caution",
        status: "active",
        created_at: new Date(Date.now() - 30 * 60000), // 30 mins ago
      },
      {
        device_id: devices[1].device_id,
        data_id: crypto.randomUUID(),
        user_id: farmer1._id,
        alert_type: "water_temperature_high",
        parameter: "Water Temp",
        threshold_value: 28,
        actual_value: 30,
        message: "Water temperature exceeded configured threshold (28°C)",
        severity: "caution",
        status: "active",
        created_at: new Date(Date.now() - 2 * 60 * 60000), // 2 hours ago
      },
      {
        device_id: devices[2].device_id,
        data_id: crypto.randomUUID(),
        user_id: farmer1._id,
        alert_type: "light_intensity_low",
        parameter: "Light Intensity",
        threshold_value: 3500,
        actual_value: 3000,
        message: "Light intensity below acceptable range (3500 lux)",
        severity: "caution",
        status: "resolved",
        created_at: new Date(Date.now() - 1 * 24 * 60 * 60000), // 1 day ago
        resolved_at: new Date(),
      },
    ];

    await Alert.insertMany(alerts);
    console.log("🚨 Created alerts");

    console.log("\n✅ Seed completed successfully!");
    console.log("\nTest Credentials:");
    console.log("Admin: admin@greenpulse.com / admin123");
    console.log("Farmer 1: john@farm.com / farmer123");

    process.exit(0);
  } catch (error) {
    console.error("❌ Seed error:", error);
    process.exit(1);
  }
};

seed();
