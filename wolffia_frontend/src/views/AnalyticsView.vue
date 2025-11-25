<template>
    <div class="analytics-view">
        <div class="analytics-header">
            <div>
                <h1>Analytics & Reports</h1>
                <p class="subtitle">Insights and trends from your IoT data</p>
            </div>
            <div class="header-actions">
                <select v-model="timeRange" class="time-select">
                    <option value="24h">Last 24 Hours</option>
                    <option value="7d">Last 7 Days</option>
                    <option value="30d">Last 30 Days</option>
                    <option value="90d">Last 90 Days</option>
                </select>
                <button @click="exportReport" class="btn btn-primary">
                    <Download :size="20" />
                    <span>Export Report</span>
                </button>
            </div>
        </div>

        <!-- Key Metrics -->
        <div class="metrics-grid">
            <div class="metric-card">
                <div class="metric-header">
                    <TrendingUp :size="20" />
                    <span>Average pH</span>
                </div>
                <div class="metric-value">{{ metrics.avgPh.toFixed(2) }}</div>
                <!-- <div class="metric-change metric-change--up">
                    +2.3% from last period
                </div> -->
            </div>

            <div class="metric-card">
                <div class="metric-header">
                    <Thermometer :size="20" />
                    <span>Avg Temperature</span>
                </div>
                <div class="metric-value">{{ metrics.avgTemp.toFixed(1) }}°C</div>
                <!-- <div class="metric-change metric-change--down">
                    -1.2% from last period
                </div> -->
            </div>

            <div class="metric-card">
                <div class="metric-header">
                    <Sun :size="20" />
                    <span>Avg Light</span>
                </div>
                <div class="metric-value">{{ Math.round(metrics.avgLight).toLocaleString() }} lux</div>
                <!-- <div class="metric-change metric-change--up">
                    +5.7% from last period
                </div> -->
            </div>

            <div class="metric-card">
                <div class="metric-header">
                    <Activity :size="20" />
                    <span>Avg Oxygen</span>
                </div>
                <div class="metric-value">{{ metrics.avgOxygen.toFixed(2) }} mS/cm</div>
                <!-- <div class="metric-change metric-change--up">
                    +1.5% from last period
                </div> -->
            </div>
        </div>

        <!-- Charts Grid -->
        <div class="charts-section">
            <div class="chart-card-full">
                <div class="chart-header">
                    <h2>Water Quality Trends</h2>
                    <div class="chart-legend">
                        <div class="legend-item">
                            <span class="legend-dot" style="background: #3b82f6;"></span>
                            <span>pH Level</span>
                        </div>
                        <div class="legend-item">
                            <span class="legend-dot" style="background: #ef4444;"></span>
                            <span>Temperature</span>
                        </div>
                        <div class="legend-item">
                            <span class="legend-dot" style="background: #10b981;"></span>
                            <span>Oxygen</span>
                        </div>
                    </div>
                </div>
                <div class="chart-placeholder">
                    <BarChart3 :size="64" />
                    <p>Multi-line chart showing water quality trends over time</p>
                </div>
            </div>

            <div class="charts-row">
                <div class="chart-card">
                    <div class="chart-header">
                        <h3>Device Performance</h3>
                    </div>
                    <div class="chart-placeholder chart-placeholder--small">
                        <PieChart :size="48" />
                        <p>Device uptime and performance metrics</p>
                    </div>
                </div>

                <div class="chart-card">
                    <div class="chart-header">
                        <h3>Alert Distribution</h3>
                    </div>
                    <div class="chart-placeholder chart-placeholder--small">
                        <BarChart3 :size="48" />
                        <p>Alerts by priority and type</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Data Table -->
        <div class="data-table-section">
            <div class="table-header">
                <h2>Detailed Readings</h2>
                <div class="table-actions">
                    <input v-model="searchQuery" type="text" placeholder="Search..." class="search-input" />
                    <button @click="refreshTable" class="btn btn-secondary btn-sm">
                        <RefreshCw :size="16" />
                    </button>
                </div>
            </div>

            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Timestamp</th>
                            <th>Device</th>
                            <th>Type</th>
                            <th>Value</th>
                            <th>Status</th>
                            <th>Farm</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="(reading, index) in paginatedReadings" :key="index">
                            <td>{{ formatTimestamp(reading.timestamp) }}</td>
                            <td>
                                <div class="device-cell">
                                    <component :is="getDeviceIcon(reading.type)" :size="16" />
                                    <span>{{ reading.device }}</span>
                                </div>
                            </td>
                            <td>{{ getReadingType(reading) }}</td>
                            <td class="value-cell">{{ formatReadingValue(reading) }}</td>
                            <td>
                                <span :class="['status-badge', `status-badge--${getReadingStatus(reading)}`]">
                                    {{ getReadingStatus(reading) }}
                                </span>
                            </td>
                            <td>{{ reading.farm }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div class="table-footer">
                <span class="results-info">
                    Showing {{ startIndex + 1 }}-{{ endIndex }} of {{ filteredReadings.length }}
                </span>
                <div class="pagination-controls">
                    <button @click="currentPage--" :disabled="currentPage === 1" class="btn btn-secondary btn-sm">
                        Previous
                    </button>
                    <span class="page-info">Page {{ currentPage }} of {{ totalPages }}</span>
                    <button @click="currentPage++" :disabled="currentPage === totalPages"
                        class="btn btn-secondary btn-sm">
                        Next
                    </button>
                </div>
            </div>
        </div>

        <!-- Summary Cards -->
        <div class="summary-section">
            <div class="summary-card">
                <div class="summary-header">
                    <Clock :size="20" />
                    <h3>System Uptime</h3>
                </div>
                <div class="summary-value">99.7%</div>
                <p class="summary-text">Excellent reliability over the past 30 days</p>
            </div>

            <div class="summary-card">
                <div class="summary-header">
                    <Database :size="20" />
                    <h3>Data Points Collected</h3>
                </div>
                <div class="summary-value">24,567</div>
                <p class="summary-text">Across all devices and sensors</p>
            </div>

            <div class="summary-card">
                <div class="summary-header">
                    <AlertTriangle :size="20" />
                    <h3>Critical Alerts</h3>
                </div>
                <div class="summary-value">3</div>
                <p class="summary-text">2 resolved, 1 pending action</p>
            </div>

            <div class="summary-card">
                <div class="summary-header">
                    <TrendingUp :size="20" />
                    <h3>Growth Rate</h3>
                </div>
                <div class="summary-value">+15%</div>
                <p class="summary-text">Estimated Wolffia yield improvement</p>
            </div>
        </div>
    </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue';
import {
    Download, TrendingUp, Thermometer, Sun, Activity, BarChart3,
    PieChart, RefreshCw, Clock, Database, AlertTriangle, Droplet, Cpu
} from 'lucide-vue-next';
import apiService from '@/services/api';
import { useSensorDataStore } from '@/stores/module/sensorData';
import { useDevicesStore } from '@/stores/module/devices';
import { useAlertsStore } from '@/stores/module/alerts';

export default {
    name: 'AnalyticsView',
    components: {
        Download, TrendingUp, Thermometer, Sun, Activity, BarChart3,
        PieChart, RefreshCw, Clock, Database, AlertTriangle
    },
    setup() {
        const sensorDataStore = useSensorDataStore();
        const devicesStore = useDevicesStore();
        const alertsStore = useAlertsStore();

        const timeRange = ref('7d');
        const searchQuery = ref('');
        const currentPage = ref(1);
        const itemsPerPage = 10;
        const loading = ref(false);
        const readings = ref([]);
        const metrics = ref({
            avgPh: 0,
            avgTemp: 0,
            avgLight: 0,
            avgOxygen: 0
        });

        // Fetch analytics data
        const fetchAnalytics = async () => {
            loading.value = true;
            try {
                const response = await apiService.getDashboardSummary();
                // Process dashboard summary data

                // Fetch latest readings for all devices
                const latestResponse = await apiService.getLatestReadings();
                readings.value = latestResponse.data || [];

                // Calculate metrics
                if (readings.value.length > 0) {
                    const phReadings = readings.value.filter(r => r.ph?.value);
                    const tempReadings = readings.value.filter(r => r.temperature_water_c?.value);
                    const lightReadings = readings.value.filter(r => r.light_intensity?.value);
                    const oxygenReadings = readings.value.filter(r => r.ec?.value); // Using EC as oxygen proxy

                    metrics.value.avgPh = phReadings.length > 0
                        ? phReadings.reduce((sum, r) => sum + r.ph.value, 0) / phReadings.length
                        : 0;
                    metrics.value.avgTemp = tempReadings.length > 0
                        ? tempReadings.reduce((sum, r) => sum + r.temperature_water_c.value, 0) / tempReadings.length
                        : 0;
                    metrics.value.avgLight = lightReadings.length > 0
                        ? lightReadings.reduce((sum, r) => sum + r.light_intensity.value, 0) / lightReadings.length
                        : 0;
                    metrics.value.avgOxygen = oxygenReadings.length > 0
                        ? oxygenReadings.reduce((sum, r) => sum + r.ec.value, 0) / oxygenReadings.length
                        : 0;
                }
            } catch (error) {
                console.error('Failed to fetch analytics:', error);
            } finally {
                loading.value = false;
            }
        };

        const filteredReadings = computed(() => {
            if (!searchQuery.value) return readings.value;
            const query = searchQuery.value.toLowerCase();
            return readings.value.filter(r => {
                const device = devicesStore.deviceById(r.device_id);
                return device?.device_name?.toLowerCase().includes(query) ||
                    r.device_id?.toLowerCase().includes(query);
            });
        });

        const totalPages = computed(() =>
            Math.ceil(filteredReadings.value.length / itemsPerPage) || 1
        );

        const startIndex = computed(() =>
            (currentPage.value - 1) * itemsPerPage
        );

        const endIndex = computed(() =>
            Math.min(startIndex.value + itemsPerPage, filteredReadings.value.length)
        );

        const paginatedReadings = computed(() =>
            filteredReadings.value.slice(startIndex.value, endIndex.value)
        );

        const getDeviceIcon = (reading) => {
            // Determine icon based on reading data
            if (reading.ph) return Droplet;
            if (reading.temperature_water_c) return Thermometer;
            if (reading.light_intensity) return Sun;
            if (reading.ec) return Activity;
            return Cpu;
        };

        const formatTimestamp = (timestamp) => {
            return new Date(timestamp).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        };

        const formatReadingValue = (reading) => {
            if (reading.ph?.value) return reading.ph.value.toFixed(2);
            if (reading.temperature_water_c?.value) return `${reading.temperature_water_c.value.toFixed(1)}°C`;
            if (reading.light_intensity?.value) return `${reading.light_intensity.value} lux`;
            if (reading.ec?.value) return `${reading.ec.value.toFixed(2)} mS/cm`;
            return 'N/A';
        };

        const getReadingType = (reading) => {
            if (reading.ph) return 'pH';
            if (reading.temperature_water_c) return 'Temperature';
            if (reading.light_intensity) return 'Light';
            if (reading.ec) return 'EC';
            return 'Unknown';
        };

        const getReadingStatus = (reading) => {
            if (reading.ph?.status) return reading.ph.status;
            if (reading.temperature_water_c?.status) return reading.temperature_water_c.status;
            if (reading.light_intensity?.status) return reading.light_intensity.status;
            if (reading.ec?.status) return reading.ec.status;
            return 'normal';
        };

        const exportReport = async () => {
            try {
                const response = await apiService.exportData({ timeRange: timeRange.value });
                const blob = new Blob([response.data], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `analytics-${timeRange.value}-${Date.now()}.csv`;
                a.click();
                window.URL.revokeObjectURL(url);
            } catch (error) {
                alert('Failed to export report: ' + (error.response?.data?.message || error.message));
            }
        };

        const refreshTable = async () => {
            await fetchAnalytics();
        };

        onMounted(async () => {
            await fetchAnalytics();
            await devicesStore.fetchDevices();
            await alertsStore.fetchAlerts();
        });

        return {
            timeRange,
            searchQuery,
            currentPage,
            totalPages,
            startIndex,
            endIndex,
            paginatedReadings,
            filteredReadings,
            metrics,
            loading,
            getDeviceIcon,
            formatTimestamp,
            formatReadingValue,
            getReadingType,
            getReadingStatus,
            exportReport,
            refreshTable
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
    gap: 1rem;
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