<template>
    <div class="devices-view">
        <div class="devices-header">
            <div>
                <h1>Device Management</h1>
                <p class="subtitle">Manage and monitor all your IoT devices</p>
            </div>
            <button @click="showAddModal = true" class="btn btn-primary">
                <Plus :size="20" />
                <span>Add Device</span>
            </button>
        </div>

        <!-- Stats Cards -->
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-icon stat-icon--success">
                    <CheckCircle :size="24" />
                </div>
                <div class="stat-content">
                    <p class="stat-label">Active Devices</p>
                    <p class="stat-value">{{ activeDevicesCount }}</p>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon stat-icon--warning">
                    <AlertTriangle :size="24" />
                </div>
                <div class="stat-content">
                    <p class="stat-label">Warning Status</p>
                    <p class="stat-value">{{ warningDevicesCount }}</p>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon stat-icon--danger">
                    <XCircle :size="24" />
                </div>
                <div class="stat-content">
                    <p class="stat-label">Offline Devices</p>
                    <p class="stat-value">{{ offlineDevicesCount }}</p>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon stat-icon--info">
                    <Cpu :size="24" />
                </div>
                <div class="stat-content">
                    <p class="stat-label">Total Devices</p>
                    <p class="stat-value">{{ totalDevicesCount }}</p>
                </div>
            </div>
        </div>

        <!-- Filters -->
        <div class="filters">
            <div class="search-box">
                <Search :size="20" />
                <input v-model="searchQuery" type="text" placeholder="Search devices..." />
            </div>
            <select v-model="filterType" class="filter-select">
                <option value="">All Types</option>
                <option value="pH">pH Sensors</option>
                <option value="temperature">Temperature</option>
                <option value="light">Light Intensity</option>
                <option value="oxygen">Dissolved Oxygen</option>
            </select>
            <select v-model="filterStatus" class="filter-select">
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="warning">Warning</option>
                <option value="inactive">Inactive</option>
            </select>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="loading-state">
            <div class="spinner"></div>
            <p>Loading devices...</p>
        </div>

        <!-- Empty State -->
        <div v-else-if="filteredDevices.length === 0" class="empty-state">
            <Cpu :size="64" />
            <h3>No devices found</h3>
            <p>{{ searchQuery ? 'Try adjusting your search criteria' : 'Get started by adding your first device' }}</p>
            <button @click="showAddModal = true" class="btn btn-primary">
                <Plus :size="20" />
                <span>Add First Device</span>
            </button>
        </div>

        <!-- Devices Grid -->
        <div v-else class="devices-grid">
            <div v-for="device in filteredDevices" :key="device.id" class="device-card"
                @click="goToDeviceDetails(device.id)">
                <div class="device-header">
                    <div class="device-icon" :class="`device-icon--${device.type}`">
                        <component :is="getDeviceIcon(device.type)" :size="24" />
                    </div>
                    <div class="device-status">
                        <span :class="['status-dot', `status-dot--${device.status}`]"></span>
                        <span class="status-text">{{ device.status }}</span>
                    </div>
                </div>

                <div class="device-body">
                    <h3 class="device-name">{{ device.device_name }}</h3>
                    <p class="device-type">{{ getDeviceTypeLabel(device.type) }}</p>

                    <div class="device-info">
                        <div class="info-item">
                            <span class="info-label">Device ID:</span>
                            <span class="info-value">{{ device.device_id }}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Last Reading:</span>
                            <span class="info-value">{{ device.lastReading || 'N/A' }}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Last Update:</span>
                            <span class="info-value">{{ formatTime(device.updatedAt) }}</span>
                        </div>
                    </div>
                </div>

                <div class="device-footer">
                    <button @click.stop="handleEditDevice(device)" class="btn btn-secondary btn-sm">
                        <Settings :size="16" />
                        <span>Configure</span>
                    </button>
                    <button @click.stop="handleDeleteDevice(device.device_id)" class="btn btn-danger btn-sm">
                        <Trash2 :size="16" />
                        <span>Remove</span>
                    </button>
                </div>
            </div>
        </div>

        <!-- Add Device Modal -->
        <div v-if="showAddModal" class="modal-overlay" @click="showAddModal = false">
            <div class="modal" @click.stop>
                <div class="modal-header">
                    <h2>Add New Device</h2>
                    <button @click="showAddModal = false" class="close-btn">
                        <X :size="20" />
                    </button>
                </div>
                <div class="modal-body">
                    <form @submit.prevent="handleAddDevice">
                        <div class="form-group">
                            <label for="device-name">Device Name</label>
                            <input id="device-name" v-model="newDevice.name" type="text" required
                                placeholder="e.g., Tank A pH Sensor" />
                        </div>

                        <div class="form-group">
                            <label for="device-farm">Farm Assignment *</label>
                            <select id="device-farm" v-model="newDevice.farmId" required>
                                <option value="">Select farm</option>
                                <option v-for="farm in farms" :key="farm._id || farm.id" :value="farm._id || farm.id">
                                    {{ farm.name || farm.farm_name }}
                                </option>
                            </select>
                            <p v-if="farms.length === 0" class="form-hint">
                                No farms available. <router-link to="/farms">Create a farm first</router-link>
                            </p>
                        </div>

                        <div class="form-group">
                            <label for="device-location">Location (Optional)</label>
                            <input id="device-location" v-model="newDevice.location" type="text"
                                placeholder="e.g., Tank A, Row 3" />
                        </div>

                        <div class="form-actions">
                            <button type="button" @click="showAddModal = false" class="btn btn-secondary">
                                Cancel
                            </button>
                            <button type="submit" :disabled="adding" class="btn btn-primary">
                                {{ adding ? 'Adding...' : 'Add Device' }}
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
import { useRouter } from 'vue-router';
import {
    Plus, Search, Cpu, Droplet, Thermometer, Sun, Activity,
    CheckCircle, AlertTriangle, XCircle, Settings, Trash2, X
} from 'lucide-vue-next';
import { useDevicesStore } from '@/stores/module/devices';
import apiService from '@/services/api';

