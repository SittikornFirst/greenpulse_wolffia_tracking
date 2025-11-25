// stores/sensorData.js
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import apiService from '@/services/api';

export const useSensorDataStore = defineStore('sensorData', () => {
    // State
    const sensorReadings = ref({});
    const latestReadings = ref({});
    const historicalData = ref({});
    const loading = ref(false);
    const error = ref(null);
    const realtimeConnected = ref(false);

    // Thresholds for different sensor types
    const thresholds = ref({
        pH: { min: 6.5, max: 7.5, optimal: 7.0 },
        temperature: { min: 20, max: 28, optimal: 24 },
        light: { min: 3500, max: 5000, optimal: 4000 },
        oxygen: { min: 6.0, max: 9.0, optimal: 7.5 }
    });

    // Getters
    const getLatestReading = computed(() => (deviceId) =>
        latestReadings.value[deviceId]
    );

    const getHistoricalData = computed(() => (deviceId, range = '24h') =>
        historicalData.value[`${deviceId}_${range}`] || []
    );

    const getSensorStatus = computed(() => (deviceId) => {
        const reading = latestReadings.value[deviceId];
        if (!reading) return 'unknown';

        const threshold = thresholds.value[reading.type];
        if (!threshold) return 'normal';

        if (reading.value < threshold.min || reading.value > threshold.max) {
            return 'critical';
        }

        const deviation = Math.abs(reading.value - threshold.optimal) / threshold.optimal;
        if (deviation > 0.1) return 'warning';

        return 'normal';
    });

    const getAverageReading = computed(() => (deviceId, range = '24h') => {
        const data = historicalData.value[`${deviceId}_${range}`];
        if (!data || data.length === 0) return null;

        const sum = data.reduce((acc, reading) => acc + reading.value, 0);
        return sum / data.length;
    });

    const getTrend = computed(() => (deviceId, range = '24h') => {
        const data = historicalData.value[`${deviceId}_${range}`];
        if (!data || data.length < 2) return 0;

        const recent = data.slice(-10);
        const earlier = data.slice(-20, -10);

        if (earlier.length === 0) return 0;

        const recentAvg = recent.reduce((sum, r) => sum + r.value, 0) / recent.length;
        const earlierAvg = earlier.reduce((sum, r) => sum + r.value, 0) / earlier.length;

        if (earlierAvg === 0) return 0;

        return ((recentAvg - earlierAvg) / earlierAvg) * 100;
    });

    // Actions
    async function fetchLatestReadings(deviceId = null) {
        loading.value = true;
        error.value = null;

        try {
            const response = await apiService.getLatestReadings(deviceId);

            if (deviceId) {
                latestReadings.value[deviceId] = response.data;
            } else {
                response.data.forEach(reading => {
                    latestReadings.value[reading.deviceId] = reading;
                });
            }

            return response.data;
        } catch (err) {
            error.value = err.message || 'Failed to fetch latest readings';
            console.error('Error fetching latest readings:', err);
            throw err;
        } finally {
            loading.value = false;
        }
    }

    async function fetchHistoricalData(deviceId, options = {}) {
        const { range = '24h', startDate, endDate } = options;
        loading.value = true;
        error.value = null;

        try {
            const response = await apiService.getHistoricalData(deviceId, {
                range,
                startDate,
                endDate
            });

            const key = `${deviceId}_${range}`;
            historicalData.value[key] = response.data;

            return response.data;
        } catch (err) {
            error.value = err.message || 'Failed to fetch historical data';
            console.error('Error fetching historical data:', err);
            throw err;
        } finally {
            loading.value = false;
        }
    }

    async function submitSensorReading(reading) {
        try {
            const response = await apiService.submitReading(reading);

            // Update latest readings
            latestReadings.value[reading.deviceId] = response.data;

            // Add to historical data if exists
            const key = `${reading.deviceId}_24h`;
            if (historicalData.value[key]) {
                historicalData.value[key].push(response.data);

                // Keep only last 100 readings in memory
                if (historicalData.value[key].length > 100) {
                    historicalData.value[key].shift();
                }
            }

            return response.data;
        } catch (err) {
            console.error('Error submitting reading:', err);
            throw err;
        }
    }

    function updateRealtimeReading(reading) {
        // Update latest reading
        latestReadings.value[reading.deviceId] = {
            ...reading,
            timestamp: reading.timestamp || new Date().toISOString()
        };

        // Add to historical data
        const key = `${reading.deviceId}_24h`;
        if (historicalData.value[key]) {
            historicalData.value[key].push(reading);

            // Keep only last 100 readings
            if (historicalData.value[key].length > 100) {
                historicalData.value[key].shift();
            }
        }
    }

    function updateThreshold(sensorType, thresholdValues) {
        if (thresholds.value[sensorType]) {
            thresholds.value[sensorType] = {
                ...thresholds.value[sensorType],
                ...thresholdValues
            };
        }
    }

    function setRealtimeConnection(connected) {
        realtimeConnected.value = connected;
    }

    function clearHistoricalData(deviceId = null) {
        if (deviceId) {
            Object.keys(historicalData.value)
                .filter(key => key.startsWith(deviceId))
                .forEach(key => delete historicalData.value[key]);
        } else {
            historicalData.value = {};
        }
    }

    function clearError() {
        error.value = null;
    }

    // Statistics helpers
    const getStatistics = computed(() => (deviceId, range = '24h') => {
        const data = historicalData.value[`${deviceId}_${range}`];
        if (!data || data.length === 0) {
            return {
                min: 0,
                max: 0,
                avg: 0,
                count: 0
            };
        }

        const values = data.map(r => r.value);
        return {
            min: Math.min(...values),
            max: Math.max(...values),
            avg: values.reduce((sum, v) => sum + v, 0) / values.length,
            count: values.length
        };
    });

    // Export data to CSV
    function exportToCSV(deviceId, range = '24h') {
        const data = historicalData.value[`${deviceId}_${range}`];
        if (!data || data.length === 0) return null;

        const headers = ['Timestamp', 'Device ID', 'Value', 'Type', 'Status'];
        const rows = data.map(reading => [
            new Date(reading.timestamp).toISOString(),
            reading.deviceId,
            reading.value,
            reading.type,
            reading.status || 'normal'
        ]);

        const csv = [headers, ...rows]
            .map(row => row.join(','))
            .join('\n');

        return csv;
    }

    // Reset store
    function $reset() {
        sensorReadings.value = {};
        latestReadings.value = {};
        historicalData.value = {};
        loading.value = false;
        error.value = null;
        realtimeConnected.value = false;
    }

    return {
        // State
        sensorReadings,
        latestReadings,
        historicalData,
        loading,
        error,
        realtimeConnected,
        thresholds,

        // Getters
        getLatestReading,
        getHistoricalData,
        getSensorStatus,
        getAverageReading,
        getTrend,
        getStatistics,

        // Actions
        fetchLatestReadings,
        fetchHistoricalData,
        submitSensorReading,
        updateRealtimeReading,
        updateThreshold,
        setRealtimeConnection,
        clearHistoricalData,
        clearError,
        exportToCSV,
        $reset
    };
});