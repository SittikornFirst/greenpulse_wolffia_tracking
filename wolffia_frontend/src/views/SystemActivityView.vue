<template>
  <div class="activity-view">
    <div class="activity-header">
      <div>
        <h1>System Audit Log</h1>
        <p class="subtitle">Track user actions, device modifications, and system events</p>
      </div>
      <button @click="refreshData(true)" class="btn btn-primary" :disabled="loading">
        <RefreshCw :size="18" :class="{ spin: loading }" />
        <span>Refresh</span>
      </button>
    </div>

    <!-- Filters Bar -->
    <div class="filters-bar">
      <div class="filter-group hide-mobile">
        <label>Search Details</label>
        <div class="search-wrap">
          <Search :size="16" class="search-icon" />
          <input type="text" v-model="filters.search" placeholder="Search event or message..." @keyup.enter="refreshData(true)" />
        </div>
      </div>

      <div class="filter-group">
        <label>Action Category</label>
        <select v-model="filters.action_type" @change="refreshData(true)">
          <option value="">All Actions</option>
          <option value="CREATE">Created</option>
          <option value="UPDATE">Updated</option>
          <option value="DELETE">Deleted</option>
          <option value="LOGIN">Logins</option>
          <option value="REGISTER">Registrations</option>
        </select>
      </div>

      <div class="filter-group">
        <label>Target Type</label>
        <select v-model="filters.target_type" @change="refreshData(true)">
          <option value="">All Targets</option>
          <option value="User">Users</option>
          <option value="Device">Devices</option>
          <option value="Farm">Farms</option>
          <option value="Alert">Alerts</option>
          <option value="DeviceConfiguration">Configurations</option>
        </select>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading && logs.length === 0" class="empty-box">
      <div class="spinner"></div>
      <p>Loading audit logs...</p>
    </div>

    <!-- Empty -->
    <div v-else-if="!loading && logs.length === 0" class="empty-box">
      <ClipboardList :size="40" class="empty-icon" />
      <p>No system activity logs found matching your criteria.</p>
    </div>

    <!-- Audit Table -->
    <div v-else class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Type</th>
            <th>Event Action</th>
            <th>Target</th>
            <th>Performer</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in logs" :key="log._id">
            <td class="timestamp-cell mono">
              <Clock :size="13" class="ts-icon" />
              {{ formatTimestamp(log.created_at) }}
            </td>
            <td>
               <span :class="['badge', getActionClass(log.action_type)]">
                 {{ log.action_type || 'SYSTEM' }}
               </span>
            </td>
            <td class="font-bold text-gray">{{ log.event }}</td>
            <td class="target-cell">
               <div v-if="log.target_type" class="target-badge">
                 <span class="t-type">{{ log.target_type }}</span>
               </div>
               <span v-else class="text-xs text-muted">System</span>
            </td>
            <td class="user-cell">
               <template v-if="log.user_id">
                 <div class="user-name">{{ log.user_id.user_name }}</div>
                 <div class="user-email">{{ log.user_id.email }}</div>
               </template>
               <span v-else class="text-muted text-sm">Automated</span>
            </td>
            <td class="details-cell">
               {{ log.message }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="pagination">
      <div class="pagination-info">
        Page <strong>{{ page }}</strong> of <strong>{{ totalPages }}</strong>
        &middot; {{ total }} total records
      </div>
      <div class="pagination-btns">
        <button @click="handlePageChange(page - 1)" :disabled="page <= 1 || loading" class="btn btn-outline btn-sm">Previous</button>
        <button @click="handlePageChange(page + 1)" :disabled="page >= totalPages || loading" class="btn btn-outline btn-sm">Next</button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue';
import apiService from '@/services/api';
import { RefreshCw, ClipboardList, Clock, Search } from 'lucide-vue-next';

export default {
  name: "SystemActivityView",
  components: { RefreshCw, ClipboardList, Clock, Search },
  setup() {
    const logs = ref([]);
    const loading = ref(false);

    const page = ref(1);
    const limit = ref(50);
    const total = ref(0);
    const totalPages = ref(1);

    const filters = ref({
      action_type: '',
      target_type: '',
      search: ''
    });

    const refreshData = async (resetPage = false) => {
      if (resetPage) page.value = 1;
      loading.value = true;
      try {
        const params = {
          page: page.value,
          limit: limit.value,
        };
        if (filters.value.action_type) params.action_type = filters.value.action_type;
        if (filters.value.target_type) params.target_type = filters.value.target_type;
        if (filters.value.search) params.search = filters.value.search;

        const response = await apiService.getSystemLogs(params);

        if (response.data?.success) {
          logs.value = response.data.data;
          total.value = response.data.pagination.total;
          totalPages.value = response.data.pagination.pages;
        }
      } catch (err) {
        console.error("Failed to load system logs:", err);
      } finally {
        loading.value = false;
      }
    };

    const handlePageChange = (newPage) => {
      if (newPage >= 1 && newPage <= totalPages.value) {
        page.value = newPage;
        refreshData();
      }
    };

    const formatTimestamp = (ts) => {
      if (!ts) return '--';
      const d = new Date(ts);
      const p = (n) => n.toString().padStart(2, '0');
      return `${p(d.getDate())}/${p(d.getMonth()+1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
    };

    const getActionClass = (action) => {
      switch(action) {
        case 'CREATE': return 'badge-green';
        case 'UPDATE': return 'badge-blue';
        case 'DELETE': return 'badge-red';
        case 'REGISTER': return 'badge-purple';
        case 'LOGIN': return 'badge-gray';
        default: return 'badge-gray';
      }
    };

    onMounted(async () => {
      await refreshData(true);
    });

    return {
      logs, loading, page, limit, total, totalPages, filters,
      refreshData, handlePageChange, formatTimestamp, getActionClass
    };
  }
};
</script>

<style scoped>
.activity-view {
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
}
.activity-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}
.activity-header h1 {
  font-size: 2rem;
  font-weight: 800;
  color: #111827;
  margin: 0 0 0.25rem 0;
}
.subtitle { color: #6b7280; font-size: 0.95rem; margin: 0; }

/* Filters */
.filters-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  background: white;
  padding: 1rem 1.25rem;
  border-radius: 1rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  border: 1px solid #f3f4f6;
  margin-bottom: 1.5rem;
}
.filter-group {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  min-width: 160px;
  flex: 1;
}
.filter-group label {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  color: #9ca3af;
  letter-spacing: 0.05em;
}
.filter-group select,
.filter-group input {
  padding: 0.5rem 0.75rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  color: #374151;
  background: white;
  outline: none;
  transition: border-color 0.2s;
  width: 100%;
}
.filter-group select:focus,
.filter-group input:focus {
  border-color: #10b981;
  box-shadow: 0 0 0 3px rgba(16,185,129,0.1);
}
.search-wrap {
  position: relative;
  display: flex;
  align-items: center;
}
.search-icon {
  position: absolute;
  left: 0.75rem;
  color: #9ca3af;
}
.search-wrap input {
  padding-left: 2.2rem;
}

/* Table Container */
.table-container {
  background: white;
  border-radius: 1rem;
  border: 1px solid #f3f4f6;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  overflow-x: auto;
}

.data-table { 
  width: 100%; 
  border-collapse: collapse; 
}
.data-table th {
  background: #f9fafb;
  padding: 0.8rem 1rem;
  text-align: left;
  font-size: 0.75rem;
  font-weight: 700;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-bottom: 1px solid #e5e7eb;
}
.data-table td {
  padding: 0.85rem 1rem;
  font-size: 0.875rem;
  color: #374151;
  border-bottom: 1px solid #f9fafb;
}
.data-table tr:hover { 
  background: #f3f4f6; 
}

.timestamp-cell { display: flex; align-items: center; gap: 0.4rem; white-space: nowrap; color: #64748b; }
.ts-icon { color: #cbd5e1; }
.mono { font-family: 'SF Mono', 'Menlo', monospace; font-size: 0.8rem; }
.font-bold { font-weight: 600; }
.text-gray { color: #475569; }
.text-muted { color: #94a3b8; }
.text-xs { font-size: 0.75rem; }
.text-sm { font-size: 0.8rem; }

.user-cell {
  white-space: nowrap;
}
.user-name {
  font-weight: 600;
  color: #1e293b;
  font-size: 0.85rem;
}
.user-email {
  color: #64748b;
  font-size: 0.75rem;
}

.details-cell {
  color: #334155;
  max-width: 400px;
  line-height: 1.4;
}

.target-badge {
  display: inline-flex;
  align-items: center;
}
.t-type {
  background: #f1f5f9;
  color: #475569;
  padding: 0.2rem 0.5rem;
  border-radius: 0.3rem;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.badge {
  padding: 0.25rem 0.6rem;
  border-radius: 0.3rem;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  display: inline-block;
}
.badge-green { background: #dcfce7; color: #166534; }
.badge-blue { background: #dbeafe; color: #1e40af; }
.badge-red { background: #fee2e2; color: #991b1b; }
.badge-purple { background: #f3e8ff; color: #6b21a8; }
.badge-gray { background: #f1f5f9; color: #475569; }

/* Empty */
.empty-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  background: white;
  border-radius: 1rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  color: #6b7280;
}
.empty-icon { opacity: 0.4; margin-bottom: 0.75rem; }
.spinner {
  width: 36px; height: 36px;
  border: 3px solid #e5e7eb;
  border-top-color: #10b981;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 0.75rem;
}

/* Pagination */
.pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1.5rem;
  background: white;
  padding: 1rem 1.25rem;
  border-radius: 1rem;
  border: 1px solid #f3f4f6;
}
.pagination-info { font-size: 0.875rem; color: #6b7280; }
.pagination-info strong { color: #111827; }
.pagination-btns { display: flex; gap: 0.5rem; }

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem 1.25rem;
  border-radius: 0.6rem;
  font-weight: 600;
  font-size: 0.875rem;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-primary { background: #10b981; color: white; }
.btn-primary:hover:not(:disabled) { background: #059669; }
.btn-outline { background: white; border: 1px solid #e5e7eb; color: #374151; }
.btn-outline:hover:not(:disabled) { background: #f9fafb; border-color: #d1d5db; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-sm { padding: 0.5rem 1rem; font-size: 0.8rem; }

.spin { animation: spin 1s linear infinite; }
@keyframes spin { 100% { transform: rotate(360deg); } }

@media (max-width: 768px) {
  .filters-bar { flex-direction: column; }
  .filter-group { min-width: 100%; }
  .hide-mobile { display: none; } /* Hide search input on mobile for space */
  .pagination { flex-direction: column; gap: 0.75rem; }
}
</style>
