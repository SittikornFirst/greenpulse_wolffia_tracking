// services/api.js
import axios from "axios";

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api",
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Store router reference (will be set from router/index.js)
let routerInstance = null;

// Export function to set router
export const setRouter = (router) => {
  routerInstance = router;
};

// Request interceptor for adding auth token (optional)
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("auth_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Don't fail if no token - just continue without it
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response interceptor for handling errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // Server responded with error status
      switch (error.response.status) {
        case 401:
          // Token expired or invalid
          console.warn("Unauthorized request - redirecting to login");
          localStorage.removeItem("auth_token");
          localStorage.removeItem("user_name");
          localStorage.removeItem("user_role");
          if (routerInstance) {
            routerInstance.push({
              path: "/login",
              query: { redirect: routerInstance.currentRoute.value.fullPath },
            });
          }
          break;
        case 403:
          console.warn("Access forbidden:", error.config?.url);
          break;
        case 404:
          console.error("Resource not found");
          break;
        case 500:
          console.error("Server error");
          break;
        default:
          console.error("API Error:", error.response.data);
      }
    } else if (error.request) {
      // Request made but no response received
      console.error("Network error - no response received");
    } else {
      // Error setting up the request
      console.error("Request setup error:", error.message);
    }
    return Promise.reject(error);
  },
);

