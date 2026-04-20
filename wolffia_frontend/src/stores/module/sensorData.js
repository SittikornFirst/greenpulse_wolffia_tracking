// stores/sensorData.js
import { defineStore } from "pinia";
import { ref, computed } from "vue";
import apiService from "@/services/api";

const normalizeReading = (reading) => {
  if (!reading) return null;

  // Backend sends virtual metrics like { ph: { value: 7.2, status: 'normal' } }
  // And also raw fields like ph_value, ec_value
  const normalized = {
    ...reading,
    deviceId: reading.deviceId || reading.device_id,
    timestamp: reading.timestamp || reading.created_at,
  };

  // Ensure virtual metrics exist for dashboard consumption
  if (reading.ph_value !== undefined && !reading.ph) {
    normalized.ph = { value: reading.ph_value, status: "normal" };
  }
  if (reading.ec_value !== undefined && !reading.ec) {
    const ecInMs = reading.ec_value >= 100 ? reading.ec_value / 1000 : reading.ec_value;
    normalized.ec = { value: ecInMs, status: "normal" };
  }
  if (reading.tds_value !== undefined && !reading.tds) {
    normalized.tds = { value: reading.tds_value, status: "normal" };
  }
  if (
    reading.water_temperature_c !== undefined &&
    !reading.temperature_water_c
  ) {
    normalized.temperature_water_c = {
      value: reading.water_temperature_c,
      status: "normal",
    };
  }
  if (reading.air_temperature_c !== undefined && !reading.temperature_air_c) {
    normalized.temperature_air_c = {
      value: reading.air_temperature_c,
      status: "normal",
    };
  }
  if (
    reading.light_intensity !== undefined &&
    !reading.light_intensity?.value
  ) {
    normalized.light_intensity = {
      value: reading.light_intensity,
      status: "normal",
    };
  }
  if (
    reading.air_humidity !== undefined &&
    !reading.humidity?.value
  ) {
    normalized.humidity = {
      value: reading.air_humidity,
      status: "normal",
    };
  }

  return normalized;
};

