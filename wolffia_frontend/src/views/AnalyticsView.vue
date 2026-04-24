<template>
  <div class="analytics-view">
    <div class="analytics-header">
      <div>
        <h1>Device Analytics</h1>
        <p class="subtitle">Review sensor readings for a specific device</p>
      </div>
      <div class="header-actions">
        <div class="control-group">
          <DeviceSelector
            v-if="hasDevices"
            v-model="selectedDeviceId"
            label="Device"
            :show-placeholder="true"
            placeholder="Select a device..."
          />
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
          :valueMin="metric.valueMin"
          :valueMax="metric.valueMax"
          :unit="metric.unit"
          :icon="metric.icon"
          :status="metric.status"
          :range-min="metric.rangeMin"
          :range-max="metric.rangeMax"
          :loading="loading"
        />
      </div>

      <!-- Recommendations panel -->
      <div v-if="recommendations.length > 0" class="recommendations-panel">
        <div class="recommendations-header">
          <h2>Recommendations</h2>
          <span class="rec-subtitle">Based on average readings for the selected period</span>
        </div>
        <div class="recommendations-grid">
          <div
            v-for="rec in recommendations"
            :key="rec.id"
            class="recommendation-card"
            :class="rec.severity"
          >
            <div class="rec-icon">{{ rec.icon }}</div>
            <div class="rec-content">
              <div class="rec-title">{{ rec.title }}</div>
              <div class="rec-value">
                Current avg: <strong>{{ rec.avgFormatted }}</strong>
                &nbsp;·&nbsp;
                Target: {{ rec.rangeMin }} – {{ rec.rangeMax }} {{ rec.unit }}
              </div>
              <div class="rec-message">{{ rec.message }}</div>
            </div>
          </div>
        </div>
      </div>
      <div v-else-if="tableRows.length > 0" class="recommendations-ok">
        <span class="rec-ok-icon">✓</span>
        All sensor readings are within optimal range.
      </div>

      <!-- Pearson Correlation Panel -->
      <div v-if="correlations.length > 0" class="correlation-panel">
        <div class="correlation-header">
          <h2>Correlation Analysis</h2>
          <span class="corr-subtitle">Pearson r between sensor pairs for the selected period · |r| ≥ 0.7 strong · 0.4–0.7 moderate · &lt; 0.4 weak</span>
        </div>
        <div class="correlation-grid">
          <div
            v-for="c in correlations"
            :key="c.id"
            class="corr-card"
            :class="c.strengthClass"
          >
            <div class="corr-pair">
              <span class="corr-x">{{ c.labelX }}</span>
              <span class="corr-arrow">↔</span>
              <span class="corr-y">{{ c.labelY }}</span>
            </div>
            <div class="corr-value">{{ c.rFormatted }}</div>
            <div class="corr-bar-wrap">
              <div
                class="corr-bar"
                :style="{
                  width: Math.abs(c.r) * 100 + '%',
                  background: c.barColor,
                  marginLeft: c.r < 0 ? 'auto' : '0',
                }"
              ></div>
            </div>
            <div class="corr-label">{{ c.strengthLabel }} {{ c.direction }}</div>
            <div v-if="c.insight" class="corr-insight">{{ c.insight }}</div>
          </div>
        </div>
      </div>

      <DataTable
        :columns="tableColumns"
        :data="tableRows"
        :loading="loading"
        title="Recent Readings"
        :subtitle="`Page ${currentPage} of ${totalPages} · ${totalEntries} total entries`"
        :pagination="false"
      >
        <template #cell-timestamp="{ value }">
          {{ formatTimestamp(value) }}
        </template>
        <template #cell-ph="{ value }">
          <span :style="{ color: getValueColor('ph_value', value?.value) }">{{
            formatValue(value?.value)
          }}</span>
        </template>
        <template #cell-temperature_water_c="{ value }">
          <span
            :style="{
              color: getValueColor('water_temperature_c', value?.value),
            }"
            >{{ formatValue(value?.value) }}</span
          >
        </template>
        <template #cell-temperature_air_c="{ value }">
          <span
            :style="{ color: getValueColor('air_temperature_c', value?.value) }"
            >{{ formatValue(value?.value) }}</span
          >
        </template>
        <template #cell-humidity="{ value }">
          <span
            :style="{ color: getValueColor('air_humidity', value?.value) }"
            >{{ formatValue(value?.value) }}</span
          >
        </template>
        <template #cell-ec="{ value }">
          <span :style="{ color: getValueColor('ec_value', value?.value) }">{{
            formatValue(value?.value)
          }}</span>
        </template>
        <template #cell-tds="{ value }">
          <span :style="{ color: getValueColor('tds_value', value?.value) }">{{
            formatInteger(value?.value)
          }}</span>
        </template>
        <template #cell-light_intensity="{ value }">
          <span
            :style="{ color: getValueColor('light_intensity', value?.value) }"
            >{{ formatInteger(value?.value) }}</span
          >
        </template>
      </DataTable>

      <!-- Server-side pagination bar -->
      <div v-if="totalPages > 1" class="pagination-bar">
        <span class="pagination-info">
          Showing
          {{ (currentPage - 1) * entriesPerPage + 1 }}–{{ Math.min(currentPage * entriesPerPage, totalEntries) }}
          of {{ totalEntries }} entries
        </span>
        <div class="pagination-controls">
          <button
            class="btn btn-outline page-nav"
            :disabled="currentPage === 1"
            @click="handlePageChange(currentPage - 1)"
          >‹ Prev</button>
          <span v-if="visiblePages[0] > 1" class="page-ellipsis">…</span>
          <button
            v-for="page in visiblePages"
            :key="page"
            class="page-number"
            :class="{ active: page === currentPage }"
            @click="handlePageChange(page)"
          >{{ page }}</button>
          <span v-if="visiblePages[visiblePages.length - 1] < totalPages" class="page-ellipsis">…</span>
          <button
            class="btn btn-outline page-nav"
            :disabled="currentPage === totalPages"
            @click="handlePageChange(currentPage + 1)"
          >Next ›</button>
        </div>
      </div>
    </template>
  </div>
