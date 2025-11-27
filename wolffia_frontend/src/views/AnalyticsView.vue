<template>
    <div class="analytics-view">
        <div class="analytics-header">
            <div>
                <h1>Farm Analytics</h1>
                <p class="subtitle">Review recent readings for a specific farm</p>
            </div>
            <div class="header-actions">
                <div class="farm-selector" v-if="hasFarms">
                    <label for="analytics-farm">Farm</label>
                    <select id="analytics-farm" v-model="selectedFarmId">
                        <option v-for="farm in farms" :key="farm._id || farm.id" :value="farm._id || farm.id">
                            {{ farm.farm_name || farm.name }}
                        </option>
                    </select>
                </div>
                <button @click="refreshData" :disabled="loading" class="btn btn-primary">
                    <RefreshCw :size="18" :class="{ spin: loading }" />
                    <span>Refresh</span>
                </button>
            </div>
        </div>

        <div v-if="!hasFarms" class="analytics-empty">
            <MapPin :size="56" />
            <h3>No farms yet</h3>
            <p>Create a farm to unlock analytics.</p>
            <router-link to="/farms" class="btn btn-primary">Create a Farm</router-link>
        </div>

        <div v-else-if="!hasDevice" class="analytics-empty">
            <Cpu :size="48" />
            <h3>No device found for this farm</h3>
            <p>Add a monitoring device to start collecting analytics.</p>
            <router-link to="/devices" class="btn btn-secondary">Register Device</router-link>
        </div>

        <div v-else-if="hasDevice && tableRows.length === 0" class="analytics-empty">
            <Activity :size="48" />
            <h3>No data available</h3>
            <p>This farm has no sensor data yet. Waiting for device readings...</p>
        </div>

        <template v-else-if="hasDevice && tableRows.length > 0">
            <div class="metrics-grid">
                <div class="metric-card" v-for="metric in metricCards" :key="metric.label">
                    <div class="metric-header">
                        <component :is="metric.icon" :size="18" />
                        <span>{{ metric.label }}</span>
                    </div>
                    <div class="metric-value">{{ metric.value }}</div>
                    <p class="metric-context">{{ metric.context }}</p>
                </div>
            </div>

            <div class="data-table-section">
                <div class="table-header">
                    <h2>Recent Readings</h2>
                    <span class="table-subtitle">Showing latest {{ tableRows.length }} entries</span>
                </div>
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Timestamp</th>
                                <th>pH</th>
                                <th>Water Temp (°C)</th>
                                <th>Air Temp (°C)</th>
                                <th>EC (mS/cm)</th>
                                <th>Light (lux)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="(reading, idx) in tableRows" :key="idx">
                                <td>{{ formatTimestamp(reading.timestamp) }}</td>
                                <td>{{ formatValue(reading.ph?.value) }}</td>
                                <td>{{ formatValue(reading.temperature_water_c?.value) }}</td>
                                <td>{{ formatValue(reading.temperature_air_c?.value) }}</td>
                                <td>{{ formatValue(reading.ec?.value) }}</td>
                                <td>{{ formatInteger(reading.light_intensity?.value) }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </template>
    </div>
</template>

<script>
import { ref, computed, onMounted, watch } from 'vue';
import { RefreshCw, MapPin, Cpu, Droplet, Thermometer, Sun, Activity } from 'lucide-vue-next';
import { useSensorDataStore } from '@/stores/module/sensorData';
import { useDevicesStore } from '@/stores/module/devices';
import { useFarmsStore } from '@/stores/module/farms';

export default {
    name: 'AnalyticsView',
    components: {
        RefreshCw,
        MapPin,
        Cpu,
        Droplet,
        Thermometer,
        Sun,
        Activity
    },
    setup() {
        const sensorDataStore = useSensorDataStore();
        const devicesStore = useDevicesStore();
        const farmsStore = useFarmsStore();

        const loading = ref(false);
        const tableRows = ref([]);
        const selectedFarmId = computed({
            get: () => farmsStore.selectedFarmId,
            set: (value) => farmsStore.selectFarm(value)
        });

        const farms = computed(() => farmsStore.farms);
        const hasFarms = computed(() => farms.value.length > 0);

        const hasDevice = computed(() => devicesStore.devices.length > 0);
        const activeDevice = computed(() => devicesStore.devices[0] || null);

        const metricCards = computed(() => {
            if (!tableRows.value || !tableRows.value.length) {
                return [
                    { label: 'Avg pH', value: '--', context: 'No data', icon: Droplet },
                    { label: 'Avg Water Temp', value: '--', context: 'No data', icon: Thermometer },
                    { label: 'Avg EC', value: '--', context: 'No data', icon: Activity },
                    { label: 'Avg Light', value: '--', context: 'No data', icon: Sun }
                ];
            }

            const avg = (key) => {
                const values = tableRows.value
                    .map(row => row[key]?.value)
                    .filter(value => typeof value === 'number');
                if (!values.length) return '--';
                const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
                return key === 'ph'
                    ? mean.toFixed(2)
                    : key.includes('temperature')
                        ? mean.toFixed(1)
                        : Math.round(mean).toLocaleString();
            };

            return [
                { label: 'Avg pH', value: avg('ph'), context: '24h window', icon: Droplet },
                { label: 'Avg Water Temp', value: avg('temperature_water_c'), context: '°C', icon: Thermometer },
                { label: 'Avg EC', value: avg('ec'), context: 'mS/cm', icon: Activity },
                { label: 'Avg Light', value: avg('light_intensity'), context: 'lux', icon: Sun }
            ];
        });

        const tableRowsLimited = computed(() => tableRows.value.slice(0, 25));

        const refreshData = async () => {
            if (!selectedFarmId.value) return;
            loading.value = true;
            tableRows.value = []; // Clear existing data first
            try {
                await devicesStore.fetchDevices(selectedFarmId.value);
                const device = devicesStore.devices[0];
                if (!device) {
                    tableRows.value = [];
                    return;
                }
                const history = await sensorDataStore.fetchHistoricalData(device.device_id, { range: '24h', limit: 200 });
                tableRows.value = history || [];
            } catch (error) {
                console.error('Failed to load analytics:', error);
                tableRows.value = [];
            } finally {
                loading.value = false;
            }
        };

        watch(() => farmsStore.selectedFarmId, async (val, oldVal) => {
            if (val && val !== oldVal) {
                await refreshData();
            }
        });

        onMounted(async () => {
            // Always refresh farms to ensure we have latest data
            await farmsStore.fetchFarms();
            if (farmsStore.selectedFarmId) {
                await refreshData();
            }
        });

        const formatTimestamp = (timestamp) => {
            if (!timestamp) return '--';
            return new Date(timestamp).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        };

        const formatValue = (value) => {
            if (value === undefined || value === null) return '--';
            return Number(value).toFixed(2);
        };

        const formatInteger = (value) => {
            if (value === undefined || value === null) return '--';
            return Math.round(value).toLocaleString();
        };

        return {
            loading,
            farms,
            hasFarms,
            hasDevice,
            selectedFarmId,
            metricCards,
            tableRows: tableRowsLimited,
            refreshData,
            formatTimestamp,
            formatValue,
            formatInteger
        };
    }
};
</script>

<style scoped>
.analytics-view {
    padding: 2rem;
    max-width: 1400px;
    margin: 0 auto;
}

.analytics-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 2rem;
}

