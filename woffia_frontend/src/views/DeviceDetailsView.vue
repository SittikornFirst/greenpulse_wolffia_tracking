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
                    <div class="info-item">
                        <span class="info-label">Location:</span>
                        <span class="info-value">{{ device.location?.name || 'N/A' }}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Farm:</span>
                        <span class="info-value">
                            <router-link v-if="device.farm_id" :to="`/farms/${device.farm_id}`" class="farm-link">
                                {{ device.location?.farm_name || 'N/A' }}
                            </router-link>
                            <span v-else>{{ device.location?.farm_name || 'N/A' }}</span>
                        </span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Device Type:</span>
                        <span class="info-value">{{ device.device_type || 'N/A' }}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Firmware:</span>
                        <span class="info-value">{{ device.firmware_version || 'N/A' }}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Connectivity:</span>
                        <span class="info-value">{{ device.connectivity || 'N/A' }}</span>
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
            <div class="readings-card">
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

            <!-- Charts Section -->
            <div class="charts-section">
                <ChartCard title="pH Level (24 Hours)" :data="phData" chart-type="line" color="#3b82f6"
                    :optimal-range="{ min: 6.0, max: 7.5 }" />
                <ChartCard title="Water Temperature (24 Hours)" :data="temperatureData" chart-type="area"
                    color="#ef4444" :optimal-range="{ min: 20, max: 28 }" />
                <ChartCard title="EC Level (24 Hours)" :data="ecData" chart-type="line" color="#10b981"
                    :optimal-range="{ min: 1.0, max: 2.5 }" />
                <ChartCard title="Light Intensity (24 Hours)" :data="lightData" chart-type="area" color="#f59e0b"
                    :optimal-range="{ min: 3500, max: 6000 }" />
            </div>
        </div>

        <div v-else class="error-state">
            <AlertCircle :size="48" />
            <h3>Device Not Found</h3>
            <p>The device you're looking for doesn't exist or has been removed.</p>
            <button @click="$router.push('/devices')" class="btn btn-primary">
                <ArrowLeft :size="16" />
                <span>Back to Devices</span>
            </button>
        </div>
    </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { ArrowLeft, RefreshCw, Droplet, Thermometer, Sun, Activity, AlertCircle } from 'lucide-vue-next';
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
        ChartCard
    },
    setup() {
        const route = useRoute();
        const sensorDataStore = useSensorDataStore();

        const loading = ref(false);
        const device = ref(null);
        const latestReading = ref(null);

        const fetchDeviceDetails = async () => {
            loading.value = true;
            try {
                const deviceResponse = await apiService.getDevice(route.params.id);
                device.value = deviceResponse.data;

                const readingResponse = await apiService.getLatestReadings(route.params.id);
                latestReading.value = readingResponse.data;

                await sensorDataStore.fetchHistoricalData(route.params.id, { range: '24h' });
            } catch (error) {
                console.error('Failed to fetch device details:', error);
            } finally {
                loading.value = false;
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
            fetchDeviceDetails();
        });

        return {
            loading,
            device,
            latestReading,
            phData,
            temperatureData,
            ecData,
            lightData,
            refreshReadings
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