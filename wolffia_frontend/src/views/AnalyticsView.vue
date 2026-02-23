<template>
  <div class="analytics-view">
    <div class="analytics-header">
      <div>
        <h1>Device Analytics</h1>
        <p class="subtitle">Review sensor readings for a specific device</p>
      </div>
      <div class="header-actions">
        <div class="device-selector" v-if="hasDevices">
          <label for="analytics-device">Device</label>
          <select id="analytics-device" v-model="selectedDeviceId">
            <option
              v-for="device in devices"
              :key="device._id || device.device_id"
              :value="device.device_id"
            >
              {{ device.device_name }}
            </option>
          </select>
        </div>
        <div class="entries-selector">
          <label for="entries-per-page">Show</label>
          <select id="entries-per-page" v-model="entriesPerPage">
            <option :value="5">5</option>
            <option :value="10">10</option>
            <option :value="50">50</option>
            <option :value="100">100</option>
          </select>
          <span>entries</span>
        </div>
        <button
          @click="refreshData"
          :disabled="loading"
          class="btn btn-primary"
        >
          <RefreshCw :size="18" :class="{ spin: loading }" />
          <span>Refresh</span>
        </button>
      </div>
    </div>

    <div v-if="!hasDevices" class="analytics-empty">
      <Cpu :size="56" />
      <h3>No devices yet</h3>
      <p>Add a device to view analytics.</p>
      <router-link to="/devices" class="btn btn-primary"
        >Add Device</router-link
      >
    </div>

    <div
      v-else-if="hasDevices && tableRows.length === 0"
      class="analytics-empty"
    >
      <Activity :size="48" />
      <h3>No data available</h3>
      <p>This device has no sensor data yet. Waiting for readings...</p>
    </div>

    <template v-else-if="hasDevices && tableRows.length > 0">
      <div class="metrics-grid">
        <MetricCard
          v-for="metric in metricCards"
          :key="metric.id"
          :title="metric.title"
          :value="metric.value"
          :unit="metric.unit"
          :icon="metric.icon"
          :status="metric.status"
          :range-min="metric.rangeMin"
          :range-max="metric.rangeMax"
          :loading="loading"
        />
      </div>

      <div class="data-table-section">
        <div class="table-header">
          <h2>Recent Readings</h2>
          <span class="table-subtitle"
            >Showing latest {{ tableRows.length }} entries</span
          >
        </div>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>pH</th>
                <th>Water Temp (°C)</th>
                <th>Air Temp (°C)</th>
                <th>Air Humidity (%)</th>
                <th>EC (mS/cm)</th>
                <th>TDS (ppm)</th>
                <th>Light (lux)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(reading, idx) in tableRows" :key="idx">
                <td class="timestamp-cell">
                  {{ formatTimestamp(reading.timestamp) }}
                </td>
                <td
                  class="value-cell"
                  :style="{
                    color: getValueColor('ph_value', reading.ph?.value),
                  }"
                >
                  {{ formatValue(reading.ph?.value) }}
                </td>
                <td
                  class="value-cell"
                  :style="{
                    color: getValueColor(
                      'water_temperature_c',
                      reading.temperature_water_c?.value,
                    ),
                  }"
                >
                  {{ formatValue(reading.temperature_water_c?.value) }}
                </td>
                <td
                  class="value-cell"
                  :style="{
                    color: getValueColor(
                      'air_temperature_c',
                      reading.temperature_air_c?.value,
                    ),
                  }"
                >
                  {{ formatValue(reading.temperature_air_c?.value) }}
                </td>
                <td
                  class="value-cell"
                  :style="{
                    color: getValueColor(
                      'air_humidity',
                      reading.humidity?.value,
                    ),
                  }"
                >
                  {{ formatValue(reading.humidity?.value) }}
                </td>
                <td
                  class="value-cell"
                  :style="{
                    color: getValueColor('ec_value', reading.ec?.value),
                  }"
                >
                  {{ formatValue(reading.ec?.value) }}
                </td>
                <td
                  class="value-cell"
                  :style="{
                    color: getValueColor('tds_value', reading.tds?.value),
                  }"
                >
                  {{ formatInteger(reading.tds?.value) }}
                </td>
                <td
                  class="value-cell"
                  :style="{
                    color: getValueColor(
                      'light_intensity',
                      reading.light_intensity?.value,
                    ),
                  }"
                >
                  {{ formatInteger(reading.light_intensity?.value) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div v-if="totalPages > 1" class="pagination">
          <button
            @click="currentPage--"
            :disabled="currentPage === 1"
            class="btn btn-secondary btn-sm"
          >
            Previous
          </button>
          <span class="pagination-info">
            Page {{ currentPage }} of {{ totalPages }} ({{ totalEntries }} total
            entries)
          </span>
          <button
            @click="currentPage++"
            :disabled="currentPage === totalPages"
            class="btn btn-secondary btn-sm"
          >
            Next
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<script>
import { ref, computed, onMounted, watch } from "vue";
import {
  RefreshCw,
  MapPin,
  Cpu,
  Droplet,
  Thermometer,
  Sun,
  Activity,
} from "lucide-vue-next";
import { useSensorDataStore } from "@/stores/module/sensorData";
import { useDevicesStore } from "@/stores/module/devices";
import { useFarmsStore } from "@/stores/module/farms";
import {
  getValueColor,
  getValueStatus,
  THRESHOLDS,
  updateThresholdsFromConfig,
} from "@/utils/thresholds";
import MetricCard from "@/components/Dashboard/MetricCard.vue";

export default {
  name: "AnalyticsView",
  components: {
    RefreshCw,
    MapPin,
    Cpu,
    MetricCard,
  },
  setup() {
    const sensorDataStore = useSensorDataStore();
    const devicesStore = useDevicesStore();
    const farmsStore = useFarmsStore();

    const loading = ref(false);
    const allTableRows = ref([]); // All data
    const currentPage = ref(1);
    const entriesPerPage = ref(10);
    const selectedDeviceId = ref(null);

    const devices = computed(() => devicesStore.devices);
    const hasDevices = computed(() => devices.value.length > 0);

    const metricCards = computed(() => {
      if (!allTableRows.value || !allTableRows.value.length) {
        return [
          {
            id: "ph",
            title: "Avg pH",
            value: "--",
            unit: "pH",
            icon: "Droplet",
            status: "unknown",
            rangeMin: THRESHOLDS.ph_value.min,
            rangeMax: THRESHOLDS.ph_value.max,
          },
          {
            id: "water_temp",
            title: "Avg Water Temp",
            value: "--",
            unit: "°C",
            icon: "Thermometer",
            status: "unknown",
            rangeMin: THRESHOLDS.water_temperature_c.min,
            rangeMax: THRESHOLDS.water_temperature_c.max,
          },
          {
            id: "air_temp",
            title: "Avg Air Temp",
            value: "--",
            unit: "°C",
            icon: "Thermometer",
            status: "unknown",
            rangeMin: THRESHOLDS.air_temperature_c.min,
            rangeMax: THRESHOLDS.air_temperature_c.max,
          },
          {
            id: "humidity",
            title: "Avg Air Humidity",
            value: "--",
            unit: "%",
            icon: "Droplet",
            status: "unknown",
            rangeMin: THRESHOLDS.air_humidity.min,
            rangeMax: THRESHOLDS.air_humidity.max,
          },
          {
            id: "ec",
            title: "Avg EC",
            value: "--",
            unit: "mS/cm",
            icon: "Activity",
            status: "unknown",
            rangeMin: THRESHOLDS.ec_value.min,
            rangeMax: THRESHOLDS.ec_value.max,
          },
          {
            id: "tds",
            title: "Avg TDS",
            value: "--",
            unit: "ppm",
            icon: "Activity",
            status: "unknown",
            rangeMin: THRESHOLDS.tds_value.min,
            rangeMax: THRESHOLDS.tds_value.max,
          },
          {
            id: "light",
            title: "Avg Light",
            value: "--",
            unit: "lux",
            icon: "Sun",
            status: "unknown",
            rangeMin: THRESHOLDS.light_intensity.min,
            rangeMax: THRESHOLDS.light_intensity.max,
          },
        ];
      }

      const avg = (key) => {
        const values = tableRows.value
          .map((row) => row[key]?.value)
          .filter((value) => typeof value === "number");
        if (!values.length) return null;
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        return mean;
      };

      const formatAvg = (key, avgVal) => {
        if (avgVal === null) return "--";
        return key === "ph_value" || key === "ec_value"
          ? avgVal.toFixed(2)
          : key.includes("temperature") || key === "humidity"
            ? avgVal.toFixed(1)
            : Math.round(avgVal).toLocaleString();
      };

      const avgPh = avg("ph");
      const avgWaterTemp = avg("temperature_water_c");
      const avgAirTemp = avg("temperature_air_c");
      const avgHumidity = avg("humidity");
      const avgEc = avg("ec");
      const avgTds = avg("tds");
      const avgLight = avg("light_intensity");

      return [
        {
          id: "ph",
          title: "Avg pH",
          value: formatAvg("ph_value", avgPh),
          unit: "pH",
          icon: "Droplet",
          status: getValueStatus("ph_value", avgPh),
          rangeMin: THRESHOLDS.ph_value.min,
          rangeMax: THRESHOLDS.ph_value.max,
        },
        {
          id: "water_temp",
          title: "Avg Water Temp",
          value: formatAvg("temperature", avgWaterTemp),
          unit: "°C",
          icon: "Thermometer",
          status: getValueStatus("water_temperature_c", avgWaterTemp),
          rangeMin: THRESHOLDS.water_temperature_c.min,
          rangeMax: THRESHOLDS.water_temperature_c.max,
        },
        {
          id: "air_temp",
          title: "Avg Air Temp",
          value: formatAvg("temperature", avgAirTemp),
          unit: "°C",
          icon: "Thermometer",
          status: getValueStatus("air_temperature_c", avgAirTemp),
          rangeMin: THRESHOLDS.air_temperature_c.min,
          rangeMax: THRESHOLDS.air_temperature_c.max,
        },
        {
          id: "humidity",
          title: "Avg Air Humidity",
          value: formatAvg("humidity", avgHumidity),
          unit: "%",
          icon: "Droplet",
          status: getValueStatus("air_humidity", avgHumidity),
          rangeMin: THRESHOLDS.air_humidity.min,
          rangeMax: THRESHOLDS.air_humidity.max,
        },
        {
          id: "ec",
          title: "Avg EC",
          value: formatAvg("ec_value", avgEc),
          unit: "mS/cm",
          icon: "Activity",
          status: getValueStatus("ec_value", avgEc),
          rangeMin: THRESHOLDS.ec_value.min,
          rangeMax: THRESHOLDS.ec_value.max,
        },
        {
          id: "tds",
          title: "Avg TDS",
          value: formatAvg("tds_value", avgTds),
          unit: "ppm",
          icon: "Activity",
          status: getValueStatus("tds_value", avgTds),
          rangeMin: THRESHOLDS.tds_value.min,
          rangeMax: THRESHOLDS.tds_value.max,
        },
        {
          id: "light",
          title: "Avg Light",
          value: formatAvg("light_intensity", avgLight),
          unit: "lux",
          icon: "Sun",
          status: getValueStatus("light_intensity", avgLight),
          rangeMin: THRESHOLDS.light_intensity.min,
          rangeMax: THRESHOLDS.light_intensity.max,
        },
      ];
    });

    // Pagination computeds
    const totalEntries = computed(() => allTableRows.value.length);
    const totalPages = computed(
      () => Math.ceil(totalEntries.value / entriesPerPage.value) || 1,
    );

    const tableRows = computed(() => {
      const start = (currentPage.value - 1) * entriesPerPage.value;
      const end = start + entriesPerPage.value;
      return allTableRows.value.slice(start, end);
    });

    const refreshData = async () => {
      if (!selectedDeviceId.value) return;
      loading.value = true;
      allTableRows.value = []; // Clear existing data
      currentPage.value = 1; // Reset to first page

      try {
        const device = devices.value.find(
          (d) => d.device_id === selectedDeviceId.value,
        );
        if (!device) {
          allTableRows.value = [];
          return;
        }

        // Update thresholds from device configuration
        if (device.config_id || device.configuration) {
          const config =
            typeof device.config_id === "object"
              ? device.config_id
              : device.configuration;
          if (config) {
            updateThresholdsFromConfig(config);
          }
        }

        const history = await sensorDataStore.fetchHistoricalData(
          device.device_id,
          { range: "24h", limit: 500 }, // Fetch more for pagination
        );
        allTableRows.value = history || [];
      } catch (error) {
        console.error("Failed to load analytics:", error);
        allTableRows.value = [];
      } finally {
        loading.value = false;
      }
    };

    // Watch for device or entries changes
    watch(selectedDeviceId, async (newVal) => {
      if (newVal) {
        await refreshData();
      }
    });

    watch(entriesPerPage, () => {
      currentPage.value = 1; // Reset to first page when changing entries per page
    });

    onMounted(async () => {
      await devicesStore.fetchDevices();
      if (devices.value.length > 0) {
        selectedDeviceId.value = devices.value[0].device_id;
        await refreshData();
      }
    });

    const formatTimestamp = (timestamp) => {
      if (!timestamp) return "--";
      return new Date(timestamp).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    };

    const formatValue = (value) => {
      if (value === undefined || value === null) return "--";
      return Number(value).toFixed(2);
    };

    const formatInteger = (value) => {
      if (value === undefined || value === null) return "--";
      return Math.round(value).toLocaleString();
    };

    return {
      loading,
      devices,
      hasDevices,
      selectedDeviceId,
      entriesPerPage,
      currentPage,
      totalPages,
      totalEntries,
      metricCards,
      tableRows,
      allTableRows,
      refreshData,
      formatTimestamp,
      formatValue,
      formatInteger,
      getValueColor,
    };
  },
};
</script>

<style scoped>
.analytics-view {
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
}

.analytics-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
}

.analytics-header h1 {
  font-size: 2rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 0.5rem 0;
}

.subtitle {
  color: #6b7280;
  margin: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  background: white;
  padding: 0.75rem 1.25rem;
  border-radius: 1rem;
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.05),
    0 2px 4px -1px rgba(0, 0, 0, 0.03);
  border: 1px solid rgba(229, 231, 235, 0.5);
  transition: all 0.3s ease;
}

