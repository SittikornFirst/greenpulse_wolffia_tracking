// Threshold configuration for sensor values
// These match the DeviceConfiguration model in the backend

export const THRESHOLDS = {
  ph_value: {
    min: 6.0,
    max: 7.5,
    unit: "",
    label: "pH",
  },
  ec_value: {
    min: 1.0,
    max: 2.5,
    unit: "mS/cm",
    label: "EC",
  },
  tds_value: {
    min: 640, // Derived from EC min * 0.64 * 1000
    max: 1600, // Derived from EC max * 0.64 * 1000
    unit: "ppm",
    label: "TDS",
  },
  water_temperature_c: {
    min: 20,
    max: 28,
    unit: "°C",
    label: "Water Temp",
  },
  air_temperature_c: {
    min: 18,
    max: 35,
    unit: "°C",
    label: "Air Temp",
  },
  air_humidity: {
    min: 60,
    max: 80,
    unit: "%",
    label: "Humidity",
  },
  light_intensity: {
    min: 3500,
    max: 6000,
    unit: "lux",
    label: "Light",
  },
};

// Get status color based on value and thresholds
export function getValueStatus(key, value) {
  if (value === null || value === undefined) return "normal";

  const threshold = THRESHOLDS[key];
  if (!threshold) return "normal";

  const { min, max } = threshold;

  if (value < min * 0.9 || value > max * 1.1) {
    return "critical"; // Red - far outside range
  } else if (value < min || value > max) {
    return "warning"; // Yellow - outside range
  }

  return "normal"; // Green - within range
}

// Get color for status
export function getStatusColor(status) {
  const colors = {
    normal: "#10b981", // Green
    warning: "#f59e0b", // Amber
    critical: "#ef4444", // Red
  };

  return colors[status] || colors.normal;
}

// Get color for a specific value
export function getValueColor(key, value) {
  const status = getValueStatus(key, value);
  return getStatusColor(status);
}

// Update thresholds from device configuration
export function updateThresholdsFromConfig(config) {
  if (!config) return;

  if (config.ph_min !== undefined) {
    THRESHOLDS.ph_value.min = config.ph_min;
    THRESHOLDS.ph_value.max = config.ph_max;
  }
  if (config.ec_value_min !== undefined) {
    THRESHOLDS.ec_value.min = config.ec_value_min;
    THRESHOLDS.ec_value.max = config.ec_value_max;
    // Update TDS based on EC
    THRESHOLDS.tds_value.min = config.ec_value_min * 640;
    THRESHOLDS.tds_value.max = config.ec_value_max * 640;
  }
  if (config.water_temp_min !== undefined) {
    THRESHOLDS.water_temperature_c.min = config.water_temp_min;
    THRESHOLDS.water_temperature_c.max = config.water_temp_max;
  }
  if (config.air_temp_min !== undefined) {
    THRESHOLDS.air_temperature_c.min = config.air_temp_min;
    THRESHOLDS.air_temperature_c.max = config.air_temp_max;
  }
  if (config.light_intensity_min !== undefined) {
    THRESHOLDS.light_intensity.min = config.light_intensity_min;
    THRESHOLDS.light_intensity.max = config.light_intensity_max;
  }
}

// Get thresholds object (useful for reactive access)
export function getThresholds() {
  return { ...THRESHOLDS };
}
