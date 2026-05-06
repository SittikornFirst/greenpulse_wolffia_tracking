<template>
  <div class="alert-toast" :class="`alert-toast--${severity}`" role="alert">
    <div class="alert-toast__icon">
      <component :is="severityIcon" :size="20" />
    </div>

    <div class="alert-toast__content">
      <h4 class="alert-toast__title">{{ title }}</h4>
      <p class="alert-toast__message">{{ message }}</p>
      <span class="alert-toast__device">{{ deviceName }}</span>
    </div>

    <button
      @click="close"
      class="alert-toast__close"
      title="Dismiss alert"
      aria-label="Dismiss alert"
    >
      <X :size="18" />
    </button>
  </div>
</template>

<script>
import { computed, onMounted, onUnmounted } from "vue";
import { AlertCircle, AlertTriangle, XCircle, X } from "lucide-vue-next";

const PARAMETER_LABELS = {
  ph_value: "pH Level",
  ec_value: "Electrical Conductivity",
  tds_value: "Total Dissolved Solids",
  water_temperature_c: "Water Temperature",
  air_temperature_c: "Air Temperature",
  air_humidity: "Air Humidity",
  light_intensity: "Light Intensity",
};

const SEVERITY_ICON = {
  critical: XCircle,
  warning: AlertTriangle,
  caution: AlertTriangle,
  info: AlertCircle,
};

export default {
  name: "AlertToast",
  components: { AlertCircle, AlertTriangle, XCircle, X },
  props: {
    alert: { type: Object, required: true },
    duration: { type: Number, default: 6000 },
  },
  emits: ["close"],
  setup(props, { emit }) {
    let dismissTimer = null;

    const severity = computed(() => props.alert?.severity || "caution");

    const severityIcon = computed(
      () => SEVERITY_ICON[severity.value] || AlertCircle,
    );

    const title = computed(() => {
      const param = props.alert?.parameter;
      const friendly = PARAMETER_LABELS[param];
      if (friendly) return `Alert: ${friendly}`;
      // Fallback for unmapped params: humanize snake_case
      if (param) {
        return `Alert: ${param.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}`;
      }
      return "Alert";
    });

    const message = computed(
      () => props.alert?.message || "Sensor reading out of range",
    );

    const deviceName = computed(
      () =>
        props.alert?.device_name ||
        props.alert?.device_id ||
        props.alert?.device ||
        "Unknown Device",
    );

    const close = () => {
      clearTimeout(dismissTimer);
      emit("close");
    };

    onMounted(() => {
      if (props.duration > 0) {
        dismissTimer = setTimeout(close, props.duration);
      }
    });

    onUnmounted(() => clearTimeout(dismissTimer));

    return { severity, severityIcon, title, message, deviceName, close };
  },
};
</script>

<style scoped>
.alert-toast {
  width: 360px;
  max-width: calc(100vw - 32px);
  background: white;
  border-radius: 0.75rem;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border-left: 4px solid #f59e0b;
  pointer-events: auto;
}

.alert-toast--caution { border-left-color: #f59e0b; }
.alert-toast--warning { border-left-color: #f59e0b; }
.alert-toast--critical { border-left-color: #ef4444; }
.alert-toast--info { border-left-color: #3b82f6; }

.alert-toast__icon {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fef3c7;
  color: #d97706;
}
.alert-toast--critical .alert-toast__icon { background: #fee2e2; color: #dc2626; }
.alert-toast--info .alert-toast__icon { background: #dbeafe; color: #2563eb; }

.alert-toast__content { flex: 1; min-width: 0; }

.alert-toast__title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 0.25rem 0;
}

.alert-toast__message {
  font-size: 0.8125rem;
  color: #4b5563;
  margin: 0 0 0.375rem 0;
  line-height: 1.4;
  word-break: break-word;
}

.alert-toast__device {
  font-size: 0.7rem;
  color: #9ca3af;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.alert-toast__close {
  flex-shrink: 0;
  background: none;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 0.375rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, color 0.15s;
}

.alert-toast__close:hover {
  background: #f3f4f6;
  color: #374151;
}
</style>
