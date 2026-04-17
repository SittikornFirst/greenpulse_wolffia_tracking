<template>
  <div class="device-selector">
    <label v-if="label" :for="selectorId" class="selector-label">{{ label }}</label>
    <div class="select-wrapper">
      <select 
        :id="selectorId"
        v-model="selectedId"
        @change="handleChange"
        :disabled="loading || !devices.length"
      >
        <option v-if="!loading && !devices.length" value="" disabled>No devices available</option>
        <option v-else-if="loading" value="" disabled>Loading devices...</option>
        <option v-else-if="showPlaceholder" :value="null">{{ placeholder }}</option>
        <option 
          v-for="device in devices" 
          :key="device.device_id" 
          :value="device.device_id"
        >
          {{ device.device_name }} 
          <span v-if="showStatus" class="status-indicator" :class="getDeviceStatus(device)">
            ({{ getDeviceStatus(device) }})
          </span>
        </option>
      </select>
      <Loader v-if="loading" :size="16" class="loading-icon" />
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted } from "vue";
import { Loader } from "lucide-vue-next";
import { useDevicesStore } from "@/stores/module/devices";
import { useSensorDataStore } from "@/stores/module/sensorData";

export default {
  name: "DeviceSelector",
  components: { Loader },
  props: {
    modelValue: { type: String, default: null },
    label: { type: String, default: "" },
    placeholder: { type: String, default: "Select a device..." },
    showPlaceholder: { type: Boolean, default: true },
    showStatus: { type: Boolean, default: false },
    showAllOption: { type: Boolean, default: false },
    allLabel: { type: String, default: "All Devices" },
    autoFetch: { type: Boolean, default: true },
    disabled: { type: Boolean, default: false }
  },
  emits: ["update:modelValue", "change", "devices-loaded"],
  setup(props, { emit }) {
    const devicesStore = useDevicesStore();
    const sensorDataStore = useSensorDataStore();
    const loading = ref(false);
    const selectorId = computed(() => `device-selector-${Math.random().toString(36).substr(2, 9)}`);

    const devices = computed(() => {
      if (props.showAllOption) {
        return [{ device_id: "__all__", device_name: props.allLabel, status: "all" }, ...devicesStore.devices];
      }
      return devicesStore.devices || [];
    });

    const selectedId = computed({
      get: () => props.modelValue,
      set: (val) => emit("update:modelValue", val)
    });

    const fetchDevices = async () => {
      if (!devicesStore.devices || devicesStore.devices.length === 0) {
        loading.value = true;
        try {
          await devicesStore.fetchDevices();
          emit("devices-loaded", devices.value);
          if (devices.value.length > 0 && !props.modelValue) {
            const firstDevice = props.showAllOption ? devices.value[1] : devices.value[0];
            if (firstDevice) {
              selectedId.value = firstDevice.device_id;
            }
          }
        } catch (err) {
          console.error("Failed to fetch devices:", err);
        } finally {
          loading.value = false;
        }
      }
    };

    const handleChange = () => {
      emit("change", selectedId.value);
    };

    const getDeviceStatus = (device) => {
      if (device.status === "all") return "all";
      if (device.status !== "active") return device.status;
      
      const reading = sensorDataStore.getLatestReading(device.device_id);
      if (!reading) return "offline";
      
      const now = new Date();
      const lastUpdate = new Date(reading.timestamp);
      const diffMins = (now - lastUpdate) / 1000 / 60;
      
      if (diffMins > 30) return "offline";
      if (diffMins > 5) return "stale";
      return "online";
    };

    watch(() => props.modelValue, (newVal) => {
      if (newVal && !devices.value.find(d => d.device_id === newVal)) {
        selectedId.value = devices.value[0]?.device_id || null;
      }
    });

    if (props.autoFetch) {
      onMounted(fetchDevices);
    }

    return {
      selectedId,
      devices,
      loading,
      selectorId,
      handleChange,
      getDeviceStatus
    };
  }
};
</script>

<style scoped>
.device-selector {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.selector-label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  color: #6b7280;
  letter-spacing: 0.05em;
}

.select-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.select-wrapper select {
  appearance: none;
  width: 100%;
  padding: 8px 32px 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  background: white;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.select-wrapper select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.select-wrapper select:disabled {
  background: #f9fafb;
  color: #9ca3af;
  cursor: not-allowed;
}

.select-wrapper::after {
  content: "";
  position: absolute;
  right: 12px;
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 5px solid #6b7280;
  pointer-events: none;
}

.loading-icon {
  position: absolute;
  right: 32px;
  color: #6b7280;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.status-indicator {
  font-size: 0.75rem;
  font-weight: 400;
}

.status-indicator.online { color: #10b981; }
.status-indicator.offline { color: #ef4444; }
.status-indicator.stale { color: #f59e0b; }
.status-indicator.all { color: #6b7280; }
</style>