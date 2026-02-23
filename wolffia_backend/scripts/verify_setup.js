import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/User.js";
import Farm from "../models/Farm.js";
import Device from "../models/Device.js";
import DeviceConfiguration from "../models/DeviceConfiguration.js";

dotenv.config();
import dns from "dns";
dns.setServers(["1.1.1.1"]);

const verifySetup = async () => {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Check Users
    const userCount = await User.countDocuments();
    const adminCount = await User.countDocuments({ role: "admin" });
    const farmerCount = await User.countDocuments({ role: "farmer" });
    console.log(
      `\nUsers: ${userCount} (Admin: ${adminCount}, Farmer: ${farmerCount})`,
    );

    // Check Farms
    const farmCount = await Farm.countDocuments();
    console.log(`Farms: ${farmCount}`);

    // Check Devices
    const deviceCount = await Device.countDocuments();
    console.log(`Devices: ${deviceCount}`);

    // Check consistency
    const devices = await Device.find().populate("farm_id user_id");
    let issues = 0;

    for (const device of devices) {
      if (!device.farm_id) {
        console.warn(`⚠️ Device ${device.device_id} has no Farm associated!`);
        issues++;
      } else if (!device.user_id) {
        console.warn(`⚠️ Device ${device.device_id} has no User associated!`);
        issues++;
      } else {
        // Check if device owner matches farm owner
        if (
          device.farm_id.user_id.toString() !== device.user_id._id.toString()
        ) {
          // This might be valid if we allow admins to own devices on other farms, but generally dangerous
          // Actually, if an admin creates a device for a user, the device owner (user_id) should match the farm owner (user_id).
          // My fix in devices.js ensures device.user_id matches farm.user_id implicitly or explicitly.
          console.log(
            `ℹ️ Device ${device.device_id} User (${device.user_id.email}) matches Farm Owner (${device.farm_id.user_id})? ${device.farm_id.user_id.toString() === device.user_id._id.toString()}`,
          );
        }
      }
    }

    if (issues === 0) {
      console.log("\n✅ Data integrity check passed (no orphaned devices).");
    } else {
      console.log(`\n❌ Found ${issues} data integrity issues.`);
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

verifySetup();
