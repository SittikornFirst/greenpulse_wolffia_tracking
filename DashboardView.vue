<template>
    <div class="dashboard">
        <div class="dashboard__header">
            <div class="dashboard__title">
                <h1>Real-Time Monitoring</h1>
                <p class="dashboard__subtitle">Monitor your Wolffia farm water quality in real-time</p>
            </div>
            <div class="dashboard__actions">
                <button @click="refreshData" :disabled="loading" class="btn btn--secondary">
                    <RefreshCw :class="{ 'spin': loading }" :size="16" />
                    <span>Refresh</span>
                </button>
                <!-- <button @click="exportData" class="btn btn--primary">
                    <Download :size="16" />
                    <span>Export</span>
                </button> -->
            </div>
        </div>

        <!-- Connection Status Banner -->
        <div v-if="!realtimeConnected" class="alert alert--warning">
            <AlertCircle :size="20" />
            <span>Real-time connection lost. Attempting to reconnect...</span>
        </div>

        <!-- Metrics Cards -->
        <div class="metrics-grid">
            <MetricCard v-for="metric in metrics" :key="metric.id" :title="metric.title" :value="metric.value"
                :unit="metric.unit" :icon="metric.icon" :status="metric.status" :trend="metric.trend"
                :range-min="metric.rangeMin" :range-max="metric.rangeMax" :last-update="metric.lastUpdate"
                :loading="loading" />
        </div>

        <!-- Charts Section -->
        <div class="charts-grid">
            <ChartCard title="pH Level (24 Hours)" :data="phData" chart-type="area" color="#3b82f6"
                :optimal-range="{ min: 6.5, max: 7.5 }" :loading="loading" />

            <ChartCard title="Temperature (24 Hours)" :data="temperatureData" chart-type="line" color="#ef4444"
                :optimal-range="{ min: 20, max: 28 }" :loading="loading" />
        </div>

        <div class="charts-grid">
            <ChartCard title="Light Intensity (24 Hours)" :data="lightData" chart-type="area" color="#f59e0b"
                :optimal-range="{ min: 3500, max: 5000 }" :loading="loading" />

            <ChartCard title="Dissolved Oxygen (24 Hours)" :data="oxygenData" chart-type="line" color="#10b981"
                :optimal-range="{ min: 6.0, max: 9.0 }" :loading="loading" />
        </div>

        <!-- Recent Alerts -->
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
                <AlertItem v-for="alert in recentAlerts" :key="alert.id" :alert="alert" @resolve="handleResolveAlert" />
            </div>
        </div>
    </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { RefreshCw, Download, AlertCircle, CheckCircle } from 'lucide-vue-next';
import { useSensorDataStore } from '@/stores/module/sensorData';
import { useDevicesStore } from '@/stores/module/devices';
import { useAlertsStore } from '@/stores/module/alerts';
import websocketService from '@/services/websocket';
import MetricCard from '@/components/Dashboard/MetricCard.vue';
import ChartCard from '@/components/Dashboard/ChartCard.vue';
import AlertItem from '@/components/Alerts/AlertItem.vue';

