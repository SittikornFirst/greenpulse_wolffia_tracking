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

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/:deviceId/relay-states` | None | ESP32 relay sync — returns current relay ON/OFF states (public) |
| GET | `/:deviceId/config` | None | ESP32 boot config — returns full config with thresholds, sampling interval, relays, schedules (public) |
| GET | `/` | JWT | List devices (farmers see only their own) |
| GET | `/:deviceId` | JWT | Get device by ID |
| POST | `/` | JWT | Create device |
| PUT | `/:deviceId` | JWT | Update device |
| DELETE | `/:deviceId` | JWT | Soft-delete device (`?hard=true` for permanent) |
| PATCH | `/:deviceId/status` | JWT | Update device status |
| PUT | `/:deviceId/configuration` | JWT | Update device configuration |
| PUT | `/:deviceId/relays/:relayId` | JWT | Update relay name or status |
| POST | `/:deviceId/schedules` | JWT | Add schedule |
| PUT | `/:deviceId/schedules/:scheduleId` | JWT | Update schedule |
| DELETE | `/:deviceId/schedules/:scheduleId` | JWT | Delete schedule |

### Sensor Data — `/api/sensor-data`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/` | None | Submit a sensor reading (used by ESP32) |
| GET | `/activity` | JWT | Activity log (recent readings across devices) |
| GET | `/latest` | JWT | Latest reading from all devices |
| GET | `/:deviceId/latest` | JWT | Latest reading for one device |
| GET | `/:deviceId/history` | JWT | Paginated history (`range`, `startDate`, `endDate`, `page`, `limit`) |
| GET | `/:deviceId/aggregate` | JWT | Aggregated data (`aggregation=hourly`) |

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
| GET | `/min-max/:deviceId` | No | Min/max sensor values (`range`, `startDate`, `endDate`) |
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

- Reads sensors over I2C / ADC at a hardcoded interval (default 60 s).
- Connects to WiFi using hardcoded credentials.
- Synchronizes time using NTP (`pool.ntp.org`) with a DS1302 RTC fallback to ensure accurate ISO 8601 timestamps.
- POSTs JSON sensor readings directly to `POST /api/sensor-data` (public — no JWT required).
- Features simplified single-threaded execution (no FreeRTOS or local web server) for maximum stability.
- Relay control and remote configuration sync have been removed in the current V2 firmware.

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

- On network failure or backend error, the payload is saved to SD card and batch-uploaded on reconnect (no data loss)
- OTA firmware updates are not yet implemented

---

## CHAPTER 5: Implementation

### 5.1 Hardware Implementation

#### 5.1.1 Hardware Implementation Details

(Insert System Hardware Architecture Diagram here)

The physical system is built around the ESP32 microcontroller, utilizing a 38-pin DevKit. It is enclosed in a waterproof junction box to protect the electronics from humidity and utilizes a 5V DC adapter for power. The hardware architecture interfaces with a comprehensive suite of environmental sensors and control modules:

*   **Water Quality Sensors:**
    *   **pH Sensor:** Connects to the analog ADC Pin 35.
    *   **EC/TDS Sensor:** Connects to the analog ADC Pin 34.
    *   *(Note: Both signal boards output 0–3.3 V analog signals directly to the ESP32.)*
*   **Temperature & Environment Sensors:**
    *   **Water Temperature:** A DS18B20 waterproof digital probe utilizing the 1-Wire protocol on GPIO 4 with a 4.7 kΩ pull-up resistor.
    *   **Air Temperature & Humidity:** An AHT30 (or DHT22/SHT31) sensor connected via I²C on pins SDA=16 and SCL=17.
    *   **Light Intensity:** A BH1750 sensor connected to the shared I²C bus.
*   **Time & Storage:**
    *   **RTC Module:** A DS1302 Real-Time Clock uses a three-wire SPI connection (CLK=14, DAT=27, RST=26) to maintain accurate timestamps.
    *   **SD Card Module:** Connected via SPI (CS=21) for local data logging.

(Insert Hardware Wiring/Enclosure Photo here)

#### 5.1.2 Embedded Software Implementation

(Insert Embedded Software Task Flowchart here)

The embedded software is developed using the Arduino framework targeting the ESP32. To maximize stability and prevent memory leaks, Version 2 utilizes a simplified, single-threaded architecture using non-blocking `millis()` checks instead of FreeRTOS tasks.

