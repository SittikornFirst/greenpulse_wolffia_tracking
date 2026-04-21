# Wolffia IoT Tracking — System Documentation

## Project Overview

Wolffia is a full-stack IoT monitoring platform for hydroponic farming. ESP32 microcontrollers collect sensor readings (pH, EC, TDS, water temperature, air temperature, humidity, light intensity) and push data to a REST API. Farmers and administrators monitor their devices in real time through a Vue 3 SPA with WebSocket-based live updates.

```
ESP32 Sensors  ──POST /api/sensor-data──►  Express + MongoDB Backend
                                               │
                                        WebSocket (ws)
                                               │
                                    Vue 3 SPA (Vite + Pinia)
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Firmware | ESP32 (Arduino framework), WiFi, HTTPClient |
| Backend | Node.js, Express 5.1, Mongoose 8, JWT (jsonwebtoken), bcryptjs |
| Database | MongoDB (Atlas or local) |
| Real-time | WebSocket (ws library) |
| Frontend | Vue 3 (Composition API), Vite, Pinia, Vue Router 4 |
| Charts | Chart.js via vue-chartjs |
| Icons | lucide-vue-next |
| HTTP client | Axios (with interceptors) |

---

## Local Development Setup

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas connection string)

### Backend

```bash
cd wolffia_backend
cp .env.example .env   # fill in MONGODB_URI, JWT_SECRET, JWT_EXPIRE, PORT, CORS_ORIGIN
npm install
npm run dev            # nodemon server.js
```

Key environment variables:

| Variable | Example | Purpose |
|----------|---------|---------|
| `MONGODB_URI` | `mongodb://localhost:27017/wolffia` | Database connection |
| `JWT_SECRET` | `change-me-in-prod` | Token signing key |
| `JWT_EXPIRE` | `24h` | Token lifetime |
| `PORT` | `3000` | HTTP/WebSocket port |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed frontend origin |

### Frontend
```bash
cd wolffia_frontend
cp .env.example .env   # set VITE_API_BASE_URL=http://localhost:3000/api
npm install
npm run dev            # Vite dev server on http://localhost:5173
```

---

## Authentication & Authorization

### Flow

1. Client `POST /api/auth/login` with `{ email, password }`
2. Backend validates credentials, checks `is_active` and `is_deleted`, issues a JWT signed with `JWT_SECRET`
3. Frontend stores the token in `localStorage` via `useAuthStore` (Pinia)
4. Every subsequent request includes `Authorization: Bearer <token>` (injected by Axios request interceptor)
5. Backend `authenticate` middleware verifies the token on every protected route
6. On 401 response the Axios response interceptor clears localStorage and redirects to `/login`

### Roles

| Role | Access |
|------|--------|
| `farmer` | Own devices, own farm, own sensor data and alerts |
| `admin` | All users, all farms, all devices, system stats, user management |

### JWT Payload
```json
{ "userId": "<ObjectId>", "email": "...", "role": "farmer|admin" }
```

### Route Guards (Vue Router)
`router/index.js` `beforeEach` guard reads `auth_token` and `user_role` from `localStorage`:
- `meta.requiresAuth: true` — redirects unauthenticated users to `/login`
- `meta.requiresAdmin: true` — redirects non-admin users to `/dashboard`
- Already-authenticated users visiting `/login` or `/register` are redirected to `/dashboard`

---

## Backend API Reference

Base URL: `http://localhost:3000/api`

All routes except `/auth/register` and `/auth/login` require `Authorization: Bearer <token>`.

### Auth — `/api/auth`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/register` | No | Register new user (auto-creates farm for farmer role) |
| POST | `/login` | No | Login, returns JWT + user object |
| GET | `/me` | Yes | Get current authenticated user |
| POST | `/logout` | Yes | Server-side logout acknowledgement |

