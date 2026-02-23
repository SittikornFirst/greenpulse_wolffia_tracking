<template>
  <div class="users-management">
    <div class="page-header">
      <div class="header-content">
        <h1>User Management</h1>
        <p class="subtitle">Manage system users and their permissions</p>
      </div>
      <button @click="openCreateDialog" class="btn btn--primary">
        <UserPlus :size="20" />
        <span>Add User</span>
      </button>
    </div>

    <div class="filters">
      <div class="search-box">
        <Search :size="20" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search by name or email..."
          @input="handleSearch"
        />
      </div>
      <select
        v-model="roleFilter"
        @change="handleRoleFilter"
        class="filter-select"
      >
        <option value="">All Roles</option>
        <option value="admin">Admin</option>
        <option value="farmer">Farmer</option>
      </select>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading users...</p>
    </div>

    <div v-else-if="users.length === 0" class="empty-state">
      <Users :size="56" />
      <h3>No users found</h3>
      <p v-if="searchQuery || roleFilter">Try adjusting your filters</p>
      <p v-else>Create your first user to get started</p>
    </div>

    <div v-else class="users-table-container">
      <table class="users-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th>Devices</th>
            <th>Last Login</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user._id || user.id">
            <td>
              <div class="user-cell">
                <div class="user-avatar">
                  {{ getUserInitials(user.user_name) }}
                </div>
                <span class="user-name">{{ user.user_name }}</span>
              </div>
            </td>
            <td>{{ user.email }}</td>
            <td>
              <span :class="['role-badge', `role-badge--${user.role}`]">
                {{ user.role }}
              </span>
            </td>
            <td>
              <span
                :class="[
                  'status-badge',
                  user.is_active
                    ? 'status-badge--active'
                    : 'status-badge--inactive',
                ]"
              >
                {{ user.is_active ? "Active" : "Inactive" }}
              </span>
            </td>
            <td>{{ user.deviceCount || 0 }}</td>
            <td>{{ formatDate(user.last_login) }}</td>
            <td>
              <div class="actions">
                <button
                  @click="openEditDialog(user)"
                  class="btn-icon"
                  title="Edit user"
                >
                  <Edit :size="18" />
                </button>
                <button
                  @click="toggleUserStatus(user)"
                  :class="[
                    'btn-icon',
                    user.is_active ? 'btn-icon--warning' : 'btn-icon--success',
                  ]"
                  :title="user.is_active ? 'Deactivate user' : 'Activate user'"
                >
                  <component
                    :is="user.is_active ? ShieldOff : Shield"
                    :size="18"
                  />
                </button>
                <button
                  @click="confirmDelete(user)"
                  class="btn-icon btn-icon--danger"
                  title="Delete user"
                >
                  <Trash2 :size="18" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="pagination.pages > 1" class="pagination">
      <button
        @click="changePage(pagination.page - 1)"
        :disabled="pagination.page === 1"
        class="btn btn--secondary"
      >
        Previous
      </button>
      <span class="page-info">
        Page {{ pagination.page }} of {{ pagination.pages }}
      </span>
      <button
        @click="changePage(pagination.page + 1)"
        :disabled="pagination.page === pagination.pages"
        class="btn btn--secondary"
      >
        Next
      </button>
    </div>

    <!-- Create/Edit Dialog -->
    <div v-if="showDialog" class="modal-overlay" @click="closeDialog">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h2>{{ isEditing ? "Edit User" : "Create New User" }}</h2>
          <button @click="closeDialog" class="btn-close">
            <X :size="20" />
          </button>
        </div>
        <form @submit.prevent="saveUser" class="modal-body">
          <div class="form-group">
            <label for="user_name">Name *</label>
            <input
              id="user_name"
              v-model="formData.user_name"
              type="text"
              required
              placeholder="Enter full name"
            />
          </div>

          <div class="form-group">
            <label for="email">Email *</label>
            <input
              id="email"
              v-model="formData.email"
              type="email"
              required
              placeholder="user@example.com"
            />
          </div>

          <div class="form-group">
            <label for="phone">Phone</label>
            <input
              id="phone"
              v-model="formData.phone"
              type="tel"
              placeholder="+66 XX XXX XXXX"
            />
          </div>

          <div class="form-group">
            <label for="role">Role *</label>
            <select id="role" v-model="formData.role" required>
              <option value="farmer">Farmer</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div class="form-group">
            <label for="password">{{
              isEditing
                ? "New Password (leave blank to keep current)"
                : "Password *"
            }}</label>
            <input
              id="password"
              v-model="formData.password"
              type="password"
              :required="!isEditing"
              placeholder="••••••••"
            />
          </div>

          <div v-if="isEditing" class="form-group">
            <label class="checkbox-label">
              <input v-model="formData.is_active" type="checkbox" />
              <span>Active user</span>
            </label>
          </div>

          <div v-if="error" class="alert alert--error">
            <AlertCircle :size="20" />
            <span>{{ error }}</span>
          </div>

          <div class="modal-footer">
            <button
              type="button"
              @click="closeDialog"
              class="btn btn--secondary"
            >
              Cancel
            </button>
            <button type="submit" :disabled="saving" class="btn btn--primary">
              {{
                saving ? "Saving..." : isEditing ? "Update User" : "Create User"
              }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Delete Confirmation Dialog -->
    <div
      v-if="showDeleteDialog"
      class="modal-overlay"
      @click="showDeleteDialog = false"
    >
      <div class="modal modal--small" @click.stop>
        <div class="modal-header">
          <h2>Confirm Deletion</h2>
          <button @click="showDeleteDialog = false" class="btn-close">
            <X :size="20" />
          </button>
        </div>
        <div class="modal-body">
          <p>
            Are you sure you want to delete
            <strong>{{ userToDelete?.user_name }}</strong
            >?
          </p>
          <p class="warning-text">This will also delete:</p>
          <ul class="warning-list">
            <li>User's farm</li>
            <li>All devices</li>
            <li>All sensor data</li>
            <li>All alerts</li>
          </ul>
          <p class="warning-text">
            <strong>This action cannot be undone.</strong>
          </p>
        </div>
        <div class="modal-footer">
          <button @click="showDeleteDialog = false" class="btn btn--secondary">
            Cancel
          </button>
          <button
            @click="deleteUser"
            :disabled="deleting"
            class="btn btn--danger"
          >
            {{ deleting ? "Deleting..." : "Delete User" }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, computed } from "vue";
import {
  Users,
  UserPlus,
  Search,
  Edit,
  Trash2,
  Shield,
  ShieldOff,
  AlertCircle,
  X,
} from "lucide-vue-next";
import apiService from "@/services/api";

export default {
  name: "UsersManagementView",
  components: {
    Users,
    UserPlus,
    Search,
    Edit,
    Trash2,
    Shield,
    ShieldOff,
    AlertCircle,
    X,
  },
  setup() {
    const users = ref([]);
    const loading = ref(false);
    const searchQuery = ref("");
    const roleFilter = ref("");
    const pagination = ref({
      page: 1,
      limit: 20,
      total: 0,
      pages: 1,
    });

    const showDialog = ref(false);
    const isEditing = ref(false);
    const saving = ref(false);
    const error = ref("");

    const formData = ref({
      user_name: "",
      email: "",
      phone: "",
      role: "farmer",
      password: "",
      is_active: true,
    });

    const showDeleteDialog = ref(false);
    const userToDelete = ref(null);
    const deleting = ref(false);

    const fetchUsers = async () => {
      loading.value = true;
      try {
        const params = {
          page: pagination.value.page,
          limit: pagination.value.limit,
        };

        if (searchQuery.value) {
          params.search = searchQuery.value;
        }
        if (roleFilter.value) {
          params.role = roleFilter.value;
        }

        const response = await apiService.getUsers(params);
        users.value = response.data.users;
        pagination.value = response.data.pagination;
      } catch (err) {
        console.error("Error fetching users:", err);
      } finally {
        loading.value = false;
      }
    };

    let searchTimeout = null;
    const handleSearch = () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        pagination.value.page = 1;
        fetchUsers();
      }, 500);
    };

    const handleRoleFilter = () => {
      pagination.value.page = 1;
      fetchUsers();
    };

    const changePage = (page) => {
      pagination.value.page = page;
      fetchUsers();
    };

    const openCreateDialog = () => {
      isEditing.value = false;
      formData.value = {
        user_name: "",
        email: "",
        phone: "",
        role: "farmer",
        password: "",
        is_active: true,
      };
      error.value = "";
      showDialog.value = true;
    };

    const openEditDialog = (user) => {
      isEditing.value = true;
      formData.value = {
        _id: user._id || user.id,
        user_name: user.user_name,
        email: user.email,
        phone: user.phone || "",
        role: user.role,
        password: "",
        is_active: user.is_active,
      };
      error.value = "";
      showDialog.value = true;
    };

    const closeDialog = () => {
      showDialog.value = false;
      formData.value = {
        user_name: "",
        email: "",
        phone: "",
        role: "farmer",
        password: "",
        is_active: true,
      };
      error.value = "";
    };

    const saveUser = async () => {
      saving.value = true;
      error.value = "";

      try {
        const userData = {
          user_name: formData.value.user_name,
          email: formData.value.email,
          phone: formData.value.phone,
          role: formData.value.role,
        };

        if (formData.value.password) {
          userData.password = formData.value.password;
        }

        if (isEditing.value) {
          userData.is_active = formData.value.is_active;
          await apiService.updateUser(formData.value._id, userData);
        } else {
          await apiService.createUser(userData);
        }

        closeDialog();
        fetchUsers();
      } catch (err) {
        error.value = err.response?.data?.message || "Failed to save user";
      } finally {
        saving.value = false;
      }
    };

    const toggleUserStatus = async (user) => {
      try {
        await apiService.toggleUserStatus(user._id || user.id);
        fetchUsers();
      } catch (err) {
        console.error("Error toggling user status:", err);
        alert(err.response?.data?.message || "Failed to update user status");
      }
    };

    const confirmDelete = (user) => {
      userToDelete.value = user;
      showDeleteDialog.value = true;
    };

    const deleteUser = async () => {
      deleting.value = true;
      try {
        await apiService.deleteUser(
          userToDelete.value._id || userToDelete.value.id,
        );
        showDeleteDialog.value = false;
        userToDelete.value = null;
        fetchUsers();
      } catch (err) {
        console.error("Error deleting user:", err);
        alert(err.response?.data?.message || "Failed to delete user");
      } finally {
        deleting.value = false;
      }
    };

    const getUserInitials = (name) => {
      if (!name) return "?";
      const parts = name.split(" ");
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return name.substring(0, 2).toUpperCase();
    };

    const formatDate = (date) => {
      if (!date) return "Never";
      return new Date(date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    };

    onMounted(() => {
      fetchUsers();
    });

    return {
      users,
      loading,
      searchQuery,
      roleFilter,
      pagination,
      showDialog,
      isEditing,
      saving,
      error,
      formData,
      showDeleteDialog,
      userToDelete,
      deleting,
      Shield,
      ShieldOff,
      fetchUsers,
      handleSearch,
      handleRoleFilter,
      changePage,
      openCreateDialog,
      openEditDialog,
      closeDialog,
      saveUser,
      toggleUserStatus,
      confirmDelete,
      deleteUser,
      getUserInitials,
      formatDate,
    };
  },
};
</script>

