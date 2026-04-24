# Software Architecture Document
## GreenPulse: IoT-Based System for Tracking Environmental Factors in Wolffia Cultivation

| Field | Value |
|---|---|
| Document Type | Software Architecture Document (SAD) |
| Version | 1.0 |
| Date | 2026-04-24 |
| Author | Sittikorn (First) |
| Status | Final |

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Embedded System Architecture](#2-embedded-system-architecture)
   - 2.1 Microcontroller Unit
   - 2.2 Sensor Suite
   - 2.3 Data Acquisition & Processing Pipeline
   - 2.4 Communication Architecture
   - 2.5 Offline Resilience & SD Failover
   - 2.6 Functional Modules
3. [Web Application Architecture](#3-web-application-architecture)
   - 3.1 Frontend
   - 3.2 Backend
   - 3.3 Database
   - 3.4 Functional Modules
4. [Data Flow Diagrams](#4-data-flow-diagrams)
   - 4.1 Normal Operation Flow
   - 4.2 Offline Failover Flow
   - 4.3 Alert Generation Flow
   - 4.4 Device Configuration Sync Flow
5. [Database Schema](#5-database-schema)
6. [Deployment Architecture](#6-deployment-architecture)
7. [API Specification](#7-api-specification)
8. [Security Architecture](#8-security-architecture)
9. [Key Design Decisions](#9-key-design-decisions)

---

## 1. System Overview

GreenPulse is an end-to-end IoT monitoring platform designed for **Wolffia globosa** (duckweed) hydroponic cultivation. The system continuously measures six environmental parameters critical to Wolffia growth, stores them in a cloud database, and presents real-time and historical data through a web dashboard accessible to farmers and system administrators.

### 1.1 Primary Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        FARM SITE                                │
│                                                                 │
│   [pH Probe]  [EC/TDS]  [DS18B20]  [AHT30]  [BH1750]          │
│        └──────────┴──────────┴────────┴───────┘                 │
│                           │                                     │
│                    ┌──────▼──────┐                              │
│                    │    ESP32    │  ← DS1302 RTC, SD Card       │
│                    │ GreenPulse  │                              │
│                    └──────┬──────┘                              │
│                           │ Wi-Fi / HTTP POST                   │
└───────────────────────────┼─────────────────────────────────────┘
                            │
                   ┌────────▼────────┐
                   │  Cloud Backend  │
                   │ Node.js/Express │
                   │  + WebSocket    │
                   └────────┬────────┘
                            │
                   ┌────────▼────────┐
                   │    MongoDB      │
                   │  Atlas (cloud)  │
                   └────────┬────────┘
                            │
                   ┌────────▼────────┐
                   │  Vue 3 Web App  │
                   │   (Farmer UI)   │
                   └─────────────────┘
```

### 1.2 Monitored Parameters

| Parameter | Sensor | Range | Target for Wolffia |
|---|---|---|---|
| pH | ADC (Pin 35) | 0–14 | 6.5–7.5 |
| EC (Electrical Conductivity) | ADC (Pin 34) | 0–5 mS/cm | 1.0–2.5 mS/cm |
| TDS (Total Dissolved Solids) | Derived from EC | 0–2500 ppm | 500–1250 ppm |
| Water Temperature | DS18B20 (Pin 4) | −55–125 °C | 20–28 °C |
| Air Temperature | AHT30 (I²C) | −40–85 °C | 18–35 °C |
| Air Humidity | AHT30 (I²C) | 0–100 %RH | 50–80 %RH |
| Light Intensity | BH1750 (I²C) | 1–65535 lux | 3500–6000 lux |

---

## 2. Embedded System Architecture

### 2.1 Microcontroller Unit

**Hardware:** ESP32 (dual-core Xtensa LX6, 240 MHz, 520 KB SRAM, Wi-Fi 802.11 b/g/n)

| Pin | Assignment |
|---|---|
| GPIO 35 | pH sensor analog input (ADC1_CH7) |
| GPIO 34 | EC/TDS sensor analog input (ADC1_CH6) |
| GPIO 4  | DS18B20 OneWire data |
| GPIO 16 | I²C SDA (AHT30, BH1750) |
| GPIO 17 | I²C SCL (AHT30, BH1750) |
| GPIO 14 | DS1302 RTC CLK |
| GPIO 27 | DS1302 RTC DAT |
| GPIO 26 | DS1302 RTC RST |
| GPIO 21 | SD card CS (SPI) |
| GPIO 18 | SPI SCK |
| GPIO 19 | SPI MISO |
| GPIO 23 | SPI MOSI |
| GPIO 25 | Relay 0 — Air Pump (active-LOW) |
| GPIO 32 | Relay 1 — Grow Light (active-LOW) |

**FreeRTOS Task Layout:**

| Task | Core | Priority | Stack | Responsibility |
|---|---|---|---|---|
| `sensorTask` | Core 1 | 1 | 8 KB | Sensor reads, HTTP POST, relay sync |
| `phTDSScheduleTask` | Core 1 | 2 | 8 KB | Time-based pH/TDS schedule enforcement |

Shared resources are protected with four semaphores: `sensorMutex`, `phTDSScheduleMutex`, `sdMutex`, `dataLogMutex`.

---

### 2.2 Sensor Suite

#### 2.2.1 pH Sensor — Quadratic Calibration

The ADC output voltage is converted to pH using a three-point quadratic model fitted to buffer standards (pH 4.01, 6.86, 9.18):

```
pH = aV² + bV + c
   = −0.0563 V² − 5.9038 V + 13.8161
```

Where V is the measured voltage in volts.

| Calibration Parameter | Value |
|---|---|
| Coefficient a | −0.0562836215 |
| Coefficient b | −5.903839 |
| Coefficient c | 13.816135 |
| Fit Quality (R²) | 0.9987 |

Sampling uses **median filtering** over 40 ADC readings to reject impulse noise. Results are stored in µS/cm internally and converted for display.

#### 2.2.2 EC/TDS Sensor — Two-Point Linear Calibration

```
TDS_ppm = V_compensated × k
EC_mS/cm = TDS_ppm / 500
```

Temperature compensation is applied:
```
V_compensated = V_raw / (1.0 + 0.02 × (T_water − 25.0))
```

#### 2.2.3 DS18B20 — Water Temperature

- Protocol: OneWire (GPIO 4)
- Accuracy: ±0.5 °C (datasheet), ±2.5 °C field-verified
- Fallback: if sensor unavailable, uses `ds18b20FallbackTempC = 25.0 °C` for TDS compensation

#### 2.2.4 AHT30 — Air Temperature & Humidity

- Protocol: I²C (SDA=16, SCL=17)
- Air temp accuracy: ±0.3 °C
- Humidity accuracy: ±2 %RH

#### 2.2.5 BH1750 — Light Intensity

- Protocol: I²C shared bus
- Mode: `CONTINUOUS_HIGH_RES_MODE`
- Accuracy: ±20% vs reference meter

#### 2.2.6 DS1302 — Real-Time Clock

- Protocol: Three-wire SPI (CLK=14, DAT=27, RST=26)
- Primary time source: NTP (`pool.ntp.org`, GMT+7, re-synced every 24 h)
- Fallback: last valid RTC time if NTP unavailable
- Timestamps emitted as ISO 8601 with `+07:00` offset

---

### 2.3 Data Acquisition & Processing Pipeline

```
Power On
   │
   ├─ initSensors()     Wire.begin, AHT30, BH1750, DS18B20
   ├─ initRTC()         DS1302 start, validate year ≥ 2024
   ├─ initSDCard()      SPI.begin, SD.begin, create /synced/
   ├─ initWiFi()        Connect or AP mode fallback
   ├─ initTime()        NTP sync → write to RTC
   ├─ fetchDeviceConfig() GET /api/devices/:id/config (public, no JWT)
   │     └─ Apply: thresholds, sampling_interval, relay states, schedules
   └─ setupWebServer()  AsyncWebServer on port 80
         └─ Start FreeRTOS tasks

sensorTask() loop (every cfg_sampling_interval_ms, default 30 s):
   │
   ├─ readSensors()
   │     ├─ 40× ADC reads → sort → median → voltage → pH/EC/TDS
   │     ├─ DS18B20 temperature
   │     ├─ AHT30 air temp + humidity
   │     └─ BH1750 light lux
   │
   ├─ Build JSON payload
   │     { device_id, ph_value, water_temperature_c, air_temperature_c,
   │       ec_value (µS/cm), tds_value (ppm), light_intensity (lux),
   │       air_humidity, timestamp (ISO8601), created_at }
   │
   ├─ logSensorDataToSD()    always — append to /sensor_YYYY_MM_DD.csv
   │
   ├─ if WiFi connected:
   │     sendToBackend() → POST /api/sensor-data
   │          success → totalSentToMongo++
   │          failure → data already on SD (no extra action needed)
   │
   ├─ syncPendingData()      backfill unsent SD rows (batches of 50)
   │
   ├─ if 30 s elapsed:  fetchAndApplyRelayStates()  (live UI toggle sync)
   └─ if 60 s elapsed:  checkRelaySchedules()        (time-based relay)
```

#### JSON Payload Structure

```json
{
  "device_id": "GREENPULSE-V1-MKUMW0RG-1JS0A",
  "ph_value": 7.04,
  "water_temperature_c": 28.94,
  "air_temperature_c": 32.98,
  "ec_value": 1127.82,
  "tds_value": 563.91,
  "light_intensity": 437.5,
  "air_humidity": 62.54,
  "timestamp": "2026-04-21T12:19:33.000+07:00",
  "created_at": "2026-04-21T12:19:33.000+07:00"
}
```

> **Note:** `ec_value` is stored internally as µS/cm. The backend model includes a virtual field that auto-converts to mS/cm for display (`ec_value / 1000`).

---

### 2.4 Communication Architecture

#### HTTP REST (primary)

| Direction | Endpoint | Method | Auth | Purpose |
|---|---|---|---|---|
| ESP32 → Backend | `/api/sensor-data` | POST | None | Submit sensor reading |
| ESP32 → Backend | `/api/devices/:id/relay-states` | GET | None | Poll relay ON/OFF states |
| ESP32 → Backend | `/api/devices/:id/config` | GET | None | Fetch full config on boot |

All backend calls use `HTTPClient` with an 8–10 s timeout. On HTTP error, data is retained on the SD card for later backfill.

#### Local Web Interface (AsyncWebServer port 80)

| Endpoint | Method | Purpose |
|---|---|---|
| `/` | GET | Embedded HTML dashboard |
| `/relay/airPump` | POST | Immediate toggle GPIO 25 |
| `/relay/light` | POST | Immediate toggle GPIO 32 |
| `/relay/status` | GET | Return current relay states |

---

### 2.5 Offline Resilience & SD Failover

```
Normal:     ESP32 ──POST──► Backend ──► MongoDB
                  └──CSV──► SD card (always)

Offline:    ESP32 ──CSV──► SD card (/sensor_YYYY_MM_DD.csv)
                                         │
                  (WiFi restored)         │
                                         ▼
            ESP32 ──batch of 50──► Backend ──► MongoDB
                  ──rewrite SD (remove synced rows)
```

- SD files use daily rotation: `/sensor_YYYY_MM_DD.csv`
- Successfully synced files are moved to `/synced/` folder
- Maximum 7 days of rolling logs retained
- Backfill sends in batches of 50 rows to avoid memory overflow

---

### 2.6 Functional Modules

| Module | Responsibilities |
|---|---|
| **Sensor Management** | Hardware init, ADC sampling, median filtering, calibration equation application, temperature compensation |
| **Data Processing** | JSON payload construction, ISO timestamp generation, unique `data_id` assignment |
| **Communication Management** | HTTP POST to backend, relay-states poll, config fetch on boot, local AsyncWebServer |
| **Device Maintenance** | SD card logging, backfill sync, Wi-Fi auto-reconnect, NTP 24 h re-sync, relay schedule enforcement |

---

## 3. Web Application Architecture

### 3.1 Frontend

**Technology:** Vue 3 (Composition API), Vite 7, Pinia, Vue Router, Chart.js, Lucide Icons

#### Component Hierarchy

```
App.vue
└── DefaultLayout.vue          (sidebar, notifications bell, logout)
    ├── DashboardView.vue       (farm overview, live sensor widgets)
    ├── DevicesView.vue         (device list, add device modal)
    ├── DeviceDetailsView.vue   (thresholds config, relay control, log table)
    │   ├── RelayControl.vue    (toggle switches per relay)
    │   └── ScheduleManager.vue (time-based relay schedules)
    ├── AnalyticsView.vue       (time-series charts, recommendations, Pearson correlation)
    ├── AlertsView.vue          (alert list, acknowledge/resolve)
    ├── FarmsView.vue
    ├── FarmDetailsView.vue
    ├── UsersManagementView.vue (admin only)
    ├── SystemActivityView.vue  (admin only)
    ├── ProfileView.vue
    └── SettingsView.vue
```

#### State Management (Pinia Stores)

| Store | State | Key Actions |
|---|---|---|
| `auth` | token, userName, userRole | `login()`, `logout()`, `initFromStorage()` |
| `farms` | farms[], selectedFarmId | `fetchFarms()`, `selectFarm()`, `$reset()` |
| `devices` | devices[], pagination | `fetchDevices()`, `addDevice()`, `$reset()` |
| `sensorData` | latestReadings{}, historicalData{} | `fetchLatestReadings()`, `fetchHistoricalData()`, `$reset()` |
| `alerts` | alerts[], unreadCount | `fetchAlerts()`, `resolveAlert()`, `$reset()` |

> **Important:** `logout()` calls `$reset()` on all stores to prevent stale `selectedFarmId` persisting across user sessions.

#### Real-time WebSocket Client

`useWebSocket` composable connects to `ws://backend:3000/ws`:

```
Client → Server:  { type: "auth",      data: { token } }
Client → Server:  { type: "subscribe", deviceId: "..." }
Server → Client:  { type: "sensorReading", data: {...} }
Server → Client:  { type: "alert",         data: {...} }
Server → Client:  { type: "deviceStatus",  data: { deviceId, status } }
Server → Client:  { type: "connected" }
```

Alert toasts use `broadcastToUser(userId, ...)` so the farmer receives alerts regardless of which page is open (not device-channel broadcasts which require active subscription).

#### Analytics Features

- **Pagination:** Server-side with page/limit params; custom prev/next/ellipsis UI; DataTable internal pagination disabled
- **Recommendations:** Evaluates 6-parameter averages against `THRESHOLDS`; generates critical/warning cards with actionable advice
- **Pearson Correlation:** Computes r for 6 sensor pairs; ranked by |r|; colour-coded bars + insight text

---

### 3.2 Backend

**Technology:** Node.js, Express 5, Mongoose, WebSocket (`ws` library), JWT, Helmet, CORS, rate-limiting

#### Directory Structure

```
wolffia_backend/
├── server.js               Entry point — Express + WebSocket + MongoDB init
├── routes/
│   ├── auth.js             Login, register, logout, /me
│   ├── devices.js          Device CRUD + relay states + schedules + config
│   ├── sensorData.js       POST ingestion + history + latest + analytics
│   ├── alerts.js           Alert CRUD + acknowledge + resolve
│   ├── farms.js            Farm CRUD (1 farm per farmer)
│   ├── analytics.js        Dashboard stats, min/max, admin stats
│   ├── users.js            Admin user management
│   └── system-logs.js      Audit log retrieval
├── models/
│   ├── User.js
│   ├── Farm.js
│   ├── Device.js
│   ├── SensorData.js       (with EC virtual field: µS/cm → mS/cm)
│   ├── Alert.js
│   ├── DeviceConfiguration.js
│   └── SystemLog.js
├── middleware/
│   └── auth.js             JWT verify, role-based guard
└── utils/
    └── logger.js           auditLog() helper
```

#### Alert Generation (in `sensorData.js`)

On every POST to `/api/sensor-data`:
1. Look up `DeviceConfiguration` for the device
2. Compare each sensor value to min/max thresholds
3. If threshold exceeded and **no active alert of the same type exists** for that device → create Alert document
4. `broadcastToUser(device.user_id, { type: "alert", data: alert })` → pushes to farmer's browser in real time

---

### 3.3 Database

**Technology:** MongoDB Atlas (cloud), Mongoose ODM

#### Collections

| Collection | Documents | Purpose |
|---|---|---|
| `users` | User accounts | Auth, role, profile |
| `farms` | Farm records | Geographic/naming context for devices |
| `devices` | Device records | Maps `device_id` string to owner + config |
| `sensordata` | Sensor readings | Time-series measurements (4 800+ records) |
| `alerts` | Alert events | Threshold breach events with lifecycle status |
| `deviceconfigurations` | Per-device config | Thresholds, sampling interval, relays, schedules |
| `systemlogs` | Audit logs | Admin-visible action history |

#### Entity Relationships

```
User ──(1:M)──► Farm
User ──(1:M)──► Device
Farm ──(1:0..1)► Device
Device ──(1:1)──► DeviceConfiguration
Device ──(1:M)──► SensorData
Device ──(1:0..M)► Alert
Device ──(1:0..M)► SystemLog
```

---

### 3.4 Functional Modules

| Module | Components | Responsibilities |
|---|---|---|
| **Data Ingestion & Storage** | `POST /api/sensor-data`, SensorData model, threshold checker | Receive, validate, store readings; trigger alerts |
| **User Management** | `routes/auth.js`, `routes/users.js`, auth store | Registration, login, JWT issue, role-based access |
| **Device Management** | `routes/devices.js`, DeviceConfiguration model | Device CRUD, relay control, schedule management, public config endpoint |
| **API & Backend Services** | Express router, middleware | JWT auth, rate limiting, CORS, error handling |
| **Front-End Visualization** | Vue views, Pinia stores, Chart.js | Dashboard, analytics, alerts, device config UI |
| **System Maintenance** | `routes/system-logs.js`, `utils/logger.js` | Audit logging, admin monitoring |

---

## 4. Data Flow Diagrams

### 4.1 Normal Operation Flow

```
[Sensor Hardware]
      │  ADC/I²C/OneWire reads (40 samples, median filter)
      ▼
[ESP32 Processing]
      │  Calibration equations → JSON payload + ISO timestamp + UUID
      ▼
[SD Card]  ◄──── always logged to /sensor_YYYY_MM_DD.csv
      │
[HTTP POST /api/sensor-data]
      │
[Express Backend]
      ├── Validate payload
      ├── Save SensorData document (MongoDB)
      ├── Check thresholds vs DeviceConfiguration
      │       └── if breach → create Alert → broadcastToUser()
      └── broadcastToDevice() sensorReading event
              │
         [WebSocket]
              │
      [Vue 3 Dashboard]
              └── Pinia sensorData store → reactive UI update
```

### 4.2 Offline Failover Flow

```
[ESP32]  ── POST fails (no Wi-Fi / backend down) ──►  [SD Card]
                                                       /sensor_YYYY_MM_DD.csv
                                                       (append CSV row)

[ESP32]  ── Wi-Fi restored ──►  syncPendingData()
              │
              │  read 50 rows from SD
              ├──► POST /api/sensor-data (batch)
              │         success → remove sent rows from SD
              │         failure → retry next cycle
              └──► move fully-synced daily file to /synced/
```

### 4.3 Alert Generation Flow

```
[ESP32] POST /api/sensor-data { ph_value: 4.5 }
              │
[Backend: sensorData.js]
      ├── fetch DeviceConfiguration (ph_min: 6.0)
      ├── 4.5 < 6.0 → threshold breached
      ├── query: active ph_value_low alert for this device?
      │       NO  → create Alert { alert_type:"ph_value_low", status:"active" }
      │       YES → skip (no duplicate)
      └── broadcastToUser(farmer_id, { type:"alert", data:alertDoc })
                    │
             [WebSocket push]
                    │
          [Vue AlertToast component]
                    └── toast visible 6 s, then auto-dismiss
                        Alert count badge +1 in navbar
```

### 4.4 Device Configuration Sync Flow (ESP32 Boot)

```
[ESP32 boots] ── Wi-Fi connected ──► fetchDeviceConfig()
      │
      │  GET /api/devices/:deviceId/config  (no JWT required)
      │
[Backend returns]
      { sampling_interval, ph_min/max, ec_min/max,
        water_temp_min/max, air_temp_min/max, light_min/max,
        relays:[{relay_id, pin, status}],
        schedules:[{days, startHour, stopHour, relays}] }
      │
[ESP32 applies]
      ├── cfg_sampling_interval_ms  ← sampling_interval × 1000
      ├── cfg_ph_min/max, cfg_ec_min/max, …  ← threshold globals
      ├── setRelay(pin, status) for each relay
      └── relaySchedules[] ← parsed schedule objects
              │
      [checkRelaySchedules() every 60 s]
              └── compare RTC time → fire setRelay() at start/stop
```

---

## 5. Database Schema

### DeviceConfiguration (key collection)

```javascript
{
  device_id: ObjectId,        // ref: Device
  alert_enabled: Boolean,     // default: true
  sampling_interval: Number,  // seconds, min: 1
  ph_min: Number,             // default: 6.0
  ph_max: Number,             // default: 7.5
  ec_value_min: Number,       // mS/cm, default: 1.0
  ec_value_max: Number,       // mS/cm, default: 2.5
  water_temp_min: Number,     // °C, default: 20
  water_temp_max: Number,     // °C, default: 28
  air_temp_min: Number,       // °C, default: 18
  air_temp_max: Number,       // °C, default: 35
  light_intensity_min: Number,// lux, default: 3500
  light_intensity_max: Number,// lux, default: 6000
  relays: [{
    relay_id: Number,         // 0 or 1
    name: String,             // e.g. "Air Pump"
    status: Boolean,          // true = ON
    pin: Number               // GPIO pin
  }],
  schedules: [{
    schedule_id: String,      // UUID
    relays: [Number],         // relay_ids to control
    days: [Number],           // 0=Sun … 6=Sat
    startHour: Number,
    startMinute: Number,
    stopHour: Number,
    stopMinute: Number,
    enabled: Boolean
  }]
}
```

### SensorData

```javascript
{
  device_id: String,           // e.g. "GREENPULSE-V1-MKUMW0RG-1JS0A"
  data_id: String,             // UUID v4
  timestamp: Date,             // from ESP32 ISO string
  ph_value: Number,
  ec_value: Number,            // stored as µS/cm
  tds_value: Number,           // ppm
  water_temperature_c: Number,
  air_temperature_c: Number,
  air_humidity: Number,        // %RH
  light_intensity: Number,     // lux
  created_at: Date
  // Virtual fields (auto-computed):
  // ec.value  = ec_value / 1000  (mS/cm for display)
}
```

### Alert

```javascript
{
  alert_id: String,            // UUID v4
  device_id: String,           // ref: Device (by device_id string)
  data_id: String,             // ref: SensorData (UUID of the reading that triggered the alert)
  user_id: ObjectId,           // ref: User (device owner)
  alert_type: String,          // "ph_value_low" | "ph_value_high" | "ec_value_low" | …
  parameter: String,           // "ph_value" | "ec_value" | "water_temperature_c" | …
  threshold_value: Number,     // the min/max that was exceeded
  actual_value: Number,        // actual measured value
  message: String,
  severity: String,            // enum: ["caution"] — single severity level
  status: String,              // "active" → "acknowledged" → "resolved"
  resolved_at: Date            // set only when status = "resolved"
}
```

---

## 6. Deployment Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    FARM SITE                             │
│                                                          │
│  ┌─────────────────┐     ┌──────────────────────┐        │
│  │  GreenPulse     │     │  Local Web Interface  │        │
│  │  ESP32 Node     │────►│  AsyncWebServer :80   │        │
│  │  (per basin)    │     │  (same-LAN access)    │        │
│  └────────┬────────┘     └──────────────────────┘        │
│           │ Wi-Fi (2.4 GHz)                              │
└───────────┼──────────────────────────────────────────────┘
            │
            │ HTTPS (TLS)
            ▼
┌──────────────────────────────────────────────────────────┐
│                   CLOUD (Render.com)                     │
│                                                          │
│  ┌─────────────────────────────────────────────────┐     │
│  │         Node.js / Express  (port 3000)          │     │
│  │  ┌──────────────┐  ┌────────────────────────┐   │     │
│  │  │  REST API    │  │  WebSocket Server (/ws) │   │     │
│  │  └──────┬───────┘  └───────────┬────────────┘   │     │
│  └─────────┼─────────────────────┼────────────────┘     │
│            │                     │                       │
│  ┌─────────▼─────────────────────▼────────────────┐     │
│  │              MongoDB Atlas                      │     │
│  │         (7 collections, cloud cluster)          │     │
│  └─────────────────────────────────────────────────┘     │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │   Vue 3 SPA  (Vite build, served as static CDN)  │    │
│  └──────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
            │
            │ HTTPS + WebSocket
            ▼
┌──────────────────────────────────────────────────────────┐
│              FARMER / ADMIN  (Browser)                   │
│  Dashboard · Analytics · Alerts · Device Config          │
└──────────────────────────────────────────────────────────┘
```

---

## 7. API Specification

### 7.1 Authentication

| Method | Endpoint | Auth | Request Body | Response |
|---|---|---|---|---|
| POST | `/api/auth/login` | None | `{ email, password }` | `{ token, user }` |
| POST | `/api/auth/register` | None | `{ user_name, email, password, role }` | `{ token, user }` |
| POST | `/api/auth/logout` | JWT | — | `{ success: true }` |
| GET  | `/api/auth/me` | JWT | — | `{ user }` |

### 7.2 Sensor Data

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/sensor-data` | None | Ingest reading from ESP32; triggers alert check |
| GET  | `/api/sensor-data/activity` | JWT | Activity log across farmer's devices |
| GET  | `/api/sensor-data/latest` | JWT | Latest reading for all farmer's devices |
| GET  | `/api/sensor-data/:deviceId/latest` | JWT | Latest reading for one device |
| GET  | `/api/sensor-data/:deviceId/history` | JWT | Paginated history (`?page&limit&range&startDate&endDate`) |
| GET  | `/api/sensor-data/:deviceId/aggregate` | JWT | Aggregated data (`?aggregation=hourly`) |

### 7.3 Devices

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET  | `/api/devices/:deviceId/relay-states` | **None** | ESP32 relay sync (public) |
| GET  | `/api/devices/:deviceId/config` | **None** | Full config on boot (public) |
| GET  | `/api/devices` | JWT | List devices (farmer: own; admin: all) |
| POST | `/api/devices` | JWT | Create device (`user_id` for admin assignment) |
| GET  | `/api/devices/:id` | JWT | Device detail + populated config |
| PUT  | `/api/devices/:id` | JWT | Update device metadata |
| PATCH | `/api/devices/:id/status` | JWT | Update device status (active/inactive/maintenance) |
| DELETE | `/api/devices/:id` | JWT | Soft-delete device |
| PUT  | `/api/devices/:id/configuration` | JWT | Update thresholds & sampling interval |
| PUT  | `/api/devices/:id/relays/:relayId` | JWT | Toggle relay or rename |
| POST | `/api/devices/:id/schedules` | JWT | Add time-based relay schedule |
| PUT  | `/api/devices/:id/schedules/:schedId` | JWT | Update schedule |
| DELETE | `/api/devices/:id/schedules/:schedId` | JWT | Delete schedule |

### 7.4 Alerts

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET  | `/api/alerts` | JWT | List alerts (`?status&limit`) |
| GET  | `/api/alerts/:id` | JWT | Alert detail |
| PATCH | `/api/alerts/:id/resolve` | JWT | Resolve alert (sets `resolved_at`) |
| DELETE | `/api/alerts/:id` | JWT | Delete alert |

### 7.5 Farms

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET  | `/api/farms` | JWT | Farmer: own farm; Admin: all farms |
| POST | `/api/farms` | JWT | Create farm (one per farmer) |
| GET  | `/api/farms/:id` | JWT | Farm detail + device list |
| PUT  | `/api/farms/:id` | JWT | Update farm |
| DELETE | `/api/farms/:id` | JWT | Soft-delete farm |

### 7.6 Analytics

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET  | `/api/analytics/dashboard` | JWT | Summary stats for dashboard |
| GET  | `/api/analytics/min-max/:deviceId` | JWT | Min/max per parameter for time range |
| GET  | `/api/analytics/admin/stats` | Admin | System-wide totals (users, farms, devices, alerts) |

### 7.7 Users (Admin)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET  | `/api/users` | Admin | All users with pagination |
| POST | `/api/users` | Admin | Create user |
| PUT  | `/api/users/:id` | Admin | Update user |
| DELETE | `/api/users/:id` | Admin | Soft-delete user |
| PATCH | `/api/users/:id/toggle-status` | Admin | Enable/disable user |

---

## 8. Security Architecture

| Layer | Mechanism |
|---|---|
| Transport | HTTPS (TLS) on cloud deployment |
| Authentication | JWT (HS256), 24 h expiry, stored in `localStorage` |
| Authorization | Middleware checks `req.user.role`; farmers scoped to `user_id`; admins unrestricted |
| Public endpoints | `/relay-states` and `/config` identified by opaque `device_id` string (no JWT; ESP32 has no secure storage) |
| HTTP hardening | Helmet.js (security headers), rate limiting, CORS restricted to `CORS_ORIGIN` env var |
| Input sanitization | Mongoose schema type enforcement; Express 5 body parsing |
| Audit trail | `auditLog()` writes to `SystemLog` collection for all device/user mutations |

---

## 9. Key Design Decisions

| Decision | Rationale |
|---|---|
| HTTP REST over MQTT for ESP32→Backend | Simpler on constrained device; no broker to maintain; direct MongoDB write path |
| Public config & relay-state endpoints | ESP32 has no secure credential storage; `device_id` acts as opaque identifier |
| Pinia `$reset()` on logout | Prevents stale `selectedFarmId` from leaking across user sessions |
| `broadcastToUser()` for alerts | Ensures alert toast reaches farmer regardless of current page (not device-channel which requires active subscription) |
| EC stored as µS/cm, displayed as mS/cm | Raw ADC values give µS/cm naturally; Mongoose virtual prevents double-conversion bugs |
| Median filter (40 samples) for ADC | Wolffia water surface causes reflections that create ADC impulse noise; median outperforms mean |
| FreeRTOS dual-task design | Separates time-critical pH/TDS schedule from network I/O which can block |
| Active-LOW relay wiring | Opto-isolated relay modules energise on LOW; safe-state on power loss is OFF |