### Devices — `/api/devices`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List devices (farmers see only their own) |
| GET | `/:deviceId` | Get device by ID |
| POST | `/` | Create device |
| PUT | `/:deviceId` | Update device |
| DELETE | `/:deviceId` | Soft-delete device (`?hard=true` for permanent) |
| PATCH | `/:deviceId/status` | Update device status |
| PUT | `/:deviceId/configuration` | Update device configuration |
| PUT | `/:deviceId/relays/:relayId` | Update relay name or status |
| POST | `/:deviceId/schedules` | Add schedule |
| PUT | `/:deviceId/schedules/:scheduleId` | Update schedule |
| DELETE | `/:deviceId/schedules/:scheduleId` | Delete schedule |

### Sensor Data — `/api/sensor-data`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/` | Submit a sensor reading (used by ESP32) |
| GET | `/latest` | Latest reading from all devices |
| GET | `/:deviceId/latest` | Latest reading for one device |
| GET | `/:deviceId/history` | Paginated history (`range`, `startDate`, `endDate`, `page`, `limit`) |
| GET | `/:deviceId/range` | Readings between `startDate` and `endDate` |
| GET | `/:deviceId/aggregate` | Aggregated data (`aggregation=hourly`) |

### Alerts — `/api/alerts`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List alerts (paginated, filterable) |
| GET | `/unresolved` | All unresolved alerts |
| GET | `/device/:deviceId` | Alerts for a specific device |
| GET | `/:alertId` | Get single alert |
| POST | `/` | Create alert |
| PUT | `/:alertId` | Update alert |
| PATCH | `/:alertId/resolve` | Mark alert as resolved |
| DELETE | `/:alertId` | Delete alert |

### Farms — `/api/farms`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List farms |
| GET | `/:farmId` | Get farm |
| POST | `/` | Create farm |
| PUT | `/:farmId` | Update farm |
| DELETE | `/:farmId` | Soft-delete farm (`?hard=true` for permanent) |
| GET | `/:farmId/devices` | Devices belonging to farm |
| GET | `/:farmId/statistics` | Farm statistics |

### Analytics — `/api/analytics`

| Method | Path | Admin | Description |
|--------|------|-------|-------------|
| GET | `/dashboard` | No | Dashboard summary (`farmId` param optional) |
| GET | `/devices/:deviceId/performance` | No | Device performance (`timeRange` param) |
| GET | `/farms/:farmId/health` | No | Farm health score |
| GET | `/export` | No | Export data as file (blob) |
| GET | `/min-max/:deviceId` | No | Min/max sensor values |
| GET | `/admin/stats` | Yes | System-wide statistics |

### Users — `/api/users` (Admin only)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List all users |
| GET | `/:userId` | Get user |
| POST | `/` | Create user |
| PUT | `/:userId` | Update user |
| DELETE | `/:userId` | Soft-delete user (`?hard=true` for permanent) |
| PATCH | `/:userId/toggle-status` | Toggle `is_active` |

### System Logs — `/api/system-logs`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Paginated audit log entries |

---

## Data Models

### User
```
user_name, email, password (bcrypt), role (admin|farmer),
phone, is_active, is_deleted, last_login, created_at, updated_at
```

### Farm
```
farm_name, user_id → User, location, is_deleted, created_at, updated_at
```

### Device
```
device_id (unique, uppercase), user_id → User, farm_id → Farm,
config_id → DeviceConfiguration, device_name, location,
status (active|inactive|maintenance), last_activity, is_deleted
```

### SensorData
```
device_id, data_id (unique), timestamp,
ph_value, ec_value (µS/cm raw), tds_value,
water_temperature_c, air_temperature_c, air_humidity, light_intensity

Virtuals: ph, ec, tds, temperature_water_c, temperature_air_c
  → each returns { value, status: "normal" }
Note: ec_value > 20 is divided by 1000 at the API layer (µS/cm → mS/cm)
```

### Alert
```
alert_id (UUID), device_id, data_id → SensorData, user_id → User,
alert_type, parameter, threshold_value, actual_value, message,
severity (caution), status (active|acknowledged|resolved), resolved_at

Virtuals: id, type, resolved, resolvedAt, device, time
```

