// stores/alerts.js
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import apiService from '@/services/api';

export const useAlertsStore = defineStore('alerts', () => {
    // State
    const alerts = ref([]);
    const loading = ref(false);
    const error = ref(null);

    // Getters
    const unresolvedAlerts = computed(() =>
        alerts.value.filter(alert => !alert.resolved)
    );

    const resolvedAlerts = computed(() =>
        alerts.value.filter(alert => alert.resolved)
    );

    const alertsByPriority = computed(() => (priority) =>
        alerts.value.filter(alert => alert.type === priority && !alert.resolved)
    );

    const criticalAlerts = computed(() =>
        alerts.value.filter(alert => alert.type === 'high' && !alert.resolved)
    );

    const warningAlerts = computed(() =>
        alerts.value.filter(alert => alert.type === 'medium' && !alert.resolved)
    );

    const infoAlerts = computed(() =>
        alerts.value.filter(alert => alert.type === 'low' && !alert.resolved)
    );

    const alertsByDevice = computed(() => (deviceId) =>
        alerts.value.filter(alert => alert.device === deviceId)
    );

    const totalUnresolvedCount = computed(() => unresolvedAlerts.value.length);

    const alertCounts = computed(() => ({
        high: criticalAlerts.value.length,
        medium: warningAlerts.value.length,
        low: infoAlerts.value.length,
        total: totalUnresolvedCount.value
    }));

    // Actions
    async function fetchAlerts(params = {}) {
        loading.value = true;
        error.value = null;

        try {
            const token = localStorage.getItem('auth_token');
            if (!token) {
                // Don't make API call if not authenticated
                alerts.value = [];
                return [];
            }

            const response = await apiService.getAlerts(params);
            alerts.value = response.data;
            return response.data;
        } catch (err) {
            // Don't throw error if it's a 401 - just return empty array
            if (err.response?.status === 401) {
                alerts.value = [];
                return [];
            }
            error.value = err.message || 'Failed to fetch alerts';
            console.error('Error fetching alerts:', err);
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
            error.value = err.message || 'Failed to create alert';
            console.error('Error creating alert:', err);
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
            const index = alerts.value.findIndex(a => a.id === alertId);
            if (index !== -1) {
                alerts.value[index] = { ...alerts.value[index], ...response.data };
            }
            return response.data;
        } catch (err) {
            error.value = err.message || 'Failed to update alert';
            console.error('Error updating alert:', err);
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
            const index = alerts.value.findIndex(a => a.id === alertId);
            if (index !== -1) {
                alerts.value[index] = {
                    ...alerts.value[index],
                    resolved: true,
                    resolvedAt: new Date().toISOString()
                };
            }
            return response.data;
        } catch (err) {
            error.value = err.message || 'Failed to resolve alert';
            console.error('Error resolving alert:', err);
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
            alerts.value = alerts.value.filter(a => a.id !== alertId);
            return true;
        } catch (err) {
            error.value = err.message || 'Failed to delete alert';
            console.error('Error deleting alert:', err);
            throw err;
        } finally {
            loading.value = false;
        }
    }

    function addAlert(alert) {
        // Add alert from WebSocket or other source
        const exists = alerts.value.find(a => a.id === alert.id);
        if (!exists) {
            alerts.value.unshift(alert);
        }
    }

    function updateLocalAlert(alertId, updates) {
        const index = alerts.value.findIndex(a => a.id === alertId);
        if (index !== -1) {
            alerts.value[index] = { ...alerts.value[index], ...updates };
        }
    }

    function clearResolvedAlerts() {
        alerts.value = alerts.value.filter(a => !a.resolved);
    }

    function clearError() {
        error.value = null;
    }

    // Bulk operations
    async function resolveMultipleAlerts(alertIds) {
        const promises = alertIds.map(id => resolveAlert(id));
        return Promise.allSettled(promises);
    }

    async function deleteMultipleAlerts(alertIds) {
        const promises = alertIds.map(id => deleteAlert(id));
        return Promise.allSettled(promises);
    }

    // Filter helpers
    function getAlertsInTimeRange(startDate, endDate) {
        const start = new Date(startDate).getTime();
        const end = new Date(endDate).getTime();

        return alerts.value.filter(alert => {
            const alertTime = new Date(alert.timestamp).getTime();
            return alertTime >= start && alertTime <= end;
        });
    }

    function getRecentAlerts(hours = 24) {
        const cutoff = Date.now() - (hours * 60 * 60 * 1000);
        return alerts.value.filter(alert =>
            new Date(alert.timestamp).getTime() > cutoff
        );
    }

    // Reset store
    function $reset() {
        alerts.value = [];
        loading.value = false;
        error.value = null;
    }

    return {
        // State
        alerts,
        loading,
        error,

        // Getters
        unresolvedAlerts,
        resolvedAlerts,
        alertsByPriority,
        criticalAlerts,
        warningAlerts,
        infoAlerts,
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
        clearResolvedAlerts,
        clearError,
        resolveMultipleAlerts,
        deleteMultipleAlerts,
        getAlertsInTimeRange,
        getRecentAlerts,
        $reset
    };
});