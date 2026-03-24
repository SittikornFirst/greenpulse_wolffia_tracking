import mongoose from "mongoose";
import dotenv from "dotenv";
import Device from "./models/Device.js";
import Farm from "./models/Farm.js";
import User from "./models/User.js";
import dns from "dns";

dns.setServers(["1.1.1.1"]);

dotenv.config();

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to DB");

  try {
    const user = await User.findOne({ role: "admin" });
    if (!user) {
      console.log("No admin found");
      process.exit(1);
    }
    const farm = await Farm.findOne({ user_id: user._id });
    if (!farm) {
      console.log("No farm found for admin");
      process.exit(1);
    }

    const deviceData = {
      device_id: "GREENPULSE-V1-TEST-" + Date.now(),
      device_name: "Test Device",
      farm_id: farm._id,
      user_id: user._id,
      location: "Test Location",
      status: "active",
    };

    console.log("Attempting to insert:", deviceData);
    const device = await Device.create(deviceData);
    console.log("Success! Device created:", device._id);
  } catch (e) {
    console.error("Error creating device:", e);
  }
  process.exit(0);
}

test();
