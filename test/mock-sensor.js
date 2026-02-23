import axios from "axios";

// Configuration
const BACKEND_URL = "http://localhost:3000";
const DEVICE_ID = "GREENPULSE-V1-MKUMW0RG-1JS0A"; // Match your actual device ID
const INTERVAL_MS = 15000; // Send data every 5 seconds

// Generate realistic sensor readings with some variation
function generateSensorData() {
  const baseValues = {
    ph: 6.8,
    waterTemp: 24,
    airTemp: 28,
    ec: 1.8,
    tds: 900,
    lightIntensity: 5000,
    humidity: 65,
  };

  // Add random variation
  const variation = (base, range) => base + (Math.random() - 0.5) * range;

  return {
    device_id: DEVICE_ID,
    ph_value: parseFloat(variation(baseValues.ph, 0.3).toFixed(2)),
    water_temperature_c: parseFloat(
      variation(baseValues.waterTemp, 2).toFixed(1),
    ),
    air_temperature_c: parseFloat(variation(baseValues.airTemp, 3).toFixed(1)),
    ec_value: parseFloat(variation(baseValues.ec, 0.2).toFixed(2)),
    tds_value: Math.round(variation(baseValues.tds, 100)),
    light_intensity: Math.round(variation(baseValues.lightIntensity, 1000)),
    air_humidity: parseFloat(variation(baseValues.humidity, 5).toFixed(1)),
    timestamp: new Date().toISOString(),
  };
}

// Send sensor data to backend
async function sendSensorData() {
  try {
    const data = generateSensorData();
    console.log(`📡 Sending sensor data:`, {
      pH: data.ph_value,
      waterTemp: data.water_temperature_c,
      EC: data.ec_value,
    });

    const response = await axios.post(`${BACKEND_URL}/api/sensor-data`, data);

    console.log("✅ Data sent successfully:", response.data);
  } catch (error) {
    console.error(
      "❌ Error sending data:",
      error.response?.data || error.message,
    );
  }
}

// Main loop
console.log("🌱 Mock Sensor Device Started");
console.log(`📍 Device ID: ${DEVICE_ID}`);
console.log(`⏱️  Sending data every ${INTERVAL_MS / 1000} seconds\n`);

// Send initial data immediately
sendSensorData();

// Then send at regular intervals
setInterval(sendSensorData, INTERVAL_MS);