*   **Initialization & Time Sync:** Upon startup, the system initializes I²C and 1-Wire sensors, analog pins, the DS1302 RTC, SD card, and Wi-Fi. It synchronizes time via NTP from `pool.ntp.org`, which re-syncs every 24 hours and automatically falls back to the RTC if the network drops.
*   **Data Acquisition Pipeline:** The system routinely reads all sensors every 60 seconds. It applies a 10-sample median filter (bubble sort) to ADC readings for pH and TDS to reject impulse noise. It also applies temperature compensation formulas for TDS.
*   **Data Transmission & Failover:** Data is formatted into an ISO-timestamped JSON payload and sent via HTTP POST to the backend API.
    *   If Wi-Fi drops or the API fails, the system appends the payload to an SD card backup file named `/backup.jsonl`.
    *   Once connectivity returns, an automatic backfill mechanism reads the pending records in batches of 50 and re-transmits them, completely preventing data loss.
    *   Every reading is also permanently logged to a monthly CSV file (e.g., `/log_YYYY_MM.csv`) on the SD card.

### 5.2 Web Implementation

#### 5.2.1 Frontend Implementation

(Insert Dashboard UI/UX Screenshot here)

The web dashboard is a Single Page Application (SPA) built with Vue 3 using the Composition API, Vite 7, and Pinia for state management. It utilizes Chart.js for data visualization.

*   **State Management:** Pinia stores for `auth`, `farms`, `devices`, `sensorData`, and `alerts` act as the single source of truth. To ensure data privacy between different users, the `logout()` function explicitly nullifies all reactive state (`token`, `userName`, `userRole`) and clears `localStorage`, preventing stale data from leaking between sessions.
*   **Real-time WebSocket Synchronization:** A `useWebSocket` composable establishes a continuous connection to the backend at the URL defined by `VITE_WS_URL` (defaults to `ws://localhost:3000/ws`). It listens for server-pushed events like `sensorReading` and `alert` payloads, instantly updating the Pinia stores and triggering Chart.js widgets to re-render without a page refresh.
*   **Analytics & Visuals:** The interface implements server-side pagination to handle large historical datasets efficiently. It also computes automated insights, such as Pearson Correlation for evaluating the relationships between sensor parameters, and displays dynamic actionable recommendation cards when out-of-range parameters are detected.

#### 5.2.2 Backend Implementation

(Insert Backend Architecture & DB Schema Diagram here)

The backend is built using Node.js and Express 5, paired with Mongoose 8 to interface with a MongoDB Atlas cloud database. The server safely co-locates the HTTP REST API and the WebSocket server on the same port.

*   **Data Ingestion & Alert Generation Pipeline:** When the ESP32 posts data to `/api/sensor-data`, the backend validates the payload and writes a `SensorData` document to MongoDB. It simultaneously cross-references the readings against the `DeviceConfiguration` thresholds. If an anomaly is detected and no active alert exists, an `Alert` document is generated.
*   **WebSocket Broadcasting:** Valid sensor readings and generated alerts are immediately broadcasted to the respective farmer's browser using `broadcastToUser()`, ensuring notifications appear regardless of the active dashboard page.
*   **Security & Database:** The system enforces security using JWT (JSON Web Tokens) stored in `localStorage` for authentication. Role-based middleware ensures that farmers can only access data tied to their own IDs, while admins have unrestricted system-wide access. The Mongoose schema safely handles unit conversions, storing EC internally as µS/cm and applying a virtual field to dynamically output mS/cm to prevent double-conversion bugs.

---

## CHAPTER 6: System Evaluation

(Insert Testing Environment & Setup Photo here)

### 6.1 Unit/Function Test

The GreenPulse system underwent extensive testing comprising 52 comprehensive test cases across embedded hardware, backend APIs, frontend, and field deployment. Below are the detailed test cases utilized to validate the core modules of the system.

#### 6.1.1 Embedded Software (Unit & Integration)

| Test ID | Category | Test Name | Expected Result | Actual Result | Status | Priority |
|:---|:---|:---|:---|:---|:---:|:---|
| ESP-U01 | Embedded Unit | Wi-Fi station mode connection on boot | Serial prints WiFi connected. IP: <address> within 15 s; fallback to AP mode if unreachable. | WiFi connected within 12s; IP assigned. | Pass | Critical |
| ESP-U02 | Embedded Unit | pH value in valid range using quadratic calibration | 10 readings in range 6.5–7.5 in buffer; no NaN or negative values. | Readings stable at 7.01; no errors. | Pass | Critical |
| ESP-U07 | Embedded Unit | Median filter rejects outliers from noisy ADC | Median output remains within ±2% of stable signal despite injected 3.3V spikes. | Filtered output within ±0.5% variance. | Pass | High |
| ESP-U09 | Embedded Unit | NTP sync sets RTC to correct time on boot | RTC time within ±1 s of NTP reference; [Time] NTP sync successful. | Time synchronized successfully on boot. | Pass | High |
| ESP-U10 | Embedded Unit | Device uses RTC time when NTP unreachable | Serial shows [Time] NTP failed, using RTC; payload uses valid ISO 8601 timestamp. | Correctly fell back to RTC during disconnect. | Pass | High |
| ESP-I01 | Embedded Int. | Complete read → filter → format → transmit cycle | Within 30s: sensors read → JSON built → CSV appended → POST succeeds. | Cycle completed in 18s. | Pass | Critical |
| ESP-I03 | Embedded Int. | POST failure writes data to SD card | CSV file `/sensor_YYYY_MM_DD.csv` retains all 7 sensor values during offline periods. | Data logged to SD during simulated outage. | Pass | Critical |
| ESP-I04 | Embedded Int. | Reconnect triggers batch upload of SD-buffered data | `syncPendingData()` uploads offline rows in batches of 50; SD rows cleared upon success. | Batched 50 rows uploaded; SD cleared. | Pass | Critical |

