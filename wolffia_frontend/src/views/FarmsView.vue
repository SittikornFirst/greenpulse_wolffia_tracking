<template>
    <div class="farms-view">
        <div class="farms-header">
            <div>
                <h1>Farm Management</h1>
                <p class="subtitle">Manage your Wolffia farming locations</p>
            </div>
            <button @click="showAddModal = true" class="btn btn-primary">
                <Plus :size="20" />
                <span>Add Farm</span>
            </button>
        </div>

        <!-- Farm Stats -->
        <div class="stats-grid">
            <div class="stat-card">
                <MapPin :size="32" class="stat-icon" />
                <div class="stat-content">
                    <p class="stat-value">{{ totalFarms }}</p>
                    <p class="stat-label">Total Farms</p>
                </div>
            </div>
            <div class="stat-card">
                <Cpu :size="32" class="stat-icon" />
                <div class="stat-content">
                    <p class="stat-value">{{ totalDevices }}</p>
                    <p class="stat-label">Connected Devices</p>
                </div>
            </div>
            <div class="stat-card">
                <Activity :size="32" class="stat-icon" />
                <div class="stat-content">
                    <p class="stat-value">{{ farmsWithDevices }}</p>
                    <p class="stat-label">Farms with Device</p>
                </div>
            </div>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="loading-state">
            <div class="spinner"></div>
            <p>Loading farms...</p>
        </div>

        <!-- Empty State -->
        <div v-else-if="farms.length === 0" class="empty-state">
            <MapPin :size="64" />
            <h3>No farms yet</h3>
            <p>Get started by adding your first farm location</p>
            <button @click="showAddModal = true" class="btn btn-primary">
                <Plus :size="20" />
                <span>Add First Farm</span>
            </button>
        </div>

        <!-- Farms Grid -->
        <div v-else class="farms-grid">
            <div v-for="farm in farms" :key="farm._id || farm.id" class="farm-card"
                @click="goToFarmDetails(farm._id || farm.id)">
                <div class="farm-header">
                    <div class="farm-icon">
                        <MapPin :size="24" />
                    </div>
                </div>

                <div class="farm-body">
                    <h3 class="farm-name">{{ farm.farm_name || farm.name }}</h3>
                    <p class="farm-location">
                        <MapPin :size="16" />
                        <span>{{ farm.location }}</span>
                    </p>

                    <div class="farm-stats">
                        <div class="farm-stat">
                            <Cpu :size="18" />
                            <span>{{ farm.deviceCount }} devices</span>
                        </div>
                    </div>
                </div>

                <div class="farm-footer">
                    <button @click.stop="handleEditFarm(farm)" class="btn btn-secondary btn-sm">
                        <Settings :size="16" />
                        <span>Manage</span>
                    </button>
                    <button @click.stop="goToFarmDetails(farm._id || farm.id)" class="btn btn-primary btn-sm">
                        <ArrowRight :size="16" />
                        <span>View Details</span>
                    </button>
                </div>
            </div>
        </div>

        <!-- Add/Edit Farm Modal -->
        <div v-if="showAddModal" class="modal-overlay" @click="showAddModal = false">
            <div class="modal" @click.stop>
                <div class="modal-header">
                    <h2>{{ editingFarm ? 'Edit Farm' : 'Add New Farm' }}</h2>
                    <button @click="closeModal" class="close-btn">
                        <X :size="20" />
                    </button>
                </div>
                <div class="modal-body">
                    <form @submit.prevent="handleSaveFarm">
                        <div class="form-group">
                            <label for="farm-name">Farm Name</label>
                            <input id="farm-name" v-model="farmForm.name" type="text" required
                                placeholder="e.g., Main Farm Site" />
                        </div>

                        <div class="form-group">
                            <label for="farm-location">Location</label>
                            <input id="farm-location" v-model="farmForm.location" type="text" required
                                placeholder="e.g., Bangkok, Thailand" />
                        </div>

                        <div class="form-actions">
                            <button type="button" @click="closeModal" class="btn btn-secondary">
                                Cancel
                            </button>
                            <button type="submit" :disabled="saving" class="btn btn-primary">
                                {{ saving ? 'Saving...' : editingFarm ? 'Update Farm' : 'Add Farm' }}
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
    Plus, MapPin, Cpu, Activity, Settings,
    ArrowRight, X
} from 'lucide-vue-next';
import apiService from '@/services/api';
import { useFarmsStore } from '@/stores/module/farms';

