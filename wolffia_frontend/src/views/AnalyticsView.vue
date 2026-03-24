<template>
  <div class="analytics-view">
    <div class="analytics-header">
      <div>
        <h1>Device Analytics</h1>
        <p class="subtitle">Review sensor readings for a specific device</p>
      </div>
      <div class="header-actions">
        <div class="control-group">
          <div class="device-selector" v-if="hasDevices">
            <label for="analytics-device">Device</label>
            <div class="select-wrapper">
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
          </div>
          <div class="entries-selector">
            <label for="analytics-time">Time Range</label>
            <div class="select-wrapper">
              <select id="analytics-time" v-model="timeRange">
                <option value="1h">1 Hour</option>
                <option value="6h">6 Hours</option>
                <option value="24h">24 Hours</option>
                <option value="7d">7 Days</option>
                <option value="30d">30 Days</option>
                <option value="1y">1 Year</option>
                <option value="all">All</option>
              </select>
            </div>
          </div>
          <div class="entries-selector">
            <label for="entries-per-page">Show</label>
            <div class="select-wrapper">
              <select id="entries-per-page" v-model="entriesPerPage">
                <option :value="5">5</option>
                <option :value="10">10</option>
                <option :value="25">25</option>
                <option :value="50">50</option>
                <option :value="100">100</option>
              </select>
            </div>
          </div>
        </div>
        <button
          @click="refreshData"
          :disabled="loading"
          class="btn btn-primary refresh-btn"
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
        <div v-if="totalPages > 1 || totalEntries > entriesPerPage" class="pagination-container">
          <div class="pagination-info">
            Showing <strong>{{ (currentPage - 1) * entriesPerPage + 1 }}</strong>
            to <strong>{{ Math.min(currentPage * entriesPerPage, totalEntries) }}</strong>
            of <strong>{{ totalEntries }}</strong> entries
          </div>
          <div class="pagination-controls">
            <button
              @click="handlePageChange(currentPage - 1)"
              :disabled="currentPage === 1 || loading"
              class="btn btn-outline btn-sm shadow-sm"
            >
              Previous
            </button>
            <div class="page-numbers">
              <button 
                v-for="p in visiblePages" 
                :key="p"
                @click="handlePageChange(p)"
                :class="['page-number', { active: currentPage === p }]"
                :disabled="loading"
              >
                {{ p }}
              </button>
            </div>
            <button
              @click="handlePageChange(currentPage + 1)"
              :disabled="currentPage === totalPages || loading"
              class="btn btn-outline btn-sm shadow-sm"
            >
              Next
            </button>
          </div>
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
    const allTableRows = ref([]);
    const currentPage = ref(1);
    const entriesPerPage = ref(10);
    const totalEntries = ref(0);
    const totalPages = ref(1);
    const timeRange = ref("24h");
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

    const tableRows = computed(() => allTableRows.value);

    const visiblePages = computed(() => {
      const pages = [];
      const range = 2;
      for (let i = Math.max(1, currentPage.value - range); i <= Math.min(totalPages.value, currentPage.value + range); i++) {
        pages.push(i);
      }
      return pages;
    });

    const refreshData = async (resetPage = false) => {
      if (!selectedDeviceId.value) return;
      if (resetPage) currentPage.value = 1;

      loading.value = true;
      try {
        const device = devices.value.find(
          (d) => d.device_id === selectedDeviceId.value,
        );
        if (!device) return;

        // Update thresholds
        if (device.config_id || device.configuration) {
          const config = typeof device.config_id === "object" ? device.config_id : device.configuration;
          if (config) updateThresholdsFromConfig(config);
        }

        const response = await sensorDataStore.fetchHistoricalData(
          device.device_id,
          { 
            range: timeRange.value, 
            page: currentPage.value, 
            limit: entriesPerPage.value 
          },
        );

        if (response?.success) {
          allTableRows.value = response.data || [];
          totalEntries.value = response.pagination?.total || 0;
          totalPages.value = response.pagination?.pages || 1;
        } else {
          allTableRows.value = Array.isArray(response) ? response : [];
          totalEntries.value = allTableRows.value.length;
          totalPages.value = Math.ceil(totalEntries.value / entriesPerPage.value) || 1;
        }

        if (currentPage.value > totalPages.value) {
          currentPage.value = totalPages.value;
        }
      } catch (error) {
        console.error("Failed to load analytics:", error);
        allTableRows.value = [];
        totalEntries.value = 0;
        totalPages.value = 1;
      } finally {
        loading.value = false;
      }
    };

    const handlePageChange = (page) => {
      if (page < 1 || page > totalPages.value || page === currentPage.value) return;
      currentPage.value = page;
      refreshData();
    };

    // Watch for device or entries changes
    watch([selectedDeviceId, timeRange], async () => {
      await refreshData(true);
    });

    watch(entriesPerPage, () => {
      refreshData(true);
    });

    onMounted(async () => {
      await devicesStore.fetchDevices({ page: 1, limit: 100 });
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
      timeRange,
      entriesPerPage,
      currentPage,
      totalPages,
      totalEntries,
      metricCards,
      tableRows,
      visiblePages,
      allTableRows,
      refreshData,
      handlePageChange,
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
  align-items: center;
  margin-bottom: 2.5rem;
  flex-wrap: wrap;
  gap: 1.5rem;
}

.analytics-header h1 {
  font-size: 2.25rem;
  font-weight: 800;
  color: #111827;
  letter-spacing: -0.025em;
  margin: 0 0 0.25rem 0;
}

.header-content p.subtitle {
  color: #6b7280;
  font-size: 1rem;
  margin: 0;
}

.analytics-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 5rem 2rem;
  text-align: center;
  background: white;
  border-radius: 1.5rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
  color: #6b7280;
  margin-bottom: 2rem;
}

