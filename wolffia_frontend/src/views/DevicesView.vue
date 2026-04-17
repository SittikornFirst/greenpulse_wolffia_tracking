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
        <div class="stat-icon stat-icon--danger">
          <XCircle :size="24" />
        </div>
        <div class="stat-content">
          <p class="stat-label">Deactive Devices</p>
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
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search devices or farms..."
        />
      </div>
      <select v-model="filterStatus" class="filter-select">
        <option value="">All Status</option>
        <option value="active">Active</option>
        <option value="maintenance">Maintenance</option>
        <option value="inactive">Inactive</option>
      </select>
      <router-link v-if="isAdmin" to="/farms" class="btn btn-secondary">
        <MapPin :size="16" />
        Manage Farms
      </router-link>
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
      <p>
        {{
          searchQuery
            ? "Try adjusting your search criteria"
            : "Get started by adding your first device"
        }}
      </p>
      <button @click="showAddModal = true" class="btn btn-primary">
        <Plus :size="20" />
        <span>Add First Device</span>
      </button>
    </div>

    <!-- Devices Grid -->
    <div v-else class="devices-grid">
      <div
        v-for="device in filteredDevices"
        :key="device.id"
        class="device-card"
        @click="goToDeviceDetails(device.id)"
      >
        <div class="device-header">
          <div class="device-icon device-icon--generic">
            <component :is="getDeviceIcon(device.device_type)" :size="24" />
          </div>
          <div class="device-status">
            <span
              :class="['status-dot', `status-dot--${device.status}`]"
            ></span>
            <span class="status-text">{{ device.status }}</span>
          </div>
        </div>

        <div class="device-body">
          <h3 class="device-name">{{ device.device_name }}</h3>
          <p class="device-type">{{ device.farmName || "Unassigned" }}</p>

          <div class="device-info">
            <div class="info-item">
              <span class="info-label">Device ID:</span>
              <span class="info-value">{{ device.device_id }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Location:</span>
              <span class="info-value">{{
                device.location || "Not specified"
              }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Last Update:</span>
              <span class="info-value">{{
                formatTime(device.lastActivity || device.updatedAt)
              }}</span>
            </div>
          </div>

          <div v-if="device.configuration" class="config-summary">
            <div class="config-row">
              <span class="config-label">Sampling Interval</span>
              <span class="config-value"
                >{{ device.configuration.sampling_interval }}s</span
              >
            </div>
          </div>
        </div>

        <div class="device-footer">
          <button
            @click.stop="openConfigModal(device)"
            class="btn btn-secondary btn-sm"
          >
            <Settings :size="16" />
            <span>View Config</span>
          </button>
          <button
            @click.stop="handleToggleDeviceStatus(device)"
            :class="[
              'btn',
              'btn-sm',
              device.status === 'inactive' ? 'btn-success' : 'btn-warning',
            ]"
          >
            <component
              :is="device.status === 'inactive' ? CheckCircle : XCircle"
              :size="16"
            />
            <span>{{
              device.status === "inactive" ? "Activate" : "Deactivate"
            }}</span>
          </button>
          <button
            v-if="device.status === 'inactive'"
            @click.stop="handleArchiveDevice(device)"
            class="btn btn-danger btn-sm"
          >
            <Trash2 :size="16" />
            <span>Archive</span>
          </button>
        </div>
      </div>
    </div>
    
    <!-- Pagination -->
    <div v-if="devicesStore.pagination.pages > 1" class="pagination-container">
      <div class="pagination-info">
        Showing <strong>{{ (devicesStore.pagination.page - 1) * devicesStore.pagination.limit + 1 }}</strong>
        to <strong>{{ Math.min(devicesStore.pagination.page * devicesStore.pagination.limit, devicesStore.pagination.total) }}</strong>
        of <strong>{{ devicesStore.pagination.total }}</strong> devices
      </div>
      <div class="pagination-controls">
        <button
          @click="handlePageChange(devicesStore.pagination.page - 1)"
          :disabled="devicesStore.pagination.page === 1 || loading"
          class="btn btn-secondary btn-sm"
        >
          Previous
        </button>
        <span class="page-current">Page {{ devicesStore.pagination.page }} of {{ devicesStore.pagination.pages }}</span>
        <button
          @click="handlePageChange(devicesStore.pagination.page + 1)"
          :disabled="devicesStore.pagination.page === devicesStore.pagination.pages || loading"
          class="btn btn-secondary btn-sm"
        >
          Next
        </button>
      </div>
    </div>

    <!-- Add Device Modal -->
    <div
      v-if="showAddModal"
      class="modal-overlay"
      @click="showAddModal = false"
    >
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h2>Add New Device</h2>
          <button @click="showAddModal = false" class="close-btn">
            <X :size="20" />
          </button>
        </div>
        <div class="modal-body">
          <!-- Step 1: Input Form -->
          <form v-if="!newlyCreatedDevice" @submit.prevent="handleAddDevice">
            <div class="form-group">
              <label for="device-name">Device Name (e.g. Pond Name / ชื่อบ่อน้ำ)</label>
              <input
                id="device-name"
                v-model="newDevice.name"
                type="text"
                required
                placeholder="e.g., Pond Name / ชื่อบ่อน้ำ"
              />
            </div>

            <div class="form-group">
              <label for="device-location">Location (Optional)</label>
              <input
                id="device-location"
                v-model="newDevice.location"
                type="text"
                placeholder="e.g., Tank A, Row 3"
              />
            </div>

            <div class="form-group" v-if="isAdmin">
              <label for="device-farm">Assign to Farm</label>
              <select id="device-farm" v-model="newDevice.farmId" required class="form-control">
                <option value="" disabled>Select a farm...</option>
                <option v-for="farm in farms" :key="farm._id || farm.id" :value="farm._id || farm.id">
                  {{ farm.farm_name || farm.name }}
                </option>
              </select>
            </div>

            <div class="form-actions">
              <button
                type="button"
                @click="closeAddModal"
                class="btn btn-secondary"
              >
                Cancel
              </button>
              <button type="submit" :disabled="adding" class="btn btn-primary">
                {{ adding ? "Adding..." : "Add Device" }}
              </button>
            </div>
          </form>

          <!-- Step 2: Success Credentials -->
          <div v-else class="success-credentials">
            <div class="success-icon">
              <CheckCircle :size="48" color="#10b981" />
            </div>
            <h3>Device Registered Successfully!</h3>
            <p>Please update your ESP32 Arduino code with this Device ID:</p>
            
            <div class="credentials-box">
              <div class="credential-item">
                <span class="cred-label">Device ID (Update your DEVICE_ID variable):</span>
                <code class="cred-value">{{ newlyCreatedDevice.device_id }}</code>
              </div>
            </div>

            <div class="form-actions" style="margin-top: 20px;">
              <button @click="closeAddModal" class="btn btn-primary" style="width: 100%; justify-content: center;">
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Configuration Modal -->
    <div
      v-if="showConfigModal && configDevice"
      class="modal-overlay"
      @click="showConfigModal = false"
    >
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h2>Device Configuration</h2>
          <button @click="showConfigModal = false" class="close-btn">
            <X :size="20" />
          </button>
        </div>
        <div class="modal-body config-modal-body">
          <p class="config-device-title">{{ configDevice.device_name }}</p>
          <div v-if="configDevice.configuration" class="config-grid">
            <div class="config-field">
              <span class="config-label">Sampling Interval</span>
              <span class="config-value"
                >{{
                  configDevice.configuration.sampling_interval
                }}
                seconds</span
              >
            </div>
            <div class="config-field">
              <span class="config-label">Alerts</span>
              <span class="config-value">{{
                configDevice.configuration.alert_enabled_label
              }}</span>
            </div>
            <div class="config-field">
              <span class="config-label">pH Range</span>
              <span class="config-value"
                >{{ configDevice.configuration.ph_min }} -
                {{ configDevice.configuration.ph_max }}</span
              >
            </div>
            <div class="config-field">
              <span class="config-label">EC Range</span>
              <span class="config-value"
                >{{ configDevice.configuration.ec_value_min }} -
                {{ configDevice.configuration.ec_value_max }}</span
              >
            </div>
            <div class="config-field">
              <span class="config-label">Air Temp</span>
              <span class="config-value"
                >{{ configDevice.configuration.air_temp_min }} -
                {{ configDevice.configuration.air_temp_max }} °C</span
              >
            </div>
            <div class="config-field">
              <span class="config-label">Water Temp</span>
              <span class="config-value"
                >{{ configDevice.configuration.water_temp_min }} -
                {{ configDevice.configuration.water_temp_max }} °C</span
              >
            </div>
            <div class="config-field">
              <span class="config-label">Light Intensity</span>
              <span class="config-value"
                >{{ configDevice.configuration.light_intensity_min }} -
                {{ configDevice.configuration.light_intensity_max }} lux</span
              >
            </div>
          </div>
          <p v-else>No configuration record found for this device.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  Plus,
  Search,
  Cpu,
  Droplet,
  Thermometer,
  Sun,
  Activity,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Settings,
  Trash2,
  X,
  MapPin,
} from "lucide-vue-next";
import { useDevicesStore } from "@/stores/module/devices";
import { useFarmsStore } from "@/stores/module/farms";
import apiService from "@/services/api";