export default {
    name: 'DevicesView',
    components: {
        Plus, Search, Cpu, Droplet, Thermometer, Sun, Activity,
        CheckCircle, AlertTriangle, XCircle, Settings, Trash2, X
    },
    setup() {
        const router = useRouter();
        const devicesStore = useDevicesStore();

        const loading = ref(false);
        const searchQuery = ref('');
        const filterType = ref('');
        const filterStatus = ref('');
        const showAddModal = ref(false);
        const adding = ref(false);
        const farms = ref([]); // Add farms list
        const loadingFarms = ref(false);

        const newDevice = ref({
            name: '',
            type: '',
            farmId: '', // This will be farm_id
            location: ''
        });

        // Fetch farms from API
        const fetchFarms = async () => {
            loadingFarms.value = true;
            try {
                const response = await apiService.getFarms();
                farms.value = response.data || [];
            } catch (error) {
                console.error('Failed to fetch farms:', error);
                farms.value = [];
            } finally {
                loadingFarms.value = false;
            }
        };

        const activeDevicesCount = computed(() =>
            devicesStore.devices.filter(d => d.status === 'active').length
        );

        const warningDevicesCount = computed(() =>
            devicesStore.devices.filter(d => d.status === 'warning').length
        );

        const offlineDevicesCount = computed(() =>
            devicesStore.devices.filter(d => d.status === 'inactive').length
        );

        const totalDevicesCount = computed(() => devicesStore.totalDevices);

        const filteredDevices = computed(() => {
            let devices = devicesStore.devices;

            if (searchQuery.value) {
                const query = searchQuery.value.toLowerCase();
                devices = devices.filter(d =>
                    d.name.toLowerCase().includes(query) ||
                    d.id.toLowerCase().includes(query)
                );
            }

            if (filterType.value) {
                devices = devices.filter(d => d.type === filterType.value);
            }

            if (filterStatus.value) {
                devices = devices.filter(d => d.status === filterStatus.value);
            }

            return devices;
        });

        const getDeviceIcon = (type) => {
            const icons = {
                pH: Droplet,
                temperature: Thermometer,
                light: Sun,
                oxygen: Activity
            };
            return icons[type] || Cpu;
        };

        const getDeviceTypeLabel = (type) => {
            const labels = {
                pH: 'pH Sensor',
                temperature: 'Temperature Sensor',
                light: 'Light Intensity Sensor',
                oxygen: 'Dissolved Oxygen Sensor'
            };
            return labels[type] || type;
        };

        const formatTime = (timestamp) => {
            if (!timestamp) return 'Never';
            const now = new Date();
            const then = new Date(timestamp);
            const diffMins = Math.floor((now - then) / 60000);

            if (diffMins < 1) return 'Just now';
            if (diffMins < 60) return `${diffMins}m ago`;
            if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
            return then.toLocaleDateString();
        };

        const goToDeviceDetails = (deviceId) => {
            router.push(`/devices/${deviceId}`);
        };

        const handleAddDevice = async () => {
            // Validate farm is selected
            if (!newDevice.value.farmId) {
                alert('Please select a farm first. If no farms exist, please create one in the Farms page.');
                return;
            }

            adding.value = true;
            try {
                // Map to backend format
                const deviceData = {
                    name: newDevice.value.name,
                    type: newDevice.value.type,
                    farm_id: newDevice.value.farmId, // Use farm_id for backend
                    location: newDevice.value.location
                };

                await devicesStore.addDevice(deviceData);
                showAddModal.value = false;
                newDevice.value = { name: '', type: '', farmId: '', location: '' };
            } catch (error) {
                alert('Failed to add device: ' + (error.response?.data?.message || error.message));
            } finally {
                adding.value = false;
            }
        };

        const handleEditDevice = (device) => {
            router.push(`/devices/${device.id}`);
        };

        const handleDeleteDevice = async (deviceId) => {
            if (!confirm('Are you sure you want to remove this device?')) return;

            try {
                await devicesStore.removeDevice(deviceId);
            } catch (error) {
                alert('Failed to remove device: ' + error.message);
            }
        };

        onMounted(async () => {
            loading.value = true;
            try {
                await Promise.all([
                    devicesStore.fetchDevices(),
                    fetchFarms() // Fetch farms on mount
                ]);
            } catch (error) {
                console.error('Failed to fetch data:', error);
            } finally {
                loading.value = false;
            }
        });

        return {
            loading,
            searchQuery,
            filterType,
            filterStatus,
            showAddModal,
            adding,
            farms, // Export farms
            loadingFarms,
            newDevice,
            activeDevicesCount,
            warningDevicesCount,
            offlineDevicesCount,
            totalDevicesCount,
            filteredDevices,
            getDeviceIcon,
            getDeviceTypeLabel,
            formatTime,
            goToDeviceDetails,
            handleAddDevice,
            handleEditDevice,
            handleDeleteDevice
        };
    }
};
</script>

