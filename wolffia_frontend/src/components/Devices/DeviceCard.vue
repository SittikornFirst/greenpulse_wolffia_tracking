<template>
  <div class="device-card">
    <div class="device-header">
      <h3 class="device-name">{{ device.device_name }}</h3>
      <div class="device-status-badge" :class="`status-${device.status}`">
        {{ device.status }}
      </div>
    </div>

    <div class="device-info">
      <div class="info-item">
        <span class="info-label">Device ID:</span>
        <span class="info-value">{{ device.device_id }}</span>
      </div>
      
      <div class="info-item">
        <span class="info-label">Type:</span>
        <span class="info-value">{{ device.device_type }}</span>
      </div>
      
      <div class="info-item" v-if="device.farmName">
        <span class="info-label">Farm:</span>
        <span class="info-value">{{ device.farmName }}</span>
      </div>
      
      <div class="info-item" v-if="device.location">
        <span class="info-label">Location:</span>
        <span class="info-value">{{ device.location }}</span>
      </div>
    </div>

    <div class="device-metrics" v-if="device.latestReadings && Object.keys(device.latestReadings).length > 0">
      <div class="metrics-grid">
        <div v-for="(value, key) in device.latestReadings" :key="key" class="metric-item">
          <div class="metric-label">{{ formatMetricKey(key) }}</div>
          <div class="metric-value">{{ formatMetricValue(key, value) }}</div>
          <div class="metric-unit">{{ getMetricUnit(key) }}</div>
        </div>
      </div>
    </div>

    <div class="device-actions">
      <button 
        v-if="device.status === 'active'"
        @click="viewDetails"
        class="btn btn-primary btn-sm"
      >
        View Details
      </button>
      
      <button 
        v-if="device.status === 'active'"
        @click="toggleRelay"
        class="btn btn-secondary btn-sm"
      >
        Toggle Relay
      </button>
      
      <button 
        @click="editDevice"
        class="btn btn-outline btn-sm"
      >
        Edit
      </button>
      
      <button 
        @click="deleteDevice"
        class="btn btn-danger btn-sm"
      >
        Delete
      </button>
    </div>
  </div>
</template>

<script>
import { ref } from "vue";

export default {
  name: "DeviceCard",
  props: {
    device: {
      type: Object,
      required: true
    }
  },
  setup(props) {
    const isEditing = ref(false);
    const isDeleting = ref(false);
    const isTogglingRelay = ref(false);

    const viewDetails = () => {
      // Navigate to device details page
      // This would be implemented with router
      console.log("View details for device:", props.device.device_id);
    };

    const toggleRelay = async () => {
      isTogglingRelay.value = true;
      try {
        // TODO: Implement actual relay toggle via API
        console.log("Toggle relay for device:", props.device.device_id);
        // await apiService.toggleRelay(props.device.device_id);
      } finally {
        isTogglingRelay.value = false;
      }
    };

    const editDevice = () => {
      // Navigate to edit device form
      console.log("Edit device:", props.device.device_id);
    };

    const deleteDevice = async () => {
      if (!window.confirm(`Are you sure you want to delete device ${props.device.device_name}?`)) {
        return;
      }
      
      isDeleting.value = true;
      try {
        // TODO: Implement actual delete via API
        console.log("Delete device:", props.device.device_id);
        // await apiService.deleteDevice(props.device.device_id);
        // Emit event to parent to remove from list
      } finally {
        isDeleting.value = false;
      }
    };

    const formatMetricKey = (key) => {
      const map = {
        ph: "pH",
        ec: "EC",
        tds: "TDS",
        temperature_water_c: "Water Temp",
        temperature_air_c: "Air Temp",
        humidity: "Humidity",
        light_intensity: "Light"
      };
      return map[key] || key;
    };

    const formatMetricValue = (key, value) => {
      if (value === null || value === undefined) return "--";
      
      if (typeof value === "object" && value !== null && "value" in value) {
        value = value.value;
      }
      
      // Format based on metric type
      switch (key) {
        case "ph":
          return typeof value === "number" ? value.toFixed(2) : value;
        case "ec":
          return typeof value === "number" ? value.toFixed(3) : value;
        case "tds":
          return typeof value === "number" ? Math.round(value).toLocaleString() : value;
        case "temperature_water_c":
        case "temperature_air_c":
          return typeof value === "number" ? value.toFixed(1) : value;
        case "humidity":
          return typeof value === "number" ? value.toFixed(1) : value;
        case "light_intensity":
          return typeof value === "number" ? Math.round(value).toLocaleString() : value;
        default:
          return value;
      }
    };

    const getMetricUnit = (key) => {
      const map = {
        ph: "pH",
        ec: "mS/cm",
        tds: "ppm",
        temperature_water_c: "°C",
        temperature_air_c: "°C",
        humidity: "%",
        light_intensity: "lux"
      };
      return map[key] || "";
    };

    return {
      isEditing,
      isDeleting,
      isTogglingRelay,
      viewDetails,
      toggleRelay,
      editDevice,
      deleteDevice,
      formatMetricKey,
      formatMetricValue,
      getMetricUnit
    };
  }
};
</script>

<style scoped>
.device-card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 1px solid #e5e7eb;
  overflow: hidden;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.device-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.device-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: #f8fafc;
  border-bottom: 1px solid #e5e7eb;
}

.device-name {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #1f2937;
}

.device-status-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
}

.device-status-badge.status-active {
  background: #dcfce7;
  color: #166534;
}

.device-status-badge.status-inactive {
  background: #fef3c7;
  color: #92400e;
}

.device-status-badge.status-maintenance {
  background: #fee2e2;
  color: #991b1b;
}

.device-status-badge.status-offline {
  background: #f3f4f6;
  color: #6b7280;
}

.device-info {
  padding: 16px 20px;
}

.info-item {
  display: flex;
  margin-bottom: 8px;
  font-size: 0.875rem;
}

.info-item:last-child {
  margin-bottom: 0;
}

.info-label {
  font-weight: 500;
  color: #6b7280;
  min-width: 80px;
}

.info-value {
  font-weight: 400;
  color: #374151;
}

.device-metrics {
  padding: 16px 20px;
  border-top: 1px solid #f3f4f6;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 12px;
}

.metric-item {
  text-align: center;
}

.metric-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: #6b7280;
  margin-bottom: 4px;
}

.metric-value {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1f2937;
}

.metric-unit {
  font-size: 0.75rem;
  color: #9ca3af;
}

.device-actions {
  display: flex;
  gap: 8px;
  padding: 12px 20px;
  border-top: 1px solid #f3f4f6;
  justify-content: flex-end;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 500;
  font-size: 0.75rem;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
}

.btn-secondary:hover {
  background: #e5e7eb;
}

.btn-outline {
  background: transparent;
  color: #374151;
  border: 1px solid #d1d5db;
}

.btn-outline:hover {
  background: #f3f4f6;
}

.btn-danger {
  background: #fecaca;
  color: #991b1b;
  border: 1px solid #fca5a5;
}

.btn-danger:hover {
  background: #fca5a5;
}

.btn-sm {
  padding: 4px 8px;
  font-size: 0.75rem;
}

/* Loading states */
.btn[disabled],
.is-loading {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Responsive design */
@media (max-width: 640px) {
  .device-card {
    margin-bottom: 16px;
  }
  
  .device-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .device-actions {
    flex-wrap: wrap;
    justify-content: flex-start;
  }
  
  .metrics-grid {
    grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
  }
}
</style>