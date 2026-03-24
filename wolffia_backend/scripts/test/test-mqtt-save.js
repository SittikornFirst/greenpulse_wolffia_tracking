import mongoose from "mongoose";
import dotenv from "dotenv";
import Device from "./models/Device.js";
import SensorData from "./models/SensorData.js";
import crypto from "crypto";
import dns from "dns";

dns.setServers(["1.1.1.1"]);
dotenv.config();

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to DB");

  try {
    const topic = "greenpulse/sensors";
    const payloadStr = `{"ts":"2026-02-25 13:38:29","water_c":29.19,"air_c":26.42,"hum":56.9,"lux":14.2,"ph":{"adc":0,"v":0.000,"val":-1.86},"tds":{"adc":176,"v":0.142,"ppm":54,"ec":0.027}}`;
    const data = JSON.parse(payloadStr);

    let deviceIdFromTopic = "GREENPULSE-V1-MKUMW0RG-1JS0A";
    let device = await Device.findOne({ device_id: deviceIdFromTopic });

    if (!device) {
      console.error(`Device not found: ${deviceIdFromTopic}`);
      process.exit(1);
    }
    console.log("Found device:", device._id);

    const getPh = (d) =>
      d.ph?.val ?? (typeof d.ph === "number" ? d.ph : undefined);
    const getEc = (d) => d.tds?.ec ?? d.ec_ms ?? d.ec;
    const getTds = (d) =>
      d.tds?.ppm ??
      d.tds_ppm ??
      (typeof d.tds === "number" ? d.tds : undefined);
    const getWater = (d) => d.water_c ?? d.water_temp;
    const getAir = (d) => d.air_c ?? d.air_temp;
    const getHum = (d) => d.hum ?? d.humidity;
    const getLux = (d) => d.lux ?? d.light_lux ?? d.light;

    const newSensorData = new SensorData({
      device_id: device._id,
      data_id: crypto.randomUUID(),
      ph_value: getPh(data),
      ec_value: getEc(data),
      tds_value: getTds(data),
      water_temperature_c: getWater(data),
      air_temperature_c: getAir(data),
      air_humidity: getHum(data),
      light_intensity: getLux(data),
      timestamp: new Date(),
    });

    console.log("Attempting to save:", newSensorData.toObject());
    await newSensorData.save();
    console.log("Success!");
  } catch (e) {
    console.error("Save failed:", e);
  }
  process.exit(0);
}

test();
