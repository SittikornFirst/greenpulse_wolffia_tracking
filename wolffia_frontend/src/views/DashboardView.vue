<template>
    <div class="dashboard">
        <div v-if="!hasFarms" class="dashboard-empty">
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
                    <p class="dashboard__subtitle">Monitor your Wolffia farm water quality in real-time</p>
                </div>
                <div class="dashboard__actions">
                    <div class="farm-selector">
                        <label for="dashboard-farm">Farm</label>
                        <select id="dashboard-farm" v-model="selectedFarmId">
                            <option v-for="farm in farms" :key="farm._id || farm.id" :value="farm._id || farm.id">
                                {{ farm.farm_name || farm.name }}
                            </option>
                        </select>
                    </div>
                    <button @click="refreshData" :disabled="loading" class="btn btn--secondary">
                        <RefreshCw :class="{ 'spin': loading }" :size="16" />
                        <span>Refresh</span>
                    </button>
                </div>
            </div>

            <div v-if="!hasDevice" class="dashboard-empty dashboard-empty--compact">
                <Cpu :size="48" />
                <h3>No device is registered for this farm</h3>
                <p>Each farm can host one monitoring device. Add a device to start streaming data.</p>
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
                    <MetricCard v-for="metric in metrics" :key="metric.id" :title="metric.title" :value="metric.value"
                        :unit="metric.unit" :icon="metric.icon" :status="metric.status" :trend="metric.trend"
                        :range-min="metric.rangeMin" :range-max="metric.rangeMax" :last-update="metric.lastUpdate"
                        :loading="loading" />
                </div>

                <div class="charts-grid">
                    <ChartCard :title="`pH Level (${chartTimeRangeLabel})`" :data="phData" chart-type="area"
                        color="#3b82f6" :optimal-range="{ min: 6.5, max: 7.5 }" :loading="loading"
                        @range-change="handleChartRangeChange" />

                    <ChartCard :title="`Temperature (${chartTimeRangeLabel})`" :data="temperatureData" chart-type="line"
                        color="#ef4444" :optimal-range="{ min: 20, max: 28 }" :loading="loading"
                        @range-change="handleChartRangeChange" />
                </div>

                <div class="charts-grid">
                    <ChartCard :title="`Light Intensity (${chartTimeRangeLabel})`" :data="lightData" chart-type="area"
                        color="#f59e0b" :optimal-range="{ min: 3500, max: 5000 }" :loading="loading"
                        @range-change="handleChartRangeChange" />

                    <ChartCard :title="`Electrical Conductivity (${chartTimeRangeLabel})`" :data="ecData"
                        chart-type="line" color="#10b981" :optimal-range="{ min: 1, max: 2.5 }" :loading="loading"
                        @range-change="handleChartRangeChange" />
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
                        <AlertItem v-for="alert in recentAlerts" :key="alert.id" :alert="alert"
                            @resolve="handleResolveAlert" />
                    </div>
                </div>
            </template>
        </template>
    </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { RefreshCw, AlertCircle, CheckCircle, MapPin, Cpu } from 'lucide-vue-next';
import { useSensorDataStore } from '@/stores/module/sensorData';
import { useDevicesStore } from '@/stores/module/devices';
import { useAlertsStore } from '@/stores/module/alerts';
import { useFarmsStore } from '@/stores/module/farms';
import websocketService from '@/services/websocket';
import MetricCard from '@/components/Dashboard/MetricCard.vue';
import ChartCard from '@/components/Dashboard/ChartCard.vue';
import AlertItem from '@/components/Alerts/AlertItem.vue';

