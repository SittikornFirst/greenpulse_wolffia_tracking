import { ref, computed, onMounted, onUnmounted } from "vue";
import apiService from "@/services/api";
import { useDevicesStore } from "@/stores/module/devices";
import { useSensorDataStore } from "@/stores/module/sensorData";

export function useDevices(options = {}) {
  const devicesStore = useDevicesStore();
  const sensorDataStore = useSensorDataStore();
  
  const loading = ref(false);
  const error = ref(null);
  const selectedDeviceId = ref(null);
  
  const devices = computed(() => devicesStore.devices || []);
  const hasDevices = computed(() => devices.value.length > 0);
  const deviceCount = computed(() => devicesStore.totalDevices || 0);

  const selectedDevice = computed(() => {
    if (!selectedDeviceId.value) return null;
    return devices.value.find(d => d.device_id === selectedDeviceId.value) || null;
  });

  const activeDevices = computed(() => 
    devices.value.filter(d => d.status === "active")
  );

  const fetchDevices = async (params = {}) => {
    loading.value = true;
    error.value = null;
    try {
      await devicesStore.fetchDevices(params);
      if (hasDevices.value && !selectedDeviceId.value) {
        selectedDeviceId.value = devices.value[0]?.device_id;
      }
    } catch (err) {
      error.value = err.message || "Failed to fetch devices";
      console.error("Error fetching devices:", err);
    } finally {
      loading.value = false;
    }
  };

  const getDeviceById = (deviceId) => {
    return devices.value.find(d => d.device_id === deviceId) || null;
  };

  const getDeviceStatus = (deviceId) => {
    const reading = sensorDataStore.getLatestReading(deviceId);
    if (!reading) return "offline";
    const now = new Date();
    const lastUpdate = new Date(reading.timestamp);
    const diff = (now - lastUpdate) / 1000 / 60;
    if (diff > 30) return "offline";
    if (diff > 5) return "warning";
    return "online";
  };

  const getDeviceSensorData = (deviceId) => {
    return sensorDataStore.getLatestReading(deviceId);
  };

  const refreshDevice = async (deviceId) => {
    loading.value = true;
    try {
      await Promise.all([
        devicesStore.fetchDevices(),
        sensorDataStore.fetchLatestReadings(deviceId),
        sensorDataStore.fetchHistoricalData(deviceId, { range: "24h" })
      ]);
    } catch (err) {
      console.error("Error refreshing device:", err);
    } finally {
      loading.value = false;
    }
  };

  if (options.autoFetch !== false) {
    onMounted(() => {
      fetchDevices();
    });
  }

  return {
    devices,
    hasDevices,
    deviceCount,
    selectedDevice,
    selectedDeviceId,
    activeDevices,
    loading,
    error,
    fetchDevices,
    getDeviceById,
    getDeviceStatus,
    getDeviceSensorData,
    refreshDevice,
    devicesStore,
    sensorDataStore
  };
}

export function useDeviceDetails(deviceId) {
  const devicesStore = useDevicesStore();
  const sensorDataStore = useSensorDataStore();
  
  const loading = ref(false);
  const error = ref(null);

  const device = computed(() => {
    return devicesStore.devices.find(d => d.device_id === deviceId) || null;
  });

  const sensorData = computed(() => {
    return sensorDataStore.getLatestReading(deviceId);
  });

  const fetchDeviceData = async () => {
    loading.value = true;
    error.value = null;
    try {
      await Promise.all([
        sensorDataStore.fetchLatestReadings(deviceId),
        sensorDataStore.fetchHistoricalData(deviceId, { range: "24h" })
      ]);
    } catch (err) {
      error.value = err.message || "Failed to fetch device data";
      console.error("Error fetching device data:", err);
    } finally {
      loading.value = false;
    }
  };

  onMounted(() => {
    fetchDeviceData();
  });

  return {
    device,
    sensorData,
    loading,
    error,
    fetchDeviceData
  };
}

export function useDevicesByFarm(farmId) {
  const devicesStore = useDevicesStore();
  
  const farmDevices = computed(() => {
    if (!farmId) return devicesStore.devices || [];
    return devicesStore.devices.filter(d => d.farmId === farmId || d.farm_id === farmId);
  });

  const fetchFarmDevices = async () => {
    await devicesStore.fetchDevices();
  };

  return {
    farmDevices,
    fetchFarmDevices
  };
}
