<template>
  <div class="dashboard">
    <!-- Admin Dashboard -->
    <template v-if="isAdmin">
      <div class="admin-dashboard">
        <div class="dashboard__header">
          <div class="dashboard__title">
            <h1>System Overview</h1>
            <p class="dashboard__subtitle">
              Monitor all farms and devices across the system
            </p>
          </div>
          <button
            @click="refreshAdminData"
            :disabled="loading"
            class="btn btn--secondary"
          >
            <RefreshCw :class="{ spin: loading }" :size="16" />
            <span>Refresh</span>
          </button>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon stat-icon--info">
              <User :size="24" />
            </div>
            <div class="stat-content">
              <p class="stat-label">Total Users</p>
              <p class="stat-value">{{ adminStats.totalUsers }}</p>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon stat-icon--success">
              <MapPin :size="24" />
            </div>
            <div class="stat-content">
              <p class="stat-label">Total Farms</p>
              <p class="stat-value">{{ adminStats.totalFarms }}</p>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon stat-icon--primary">
              <Cpu :size="24" />
            </div>
            <div class="stat-content">
              <p class="stat-label">Total Devices</p>
              <p class="stat-value">{{ adminStats.totalDevices }}</p>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon stat-icon--danger">
              <AlertCircle :size="24" />
            </div>
            <div class="stat-content">
              <p class="stat-label">Active Alerts</p>
              <p class="stat-value">{{ adminStats.activeAlerts }}</p>
            </div>
          </div>
        </div>

        <div class="activity-section">
          <h2>System Activity</h2>
          <div class="activity-grid">
            <div class="activity-card">
              <h3>Recent Sensor Data</h3>
              <div v-if="lastSensorData.length === 0" class="empty-state">
                <p>No sensor data received yet</p>
              </div>
              <div v-else class="activity-list">
                <div
                  v-for="(data, index) in lastSensorData.slice(0, 5)"
                  :key="index"
                  class="activity-item"
                >
                  <span class="activity-time">{{
                    formatTime(data.timestamp)
                  }}</span>
                  <span class="activity-desc">
                    <strong>{{ data.device_name || data.device_id }}</strong> →
                    {{ data.farm_name || "Unknown Farm" }}
                  </span>
                </div>
              </div>
            </div>

            <div class="activity-card">
              <h3>Device Activity Status</h3>
              <div v-if="deviceActivity.length === 0" class="empty-state">
                <p>No device activity</p>
              </div>
              <div v-else class="activity-list">
                <div
                  v-for="(device, index) in deviceActivity.slice(0, 5)"
                  :key="index"
                  class="activity-item"
                >
                  <span class="activity-desc">
                    <strong>{{ device.device_name }}</strong>
                    ({{ device.farm_name }})
                  </span>
                  <span
                    :class="[
                      'activity-badge',
                      getActivityStatus(device.lastReading),
                    ]"
                  >
                    {{ formatRelativeTime(device.lastReading) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- User Dashboard -->
    <div v-else-if="!hasFarms" class="dashboard-empty">
      <MapPin :size="56" />
      <h2>No farms found</h2>
      <p>Create your first farm to start monitoring sensor data.</p>
      <router-link to="/farms" class="btn btn--primary">
        <span>Create a Farm</span>
      </router-link>
    </div>

    <template v-else>
      <div class="dashboard__header">
        <div class="dashboard__title">
          <h1>Real-Time Monitoring</h1>
          <p class="dashboard__subtitle">
            Monitor your Wolffia farm water quality in real-time
          </p>
        </div>
        <div class="dashboard__actions">
          <div class="farm-selector">
            <label for="dashboard-farm">Farm</label>
            <label id="dashboard-farm-name">{{
              selectedFarm?.farm_name ||
              selectedFarm?.name ||
              "No Farm Selected"
            }}</label>
          </div>

          <button
            @click="refreshData"
            :disabled="loading"
            class="btn btn--secondary"
          >
            <RefreshCw :class="{ spin: loading }" :size="16" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div v-if="!hasDevice" class="dashboard-empty dashboard-empty--compact">
        <Cpu :size="48" />
        <h3>No device is registered for this farm</h3>
        <p>
          Each farm can host one monitoring device. Add a device to start
          streaming data.
        </p>
        <router-link to="/devices" class="btn btn--primary">
          Register Device
        </router-link>
      </div>

      <template v-else>
        <div v-if="!realtimeConnected" class="alert alert--warning">
          <AlertCircle :size="20" />
          <span>Real-time connection lost. Attempting to reconnect...</span>
        </div>

        <div class="metrics-grid">
          <MetricCard
            v-for="metric in metrics"
            :key="metric.id"
            :title="metric.title"
            :value="metric.value"
            :unit="metric.unit"
            :icon="metric.icon"
            :status="metric.status"
            :trend="metric.trend"
            :range-min="metric.rangeMin"
            :range-max="metric.rangeMax"
            :last-update="metric.lastUpdate"
            :loading="loading"
          />
        </div>

        <div class="charts-grid">
          <ChartCard
            :title="`pH Level (${chartTimeRangeLabel})`"
            :data="phData"
            chart-type="area"
            :color="chartColors.ph"
            :optimal-range="chartRanges.ph"
            :loading="loading"
            @range-change="handleChartRangeChange"
          />

          <ChartCard
            :title="`Temperature (${chartTimeRangeLabel})`"
            :data="temperatureData"
            chart-type="line"
            :color="chartColors.temperature"
            :optimal-range="chartRanges.temperature"
            :loading="loading"
            @range-change="handleChartRangeChange"
          />
        </div>

        <div class="charts-grid">
          <ChartCard
            :title="`Light Intensity (${chartTimeRangeLabel})`"
            :data="lightData"
            chart-type="area"
            :color="chartColors.light"
            :optimal-range="chartRanges.light"
            :loading="loading"
            @range-change="handleChartRangeChange"
          />

          <ChartCard
            :title="`Electrical Conductivity (${chartTimeRangeLabel})`"
            :data="ecData"
            chart-type="line"
            :color="chartColors.ec"
            :optimal-range="chartRanges.ec"
            :loading="loading"
            @range-change="handleChartRangeChange"
          />
        </div>

        <div class="recent-alerts">
          <div class="section-header">
            <h2>Recent Alerts</h2>
            <router-link to="/alerts" class="link">View All</router-link>
          </div>

          <div v-if="recentAlerts.length === 0" class="empty-state">
            <CheckCircle :size="48" class="empty-state__icon" />
            <p>No active alerts. All systems operating normally.</p>
          </div>

          <div v-else class="alerts-list">
            <AlertItem
              v-for="alert in recentAlerts"
              :key="alert.id"
              :alert="alert"
              @resolve="handleResolveAlert"
            />
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import {
  RefreshCw,
  AlertCircle,
  CheckCircle,
  MapPin,
  Cpu,
  User,
} from "lucide-vue-next";
import { useSensorDataStore } from "@/stores/module/sensorData";
import { useDevicesStore } from "@/stores/module/devices";
import { useAlertsStore } from "@/stores/module/alerts";
import { useFarmsStore } from "@/stores/module/farms";
import websocketService from "@/services/websocket";
import apiService from "@/services/api";
import MetricCard from "@/components/Dashboard/MetricCard.vue";
import ChartCard from "@/components/Dashboard/ChartCard.vue";
import AlertItem from "@/components/Alerts/AlertItem.vue";
import { updateThresholdsFromConfig, THRESHOLDS } from "@/utils/thresholds";

export default {
  name: "DashboardView",
  components: {
    RefreshCw,
    AlertCircle,
    CheckCircle,
    MapPin,
    Cpu,
    User,
    MetricCard,
    ChartCard,
    AlertItem,
  },
  setup() {
    const sensorDataStore = useSensorDataStore();
    const devicesStore = useDevicesStore();
    const alertsStore = useAlertsStore();
    const farmsStore = useFarmsStore();

    const loading = ref(false);
    const chartTimeRange = ref("24h");
    const userRole = ref(localStorage.getItem("user_role") || "farmer");
    const isAdmin = computed(() => userRole.value === "admin");
    const adminStats = ref({
      totalUsers: 0,
      totalFarms: 0,
      totalDevices: 0,
      activeAlerts: 0,
    });
    const lastSensorData = ref([]);
    const deviceActivity = ref([]);
    const realtimeConnected = computed(() => sensorDataStore.realtimeConnected);
    const farms = computed(() => farmsStore.farms);
    const hasFarms = computed(() => farms.value.length > 0);
    const selectedFarmId = computed({
      get: () => farmsStore.selectedFarmId,
      set: (value) => farmsStore.selectFarm(value),
    });

    const chartTimeRangeLabel = computed(() => {
      switch (chartTimeRange.value) {
        case "24h":
          return "24 Hours";
        case "7d":
          return "7 Days";
        case "15d":
          return "15 Days";
        case "30d":
          return "30 Days";
        case "all":
          return "All Time";
        default:
          return "24 Hours";
      }
    });

    const hasDevice = computed(() => (devicesStore.devices || []).length > 0);
    const userDevices = computed(() => devicesStore.devices || []);

    const aggregatedReading = computed(() => {
      if (userDevices.value.length === 0) return null;

      const readings = userDevices.value
        .map((device) => sensorDataStore.getLatestReading(device.device_id))
        .filter((reading) => reading != null);

      if (readings.length === 0) return null;

      // Calculate averages - handle empty arrays
      const avg = (values) => {
        if (!values || values.length === 0) return 0;
        return values.reduce((sum, v) => sum + v, 0) / values.length;
      };

      // Get the most recent timestamp from all readings
      const latestTimestamp = readings.reduce((latest, reading) => {
        const readingTime = new Date(
          reading.timestamp || reading.created_at || 0,
        );
        return readingTime > latest ? readingTime : latest;
      }, new Date(0));

      return {
        ph: {
          value: avg(
            (readings || []).map((r) => r?.ph?.value || 0).filter((v) => v > 0),
          ),
          status: "normal",
        },
        temperature_water_c: {
          value: avg(
            (readings || [])
              .map((r) => r?.temperature_water_c?.value || 0)
              .filter((v) => v > 0),
          ),
          status: "normal",
        },
        temperature_air_c: {
          value: avg(
            (readings || [])
              .map((r) => r?.temperature_air_c?.value || 0)
              .filter((v) => v > 0),
          ),
          status: "normal",
        },
        light_intensity: {
          value: avg(
            (readings || [])
              .map((r) => r?.light_intensity?.value || 0)
              .filter((v) => v > 0),
          ),
          status: "normal",
        },
        ec: {
          value: avg(
            (readings || []).map((r) => r?.ec?.value || 0).filter((v) => v > 0),
          ),
          status: "normal",
        },
        tds: {
          value: avg(
            (readings || [])
              .map((r) => r?.tds?.value || 0)
              .filter((v) => v > 0),
          ),
          status: "normal",
        },
        timestamp: latestTimestamp.toISOString(),
        deviceCount: readings.length,
      };
    });

    const thresholds = sensorDataStore.thresholds;

    // Chart color mapping - these stay consistent regardless of status
    const chartColors = {
      ph: "#3b82f6", // Blue
      temperature: "#ef4444", // Red
      light: "#f59e0b", // Amber
      ec: "#10b981", // Green
    };

    // Dynamic chart ranges from THRESHOLDS config
    const chartRanges = computed(() => ({
      ph: { min: THRESHOLDS.ph_value.min, max: THRESHOLDS.ph_value.max },
      temperature: {
        min: THRESHOLDS.water_temperature_c.min,
        max: THRESHOLDS.water_temperature_c.max,
      },
      light: {
        min: THRESHOLDS.light_intensity.min,
        max: THRESHOLDS.light_intensity.max,
      },
      ec: { min: THRESHOLDS.ec_value.min, max: THRESHOLDS.ec_value.max },
    }));

    const metricStatus = (key, value) => {
      const threshold = THRESHOLDS[key];
      if (value === null || value === undefined || !threshold) return "unknown";
      if (value < threshold.min || value > threshold.max) return "critical";
      const buffer = (threshold.max - threshold.min) * 0.1;
      if (value < threshold.min + buffer || value > threshold.max - buffer)
        return "warning";
      return "normal";
    };

    const metrics = computed(() => {
      const reading = aggregatedReading.value;
      if (!reading) {
        return [];
      }

      return [
        {
          id: "ph",
          title: "pH Level",
          value: reading.ph?.value?.toFixed(2) ?? "--",
          unit: "pH",
          icon: "Droplet",
          status: metricStatus("ph_value", reading.ph?.value),
          trend: null,
          rangeMin: THRESHOLDS.ph_value.min,
          rangeMax: THRESHOLDS.ph_value.max,
          lastUpdate: reading.timestamp,
        },
        {
          id: "water_temperature_c",
          title: "Water Temperature",
          value: reading.temperature_water_c?.value?.toFixed(1) ?? "--",
          unit: "°C",
          icon: "Thermometer",
          status: metricStatus(
            "water_temperature_c",
            reading.temperature_water_c?.value,
          ),
          trend: null,
          rangeMin: THRESHOLDS.water_temperature_c.min,
          rangeMax: THRESHOLDS.water_temperature_c.max,
          lastUpdate: reading.timestamp,
        },
        {
          id: "air_temperature_c",
          title: "Air Temperature",
          value: reading.temperature_air_c?.value?.toFixed(1) ?? "--",
          unit: "°C",
          icon: "Thermometer",
          status: metricStatus(
            "air_temperature_c",
            reading.temperature_air_c?.value,
          ),
          trend: null,
          rangeMin: THRESHOLDS.air_temperature_c.min,
          rangeMax: THRESHOLDS.air_temperature_c.max,
          lastUpdate: reading.timestamp,
        },
        {
          id: "light_intensity",
          title: "Light Intensity",
          value: reading.light_intensity?.value ?? "--",
          unit: "lux",
          icon: "Sun",
          status: metricStatus(
            "light_intensity",
            reading.light_intensity?.value,
          ),
          trend: null,
          rangeMin: THRESHOLDS.light_intensity.min,
          rangeMax: THRESHOLDS.light_intensity.max,
          lastUpdate: reading.timestamp,
        },
        {
          id: "ec_value",
          title: "Electrical Conductivity",
          value: reading.ec?.value?.toFixed(2) ?? "--",
          unit: "mS/cm",
          icon: "Activity",
          status: metricStatus("ec_value", reading.ec?.value),
          trend: null,
          rangeMin: THRESHOLDS.ec_value.min,
          rangeMax: THRESHOLDS.ec_value.max,
          lastUpdate: reading.timestamp,
        },
      ];
    });

    const historicalData = computed(() => {
      if (!userDevices.value || userDevices.value.length === 0) return [];

      // Aggregate historical data from all devices
      const allData = userDevices.value.flatMap(
        (device) =>
          sensorDataStore.getHistoricalData(
            device.device_id,
            chartTimeRange.value,
          ) || [],
      );

      return allData;
    });

    const phData = computed(() =>
      (historicalData.value || [])
        .filter((reading) => reading?.ph?.value !== undefined)
        .map((reading) => ({ x: reading.timestamp, y: reading.ph.value })),
    );

    const temperatureData = computed(() =>
      (historicalData.value || [])
        .filter((reading) => reading?.temperature_water_c?.value !== undefined)
        .map((reading) => ({
          x: reading.timestamp,
          y: reading.temperature_water_c.value,
        })),
    );

    const lightData = computed(() =>
      (historicalData.value || [])
        .filter((reading) => reading?.light_intensity?.value !== undefined)
        .map((reading) => ({
          x: reading.timestamp,
          y: reading.light_intensity.value,
        })),
    );

    const ecData = computed(() =>
      (historicalData.value || [])
        .filter((reading) => reading?.ec?.value !== undefined)
        .map((reading) => ({ x: reading.timestamp, y: reading.ec.value })),
    );

    const recentAlerts = computed(() => {
      if (!userDevices.value || userDevices.value.length === 0) return [];
      const deviceIds = userDevices.value.map((d) => d.device_id);
      return alertsStore.unresolvedAlerts
        .filter((alert) => deviceIds.includes(alert.device))
        .slice(0, 5);
    });

    const refreshData = async () => {
      if (!selectedFarmId.value) {
        console.warn("No farm selected, skipping data refresh");
        return;
      }

      loading.value = true;
      try {
        // Step 1: Fetch devices for the selected farm
        await devicesStore.fetchDevices(selectedFarmId.value);
        const device = devicesStore.devices[0];

        if (!device) {
          console.warn("No devices found for farm, skipping sensor data fetch");
          // Still fetch alerts even without devices
          await alertsStore.fetchAlerts();
          return;
        }

        // Step 2: Update thresholds from device configuration if available
        if (device.config_id || device.configuration) {
          const config =
            typeof device.config_id === "object"
              ? device.config_id
              : device.configuration;
          if (config) {
            updateThresholdsFromConfig(config);
          }
        }

        // Step 3: Fetch sensor data and alerts in parallel
        await Promise.all([
          sensorDataStore.fetchLatestReadings(device.device_id),
          sensorDataStore.fetchHistoricalData(device.device_id, {
            range: chartTimeRange.value,
          }),
          alertsStore.fetchAlerts(),
        ]);

        console.log("✅ Dashboard data refreshed successfully");
      } catch (error) {
        console.error("❌ Error refreshing dashboard data:", error);
        // Don't throw - let dashboard show partial data if available
      } finally {
        loading.value = false;
      }
    };

    const handleResolveAlert = async (alertId) => {
      try {
        await alertsStore.resolveAlert(alertId);
      } catch (error) {
        console.error("Error resolving alert:", error);
      }
    };

    const handleChartRangeChange = async (range) => {
      chartTimeRange.value = range;
      if (userDevices.value && userDevices.value.length > 0) {
        loading.value = true;
        try {
          // Fetch historical data for all user devices
          await Promise.all(
            userDevices.value.map((device) =>
              sensorDataStore.fetchHistoricalData(device.device_id, { range }),
            ),
          );
        } catch (error) {
          console.error("Error fetching historical data:", error);
        } finally {
          loading.value = false;
        }
      }
    };

    const handleSensorReading = (reading) => {
      sensorDataStore.updateRealtimeReading(reading);
    };

    const handleAlert = (alert) => {
      alertsStore.addAlert(alert);
    };

    const handleDeviceStatus = (status) => {
      devicesStore.updateLocalDevice(status.deviceId, {
        status: status.status,
      });
    };

    // Admin-specific functions
    const fetchAdminData = async () => {
      if (!isAdmin.value) return;

      loading.value = true;
      try {
        const response = await apiService.getAdminStats();
        adminStats.value = response.data.stats;
        lastSensorData.value = response.data.lastSensorData || [];
        deviceActivity.value = response.data.deviceActivity || [];
      } catch (error) {
        console.error("Error fetching admin stats:", error);
      } finally {
        loading.value = false;
      }
    };

    const refreshAdminData = () => {
      fetchAdminData();
    };

    const formatTime = (timestamp) => {
      if (!timestamp) return "N/A";
      const date = new Date(timestamp);
      return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
    };

    const formatRelativeTime = (timestamp) => {
      if (!timestamp) return "Never";
      const now = new Date();
      const then = new Date(timestamp);
      const diffMins = Math.floor((now - then) / 60000);

      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
      return `${Math.floor(diffMins / 1440)}d ago`;
    };

    const getActivityStatus = (timestamp) => {
      if (!timestamp) return "activity-badge--inactive";
      const now = new Date();
      const then = new Date(timestamp);
      const diffMins = Math.floor((now - then) / 60000);

      if (diffMins < 5) return "activity-badge--active";
      if (diffMins < 60) return "activity-badge--recent";
      return "activity-badge--inactive";
    };

    watch(
      () => farmsStore.selectedFarmId,
      async (newValue, oldValue) => {
        if (newValue && newValue !== oldValue) {
          await refreshData();
        }
      },
    );

    onMounted(async () => {
      // Fetch admin data if user is admin
      if (isAdmin.value) {
        await fetchAdminData();
        return; // Skip regular user dashboard initialization
      }

      // Regular user dashboard initialization
      try {
        // Step 1: Fetch farms first
        await farmsStore.fetchFarms();

        // Step 2: If we have a selected farm, fetch devices and data
        if (farmsStore.selectedFarmId) {
          await refreshData();
        }
      } catch (error) {
        console.error("Error loading dashboard data:", error);
      }

      // Step 3: Setup WebSocket (non-blocking, can fail gracefully)
      if (!websocketService.isConnected()) {
        const token = localStorage.getItem("auth_token");
        if (token) {
          try {
            await websocketService.connect(token);
          } catch (error) {
            console.error("Failed to connect to WebSocket:", error);
          }
        }
      }

      // Step 4: Register WebSocket event handlers
      websocketService.on("sensorReading", handleSensorReading);
      websocketService.on("alert", handleAlert);
      websocketService.on("deviceStatus", handleDeviceStatus);
      websocketService.on("connected", () => {
        sensorDataStore.setRealtimeConnection(true);
      });
      websocketService.on("disconnected", () => {
        sensorDataStore.setRealtimeConnection(false);
      });

      // Step 5: Subscribe to device updates if connected
      if (websocketService.isConnected() && userDevices.value.length > 0) {
        userDevices.value.forEach((device) => {
          websocketService.subscribeToDevice(device.device_id);
        });
      }
    });

    onUnmounted(() => {
      websocketService.off("sensorReading", handleSensorReading);
      websocketService.off("alert", handleAlert);
      websocketService.off("deviceStatus", handleDeviceStatus);
    });

    const selectedFarm = computed(() => {
      if (!farmsStore.selectedFarmId) return null;
      return farmsStore.farms.find(
        (f) => (f._id || f.id) === farmsStore.selectedFarmId,
      );
    });

    return {
      farms,
      selectedFarmId,
      selectedFarm,
      hasFarms,
      hasDevice,
      loading,
      realtimeConnected,
      chartTimeRange,
      chartTimeRangeLabel,
      chartColors,
      chartRanges,
      metrics,
      phData,
      temperatureData,
      lightData,
      ecData,
      recentAlerts,
      refreshData,
      handleResolveAlert,
      handleChartRangeChange,
      isAdmin,
      adminStats,
      lastSensorData,
      deviceActivity,
      refreshAdminData,
      formatTime,
      formatRelativeTime,
      getActivityStatus,
    };
  },
};
</script>

<style scoped>
.dashboard {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
}

.dashboard__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
}

.dashboard__title h1 {
  font-size: 2rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 0.5rem 0;
}

.dashboard__subtitle {
  color: #6b7280;
  margin: 0;
}

.dashboard__actions {
  display: flex;
  align-items: center;
  gap: 1rem;
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
}

.dashboard-empty {
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
  margin-bottom: 2rem;
}

.dashboard-empty svg {
  color: #d1d5db;
}

.dashboard-empty--compact {
  margin-bottom: 2rem;
}

.btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 0.5rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn--primary {
  background: #10b981;
  color: white;
}

.btn--primary:hover {
  background: #059669;
}

.btn--secondary {
  background: #e5e7eb;
  color: #374151;
}

.btn--secondary:hover {
  background: #d1d5db;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.alert {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  border-radius: 0.5rem;
  margin-bottom: 1.5rem;
}

.alert--warning {
  background: #fef3c7;
  color: #92400e;
  border: 1px solid #fbbf24;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.recent-alerts {
  background: white;
  border-radius: 0.75rem;
  padding: 1.5rem;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.section-header h2 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.link {
  color: #3b82f6;
  text-decoration: none;
  font-weight: 500;
}

.link:hover {
  text-decoration: underline;
}

.empty-state {
  text-align: center;
  padding: 3rem;
  color: #6b7280;
}

.empty-state__icon {
  color: #10b981;
  margin-bottom: 1rem;
}

.alerts-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

@media (max-width: 768px) {
  .dashboard {
    padding: 1rem;
  }

  .dashboard__header {
    flex-direction: column;
    gap: 1rem;
  }

  .dashboard__actions {
    width: 100%;
    flex-direction: column;
    align-items: stretch;
  }

  .farm-selector select {
    width: 100%;
  }

  .btn {
    width: 100%;
    justify-content: center;
  }

  .charts-grid {
    grid-template-columns: 1fr;
  }
}

/* Admin Dashboard Styles */
.admin-dashboard {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: white;
  padding: 1.5rem;
  border-radius: 0.75rem;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  gap: 1rem;
  transition:
    transform 0.2s,
    box-shadow 0.2s;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px 0 rgba(0, 0, 0, 0.15);
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-icon--info {
  background: #dbeafe;
  color: #3b82f6;
}

.stat-icon--success {
  background: #d1fae5;
  color: #10b981;
}

.stat-icon--primary {
  background: #e0e7ff;
  color: #6366f1;
}

.stat-icon--danger {
  background: #fee2e2;
  color: #ef4444;
}

.stat-content {
  flex: 1;
}

.stat-label {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0 0 0.25rem 0;
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0;
}

.activity-section h2 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 1.5rem 0;
}

.activity-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 1.5rem;
}

.activity-card {
  background: white;
  padding: 1.5rem;
  border-radius: 0.75rem;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
}

.activity-card h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 1rem 0;
}

.activity-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.activity-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: #f9fafb;
  border-radius: 0.5rem;
  border-left: 3px solid #3b82f6;
}

.activity-time {
  font-size: 0.875rem;
  color: #6b7280;
  min-width: 80px;
}

.activity-desc {
  flex: 1;
  font-size: 0.875rem;
  color: #1f2937;
  margin: 0 1rem;
}

.activity-desc strong {
  font-weight: 600;
  color: #3b82f6;
}

.activity-badge {
  font-size: 0.75rem;
  padding: 0.25rem 0.625rem;
  border-radius: 9999px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.activity-badge--active {
  background: #d1fae5;
  color: #059669;
}

.activity-badge--recent {
  background: #fed7aa;
  color: #d97706;
}

.activity-badge--inactive {
  background: #e5e7eb;
  color: #6b7280;
}

@media (max-width: 768px) {
  .activity-grid {
    grid-template-columns: 1fr;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
