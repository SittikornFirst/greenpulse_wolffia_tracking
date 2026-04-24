# Test Cases Document
## GreenPulse: IoT-Based System for Tracking Environmental Factors in Wolffia Cultivation

| Field | Value |
|---|---|
| Document Type | Software Test Cases |
| Version | 1.0 |
| Date | 2026-04-24 |
| Author | Sittikorn (First) |
| Status | Final |

---

## Table of Contents

1. [Test Environment](#1-test-environment)
2. [Category 1 — Embedded Software: Unit Tests](#2-category-1--embedded-software-unit-tests)
3. [Category 2 — Embedded Software: Integration Tests](#3-category-2--embedded-software-integration-tests)
4. [Category 3 — Sensor Calibration Verification](#4-category-3--sensor-calibration-verification)
5. [Category 4 — Back-End API Tests](#5-category-4--back-end-api-tests)
6. [Category 5 — Web Frontend Tests](#6-category-5--web-frontend-tests)
7. [Category 6 — Field Deployment Tests](#7-category-6--field-deployment-tests)
8. [Test Summary Matrix](#8-test-summary-matrix)

---

## 1. Test Environment

### 1.1 Hardware

| Component | Specification |
|---|---|
| MCU | ESP32 (dual-core 240 MHz) |
| pH Sensor | Analog, ADC Pin 35 |
| EC/TDS Sensor | Analog, ADC Pin 34 |
| Water Temp | DS18B20, OneWire Pin 4 |
| Air Temp/Humidity | AHT30, I²C SDA=16 SCL=17 |
| Light | BH1750, I²C shared bus |
| RTC | DS1302, three-wire (CLK=14, DAT=27, RST=26) |
| SD Card | SPI (CS=21, SCK=18, MISO=19, MOSI=23) |
| Relay Module | 2-channel active-LOW (GPIO 25, 32) |

### 1.2 Software Stack

| Layer | Technology | Version |
|---|---|---|
| Firmware | Arduino ESP32 / FreeRTOS | Arduino Core 2.x |
| Backend | Node.js + Express | Express 5 |
| Database | MongoDB Atlas | Mongoose 8 |
| Frontend | Vue 3 + Vite | Vite 7.3.1 |
| Build result | 1800 modules, 0 errors | — |

### 1.3 Test Accounts

| Role | Email | Device |
|---|---|---|
| Farmer | first@farm.com | GREENPULSE-V1-MKUMW0RG-1JS0A |
| Admin | admin@farm.com | (all devices) |

### 1.4 Priority Levels

| Priority | Definition |
|---|---|
| **Critical** | Failure causes data loss or complete system failure |
| **High** | Failure degrades core functionality |
| **Medium** | Failure affects usability or secondary features |
| **Low** | Cosmetic or minor enhancement |

---

## 2. Category 1 — Embedded Software: Unit Tests

### ESP-U01 — Wi-Fi Initialization

| Field | Details |
|---|---|
| **Test ID** | ESP-U01 |
| **Category** | Embedded Unit |
| **Test Name** | Wi-Fi station mode connection on boot |
| **Priority** | Critical |
| **Preconditions** | SSID/password flashed; router reachable; ESP32 powered |
| **Steps** | 1. Power on ESP32. 2. Open Serial Monitor (115200 baud). 3. Observe boot log. |
| **Expected Result** | Serial prints `WiFi connected. IP: <address>` within 15 s; `WiFi.status() == WL_CONNECTED` |
| **Pass/Fail** | |
| **Notes** | If SSID unreachable, device should fall back to AP mode `GreenPulse-XXXX` |

---

### ESP-U02 — pH Sensor Read

| Field | Details |
|---|---|
| **Test ID** | ESP-U02 |
| **Category** | Embedded Unit |
| **Test Name** | pH value in valid range using quadratic calibration |
| **Priority** | Critical |
| **Preconditions** | pH probe submerged in buffer solution; ADC calibration constants loaded |
| **Steps** | 1. Submerge probe in pH 7.00 buffer. 2. Read 10 consecutive values. 3. Record all readings. |
| **Expected Result** | All 10 readings in range 6.5–7.5; no `NaN`, no negative, no value > 14 |
| **Pass/Fail** | |
| **Notes** | Equation: pH = −0.0563V² − 5.9038V + 13.8161; 40 ADC samples → median |

---

### ESP-U03 — EC/TDS Sensor Read

| Field | Details |
|---|---|
| **Test ID** | ESP-U03 |
| **Category** | Embedded Unit |
| **Test Name** | EC/TDS reading with temperature compensation |
| **Priority** | High |
| **Preconditions** | EC probe submerged in 1413 µS/cm calibration solution; DS18B20 reading valid |
| **Steps** | 1. Place probe in 1413 µS/cm solution at 25 °C. 2. Read 5 consecutive EC values. 3. Verify compensation formula applied. |
| **Expected Result** | EC readings within ±5% of 1413 µS/cm; compensation factor = 1/(1 + 0.02 × (T − 25)) |
| **Pass/Fail** | |
| **Notes** | TDS (ppm) = EC (µS/cm) × 0.5; stored as µS/cm, displayed as mS/cm |

---

### ESP-U04 — DS18B20 Water Temperature Read

| Field | Details |
|---|---|
| **Test ID** | ESP-U04 |
| **Category** | Embedded Unit |
| **Test Name** | DS18B20 returns valid temperature |
| **Priority** | High |
| **Preconditions** | DS18B20 connected to GPIO 4; probe submerged in water at known temperature |
| **Steps** | 1. Place reference thermometer and DS18B20 in same water bath at 25 °C. 2. Read DS18B20 5 times. 3. Compare to reference. |
| **Expected Result** | All readings within ±2.5 °C of reference thermometer; no −127 °C (error value) |
| **Pass/Fail** | |
| **Notes** | `ds18b20Available` flag must be true; fallback 25 °C used for TDS compensation only |

---

### ESP-U05 — AHT30 Air Temperature & Humidity Read

| Field | Details |
|---|---|
| **Test ID** | ESP-U05 |
| **Category** | Embedded Unit |
| **Test Name** | AHT30 sensor returns valid air temp and humidity |
| **Priority** | High |
| **Preconditions** | AHT30 connected on I²C (SDA=16, SCL=17); `ahtAvailable = true` |
| **Steps** | 1. Power on in room with known temperature/humidity. 2. Read 5 consecutive samples. 3. Compare to reference hygrometer. |
| **Expected Result** | Temperature within ±0.3 °C of reference; Humidity within ±2% RH of reference |
| **Pass/Fail** | |

---

### ESP-U06 — BH1750 Light Intensity Read

| Field | Details |
|---|---|
| **Test ID** | ESP-U06 |
| **Category** | Embedded Unit |
| **Test Name** | BH1750 returns valid lux value |
| **Priority** | Medium |
| **Preconditions** | BH1750 connected on I²C; `bh1750Available = true`; light source of known intensity |
| **Steps** | 1. Place BH1750 under reference light meter. 2. Read 5 values from `lightMeter.readLightLevel()`. 3. Compare to reference. |
| **Expected Result** | Readings within ±20% of reference lux meter; no negative or zero in normal light |
| **Pass/Fail** | |

---

### ESP-U07 — Median Filter Accuracy

| Field | Details |
|---|---|
| **Test ID** | ESP-U07 |
| **Category** | Embedded Unit |
| **Test Name** | Median filter rejects outliers from noisy ADC stream |
| **Priority** | High |
| **Preconditions** | ESP32 running; inject known signal with artificial spike on ADC input |
| **Steps** | 1. Feed stable 1.65 V signal with 3 spike samples at 3.3 V injected. 2. Collect 40-sample median result. 3. Compare to raw mean. |
| **Expected Result** | Median output within ±2% of stable signal; raw mean deviates > 10% due to spikes |
| **Pass/Fail** | |
| **Notes** | Median filter uses `SENSOR_SAMPLE_COUNT = 40`; array sorted then middle value taken |

---

### ESP-U08 — JSON Payload Structure

| Field | Details |
|---|---|
| **Test ID** | ESP-U08 |
| **Category** | Embedded Unit |
| **Test Name** | Sensor payload is valid JSON with all required fields |
| **Priority** | Critical |
| **Preconditions** | All sensors available; Serial Monitor open |
| **Steps** | 1. Let ESP32 complete one read cycle. 2. Capture the JSON string from Serial. 3. Validate structure. |
| **Expected Result** | JSON contains: `device_id`, `ph_value`, `water_temperature_c`, `air_temperature_c`, `ec_value`, `tds_value`, `light_intensity`, `air_humidity`, `timestamp` (ISO 8601 with +07:00), `created_at`; all numeric fields are numbers (not strings or null) |
| **Pass/Fail** | |

---

### ESP-U09 — NTP Time Synchronization

| Field | Details |
|---|---|
| **Test ID** | ESP-U09 |
| **Category** | Embedded Unit |
| **Test Name** | NTP sync sets RTC to correct time on boot |
| **Priority** | High |
| **Preconditions** | Wi-Fi connected; internet reachable; NTP server `pool.ntp.org` accessible |
| **Steps** | 1. Power on with Wi-Fi available. 2. Wait for NTP sync log message. 3. Compare RTC reading to known time source. |
| **Expected Result** | RTC time within ±1 s of NTP reference; Serial prints `[Time] NTP sync successful`; `timeSynced = true` |
| **Pass/Fail** | |

---

### ESP-U10 — RTC Fallback When NTP Unavailable

| Field | Details |
|---|---|
| **Test ID** | ESP-U10 |
| **Category** | Embedded Unit |
| **Test Name** | Device uses RTC time when NTP unreachable |
| **Priority** | High |
| **Preconditions** | RTC has valid prior time set; DNS/NTP blocked (or no internet) |
| **Steps** | 1. Block internet access. 2. Power on ESP32. 3. Monitor Serial for time source used. 4. Verify timestamps in generated payload. |
| **Expected Result** | Serial shows `[Time] NTP failed, using RTC`; timestamps use last valid RTC time; ISO 8601 format with +07:00; no `1970-01-01` epoch timestamps |
| **Pass/Fail** | |

---

### ESP-U11 — 24-Hour NTP Re-sync Trigger

| Field | Details |
|---|---|
| **Test ID** | ESP-U11 |
| **Category** | Embedded Unit |
| **Test Name** | NTP re-sync fires after 24 h of continuous operation |
| **Priority** | Medium |
| **Preconditions** | Device running; last NTP sync > 24 h ago (simulate via time override) |
| **Steps** | 1. Force `lastNTPSync` variable to 24+ hours ago. 2. Trigger next sync cycle. 3. Confirm NTP called again. |
| **Expected Result** | `syncRTCWithNTP()` called; Serial shows `[Time] NTP re-sync successful`; RTC updated |
| **Pass/Fail** | |

---

## 3. Category 2 — Embedded Software: Integration Tests

### ESP-I01 — Full Sampling Loop (60-second cycle)

| Field | Details |
|---|---|
| **Test ID** | ESP-I01 |
| **Category** | Embedded Integration |
| **Test Name** | Complete read → filter → format → transmit cycle |
| **Priority** | Critical |
| **Preconditions** | All sensors connected; Wi-Fi and backend running |
| **Steps** | 1. Power on device. 2. Wait for first complete cycle. 3. Verify each stage in Serial log. |
| **Expected Result** | Within `cfg_sampling_interval_ms` (default 30 s): all 7 sensor readings logged → JSON built → CSV appended → POST attempted → Serial shows `[Backend] Data sent successfully` |
| **Pass/Fail** | |

---

### ESP-I02 — HTTP POST Success → MongoDB Record Created

| Field | Details |
|---|---|
| **Test ID** | ESP-I02 |
| **Category** | Embedded Integration |
| **Test Name** | Successful POST creates verifiable record in database |
| **Priority** | Critical |
| **Preconditions** | Wi-Fi connected; backend running; MongoDB accessible |
| **Steps** | 1. Note current record count via `GET /api/sensor-data/:deviceId/history`. 2. Wait for one ESP32 cycle. 3. Re-query record count. |
| **Expected Result** | Record count increments by 1; new record's `timestamp` matches ESP32's clock; all 7 sensor fields present |
| **Pass/Fail** | |

---

### ESP-I03 — HTTP POST Failure → SD Card Append

| Field | Details |
|---|---|
| **Test ID** | ESP-I03 |
| **Category** | Embedded Integration |
| **Test Name** | POST failure writes data to SD card without data loss |
| **Priority** | Critical |
| **Preconditions** | SD card inserted; backend intentionally stopped or Wi-Fi disabled |
| **Steps** | 1. Disconnect Wi-Fi or stop backend. 2. Allow 3 ESP32 cycles. 3. Remove SD card, open `/sensor_YYYY_MM_DD.csv` on PC. |
| **Expected Result** | CSV file exists with 3 new rows; each row contains all 7 sensor values + timestamp; Serial shows `[Backend] WiFi offline, data saved to SD` |
| **Pass/Fail** | |

---

### ESP-I04 — Wi-Fi Restore → Auto-Backfill

| Field | Details |
|---|---|
| **Test ID** | ESP-I04 |
| **Category** | Embedded Integration |
| **Test Name** | Reconnect triggers batch upload of SD-buffered data |
| **Priority** | Critical |
| **Preconditions** | ≥ 5 rows buffered on SD from offline period; backend running |
| **Steps** | 1. Create offline buffer (disable Wi-Fi, wait 5 cycles). 2. Re-enable Wi-Fi. 3. Monitor Serial and backend logs. |
| **Expected Result** | `syncPendingData()` fires; Serial shows rows being sent; backend receives exactly the buffered records; SD rows removed after successful upload; MongoDB count increases by buffer size |
| **Pass/Fail** | |

---

### ESP-I05 — Backup File Rewrite After Sync

| Field | Details |
|---|---|
| **Test ID** | ESP-I05 |
| **Category** | Embedded Integration |
| **Test Name** | SD file retains only unsynced rows after partial batch upload |
| **Priority** | High |
| **Preconditions** | > 50 buffered rows on SD (more than one batch) |
| **Steps** | 1. Create 60 offline rows. 2. Restore Wi-Fi. 3. Allow first sync batch (50 rows). 4. Inspect SD file. |
| **Expected Result** | After first batch: SD file contains exactly 10 remaining rows; synced rows removed; 10 remaining rows are intact and correct |
| **Pass/Fail** | |
| **Notes** | Batch size = 50 rows per `syncPendingData()` call |

---

### ESP-I06 — Monthly CSV Logging

| Field | Details |
|---|---|
| **Test ID** | ESP-I06 |
| **Category** | Embedded Integration |
| **Test Name** | CSV log file created with correct naming and all required fields |
| **Priority** | Medium |
| **Preconditions** | SD card inserted; device running |
| **Steps** | 1. Run device for at least 3 sensor cycles in current month. 2. Remove SD card. 3. Open `/sensor_YYYY_MM_DD.csv` in spreadsheet software. |
| **Expected Result** | File named `sensor_YYYY_MM_DD.csv` matching current date; CSV contains header row + data rows; columns: timestamp, ph_value, ec_value, tds_value, water_temperature_c, air_temperature_c, air_humidity, light_intensity; all fields populated |
| **Pass/Fail** | |

---

### ESP-I07 — Wi-Fi Auto-Reconnect After Dropout

| Field | Details |
|---|---|
| **Test ID** | ESP-I07 |
| **Category** | Embedded Integration |
| **Test Name** | Device reconnects to Wi-Fi after temporary dropout without reboot |
| **Priority** | High |
| **Preconditions** | Device running and connected; router controllable |
| **Steps** | 1. Power off router for 30 s. 2. Power router back on. 3. Monitor Serial for reconnect. |
| **Expected Result** | ESP32 detects `WiFi.status() != WL_CONNECTED`; auto-reconnect fires; Serial shows `WiFi reconnected`; subsequent POSTs succeed; no manual reboot required |
| **Pass/Fail** | |

---

## 4. Category 3 — Sensor Calibration Verification

### CAL-01 — pH Quadratic Calibration (Buffer pH 4.01)

| Field | Details |
|---|---|
| **Test ID** | CAL-01 |
| **Category** | Calibration |
| **Test Name** | pH reading accuracy at low buffer (pH 4.01) |
| **Priority** | Critical |
| **Preconditions** | pH probe cleaned; pH 4.01 buffer solution at 25 °C |
| **Steps** | 1. Submerge pH probe in pH 4.01 buffer. 2. Wait 60 s for stabilization. 3. Record 5 readings. |
| **Expected Result** | All 5 readings in range 3.81–4.21 (±0.20 tolerance); mean reading ≈ 4.01 |
| **Calibration Equation** | pH = −0.0563V² − 5.9038V + 13.8161; R² = 0.9987 |
| **Pass/Fail** | |

---

### CAL-02 — pH Quadratic Calibration (Buffer pH 6.86)

| Field | Details |
|---|---|
| **Test ID** | CAL-02 |
| **Category** | Calibration |
| **Test Name** | pH reading accuracy at mid-range buffer (pH 6.86) |
| **Priority** | Critical |
| **Preconditions** | pH 6.86 buffer solution at 25 °C |
| **Steps** | 1. Submerge probe in pH 6.86 buffer. 2. Wait 60 s. 3. Record 5 readings. |
| **Expected Result** | All readings in range 6.66–7.06; mean ≈ 6.86 |
| **Pass/Fail** | |

---

### CAL-03 — pH Quadratic Calibration (Buffer pH 9.18)

| Field | Details |
|---|---|
| **Test ID** | CAL-03 |
| **Category** | Calibration |
| **Test Name** | pH reading accuracy at high buffer (pH 9.18) |
| **Priority** | Critical |
| **Preconditions** | pH 9.18 buffer solution at 25 °C |
| **Steps** | 1. Submerge probe in pH 9.18 buffer. 2. Wait 60 s. 3. Record 5 readings. |
| **Expected Result** | All readings in range 8.98–9.38; mean ≈ 9.18 |
| **Pass/Fail** | |

---

### CAL-04 — TDS Two-Point Linear Calibration

| Field | Details |
|---|---|
| **Test ID** | CAL-04 |
| **Category** | Calibration |
| **Test Name** | TDS sensor accuracy using calibration standards |
| **Priority** | High |
| **Preconditions** | TDS calibration solutions: 500 ppm and 1000 ppm; water at 25 °C |
| **Steps** | 1. Measure 500 ppm solution → record reading. 2. Measure 1000 ppm solution → record reading. 3. Verify linear relationship holds between standards. |
| **Expected Result** | 500 ppm solution: reading in range 475–525 ppm; 1000 ppm solution: reading in range 950–1050 ppm; ratio ≈ 2:1 |
| **Pass/Fail** | |

---

### CAL-05 — DS18B20 Water Temperature Accuracy

| Field | Details |
|---|---|
| **Test ID** | CAL-05 |
| **Category** | Calibration |
| **Test Name** | DS18B20 within datasheet tolerance vs calibrated thermometer |
| **Priority** | High |
| **Preconditions** | Calibrated reference thermometer; water bath at 25 °C |
| **Steps** | 1. Place DS18B20 and reference in same water bath. 2. Stabilize 5 min. 3. Record 5 readings from both. |
| **Expected Result** | DS18B20 readings within ±0.5 °C (datasheet) / ±2.5 °C (field-verified) of reference |
| **Pass/Fail** | |

---

### CAL-06 — AHT30 Air Temperature Accuracy

| Field | Details |
|---|---|
| **Test ID** | CAL-06 |
| **Category** | Calibration |
| **Test Name** | AHT30 air temperature within ±0.3 °C |
| **Priority** | Medium |
| **Preconditions** | Reference thermometer; stable indoor environment |
| **Steps** | 1. Place AHT30 and reference side-by-side for 10 min. 2. Record 5 readings from both. |
| **Expected Result** | AHT30 readings within ±0.3 °C of calibrated reference |
| **Pass/Fail** | |

---

### CAL-07 — AHT30 Humidity Accuracy

| Field | Details |
|---|---|
| **Test ID** | CAL-07 |
| **Category** | Calibration |
| **Test Name** | AHT30 humidity within ±2 %RH |
| **Priority** | Medium |
| **Preconditions** | Reference hygrometer; stable humidity environment |
| **Steps** | 1. Place AHT30 and reference hygrometer in same sealed enclosure for 15 min. 2. Record 5 readings from both. |
| **Expected Result** | AHT30 readings within ±2 %RH of calibrated hygrometer |
| **Pass/Fail** | |

---

### CAL-08 — BH1750 Light Intensity Accuracy

| Field | Details |
|---|---|
| **Test ID** | CAL-08 |
| **Category** | Calibration |
| **Test Name** | BH1750 reading within ±20% of reference lux meter |
| **Priority** | Medium |
| **Preconditions** | Calibrated digital lux meter; controlled light source |
| **Steps** | 1. Point both sensors at identical light source at fixed distance. 2. Record 5 readings from BH1750 and reference. |
| **Expected Result** | BH1750 within ±20% of reference lux meter across range 200–6000 lux |
| **Pass/Fail** | |

---

## 5. Category 4 — Back-End API Tests

### API-01 — Valid Sensor POST → 201 + MongoDB Record

| Field | Details |
|---|---|
| **Test ID** | API-01 |
| **Category** | Backend API |
| **Test Name** | Valid sensor payload creates record and returns 201 |
| **Priority** | Critical |
| **Preconditions** | Backend running; device `GREENPULSE-V1-MKUMW0RG-1JS0A` registered in DB |
| **Steps** | 1. `POST /api/sensor-data` with complete valid payload. 2. Inspect response. 3. Query DB for new record. |
| **Expected Result** | HTTP 201; response `{ success: true, data: { ... } }`; new document in `sensordata` collection with all 7 sensor fields |
| **Pass/Fail** | ✅ Pass |
| **Notes** | Verified 2026-04-24; response confirmed |

---

### API-02 — Invalid Payload → 400 Validation Error

| Field | Details |
|---|---|
| **Test ID** | API-02 |
| **Category** | Backend API |
| **Test Name** | Missing required fields return 400 with error detail |
| **Priority** | High |
| **Preconditions** | Backend running |
| **Steps** | 1. `POST /api/sensor-data` with `device_id` omitted. 2. Inspect response status and body. |
| **Expected Result** | HTTP 400; response body includes validation error message identifying missing field |
| **Pass/Fail** | |

---

### API-03 — Invalid Device Token → 401

| Field | Details |
|---|---|
| **Test ID** | API-03 |
| **Category** | Backend API |
| **Test Name** | Authenticated endpoints reject missing or invalid JWT |
| **Priority** | Critical |
| **Preconditions** | Backend running |
| **Steps** | 1. `GET /api/devices` with no Authorization header. 2. Repeat with malformed token `Bearer invalid`. |
| **Expected Result** | Both requests return HTTP 401; body `{ success: false, message: "No token provided" }` or `"Invalid token"` |
| **Pass/Fail** | ✅ Pass |
| **Notes** | Verified 2026-04-24; no-auth → 401 confirmed |

---

### API-04 — Sensor History Filtering

| Field | Details |
|---|---|
| **Test ID** | API-04 |
| **Category** | Backend API |
| **Test Name** | History endpoint supports device, time range, and pagination filtering |
| **Priority** | High |
| **Preconditions** | ≥ 25 sensor readings in DB for test device; farmer JWT |
| **Steps** | 1. `GET /api/sensor-data/:deviceId/history?page=2&limit=10`. 2. Verify pagination metadata. 3. Repeat with `?range=7d`. |
| **Expected Result** | `data` array length ≤ 10; `pagination.page = 2`; `pagination.total > 10`; all returned records belong to specified device |
| **Pass/Fail** | ✅ Pass |
| **Notes** | Verified: total=4853, page=2, items=10, pages=486 |

---

### API-05 — Alert Generation on Threshold Breach

| Field | Details |
|---|---|
| **Test ID** | API-05 |
| **Category** | Backend API |
| **Test Name** | Sensor value below minimum creates alert record |
| **Priority** | Critical |
| **Preconditions** | Device config: `ph_min = 6.0`; no active `ph_value_low` alert exists |
| **Steps** | 1. `POST /api/sensor-data` with `ph_value: 4.5`. 2. `GET /api/alerts?status=active`. 3. Find alert for device. |
| **Expected Result** | HTTP 201 for sensor POST; new Alert document with `alert_type: "ph_value_low"`, `status: "active"`, `value: 4.5` |
| **Pass/Fail** | ✅ Pass |
| **Notes** | Verified 2026-04-24 |

---

### API-06 — Duplicate Alert Prevention

| Field | Details |
|---|---|
| **Test ID** | API-06 |
| **Category** | Backend API |
| **Test Name** | Second threshold breach does not create duplicate active alert |
| **Priority** | High |
| **Preconditions** | Active `ph_value_low` alert already exists for device |
| **Steps** | 1. `POST /api/sensor-data` with `ph_value: 4.5` (second time). 2. Count active `ph_value_low` alerts for device. |
| **Expected Result** | Alert count remains 1; no new Alert document created |
| **Pass/Fail** | ✅ Pass |
| **Notes** | Verified 2026-04-24 |

---

### API-07 — Admin Creates Device Assigned to Farmer

| Field | Details |
|---|---|
| **Test ID** | API-07 |
| **Category** | Backend API |
| **Test Name** | Admin POST /devices with user_id scopes device to target farmer |
| **Priority** | High |
| **Preconditions** | Admin JWT; target farmer user exists |
| **Steps** | 1. `POST /api/devices` with admin token and `user_id: <farmerId>`. 2. Login as farmer. 3. `GET /api/devices` as farmer. |
| **Expected Result** | HTTP 201 with `device.user_id = farmerId`; farmer's GET /devices includes the new device |
| **Pass/Fail** | ✅ Pass |
| **Notes** | Verified 2026-04-24; device GREENPULSE-V1-MOCFVSMF-KX3H4 visible to farmer |

---

### API-08 — Public Config Endpoint (No Auth)

| Field | Details |
|---|---|
| **Test ID** | API-08 |
| **Category** | Backend API |
| **Test Name** | GET /devices/:deviceId/config returns full config without JWT |
| **Priority** | Critical |
| **Preconditions** | Backend running; device exists |
| **Steps** | 1. `GET /api/devices/GREENPULSE-V1-MKUMW0RG-1JS0A/config` with no Authorization header. |
| **Expected Result** | HTTP 200; JSON contains `sampling_interval`, `ph_min`, `ph_max`, `ec_value_min`, `ec_value_max`, `water_temp_min`, `water_temp_max`, `air_temp_min`, `air_temp_max`, `light_intensity_min`, `light_intensity_max`, `relays[]`, `schedules[]` |
| **Pass/Fail** | ✅ Pass |
| **Notes** | Verified 2026-04-24; sampling_interval=300, all threshold fields present |

---

### API-09 — Role Guard: Farmer Cannot Access Admin Analytics

| Field | Details |
|---|---|
| **Test ID** | API-09 |
| **Category** | Backend API |
| **Test Name** | Farmer JWT rejected by admin-only endpoint |
| **Priority** | High |
| **Preconditions** | Farmer JWT |
| **Steps** | 1. `GET /api/analytics/admin/stats` with farmer token. |
| **Expected Result** | HTTP 403 Forbidden |
| **Pass/Fail** | ✅ Pass |
| **Notes** | Verified 2026-04-24 |

---

### API-10 — Device CRUD Operations

| Field | Details |
|---|---|
| **Test ID** | API-10 |
| **Category** | Backend API |
| **Test Name** | Full create → read → update → delete cycle for a device |
| **Priority** | High |
| **Preconditions** | Admin JWT; farmer user exists |
| **Steps** | 1. POST new device. 2. GET device by returned ID. 3. PUT update `device_name`. 4. DELETE device (soft delete). 5. GET device → verify `is_deleted: true`. |
| **Expected Result** | Each step returns 201/200 with correct data; soft-deleted device not returned in list queries |
| **Pass/Fail** | |

---

## 6. Category 5 — Web Frontend Tests

### FE-01 — Dashboard Real-Time Update via WebSocket

| Field | Details |
|---|---|
| **Test ID** | FE-01 |
| **Category** | Frontend |
| **Test Name** | Dashboard sensor widgets update without page refresh |
| **Priority** | Critical |
| **Preconditions** | Farmer logged in; WebSocket connected; mock sensor script running |
| **Steps** | 1. Open Dashboard. 2. Open DevTools → Network → WS. 3. Verify subscribe frames sent. 4. Post new sensor reading via script. 5. Observe dashboard. |
| **Expected Result** | WS frames show `{ type: "subscribe", deviceId }` per device; after new reading posted: sensor widget values update within 2 s; no page refresh |
| **Pass/Fail** | |
| **Notes** | `subscribeToDevices: true` fix applied; `broadcastToUser` sends alert events |

---

### FE-02 — Dashboard Chart Rendering

| Field | Details |
|---|---|
| **Test ID** | FE-02 |
| **Category** | Frontend |
| **Test Name** | All 6 parameter charts render on Dashboard |
| **Priority** | High |
| **Preconditions** | Farmer logged in; device has ≥ 10 readings |
| **Steps** | 1. Login as farmer. 2. Navigate to Dashboard. 3. Inspect all chart widgets. |
| **Expected Result** | Charts visible for pH, EC, TDS, water temp, air temp, light intensity; no empty/blank charts; no JavaScript console errors |
| **Pass/Fail** | |

---

### FE-03 — Alert Toast on Threshold Breach

| Field | Details |
|---|---|
| **Test ID** | FE-03 |
| **Category** | Frontend |
| **Test Name** | AlertToast appears when WebSocket delivers alert event |
| **Priority** | Critical |
| **Preconditions** | Farmer logged in on any page; WebSocket connected; `ph_min = 6.0` configured |
| **Steps** | 1. Post sensor reading with `ph_value: 4.5` to backend. 2. Observe browser within 5 s. |
| **Expected Result** | AlertToast component renders with parameter name, value (4.5), device name; auto-dismisses after 6 s; alert count badge in navbar increments |
| **Pass/Fail** | |

---

### FE-04 — Analytics Pagination

| Field | Details |
|---|---|
| **Test ID** | FE-04 |
| **Category** | Frontend |
| **Test Name** | Analytics view pagination navigates server-side pages correctly |
| **Priority** | High |
| **Preconditions** | Device has > 10 readings; farmer logged in |
| **Steps** | 1. Open Analytics. 2. Select device and time range "7d". 3. Set Show = 10. 4. Click "Next ›". 5. Observe table and page indicator. |
| **Expected Result** | Table loads next 10 readings; page indicator shows "Page 2 of N"; URL or state reflects page 2; no duplicate data from DataTable internal pagination |
| **Pass/Fail** | |

---

### FE-05 — Recommendation Panel

| Field | Details |
|---|---|
| **Test ID** | FE-05 |
| **Category** | Frontend |
| **Test Name** | Recommendations panel shows for out-of-range averages |
| **Priority** | Medium |
| **Preconditions** | Analytics view; device has readings with avg pH < 6.0 |
| **Steps** | 1. Select device and time range containing low-pH readings. 2. Observe Recommendations section. |
| **Expected Result** | Yellow/red card appears for "pH Level" with message describing the issue and corrective action; green "All OK" bar is hidden |
| **Pass/Fail** | |

---

### FE-06 — Device Configuration Form

| Field | Details |
|---|---|
| **Test ID** | FE-06 |
| **Category** | Frontend |
| **Test Name** | Threshold configuration modal saves and persists to DB |
| **Priority** | High |
| **Preconditions** | Farmer logged in; device exists with config |
| **Steps** | 1. Open DeviceDetails. 2. Click "Configure Device". 3. Change `ph_min` to 5.5. 4. Click Save. 5. Reload page. |
| **Expected Result** | Modal closes; success notification shown; after reload, `ph_min` field shows 5.5; backend `GET /api/devices/:id` returns updated `ph_min: 5.5` |
| **Pass/Fail** | |

---

### FE-07 — Relay Toggle Updates Database

| Field | Details |
|---|---|
| **Test ID** | FE-07 |
| **Category** | Frontend |
| **Test Name** | Relay toggle switch sends PUT request and updates relay state |
| **Priority** | High |
| **Preconditions** | Farmer logged in; device has 2 relays configured |
| **Steps** | 1. Open DeviceDetails. 2. Toggle relay 0 switch ON. 3. Observe network request. 4. Reload page. |
| **Expected Result** | `PUT /api/devices/:id/relays/0` returns 200; relay card shows "ON"; after reload relay remains ON; ESP32 reflects state within 30 s |
| **Pass/Fail** | |

---

### FE-08 — Admin Assign Device to Farmer

| Field | Details |
|---|---|
| **Test ID** | FE-08 |
| **Category** | Frontend |
| **Test Name** | Admin can create a device assigned to a specific farmer |
| **Priority** | High |
| **Preconditions** | Admin logged in; target farmer account exists |
| **Steps** | 1. Open Devices. 2. Click Add Device. 3. Select farmer from "Assign to User" dropdown. 4. Fill name and submit. 5. Login as farmer. |
| **Expected Result** | Device created; farmer's device list includes the new device; admin's device list also shows it |
| **Pass/Fail** | |

---

### FE-09 — Responsive Layout

| Field | Details |
|---|---|
| **Test ID** | FE-09 |
| **Category** | Frontend |
| **Test Name** | Key views render correctly on mobile, tablet, and desktop |
| **Priority** | Medium |
| **Preconditions** | Browser DevTools responsive mode |
| **Steps** | 1. Open Dashboard, DeviceDetails, Analytics on 375 px (mobile), 768 px (tablet), 1440 px (desktop). 2. Check layout for overflow, overlap, or broken elements. |
| **Expected Result** | No horizontal scroll on mobile; sidebar collapses; cards stack vertically; tables become scrollable; all interactive elements remain accessible |
| **Pass/Fail** | |

---

### FE-10 — User Authentication Flow

| Field | Details |
|---|---|
| **Test ID** | FE-10 |
| **Category** | Frontend |
| **Test Name** | Login, session persistence, and logout clear all state |
| **Priority** | Critical |
| **Preconditions** | Browser in clean state |
| **Steps** | 1. Login as farmer → verify dashboard shows farmer's data. 2. Close and reopen browser → verify auto-login via token. 3. Logout → verify redirect to /login. 4. Login as admin → verify admin-only pages visible. 5. Login as farmer again → verify farmer data (not admin data) shown. |
| **Expected Result** | Token persists in `localStorage` across sessions; logout clears all Pinia store state (`$reset()`); second farmer login shows fresh data without stale `selectedFarmId` from previous session |
| **Pass/Fail** | |

---

## 7. Category 6 — Field Deployment Tests

### 7.1 Experimental Setup

| Parameter | Details |
|---|---|
| Farm Site | Wolffia globosa hydroponic basin (indoor/greenhouse) |
| Device Placement | ESP32 mounted at basin edge; sensors fully submerged (pH, EC, DS18B20); AHT30 and BH1750 positioned 30 cm above water surface |
| Network | 2.4 GHz Wi-Fi with uninterrupted power supply (UPS) on router |
| Test Duration | 7 days continuous operation |
| Baseline Readings | pH 6.5–7.5, EC 1.0–2.5 mS/cm, Water Temp 20–28 °C |

---

### FD-01 — 24-Hour Data Delivery Rate

| Field | Details |
|---|---|
| **Test ID** | FD-01 |
| **Category** | Field Deployment |
| **Test Name** | ≥ 99% of expected readings delivered over 24 hours |
| **Priority** | Critical |
| **Preconditions** | Device deployed; sampling interval = 30 s; network stable |
| **Steps** | 1. Record start timestamp T0. 2. Allow 24 h of operation. 3. Count records in DB from T0 to T0+24h for device. 4. Calculate delivery rate. |
| **Expected Result** | Expected readings: 2880 (24h × 60min × 2/min). Actual ≥ 2851 (≥ 99%); delivery rate = (actual / expected) × 100% ≥ 99% |
| **Pass/Fail** | |
| **Notes** | Any missed readings should be recoverable from SD backfill |

---

### FD-02 — 72-Hour Reliability

| Field | Details |
|---|---|
| **Test ID** | FD-02 |
| **Category** | Field Deployment |
| **Test Name** | System delivers ≥ 99% readings over 72-hour continuous run |
| **Priority** | Critical |
| **Preconditions** | Device deployed; UPS on router |
| **Steps** | 1. Record T0. 2. Leave device running 72 h. 3. Count DB records. 4. Calculate delivery rate. |
| **Expected Result** | Expected: 8640 readings; Actual ≥ 8554 (≥ 99%); no ESP32 crashes or required reboots |
| **Pass/Fail** | |

---

### FD-03 — End-to-End Latency

| Field | Details |
|---|---|
| **Test ID** | FD-03 |
| **Category** | Field Deployment |
| **Test Name** | Sensor read to dashboard display latency < 10 s |
| **Priority** | High |
| **Preconditions** | Device running; dashboard open in browser with WebSocket connected |
| **Steps** | 1. Note exact time of ESP32 POST (from Serial). 2. Note exact time dashboard widget updates (browser clock). 3. Repeat 5 times. |
| **Expected Result** | End-to-end latency (sensor read → dashboard display) consistently < 10 s; mean < 5 s |
| **Pass/Fail** | |

---

### FD-04 — Power Outage Recovery (Zero Data Loss)

| Field | Details |
|---|---|
| **Test ID** | FD-04 |
| **Category** | Field Deployment |
| **Test Name** | Simulated power/network outage causes zero data loss after recovery |
| **Priority** | Critical |
| **Preconditions** | Device running; SD card inserted |
| **Steps** | 1. Record current DB record count (C1). 2. Cut network for exactly 10 min. 3. Restore network. 4. Wait 5 min for backfill. 5. Record new count (C2). 6. Calculate expected readings during outage. |
| **Expected Result** | (C2 − C1) ≥ expected offline readings; SD backfill delivers all buffered records; no gap in time-series data |
| **Pass/Fail** | |

---

### FD-05 — 7-Day Continuous Stability

| Field | Details |
|---|---|
| **Test ID** | FD-05 |
| **Category** | Field Deployment |
| **Test Name** | Device operates 7 days without manual intervention or crash |
| **Priority** | Critical |
| **Preconditions** | Device freshly deployed; UPS available |
| **Steps** | 1. Deploy device at T0. 2. Check once daily that data is still flowing (remote, via dashboard). 3. After 7 days, inspect Serial log on SD and DB records. |
| **Expected Result** | No ESP32 watchdog reset or crash within 7 days; data delivery rate ≥ 98% over full period; no manual reset required; SD files rotated correctly daily |
| **Pass/Fail** | |

---

### FD-06 — Sensor Drift Over 7 Days

| Field | Details |
|---|---|
| **Test ID** | FD-06 |
| **Category** | Field Deployment |
| **Test Name** | pH/EC sensor readings remain stable (no significant drift) |
| **Priority** | High |
| **Preconditions** | Sensors calibrated at T0; reference solutions available at T7 |
| **Steps** | 1. Record pH in pH 6.86 buffer at T0. 2. After 7 days of deployment, remove probe, rinse, place in same buffer. 3. Record reading. |
| **Expected Result** | Drift < 0.2 pH units over 7 days; if drift detected, note required recalibration frequency |
| **Pass/Fail** | |

---

## 8. Test Summary Matrix

| Category | Total Cases | Automated ✅ | Manual 👁 | Hardware 🔧 |
|---|---|---|---|---|
| Embedded Unit (ESP-U) | 11 | 0 | 0 | 11 |
| Embedded Integration (ESP-I) | 7 | 0 | 0 | 7 |
| Calibration (CAL) | 8 | 0 | 0 | 8 |
| Backend API (API) | 10 | 8 | 0 | 0 |
| Frontend (FE) | 10 | 0 | 10 | 0 |
| Field Deployment (FD) | 6 | 0 | 0 | 6 |
| **TOTAL** | **52** | **8** | **10** | **35** |

### Backend API Results (Automated — 2026-04-24)

| ID | Test Name | Result |
|---|---|---|
| API-01 | Valid sensor POST → 201 + DB record | ✅ Pass |
| API-03 | No-auth request → 401 | ✅ Pass |
| API-04 | Pagination page=2 limit=10 | ✅ Pass |
| API-05 | Alert created on threshold breach | ✅ Pass |
| API-06 | Duplicate alert prevented | ✅ Pass |
| API-07 | Admin device creation scoped to farmer | ✅ Pass |
| API-08 | Public /config endpoint (no JWT) | ✅ Pass |
| API-09 | Farmer → admin endpoint → 403 | ✅ Pass |

### Build Verification

| Check | Result |
|---|---|
| `npm run build` (Vite 7) | ✅ 1800 modules, 0 errors, 0 warnings |
| Build time | 12.29 s |
| Largest bundle (gzip) | chart-vendor: 70.71 kB |