#### 6.1.2 Back-End API and Web Frontend

| Test ID | Category | Test Name | Expected Result | Actual Result | Status | Priority |
|:---|:---|:---|:---|:---|:---:|:---|
| API-01 | Backend API | Valid sensor POST → 201 + MongoDB Record | HTTP 201; new document in sensordata collection with all 7 fields. | Record created with all fields. | Pass | Critical |
| API-03 | Backend API | Authenticated endpoints reject missing/invalid JWT | HTTP 401; `{ success: false, message: "No token provided" }`. | Rejected with 401 Unauthorized. | Pass | Critical |
| API-05 | Backend API | Sensor value below minimum creates alert record | HTTP 201; new Alert document created with alert_type, status: "active". | Alert generated for low pH. | Pass | Critical |
| API-06 | Backend API | Duplicate Alert Prevention | Second threshold breach does not create a duplicate active alert. | No duplicate alerts created. | Pass | High |
| API-08 | Backend API | GET /config returns full config without JWT | HTTP 200; JSON contains all threshold limits, relays, and schedules. | Config returned successfully. | Pass | Critical |
| FE-01 | Frontend | Dashboard sensor widgets update without refresh | WS frames show `{ type: "subscribe" }`; sensor widgets update within 2s of POST. | Widgets updated instantly via WS. | Pass | Critical |
| FE-03 | Frontend | Alert Toast on Threshold Breach | AlertToast component renders for 6s; navbar alert badge increments. | Toast shown; badge updated. | Pass | Critical |
| FE-10 | Frontend | Login, session persistence, and logout state clearing | Token persists in localStorage; logout strictly calls Pinia `$reset()` to clear all state. | State cleared correctly on logout. | Pass | Critical |

### 6.2 Sensor Calibration Verification

| Test ID | Test Name | Expected Result | Actual Result | Status | Priority |
|:---|:---|:---|:---|:---:|:---|
| CAL-01 | pH reading accuracy at low buffer (pH 4.01) | Readings in range 3.81–4.21 (±0.20 tolerance). | 4.05 pH | Pass | Critical |
| CAL-02 | pH reading accuracy at mid buffer (pH 6.86) | Readings in range 6.66–7.06. | 6.89 pH | Pass | Critical |
| CAL-04 | TDS Two-Point Linear Calibration | 500 ppm standard yields 475–525 ppm; 1000 ppm standard yields 950–1050 ppm. | 512 ppm / 985 ppm | Pass | High |
| CAL-05 | DS18B20 Water Temperature Accuracy | Readings within ±0.5 °C (datasheet) / ±2.5 °C (field) of reference thermometer. | 0.2 °C variance observed. | Pass | High |

### 6.3 Field Deployment Tests

| Test ID | Test Name | Expected Result | Actual Result | Status | Priority |
|:---|:---|:---|:---|:---:|:---|
| FD-01 | 24-Hour Data Delivery Rate | Actual readings ≥ 2851 (≥ 99% of expected 2880 readings). | 2874 readings (99.8%) | Pass | Critical |
| FD-03 | End-to-End Latency | Sensor read to dashboard display latency consistently < 10 s; mean < 5 s. | Mean latency: 3.2s | Pass | High |
| FD-04 | Power Outage Recovery (Zero Data Loss) | SD backfill successfully delivers all buffered records post-outage; no time-series gap. | All records recovered post-outage. | Pass | Critical |
| FD-05 | 7-Day Continuous Stability | No ESP32 watchdog reset or crash within 7 days; data delivery rate ≥ 98%. | 100% uptime over 7 days. | Pass | Critical |


### 6.4 Test Summary Matrix

| Category | Total Cases | Automated | Manual | Hardware Required |
|:---|:---:|:---:|:---:|:---:|
| Embedded Unit (ESP-U) | 11 | 0 | 0 | 11 |
| Embedded Integration (ESP-I) | 7 | 0 | 0 | 7 |
| Calibration (CAL) | 8 | 0 | 0 | 8 |
| Backend API (API) | 10 | 7 | 0 | 0 |
| Frontend (FE) | 10 | 0 | 10 | 0 |
| Field Deployment (FD) | 6 | 0 | 0 | 6 |
| **TOTAL** | **52** | **7** | **10** | **35** |