.analytics-empty svg {
  color: #d1d5db;
  margin-bottom: 1.5rem;
}

.analytics-empty h3 {
  font-size: 1.5rem;
  font-weight: 700;
  color: #111827;
  margin: 0 0 0.5rem 0;
}

.analytics-empty p {
  margin-bottom: 2rem;
}

.subtitle {
  color: #6b7280;
  font-size: 1rem;
  margin: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: #ffffff;
  padding: 0.5rem;
  border-radius: 1.25rem;
  box-shadow: 
    0 4px 6px -1px rgba(0, 0, 0, 0.05),
    0 10px 15px -3px rgba(0, 0, 0, 0.1);
  border: 1px solid #f3f4f6;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-right: 0.5rem;
  border-right: 1px solid #e5e7eb;
}

.device-selector,
.entries-selector {
  display: flex;
  flex-direction: column;
  padding: 0.5rem 0.75rem;
  min-width: 120px;
}

.device-selector label,
.entries-selector label {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  color: #9ca3af;
  margin-bottom: 0.25rem;
  letter-spacing: 0.05em;
}

.select-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.select-wrapper select {
  appearance: none;
  background: transparent;
  border: none;
  font-size: 0.95rem;
  font-weight: 600;
  color: #374151;
  padding: 0 1.5rem 0 0;
  cursor: pointer;
  outline: none;
  width: 100%;
}

.select-wrapper::after {
  content: "";
  position: absolute;
  right: 0;
  width: 0.5rem;
  height: 0.5rem;
  border-right: 2px solid #9ca3af;
  border-bottom: 2px solid #9ca3af;
  transform: rotate(45deg);
  pointer-events: none;
  margin-top: -3px;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border-radius: 0.75rem;
  font-weight: 600;
  transition: all 0.2s;
  cursor: pointer;
  border: none;
  font-size: 0.875rem;
  text-decoration: none;
}

.refresh-btn {
  height: 3.5rem;
  padding: 0 1.5rem;
  border-radius: 1rem;
  margin-left: 0.5rem;
}

.btn-primary {
  background: #10b981;
  color: white;
  box-shadow: 0 4px 14px 0 rgba(16, 185, 129, 0.39);
}

.btn-primary:hover:not(:disabled) {
  background: #059669;
  transform: translateY(-1px);
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1.5rem;
  margin-bottom: 3rem;
}

.data-table-section {
  background: white;
  border-radius: 1.5rem;
  border: 1px solid #f3f4f6;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

.table-header {
  padding: 1.5rem 2rem;
  border-bottom: 1px solid #f3f4f6;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.table-header h2 {
  font-size: 1.25rem;
  font-weight: 700;
  color: #111827;
  margin: 0;
}

.table-subtitle {
  font-size: 0.875rem;
  color: #6b7280;
}

.table-container {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th {
  padding: 1.25rem 2rem;
  text-align: left;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  color: #9ca3af;
  letter-spacing: 0.05em;
  background: #f9fafb;
}

.data-table td {
  padding: 1.25rem 2rem;
  border-top: 1px solid #f3f4f6;
  font-size: 0.95rem;
  color: #4b5563;
}

.data-table tbody tr:hover {
  background: #f9fafb;
}

.value-cell {
  font-weight: 700;
  font-family: 'Inter', system-ui, sans-serif;
}

.timestamp-cell {
  color: #6b7280;
  font-size: 0.875rem;
  white-space: nowrap;
}

.pagination-container {
  padding: 1.5rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f9fafb;
  border-top: 1px solid #f3f4f6;
}

.pagination-info {
  font-size: 0.875rem;
  color: #6b7280;
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.page-numbers {
  display: flex;
  gap: 0.5rem;
}

.page-number {
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
  background: white;
  color: #4b5563;
}

.page-number:hover:not(.active) {
  background: #f3f4f6;
}

.page-number.active {
  background: #10b981;
  color: white;
  box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.4);
}

.btn-outline {
  border: 1px solid #e5e7eb;
  background: white;
  color: #374151;
}

.btn-outline:hover:not(:disabled) {
  background: #f9fafb;
  border-color: #d1d5db;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@media (max-width: 1024px) {
  .header-actions {
    width: 100%;
    flex-direction: column;
    padding: 1.5rem;
  }
  
  .control-group {
    border-right: none;
    border-bottom: 1px solid #e5e7eb;
    width: 100%;
    padding-bottom: 1rem;
    padding-right: 0;
    flex-direction: column;
    align-items: flex-start;
  }

  .refresh-btn {
    width: 100%;
    margin-left: 0;
    margin-top: 1rem;
  }
}
</style>