.header-actions:hover {
  box-shadow:
    0 10px 15px -3px rgba(0, 0, 0, 0.05),
    0 4px 6px -2px rgba(0, 0, 0, 0.025);
}

.device-selector,
.entries-selector {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: #f9fafb;
  padding: 0.375rem 0.5rem 0.375rem 1rem;
  border-radius: 0.75rem;
  border: 1px solid #e5e7eb;
  transition: all 0.2s ease;
}

.device-selector:focus-within,
.entries-selector:focus-within {
  border-color: #10b981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
  background: white;
}

.device-selector label,
.entries-selector label {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  color: #6b7280;
  letter-spacing: 0.05em;
}

.entries-selector span {
  font-size: 0.875rem;
  color: #6b7280;
  font-weight: 500;
  padding-right: 0.5rem;
}

.device-selector select,
.entries-selector select {
  border: none;
  background: transparent;
  font-size: 0.95rem;
  font-weight: 600;
  color: #1f2937;
  cursor: pointer;
  padding: 0.25rem 1.5rem 0.25rem 0.25rem;
  appearance: none;
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
  background-position: right 0.25rem center;
  background-repeat: no-repeat;
  background-size: 1.25rem;
  outline: none;
}

.farm-selector {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.farm-selector label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  color: #6b7280;
}

