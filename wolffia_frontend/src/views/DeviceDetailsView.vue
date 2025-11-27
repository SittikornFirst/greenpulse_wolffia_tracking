<template>
    <div class="device-details-view">
        <div class="details-header">
            <button @click="$router.back()" class="back-btn">
                <ArrowLeft :size="20" />
                <span>Back</span>
            </button>
            <div class="header-content">
                <h1>{{ device?.device_name || 'Device Details' }}</h1>
                <span :class="['status-badge', `status-badge--${device?.status}`]">
                    {{ device?.status }}
                </span>
            </div>
        </div>

        <div v-if="loading" class="loading-state">
            <div class="spinner"></div>
            <p>Loading device details...</p>
        </div>

        <div v-else-if="device" class="details-content">
            <!-- Device Info Card -->
            <div class="info-card">
                <div class="card-header">
                    <h2>Device Information</h2>
                    <button @click="showThresholdModal = true" class="btn btn-secondary">
                        <Settings :size="16" />
                        <span>Configure Device</span>
                    </button>
                </div>
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">Device ID:</span>
                        <span class="info-value">{{ device.device_id }}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Device Name:</span>
                        <span class="info-value">{{ device.device_name }}</span>
                    </div>
                    <div class="info-item" v-if="device.location">
                        <span class="info-label">Location:</span>
                        <span class="info-value">{{ device.location }}</span>
                    </div>
                    <div class="info-item" v-if="device.farm_id || device.farmName">
                        <span class="info-label">Farm:</span>
                        <span class="info-value">
                            <router-link v-if="device.farm_id"
                                :to="`/farms/${typeof device.farm_id === 'object' ? device.farm_id._id : device.farm_id}`"
                                class="farm-link">
                                {{ device.farmName || (typeof device.farm_id === 'object' ? device.farm_id.farm_name :
                                    'Farm') }}
                            </router-link>
                            <span v-else>{{ device.farmName }}</span>
                        </span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Status:</span>
                        <span :class="['status-badge', `status-badge--${device.status}`]">
                            {{ device.status }}
                        </span>
                    </div>
                </div>
            </div>

            <!-- Latest Readings Card -->
            <!-- <div class="readings-card">
                <div class="card-header">
                    <h2>Latest Readings</h2>
                    <button @click="refreshReadings" class="refresh-btn" :disabled="loading">
                        <RefreshCw :size="18" :class="{ 'spin': loading }" />
                    </button>
                </div>
                <div v-if="latestReading" class="readings-grid">
                    <div class="reading-item">
                        <div class="reading-icon reading-icon--ph">
                            <Droplet :size="24" />
                        </div>
                        <div class="reading-content">
                            <span class="reading-label">pH Level</span>
                            <span class="reading-value">{{ latestReading.ph?.value?.toFixed(2) || 'N/A' }}</span>
                            <span
                                :class="['reading-status', `reading-status--${latestReading.ph?.status || 'normal'}`]">
                                {{ latestReading.ph?.status || 'N/A' }}
                            </span>
                        </div>
                    </div>
                    <div class="reading-item">
                        <div class="reading-icon reading-icon--ec">
                            <Activity :size="24" />
                        </div>
                        <div class="reading-content">
                            <span class="reading-label">EC</span>
                            <span class="reading-value">{{ latestReading.ec?.value?.toFixed(2) || 'N/A' }} mS/cm</span>
                            <span
                                :class="['reading-status', `reading-status--${latestReading.ec?.status || 'normal'}`]">
                                {{ latestReading.ec?.status || 'N/A' }}
                            </span>
                        </div>
                    </div>
                    <div class="reading-item">
                        <div class="reading-icon reading-icon--temp">
                            <Thermometer :size="24" />
                        </div>
                        <div class="reading-content">
                            <span class="reading-label">Water Temperature</span>
                            <span class="reading-value">{{ latestReading.temperature_water_c?.value?.toFixed(1) || 'N/A'
                            }}°C</span>
                            <span
                                :class="['reading-status', `reading-status--${latestReading.temperature_water_c?.status || 'normal'}`]">
                                {{ latestReading.temperature_water_c?.status || 'N/A' }}
                            </span>
                        </div>
                    </div>
                    <div class="reading-item">
                        <div class="reading-icon reading-icon--air">
                            <Thermometer :size="24" />
                        </div>
                        <div class="reading-content">
                            <span class="reading-label">Air Temperature</span>
                            <span class="reading-value">{{ latestReading.temperature_air_c?.value?.toFixed(1) || 'N/A'
                            }}°C</span>
                            <span
                                :class="['reading-status', `reading-status--${latestReading.temperature_air_c?.status || 'normal'}`]">
                                {{ latestReading.temperature_air_c?.status || 'N/A' }}
                            </span>
                        </div>
                    </div>
                    <div class="reading-item">
                        <div class="reading-icon reading-icon--light">
                            <Sun :size="24" />
                        </div>
                        <div class="reading-content">
                            <span class="reading-label">Light Intensity</span>
                            <span class="reading-value">{{ latestReading.light_intensity?.value || 'N/A' }} lux</span>
                            <span
                                :class="['reading-status', `reading-status--${latestReading.light_intensity?.status || 'normal'}`]">
                                {{ latestReading.light_intensity?.status || 'N/A' }}
                            </span>
                        </div>
                    </div>
                </div>
                <div v-else class="empty-state">
                    <Activity :size="48" />
                    <p>No readings available</p>
                </div>
            </div>

            Charts Section -->
            <!-- <div class="charts-section">
                <ChartCard title="pH Level (24 Hours)" :data="phData" chart-type="line" color="#3b82f6"
                    :optimal-range="{ min: 6.0, max: 7.5 }" />
                <ChartCard title="Water Temperature (24 Hours)" :data="temperatureData" chart-type="area"
                    color="#ef4444" :optimal-range="{ min: 20, max: 28 }" />
                <ChartCard title="EC Level (24 Hours)" :data="ecData" chart-type="line" color="#10b981"
                    :optimal-range="{ min: 1.0, max: 2.5 }" />
                <ChartCard title="Light Intensity (24 Hours)" :data="lightData" chart-type="area" color="#f59e0b"
                    :optimal-range="{ min: 3500, max: 6000 }" />
            </div>
        </div> -->

            <!-- <div v-else class="error-state">
            <AlertCircle :size="48" />
            <h3>Device Not Found</h3>
            <p>The device you're looking for doesn't exist or has been removed.</p>
            <button @click="$router.push('/devices')" class="btn btn-primary">
                <ArrowLeft :size="16" />
                <span>Back to Devices</span>
            </button>
        </div> -->

            <!-- Threshold Configuration Modal -->
            <div v-if="showThresholdModal" class="modal-overlay" @click="showThresholdModal = false">
                <div class="modal" @click.stop>
                    <div class="modal-header">
                        <h2>Device Configuration</h2>
                        <button @click="showThresholdModal = false" class="close-btn">
                            <X :size="20" />
                        </button>
                    </div>
                    <div class="modal-body">
                        <form @submit.prevent="saveThresholds">
                            <div class="threshold-group">
                                <h3>Device Settings</h3>
                                <div class="threshold-inputs">
                                    <div class="input-group">
                                        <label>Sampling Interval (seconds)</label>
                                        <input v-model.number="thresholds.sampling_interval" type="number" min="10"
                                            step="1" required />
                                        <span class="input-hint">How often the device collects sensor data</span>
                                    </div>
                                    <div class="input-group">
                                        <label>Alert Enabled</label>
                                        <select v-model="thresholds.alert_enabled" class="select-input">
                                            <option :value="true">Yes</option>
                                            <option :value="false">No</option>
                                        </select>
                                        <span class="input-hint">Enable/disable threshold alerts</span>
                                    </div>
                                </div>
                            </div>

                            <div class="threshold-group">
                                <h3>pH Level</h3>
                                <div class="threshold-inputs">
                                    <div class="input-group">
                                        <label>Minimum</label>
                                        <input v-model.number="thresholds.ph.min" type="number" step="0.1" required />
                                    </div>
                                    <div class="input-group">
                                        <label>Maximum</label>
                                        <input v-model.number="thresholds.ph.max" type="number" step="0.1" required />
                                    </div>
                                </div>
                            </div>

                            <div class="threshold-group">
                                <h3>Water Temperature (°C)</h3>
                                <div class="threshold-inputs">
                                    <div class="input-group">
                                        <label>Minimum</label>
                                        <input v-model.number="thresholds.water_temp.min" type="number" step="0.1"
                                            required />
                                    </div>
                                    <div class="input-group">
                                        <label>Maximum</label>
                                        <input v-model.number="thresholds.water_temp.max" type="number" step="0.1"
                                            required />
                                    </div>
                                </div>
                            </div>

                            <div class="threshold-group">
                                <h3>Air Temperature (°C)</h3>
                                <div class="threshold-inputs">
                                    <div class="input-group">
                                        <label>Minimum</label>
                                        <input v-model.number="thresholds.air_temp.min" type="number" step="0.1"
                                            required />
                                    </div>
                                    <div class="input-group">
                                        <label>Maximum</label>
                                        <input v-model.number="thresholds.air_temp.max" type="number" step="0.1"
                                            required />
                                    </div>
                                </div>
                            </div>

                            <div class="threshold-group">
                                <h3>EC (mS/cm)</h3>
                                <div class="threshold-inputs">
                                    <div class="input-group">
                                        <label>Minimum</label>
                                        <input v-model.number="thresholds.ec.min" type="number" step="0.1" required />
                                    </div>
                                    <div class="input-group">
                                        <label>Maximum</label>
                                        <input v-model.number="thresholds.ec.max" type="number" step="0.1" required />
                                    </div>
                                </div>
                            </div>

                            <div class="threshold-group">
                                <h3>Light Intensity (lux)</h3>
                                <div class="threshold-inputs">
                                    <div class="input-group">
                                        <label>Minimum</label>
                                        <input v-model.number="thresholds.light.min" type="number" step="1" required />
                                    </div>
                                    <div class="input-group">
                                        <label>Maximum</label>
                                        <input v-model.number="thresholds.light.max" type="number" step="1" required />
                                    </div>
                                </div>
                            </div>

                            <div class="modal-actions">
                                <button type="button" @click="showThresholdModal = false" class="btn btn-secondary">
                                    Cancel
                                </button>
                                <button type="submit" :disabled="saving" class="btn btn-primary">
                                    {{ saving ? 'Saving...' : 'Save Configuration' }}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { ArrowLeft, RefreshCw, Droplet, Thermometer, Sun, Activity, AlertCircle, Settings, X } from 'lucide-vue-next';