.analytics-header h1 {
    font-size: 2rem;
    font-weight: 700;
    color: #1f2937;
    margin: 0 0 0.5rem 0;
}

.subtitle {
    color: #6b7280;
    margin: 0;
}

.header-actions {
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
    background: white;
    font-size: 0.875rem;
    cursor: pointer;
}

.farm-selector select:focus {
    outline: none;
    border-color: #10b981;
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
}

.time-select {
    padding: 0.75rem 1rem;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    background: white;
    cursor: pointer;
    font-weight: 500;
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

.analytics-empty {
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
}

.analytics-empty svg {
    color: #d1d5db;
}

.analytics-empty h3 {
    font-size: 1.25rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0;
}

.analytics-empty p {
    margin: 0;
}

.btn-sm {
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
}

.btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 1.5rem;
    margin-bottom: 2rem;
}

.metric-card {
    background: white;
    border-radius: 0.75rem;
    padding: 1.5rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.metric-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #6b7280;
    margin-bottom: 1rem;
}

.metric-value {
    font-size: 2rem;
    font-weight: 700;
    color: #1f2937;
    margin-bottom: 0.5rem;
}

.metric-change {
    font-size: 0.875rem;
    font-weight: 500;
}

.metric-change--up {
    color: #059669;
}

.metric-change--down {
    color: #dc2626;
}

