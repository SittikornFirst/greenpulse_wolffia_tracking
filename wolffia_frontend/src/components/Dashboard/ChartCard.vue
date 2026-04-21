<template>
  <div class="chart-card">
    <div class="chart-card__header">
      <h3 class="chart-card__title">{{ title }}</h3>
      <div class="chart-card__range-control" ref="rangeControlRef">
        <span class="current-range-label">{{ currentRangeLabel }}</span>
        <button
          @click="toggleMenu"
          class="range-menu-btn"
          title="Change time range"
          :class="{ active: menuOpen }"
        >
          <span class="dots">•••</span>
        </button>
        <Transition name="dropdown">
          <div v-if="menuOpen" class="range-dropdown">
            <button
              v-for="range in timeRanges"
              :key="range.value"
              @click="selectTimeRange(range.value)"
              :class="['range-opt', { active: selectedRange === range.value }]"
            >
              {{ range.label }}
            </button>
          </div>
        </Transition>
      </div>
    </div>

    <div v-if="loading || rangeLoading" class="chart-card__loading">
      <div class="spinner"></div>
      <p>Loading data...</p>
    </div>

    <div v-else-if="!hasData" class="chart-card__empty">
      <AlertCircle :size="32" />
      <p>No data available for this period</p>
    </div>

    <div v-else class="chart-card__content">
      <div class="chart-container">
        <canvas ref="chartCanvas"></canvas>
      </div>

      <div v-if="optimalRange" class="chart-card__footer">
        <div class="optimal-range">
          <span class="optimal-range__label">Optimal Range:</span>
          <span class="optimal-range__value">
            {{ optimalRange.min }} - {{ optimalRange.max }} {{ unit }}
          </span>
        </div>
        <div :class="['status-badge', `status-badge--${currentStatus}`]">
          <component :is="statusIcon" :size="16" />
          <span>{{ statusText }}</span>
        </div>
      </div>

      <div v-if="showStatistics" class="chart-card__stats">
        <div class="stat-item">
          <span class="stat-label">Average</span>
          <span class="stat-value">{{ statistics.avg.toFixed(decimals) }} {{ unit }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Min</span>
          <span class="stat-value">{{ statistics.min.toFixed(decimals) }} {{ unit }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Max</span>
          <span class="stat-value">{{ statistics.max.toFixed(decimals) }} {{ unit }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Readings</span>
          <span class="stat-value">{{ statistics.count }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, shallowRef, computed, watch, onMounted, onUnmounted, nextTick } from "vue";
import {
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  XCircle,
} from "lucide-vue-next";
import { Chart, registerables } from "chart.js";
Chart.register(...registerables);

// Downsampling config: bucketMs = null means raw data
const GROUPING = {
  "1h":  { bucketMs: null },
  "4h":  { bucketMs: 15 * 60 * 1000 },   // 15-min buckets
  "12h": { bucketMs: 30 * 60 * 1000 },   // 30-min buckets
  "24h": { bucketMs: 60 * 60 * 1000 },   // 1-hr buckets
  "5d":  { bucketMs: 4 * 60 * 60 * 1000 },  // 4-hr buckets
  "7d":  { bucketMs: 6 * 60 * 60 * 1000 },  // 6-hr buckets
  "15d": { bucketMs: 12 * 60 * 60 * 1000 }, // 12-hr buckets
  "30d": { bucketMs: 24 * 60 * 60 * 1000 }, // 1-day buckets
  "all": { bucketMs: 24 * 60 * 60 * 1000 }, // 1-day buckets
};

const TIME_RANGES = [
  { label: "1H",    value: "1h"  },
  { label: "4H",    value: "4h"  },
  { label: "12H",   value: "12h" },
  { label: "1D",    value: "24h" },
  { label: "5D",    value: "5d"  },
  { label: "7D",    value: "7d"  },
  { label: "15D",   value: "15d" },
  { label: "30D",   value: "30d" },
  { label: "All",   value: "all" },
];

const RANGE_LABELS = {
  "1h":  "Last 1 Hour",
  "4h":  "Last 4 Hours",
  "12h": "Last 12 Hours",
  "24h": "Last 24 Hours",
  "5d":  "Last 5 Days",
  "7d":  "Last 7 Days",
  "15d": "Last 15 Days",
  "30d": "Last 30 Days",
  "all": "All Time",
};

/**
 * Group data points into time buckets and average their Y values.
 */
function downsample(data, bucketMs) {
  if (!bucketMs || !data || data.length === 0) return data;

  const buckets = new Map();
  for (const pt of data) {
    if (!pt.x) continue;
    const t = new Date(pt.x).getTime();
    if (isNaN(t)) continue;
    
    const key = Math.floor(t / bucketMs) * bucketMs;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(pt.y);
  }

  return Array.from(buckets.entries())
    .map(([ts, vals]) => ({
      x: new Date(ts).toISOString(),
      y: vals.reduce((s, v) => s + v, 0) / vals.length,
    }))
    .sort((a, b) => new Date(a.x) - new Date(b.x));
}

export default {
  name: "ChartCard",
  components: { AlertCircle, CheckCircle, AlertTriangle, XCircle },
  props: {
    title:         { type: String,  required: true },
    data:          { type: Array,   default: () => [] },
    chartType:     { type: String,  default: "line", validator: (v) => ["line","area","bar"].includes(v) },
    color:         { type: String,  default: "#3b82f6" },
    optimalRange:  { type: Object,  default: null },
    unit:          { type: String,  default: "" },
    loading:       { type: Boolean, default: false },
    showStatistics:{ type: Boolean, default: true },
    decimals:      { type: Number,  default: 2 },
  },
  emits: ["range-change"],
  setup(props, { emit }) {
    const chartCanvas   = ref(null);
    const chartInstance = shallowRef(null);
    const selectedRange = ref("1h");
    const menuOpen      = ref(false);
    const rangeControlRef = ref(null);
    const rangeLoading  = ref(false);

    const timeRanges = TIME_RANGES;

    const currentRangeLabel = computed(() => RANGE_LABELS[selectedRange.value] || "Last 1 Hour");

    const toggleMenu = () => { menuOpen.value = !menuOpen.value; };

    // Close menu when clicking outside
    const onClickOutside = (e) => {
      if (rangeControlRef.value && !rangeControlRef.value.contains(e.target)) {
        menuOpen.value = false;
      }
    };

    onMounted(() => document.addEventListener("click", onClickOutside, true));
    onUnmounted(() => {
      document.removeEventListener("click", onClickOutside, true);
      if (chartInstance.value) chartInstance.value.destroy();
    });

    // Downsampled display data
    const displayData = computed(() => {
      const raw = props.data || [];
      const cfg = GROUPING[selectedRange.value] || { bucketMs: null };
      const sampled = downsample(raw, cfg.bucketMs);
      // Sort oldest→newest for chart
      return [...sampled].sort((a, b) => new Date(a.x) - new Date(b.x));
    });

    const hasData = computed(() => displayData.value.length > 0);

    const statistics = computed(() => {
      if (!hasData.value) return { min: 0, max: 0, avg: 0, count: 0 };
      const vals = displayData.value.map((d) => d.y).filter((v) => v != null && !isNaN(v));
      if (!vals.length) return { min: 0, max: 0, avg: 0, count: 0 };
      const sum = vals.reduce((a, b) => a + b, 0);
      return { min: Math.min(...vals), max: Math.max(...vals), avg: sum / vals.length, count: vals.length };
    });

    const currentStatus = computed(() => {
      if (!hasData.value || !props.optimalRange) return "unknown";
      const latest = displayData.value[displayData.value.length - 1]?.y;
      if (latest == null || isNaN(latest)) return "unknown";
      if (latest < props.optimalRange.min || latest > props.optimalRange.max) return "critical";
      const optimal = (props.optimalRange.min + props.optimalRange.max) / 2;
      return Math.abs(latest - optimal) / optimal > 0.1 ? "warning" : "normal";
    });

    const statusIcon = computed(() => {
      return { normal: CheckCircle, warning: AlertTriangle, critical: XCircle }[currentStatus.value] || AlertCircle;
    });

    const statusText = computed(() => {
      return { normal: "Normal", warning: "Warning", critical: "Critical", unknown: "Unknown" }[currentStatus.value];
    });

    const hexToRgba = (hex, opacity = 0.1) => {
      const c = hex.replace("#", "");
      const r = parseInt(c.slice(0, 2), 16);
      const g = parseInt(c.slice(2, 4), 16);
      const b = parseInt(c.slice(4, 6), 16);
      return `rgba(${r},${g},${b},${opacity})`;
    };

    const formatLabel = (x) => {
      const d = new Date(x);
      const range = selectedRange.value;
      if (range === "1h" || range === "4h" || range === "12h") {
        return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
      }
      if (range === "24h") {
        return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit" });
      }
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    };

    const createChart = async () => {
      await nextTick();
      const canvas = chartCanvas.value;
      if (!canvas || !hasData.value) return;

      if (chartInstance.value) {
        chartInstance.value.destroy();
        chartInstance.value = null;
      }

      const ctx = canvas.getContext("2d");
      const labels = displayData.value.map((d) => formatLabel(d.x));
      const values = displayData.value.map((d) => d.y);

      chartInstance.value = new Chart(ctx, {
        type: props.chartType === "area" ? "line" : props.chartType,
        data: {
          labels,
          datasets: [{
            label: props.title,
            data: values,
            borderColor: props.color,
            backgroundColor: props.chartType === "area" ? hexToRgba(props.color, 0.15) : props.color,
            fill: props.chartType === "area",
            tension: 0.4,
            pointRadius: displayData.value.length > 60 ? 0 : 2,
            pointHoverRadius: 5,
            borderWidth: 2,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: "rgba(0,0,0,0.85)",
              padding: 12,
              callbacks: {
                label: (ctx) => `${ctx.parsed.y.toFixed(props.decimals)} ${props.unit}`,
              },
            },
          },
          scales: {
            x: {
              grid: { color: "rgba(0,0,0,0.05)" },
              ticks: { maxTicksLimit: 7, font: { size: 11 }, maxRotation: 40, minRotation: 0 },
            },
            y: {
              grid: { color: "rgba(0,0,0,0.05)" },
              ticks: {
                font: { size: 11 },
                callback: (v) => v.toFixed(props.decimals),
              },
            },
          },
        },
      });
    };

    const selectTimeRange = (range) => {
      selectedRange.value = range;
      menuOpen.value = false;
      rangeLoading.value = true;
      emit("range-change", range);
    };

    // Rebuild chart when display data changes; also clears per-range loading
    watch(displayData, () => {
      rangeLoading.value = false;
      if (hasData.value && !props.loading) createChart();
    }, { deep: true });

    watch(() => props.loading, (loading) => {
      if (!loading && hasData.value) createChart();
    });

    onMounted(() => {
      if (hasData.value && !props.loading) createChart();
    });

    return {
      chartCanvas,
      rangeControlRef,
      selectedRange,
      menuOpen,
      rangeLoading,
      timeRanges,
      currentRangeLabel,
      hasData,
      statistics,
      currentStatus,
      statusIcon,
      statusText,
      toggleMenu,
      selectTimeRange,
    };
  },
};
</script>

<style scoped>
.chart-card {
  background: white;
  border-radius: 0.75rem;
  padding: 1.5rem;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
}

/* ---- Header ---- */
.chart-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.25rem;
}

.chart-card__title {
  font-size: 1.0625rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

/* ---- Range control ---- */
.chart-card__range-control {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.current-range-label {
  font-size: 0.75rem;
  color: #6b7280;
  font-weight: 500;
  white-space: nowrap;
}

.range-menu-btn {
  width: 32px;
  height: 32px;
  border: 1px solid #e5e7eb;
  background: white;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  color: #6b7280;
  letter-spacing: 1px;
  font-size: 10px;
  font-weight: 700;
}

.range-menu-btn:hover,
.range-menu-btn.active {
  border-color: #3b82f6;
  color: #3b82f6;
  background: #eff6ff;
}

/* ---- Dropdown ---- */
.range-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2px;
  padding: 6px;
  z-index: 50;
  min-width: 160px;
}

.range-opt {
  padding: 6px 8px;
  border: none;
  background: transparent;
  color: #374151;
  border-radius: 5px;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  text-align: center;
  transition: all 0.15s;
}

.range-opt:hover {
  background: #f3f4f6;
  color: #111827;
}

.range-opt.active {
  background: #3b82f6;
  color: white;
}

/* Dropdown animation */
.dropdown-enter-active { animation: dropIn 0.15s ease-out; }
.dropdown-leave-active { animation: dropIn 0.12s ease-in reverse; }
@keyframes dropIn {
  from { opacity: 0; transform: translateY(-6px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0)    scale(1); }
}

/* ---- Loading / Empty ---- */
.chart-card__loading,
.chart-card__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  color: #6b7280;
  gap: 0.75rem;
}

.spinner {
  width: 36px;
  height: 36px;
  border: 3px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ---- Content ---- */
.chart-card__content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.chart-container {
  height: 240px;
  position: relative;
}

/* ---- Footer ---- */
.chart-card__footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 0.875rem;
  border-top: 1px solid #e5e7eb;
  font-size: 0.875rem;
}

.optimal-range__label { color: #6b7280; margin-right: 0.375rem; }
.optimal-range__value { color: #1f2937; font-weight: 500; }

.status-badge {
  display: flex; align-items: center; gap: 0.375rem;
  padding: 0.3rem 0.75rem; border-radius: 0.375rem; font-weight: 600; font-size: 0.8125rem;
}
.status-badge--normal   { background: #d1fae5; color: #059669; }
.status-badge--warning  { background: #fef3c7; color: #d97706; }
.status-badge--critical { background: #fee2e2; color: #dc2626; }
.status-badge--unknown  { background: #f3f4f6; color: #6b7280; }

/* ---- Stats ---- */
.chart-card__stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  padding-top: 0.875rem;
  border-top: 1px solid #e5e7eb;
}

.stat-item { display: flex; flex-direction: column; gap: 0.2rem; }
.stat-label { font-size: 0.7rem; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; }
.stat-value { font-size: 0.9375rem; font-weight: 600; color: #1f2937; }

@media (max-width: 768px) {
  .chart-card__header { flex-direction: column; align-items: flex-start; gap: 0.75rem; }
  .chart-card__stats  { grid-template-columns: repeat(2, 1fr); }
  .chart-container    { height: 185px; }
}
</style>
