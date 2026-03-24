import mongoose from "mongoose";
import dotenv from "dotenv";
import Device from "./models/Device.js";
import dns from "dns";

dns.setServers(["1.1.1.1"]);
dotenv.config();

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);
  try {
    const indexes = await Device.collection.indexes();
    const uniqueIndexes = indexes.filter((i) => i.unique);
    console.log("Unique indexes:", JSON.stringify(uniqueIndexes, null, 2));
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
test();
