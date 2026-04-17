<template>
    <div class="device-details-view">
        <div class="details-header">
            <button @click="goBack" class="back-btn">
                <ArrowLeft :size="20" />
                <span>Back</span>
            </button>
            <div class="header-content">
                <h1>{{ device?.device_name || 'Device Details' }}</h1>
                <span v-if="device" :class="['status-badge', `status-badge--${device.status}`]">
                    {{ device.status }}
                </span>
            </div>
        </div>

        <div v-if="loading" class="loading-state">
            <div class="spinner"></div>
            <p>Loading device details...</p>
        </div>

        <div v-else-if="device" class="details-content">
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
                    <div v-if="device.location" class="info-item">
                        <span class="info-label">Location:</span>
                        <span class="info-value">{{ device.location }}</span>
                    </div>
                    <div v-if="device.farm_id || device.farmName" class="info-item">
                        <span class="info-label">Farm:</span>
                        <span class="info-value">
                            <router-link v-if="farmLink" :to="farmLink" class="farm-link">
                                {{ device.farmName || 'Farm' }}
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

            <RelayControl
                v-if="deviceConfig"
                :device-id="device.device_id"
                :relays="deviceConfig.relays || []"
                @config-updated="refreshReadings"
            />

            <ScheduleManager
                v-if="deviceConfig"
                :device-id="device.device_id"
                :schedules="deviceConfig.schedules || []"
                :relays="deviceConfig.relays || []"
                @config-updated="refreshReadings"
            />

            <!-- Sensor Reading Log -->
            <div class="info-card">
                <div class="card-header">
                    <h2>Sensor Reading Log</h2>
                    <div class="log-controls">
                        <template v-if="logTimeRange === 'custom'">
                            <input type="datetime-local" v-model="logDateFrom" class="select-input select-sm" @change="fetchReadingLog(true)" />
                            <span class="date-sep">→</span>
                            <input type="datetime-local" v-model="logDateTo" class="select-input select-sm" @change="fetchReadingLog(true)" />
                        </template>
                        
                        <select v-model="logTimeRange" @change="onTimeRangeChange" class="select-input select-sm">
                            <option value="1h">Last 1 Hour</option>
                            <option value="6h">Last 6 Hours</option>
                            <option value="24h">Last 24 Hours</option>
                            <option value="7d">Last 7 Days</option>
                            <option value="30d">Last 30 Days</option>
                            <option value="all">All Time</option>
                            <option value="custom">Custom Range</option>
                        </select>
                        
                        <button @click="fetchReadingLog(true)" class="btn btn-secondary btn-sm" :disabled="logLoading">
                            <RefreshCw :size="14" :class="{ spin: logLoading }" />
                        </button>
                    </div>
                </div>

                <div v-if="logLoading && readingLogs.length === 0" class="log-empty">
                    <div class="spinner-sm"></div>
                    <p>Loading readings...</p>
                </div>
                <div v-else-if="readingLogs.length === 0" class="log-empty">
                    <p>No sensor readings found for this time range.</p>
                </div>
                <div v-else class="log-table-wrap">
                    <table class="log-table">
                        <thead>
                            <tr>
                                <th>Timestamp</th>
                                <th>pH</th>
                                <th>Water °C</th>
                                <th>Air °C</th>
                                <th>Humidity</th>
                                <th>EC</th>
                                <th>TDS</th>
                                <th>Light</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="row in readingLogs" :key="row._id || row.data_id">
                                <td class="td-ts">
                                    <Clock :size="12" class="td-ts-icon" />
                                    {{ formatLogTime(row.timestamp || row.created_at) }}
                                </td>
                                <td>{{ fmtVal(row.ph_value) }}</td>
                                <td>{{ fmtVal(row.water_temperature_c, 1) }}</td>
                                <td>{{ fmtVal(row.air_temperature_c, 1) }}</td>
                                <td>{{ fmtVal(row.air_humidity, 1) }}{{ row.air_humidity != null ? '%' : '' }}</td>
                                <td>{{ fmtVal(row.ec_value) }}</td>
                                <td>{{ fmtVal(row.tds_value, 0) }}</td>
                                <td>{{ fmtVal(row.light_intensity, 0) }}</td>
                                <td>
                                    <span :class="['log-badge', row.quality_flag === 'valid' ? 'log-badge--ok' : 'log-badge--warn']">
                                        {{ row.quality_flag === 'valid' ? 'Normal' : 'Abnormal' }}
                                    </span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div v-if="logTotalPages > 1" class="log-pagination">
                    <span class="log-page-info">Page {{ logPage }} of {{ logTotalPages }} ({{ logTotal }} readings)</span>
                    <div class="log-page-btns">
                        <button @click="changeLogPage(logPage - 1)" :disabled="logPage <= 1 || logLoading" class="btn btn-secondary btn-sm">Prev</button>
                        <button @click="changeLogPage(logPage + 1)" :disabled="logPage >= logTotalPages || logLoading" class="btn btn-secondary btn-sm">Next</button>
                    </div>
                </div>
            </div>
        </div>

        <div v-else class="error-state">
            <AlertCircle :size="48" />
            <h3>Device Not Found</h3>
            <p>The device you're looking for doesn't exist or has been removed.</p>
            <button @click="goToDevices" class="btn btn-primary">
                <ArrowLeft :size="16" />
                <span>Back to Devices</span>
            </button>
        </div>

        <div v-if="showThresholdModal && device" class="modal-overlay" @click="showThresholdModal = false">
            <div class="modal" @click.stop>
                <div class="modal-header">
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <h2>Device Configuration</h2>
                        <button type="button" @click="applyWolffiaPresets" class="btn btn-outline btn-sm preset-btn" style="color: #10b981; border-color: #10b981;">
                            <Leaf :size="14" />
                            Best for Wolffia
                        </button>
                    </div>
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
                                    <input v-model.number="thresholds.sampling_interval" type="number" min="10" step="1" required />
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
                            <h3>Water Temperature (ยฐC)</h3>
                            <div class="threshold-inputs">
                                <div class="input-group">
                                    <label>Minimum</label>
                                    <input v-model.number="thresholds.water_temp.min" type="number" step="0.1" required />
                                </div>
                                <div class="input-group">
                                    <label>Maximum</label>
                                    <input v-model.number="thresholds.water_temp.max" type="number" step="0.1" required />
                                </div>
                            </div>
                        </div>

                        <div class="threshold-group">
                            <h3>Air Temperature (ยฐC)</h3>
                            <div class="threshold-inputs">
                                <div class="input-group">
                                    <label>Minimum</label>
                                    <input v-model.number="thresholds.air_temp.min" type="number" step="0.1" required />
                                </div>
                                <div class="input-group">
                                    <label>Maximum</label>
                                    <input v-model.number="thresholds.air_temp.max" type="number" step="0.1" required />
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
</template>

