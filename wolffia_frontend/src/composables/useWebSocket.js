// composables/useWebSocket.js
import { ref, onMounted, onUnmounted } from 'vue';
import websocketService from '@/services/websocket';
import { useSensorDataStore } from '@/stores/module/sensorData';
import { useDevicesStore } from '@/stores/module/devices';
import { useAlertsStore } from '@/stores/module/alerts';

export function useWebSocket() {
    const connected = ref(false);
    const reconnecting = ref(false);
    const error = ref(null);

    const sensorDataStore = useSensorDataStore();
    const devicesStore = useDevicesStore();
    const alertsStore = useAlertsStore();

    // Event handlers
    const handleConnected = () => {
        connected.value = true;
        reconnecting.value = false;
        error.value = null;
        sensorDataStore.setRealtimeConnection(true);
        console.log('✅ WebSocket connected');
    };

    const handleDisconnected = () => {
        connected.value = false;
        reconnecting.value = true;
        sensorDataStore.setRealtimeConnection(false);
        console.log('❌ WebSocket disconnected');
    };

    const handleError = (err) => {
        error.value = err.message || 'WebSocket connection error';
        console.error('WebSocket error:', err);
    };

    const handleSensorReading = (reading) => {
        // Update sensor data store with new reading
        sensorDataStore.updateRealtimeReading(reading);
        console.log('📊 New sensor reading:', reading);
    };

    const handleAlert = (alert) => {
        // Add new alert to store
        alertsStore.addAlert(alert);

        // Optional: Show browser notification
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('New Alert', {
                body: alert.message,
                // icon: '/logo.png',
                // badge: '/badge.png'
            });
        }

        console.log('🚨 New alert:', alert);
    };

    const handleDeviceStatus = (status) => {
        // Update device status in store
        devicesStore.updateLocalDevice(status.deviceId, {
            status: status.status,
            lastUpdate: new Date().toISOString()
        });
        console.log('🔧 Device status update:', status);
    };

    // Subscribe to device updates
    const subscribeToDevice = (deviceId) => {
        if (!websocketService.isConnected()) {
            console.warn('WebSocket not connected, cannot subscribe to device');
            return false;
        }
        return websocketService.subscribeToDevice(deviceId);
    };

    const unsubscribeFromDevice = (deviceId) => {
        if (!websocketService.isConnected()) {
            return false;
        }
        return websocketService.unsubscribeFromDevice(deviceId);
    };

    // Subscribe to farm updates
    const subscribeToFarm = (farmId) => {
        if (!websocketService.isConnected()) {
            console.warn('WebSocket not connected, cannot subscribe to farm');
            return false;
        }
        return websocketService.subscribeToFarm(farmId);
    };

    const unsubscribeFromFarm = (farmId) => {
        if (!websocketService.isConnected()) {
            return false;
        }
        return websocketService.unsubscribeFromFarm(farmId);
    };

    // Connect to WebSocket
    const connect = async () => {
        const token = localStorage.getItem('auth_token');

        try {
            await websocketService.connect(token);
        } catch (err) {
            console.error('Failed to connect to WebSocket:', err);
            error.value = err.message;
        }
    };

    // Disconnect from WebSocket
    const disconnect = () => {
        websocketService.disconnect();
        connected.value = false;
    };

    // Send custom message
    const sendMessage = (type, data) => {
        return websocketService.send(type, data);
    };

    // Request notification permission
    const requestNotificationPermission = async () => {
        if (!('Notification' in window)) {
            console.warn('This browser does not support notifications');
            return false;
        }

        if (Notification.permission === 'granted') {
            return true;
        }

        if (Notification.permission !== 'denied') {
            const permission = await Notification.requestPermission();
            return permission === 'granted';
        }

        return false;
    };

    // Setup WebSocket connection and event listeners
    const setup = async (options = {}) => {
        const {
            autoConnect = true,
            subscribeToDevices = true,
            requestNotifications = false
        } = options;

        // Register event listeners
        websocketService.on('connected', handleConnected);
        websocketService.on('disconnected', handleDisconnected);
        websocketService.on('error', handleError);
        websocketService.on('sensorReading', handleSensorReading);
        websocketService.on('alert', handleAlert);
        websocketService.on('deviceStatus', handleDeviceStatus);

        // Auto-connect if enabled and not already connected
        if (autoConnect && !websocketService.isConnected()) {
            await connect();
        }

        // Subscribe to all devices if enabled and connected
        if (subscribeToDevices && websocketService.isConnected()) {
            const devices = devicesStore.devices;
            devices.forEach(device => {
                websocketService.subscribeToDevice(device.id);
            });
        }

        // Request notification permission
        if (requestNotifications) {
            await requestNotificationPermission();
        }
    };

    // Cleanup WebSocket connection and event listeners
    const cleanup = () => {
        websocketService.off('connected', handleConnected);
        websocketService.off('disconnected', handleDisconnected);
        websocketService.off('error', handleError);
        websocketService.off('sensorReading', handleSensorReading);
        websocketService.off('alert', handleAlert);
        websocketService.off('deviceStatus', handleDeviceStatus);

        disconnect();
    };

    return {
        // State
        connected,
        reconnecting,
        error,

        // Methods
        connect,
        disconnect,
        setup,
        cleanup,
        subscribeToDevice,
        unsubscribeFromDevice,
        subscribeToFarm,
        unsubscribeFromFarm,
        sendMessage,
        requestNotificationPermission,

        // Service reference
        service: websocketService
    };
}

// Auto-setup composable with lifecycle hooks
export function useWebSocketWithLifecycle(options = {}) {
    const ws = useWebSocket();

    onMounted(async () => {
        await ws.setup(options);
    });

    onUnmounted(() => {
        ws.cleanup();
    });

    return ws;
}