### DeviceConfiguration
```
Stores relay definitions, schedules, and sensor thresholds per device.
Referenced by Device.config_id.
```

### SystemLog
```
Audit trail written by auditLog() utility.
Fields: user_id, target_type, target_id, action_type, event, message, created_at
```

---

## Frontend Structure

```
wolffia_frontend/src/
├── main.js                   # App entry: Pinia → auth init → router → mount
├── App.vue                   # Root component
├── router/index.js           # Vue Router 4 with beforeEach auth guard
├── stores/module/
│   ├── auth.js               # Auth state: token, userName, userRole, login(), logout()
│   ├── devices.js            # Device CRUD + relay/schedule actions
│   ├── farms.js              # Farm CRUD
│   ├── alerts.js             # Alert list, resolve, polling
│   └── sensorData.js         # Readings, history, normalizeReading()
├── services/
│   ├── api.js                # Axios instance + all API methods
│   └── websocket.js          # WebSocket singleton (ws client)
├── composables/
│   └── useWebSocket.js       # Lifecycle wrapper: setup() / cleanup()
├── views/
│   ├── DashboardView.vue     # Main dashboard (farmer + admin layouts)
│   ├── DevicesView.vue
│   ├── DeviceDetailsView.vue
│   ├── AlertsView.vue
│   ├── AnalyticsView.vue
│   ├── FarmsView.vue / FarmDetailsView.vue
│   ├── SettingsView.vue
│   ├── ProfileView.vue
│   ├── SystemActivityView.vue
│   ├── UsersManagementView.vue  (admin only)
│   └── Auth/LoginView.vue / RegisterView.vue
├── components/
│   ├── Dashboard/MetricCard.vue
│   ├── Dashboard/ChartCard.vue  (Chart.js, time-range downsampling)
│   ├── Alerts/AlertItem.vue
│   └── Common/EmptyState.vue
└── utils/
    ├── thresholds.js
    └── sensorHelpers.js
```

### Pinia Stores

| Store | Key state | Key actions |
|-------|-----------|-------------|
| `auth` | `token`, `userName`, `userRole`, `isAuthenticated`, `isAdmin` | `login()`, `logout()`, `initFromStorage()` |
| `devices` | `devices`, `currentDevice` | `fetchDevices()`, `createDevice()`, `updateDevice()`, `deleteDevice()`, `toggleRelay()` |
| `farms` | `farms`, `currentFarm` | `fetchFarms()`, `createFarm()`, `updateFarm()` |
| `alerts` | `alerts`, `unresolvedCount` | `fetchAlerts()`, `resolveAlert()` |
| `sensorData` | `latestReadings`, `historicalData` | `fetchLatestReadings()`, `fetchHistoricalData()`, `normalizeReading()` |

---

## WebSocket Events

The server broadcasts events over WebSocket on the same port as HTTP. The frontend connects via `websocketService` singleton, wrapped by `useWebSocket` composable.

### Server → Client

| Event type | Payload | Trigger |
|-----------|---------|---------|
| `sensorReading` | Normalized SensorData object | New reading POSTed by ESP32 |
| `alert` | Alert object | Alert created |
| `deviceStatus` | `{ deviceId, status }` | Device status changed |
| `connected` | `{ message }` | WebSocket handshake complete |

### Client → Server

| Message type | Payload | Purpose |
|-------------|---------|---------|
| `subscribe` | `{ deviceId }` | Subscribe to readings for a specific device |
| `ping` | — | Keep-alive |

### Usage in a view
```js
const ws = useWebSocket();
await ws.setup({ autoConnect: true, subscribeToDevices: true });
// on unmount:
ws.cleanup();
```

---

## EC Value Unit Handling

Raw EC from ESP32 is in **µS/cm** (e.g., 1500). The display target is **mS/cm** (e.g., 1.5).

Conversion happens at **one place only** — the backend `sensorData` route `attachVirtualMetrics()`:
```js
if (alias === 'ec' && val > 20) val = val / 1000;
```