.charts-section {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    margin-bottom: 2rem;
}

.chart-card-full,
.chart-card {
    background: white;
    border-radius: 0.75rem;
    padding: 1.5rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.charts-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1.5rem;
}

.chart-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
}

.chart-header h2,
.chart-header h3 {
    font-size: 1.125rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0;
}

.chart-legend {
    display: flex;
    gap: 1.5rem;
}

.legend-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: #6b7280;
}

.legend-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
}

.chart-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    background: #f9fafb;
    border-radius: 0.5rem;
    color: #9ca3af;
    text-align: center;
}

.chart-placeholder--small {
    padding: 2rem;
}

.chart-placeholder p {
    margin-top: 1rem;
    font-size: 0.875rem;
}

.data-table-section {
    background: white;
    border-radius: 0.75rem;
    padding: 1.5rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    margin-bottom: 2rem;
}

.table-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
}

.table-header h2 {
    font-size: 1.125rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0;
}

.table-actions {
    display: flex;
    gap: 0.75rem;
}

.search-input {
    padding: 0.5rem 1rem;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    font-size: 0.875rem;
}

.table-container {
    overflow-x: auto;
}

.data-table {
    width: 100%;
    border-collapse: collapse;
}

.data-table th {
    text-align: left;
    padding: 0.75rem 1rem;
    background: #f9fafb;
    color: #6b7280;
    font-weight: 600;
    font-size: 0.875rem;
    border-bottom: 2px solid #e5e7eb;
}

.data-table td {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #e5e7eb;
    font-size: 0.875rem;
}

.device-cell {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.value-cell {
    font-weight: 600;
    color: #1f2937;
}

.status-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: capitalize;
}

.status-badge--normal {
    background: #d1fae5;
    color: #059669;
}

.status-badge--warning {
    background: #fef3c7;
    color: #d97706;
}

.status-badge--critical {
    background: #fee2e2;
    color: #dc2626;
}

.table-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #e5e7eb;
}

.results-info,
.page-info {
    font-size: 0.875rem;
    color: #6b7280;
}

.pagination-controls {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.summary-section {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 1.5rem;
}

.summary-card {
    background: white;
    border-radius: 0.75rem;
    padding: 1.5rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.summary-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1rem;
    color: #10b981;
}

.summary-header h3 {
    font-size: 1rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0;
}

.summary-value {
    font-size: 2rem;
    font-weight: 700;
    color: #1f2937;
    margin-bottom: 0.5rem;
}

.summary-text {
    font-size: 0.875rem;
    color: #6b7280;
    margin: 0;
}

@media (max-width: 768px) {
    .analytics-view {
        padding: 1rem;
    }

    .analytics-header {
        flex-direction: column;
        gap: 1rem;
    }

    .header-actions {
        width: 100%;
        flex-direction: column;
    }

    .header-actions .btn {
        width: 100%;
        justify-content: center;
    }

    .table-header {
        flex-direction: column;
        gap: 1rem;
    }

    .table-actions {
        width: 100%;
        flex-direction: column;
    }

    .search-input {
        width: 100%;
    }

    .table-footer {
        flex-direction: column;
        gap: 1rem;
    }

    .pagination-controls {
        width: 100%;
        justify-content: space-between;
    }
}
</style>