import apiService from '@/services/api';
import { useSensorDataStore } from '@/stores/module/sensorData';
import ChartCard from '@/components/Dashboard/ChartCard.vue';

export default {
    name: 'DeviceDetailsView',
    components: {
        ArrowLeft,
        RefreshCw,
        Droplet,
        Thermometer,
        Sun,
        Activity,
        AlertCircle,
        Settings,
        X,
        ChartCard
    },
    setup() {
        const route = useRoute();
        const sensorDataStore = useSensorDataStore();

        const loading = ref(false);
        const saving = ref(false);
        const device = ref(null);
        const latestReading = ref(null);
        const showThresholdModal = ref(false);

        const thresholds = ref({
            sampling_interval: 60,
            alert_enabled: true,
            ph: { min: 6.0, max: 7.5 },
            water_temp: { min: 20, max: 28 },
            air_temp: { min: 20, max: 35 },
            ec: { min: 1.0, max: 2.5 },
            light: { min: 3500, max: 6000 }
        });

        const fetchDeviceDetails = async () => {
            loading.value = true;
            try {
                const deviceResponse = await apiService.getDevice(route.params.id);
                device.value = deviceResponse.data;

                // Extract farm name from populated farm_id
                if (device.value.farm_id) {
                    if (typeof device.value.farm_id === 'object') {
                        device.value.farmName = device.value.farm_id.farm_name || device.value.farm_id.name;
                    }
                }

                // Load thresholds from device configuration
                if (device.value.configuration) {
                    thresholds.value = {
                        sampling_interval: device.value.configuration.sampling_interval || 60,
                        alert_enabled: device.value.configuration.alert_enabled !== false,
                        ph: {
                            min: device.value.configuration.ph_min || 6.0,
                            max: device.value.configuration.ph_max || 7.5
                        },
                        water_temp: {
                            min: device.value.configuration.water_temp_min || 20,
                            max: device.value.configuration.water_temp_max || 28
                        },
                        air_temp: {
                            min: device.value.configuration.air_temp_min || 20,
                            max: device.value.configuration.air_temp_max || 35
                        },
                        ec: {
                            min: device.value.configuration.ec_value_min || 1.0,
                            max: device.value.configuration.ec_value_max || 2.5
                        },
                        light: {
                            min: device.value.configuration.light_intensity_min || 3500,
                            max: device.value.configuration.light_intensity_max || 6000
                        }
                    };
                }

                const readingResponse = await apiService.getLatestReadings(route.params.id);
                latestReading.value = readingResponse.data;

                await sensorDataStore.fetchHistoricalData(route.params.id, { range: '24h' });
            } catch (error) {
                console.error('Failed to fetch device details:', error);
            } finally {
                loading.value = false;
            }
        };

        const saveThresholds = async () => {
            saving.value = true;
            try {
                await apiService.updateDeviceConfiguration(route.params.id, {
                    sampling_interval: thresholds.value.sampling_interval,
                    alert_enabled: thresholds.value.alert_enabled,
                    ph_min: thresholds.value.ph.min,
                    ph_max: thresholds.value.ph.max,
                    water_temp_min: thresholds.value.water_temp.min,
                    water_temp_max: thresholds.value.water_temp.max,
                    air_temp_min: thresholds.value.air_temp.min,
                    air_temp_max: thresholds.value.air_temp.max,
                    ec_value_min: thresholds.value.ec.min,
                    ec_value_max: thresholds.value.ec.max,
                    light_intensity_min: thresholds.value.light.min,
                    light_intensity_max: thresholds.value.light.max
                });
                showThresholdModal.value = false;
                alert('Configuration saved successfully!');
                await fetchDeviceDetails();
            } catch (error) {
                alert('Failed to save configuration: ' + (error.response?.data?.message || error.message));
            } finally {
                saving.value = false;
            }
        };

        const refreshReadings = async () => {
            await fetchDeviceDetails();
        };

        const phData = computed(() => {
            const data = sensorDataStore.getHistoricalData(route.params.id, '24h');
            if (!data || data.length === 0) return [];
            return data
                .filter(r => r.ph?.value !== undefined)
                .map(r => ({
                    x: new Date(r.timestamp).toISOString(),
                    y: r.ph.value
                }));
        });

        const temperatureData = computed(() => {
            const data = sensorDataStore.getHistoricalData(route.params.id, '24h');
            if (!data || data.length === 0) return [];
            return data
                .filter(r => r.temperature_water_c?.value !== undefined)
                .map(r => ({
                    x: new Date(r.timestamp).toISOString(),
                    y: r.temperature_water_c.value
                }));
        });

        const ecData = computed(() => {
            const data = sensorDataStore.getHistoricalData(route.params.id, '24h');
            if (!data || data.length === 0) return [];
            return data
                .filter(r => r.ec?.value !== undefined)
                .map(r => ({
                    x: new Date(r.timestamp).toISOString(),
                    y: r.ec.value
                }));
        });

        const lightData = computed(() => {
            const data = sensorDataStore.getHistoricalData(route.params.id, '24h');
            if (!data || data.length === 0) return [];
            return data
                .filter(r => r.light_intensity?.value !== undefined)
                .map(r => ({
                    x: new Date(r.timestamp).toISOString(),
                    y: r.light_intensity.value
                }));
        });

        onMounted(() => {
            // Always fetch fresh data when component mounts
            fetchDeviceDetails();
        });

        return {
            loading,
            saving,
            device,
            latestReading,
            showThresholdModal,
            thresholds,
            phData,
            temperatureData,
            ecData,
            lightData,
            refreshReadings,
            saveThresholds
        };
    }
};
</script>

