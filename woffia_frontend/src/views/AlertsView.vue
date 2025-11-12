<template>
    <div class="alerts-view">
        <div class="alerts-header">
            <div>
                <h1>Alerts & Notifications</h1>
                <p class="subtitle">Monitor and manage system alerts</p>
            </div>
            <div class="header-actions">
                <button @click="showThresholdConfig = true" class="btn btn-secondary">
                    <Settings :size="20" />
                    <span>Configure Thresholds</span>
                </button>
                <button @click="clearResolvedAlerts" class="btn btn-secondary">
                    <Trash2 :size="20" />
          <span>Clear Resolved</span>
        </button>
      </div>
    </div>

    <!-- Alert Stats -->
    <div class=" alert-stats">
                        <div class="stat-card stat-card--danger">
                            <div class="stat-icon">
                                <AlertTriangle :size="32" />
                            </div>
                            <div class="stat-content">
                                <p class="stat-value">{{ alertCounts.high }}</p>
                                <p class="stat-label">High Priority</p>
                            </div>
                        </div>
                        <div class="stat-card stat-card--warning">
                            <div class="stat-icon">
                                <AlertCircle :size="32" />
                            </div>
                            <div class="stat-content">
                                <p class="stat-value">{{ alertCounts.medium }}</p>
                                <p class="stat-label">Medium Priority</p>
                            </div>
                        </div>
                        <div class="stat-card stat-card--info">
                            <div class="stat-icon">
                                <Info :size="32" />
                            </div>
                            <div class="stat-content">
                                <p class="stat-value">{{ alertCounts.low }}</p>
                                <p class="stat-label">Low Priority</p>
                            </div>
                        </div>
                        <div class="stat-card stat-card--success">
                            <div class="stat-icon">
                                <CheckCircle :size="32" />
                            </div>
                            <div class="stat-content">
                                <p class="stat-value">{{ resolvedCount }}</p>
                                <p class="stat-label">Resolved Today</p>
                            </div>
                        </div>
            </div>

            <!-- Filters -->
            <div class="filters">
                <div class="filter-tabs">
                    <button v-for="tab in tabs" :key="tab.value" @click="activeTab = tab.value"
                        :class="['tab', { 'tab--active': activeTab === tab.value }]">
                        {{ tab.label }}
                        <span v-if="tab.count" class="tab-badge">{{ tab.count }}</span>
                    </button>
                </div>

                <div class="filter-controls">
                    <select v-model="filterPriority" class="filter-select">
                        <option value="">All Priorities</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                    </select>
                    <select v-model="filterDevice" class="filter-select">
                        <option value="">All Devices</option>
                        <option v-for="device in devices" :key="device.id" :value="device.id">
                            {{ device.name }}
                        </option>
                    </select>
                    <select v-model="sortBy" class="filter-select">
                        <option value="newest">Newest First</option>
                        <option value="oldest">Oldest First</option>
                        <option value="priority">Priority</option>
                    </select>
                </div>
            </div>

            <!-- Loading State -->
            <div v-if="loading" class="loading-state">
                <div class="spinner"></div>
                <p>Loading alerts...</p>
            </div>

            <!-- Empty State -->
            <div v-else-if="filteredAlerts.length === 0" class="empty-state">
                <CheckCircle :size="64" />
                <h3>{{ activeTab === 'all' ? 'No alerts found' : 'No ' + activeTab + ' alerts' }}</h3>
                <p>{{ activeTab === 'resolved' ? 'Great! You have resolved all alerts.' : 'All systems are operating normally.' }}</p>
            </div>

            <!-- Alerts List -->
            <div v-else class="alerts-list">
                <AlertItem v-for="alert in filteredAlerts" :key="alert.id" :alert="alert" :show-details="true"
                    :allow-delete="activeTab === 'resolved'" @resolve="handleResolveAlert" @delete="handleDeleteAlert"
                    @view-details="handleViewDetails" />
            </div>

            <!-- Pagination -->
            <div v-if="filteredAlerts.length > 0" class="pagination">
                <button @click="currentPage--" :disabled="currentPage === 1" class="btn btn-secondary btn-sm">
                    Previous
                </button>
                <span class="pagination-info">
                    Page {{ currentPage }} of {{ totalPages }}
                </span>
                <button @click="currentPage++" :disabled="currentPage === totalPages" class="btn btn-secondary btn-sm">
                    Next
                </button>
            </div>

            <!-- Threshold Configuration Modal -->
            <div v-if="showThresholdConfig" class="modal-overlay" @click="showThresholdConfig = false">
                <div class="modal" @click.stop>
                    <div class="modal-header">
                        <h2>Configure Alert Thresholds</h2>
                        <button @click="showThresholdConfig = false" class="close-btn">
                            <X :size="20" />
                        </button>
                    </div>
                    <div class="modal-body">
                        <form @submit.prevent="saveThresholds">
                            <div class="threshold-group">
                                <h3>
                                    <Droplet :size="20" /> pH Levels</h3>
              <div class=" threshold-inputs">
                                        <div class="input-group">
                                            <label>Minimum</label>
                                            <input v-model.number="thresholds.pH.min" type="number" step="0.1" />
                                        </div>
                                        <div class="input-group">
                                            <label>Maximum</label>
                                            <input v-model.number="thresholds.pH.max" type="number" step="0.1" />
                                        </div>
                            </div>
                    </div>

                    <div class="threshold-group">
                        <h3>
                            <Thermometer :size="20" /> Temperature (°C)
                        </h3>
                        <div class="threshold-inputs">
                            <div class="input-group">
                                <label>Minimum</label>
                                <input v-model.number="thresholds.temperature.min" type="number" step="0.1" />
                            </div>
                            <div class="input-group">
                                <label>Maximum</label>
                                <input v-model.number="thresholds.temperature.max" type="number" step="0.1" />
                            </div>
                        </div>
                    </div>

                    <div class="threshold-group">
                        <h3>
                            <Sun :size="20" /> Light Intensity (lux)
                        </h3>
                        <div class="threshold-inputs">
                            <div class="input-group">
                                <label>Minimum</label>
                                <input v-model.number="thresholds.light.min" type="number" step="100" />
                            </div>
                            <div class="input-group">
                                <label>Maximum</label>
                                <input v-model.number="thresholds.light.max" type="number" step="100" />
                            </div>
                        </div>
                    </div>

                    <div class="threshold-group">
                        <h3>
                            <Activity :size="20" /> Dissolved Oxygen (mg/L)
                        </h3>
                        <div class="threshold-inputs">
                            <div class="input-group">
                                <label>Minimum</label>
                                <input v-model.number="thresholds.oxygen.min" type="number" step="0.1" />
                            </div>
                            <div class="input-group">
                                <label>Maximum</label>
                                <input v-model.number="thresholds.oxygen.max" type="number" step="0.1" />
                            </div>
                        </div>
                    </div>

                    <div class="form-actions">
                        <button type="button" @click="showThresholdConfig = false" class="btn btn-secondary">
                            Cancel
                        </button>
                        <button type="submit" class="btn btn-primary">
                            Save Thresholds
                        </button>
                    </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import {
    AlertTriangle, AlertCircle, Info, CheckCircle, Settings, Trash2, X,
    Droplet, Thermometer, Sun, Activity
} from 'lucide-vue-next';
import { useAlertsStore } from '@/stores/module/alerts';
import { useDevicesStore } from '@/stores/module/devices';
import { useSensorDataStore } from '@/stores/module/sensorData';
import AlertItem from '@/components/Alerts/AlertItem.vue';