export default {
    name: 'DashboardView',
    components: {
        RefreshCw,
        Download,
        AlertCircle,
        CheckCircle,
        MetricCard,
        ChartCard,
        AlertItem
    },
    setup() {
        const sensorDataStore = useSensorDataStore();
        const devicesStore = useDevicesStore();
        const alertsStore = useAlertsStore();

        const loading = ref(false);
        const realtimeConnected = computed(() => sensorDataStore.realtimeConnected);

        // Metrics data
        const metrics = computed(() => {
            const phDevice = devicesStore.devicesByType('pH')[0];
            const tempDevice = devicesStore.devicesByType('temperature')[0];
            const lightDevice = devicesStore.devicesByType('light')[0];
            const oxygenDevice = devicesStore.devicesByType('oxygen')[0];

            return [
                {
                    id: 'ph',
                    title: 'pH Level',
                    value: phDevice ? sensorDataStore.getLatestReading(phDevice.id)?.value || 0 : 0,
                    unit: 'pH',
                    icon: 'Droplet',
                    status: phDevice ? sensorDataStore.getSensorStatus(phDevice.id) : 'unknown',
                    trend: phDevice ? sensorDataStore.getTrend(phDevice.id) : null,
                    rangeMin: 6.5,
                    rangeMax: 7.5,
                    lastUpdate: phDevice ? sensorDataStore.getLatestReading(phDevice.id)?.timestamp : null
                },
                {
                    id: 'water_temperature',
                    title: 'Water Temperature',
                    value: tempDevice ? sensorDataStore.getLatestReading(tempDevice.id)?.value || 0 : 0,
                    unit: '°C',
                    icon: 'Thermometer',
                    status: tempDevice ? sensorDataStore.getSensorStatus(tempDevice.id) : 'unknown',
                    trend: tempDevice ? sensorDataStore.getTrend(tempDevice.id) : null,
                    rangeMin: 20,
                    rangeMax: 28,
                    lastUpdate: tempDevice ? sensorDataStore.getLatestReading(tempDevice.id)?.timestamp : null
                },
                {
                    id: 'air_temperature',
                    title: 'Air Temperature',
                    value: tempDevice ? sensorDataStore.getLatestReading(tempDevice.id)?.value || 0 : 0,
                    unit: '°C',
                    icon: 'Thermometer',
                    status: tempDevice ? sensorDataStore.getSensorStatus(tempDevice.id) : 'unknown',
                    trend: tempDevice ? sensorDataStore.getTrend(tempDevice.id) : null,
                    rangeMin: 20,
                    rangeMax: 28,
                    lastUpdate: tempDevice ? sensorDataStore.getLatestReading(tempDevice.id)?.timestamp : null
                },
                {
                    id: 'light',
                    title: 'Light Intensity',
                    value: lightDevice ? sensorDataStore.getLatestReading(lightDevice.id)?.value || 0 : 0,
                    unit: 'lux',
                    icon: 'Sun',
                    status: lightDevice ? sensorDataStore.getSensorStatus(lightDevice.id) : 'unknown',
                    trend: lightDevice ? sensorDataStore.getTrend(lightDevice.id) : null,
                    rangeMin: 3500,
                    rangeMax: 5000,
                    lastUpdate: lightDevice ? sensorDataStore.getLatestReading(lightDevice.id)?.timestamp : null
                },
                {
                    id: 'ec_value',
                    title: 'Electrical Conductivity',
                    value: oxygenDevice ? sensorDataStore.getLatestReading(oxygenDevice.id)?.value || 0 : 0,
                    unit: 'mg/L',
                    icon: 'Activity',
                    status: oxygenDevice ? sensorDataStore.getSensorStatus(oxygenDevice.id) : 'unknown',
                    trend: oxygenDevice ? sensorDataStore.getTrend(oxygenDevice.id) : null,
                    rangeMin: 500,
                    rangeMax: 1500,
                    lastUpdate: oxygenDevice ? sensorDataStore.getLatestReading(oxygenDevice.id)?.timestamp : null
                }
            ];
        });

        // Chart data
        const phData = computed(() => {
            const device = devicesStore.devicesByType('pH')[0];
            return device ? sensorDataStore.getHistoricalData(device.id, '24h') : [];
        });

        const temperatureData = computed(() => {
            const device = devicesStore.devicesByType('temperature')[0];
            return device ? sensorDataStore.getHistoricalData(device.id, '24h') : [];
        });

        const lightData = computed(() => {
            const device = devicesStore.devicesByType('light')[0];
            return device ? sensorDataStore.getHistoricalData(device.id, '24h') : [];
        });

        const oxygenData = computed(() => {
            const device = devicesStore.devicesByType('oxygen')[0];
            return device ? sensorDataStore.getHistoricalData(device.id, '24h') : [];
        });

        const recentAlerts = computed(() =>
            alertsStore.unresolvedAlerts.slice(0, 5)
        );

        // Methods
        const refreshData = async () => {
            loading.value = true;
            try {
                await Promise.all([
                    devicesStore.fetchDevices(),
                    sensorDataStore.fetchLatestReadings(),
                    alertsStore.fetchAlerts({ resolved: false })
                ]);

                // Fetch historical data for all devices
                for (const device of devicesStore.devices) {
                    await sensorDataStore.fetchHistoricalData(device.id, { range: '24h' });
                }
            } catch (error) {
                console.error('Error refreshing data:', error);
            } finally {
                loading.value = false;
            }
        };

        const exportData = () => {
            // Implement export functionality
            console.log('Exporting data...');
        };

        const handleResolveAlert = async (alertId) => {
            try {
                await alertsStore.resolveAlert(alertId);
            } catch (error) {
                console.error('Error resolving alert:', error);
            }
        };

        // WebSocket event handlers
        const handleSensorReading = (reading) => {
            sensorDataStore.updateRealtimeReading(reading);
        };

        const handleAlert = (alert) => {
            alertsStore.addAlert(alert);
        };

        const handleDeviceStatus = (status) => {
            devicesStore.updateLocalDevice(status.deviceId, { status: status.status });
        };

        onMounted(async () => {
            await refreshData();

            // Only setup WebSocket listeners if not already connected
            // The DefaultLayout should handle the connection
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

            // Setup WebSocket listeners
            websocketService.on('sensorReading', handleSensorReading);
            websocketService.on('alert', handleAlert);
            websocketService.on('deviceStatus', handleDeviceStatus);
            websocketService.on('connected', () => {
                sensorDataStore.setRealtimeConnection(true);
            });
            websocketService.on('disconnected', () => {
                sensorDataStore.setRealtimeConnection(false);
            });

            // Subscribe to all devices only if connected
            if (websocketService.isConnected()) {
                devicesStore.devices.forEach(device => {
                    websocketService.subscribeToDevice(device.id);
                });
            }
        });

        onUnmounted(() => {
            websocketService.off('sensorReading', handleSensorReading);
            websocketService.off('alert', handleAlert);
            websocketService.off('deviceStatus', handleDeviceStatus);
            // Don't disconnect here - let DefaultLayout handle it
        });
        return {
            loading,
            realtimeConnected,
            metrics,
            phData,
            temperatureData,
            lightData,
            oxygenData,
            recentAlerts,
            refreshData,
            exportData,
            handleResolveAlert
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
    gap: 1rem;
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