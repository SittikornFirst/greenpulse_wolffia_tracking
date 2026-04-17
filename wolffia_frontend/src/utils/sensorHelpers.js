export const SENSOR_METRICS = {
  ph: { key: "ph", label: "pH", unit: "pH", decimals: 2, color: "#3b82f6" },
  ec: { key: "ec", label: "EC", unit: "mS/cm", decimals: 3, color: "#10b981" },
  tds: { key: "tds", label: "TDS", unit: "ppm", decimals: 0, color: "#8b5cf6" },
  temperature_water_c: { key: "temperature_water_c", label: "Water Temp", unit: "°C", decimals: 1, color: "#ef4444" },
  temperature_air_c: { key: "temperature_air_c", label: "Air Temp", unit: "°C", decimals: 1, color: "#f97316" },
  humidity: { key: "humidity", label: "Humidity", unit: "%", decimals: 1, color: "#06b6d4" },
  light_intensity: { key: "light_intensity", label: "Light", unit: "lux", decimals: 0, color: "#f59e0b" }
};

export function getMetricConfig(key) {
  return SENSOR_METRICS[key] || null;
}

export function formatMetricValue(value, key, decimals = null) {
  if (value === null || value === undefined) return "--";
  
  const config = getMetricConfig(key);
  const dec = decimals ?? config?.decimals ?? 2;
  
  if (typeof value === "object" && "value" in value) {
    value = value.value;
  }
  
  if (typeof value !== "number" || isNaN(value)) return "--";
  
  if (dec === 0) {
    return Math.round(value).toLocaleString();
  }
  
  return Number(value).toFixed(dec);
}

export function getMetricValue(reading, key) {
  if (!reading) return null;
  
  if (typeof reading[key] === "object" && reading[key] !== null) {
    return reading[key].value;
  }
  
  if (reading[`${key}_value`] !== undefined) {
    return reading[`${key}_value`];
  }
  
  return reading[key] ?? null;
}

export function getMetricStatus(value, thresholds, key) {
  if (value === null || value === undefined) return "unknown";
  
  const threshold = thresholds[key];
  if (!threshold) return "unknown";
  
  const { min, max } = threshold;
  
  if (value < min || value > max) return "critical";
  
  const buffer = (max - min) * 0.1;
  if (value < min + buffer || value > max - buffer) return "warning";
  
  return "normal";
}

export function getStatusColor(status) {
  const colors = {
    normal: "#10b981",
    warning: "#f59e0b",
    critical: "#ef4444",
    unknown: "#9ca3af"
  };
  return colors[status] || colors.unknown;
}

export function calculateAverage(reading, keys) {
  const values = keys
    .map(key => getMetricValue(reading, key))
    .filter(v => typeof v === "number" && !isNaN(v) && v > 0);
  
  if (values.length === 0) return null;
  
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function formatTimestamp(timestamp, options = {}) {
  if (!timestamp) return "--";
  
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return "--";
  
  const defaults = {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  };
  
  return date.toLocaleString("en-US", { ...defaults, ...options });
}

export function getTimeAgo(timestamp) {
  if (!timestamp) return "Unknown";
  
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return "Unknown";
  
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 1000 / 60);
  const diffHours = Math.floor(diffMs / 1000 / 60 / 60);
  const diffDays = Math.floor(diffMs / 1000 / 60 / 60 / 24);
  
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return formatTimestamp(timestamp);
}

export function isDeviceOnline(reading, thresholdMinutes = 5) {
  if (!reading?.timestamp) return false;
  
  const now = new Date();
  const lastUpdate = new Date(reading.timestamp);
  const diffMins = (now - lastUpdate) / 1000 / 60;
  
  return diffMins <= thresholdMinutes;
}

export function getDeviceHealthStatus(reading) {
  if (!reading) return { status: "offline", color: "#9ca3af", label: "Offline" };
  
  if (!isDeviceOnline(reading)) {
    return { status: "offline", color: "#9ca3af", label: "Offline" };
  }
  
  if (reading.quality_flag === "error") {
    return { status: "error", color: "#ef4444", label: "Error" };
  }
  
  if (reading.quality_flag === "suspect") {
    return { status: "warning", color: "#f59e0b", label: "Warning" };
  }
  
  return { status: "online", color: "#10b981", label: "Online" };
}

export const TIME_RANGES = [
  { label: "1 Hour", value: "1h", ms: 60 * 60 * 1000 },
  { label: "6 Hours", value: "6h", ms: 6 * 60 * 60 * 1000 },
  { label: "24 Hours", value: "24h", ms: 24 * 60 * 60 * 1000 },
  { label: "7 Days", value: "7d", ms: 7 * 24 * 60 * 60 * 1000 },
  { label: "30 Days", value: "30d", ms: 30 * 24 * 60 * 60 * 1000 },
  { label: "1 Year", value: "1y", ms: 365 * 24 * 60 * 60 * 1000 }
];

export function getTimeRangeMs(range) {
  const found = TIME_RANGES.find(r => r.value === range);
  return found?.ms || TIME_RANGES[2].ms;
}
