// services/websocket.js
class WebSocketService {
    constructor() {
        this.ws = null;
        this.listeners = new Map();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 3000;
        this.heartbeatInterval = null;
        this.isConnecting = false;
        this.shouldReconnect = true;
        this.reconnectTimeout = null;
    }

    connect(token) {
        // Prevent multiple simultaneous connection attempts
        if (this.isConnecting) {
            console.log('WebSocket connection already in progress');
            return Promise.resolve();
        }

        // If already connected, don't reconnect
        if (this.isConnected()) {
            console.log('WebSocket already connected');
            return Promise.resolve();
        }

        // Don't connect without token
        if (!token) {
            console.warn('Cannot connect WebSocket: No token provided');
            return Promise.reject(new Error('No authentication token'));
        }

        this.isConnecting = true;
        this.shouldReconnect = true;

        return new Promise((resolve, reject) => {
            try {
                // Close existing connection if any
                if (this.ws) {
                    this.ws.close();
                    this.ws = null;
                }

                const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3000/ws';
                this.ws = new WebSocket(wsUrl);

                this.ws.onopen = () => {
                    console.log('WebSocket connected');
                    this.isConnecting = false;
                    this.reconnectAttempts = 0;
                    this.startHeartbeat();

                    // Send authentication token
                    this.send('auth', { token });

                    this.emit('connected');
                    resolve();
                };

                this.ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        this.handleMessage(data);
                    } catch (error) {
                        console.error('WebSocket message parse error:', error);
                    }
                };

                this.ws.onerror = (error) => {
                    console.error('WebSocket error:', error);
                    this.isConnecting = false;
                    this.emit('error', error);
                    reject(error);
                };

                this.ws.onclose = (event) => {
                    console.log('WebSocket disconnected', event.code, event.reason);
                    this.isConnecting = false;
                    this.stopHeartbeat();
                    this.emit('disconnected');

                    // Only reconnect if we should and have a token
                    if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
                        const token = localStorage.getItem('auth_token');
                        if (token) {
                            this.reconnectTimeout = setTimeout(() => {
                                this.reconnectAttempts++;
                                console.log(`Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
                                this.connect(token).catch(err => {
                                    console.error('Reconnection failed:', err);
                                });
                            }, this.reconnectDelay);
                        }
                    } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                        console.error('Max reconnection attempts reached');
                        this.emit('maxReconnectAttemptsReached');
                    }
                };
            } catch (error) {
                this.isConnecting = false;
                reject(error);
            }
        });
    }

    handleMessage(data) {
        const { type, data: payload } = data;

        switch (type) {
            case 'sensorReading':
                this.emit('sensorReading', payload);
                break;
            case 'alert':
                this.emit('alert', payload);
                break;
            case 'deviceStatus':
                this.emit('deviceStatus', payload);
                break;
            case 'pong':
                // Heartbeat response
                break;
            default:
                this.emit(type, payload);
        }
    }

    send(type, data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type, data }));
        } else {
            console.warn('WebSocket not connected, cannot send:', type);
        }
    }

    subscribeToDevice(deviceId) {
        if (this.isConnected()) {
            this.send('subscribe', { deviceId });
        } else {
            console.warn('Cannot subscribe: WebSocket not connected');
        }
    }

    unsubscribeFromDevice(deviceId) {
        if (this.isConnected()) {
            this.send('unsubscribe', { deviceId });
        }
    }

    subscribeToFarm(farmId) {
        if (this.isConnected()) {
            this.send('subscribeFarm', { farmId });
        } else {
            console.warn('Cannot subscribe: WebSocket not connected');
        }
    }

    unsubscribeFromFarm(farmId) {
        if (this.isConnected()) {
            this.send('unsubscribeFarm', { farmId });
        }
    }

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    off(event, callback) {
        if (this.listeners.has(event)) {
            const callbacks = this.listeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in WebSocket listener for ${event}:`, error);
                }
            });
        }
    }

    startHeartbeat() {
        this.stopHeartbeat(); // Clear any existing heartbeat
        this.heartbeatInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.send('ping', {});
            }
        }, 30000); // Every 30 seconds
    }

    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    isConnected() {
        return this.ws && this.ws.readyState === WebSocket.OPEN;
    }

    disconnect() {
        this.shouldReconnect = false;
        this.isConnecting = false;

        // Clear reconnect timeout
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }

        this.stopHeartbeat();

        if (this.ws) {
            // Remove event listeners to prevent reconnect
            this.ws.onclose = null;
            this.ws.onerror = null;
            this.ws.close();
            this.ws = null;
        }

        // Don't clear listeners here - let components clean up their own
        // this.listeners.clear();
    }
}

const websocketService = new WebSocketService();
export default websocketService;