<style scoped>
.users-management {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
}

.header-content h1 {
  font-size: 2rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 0.5rem 0;
}

.subtitle {
  color: #6b7280;
  margin: 0;
}

.filters {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.search-box {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
}

.search-box svg {
  color: #9ca3af;
}

.search-box input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 0.875rem;
}

.filter-select {
  min-width: 150px;
  padding: 0.75rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  background: white;
}

.users-table-container {
  background: white;
  border-radius: 0.75rem;
  overflow: hidden;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
}

.users-table {
  width: 100%;
  border-collapse: collapse;
}

.users-table thead {
  background: #f9fafb;
}

.users-table th {
  padding: 1rem;
  text-align: left;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  color: #6b7280;
  border-bottom: 1px solid #e5e7eb;
}

.users-table td {
  padding: 1rem;
  border-bottom: 1px solid #f3f4f6;
}

.user-cell {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.user-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.875rem;
}

.user-name {
  font-weight: 500;
  color: #1f2937;
}

.role-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  font-size: 0.75rem;
  font-weight: 600;
}

.role-badge--admin {
  background: #fef3c7;
  color: #92400e;
}

.role-badge--farmer {
  background: #dbeafe;
  color: #1e40af;
}

.status-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  font-size: 0.75rem;
  font-weight: 600;
}