export default {
  name: "DevicesView",
  components: {
    Plus,
    Search,
    Cpu,
    Droplet,
    Thermometer,
    Sun,
    Activity,
    CheckCircle,
    AlertTriangle,
    XCircle,
    Settings,
    Trash2,
    X,
    MapPin,
  },
  setup() {
    const route = useRoute();
    const router = useRouter();
    const devicesStore = useDevicesStore();
    const farmsStore = useFarmsStore();

    const loading = ref(false);
    const searchQuery = ref("");
    const filterStatus = ref("");
    const showAddModal = ref(false);
    const adding = ref(false);
    const showConfigModal = ref(false);
    const configDevice = ref(null);

    const newDevice = ref({
      name: "",
      farmId: "",
      location: "",
    });

    const user = ref(null);
    const isAdmin = computed(() => user.value?.role === "admin");

    const farms = computed(() => farmsStore.farms);

    const activeDevicesCount = computed(
      () => devicesStore.devices.filter((d) => d.status === "active").length,
    );

    const offlineDevicesCount = computed(
      () => devicesStore.devices.filter((d) => d.status === "inactive").length,
    );

    const totalDevicesCount = computed(() => devicesStore.totalDevices);

    const filteredDevices = computed(() => devicesStore.devices);

    const getDeviceIcon = () => Cpu;

    const getDeviceTypeLabel = () => "Wolffia Monitor";

    const formatTime = (timestamp) => {
      if (!timestamp) return "Never";
      const now = new Date();
      const then = new Date(timestamp);
      const diffMins = Math.floor((now - then) / 60000);

      const timestampStr = then.toLocaleString('en-US', { 
        month: 'short', day: 'numeric', 
        hour: '2-digit', minute: '2-digit', hour12: false 
      });

      if (diffMins < 1) return `Just now (${timestampStr})`;
      
      let relativeStr = '';
      if (diffMins < 60) {
        relativeStr = `${diffMins}m ago`;
      } else if (diffMins < 1440) {
        const hours = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        relativeStr = mins > 0 ? `${hours}h ${mins}m ago` : `${hours}h ago`;
      } else {
        const days = Math.floor(diffMins / 1440);
        relativeStr = `${days}d ago`;
      }
      
      return `${relativeStr} (${timestampStr})`;
    };

    const goToDeviceDetails = (deviceId) => {
      router.push({
        path: `/devices/${deviceId}`,
        query: { from: route.fullPath },
      });
    };

    const newlyCreatedDevice = ref(null);

    const closeAddModal = () => {
      showAddModal.value = false;
      newlyCreatedDevice.value = null;
      newDevice.value = {
        name: "",
        farmId: route.query.farmId || "",
        location: "",
      };
      if (route.query.openAdd === "true") {
        const { openAdd, ...remainingQuery } = route.query;
        router.replace({ path: route.path, query: remainingQuery });
      }
    };

    const handleAddDevice = async () => {
      adding.value = true;
      try {
        const response = await apiService.createDevice({
          name: newDevice.value.name,
          location: newDevice.value.location,
          farm_id: newDevice.value.farmId,
        });
        
        // Refresh store
        await devicesStore.fetchDevices({
          page: devicesStore.pagination.page,
          limit: devicesStore.pagination.limit,
        });
        
        // Show success screen with credentials
        newlyCreatedDevice.value = response.data;
      } catch (error) {
        alert(
          "Failed to add device: " +
            (error.response?.data?.message || error.message),
        );
      } finally {
        adding.value = false;
      }
    };

    const handleEditDevice = (device) => {
      router.push(`/devices/${device.id}`);
    };

    const handleArchiveDevice = async (device) => {
      if (device.status !== "inactive") {
        alert("Deactivate the device first, then archive it.");
        return;
      }

      if (!confirm(`Archive ${device.device_name}? This will hide it from the UI but keep it in the database.`)) {
        return;
      }

      try {
        await devicesStore.removeDevice(device.device_id);
        await loadData(Math.min(devicesStore.pagination.page, devicesStore.pagination.pages));
      } catch (error) {
        console.error("Archive device error:", error);
        alert(
          "Failed to archive device: " +
            (error.response?.data?.message || error.message),
        );
      }
    };

    const handleToggleDeviceStatus = async (device) => {
      const newStatus = device.status === "inactive" ? "active" : "inactive";
      const action = newStatus === "inactive" ? "deactivate" : "activate";

      if (!confirm(`Are you sure you want to ${action} this device?`)) return;

      try {
        await devicesStore.updateDevice(device.device_id, {
          status: newStatus,
        });
        // Refresh the device list to ensure UI is in sync
        await devicesStore.fetchDevices({
          page: devicesStore.pagination.page,
          limit: devicesStore.pagination.limit,
          ...(searchQuery.value ? { search: searchQuery.value } : {}),
          ...(filterStatus.value ? { status: filterStatus.value } : {}),
        });
        alert(`Device ${action}d successfully!`);
      } catch (error) {
        console.error("Toggle device status error:", error);
        alert(
          `Failed to ${action} device: ` +
            (error.response?.data?.message || error.message),
        );
      }
    };

    const openConfigModal = (device) => {
      configDevice.value = device;
      showConfigModal.value = true;
    };

    const loadData = async (page = 1) => {
      loading.value = true;
      try {
        const params = {
          page,
          limit: 12
        };
        if (searchQuery.value) params.search = searchQuery.value;
        if (filterStatus.value) params.status = filterStatus.value;

        await Promise.all([
          devicesStore.fetchDevices(params),
          farmsStore.fetchFarms({ page: 1, limit: 100 }),
          apiService.getCurrentUser().then((response) => {
            user.value = response.data.user;
          }),
        ]);
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        loading.value = false;
      }
    };

    const handlePageChange = (page) => {
      loadData(page);
    };

    let searchTimeout = null;
    watch([searchQuery, filterStatus], () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        loadData(1);
      }, 500);
    });

    watch(
      () => route.query,
      (query) => {
        if (query.farmId) {
          newDevice.value.farmId = query.farmId;
        }
        if (query.openAdd === "true") {
          showAddModal.value = true;
        }
      },
      { immediate: true },
    );

    onMounted(loadData);

    return {
      loading,
      searchQuery,
      filterStatus,
      showAddModal,
      adding,
      farms,
      newDevice,
      isAdmin,
      activeDevicesCount,
      offlineDevicesCount,
      totalDevicesCount,
      filteredDevices,
      getDeviceIcon,
      getDeviceTypeLabel,
      formatTime,
      goToDeviceDetails,
      handleAddDevice,
      closeAddModal,
      newlyCreatedDevice,
      handleEditDevice,
      handleArchiveDevice,
      handleToggleDeviceStatus,
      showConfigModal,
      configDevice,
      openConfigModal,
      loadData,
      handlePageChange,
      devicesStore
    };
  },
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

