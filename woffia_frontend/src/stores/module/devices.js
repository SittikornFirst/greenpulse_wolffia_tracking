// stores/devices.js
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import apiService from '@/services/api';

export const useDevicesStore = defineStore('devices', () => {
    // State
    const devices = ref([]);
    const loading = ref(false);
    const error = ref(null);
    const selectedDeviceId = ref(null);

    // Getters
    const activeDevices = computed(() =>
        devices.value.filter(device => device.status === 'active')
    );

    const inactiveDevices = computed(() =>
        devices.value.filter(device => device.status !== 'active')
    );

    const devicesByFarm = computed(() => (farmId) =>
        devices.value.filter(device => device.farmId === farmId)
    );

    const deviceById = computed(() => (id) =>
        devices.value.find(device => device.id === id)
    );

    const devicesByType = computed(() => (type) =>
        devices.value.filter(device => device.type === type)
    );

    const totalDevices = computed(() => devices.value.length);

    const selectedDevice = computed(() =>
        devices.value.find(device => device.id === selectedDeviceId.value)
    );

    // Actions
    async function fetchDevices(farmId = null) {
        loading.value = true;
        error.value = null;

        try {
            const response = await apiService.getDevices(farmId);
            devices.value = response.data;
            return response.data;
        } catch (err) {
            error.value = err.message || 'Failed to fetch devices';
            console.error('Error fetching devices:', err);
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
                device_type: deviceData.type || deviceData.device_type || 'greenpulse-v1',
                farm_id: deviceData.farm_id || deviceData.farmId, // Required - must be provided
                location: {
                    name: deviceData.location || '',
                    address: deviceData.location || ''
                },
                status: deviceData.status || 'active'
            };

            // Add device_id if provided, otherwise let backend generate it
            if (deviceData.device_id || deviceData.id) {
                mappedData.device_id = deviceData.device_id || deviceData.id;
            }

            const response = await apiService.createDevice(mappedData);
            devices.value.push(response.data);
            return response.data;
        } catch (err) {
            error.value = err.message || 'Failed to add device';
            console.error('Error adding device:', err);
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
            const index = devices.value.findIndex(d => d.id === deviceId);
            if (index !== -1) {
                devices.value[index] = { ...devices.value[index], ...response.data };
            }
            return response.data;
        } catch (err) {
            error.value = err.message || 'Failed to update device';
            console.error('Error updating device:', err);
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
            devices.value = devices.value.filter(d => d.id !== deviceId);

            // Clear selection if deleted device was selected
            if (selectedDeviceId.value === deviceId) {
                selectedDeviceId.value = null;
            }

            return true;
        } catch (err) {
            error.value = err.message || 'Failed to remove device';
            console.error('Error removing device:', err);
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
        const index = devices.value.findIndex(d => d.id === deviceId);
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
        $reset
    };
});