<style scoped>
.devices-view {
    padding: 2rem;
    max-width: 1400px;
    margin: 0 auto;
}

.devices-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 2rem;
}

.devices-header h1 {
    font-size: 2rem;
    font-weight: 700;
    color: #1f2937;
    margin: 0 0 0.5rem 0;
}

.subtitle {
    color: #6b7280;
    margin: 0;
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

.btn-primary:hover:not(:disabled) {
    background: #059669;
}

.btn-secondary {
    background: #f3f4f6;
    color: #374151;
}

.btn-secondary:hover {
    background: #e5e7eb;
}

.btn-danger {
    background: #fee2e2;
    color: #dc2626;
}

.btn-danger:hover {
    background: #fecaca;
}

.btn-sm {
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
}

.stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
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
}

.stat-icon {
    width: 48px;
    height: 48px;
    border-radius: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
}

.stat-icon--success {
    background: #d1fae5;
    color: #059669;
}

.stat-icon--warning {
    background: #fef3c7;
    color: #d97706;
}

.stat-icon--danger {
    background: #fee2e2;
    color: #dc2626;
}

.stat-icon--info {
    background: #dbeafe;
    color: #2563eb;
}

.stat-content {
    flex: 1;
}

.stat-label {
    font-size: 0.875rem;
    color: #6b7280;
    margin: 0 0 0.25rem 0;
}

.stat-value {
    font-size: 1.875rem;
    font-weight: 700;
    color: #1f2937;
    margin: 0;
}

.filters {
    display: flex;
    gap: 1rem;
    margin-bottom: 2rem;
}

.search-box {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    padding: 0.75rem 1rem;
}

.search-box input {
    flex: 1;
    border: none;
    outline: none;
    font-size: 1rem;
}

.filter-select {
    padding: 0.75rem 1rem;
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
    color: #d1d5db;
    margin-bottom: 1rem;
}

.empty-state h3 {
    font-size: 1.25rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0 0 0.5rem 0;
}

.empty-state p {
    margin: 0 0 1.5rem 0;
}

.devices-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 1.5rem;
}

.device-card {
    background: white;
    border-radius: 0.75rem;
    padding: 1.5rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    cursor: pointer;
    transition: all 0.2s;
}

.device-card:hover {
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);
}

.device-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
}

.device-icon {
    width: 48px;
    height: 48px;
    border-radius: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
}

.device-icon--pH {
    background: #dbeafe;
    color: #2563eb;
}

.device-icon--temperature {
    background: #fee2e2;
    color: #dc2626;
}

.device-icon--light {
    background: #fef3c7;
    color: #d97706;
}

.device-icon--oxygen {
    background: #d1fae5;
    color: #059669;
}

.device-status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    text-transform: capitalize;
}

.status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
}

.status-dot--active {
    background: #10b981;
}

.status-dot--warning {
    background: #f59e0b;
}

.status-dot--inactive {
    background: #6b7280;
}

.device-body {
    margin-bottom: 1.5rem;
}

.device-name {
    font-size: 1.125rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0 0 0.25rem 0;
}

.device-type {
    color: #6b7280;
    font-size: 0.875rem;
    margin: 0 0 1rem 0;
}

.device-info {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.info-item {
    display: flex;
    justify-content: space-between;
    font-size: 0.875rem;
}

.info-label {
    color: #6b7280;
}

.info-value {
    color: #1f2937;
    font-weight: 500;
}

.device-footer {
    display: flex;
    gap: 0.75rem;
    padding-top: 1rem;
    border-top: 1px solid #e5e7eb;
}

.device-footer .btn {
    flex: 1;
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
    max-width: 500px;
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

.form-group {
    margin-bottom: 1.5rem;
}

.form-group label {
    display: block;
    font-weight: 500;
    color: #374151;
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
}

.form-group input,
.form-group select {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    font-size: 1rem;
}

.form-group input:focus,
.form-group select:focus {
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
    .devices-view {
        padding: 1rem;
    }

    .devices-header {
        flex-direction: column;
        gap: 1rem;
    }

    .devices-header .btn {
        width: 100%;
        justify-content: center;
    }

    .filters {
        flex-direction: column;
    }

    .devices-grid {
        grid-template-columns: 1fr;
    }
}
</style>