</template>

<script>
import { ref, computed, onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import {
  RefreshCw,
  MapPin,
  Cpu,
  Droplet,
  Thermometer,
  Sun,
  Activity,
} from "lucide-vue-next";
import apiService from "@/services/api";
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
import DeviceSelector from "@/components/Common/DeviceSelector.vue";
import DataTable from "@/components/Common/DataTable.vue";

export default {
  name: "AnalyticsView",
  components: {
    RefreshCw,
    MapPin,
    Cpu,
    Droplet,
    Thermometer,
    Sun,
    Activity,
    MetricCard,
    DeviceSelector,
    DataTable,
  },
  setup() {
    const sensorDataStore = useSensorDataStore();
    const devicesStore = useDevicesStore();
    const farmsStore = useFarmsStore();
    const route = useRoute();

    const loading = ref(false);
    const allTableRows = ref([]);
    const currentPage = ref(1);
    const entriesPerPage = ref(10);
    const totalEntries = ref(0);
    const totalPages = ref(1);
    const timeRange = ref("24h");
    const selectedDeviceId = ref(null);
    const minMaxData = ref(null);

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
        if (avgVal === null || avgVal === undefined) return "--";
        return key === "ph_value" || key === "ec_value"
          ? Number(avgVal).toFixed(2)
          : key.includes("temperature") || key === "humidity"
            ? Number(avgVal).toFixed(1)
            : Math.round(avgVal).toLocaleString();
      };

      const getStat = (key, type) => {
        if (!minMaxData.value) return null;
        return minMaxData.value[`${key}_${type}`];
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
          value: formatAvg("ph_value", getStat("ph", "avg") ?? avgPh),
          valueMin: getStat("ph", "min"),
          valueMax: getStat("ph", "max"),
          unit: "pH",
          icon: "Droplet",
          status: getValueStatus("ph_value", avgPh),
          rangeMin: THRESHOLDS.ph_value.min,
          rangeMax: THRESHOLDS.ph_value.max,
        },
        {
          id: "water_temp",
          title: "Avg Water Temp",
          value: formatAvg(
            "temperature",
            getStat("water_temp", "avg") ?? avgWaterTemp,
          ),
          valueMin: getStat("water_temp", "min"),
          valueMax: getStat("water_temp", "max"),
          unit: "°C",
          icon: "Thermometer",
          status: getValueStatus("water_temperature_c", avgWaterTemp),
          rangeMin: THRESHOLDS.water_temperature_c.min,
          rangeMax: THRESHOLDS.water_temperature_c.max,
        },
        {
          id: "air_temp",
          title: "Avg Air Temp",
          value: formatAvg(
            "temperature",
            getStat("air_temp", "avg") ?? avgAirTemp,
          ),
          valueMin: getStat("air_temp", "min"),
          valueMax: getStat("air_temp", "max"),
          unit: "°C",
          icon: "Thermometer",
          status: getValueStatus("air_temperature_c", avgAirTemp),
          rangeMin: THRESHOLDS.air_temperature_c.min,
          rangeMax: THRESHOLDS.air_temperature_c.max,
        },
        {
          id: "humidity",
          title: "Avg Air Humidity",
          value: formatAvg(
            "humidity",
            getStat("humidity", "avg") ?? avgHumidity,
          ),
          valueMin: getStat("humidity", "min"),
          valueMax: getStat("humidity", "max"),
          unit: "%",
          icon: "Droplet",
          status: getValueStatus("air_humidity", avgHumidity),
          rangeMin: THRESHOLDS.air_humidity.min,
          rangeMax: THRESHOLDS.air_humidity.max,
        },
        {
          id: "ec",
          title: "Avg EC",
          value: formatAvg("ec_value", getStat("ec", "avg") ?? avgEc),
          valueMin: getStat("ec", "min"),
          valueMax: getStat("ec", "max"),
          unit: "mS/cm",
          icon: "Activity",
          status: getValueStatus("ec_value", avgEc),
          rangeMin: THRESHOLDS.ec_value.min,
          rangeMax: THRESHOLDS.ec_value.max,
        },
        {
          id: "tds",
          title: "Avg TDS",
          value: formatAvg("tds_value", getStat("tds", "avg") ?? avgTds),
          valueMin: getStat("tds", "min"),
          valueMax: getStat("tds", "max"),
          unit: "ppm",
          icon: "Activity",
          status: getValueStatus("tds_value", avgTds),
          rangeMin: THRESHOLDS.tds_value.min,
          rangeMax: THRESHOLDS.tds_value.max,
        },
        {
          id: "light",
          title: "Avg Light",
          value: formatAvg(
            "light_intensity",
            getStat("light", "avg") ?? avgLight,
          ),
          valueMin: getStat("light", "min"),
          valueMax: getStat("light", "max"),
          unit: "lux",
          icon: "Sun",
          status: getValueStatus("light_intensity", avgLight),
          rangeMin: THRESHOLDS.light_intensity.min,
          rangeMax: THRESHOLDS.light_intensity.max,
        },
      ];
    });

    const tableRows = computed(() => allTableRows.value);

    // ── Pearson correlation helpers ──────────────────────────────────────────
    const pearson = (xs, ys) => {
      const n = xs.length;
      if (n < 3) return null;
      const mx = xs.reduce((s, v) => s + v, 0) / n;
      const my = ys.reduce((s, v) => s + v, 0) / n;
      let num = 0, dx2 = 0, dy2 = 0;
      for (let i = 0; i < n; i++) {
        const dx = xs[i] - mx, dy = ys[i] - my;
        num += dx * dy;
        dx2 += dx * dx;
        dy2 += dy * dy;
      }
      const denom = Math.sqrt(dx2 * dy2);
      return denom === 0 ? null : num / denom;
    };

    const extractPairs = (keyA, keyB) => {
      const xs = [], ys = [];
      for (const row of allTableRows.value) {
        const x = row[keyA]?.value, y = row[keyB]?.value;
        if (typeof x === "number" && typeof y === "number" && !isNaN(x) && !isNaN(y)) {
          xs.push(x); ys.push(y);
        }
      }
      return { xs, ys };
    };

    const strengthInfo = (r) => {
      const abs = Math.abs(r);
      if (abs >= 0.7) return { label: "Strong", cls: "strong" };
      if (abs >= 0.4) return { label: "Moderate", cls: "moderate" };
      return { label: "Weak", cls: "weak" };
    };

    const correlations = computed(() => {
      if (allTableRows.value.length < 5) return [];

      const pairs = [
        {
          id: "waterTemp_tds",
          keyX: "temperature_water_c", labelX: "Water Temp",
          keyY: "tds",               labelY: "TDS",
          insight: "Rising water temp typically increases TDS as salts become more soluble.",
        },
        {
          id: "waterTemp_ec",
          keyX: "temperature_water_c", labelX: "Water Temp",
          keyY: "ec",                labelY: "EC",
          insight: "EC and water temperature often move together due to ion mobility.",
        },
        {
          id: "airTemp_humidity",
          keyX: "temperature_air_c", labelX: "Air Temp",
          keyY: "humidity",          labelY: "Humidity",
          insight: "Warm air holds more moisture; an inverse relation may indicate poor ventilation.",
        },
        {
          id: "ph_ec",
          keyX: "ph",  labelX: "pH",
          keyY: "ec",  labelY: "EC",
          insight: "Low pH with high EC may suggest over-acidification from nutrient salts.",
        },
        {
          id: "light_airTemp",
          keyX: "light_intensity", labelX: "Light",
          keyY: "temperature_air_c", labelY: "Air Temp",
          insight: "High light intensity from grow lamps raises air temperature in enclosed environments.",
        },
        {
          id: "waterTemp_ph",
          keyX: "temperature_water_c", labelX: "Water Temp",
          keyY: "ph",                  labelY: "pH",
          insight: "Warmer water lowers CO₂ solubility, which can raise pH slightly.",
        },
      ];

      return pairs
        .map((pair) => {
          const { xs, ys } = extractPairs(pair.keyX, pair.keyY);
          const r = pearson(xs, ys);
          if (r === null) return null;

          const { label, cls } = strengthInfo(r);
          const direction = r >= 0 ? "positive ↑" : "negative ↓";
          const barColor =
            cls === "strong"   ? (r > 0 ? "#10b981" : "#ef4444") :
            cls === "moderate" ? (r > 0 ? "#34d399" : "#f87171") :
                                 "#9ca3af";

          return {
            id: pair.id,
            labelX: pair.labelX,
            labelY: pair.labelY,
            r,
            rFormatted: r.toFixed(3),
            strengthLabel: label,
            strengthClass: cls,
            direction,
            barColor,
            insight: Math.abs(r) >= 0.4 ? pair.insight : null,
          };
        })
        .filter(Boolean)
        .sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
    });

    const recommendations = computed(() => {
      if (!allTableRows.value.length) return [];

      const checks = [
        {
          id: "ph",
          key: "ph",
          thresholdKey: "ph_value",
          title: "pH Level",
          unit: "pH",
          icon: "💧",
          decimals: 2,
          low: "pH is too low. Add pH Up solution to raise it toward the target range.",
          high: "pH is too high. Add pH Down solution to lower it toward the target range.",
        },
        {
          id: "ec",
          key: "ec",
          thresholdKey: "ec_value",
          title: "Nutrient EC",
          unit: "mS/cm",
          icon: "⚗️",
          decimals: 2,
          low: "EC is too low. Add more nutrient concentrate to the reservoir.",
          high: "EC is too high. Dilute the solution with fresh water.",
        },
        {
          id: "water_temp",
          key: "temperature_water_c",
          thresholdKey: "water_temperature_c",
          title: "Water Temperature",
          unit: "°C",
          icon: "🌡️",
          decimals: 1,
          low: "Water temperature is too cold. Check the water heater.",
          high: "Water temperature is too warm. Improve cooling or shading.",
        },
        {
          id: "air_temp",
          key: "temperature_air_c",
          thresholdKey: "air_temperature_c",
          title: "Air Temperature",
          unit: "°C",
          icon: "🌬️",
          decimals: 1,
          low: "Air temperature is too low. Consider supplemental heating.",
          high: "Air temperature is too high. Increase ventilation or airflow.",
        },
        {
          id: "humidity",
          key: "humidity",
          thresholdKey: "air_humidity",
          title: "Air Humidity",
          unit: "%",
          icon: "💨",
          decimals: 1,
          low: "Humidity is too low. Add misting or a humidifier.",
          high: "Humidity is too high. Improve air circulation to prevent disease.",
        },
        {
          id: "light",
          key: "light_intensity",
          thresholdKey: "light_intensity",
          title: "Light Intensity",
          unit: "lux",
          icon: "☀️",
          decimals: 0,
          low: "Light intensity is too low. Check grow lights or clean the sensor.",
          high: "Light intensity is very high. Consider reducing photoperiod or shading.",
        },
      ];

      return checks
        .map((check) => {
          const values = allTableRows.value
            .map((row) => row[check.key]?.value)
            .filter((v) => typeof v === "number");
          if (!values.length) return null;

          const avg = values.reduce((s, v) => s + v, 0) / values.length;
          const threshold = THRESHOLDS[check.thresholdKey];
          if (!threshold) return null;

          const status = getValueStatus(check.thresholdKey, avg);
          if (status === "normal") return null;

          return {
            id: check.id,
            title: check.title,
            icon: check.icon,
            message: avg < threshold.min ? check.low : check.high,
            severity: status,
            avg,
            avgFormatted:
              check.decimals === 0
                ? Math.round(avg).toLocaleString() + " " + check.unit
                : avg.toFixed(check.decimals) + " " + check.unit,
            rangeMin: threshold.min,
            rangeMax: threshold.max,
            unit: check.unit,
          };
        })
        .filter(Boolean);
    });

    const tableColumns = [
      { key: "timestamp", label: "Timestamp", sortable: true },
      { key: "ph", label: "pH", sortable: true },
      { key: "temperature_water_c", label: "Water Temp (°C)", sortable: true },
      { key: "temperature_air_c", label: "Air Temp (°C)", sortable: true },
      { key: "humidity", label: "Humidity (%)", sortable: true },
      { key: "ec", label: "EC (mS/cm)", sortable: true },
      { key: "tds", label: "TDS (ppm)", sortable: true },
      { key: "light_intensity", label: "Light (lux)", sortable: true },
    ];

    const visiblePages = computed(() => {
      const pages = [];
      const range = 2;
      for (
        let i = Math.max(1, currentPage.value - range);
        i <= Math.min(totalPages.value, currentPage.value + range);
        i++
      ) {
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
          const config =
            typeof device.config_id === "object"
              ? device.config_id
              : device.configuration;
          if (config) updateThresholdsFromConfig(config);
        }

        const response = await sensorDataStore.fetchHistoricalData(
          device.device_id,
          {
            range: timeRange.value,
            page: currentPage.value,
            limit: entriesPerPage.value,
          },
        );

        if (response?.success) {
          allTableRows.value = response.data || [];
          totalEntries.value = response.pagination?.total || 0;
          totalPages.value = response.pagination?.pages || 1;
        } else {
          allTableRows.value = Array.isArray(response) ? response : [];
          totalEntries.value = allTableRows.value.length;
          totalPages.value =
            Math.ceil(totalEntries.value / entriesPerPage.value) || 1;
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
      if (page < 1 || page > totalPages.value || page === currentPage.value)
        return;
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
        if (route.query.deviceId) {
          const deviceExists = devices.value.some(
            (d) =>
              d.device_id === route.query.deviceId ||
              d.id === route.query.deviceId,
          );
          selectedDeviceId.value = deviceExists
            ? route.query.deviceId
            : devices.value[0].device_id;
        } else {
          selectedDeviceId.value = devices.value[0].device_id;
        }
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
      tableColumns,
      tableRows,
      visiblePages,
      allTableRows,
      recommendations,
      correlations,
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
  font-family: "Inter", system-ui, sans-serif;
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
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* ===== Recommendations ===== */
.recommendations-panel {
  background: white;
  border-radius: 1.5rem;
  border: 1px solid #f3f4f6;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
  padding: 1.75rem 2rem;
  margin-bottom: 2rem;
}

.recommendations-header {
  display: flex;
  align-items: baseline;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.recommendations-header h2 {
  font-size: 1.25rem;
  font-weight: 700;
  color: #111827;
  margin: 0;
}

.rec-subtitle {
  font-size: 0.85rem;
  color: #9ca3af;
}

.recommendations-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
}

.recommendation-card {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  padding: 1rem 1.25rem;
  border-radius: 1rem;
  border-left: 4px solid transparent;
}

.recommendation-card.warning {
  background: #fffbeb;
  border-left-color: #f59e0b;
}

.recommendation-card.critical {
  background: #fef2f2;
  border-left-color: #ef4444;
}

.rec-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
  line-height: 1;
  margin-top: 2px;
}

.rec-title {
  font-weight: 700;
  font-size: 0.95rem;
  color: #111827;
  margin-bottom: 0.2rem;
}

.rec-value {
  font-size: 0.8rem;
  color: #6b7280;
  margin-bottom: 0.35rem;
}

.rec-message {
  font-size: 0.875rem;
  color: #374151;
  line-height: 1.4;
}

.recommendations-ok {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 1rem;
  padding: 1rem 1.5rem;
  color: #166534;
  font-weight: 600;
  font-size: 0.95rem;
  margin-bottom: 2rem;
}

.rec-ok-icon {
  font-size: 1.25rem;
  color: #10b981;
  font-weight: 800;
}

/* ===== Pagination bar ===== */
.pagination-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 2rem;
  background: white;
  border-radius: 1.25rem;
  border: 1px solid #f3f4f6;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
  margin-top: 1rem;
}

.pagination-info {
  font-size: 0.875rem;
  color: #6b7280;
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.page-nav {
  padding: 0.5rem 0.9rem;
  font-size: 0.875rem;
}

.page-ellipsis {
  color: #9ca3af;
  font-size: 0.875rem;
  padding: 0 0.25rem;
}

.page-number {
  width: 2.25rem;
  height: 2.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.625rem;
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.15s;
  border: 1px solid #e5e7eb;
  background: white;
  color: #374151;
}

.page-number:hover:not(.active) {
  background: #f3f4f6;
}

.page-number.active {
  background: #10b981;
  color: white;
  border-color: #10b981;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.35);
}

/* ===== Correlation Analysis ===== */
.correlation-panel {
  background: white;
  border-radius: 1.5rem;
  border: 1px solid #f3f4f6;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
  padding: 1.75rem 2rem;
  margin-bottom: 2rem;
}

.correlation-header {
  display: flex;
  align-items: baseline;
  gap: 1rem;
  margin-bottom: 1.25rem;
  flex-wrap: wrap;
}

.correlation-header h2 {
  font-size: 1.25rem;
  font-weight: 700;
  color: #111827;
  margin: 0;
  white-space: nowrap;
}

.corr-subtitle {
  font-size: 0.78rem;
  color: #9ca3af;
  line-height: 1.4;
}

.correlation-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1rem;
}

.corr-card {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 1rem;
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  transition: box-shadow 0.15s;
}

.corr-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.07);
}