The frontend `normalizeReading()` in `sensorData.js` store applies the same heuristic as a safety net for readings that arrive via WebSocket. Do **not** divide `ec_value` again in components or computed properties.

---

## ESP32 Firmware Notes

The firmware runs on the ESP32 using the Arduino framework:

- Reads sensors over I2C / ADC at a configurable interval
- Connects to WiFi using credentials stored in flash
- POSTs JSON sensor readings to `POST /api/sensor-data`

Payload fields:
```json
{
  "device_id": "DEVICE-001",
  "data_id": "<uuid>",
  "ph_value": 6.8,
  "ec_value": 1500,
  "tds_value": 750,
  "water_temperature_c": 24.5,
  "air_temperature_c": 28.0,
  "air_humidity": 65.0,
  "light_intensity": 12000,
  "timestamp": "2026-04-21T10:00:00.000Z"
}
```

- On HTTP 401 the device retries after a backoff period
- OTA firmware updates are not yet implemented

---

## 5. Implementation

### 5.1 Hardware Implementation

The physical system is built around the ESP32 microcontroller as the central sensing and communication unit. The following hardware components are used:

| Component | Model / Spec | Interface | Purpose |
|-----------|-------------|-----------|---------|
| Microcontroller | ESP32 (38-pin DevKit) | — | WiFi connectivity, sensor orchestration |
| pH Sensor | Analog pH probe + signal board | ADC | Measure water pH (0–14) |
| EC / TDS Sensor | TDS-10 or similar | ADC | Measure electrical conductivity and total dissolved solids |
| Water Temperature | DS18B20 waterproof probe | 1-Wire | Measure nutrient solution temperature |
| Air Temperature & Humidity | DHT22 / SHT31 | Digital GPIO | Measure ambient conditions |
| Light Intensity | BH1750 or LDR circuit | I2C / ADC | Measure lux or raw light level |
| Relay Module | 4/8-channel 5 V relay board | GPIO | Control pumps, grow lights, fans |
| Power Supply | 5 V DC adapter | — | Power ESP32 and relay board |
| Enclosure | Waterproof junction box | — | Protect electronics from humidity |

**Wiring overview:**
- pH and EC/TDS signal boards output 0–3.3 V analog; connected to ESP32 ADC pins
- DS18B20 uses a single data line with 4.7 kΩ pull-up resistor to 3.3 V
- DHT22 / SHT31 connected to a GPIO pin with 10 kΩ pull-up
- BH1750 connected via I2C (SDA/SCL); address 0x23 (ADDR pin low)
- Relay control pins connected to ESP32 GPIO; relay common terminals wired to load circuits

---

### 5.2 Embedded Software Implementation

The firmware is written with the Arduino framework targeting the ESP32.

**Libraries used:**

| Library | Purpose |
|---------|---------|
| `WiFi.h` | WiFi station connection |
| `HTTPClient.h` | POST sensor readings to backend REST API |
| `ArduinoJson` | Serialize JSON payload |
| `OneWire` + `DallasTemperature` | DS18B20 water temperature |
| `DHT` or `Wire` + `BH1750` | Air temperature/humidity and light |

**Main loop flow:**

```
setup()
  ├── Connect to WiFi (retry with backoff)
  └── Initialize sensors

loop()
  ├── Read all sensors
  ├── Build JSON payload
  ├── POST to /api/sensor-data
  │     ├── 200 OK  → log success, sleep interval
  │     ├── 401     → clear stored token, retry after backoff
  │     └── other   → log error, sleep interval
  └── Check relay schedule (compare RTC / NTP time to configured schedules)
```

**Key configuration constants (defined in `config.h` or top of main sketch):**

```cpp
const char* WIFI_SSID     = "your-ssid";
const char* WIFI_PASSWORD = "your-password";
const char* API_BASE_URL  = "http://<server-ip>:3000/api";
const char* DEVICE_ID     = "DEVICE-001";
const int   SEND_INTERVAL = 30000; // ms between readings
```