export default {
    name: 'AlertsView',
    components: {
        AlertTriangle, AlertCircle, Info, CheckCircle, Settings, Trash2, X,
        Droplet, Thermometer, Sun, Activity,
        AlertItem
    },
    setup() {
        const router = useRouter();
        const route = useRoute();
        const alertsStore = useAlertsStore();
        const devicesStore = useDevicesStore();
        const sensorDataStore = useSensorDataStore();

        const loading = ref(false);
        const activeTab = ref('unresolved');
        const filterPriority = ref('');
        const filterDevice = ref('');
        const sortBy = ref('newest');
        const currentPage = ref(1);
        const itemsPerPage = 10;
        const showThresholdConfig = ref(false);

        const thresholds = ref({
            pH: { min: 6.5, max: 7.5 },
            temperature: { min: 20, max: 28 },
            light: { min: 3500, max: 5000 },
            oxygen: { min: 6.0, max: 9.0 }
        });

        const devices = computed(() => devicesStore.devices);
        const alertCounts = computed(() => alertsStore.alertCounts);
        const resolvedCount = computed(() => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return alertsStore.resolvedAlerts.filter(alert =>
                new Date(alert.resolvedAt) >= today
            ).length;
        });

        const tabs = computed(() => [
            { label: 'Unresolved', value: 'unresolved', count: alertsStore.unresolvedAlerts.length },
            { label: 'All Alerts', value: 'all', count: null },
            { label: 'Resolved', value: 'resolved', count: alertsStore.resolvedAlerts.length }
        ]);

        const filteredAlerts = computed(() => {
            let alerts = activeTab.value === 'unresolved'
                ? alertsStore.unresolvedAlerts
                : activeTab.value === 'resolved'
                    ? alertsStore.resolvedAlerts
                    : alertsStore.alerts;

            if (filterPriority.value) {
                alerts = alerts.filter(a => a.type === filterPriority.value);
            }

            if (filterDevice.value) {
                alerts = alerts.filter(a => a.device === filterDevice.value);
            }

            // Sort
            alerts = [...alerts].sort((a, b) => {
                if (sortBy.value === 'newest') {
                    return new Date(b.timestamp) - new Date(a.timestamp);
                } else if (sortBy.value === 'oldest') {
                    return new Date(a.timestamp) - new Date(b.timestamp);
                } else if (sortBy.value === 'priority') {
                    const priority = { high: 3, medium: 2, low: 1 };
                    return priority[b.type] - priority[a.type];
                }
                return 0;
            });

            // Paginate
            const start = (currentPage.value - 1) * itemsPerPage;
            return alerts.slice(start, start + itemsPerPage);
        });

        const totalPages = computed(() => {
            const total = activeTab.value === 'unresolved'
                ? alertsStore.unresolvedAlerts.length
                : activeTab.value === 'resolved'
                    ? alertsStore.resolvedAlerts.length
                    : alertsStore.alerts.length;
            return Math.ceil(total / itemsPerPage) || 1;
        });

        const handleResolveAlert = async (alertId) => {
            try {
                await alertsStore.resolveAlert(alertId);
            } catch (error) {
                alert('Failed to resolve alert: ' + error.message);
            }
        };

        const handleDeleteAlert = async (alertId) => {
            try {
                await alertsStore.deleteAlert(alertId);
            } catch (error) {
                alert('Failed to delete alert: ' + error.message);
            }
        };

        const handleViewDetails = (alert) => {
            router.push(`/devices/${alert.device}`);
        };

        const clearResolvedAlerts = async () => {
            if (!confirm('Are you sure you want to clear all resolved alerts?')) return;

            try {
                alertsStore.clearResolvedAlerts();
            } catch (error) {
                alert('Failed to clear resolved alerts: ' + error.message);
            }
        };

        const saveThresholds = () => {
            Object.keys(thresholds.value).forEach(type => {
                sensorDataStore.updateThreshold(type, thresholds.value[type]);
            });
            showThresholdConfig.value = false;
            alert('Thresholds updated successfully!');
        };

        onMounted(async () => {
            loading.value = true;
            try {
                await Promise.all([
                    alertsStore.fetchAlerts(),
                    devicesStore.fetchDevices()
                ]);

                // Load thresholds
                Object.keys(sensorDataStore.thresholds).forEach(type => {
                    if (thresholds.value[type]) {
                        thresholds.value[type] = sensorDataStore.thresholds[type];
                    }
                });

                // Check for highlight query param
                if (route.query.highlight) {
                    const alertId = route.query.highlight;
                    setTimeout(() => {
                        const element = document.getElementById(`alert-${alertId}`);
                        if (element) {
                            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                    }, 500);
                }
            } catch (error) {
                console.error('Failed to fetch data:', error);
            } finally {
                loading.value = false;
            }
        });

        return {
            loading,
            activeTab,
            filterPriority,
            filterDevice,
            sortBy,
            currentPage,
            totalPages,
            showThresholdConfig,
            thresholds,
            devices,
            alertCounts,
            resolvedCount,
            tabs,
            filteredAlerts,
            handleResolveAlert,
            handleDeleteAlert,
            handleViewDetails,
            clearResolvedAlerts,
            saveThresholds
        };
    }
};
</script>