<style scoped>
.device-details-view {
    padding: 2rem;
    max-width: 1400px;
    margin: 0 auto;
}

.details-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 2rem;
}

.back-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    color: #374151;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
}

.back-btn:hover {
    background: #f3f4f6;
    border-color: #d1d5db;
}

.header-content {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.header-content h1 {
    font-size: 2rem;
    font-weight: 700;
    color: #1f2937;
    margin: 0;
}

.status-badge {
    padding: 0.5rem 1rem;
    border-radius: 9999px;
    font-size: 0.875rem;
    font-weight: 600;
    text-transform: capitalize;
}

.status-badge--active {
    background: #d1fae5;
    color: #059669;
}

.status-badge--inactive {
    background: #f3f4f6;
    color: #6b7280;
}

.status-badge--maintenance {
    background: #fef3c7;
    color: #d97706;
}

.status-badge--error {
    background: #fee2e2;
    color: #dc2626;
}

.loading-state,
.empty-state,
.error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    text-align: center;
    background: white;
    border-radius: 0.75rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.spinner {
    width: 48px;
    height: 48px;
    border: 4px solid #e5e7eb;
    border-top-color: #10b981;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

.empty-state svg,
.error-state svg {
    color: #d1d5db;
    margin-bottom: 1rem;
}

.error-state h3 {
    font-size: 1.25rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0 0 0.5rem 0;
}

.details-content {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

.info-card,
.readings-card {
    background: white;
    border-radius: 0.75rem;
    padding: 1.5rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid #e5e7eb;
}

.card-header h2 {
    font-size: 1.25rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0;
}

.refresh-btn {
    display: flex;
    align-items: center;
    padding: 0.5rem;
    background: #f3f4f6;
    border: none;
    border-radius: 0.375rem;
    color: #6b7280;
    cursor: pointer;
    transition: all 0.2s;
}

.refresh-btn:hover:not(:disabled) {
    background: #e5e7eb;
    color: #1f2937;
}

.refresh-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.spin {
    animation: spin 1s linear infinite;
}

.info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1.5rem;
}

.info-item {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.info-label {
    font-size: 0.875rem;
    color: #6b7280;
    font-weight: 500;
}

.info-value {
    font-size: 1rem;
    color: #1f2937;
    font-weight: 600;
}

.farm-link {
    color: #3b82f6;
    text-decoration: none;
    font-weight: 600;
}

.farm-link:hover {
    text-decoration: underline;
}

.readings-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
}

.reading-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: #f9fafb;
    border-radius: 0.5rem;
    border-left: 4px solid;
}

.reading-icon {
    width: 48px;
    height: 48px;
    border-radius: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
}

.reading-icon--ph {
    background: #dbeafe;
    color: #2563eb;
    border-left-color: #2563eb;
}

.reading-icon--ec {
    background: #d1fae5;
    color: #059669;
    border-left-color: #059669;
}

.reading-icon--temp {
    background: #fee2e2;
    color: #dc2626;
    border-left-color: #dc2626;
}

.reading-icon--air {
    background: #fef3c7;
    color: #d97706;
    border-left-color: #d97706;
}

.reading-icon--light {
    background: #fef3c7;
    color: #f59e0b;
    border-left-color: #f59e0b;
}

.reading-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.reading-label {
    font-size: 0.875rem;
    color: #6b7280;
}

.reading-value {
    font-size: 1.25rem;
    font-weight: 700;
    color: #1f2937;
}

.reading-status {
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.25rem 0.5rem;
    border-radius: 9999px;
    text-transform: capitalize;
    width: fit-content;
}

.reading-status--normal {
    background: #d1fae5;
    color: #059669;
}

.reading-status--warning {
    background: #fef3c7;
    color: #d97706;
}

.reading-status--critical {
    background: #fee2e2;
    color: #dc2626;
}

.charts-section {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
    gap: 1.5rem;
}

.btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 0.5rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-primary {
    background: #10b981;
    color: white;
}

.btn-primary:hover {
    background: #059669;
}

.btn-secondary {
    background: #f3f4f6;
    color: #374151;
}

.btn-secondary:hover {
    background: #e5e7eb;
}

/* Modal Styles */
.modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 50;
    padding: 1rem;
}