// API Service Object
const apiService = {
  // ==================== Authentication ====================
  async login(credentials) {
    const response = await apiClient.post("/auth/login", credentials);
    if (response.data.token) {
      localStorage.setItem("auth_token", response.data.token);
    }
    return response;
  },

  async register(userData) {
    return apiClient.post("/auth/register", userData);
  },

  async logout() {
    try {
      await apiClient.post("/auth/logout");
    } finally {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("user_name");
      localStorage.removeItem("user_role");
    }
  },

  async getCurrentUser() {
    return apiClient.get("/auth/me");
  },

  // ==================== Devices ====================
  async getDevices(params = {}) {
    const normalizedParams =
      params && typeof params === "object" && !Array.isArray(params)
        ? params
        : params
          ? { farmId: params }
          : {};
    return apiClient.get("/devices", { params: normalizedParams });
  },

  async getDevice(deviceId) {
    return apiClient.get(`/devices/${deviceId}`);
  },

  async createDevice(deviceData) {
    return apiClient.post("/devices", deviceData);
  },

  async updateDevice(deviceId, updates) {
    return apiClient.put(`/devices/${deviceId}`, updates);
  },

  async deleteDevice(deviceId, hard = false) {
    return apiClient.delete(`/devices/${deviceId}${hard ? "?hard=true" : ""}`);
  },

  async updateDeviceStatus(deviceId, status) {
    return apiClient.patch(`/devices/${deviceId}/status`, { status });
  },

  async updateDeviceConfiguration(deviceId, configData) {
    return apiClient.put(`/devices/${deviceId}/configuration`, configData);
  },

  // ==================== Relays & Schedules ====================
  async updateRelay(deviceId, relayId, name) {
    return apiClient.put(`/devices/${deviceId}/relays/${relayId}`, { name });
  },

  async toggleRelay(deviceId, relayId, status) {
    return apiClient.put(`/devices/${deviceId}/relays/${relayId}`, { status });
  },

  async addSchedule(deviceId, scheduleData) {
    return apiClient.post(`/devices/${deviceId}/schedules`, scheduleData);
  },

  async updateSchedule(deviceId, scheduleId, updates) {
    return apiClient.put(`/devices/${deviceId}/schedules/${scheduleId}`, updates);
  },

  async deleteSchedule(deviceId, scheduleId) {
    return apiClient.delete(`/devices/${deviceId}/schedules/${scheduleId}`);
  },

  // ==================== Sensor Data ====================
  async getLatestReadings(deviceId = null) {
    if (deviceId) {
      return apiClient.get(`/sensor-data/${deviceId}/latest`);
    }
    return apiClient.get("/sensor-data/latest");
  },

  async getHistoricalData(deviceId, options = {}) {
    const { range, startDate, endDate, page, limit } = options;
    return apiClient.get(`/sensor-data/${deviceId}/history`, {
      params: { range, startDate, endDate, page, limit },
    });
  },

  async submitReading(reading) {
    return apiClient.post("/sensor-data", reading);
  },

  async getReadingsByTimeRange(deviceId, startDate, endDate) {
    return apiClient.get(`/sensor-data/${deviceId}/range`, {
      params: { startDate, endDate },
    });
  },

  async getAggregatedData(deviceId, aggregation = "hourly") {
    return apiClient.get(`/sensor-data/${deviceId}/aggregate`, {
      params: { aggregation },
    });
  },

  async getActivityLog(params = {}) {
    // Note: This endpoint is not implemented on the backend
    // Using /sensor-data endpoint as alternative with proper params
    return apiClient.get("/sensor-data", { params });
  },

  // ==================== Alerts ====================
  async getAlerts(params = {}) {
    return apiClient.get("/alerts", { params });
  },

  async getAlert(alertId) {
    return apiClient.get(`/alerts/${alertId}`);
  },

  async createAlert(alertData) {
    return apiClient.post("/alerts", alertData);
  },

  async updateAlert(alertId, updates) {
    return apiClient.put(`/alerts/${alertId}`, updates);
  },

  async resolveAlert(alertId) {
    return apiClient.patch(`/alerts/${alertId}/resolve`);
  },

  async deleteAlert(alertId) {
    return apiClient.delete(`/alerts/${alertId}`);
  },

  async getUnresolvedAlerts() {
    return apiClient.get("/alerts/unresolved");
  },

  async getAlertsByDevice(deviceId) {
    return apiClient.get(`/alerts/device/${deviceId}`);
  },

  // ==================== Farms ====================
  async getFarms(params = {}) {
    return apiClient.get("/farms", { params });
  },

  async getFarm(farmId) {
    return apiClient.get(`/farms/${farmId}`);
  },

  async createFarm(farmData) {
    return apiClient.post("/farms", farmData);
  },

  async updateFarm(farmId, updates) {
    return apiClient.put(`/farms/${farmId}`, updates);
  },

  async deleteFarm(farmId, hard = false) {
    return apiClient.delete(`/farms/${farmId}${hard ? "?hard=true" : ""}`);
  },

  async getFarmDevices(farmId) {
    return apiClient.get(`/farms/${farmId}/devices`);
  },

  async getFarmStatistics(farmId) {
    return apiClient.get(`/farms/${farmId}/statistics`);
  },

  // ==================== Thresholds ====================
  async getThresholds(deviceId = null) {
    const params = deviceId ? { deviceId } : {};
    return apiClient.get("/thresholds", { params });
  },

  async updateThreshold(thresholdId, updates) {
    return apiClient.put(`/thresholds/${thresholdId}`, updates);
  },

  async createThreshold(thresholdData) {
    return apiClient.post("/thresholds", thresholdData);
  },

  async deleteThreshold(thresholdId) {
    return apiClient.delete(`/thresholds/${thresholdId}`);
  },

  // ==================== Analytics ====================
  async getDashboardSummary(farmId = null) {
    const params = farmId ? { farmId } : {};
    return apiClient.get("/analytics/dashboard", { params });
  },

  async getDevicePerformance(deviceId, timeRange = "7d") {
    return apiClient.get(`/analytics/devices/${deviceId}/performance`, {
      params: { timeRange },
    });
  },

  async getFarmHealth(farmId) {
    return apiClient.get(`/analytics/farms/${farmId}/health`);
  },

  async exportData(params = {}) {
    return apiClient.get("/analytics/export", {
      params,
      responseType: "blob",
    });
  },

  async getSensorMinMax(deviceId, params = {}) {
    return apiClient.get(`/analytics/min-max/${deviceId}`, { params });
  },

  // ==================== Notifications ====================
  async getNotificationSettings() {
    return apiClient.get("/notifications/settings");
  },

  async updateNotificationSettings(settings) {
    return apiClient.put("/notifications/settings", settings);
  },

  async testNotification(type) {
    return apiClient.post("/notifications/test", { type });
  },

  // ==================== User Management (Admin) ====================
  async getUsers(params = {}) {
    return apiClient.get("/users", { params });
  },

  async getUser(userId) {
    return apiClient.get(`/users/${userId}`);
  },

  async createUser(userData) {
    return apiClient.post("/users", userData);
  },

  async updateUser(userId, updates) {
    return apiClient.put(`/users/${userId}`, updates);
  },

  async deleteUser(userId, hard = false) {
    return apiClient.delete(`/users/${userId}${hard ? "?hard=true" : ""}`);
  },

  async toggleUserStatus(userId) {
    return apiClient.patch(`/users/${userId}/toggle-status`);
  },

  // ==================== Admin Analytics ====================
  async getAdminStats() {
    return apiClient.get("/analytics/admin/stats");
  },

  // ==================== System Logs ====================
  async getSystemLogs(params = {}) {
    return apiClient.get("/system-logs", { params });
  },
};

export default apiService;