.corr-card.strong  { border-left: 3px solid #10b981; }
.corr-card.moderate { border-left: 3px solid #f59e0b; }
.corr-card.weak    { border-left: 3px solid #d1d5db; }

.corr-pair {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.corr-x,
.corr-y {
  font-size: 0.8rem;
  font-weight: 700;
  color: #374151;
  background: #e5e7eb;
  padding: 0.15rem 0.5rem;
  border-radius: 0.375rem;
}

.corr-arrow {
  font-size: 0.75rem;
  color: #9ca3af;
}

.corr-value {
  font-size: 1.5rem;
  font-weight: 800;
  color: #111827;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  margin: 0.2rem 0;
}

.corr-bar-wrap {
  height: 5px;
  background: #f3f4f6;
  border-radius: 99px;
  overflow: hidden;
}

.corr-bar {
  height: 100%;
  border-radius: 99px;
  transition: width 0.4s ease;
  min-width: 4px;
}

.corr-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.corr-card.strong  .corr-label { color: #059669; }
.corr-card.moderate .corr-label { color: #d97706; }

.corr-insight {
  font-size: 0.78rem;
  color: #6b7280;
  line-height: 1.45;
  margin-top: 0.2rem;
  padding-top: 0.5rem;
  border-top: 1px solid #e5e7eb;
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