.farm-selector select {
  min-width: 200px;
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  background: white;
  font-size: 0.875rem;
  cursor: pointer;
}

.farm-selector select:focus {
  outline: none;
  border-color: #10b981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
}

.time-select {
  padding: 0.75rem 1rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  background: white;
  cursor: pointer;
  font-weight: 500;
}

.btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem 1.25rem;
  border: none;
  border-radius: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.btn-primary {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  box-shadow:
    0 4px 6px -1px rgba(16, 185, 129, 0.3),
    0 2px 4px -1px rgba(16, 185, 129, 0.2);
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow:
    0 8px 12px -2px rgba(16, 185, 129, 0.4),
    0 4px 6px -2px rgba(16, 185, 129, 0.2);
  background: linear-gradient(135deg, #34d399 0%, #059669 100%);
}

.btn-primary:active {
  transform: translateY(1px);
  box-shadow:
    0 2px 4px -1px rgba(16, 185, 129, 0.3),
    0 1px 2px -1px rgba(16, 185, 129, 0.2);
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
}

.btn-secondary:hover {
  background: #e5e7eb;
}

.analytics-empty {
  border: 1px dashed #d1d5db;
  border-radius: 0.75rem;
  padding: 3rem 2rem;
  text-align: center;
  color: #6b7280;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: center;
  background: white;
}

.analytics-empty svg {
  color: #d1d5db;
}

.analytics-empty h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.analytics-empty p {
  margin: 0;
}

.btn-sm {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.25rem;
  margin-bottom: 2rem;
}

.metric-card {
  background: linear-gradient(135deg, #ffffff 0%, #f9fafb 100%);
  border-radius: 0.75rem;
  padding: 1.5rem;
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06);
  transition:
    transform 0.2s,
    box-shadow 0.2s;
}

.metric-card:hover {
  transform: translateY(-2px);
  box-shadow:
    0 10px 15px -3px rgba(0, 0, 0, 0.1),
    0 4px 6px -2px rgba(0, 0, 0, 0.05);
}

.metric-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #6b7280;
  margin-bottom: 1rem;
}