.btn-success {
  background: #d1fae5;
  color: #059669;
}

.btn-success:hover {
  background: #a7f3d0;
}

.btn-warning {
  background: #fef3c7;
  color: #d97706;
}

.btn-warning:hover {
  background: #fde68a;
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

.device-icon--generic {
  background: #c7d2fe;
  color: #312e81;
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

.config-summary {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  padding: 0.75rem;
  margin-top: 1rem;
}

.config-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
}

.config-label {
  color: #6b7280;
}

.config-value {
  font-weight: 600;
  color: #111827;
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

.config-modal-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.config-device-title {
  font-weight: 600;
  color: #111827;
}

.config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.config-field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.75rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
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
.form-group input {
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
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
}

.form-group select {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  background-color: white;
  color: #1f2937;
  font-size: 1rem;
  font-family: inherit;
}

.form-actions {
  display: flex;
  gap: 1rem;
  margin-top: 2rem;
}

.form-actions .btn {
  white-space: nowrap;
}

/* Success Credentials View */
.success-credentials {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 1rem 0;
}

.success-icon {
  margin-bottom: 1rem;
}

.success-credentials h3 {
  font-size: 1.25rem;
  color: #1f2937;
  margin: 0 0 0.5rem 0;
}

.success-credentials p {
  color: #6b7280;
  margin-bottom: 1.5rem;
}

.credentials-box {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  padding: 1.5rem;
  width: 100%;
  text-align: left;
}

.credential-item {
  margin-bottom: 1.25rem;
}

.credential-item:last-child {
  margin-bottom: 0;
}

.cred-label {
  display: block;
  font-size: 0.875rem;
  color: #475569;
  font-weight: 500;
  margin-bottom: 0.5rem;
}

.cred-value {
  display: block;
  background: #f1f5f9;
  padding: 0.75rem;
  border-radius: 0.375rem;
  font-family: monospace;
  font-size: 0.875rem;
  color: #0f172a;
  word-break: break-all;
  border: 1px dashed #cbd5e1;
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

.pagination-container {
  margin-top: 2rem;
  padding: 1.25rem;
  background: white;
  border-radius: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.pagination-info {
  font-size: 0.875rem;
  color: #6b7280;
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.page-current {
  font-weight: 600;
  color: #374151;
  font-size: 0.875rem;
}
</style>