export default {
    name: 'FarmsView',
    components: {
        Plus, MapPin, Cpu, Activity, Settings,
        ArrowRight, X
    },
    setup() {
        const router = useRouter();
        const farmsStore = useFarmsStore();

        const loading = ref(false);
        const saving = ref(false);
        const showAddModal = ref(false);
        const editingFarm = ref(null);
        const farms = computed(() => farmsStore.farms);

        const farmForm = ref({
            name: '',
            location: ''
        });

        const fetchFarms = async () => {
            loading.value = true;
            try {
                await farmsStore.fetchFarms();
            } catch (error) {
                console.error('Failed to fetch farms:', error);
            } finally {
                loading.value = false;
            }
        };

        // Calculate stats from farms
        const totalFarms = computed(() => farms.value.length);
        const totalDevices = computed(() =>
            farms.value.reduce((sum, farm) => sum + (farm.deviceCount || 0), 0)
        );
        const farmsWithDevices = computed(() =>
            farms.value.filter(farm => (farm.deviceCount || 0) > 0).length
        );

        const goToFarmDetails = (farmId) => {
            router.push(`/farms/${farmId}`);
        };

        const handleEditFarm = (farm) => {
            editingFarm.value = farm;
            farmForm.value = {
                name: farm.farm_name || farm.name || '',
                location: farm.location || ''
            };
            showAddModal.value = true;
        };

        const handleSaveFarm = async () => {
            saving.value = true;
            try {
                if (editingFarm.value) {
                    const farmId = editingFarm.value._id || editingFarm.value.id;
                    await apiService.updateFarm(farmId, {
                        farm_name: farmForm.value.name,
                        location: farmForm.value.location
                    });
                } else {
                    await apiService.createFarm({
                        name: farmForm.value.name,
                        location: farmForm.value.location
                    });
                }

                await fetchFarms();
                closeModal();
            } catch (error) {
                console.error('Farm save error:', error);
                alert('Failed to save farm: ' + (error.response?.data?.message || error.message));
            } finally {
                saving.value = false;
            }
        };

        const closeModal = () => {
            showAddModal.value = false;
            editingFarm.value = null;
            farmForm.value = {
                name: '',
                location: ''
            };
        };

        onMounted(async () => {
            await fetchFarms();
        });

        return {
            loading,
            saving,
            showAddModal,
            editingFarm,
            farms,
            farmForm,
            totalFarms,
            totalDevices,
            farmsWithDevices,
            goToFarmDetails,
            handleEditFarm,
            handleSaveFarm,
            closeModal
        };
    }
};
</script>

<style scoped>
.farms-view {
    padding: 2rem;
    max-width: 1400px;
    margin: 0 auto;
}

.farms-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 2rem;
}

.farms-header h1 {
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

.btn-sm {
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
}

.btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.stats-grid {
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
}

.stat-icon {
    color: #10b981;
}

.stat-content {
    flex: 1;
}

.stat-value {
    font-size: 1.875rem;
    font-weight: 700;
    color: #1f2937;
    margin: 0 0 0.25rem 0;
}

.stat-label {
    font-size: 0.875rem;
    color: #6b7280;
    margin: 0;
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

.farms-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 1.5rem;
}

.farm-card {
    background: white;
    border-radius: 0.75rem;
    padding: 1.5rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    cursor: pointer;
    transition: all 0.2s;
}

.farm-card:hover {
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);
}

.farm-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
}

.farm-icon {
    width: 48px;
    height: 48px;
    background: #d1fae5;
    color: #059669;
    border-radius: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
}

.farm-status {
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: capitalize;
}

.farm-status--active {
    background: #d1fae5;
    color: #059669;
}

.farm-status--maintenance {
    background: #fef3c7;
    color: #d97706;
}

.farm-status--inactive {
    background: #f3f4f6;
    color: #6b7280;
}

.farm-body {
    margin-bottom: 1.5rem;
}

.farm-name {
    font-size: 1.25rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0 0 0.5rem 0;
}

.farm-location {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #6b7280;
    font-size: 0.875rem;
    margin: 0 0 1rem 0;
}

.farm-stats {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
}

.farm-stat {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: #6b7280;
}

.health-indicators {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.health-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.health-label {
    font-size: 0.75rem;
    color: #6b7280;
    min-width: 80px;
}

.health-bar {
    flex: 1;
    height: 8px;
    background: #e5e7eb;
    border-radius: 9999px;
    overflow: hidden;
}

.health-fill {
    height: 100%;
    border-radius: 9999px;
    transition: width 0.3s ease;
}

.health-value {
    font-size: 0.75rem;
    font-weight: 600;
    color: #1f2937;
    min-width: 35px;
    text-align: right;
}

.farm-footer {
    display: flex;
    gap: 0.75rem;
    padding-top: 1rem;
    border-top: 1px solid #e5e7eb;
}

.farm-footer .btn {
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
.form-group textarea,
.form-group select {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    font-size: 1rem;
}

.form-group input:focus,
.form-group textarea:focus,
.form-group select:focus {
    outline: none;
    border-color: #10b981;
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
}

.form-group textarea {
    resize: vertical;
    font-family: inherit;
}

.form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
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
    .farms-view {
        padding: 1rem;
    }

    .farms-header {
        flex-direction: column;
        gap: 1rem;
    }

    .farms-header .btn {
        width: 100%;
        justify-content: center;
    }

    .farms-grid {
        grid-template-columns: 1fr;
    }

    .form-row {
        grid-template-columns: 1fr;
    }
}
</style>