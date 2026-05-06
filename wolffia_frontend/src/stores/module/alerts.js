// stores/alerts.js
import { defineStore } from "pinia";
import { ref, computed } from "vue";
import apiService from "@/services/api";

export const useAlertsStore = defineStore("alerts", () => {
  // State
  const alerts = ref([]);
  const loading = ref(false);
  const error = ref(null);
  // Stack of currently-visible toasts. Each entry is the alert plus a unique
  // _toastId so TransitionGroup can key them safely even if the same _id
  // somehow gets re-toasted (e.g., reconnection storms).
  const activeToasts = ref([]);
  const MAX_VISIBLE_TOASTS = 3;

  // Getters — backend uses `status: 'resolved'` not a boolean `resolved`
  const unresolvedAlerts = computed(() =>
    alerts.value.filter((alert) => alert.status !== "resolved"),
  );

  const resolvedAlerts = computed(() =>
    alerts.value.filter((alert) => alert.status === "resolved"),
  );

  const alertsByDevice = computed(
    () => (deviceId) =>
      alerts.value.filter((alert) => alert.device_id === deviceId),
  );

  const totalUnresolvedCount = computed(() => unresolvedAlerts.value.length);

  const alertCounts = computed(() => ({
    total: totalUnresolvedCount.value,
  }));

  // Actions
  async function fetchAlerts(params = {}) {
    loading.value = true;
    error.value = null;

    try {
      const token = localStorage.getItem("auth_token");
      if (!token) {
        alerts.value = [];
        return [];
      }

      const response = await apiService.getAlerts(params);
      alerts.value = response.data;
      return response.data;
    } catch (err) {
      if (err.response?.status === 401) {
        alerts.value = [];
        return [];
      }
      error.value = err.message || "Failed to fetch alerts";
      console.error("Error fetching alerts:", err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function fetchUnresolvedAlerts() {
    return fetchAlerts({ resolved: false });
  }

  async function createAlert(alertData) {
    loading.value = true;
    error.value = null;

    try {
      const response = await apiService.createAlert(alertData);
      alerts.value.unshift(response.data);
      return response.data;
    } catch (err) {
      error.value = err.message || "Failed to create alert";
      console.error("Error creating alert:", err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function updateAlert(alertId, updates) {
    loading.value = true;
    error.value = null;

    try {
      const response = await apiService.updateAlert(alertId, updates);
      const index = alerts.value.findIndex((a) => (a._id || a.id) === alertId);
      if (index !== -1) {
        alerts.value[index] = { ...alerts.value[index], ...response.data };
      }
      return response.data;
    } catch (err) {
      error.value = err.message || "Failed to update alert";
      console.error("Error updating alert:", err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function resolveAlert(alertId) {
    loading.value = true;
    error.value = null;

    try {
      const response = await apiService.resolveAlert(alertId);
      // Optimistic update — use backend's status field
      const index = alerts.value.findIndex((a) => (a._id || a.id) === alertId);
      if (index !== -1) {
        alerts.value[index] = {
          ...alerts.value[index],
          status: "resolved",
          resolved_at: new Date().toISOString(),
        };
      }
      return response.data;
    } catch (err) {
      error.value = err.message || "Failed to resolve alert";
      console.error("Error resolving alert:", err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function deleteAlert(alertId) {
    loading.value = true;
    error.value = null;

    try {
      await apiService.deleteAlert(alertId);
      alerts.value = alerts.value.filter((a) => (a._id || a.id) !== alertId);
      return true;
    } catch (err) {
      error.value = err.message || "Failed to delete alert";
      console.error("Error deleting alert:", err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  function addAlert(alert) {
    // Mirror into the master alerts list (skip dup _ids so we don't double-list)
    const alertId = alert?._id || alert?.id;
    const exists = alertId
      ? alerts.value.find((a) => (a._id || a.id) === alertId)
      : null;
    if (!exists) {
      alerts.value.unshift(alert);
    }

    // Always toast — the alerts list dedup must NOT block the popup, otherwise
    // a fetchAlerts that races a WebSocket broadcast silently swallows the toast.
    pushToast(alert);
  }

  function pushToast(alert) {
    const toastId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    activeToasts.value.push({ ...alert, _toastId: toastId });
    // Cap stack size — drop the oldest visible toast if we exceed the cap
    while (activeToasts.value.length > MAX_VISIBLE_TOASTS) {
      activeToasts.value.shift();
    }
  }

  function dismissToast(toastId) {
    activeToasts.value = activeToasts.value.filter(
      (t) => t._toastId !== toastId,
    );
  }

  function updateLocalAlert(alertId, updates) {
    const index = alerts.value.findIndex((a) => (a._id || a.id) === alertId);
    if (index !== -1) {
      alerts.value[index] = { ...alerts.value[index], ...updates };
    }
  }

  function clearResolvedAlerts() {
    alerts.value = alerts.value.filter((a) => a.status !== "resolved");
  }

  function clearError() {
    error.value = null;
  }

  // Bulk operations
  async function resolveMultipleAlerts(alertIds) {
    const promises = alertIds.map((id) => resolveAlert(id));
    return Promise.allSettled(promises);
  }

  async function deleteMultipleAlerts(alertIds) {
    const promises = alertIds.map((id) => deleteAlert(id));
    return Promise.allSettled(promises);
  }

  // Filter helpers
  function getAlertsInTimeRange(startDate, endDate) {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();

    return alerts.value.filter((alert) => {
      const alertTime = new Date(alert.created_at || alert.timestamp).getTime();
      return alertTime >= start && alertTime <= end;
    });
  }

  function getRecentAlerts(hours = 24) {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    return alerts.value.filter(
      (alert) =>
        new Date(alert.created_at || alert.timestamp).getTime() > cutoff,
    );
  }

  // Reset store
  function $reset() {
    alerts.value = [];
    loading.value = false;
    error.value = null;
    activeToasts.value = [];
  }

  return {
    // State
    alerts,
    loading,
    error,
    activeToasts,

    // Getters
    unresolvedAlerts,
    resolvedAlerts,
    alertsByDevice,
    totalUnresolvedCount,
    alertCounts,

    // Actions
    fetchAlerts,
    fetchUnresolvedAlerts,
    createAlert,
    updateAlert,
    resolveAlert,
    deleteAlert,
    addAlert,
    updateLocalAlert,
    pushToast,
    dismissToast,
    clearResolvedAlerts,
    clearError,
    resolveMultipleAlerts,
    deleteMultipleAlerts,
    getAlertsInTimeRange,
    getRecentAlerts,
    $reset,
  };
});