export default {
    name: 'DashboardView',
    components: {
        RefreshCw,
        AlertCircle,
        CheckCircle,
        MapPin,
        Cpu,
        MetricCard,
        ChartCard,
        AlertItem
    },
    setup() {
        const sensorDataStore = useSensorDataStore();
        const devicesStore = useDevicesStore();
        const alertsStore = useAlertsStore();
        const farmsStore = useFarmsStore();

        const loading = ref(false);
        const chartTimeRange = ref('24h');
        const realtimeConnected = computed(() => sensorDataStore.realtimeConnected);
        const farms = computed(() => farmsStore.farms);
        const hasFarms = computed(() => farms.value.length > 0);
        const selectedFarmId = computed({
            get: () => farmsStore.selectedFarmId,
            set: (value) => farmsStore.selectFarm(value)
        });

        const chartTimeRangeLabel = computed(() => {
            switch (chartTimeRange.value) {
                case '24h': return '24 Hours';
                case '7d': return '7 Days';
                case '30d': return '30 Days';
                default: return '24 Hours';
            }
        });

        const hasDevice = computed(() => devicesStore.devices.length > 0);
        const activeDevice = computed(() => devicesStore.devices[0] || null);
        const activeReading = computed(() => {
            if (!activeDevice.value) return null;
            return sensorDataStore.getLatestReading(activeDevice.value.device_id);
        });

        const thresholds = sensorDataStore.thresholds;

        const metricStatus = (key, value) => {
            const range = thresholds[key];
            if (value === null || value === undefined || !range) return 'unknown';
            if (value < range.min || value > range.max) return 'critical';
            const buffer = (range.max - range.min) * 0.1;
            if (value < range.min + buffer || value > range.max - buffer) return 'warning';
            return 'normal';
        };

        const metrics = computed(() => {
            const reading = activeReading.value;
            if (!reading) {
                return [];
            }

            return [
                {
                    id: 'ph',
                    title: 'pH Level',
                    value: reading.ph?.value?.toFixed(2) ?? '--',
                    unit: 'pH',
                    icon: 'Droplet',
                    status: metricStatus('ph', reading.ph?.value),
                    trend: null,
                    rangeMin: thresholds.ph.min,
                    rangeMax: thresholds.ph.max,
                    lastUpdate: reading.timestamp
                },
                {
                    id: 'water_temperature_c',
                    title: 'Water Temperature',
                    value: reading.temperature_water_c?.value?.toFixed(1) ?? '--',
                    unit: '°C',
                    icon: 'Thermometer',
                    status: metricStatus('water_temperature_c', reading.temperature_water_c?.value),
                    trend: null,
                    rangeMin: thresholds.water_temperature_c.min,
                    rangeMax: thresholds.water_temperature_c.max,
                    lastUpdate: reading.timestamp
                },
                {
                    id: 'air_temperature_c',
                    title: 'Air Temperature',
                    value: reading.temperature_air_c?.value?.toFixed(1) ?? '--',
                    unit: '°C',
                    icon: 'Thermometer',
                    status: metricStatus('air_temperature_c', reading.temperature_air_c?.value),
                    trend: null,
                    rangeMin: thresholds.air_temperature_c.min,
                    rangeMax: thresholds.air_temperature_c.max,
                    lastUpdate: reading.timestamp
                },
                {
                    id: 'light_intensity',
                    title: 'Light Intensity',
                    value: reading.light_intensity?.value ?? '--',
                    unit: 'lux',
                    icon: 'Sun',
                    status: metricStatus('light_intensity', reading.light_intensity?.value),
                    trend: null,
                    rangeMin: thresholds.light_intensity.min,
                    rangeMax: thresholds.light_intensity.max,
                    lastUpdate: reading.timestamp
                },
                {
                    id: 'ec_value',
                    title: 'Electrical Conductivity',
                    value: reading.ec?.value?.toFixed(2) ?? '--',
                    unit: 'mS/cm',
                    icon: 'Activity',
                    status: metricStatus('ec_value', reading.ec?.value),
                    trend: null,
                    rangeMin: thresholds.ec_value.min,
                    rangeMax: thresholds.ec_value.max,
                    lastUpdate: reading.timestamp
                }
            ];
        });

        const historicalData = computed(() => {
            if (!activeDevice.value) return [];
            return sensorDataStore.getHistoricalData(activeDevice.value.device_id, chartTimeRange.value) || [];
        });

        const phData = computed(() =>
            historicalData.value
                .filter(reading => reading.ph?.value !== undefined)
                .map(reading => ({ x: reading.timestamp, y: reading.ph.value }))
        );

        const temperatureData = computed(() =>
            historicalData.value
                .filter(reading => reading.temperature_water_c?.value !== undefined)
                .map(reading => ({ x: reading.timestamp, y: reading.temperature_water_c.value }))
        );

        const lightData = computed(() =>
            historicalData.value
                .filter(reading => reading.light_intensity?.value !== undefined)
                .map(reading => ({ x: reading.timestamp, y: reading.light_intensity.value }))
        );

        const ecData = computed(() =>
            historicalData.value
                .filter(reading => reading.ec?.value !== undefined)
                .map(reading => ({ x: reading.timestamp, y: reading.ec.value }))
        );

        const recentAlerts = computed(() => {
            const deviceId = activeDevice.value?.device_id;
            if (!deviceId) return [];
            return alertsStore.unresolvedAlerts
                .filter(alert => alert.device === deviceId)
                .slice(0, 5);
        });

        const refreshData = async () => {
            if (!selectedFarmId.value) return;
            loading.value = true;
            try {
                // Clear devices store before fetching new data
                await devicesStore.fetchDevices(selectedFarmId.value);
                const device = devicesStore.devices[0];

                if (!device) {
                    alertsStore.fetchAlerts({ resolved: false });
                    return;
                }

                await Promise.all([
                    sensorDataStore.fetchLatestReadings(device.device_id),
                    sensorDataStore.fetchHistoricalData(device.device_id, { range: chartTimeRange.value }),
                    alertsStore.fetchAlerts({ resolved: false, deviceId: device.device_id })
                ]);
            } catch (error) {
                console.error('Error refreshing data:', error);
            } finally {
                loading.value = false;
            }
        };

        const handleResolveAlert = async (alertId) => {
            try {
                await alertsStore.resolveAlert(alertId);
            } catch (error) {
                console.error('Error resolving alert:', error);
            }
        };

        const handleChartRangeChange = async (range) => {
            chartTimeRange.value = range;
            if (activeDevice.value) {
                loading.value = true;
                try {
                    await sensorDataStore.fetchHistoricalData(activeDevice.value.device_id, { range });
                } catch (error) {
                    console.error('Error fetching historical data:', error);
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
            devicesStore.updateLocalDevice(status.deviceId, { status: status.status });
        };

        watch(() => farmsStore.selectedFarmId, async (newValue, oldValue) => {
            if (newValue && newValue !== oldValue) {
                await refreshData();
            }
        });

        onMounted(async () => {
            // Always refresh farms and data when component mounts
            await farmsStore.fetchFarms();
            if (farmsStore.selectedFarmId) {
                await refreshData();
            }

            if (!websocketService.isConnected()) {
                const token = localStorage.getItem('auth_token');
                if (token) {
                    try {
                        await websocketService.connect(token);
                    } catch (error) {
                        console.error('Failed to connect to WebSocket:', error);
                    }
                }
            }

            websocketService.on('sensorReading', handleSensorReading);
            websocketService.on('alert', handleAlert);
            websocketService.on('deviceStatus', handleDeviceStatus);
            websocketService.on('connected', () => {
                sensorDataStore.setRealtimeConnection(true);
            });
            websocketService.on('disconnected', () => {
                sensorDataStore.setRealtimeConnection(false);
            });

            if (websocketService.isConnected() && activeDevice.value) {
                websocketService.subscribeToDevice(activeDevice.value.device_id);
            }
        });

        onUnmounted(() => {
            websocketService.off('sensorReading', handleSensorReading);
            websocketService.off('alert', handleAlert);
            websocketService.off('deviceStatus', handleDeviceStatus);
        });

        return {
            farms,
            selectedFarmId,
            hasFarms,
            hasDevice,
            loading,
            realtimeConnected,
            chartTimeRange,
            chartTimeRangeLabel,
            metrics,
            phData,
            temperatureData,
            lightData,
            ecData,
            recentAlerts,
            refreshData,
            handleResolveAlert,
            handleChartRangeChange
        };
    }
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
</style>