export const useSensorDataStore = defineStore("sensorData", () => {
  const sensorReadings = ref({});
  const latestReadings = ref({});
  const historicalData = ref({});
  const loading = ref(false);
  const error = ref(null);
  const realtimeConnected = ref(false);

  const thresholds = ref({
    ph: { min: 6.5, max: 7.5 },
    water_temperature_c: { min: 20, max: 28 },
    air_temperature_c: { min: 18, max: 35 },
    air_humidity: { min: 60, max: 80 },
    light_intensity: { min: 3500, max: 6000 },
    ec_value: { min: 1.0, max: 2.5 },
    tds_value: { min: 640, max: 1600 },
  });

  // Getters (regular functions for clarity and proper reactivity)
  function getLatestReading(deviceId) {
    return latestReadings.value[deviceId];
  }

  function getHistoricalData(deviceId, range = "24h") {
    return historicalData.value[`${deviceId}_${range}`] || [];
  }

  const getSensorStatus = computed(() => (deviceId) => {
    const reading = latestReadings.value[deviceId];
    if (!reading) return "unknown";

    if (reading?.quality_flag === "error") return "critical";
    if (reading?.quality_flag === "suspect") return "warning";
    return "normal";
  });

  function getAverageReading(deviceId, range = "24h") {
    const data = historicalData.value[`${deviceId}_${range}`];
    if (!data || data.length === 0) return null;

    const sum = data.reduce((acc, reading) => {
      const value = reading.value ?? reading.ph?.value ?? reading.ec?.value ?? reading.tds?.value ?? reading.temperature_water_c?.value ?? reading.temperature_air_c?.value ?? reading.humidity?.value ?? reading.light_intensity?.value;
      return acc + (typeof value === 'number' ? value : 0);
    }, 0);
    return sum / data.length;
  }

  function getTrend(deviceId, range = "24h") {
    const data = historicalData.value[`${deviceId}_${range}`];
    if (!data || data.length < 2) return 0;

    const recent = data.slice(-10);
    const earlier = data.slice(-20, -10);

    if (earlier.length === 0) return 0;

    const getValue = (r) => r.value ?? r.ph?.value ?? r.ec?.value ?? r.tds?.value ?? r.temperature_water_c?.value ?? r.temperature_air_c?.value ?? r.humidity?.value ?? r.light_intensity?.value ?? 0;

    const recentAvg = recent.reduce((sum, r) => sum + getValue(r), 0) / recent.length;
    const earlierAvg = earlier.reduce((sum, r) => sum + getValue(r), 0) / earlier.length;

    if (earlierAvg === 0) return 0;

    return ((recentAvg - earlierAvg) / earlierAvg) * 100;
  }

  // Statistics helpers
  function getStatistics(deviceId, range = "24h") {
    const data = historicalData.value[`${deviceId}_${range}`];
    if (!data || data.length === 0) {
      return {
        min: 0,
        max: 0,
        avg: 0,
        count: 0,
      };
    }

    const getValue = (r) => r.value ?? r.ph?.value ?? r.ec?.value ?? r.tds?.value ?? r.temperature_water_c?.value ?? r.temperature_air_c?.value ?? r.humidity?.value ?? r.light_intensity?.value;
    const values = data.map(getValue).filter(v => typeof v === 'number' && !isNaN(v));

    if (values.length === 0) {
      return { min: 0, max: 0, avg: 0, count: 0 };
    }

    return {
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((sum, v) => sum + v, 0) / values.length,
      count: values.length,
    };
  }

  // Actions
  async function fetchLatestReadings(deviceId = null) {
    loading.value = true;
    error.value = null;

    try {
      const response = await apiService.getLatestReadings(deviceId);

      if (deviceId) {
        latestReadings.value[deviceId] = normalizeReading(response.data);
      } else {
        (response.data || []).forEach((reading) => {
          const normalized = normalizeReading(reading);
          if (normalized.deviceId) {
            latestReadings.value[normalized.deviceId] = normalized;
          }
        });
      }

      return response.data;
    } catch (err) {
      error.value = err.message || "Failed to fetch latest readings";
      console.error("Error fetching latest readings:", err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function fetchHistoricalData(deviceId, options = {}) {
    const { range = "1h", startDate, endDate } = options;
    loading.value = true;
    error.value = null;

    const rangeLimits = { "1h": 200, "4h": 400, "12h": 500, "24h": 500, "5d": 500, "7d": 500, "15d": 500, "30d": 500, "all": 500 };

    try {
      const response = await apiService.getHistoricalData(deviceId, {
        range,
        startDate,
        endDate,
        page: options.page,
        limit: options.limit || rangeLimits[range] || 200,
      });

      const resData = response.data;
      const key = `${deviceId}_${range}`;
      
      if (resData && Array.isArray(resData.data)) {
        historicalData.value[key] = resData.data.map(normalizeReading);
      } else if (Array.isArray(resData)) {
        historicalData.value[key] = resData.map(normalizeReading);
      } else {
        historicalData.value[key] = [];
      }

      return response.data;
    } catch (err) {
      error.value = err.message || "Failed to fetch historical data";
      console.error("Error fetching historical data:", err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function submitSensorReading(reading) {
    try {
      const response = await apiService.submitReading(reading);

      latestReadings.value[reading.deviceId] = normalizeReading(response.data);

      const key = `${reading.deviceId}_24h`;
      if (historicalData.value[key]) {
        historicalData.value[key].push(response.data);

        if (historicalData.value[key].length > 100) {
          historicalData.value[key].shift();
        }
      }

      return response.data;
    } catch (err) {
      console.error("Error submitting reading:", err);
      throw err;
    }
  }

  function updateRealtimeReading(reading) {
    const normalized = normalizeReading({
      ...reading,
      timestamp: reading.timestamp || new Date().toISOString(),
    });
    latestReadings.value[normalized.deviceId] = normalized;

    const key = `${reading.deviceId}_24h`;
    if (historicalData.value[key]) {
      historicalData.value[key].push(reading);

      if (historicalData.value[key].length > 100) {
        historicalData.value[key].shift();
      }
    }
  }

  function updateThreshold() {
    console.warn("Global threshold editing is not supported in this release.");
  }

  function setRealtimeConnection(connected) {
    realtimeConnected.value = connected;
  }

  function clearHistoricalData(deviceId = null) {
    if (deviceId) {
      Object.keys(historicalData.value)
        .filter((key) => key.startsWith(deviceId))
        .forEach((key) => delete historicalData.value[key]);
    } else {
      historicalData.value = {};
    }
  }

  function clearError() {
    error.value = null;
  }

  // Export data to CSV
  function exportToCSV(deviceId, range = "24h") {
    const data = historicalData.value[`${deviceId}_${range}`];
    if (!data || data.length === 0) return null;

    const headers = ["Timestamp", "Device ID", "Value", "Type", "Status"];
    const rows = data.map((reading) => [
      new Date(reading.timestamp).toISOString(),
      reading.deviceId,
      reading.value,
      reading.type,
      reading.status || "normal",
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");

    return csv;
  }

  // Reset store
  function $reset() {
    sensorReadings.value = {};
    latestReadings.value = {};
    historicalData.value = {};
    loading.value = false;
    error.value = null;
    realtimeConnected.value = false;
  }

  return {
    // State
    sensorReadings,
    latestReadings,
    historicalData,
    loading,
    error,
    realtimeConnected,
    thresholds,

    // Getters
    getLatestReading,
    getHistoricalData,
    getSensorStatus,
    getAverageReading,
    getTrend,
    getStatistics,

    // Actions
    fetchLatestReadings,
    fetchHistoricalData,
    submitSensorReading,
    updateRealtimeReading,
    updateThreshold,
    setRealtimeConnection,
    clearHistoricalData,
    clearError,
    exportToCSV,
    $reset,
  };
});