<script>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
    ArrowLeft, AlertCircle, RefreshCw, Activity,
    Calendar, AlertTriangle, Droplets, Thermometer,
    Wind, Zap, Sun, ShieldCheck, Clock, Settings, X, Leaf
} from 'lucide-vue-next';
import apiService from '@/services/api';
import { useSensorDataStore } from '@/stores/module/sensorData';
import RelayControl from '@/components/Devices/RelayControl.vue';
import ScheduleManager from '@/components/Devices/ScheduleManager.vue';

export default {
    name: 'DeviceDetailsView',
    components: {
        ArrowLeft,
        AlertCircle,
        Settings,
        X,
        RefreshCw,
        Clock,
        RelayControl,
        ScheduleManager,
        Leaf
    },
    setup() {
        const route = useRoute();
        const router = useRouter();
        const sensorDataStore = useSensorDataStore();

        const loading = ref(false);
        const saving = ref(false);
        const device = ref(null);
        const latestReading = ref(null);
        const showThresholdModal = ref(false);

        // Reading log state
        const readingLogs = ref([]);
        const logLoading = ref(false);
        const logPage = ref(1);
        const logLimit = ref(20);
        const logTotal = ref(0);
        const logTotalPages = ref(1);
        const logTimeRange = ref('24h');
        const logDateFrom = ref('');
        const logDateTo = ref('');

        const thresholds = ref({
            sampling_interval: 60,
            alert_enabled: true,
            ph: { min: 6.0, max: 7.5 },
            water_temp: { min: 20, max: 28 },
            air_temp: { min: 20, max: 35 },
            ec: { min: 1.0, max: 2.5 },
            light: { min: 3500, max: 6000 }
        });

        const deviceConfig = computed(() => {
            if (!device.value) return null;
            if (device.value.configuration) return device.value.configuration;
            if (device.value.config_id && typeof device.value.config_id === 'object') {
                return device.value.config_id;
            }
            return null;
        });

        const farmLink = computed(() => {
            if (!device.value?.farm_id) return null;
            const farmId = typeof device.value.farm_id === 'object'
                ? device.value.farm_id._id
                : device.value.farm_id;

            return {
                path: `/farms/${farmId}`,
                query: { from: '/devices' }
            };
        });

        const applyThresholdsFromConfig = (config) => {
            if (!config) return;
            thresholds.value = {
                sampling_interval: config.sampling_interval || 60,
                alert_enabled: config.alert_enabled !== false,
                ph: {
                    min: config.ph_min || 6.0,
                    max: config.ph_max || 7.5
                },
                water_temp: {
                    min: config.water_temp_min || 20,
                    max: config.water_temp_max || 28
                },
                air_temp: {
                    min: config.air_temp_min || 20,
                    max: config.air_temp_max || 35
                },
                ec: {
                    min: config.ec_value_min || 1.0,
                    max: config.ec_value_max || 2.5
                },
                light: {
                    min: config.light_intensity_min || 3500,
                    max: config.light_intensity_max || 6000
                }
            };
        };

        const fetchDeviceDetails = async () => {
            loading.value = true;
            try {
                const deviceResponse = await apiService.getDevice(route.params.id);
                device.value = deviceResponse.data;

                if (device.value.farm_id && typeof device.value.farm_id === 'object') {
                    device.value.farmName = device.value.farm_id.farm_name || device.value.farm_id.name;
                }

                applyThresholdsFromConfig(deviceConfig.value);

                try {
                    const readingResponse = await apiService.getLatestReadings(device.value.device_id);
                    latestReading.value = readingResponse.data;
                } catch (error) {
                    if (error.response?.status === 404) {
                        latestReading.value = null;
                    } else {
                        throw error;
                    }
                }

                try {
                    await sensorDataStore.fetchHistoricalData(device.value.device_id, { range: '24h' });
                } catch (error) {
                    if (error.response?.status !== 404) {
                        throw error;
                    }
                }
            } catch (error) {
                console.error('Failed to fetch device details:', error);
                device.value = null;
                latestReading.value = null;
            } finally {
                loading.value = false;
            }
        };

        const goToDevices = () => {
            router.replace('/devices');
        };

        const goBack = () => {
            const from = typeof route.query.from === 'string' ? route.query.from : '';
            const target = from && from !== route.fullPath ? from : '/devices';
            router.replace(target);
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
                await fetchDeviceDetails();
            } catch (error) {
                alert('Failed to save configuration: ' + (error.response?.data?.message || error.message));
            } finally {
                saving.value = false;
            }
        };

        const applyWolffiaPresets = () => {
            thresholds.value.sampling_interval = 300;
            thresholds.value.alert_enabled = true;
            thresholds.value.ph.min = 6.0;
            thresholds.value.ph.max = 7.5;
            thresholds.value.water_temp.min = 20.0;
            thresholds.value.water_temp.max = 28.0;
            thresholds.value.air_temp.min = 18.0;
            thresholds.value.air_temp.max = 35.0;
            thresholds.value.ec.min = 1.0;
            thresholds.value.ec.max = 2.5;
            thresholds.value.light.min = 3500;
            thresholds.value.light.max = 6000;
        };

        const refreshReadings = async () => {
            await fetchDeviceDetails();
            await fetchReadingLog();
        };

        const fetchReadingLog = async (resetPage = false) => {
            if (!device.value) return;
            if (resetPage) logPage.value = 1;
            logLoading.value = true;
            try {
                const opts = {
                    page: logPage.value,
                    limit: logLimit.value
                };

                if (logTimeRange.value === 'custom') {
                    // Custom date range
                    if (logDateFrom.value) opts.startDate = new Date(logDateFrom.value).toISOString();
                    if (logDateTo.value) opts.endDate = new Date(logDateTo.value).toISOString();
                } else if (logTimeRange.value !== 'all') {
                    // Preset range
                    opts.range = logTimeRange.value;
                }
                // If 'all', we pass no range/dates — backend returns everything

                const resp = await apiService.getHistoricalData(device.value.device_id, opts);
                const resData = resp.data;
                if (resData && resData.data) {
                    readingLogs.value = resData.data;
                    logTotal.value = resData.pagination?.total || resData.data.length;
                    logTotalPages.value = resData.pagination?.pages || 1;
                } else if (Array.isArray(resData)) {
                    readingLogs.value = resData;
                    logTotal.value = resData.length;
                    logTotalPages.value = 1;
                }
            } catch (e) {
                console.error('Failed to fetch reading log:', e);
            } finally {
                logLoading.value = false;
            }
        };

        const onTimeRangeChange = () => {
            if (logTimeRange.value !== 'custom') {
                fetchReadingLog(true);
            }
        };

        const changeLogPage = (p) => {
            if (p >= 1 && p <= logTotalPages.value) {
                logPage.value = p;
                fetchReadingLog();
            }
        };

        const fmtVal = (v, decimals = 2) => {
            if (v === null || v === undefined) return '--';
            return Number(v).toFixed(decimals);
        };

        const formatLogTime = (ts) => {
            if (!ts) return '--';
            return new Date(ts).toLocaleString('en-US', {
                month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
            });
        };

        onMounted(async () => {
            await fetchDeviceDetails();
            await fetchReadingLog(true);
        });

        watch(
            () => route.params.id,
            () => {
                fetchDeviceDetails();
            }
        );

        return {
            loading,
            saving,
            device,
            deviceConfig,
            farmLink,
            latestReading,
            showThresholdModal,
            thresholds,
            readingLogs,
            logLoading,
            logPage,
            logLimit,
            logTotal,
            logTotalPages,
            logTimeRange,
            logDateFrom,
            logDateTo,
            goBack,
            goToDevices,
            refreshReadings,
            saveThresholds,
            applyWolffiaPresets,
            fetchReadingLog,
            changeLogPage,
            onTimeRangeChange,
            fmtVal,
            formatLogTime
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

.info-card {
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

.input-group input:focus,
.select-input:focus {
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

    .threshold-inputs {
        grid-template-columns: 1fr;
    }
}

/* Reading Log */
.log-controls {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    flex-wrap: wrap;
}
.date-sep {
    color: #9ca3af;
    font-size: 0.85rem;
    padding: 0 0.15rem;
}
.select-sm {
    padding: 0.4rem 0.6rem;
    font-size: 0.8rem;
}
.btn-sm {
    padding: 0.4rem 0.8rem;
    font-size: 0.8rem;
}
.log-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 2rem;
    color: #6b7280;
    gap: 0.5rem;
}
.spinner-sm {
    width: 24px;
    height: 24px;
    border: 3px solid #e5e7eb;
    border-top-color: #10b981;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}
.log-table-wrap {
    overflow-x: auto;
}
.log-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
}
.log-table th {
    background: #f9fafb;
    padding: 0.6rem 0.75rem;
    text-align: left;
    font-size: 0.7rem;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    border-bottom: 1px solid #e5e7eb;
    white-space: nowrap;
}
.log-table td {
    padding: 0.6rem 0.75rem;
    color: #374151;
    border-bottom: 1px solid #f3f4f6;
    font-family: 'SF Mono', 'Menlo', monospace;
    font-size: 0.8rem;
    white-space: nowrap;
}
.log-table tr:hover {
    background: #fafbfc;
}
.td-ts {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-family: inherit;
}
.td-ts-icon {
    color: #9ca3af;
}
.log-badge {
    padding: 0.15rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
}
.log-badge--ok {
    background: #d1fae5;
    color: #065f46;
}
.log-badge--warn {
    background: #fee2e2;
    color: #991b1b;
}
.log-pagination {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    border-top: 1px solid #e5e7eb;
    background: #f9fafb;
    border-radius: 0 0 0.75rem 0.75rem;
}
.log-page-info {
    font-size: 0.8rem;
    color: #6b7280;
}
.log-page-btns {
    display: flex;
    gap: 0.5rem;
}
.spin {
    animation: spin 1s linear infinite;
}
</style>