.modal {
    background: white;
    border-radius: 0.75rem;
    max-width: 600px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #e5e7eb;
}

.modal-header h2 {
    font-size: 1.25rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0;
}

.close-btn {
    background: none;
    border: none;
    color: #6b7280;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 0.375rem;
}

.close-btn:hover {
    background: #f3f4f6;
}

.modal-body {
    padding: 1.5rem;
}

.threshold-group {
    margin-bottom: 1.5rem;
}

.threshold-group h3 {
    font-size: 1rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0 0 0.75rem 0;
}

.threshold-inputs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
}

.input-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.input-group label {
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
}

.input-group input {
    padding: 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    font-size: 1rem;
}

.input-group input:focus {
    outline: none;
    border-color: #10b981;
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
}

.input-hint {
    font-size: 0.75rem;
    color: #6b7280;
    font-style: italic;
}

.select-input {
    padding: 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    font-size: 1rem;
    background: white;
    cursor: pointer;
}

.select-input:focus {
    outline: none;
    border-color: #10b981;
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
}

.modal-actions {
    display: flex;
    gap: 1rem;
    margin-top: 2rem;
    justify-content: flex-end;
}

.modal-actions .btn {
    padding: 0.75rem 1.5rem;
}

@media (max-width: 768px) {
    .device-details-view {
        padding: 1rem;
    }

    .details-header {
        flex-direction: column;
        align-items: flex-start;
    }

    .charts-section {
        grid-template-columns: 1fr;
    }

    .readings-grid {
        grid-template-columns: 1fr;
    }
}
</style>