.metric-value {
  font-size: 2rem;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 0.5rem;
}

.metric-change {
  font-size: 0.875rem;
  font-weight: 500;
}

.metric-change--up {
  color: #059669;
}

.metric-change--down {
  color: #dc2626;
}

.charts-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.chart-card-full,
.chart-card {
  background: white;
  border-radius: 0.75rem;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.charts-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.chart-header h2,
.chart-header h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.chart-legend {
  display: flex;
  gap: 1.5rem;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #6b7280;
}

.legend-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.chart-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  background: #f9fafb;
  border-radius: 0.5rem;
  color: #9ca3af;
  text-align: center;
}

.chart-placeholder--small {
  padding: 2rem;
}

.chart-placeholder p {
  margin-top: 1rem;
  font-size: 0.875rem;
}

.data-table-section {
  background: white;
  border-radius: 0.75rem;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  margin-bottom: 2rem;
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.table-header h2 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.table-actions {
  display: flex;
  gap: 0.75rem;
}

.search-input {
  padding: 0.5rem 1rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  font-size: 0.875rem;
}

.table-container {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th {
  text-align: left;
  padding: 0.75rem 1rem;
  background: #f9fafb;
  color: #6b7280;
  font-weight: 600;
  font-size: 0.875rem;
  border-bottom: 2px solid #e5e7eb;
}

.data-table td {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #e5e7eb;
  font-size: 0.875rem;
}

.data-table tbody tr:hover {
  background-color: #f9fafb;
}

.timestamp-cell {
  color: #6b7280;
  font-size: 0.8125rem;
}

.device-cell {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.value-cell {
  font-weight: 600;
  color: #1f2937;
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: capitalize;
}

.status-badge--normal {
  background: #d1fae5;
  color: #059669;
}

.status-badge--warning {
  background: #fef3c7;
  color: #d97706;
}

.status-badge--critical {
  background: #fee2e2;
  color: #dc2626;
}

.table-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #e5e7eb;
}

.results-info,
.page-info {
  font-size: 0.875rem;
  color: #6b7280;
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.summary-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1.5rem;
}

.summary-card {
  background: white;
  border-radius: 0.75rem;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.summary-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
  color: #10b981;
}

.summary-header h3 {
  font-size: 1rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.summary-value {
  font-size: 2rem;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 0.5rem;
}

.summary-text {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0;
}

@media (max-width: 768px) {
  .analytics-view {
    padding: 1rem;
  }

  .analytics-header {
    flex-direction: column;
    gap: 1rem;
  }

  .header-actions {
    width: 100%;
    flex-direction: column;
  }

  .header-actions .btn {
    width: 100%;
    justify-content: center;
  }

  .table-header {
    flex-direction: column;
    gap: 1rem;
  }

  .table-actions {
    width: 100%;
    flex-direction: column;
  }

  .search-input {
    width: 100%;
  }

  .table-footer {
    flex-direction: column;
    gap: 1rem;
  }

  .pagination-controls {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
