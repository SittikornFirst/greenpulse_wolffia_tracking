<template>
    <div class="farm-details-view">
        <div class="details-header">
            <button @click="$router.back()" class="back-btn">
                <ArrowLeft :size="20" />
                <span>Back</span>
            </button>
            <div class="header-content">
                <h1>{{ farm?.farm_name || farmName || 'Farm Details' }}</h1>
                <span :class="['status-badge', `status-badge--${farm?.status || 'active'}`]">
                    {{ farm?.status || 'active' }}
                </span>
            </div>
        </div>

        <div v-if="loading" class="loading-state">
            <div class="spinner"></div>
            <p>Loading farm details...</p>
        </div>

        <div v-else-if="farm" class="details-content">
            <!-- Farm Info Card -->
            <div class="info-card">
                <div class="card-header">
                    <h2>Farm Information</h2>
                    <button @click="handleEditFarm" class="btn btn-secondary">
                        <Settings :size="16" />
                        <span>Edit</span>
                    </button>
                </div>
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">Farm Name:</span>
                        <span class="info-value">{{ farm.farm_name }}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Location:</span>
                        <span class="info-value">{{ farm.location?.address || farm.location?.name || 'N/A' }}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Area:</span>
                        <span class="info-value">{{ farm.area || 0 }} m²</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Tank Count:</span>
                        <span class="info-value">{{ farm.tank_count || 0 }}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Device Count:</span>
                        <span class="info-value">{{ deviceCount }}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Status:</span>
                        <span :class="['status-badge', `status-badge--${farm.status}`]">
                            {{ farm.status }}
                        </span>
                    </div>
                    <div class="info-item info-item--full">
                        <span class="info-label">Description:</span>
                        <span class="info-value">{{ farm.description || 'No description provided' }}</span>
                    </div>
                </div>
            </div>

            <!-- Statistics Cards -->
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-icon stat-icon--success">
                        <CheckCircle :size="24" />
                    </div>
                    <div class="stat-content">
                        <p class="stat-label">Active Devices</p>
                        <p class="stat-value">{{ activeDeviceCount }}</p>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon stat-icon--warning">
                        <AlertTriangle :size="24" />
                    </div>
                    <div class="stat-content">
                        <p class="stat-label">Warning Devices</p>
                        <p class="stat-value">{{ warningDeviceCount }}</p>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon stat-icon--danger">
                        <XCircle :size="24" />
                    </div>
                    <div class="stat-content">
                        <p class="stat-label">Offline Devices</p>
                        <p class="stat-value">{{ offlineDeviceCount }}</p>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon stat-icon--info">
                        <Cpu :size="24" />
                    </div>
                    <div class="stat-content">
                        <p class="stat-label">Total Devices</p>
                        <p class="stat-value">{{ deviceCount }}</p>
                    </div>
                </div>
            </div>

            <!-- Devices Section -->
            <div class="devices-section">
                <div class="section-header">
                    <h2>Devices in this Farm</h2>
                    <button @click="showAddDeviceModal = true" class="btn btn-primary">
                        <Plus :size="20" />
                        <span>Add Device</span>
                    </button>
                </div>

                <div v-if="farmDevices.length === 0" class="empty-state">
                    <Cpu :size="64" />
                    <h3>No devices yet</h3>
                    <p>Get started by adding your first device to this farm</p>
                    <button @click="showAddDeviceModal = true" class="btn btn-primary">
                        <Plus :size="20" />
                        <span>Add First Device</span>
                    </button>
                </div>

                <div v-else class="devices-grid">
                    <div v-for="device in farmDevices" :key="device._id || device.id" class="device-card"
                        @click="goToDeviceDetails(device._id || device.id)">
                        <div class="device-header">
                            <div class="device-icon" :class="`device-icon--${device.device_type || 'default'}`">
                                <Cpu :size="24" />
                            </div>
                            <span :class="['status-dot', `status-dot--${device.status}`]"></span>
                        </div>
                        <div class="device-body">
                            <h3 class="device-name">{{ device.device_name }}</h3>
                            <p class="device-type">{{ device.device_type || 'N/A' }}</p>
                            <div class="device-info">
                                <span class="device-id">{{ device.device_id }}</span>
                            </div>
                        </div>
                        <div class="device-footer">
                            <button @click.stop="goToDeviceDetails(device._id || device.id)"
                                class="btn btn-secondary btn-sm">
                                View Details
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div v-else class="error-state">
            <AlertCircle :size="48" />
            <h3>Farm Not Found</h3>
            <p>The farm you're looking for doesn't exist or has been removed.</p>
            <button @click="$router.push('/farms')" class="btn btn-primary">
                <ArrowLeft :size="16" />
                <span>Back to Farms</span>
            </button>
        </div>
    </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
    ArrowLeft, MapPin, Cpu, CheckCircle, AlertTriangle, XCircle,
    Settings, Plus
} from 'lucide-vue-next';
import apiService from '@/services/api';