.status-badge--active {
  background: #d1fae5;
  color: #065f46;
}

.status-badge--inactive {
  background: #fee2e2;
  color: #991b1b;
}

.actions {
  display: flex;
  gap: 0.5rem;
}

.btn-icon {
  padding: 0.5rem;
  border: none;
  background: transparent;
  color: #6b7280;
  cursor: pointer;
  border-radius: 0.375rem;
  transition: all 0.2s;
}

.btn-icon:hover {
  background: #f3f4f6;
  color: #1f2937;
}

.btn-icon--warning {
  color: #f59e0b;
}

.btn-icon--warning:hover {
  background: #fef3c7;
  color: #d97706;
}

.btn-icon--success {
  color: #10b981;
}

.btn-icon--success:hover {
  background: #d1fae5;
  color: #059669;
}

.btn-icon--danger {
  color: #ef4444;
}

.btn-icon--danger:hover {
  background: #fee2e2;
  color: #dc2626;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  margin-top: 2rem;
}

.page-info {
  font-size: 0.875rem;
  color: #6b7280;
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
  background: #f3f4f6;
  color: #374151;
}

.btn--secondary:hover {
  background: #e5e7eb;
}

.btn--secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn--danger {
  background: #ef4444;
  color: white;
}

.btn--danger:hover {
  background: #dc2626;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: white;
  border-radius: 0.75rem;
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow: auto;
}

.modal--small {
  max-width: 400px;
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
  margin: 0;
}

.btn-close {
  padding: 0.5rem;
  border: none;
  background: transparent;
  color: #6b7280;
  cursor: pointer;
  border-radius: 0.375rem;
}

.btn-close:hover {
  background: #f3f4f6;
  color: #1f2937;
}

.modal-body {
  padding: 1.5rem;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #374151;
  font-size: 0.875rem;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  font-size: 0.875rem;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: #10b981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
  width: auto;
}

.alert {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  border-radius: 0.5rem;
  margin-bottom: 1rem;
}

.alert--error {
  background: #fee2e2;
  color: #991b1b;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding-top: 1rem;
  border-top: 1px solid #e5e7eb;
}

.warning-text {
  color: #ef4444;
  font-weight: 500;
  margin: 0.5rem 0;
}

.warning-list {
  margin: 0.5rem 0;
  padding-left: 1.5rem;
  color: #6b7280;
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  color: #6b7280;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #e5e7eb;
  border-top-color: #10b981;
  border-radius: 50%;
  animation: spin 1s linear infinite;
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
  margin: 1rem 0 0.5rem 0;
  color: #374151;
}
</style>