<style scoped>
.alerts-view {
    padding: 2rem;
    max-width: 1200px;
    margin: 0 auto;
}

.alerts-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 2rem;
}

.alerts-header h1 {
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

.alert-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 1.5rem;
    margin-bottom: 2rem;
}

.stat-card {
    background: white;
    border-radius: 0.75rem;
    padding: 1.5rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    border-left: 4px solid;
}

.stat-card--danger {
    border-left-color: #ef4444;
}

.stat-card--warning {
    border-left-color: #f59e0b;
}

.stat-card--info {
    border-left-color: #3b82f6;
}

.stat-card--success {
    border-left-color: #10b981;
}

.stat-icon {
    width: 56px;
    height: 56px;
    border-radius: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
}

.stat-card--danger .stat-icon {
    background: #fee2e2;
    color: #dc2626;
}

.stat-card--warning .stat-icon {
    background: #fef3c7;
    color: #d97706;
}

.stat-card--info .stat-icon {
    background: #dbeafe;
    color: #2563eb;
}

.stat-card--success .stat-icon {
    background: #d1fae5;
    color: #059669;
}

.stat-content {
    flex: 1;
}

.stat-value {
    font-size: 2rem;
    font-weight: 700;
    color: #1f2937;
    margin: 0 0 0.25rem 0;
}