export default {
    name: 'FarmDetailsView',
    components: {
        ArrowLeft,
        MapPin,
        Cpu,
        CheckCircle,
        AlertTriangle,
        XCircle,
        Settings,
        Plus
    },
    setup() {
        const route = useRoute();
        const router = useRouter();
        const loading = ref(false);
        const farm = ref(null);
        const farmDevices = ref([]);
        const showAddDeviceModal = ref(false);

        const fetchFarmDetails = async () => {
            loading.value = true;
            try {
                const response = await apiService.getFarm(route.params.id);
                farm.value = response.data;

                const devicesResponse = await apiService.getFarmDevices(route.params.id);
                farmDevices.value = devicesResponse.data || [];
            } catch (error) {
                console.error('Failed to fetch farm details:', error);
            } finally {
                loading.value = false;
            }
        };

        const deviceCount = computed(() => farmDevices.value.length);
        const activeDeviceCount = computed(() =>
            farmDevices.value.filter(d => d.status === 'active').length
        );
        const warningDeviceCount = computed(() =>
            farmDevices.value.filter(d => d.status === 'warning').length
        );
        const offlineDeviceCount = computed(() =>
            farmDevices.value.filter(d => d.status === 'inactive' || d.status === 'error').length
        );

        const goToDeviceDetails = (deviceId) => {
            router.push(`/devices/${deviceId}`);
        };

        const handleEditFarm = () => {
            router.push({ name: 'Farms', query: { edit: farm.value._id } });
        };

        onMounted(() => {
            fetchFarmDetails();
        });

        return {
            loading,
            farm,
            farmDevices,
            deviceCount,
            activeDeviceCount,
            warningDeviceCount,
            offlineDeviceCount,
            showAddDeviceModal,
            goToDeviceDetails,
            handleEditFarm
        };
    }
};
</script>

<style scoped>
.farm-details-view {
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

.empty-state h3,
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

.info-item--full {
    grid-column: 1 / -1;
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

.stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 1.5rem;
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

.devices-section {
    background: white;
    border-radius: 0.75rem;
    padding: 1.5rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid #e5e7eb;
}

.section-header h2 {
    font-size: 1.25rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0;
}

.devices-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1.5rem;
}

.device-card {
    background: #f9fafb;
    border-radius: 0.75rem;
    padding: 1.5rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    cursor: pointer;
    transition: all 0.2s;
    border: 1px solid #e5e7eb;
}

.device-card:hover {
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);
    border-color: #10b981;
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
    background: #dbeafe;
    color: #2563eb;
}

.status-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
}

.status-dot--active {
    background: #10b981;
}

.status-dot--inactive {
    background: #6b7280;
}

.status-dot--maintenance {
    background: #f59e0b;
}

.status-dot--error {
    background: #ef4444;
}

.device-body {
    margin-bottom: 1rem;
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
    margin: 0 0 0.5rem 0;
}

.device-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.device-id {
    font-size: 0.75rem;
    color: #9ca3af;
    font-family: monospace;
}

.device-footer {
    padding-top: 1rem;
    border-top: 1px solid #e5e7eb;
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

.btn-sm {
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
}

@media (max-width: 768px) {
    .farm-details-view {
        padding: 1rem;
    }

    .details-header {
        flex-direction: column;
        align-items: flex-start;
    }

    .devices-grid {
        grid-template-columns: 1fr;
    }

    .stats-grid {
        grid-template-columns: 1fr;
    }
}
</style>