EC / pH ADC calibration is applied in firmware before transmission (see §5.4).

---

### 5.3 Frontend / Backend Implementation

#### Backend (Express + MongoDB)

The backend is a Node.js REST API with a co-located WebSocket server.

**Startup sequence (`server.js`):**
1. Load `.env` via `dotenv`
2. Apply Express middleware: CORS, JSON body parser, Helmet (security headers), rate limiter
3. Register route modules under `/api/*`
4. Connect to MongoDB via Mongoose
5. Start HTTP server; attach `WebSocketServer` to the same port
6. WebSocket server authenticates clients via JWT query parameter on upgrade

**Sensor ingestion pipeline (`POST /api/sensor-data`):**
1. Validate `device_id` and required fields
2. Persist `SensorData` document to MongoDB
3. Run threshold checks against `DeviceConfiguration`; create `Alert` if any metric is out of range
4. Broadcast `sensorReading` event to all WebSocket clients subscribed to that device
5. Update `Device.last_activity`

**Authentication middleware (`middleware/auth.js`):**
- Extracts Bearer token from `Authorization` header
- Verifies JWT signature; rejects expired tokens
- Loads user from DB; rejects if `!is_active || is_deleted`
- Attaches `req.user` for downstream route handlers

#### Frontend (Vue 3 + Pinia)

**App bootstrap order (`main.js`):**
1. `createApp(App)` + `createPinia()` + `app.use(pinia)`
2. `useAuthStore().initFromStorage()` — restores JWT and role from `localStorage` before the router guard runs
3. `app.use(router)` — guard can now read authenticated state
4. `app.mount('#app')`

**Data flow for the Dashboard:**
1. `onMounted` fetches devices, latest sensor readings, and alerts in parallel via Pinia store actions
2. `useWebSocket().setup()` connects WebSocket and subscribes to all user devices
3. Incoming `sensorReading` events update the `sensorData` store → computed chart data re-renders automatically
4. `ChartCard.vue` receives an array of `{ x: timestamp, y: value }` points; performs client-side downsampling when the selected time range contains more points than pixels

**State management pattern:**
- All server state lives in Pinia stores; views only read from stores and call actions
- Auth state (`token`, `isAdmin`) is the single source of truth in `useAuthStore`; no component reads `localStorage` directly

---

### 5.4 Sensor Calibration

> **Note:** Fill in actual calibration values and procedures after hardware testing.

#### pH Sensor Calibration

| Field | Value |
|-------|-------|
| Calibration method | |
| Buffer solutions used | |
| pH 4.0 buffer — raw ADC voltage | |
| pH 7.0 buffer — raw ADC voltage | |
| pH 10.0 buffer — raw ADC voltage (optional) | |
| Calibration date | |
| Re-calibration interval | |
| Slope (mV/pH) | |
| Offset (mV at pH 7) | |
| Notes | |

#### EC / TDS Sensor Calibration

| Field | Value |
|-------|-------|
| Calibration method | |
| Reference solution concentration | |
| Reference solution — raw ADC voltage | |
| Cell constant (K) | |
| Calibration date | |
| Re-calibration interval | |
| Temperature compensation applied | |
| Notes | |

#### Water Temperature (DS18B20)

| Field | Value |
|-------|-------|
| Factory accuracy | ±0.5 °C |
| Verified against reference thermometer | |
| Offset correction applied (°C) | |
| Calibration date | |

#### Air Temperature & Humidity (DHT22 / SHT31)

| Field | Value |
|-------|-------|
| Factory accuracy (temperature) | ±0.5 °C |
| Factory accuracy (humidity) | ±2–5 % RH |
| Offset correction — temperature (°C) | |
| Offset correction — humidity (% RH) | |
| Calibration date | |

#### Light Intensity (BH1750 / LDR)

| Field | Value |
|-------|-------|
| Sensor type | |
| Unit reported | lux / raw ADC |
| Calibration reference | |
| Scaling factor applied | |
| Calibration date | |