.stat-label {
    font-size: 0.875rem;
    color: #6b7280;
    margin: 0;
}

.filters {
    background: white;
    border-radius: 0.75rem;
    padding: 1.5rem;
    margin-bottom: 2rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.filter-tabs {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
    border-bottom: 2px solid #e5e7eb;
}

.tab {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: none;
    border: none;
    color: #6b7280;
    font-weight: 500;
    cursor: pointer;
    position: relative;
    transition: all 0.2s;
}

.tab:hover {
    color: #1f2937;
}

.tab--active {
    color: #10b981;
}

.tab--active::after {
    content: '';
    position: absolute;
    bottom: -2px;
    left: 0;
    right: 0;
    height: 2px;
    background: #10b981;
}

.tab-badge {
    background: #e5e7eb;
    color: #374151;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
}

.tab--active .tab-badge {
    background: #d1fae5;
    color: #059669;
}

.filter-controls {
    display: flex;
    gap: 1rem;
}

.filter-select {
    flex: 1;
    padding: 0.75rem;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    background: white;
    cursor: pointer;
}

.loading-state,
.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    text-align: center;
    color: #6b7280;
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

.empty-state svg {
    color: #10b981;
    margin-bottom: 1rem;
}

.empty-state h3 {
    font-size: 1.25rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0 0 0.5rem 0;
}

.empty-state p {
    margin: 0;
}

.alerts-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 1rem;
    margin-top: 2rem;
}

.pagination-info {
    font-size: 0.875rem;
    color: #6b7280;
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
    margin-bottom: 2rem;
}

.threshold-group h3 {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0 0 1rem 0;
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
}

.input-group input:focus {
    outline: none;
    border-color: #10b981;
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
}

.form-actions {
    display: flex;
    gap: 1rem;
    margin-top: 2rem;
}

.form-actions .btn {
    flex: 1;
}

@media (max-width: 768px) {
    .alerts-view {
        padding: 1rem;
    }

    .alerts-header {
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

    .alert-stats {
        grid-template-columns: 1fr;
    }

    .filter-controls {
        flex-direction: column;
    }

    .threshold-inputs {
        grid-template-columns: 1fr;
    }
}
</style>