// stores/devices.js
import { defineStore } from "pinia";
import { ref, computed } from "vue";
import apiService from "@/services/api";

const normalizeDevice = (device) => ({
  id: device._id || device.id || device.device_id,
  device_id: device.device_id,
  device_name: device.device_name,
  name: device.device_name,
  device_type: device.device_type || "environmental",
  farmId: device.farm_id?._id || device.farm_id || null,
  farmName: device.farm_id?.farm_name || device.farm_name || "",
  location:
    typeof device.location === "string"
      ? device.location
      : device.location?.name || device.location || "",
  status: device.status || "inactive",
  lastActivity: device.last_activity,
  createdAt: device.created_at,
  configuration: device.config_id
    ? {
        id: device.config_id._id || device.config_id.id,
        mqtt_topic: device.config_id.mqtt_topic,
        alert_enabled: device.config_id.alert_enabled,
        sampling_interval: device.config_id.sampling_interval,
        ph_min: device.config_id.ph_min,
        ph_max: device.config_id.ph_max,
        ec_value_min: device.config_id.ec_value_min,
        ec_value_max: device.config_id.ec_value_max,
        light_intensity_min: device.config_id.light_intensity_min,
        light_intensity_max: device.config_id.light_intensity_max,
        air_temp_min: device.config_id.air_temp_min,
        air_temp_max: device.config_id.air_temp_max,
        water_temp_min: device.config_id.water_temp_min,
        water_temp_max: device.config_id.water_temp_max,
        alert_enabled_label: device.config_id.alert_enabled
          ? "Enabled"
          : "Disabled",
      }
    : null,
});

export const useDevicesStore = defineStore("devices", () => {
  const devices = ref([]);
  const loading = ref(false);
  const error = ref(null);
  const selectedDeviceId = ref(null);

  // Getters
  const activeDevices = computed(() =>
    devices.value.filter((device) => device.status === "active"),
  );

  const inactiveDevices = computed(() =>
    devices.value.filter((device) => device.status !== "active"),
  );

  const devicesByFarm = computed(
    () => (farmId) =>
      devices.value.filter((device) => device.farmId === farmId),
  );

  const deviceById = computed(
    () => (id) => devices.value.find((device) => device.id === id),
  );

  const devicesByType = computed(
    () => (type) => devices.value.filter((device) => device.type === type),
  );

  const totalDevices = computed(() => devices.value.length);

  const selectedDevice = computed(() =>
    devices.value.find((device) => device.id === selectedDeviceId.value),
  );

  // Actions
  async function fetchDevices(farmId = null) {
    loading.value = true;
    error.value = null;

    try {
      const response = await apiService.getDevices(farmId);
      devices.value = (response.data || []).map(normalizeDevice);
      return devices.value;
    } catch (err) {
      error.value = err.message || "Failed to fetch devices";
      console.error("Error fetching devices:", err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function addDevice(deviceData) {
    loading.value = true;
    error.value = null;

    try {
      // Map frontend fields to backend expected fields
      const mappedData = {
        device_name: deviceData.name || deviceData.device_name,
        device_type:
          deviceData.type || deviceData.device_type || "greenpulse-v1",
        location: deviceData.location || "Farm Location",
        status: deviceData.status || "active",
      };

      // Only include farm_id if explicitly provided
      // Backend will auto-assign user's farm if not provided
      if (deviceData.farm_id || deviceData.farmId) {
        mappedData.farm_id = deviceData.farm_id || deviceData.farmId;
      }

      // Add device_id if provided, otherwise let backend generate it
      if (deviceData.device_id || deviceData.id) {
        mappedData.device_id = deviceData.device_id || deviceData.id;
      }

      const response = await apiService.createDevice(mappedData);
      const normalized = normalizeDevice(response.data);
      devices.value.push(normalized);
      return normalized;
    } catch (err) {
      error.value = err.message || "Failed to add device";
      console.error("Error adding device:", err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function updateDevice(deviceId, updates) {
    loading.value = true;
    error.value = null;

    try {
      const response = await apiService.updateDevice(deviceId, updates);
      const normalized = normalizeDevice(response.data);
      const index = devices.value.findIndex(
        (d) =>
          d.id === normalized.id ||
          d.device_id === normalized.device_id ||
          d.device_id === deviceId ||
          d.id === deviceId,
      );
      if (index !== -1) {
        devices.value[index] = normalized;
      }
      return normalized;
    } catch (err) {
      error.value = err.message || "Failed to update device";
      console.error("Error updating device:", err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function removeDevice(deviceId) {
    loading.value = true;
    error.value = null;

    try {
      await apiService.deleteDevice(deviceId);
      devices.value = devices.value.filter(
        (d) => d.id !== deviceId && d.device_id !== deviceId,
      );

      // Clear selection if deleted device was selected
      if (selectedDeviceId.value === deviceId) {
        selectedDeviceId.value = null;
      }

      return true;
    } catch (err) {
      error.value = err.message || "Failed to remove device";
      console.error("Error removing device:", err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function updateDeviceStatus(deviceId, status) {
    return updateDevice(deviceId, { status });
  }

  async function assignDeviceToFarm(deviceId, farmId) {
    return updateDevice(deviceId, { farmId });
  }

  function selectDevice(deviceId) {
    selectedDeviceId.value = deviceId;
  }

  function clearSelection() {
    selectedDeviceId.value = null;
  }

  function updateLocalDevice(deviceId, updates) {
    const index = devices.value.findIndex(
      (d) => d.id === deviceId || d.device_id === deviceId,
    );
    if (index !== -1) {
      devices.value[index] = { ...devices.value[index], ...updates };
    }
  }

  function clearError() {
    error.value = null;
  }

  // Reset store
  function $reset() {
    devices.value = [];
    loading.value = false;
    error.value = null;
    selectedDeviceId.value = null;
  }

  return {
    // State
    devices,
    loading,
    error,
    selectedDeviceId,

    // Getters
    activeDevices,
    inactiveDevices,
    devicesByFarm,
    deviceById,
    devicesByType,
    totalDevices,
    selectedDevice,

    // Actions
    fetchDevices,
    addDevice,
    updateDevice,
    removeDevice,
    updateDeviceStatus,
    assignDeviceToFarm,
    selectDevice,
    clearSelection,
    updateLocalDevice,
    clearError,
    $reset,
  };
});
