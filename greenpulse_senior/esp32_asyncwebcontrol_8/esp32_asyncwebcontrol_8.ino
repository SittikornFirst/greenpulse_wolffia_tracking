/*
  GreenPulse ESP32 - Complete Environmental Monitoring System
  Direct HTTP to MongoDB Atlas Data API - Standalone Mode
*/

#include <WiFi.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <Wire.h>
#include <Adafruit_AHTX0.h>
#include <BH1750.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <time.h>
#include <SD.h>
#include <SPI.h>
#include <ThreeWire.h>
#include <RtcDS1302.h>
#include <HTTPClient.h>

// ========== BACKEND API CONFIGURATION ==========
// Configure this to point to your deployed Node.js backend.
// E.g. "https://greenpulse-backend.onrender.com/api/sensor-data"
constexpr char BACKEND_API_URL[]        = "https://greenpulse-wolffia-tracking.onrender.com/api/sensor-data";
constexpr char BACKEND_RELAY_URL_BASE[] = "https://greenpulse-wolffia-tracking.onrender.com/api/devices/";
constexpr char BACKEND_CONFIG_URL_BASE[] = "https://greenpulse-wolffia-tracking.onrender.com/api/devices/";

// ========== WIFI CONFIGURATION ==========
constexpr char WIFI_SSID[] = "ibo";
constexpr char WIFI_PASSWORD[] = "";
constexpr char DEVICE_ID[] = "GREENPULSE-V1-MKUMW0RG-1JS0A";
constexpr char NTP_SERVER[] = "pool.ntp.org";
constexpr long GMT_OFFSET_SEC = 7 * 3600;
constexpr int DAYLIGHT_OFFSET_SEC = 0;

// HTTP Configuration
constexpr unsigned long HTTP_TIMEOUT_MS = 10000;
constexpr int MAX_HTTP_RETRIES = 3;

// Pin Definitions
constexpr int I2C_SDA_PIN = 16;
constexpr int I2C_SCL_PIN = 17;
constexpr int DS18B20_PIN = 4;
constexpr int PH_PIN = 35;
constexpr int TDS_PIN = 34;
constexpr int RTC_CLK_PIN = 14;
constexpr int RTC_DAT_PIN = 27;
constexpr int RTC_RST_PIN = 26;
constexpr int SD_CS = 21;

// Relay Pin Definitions
// Most relay modules are active-LOW: drive LOW to energise, HIGH to de-energise.
constexpr int RELAY_AIR_PUMP_PIN = 25;
constexpr int RELAY_LIGHT_PIN    = 32;
constexpr int RELAY_ON  = LOW;
constexpr int RELAY_OFF = HIGH;

// Sensor Configuration
constexpr int MAX_PH_TDS_SCHEDULES = 10;
constexpr int SENSOR_SAMPLE_COUNT = 40;
constexpr int ADC_RESOLUTION = 4095;
constexpr float ADC_REFERENCE_VOLTAGE = 3.3f;
constexpr float TDS_REFERENCE_TEMP_C = 25.0f;
constexpr unsigned long LOG_INTERVAL_MS             = 30000;
constexpr unsigned long SENSOR_READ_INTERVAL_MS     = 10000;
constexpr unsigned long SCHEDULE_CHECK_INTERVAL_MS  = 60000;
constexpr unsigned long RELAY_POLL_INTERVAL_MS       = 30000;  // sync relay states every 30 s

// SD Card Files (daily rotation)
constexpr char FAILED_LOG_PREFIX[] = "/failed";
constexpr char PH_TDS_LOG_PREFIX[] = "/phtds";
constexpr char SENSOR_LOG_PREFIX[] = "/sensor";
constexpr char SYNCED_FOLDER[] = "/synced";
constexpr int MAX_LOG_DAYS = 7;  // Keep last 7 days



// Sensor Calibration
float pha = -0.0562836215f;
float phb = -5.903839f;
float phc = 13.816135f;
float ds18b20FallbackTempC = 25.0f;

// HTTP Log Queue (for MongoDB API responses)
constexpr int MAX_HTTP_LOG_ENTRIES = 20;
String httpLog[MAX_HTTP_LOG_ENTRIES];
int httpLogIndex = 0;
int httpLogCount = 0;

// ========== STRUCTURES ==========
struct PHTDSSchedule {
  bool enabled;
  uint8_t days;
  uint16_t hour;
  uint16_t minute;
  uint32_t lastTriggerDay;
  bool takePHReading;
  bool takeTDSReading;
  bool logToSD;
  bool publishToMongo;
};

struct SensorSnapshot {
  float airTempC;
  float humidityPct;
  float lightLux;
  float waterTempC;
  float phValue;
  float phVoltage;
  float tdsPpm;
  float ecMsCm;
  float tdsVoltage;
  uint16_t phRaw;
  uint16_t tdsRaw;
  bool ahtOk;
  bool bh1750Ok;
  bool ds18b20Ok;
  uint64_t lastReadTime;
  uint32_t readCount;
  uint32_t phTDSReadCount;
  RtcDateTime rtcTime;
};

// ========== GLOBAL VARIABLES ==========
AsyncWebServer server(80);
Preferences preferences;
Adafruit_AHTX0 aht;
BH1750 lightMeter;
OneWire oneWire(DS18B20_PIN);
DallasTemperature ds18b20(&oneWire);
ThreeWire myWire(RTC_DAT_PIN, RTC_CLK_PIN, RTC_RST_PIN);
RtcDS1302<ThreeWire> Rtc(myWire);

PHTDSSchedule phTDSchedules[MAX_PH_TDS_SCHEDULES];
SensorSnapshot sensorData;
int phTDSScheduleCount = 0;
bool timeSynced = false;
bool sdAvailable = false;
bool rtcValid = false;
bool ahtAvailable = false;
bool bh1750Available = false;
bool ds18b20Available = false;

// FreeRTOS Handles
TaskHandle_t sensorTaskHandle = NULL;
TaskHandle_t phTDSScheduleTaskHandle = NULL;

// Semaphores
SemaphoreHandle_t sensorMutex;
SemaphoreHandle_t phTDSScheduleMutex;
SemaphoreHandle_t sdMutex;
SemaphoreHandle_t dataLogMutex;

// HTTP/MongoDB state
bool mongoConnected = false;
unsigned long lastMongoAttempt = 0;
const unsigned long MONGO_RETRY_INTERVAL_MS = 30000;  // Retry every 30 seconds

// WiFi connection state
bool wifiReconnected = false;
unsigned long wifiReconnectTime = 0;
bool apModeActive = false;

// AP Mode credentials
constexpr char AP_SSID[] = "GreenPulse-";
constexpr char AP_PASSWORD[] = "12345678";

// Data send counter
unsigned long totalSentToMongo = 0;
unsigned long totalFailed = 0;

// Relay state (persists in RAM; power-cycle resets to OFF)
bool relayAirPumpOn = false;
bool relayLightOn   = false;

// ========== DEVICE CONFIGURATION (fetched from backend on startup) ==========
float cfg_ph_min           = 6.0f;
float cfg_ph_max           = 7.5f;
float cfg_ec_min           = 1.0f;
float cfg_ec_max           = 2.5f;
float cfg_wtemp_min        = 20.0f;
float cfg_wtemp_max        = 28.0f;
float cfg_atemp_min        = 18.0f;
float cfg_atemp_max        = 35.0f;
float cfg_light_min        = 3500.0f;
float cfg_light_max        = 6000.0f;
unsigned long cfg_sampling_interval_ms = 30000UL;

// Relay schedules fetched from backend (time-based on/off)
struct RelaySchedule {
  bool    enabled;
  uint8_t relayMask;      // bit 0 = relay 0 (air pump), bit 1 = relay 1 (light)
  uint8_t days;           // bitmask: bit 0 = Sunday, bit 1 = Monday … bit 6 = Saturday
  uint8_t startHour;
  uint8_t startMinute;
  uint8_t stopHour;
  uint8_t stopMinute;
};
constexpr int MAX_RELAY_SCHEDULES = 10;
RelaySchedule relaySchedules[MAX_RELAY_SCHEDULES];
int           relayScheduleCount = 0;

// ========== HTTP/MONGODB LOG FUNCTION ==========
void addToHTTPLog(const char* endpoint, int statusCode, const char* details) {
  if (xSemaphoreTake(dataLogMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
    RtcDateTime now = getRTCTime();
    char timestamp[20];
    sprintf(timestamp, "%02d:%02d:%02d", now.Hour(), now.Minute(), now.Second());
    
    String logEntry = String(timestamp) + " | " + String(endpoint) + " | " + 
                      (statusCode >= 200 && statusCode < 300 ? "OK" : "FAIL") + 
                      " | " + String(statusCode) + " | " + String(details);
    
    // Truncate long entries for display
    if (logEntry.length() > 200) {
      logEntry = logEntry.substring(0, 197) + "...";
    }
    
    httpLog[httpLogIndex] = logEntry;
    httpLogIndex = (httpLogIndex + 1) % MAX_HTTP_LOG_ENTRIES;
    if (httpLogCount < MAX_HTTP_LOG_ENTRIES) httpLogCount++;
    
    xSemaphoreGive(dataLogMutex);
  }
}

// ========== WIFI RECONNECTION HANDLER ==========
void WiFiEvent(WiFiEvent_t event) {
  switch (event) {
    case ARDUINO_EVENT_WIFI_STA_GOT_IP:
      Serial.println("[WiFi] Connected - IP: " + WiFi.localIP().toString());
      wifiReconnected = true;
      wifiReconnectTime = millis();
      // Reset MongoDB retry timer to trigger immediate sync
      lastMongoAttempt = 0;
      mongoConnected = true;
      Serial.println("[MongoDB] WiFi ready - will sync pending data");
      break;
      
    case ARDUINO_EVENT_WIFI_STA_DISCONNECTED:
      Serial.println("[WiFi] Disconnected");
      wifiReconnected = false;
      mongoConnected = false;
      break;
      
    case ARDUINO_EVENT_WIFI_STA_START:
      Serial.println("[WiFi] Station started");
      break;
      
    case ARDUINO_EVENT_WIFI_STA_CONNECTED:
      Serial.println("[WiFi] Connecting to AP...");
      break;
      
    default:
      break;
  }
}

// ========== BACKEND DATA API FUNCTIONS ==========

// Send single sensor reading to Node.js backend
bool sendToBackend(const char* jsonPayload) {
  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }
  
  HTTPClient http;
  http.setTimeout(HTTP_TIMEOUT_MS);
  
  http.begin(BACKEND_API_URL);
  http.addHeader("Content-Type", "application/json");
  
  int httpCode = http.POST(jsonPayload);
  
  if (httpCode == 200 || httpCode == 201) {
    String response = http.getString();
    http.end();
    addToHTTPLog("POST /sensor-data", httpCode, "Data saved");
    totalSentToMongo++;
    return true;
  } else {
    String error = http.getString();
    http.end();
    char detail[100];
    snprintf(detail, sizeof(detail), "HTTP %d", httpCode);
    addToHTTPLog("POST error", httpCode, detail);
    totalFailed++;
    return false;
  }
}

// Send failed payloads from SD card to MongoDB
void syncPendingData() {
  if (!sdAvailable || !mongoConnected) return;
  if (WiFi.status() != WL_CONNECTED) return;
  
  unsigned long now = millis();
  if (now - lastMongoAttempt < MONGO_RETRY_INTERVAL_MS) return;
  
  lastMongoAttempt = now;
  
  // Check all daily failed files
  for (int dayOffset = 0; dayOffset < MAX_LOG_DAYS; dayOffset++) {
    RtcDateTime checkDate = getRTCTime();
    checkDate = RtcDateTime(
      checkDate.Year(),
      checkDate.Month(),
      checkDate.Day() - dayOffset,
      0, 0, 0
    );
    
    char filename[50];
    snprintf(filename, sizeof(filename), "%s_%04d-%02d-%02d.txt", 
             SENSOR_LOG_PREFIX, 
             checkDate.Year(), checkDate.Month(), checkDate.Day());
    
    if (!SD.exists(filename)) continue;
    
    File readFile = SD.open(filename, FILE_READ);
    if (!readFile) continue;
    
    String unsyncedContent = "";
    String syncedContent = "";
    int linesSent = 0;
    int linesFailed = 0;
    String pendingReadings[100];
    int pendingCount = 0;
    
    while (readFile.available()) {
      String line = readFile.readStringUntil('\n');
      line.trim();
      if (line.length() == 0) continue;
      
      // Parse CSV line into JSON
      StaticJsonDocument<512> jsonDoc;
      jsonDoc["device_id"] = DEVICE_ID;
      jsonDoc["timestamp"] = line.substring(0, line.indexOf(','));
      
      // Parse remaining fields
      int startIdx = line.indexOf(',') + 1;
      const char* fields[] = {"ph_value", "water_temperature_c", "air_temperature_c", 
                              "ec_value", "tds_value", "light_intensity", "air_humidity", "wifi_rssi"};
      int fieldIdx = 0;
      
      while (startIdx > 0 && fieldIdx < 8) {
        int endIdx = line.indexOf(',', startIdx);
        if (endIdx == -1) endIdx = line.length();
        String value = line.substring(startIdx, endIdx);
        
        if (value.length() > 0 && value != "0" || fieldIdx < 6) {
          if (fieldIdx < 6) {
            jsonDoc[fields[fieldIdx]] = value.toFloat();
          } else if (fieldIdx == 6) {
            jsonDoc[fields[fieldIdx]] = value.toFloat();
          }
        }
        
        startIdx = (endIdx < (int)line.length()) ? endIdx + 1 : -1;
        fieldIdx++;
      }
      
      String jsonStr;
      serializeJson(jsonDoc, jsonStr);
      
      // Check sync status (last field)
      int lastComma = line.lastIndexOf(',');
      String syncStatus = (lastComma > 0) ? line.substring(lastComma + 1) : "0";
      
      if (syncStatus == "1") {
        syncedContent += line + "\n";
      } else {
        // Try to send to Backend
        if (sendToBackend(jsonStr.c_str())) {
          syncedContent += line + "\n";
          linesSent++;
        } else {
          unsyncedContent += line + "\n";
          linesFailed++;
        }
        delay(100);  // Rate limiting
      }
    }
    readFile.close();
    
    // Write back file with updated sync status
    if (unsyncedContent.length() > 0 || syncedContent.length() > 0) {
      File writeFile = SD.open(filename, FILE_WRITE);
      if (writeFile) {
        writeFile.print(unsyncedContent);
        writeFile.print(syncedContent);
        writeFile.close();
      }
    }
    
    Serial.printf("[MongoDB] Sync: %d sent, %d pending from %s\n", linesSent, linesFailed, filename);
    
    // If all synced, move to synced folder
    if (linesFailed == 0 && syncedContent.length() > 0) {
      String syncedFilename = String(SYNCED_FOLDER) + "/" + String(filename).substring(1);
      if (!SD.exists(SYNCED_FOLDER)) SD.mkdir(SYNCED_FOLDER);
      if (SD.exists(filename)) {
        SD.remove(syncedFilename.c_str());
        SD.rename(filename, syncedFilename.c_str());
      }
    }
  }
}

// ========== WIFI CREDENTIALS MANAGEMENT ==========
void loadWiFiCredentials(char* ssid, char* password) {
  preferences.begin("wifi", true);
  String storedSSID = preferences.getString("ssid", "");
  String storedPass = preferences.getString("password", "");
  
  if (storedSSID.length() > 0) {
    storedSSID.toCharArray(ssid, 64);
    storedPass.toCharArray(password, 64);
    Serial.println("[WiFi] Loaded stored credentials for: " + storedSSID);
  } else {
    Serial.println("[WiFi] No stored credentials, using defaults");
  }
  preferences.end();
}

void saveWiFiCredentials(const char* newSSID, const char* newPassword) {
  preferences.begin("wifi", false);
  preferences.putString("ssid", newSSID);
  preferences.putString("password", newPassword);
  preferences.end();
  Serial.println("[WiFi] Credentials saved - SSID: " + String(newSSID));
}

bool hasStoredWiFiCredentials() {
  preferences.begin("wifi", true);
  bool has = preferences.getString("ssid", "").length() > 0;
  preferences.end();
  return has;
}

// ========== HTML WEB INTERFACE ==========
const char index_html[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>GreenPulse Wolffia Monitor</title>
  <style>
    :root { --bg:#f4f7f1; --panel:#ffffff; --accent:#1b7f5c; --danger:#b53737; --muted:#5f6b66; --line:#d7e2dc; }
    * { box-sizing: border-box; }
    body { margin:0; font-family:"Segoe UI",Tahoma,sans-serif; background:linear-gradient(180deg,#eef6ef 0%,var(--bg) 100%); color:#183028; }
    .wrap { max-width:1200px; margin:0 auto; padding:24px 16px 40px; }
    .hero,.panel { background:var(--panel); border:1px solid var(--line); border-radius:18px; box-shadow:0 10px 30px rgba(19,54,41,.08); }
    .hero { padding:24px; margin-bottom:18px; display:grid; gap:12px; }
    .hero h1 { margin:0; font-size:28px; }
    .meta,.actions,.checkbox-row { display:flex; flex-wrap:wrap; gap:12px; }
    .meta { color:var(--muted); font-size:14px; }
    .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:14px; margin-bottom:18px; }
    .card,.panel { padding:16px; }
    .card { background:linear-gradient(135deg,#1b7f5c 0%,#249b71 100%); border-radius:16px; color:white; min-height:140px; }
    .card h3,.section-title { margin:0 0 10px; }
    .value { font-size:34px; font-weight:700; margin:6px 0; }
    .small { font-size:12px; opacity:.85; }
    .form-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; margin-bottom:12px; }
    label { display:block; font-size:13px; color:var(--muted); margin-bottom:4px; }
    .checkbox-row label { display:flex; align-items:center; gap:6px; margin:0; color:#183028; }
    input { width:100%; padding:10px; border-radius:10px; border:1px solid var(--line); background:#fff; }
    input[type="checkbox"] { width:auto; }
    table { width:100%; border-collapse:collapse; }
    th,td { text-align:left; padding:10px 8px; border-bottom:1px solid var(--line); vertical-align:top; }
    .log { background:#13211b; color:#d7f7e8; padding:14px; border-radius:14px; min-height:180px; max-height:280px; overflow:auto; font-family:Consolas,monospace; font-size:12px; }
    .log div { margin-bottom:6px; }
    .mqtt-log { background:#000000; color:#ffffff; padding:14px; border-radius:14px; min-height:200px; max-height:300px; overflow:auto; font-family:Consolas,monospace; font-size:11px; }
    .mqtt-log .success { color:#ffffff; }
    .mqtt-log .failed { color:#ff4444; }
    .mqtt-log .entry { margin-bottom:4px; border-bottom:1px solid #333; padding-bottom:4px; }
    button { border:0; border-radius:10px; padding:10px 14px; background:var(--accent); color:white; cursor:pointer; font-weight:600; }
    button.secondary { background:#dbe9e2; color:#23473a; }
    button.danger { background:var(--danger); }
    button.info { background:#2c7da0; }
    .clear-btn { background:#555; margin-bottom:10px; }
  </style>
</head>
<body>
  <div class="wrap">
    <section class="hero">
      <h1>GreenPulse Wolffia Monitor</h1>
      <div class="meta">
        <span id="deviceId"></span>
        <span id="wifiState">WiFi: --</span>
        <span id="mongoState">MongoDB: --</span>
        <span id="clock">Time: --</span>
        <span id="rtcTime">RTC: --</span>
        <span id="sdState">SD: --</span>
        <span id="dataSent">Sent: --</span>
        <span id="phTDSReads">pH/TDS Reads: --</span>
      </div>
      <div class="actions">
        <button onclick="syncTime()">Sync Time</button>
        <button class="secondary" onclick="fetchSensorData()">Refresh Sensors</button>
        <button class="info" onclick="loadPHTDSSchedules()">Refresh pH/TDS Schedules</button>
        <button class="info" onclick="takeManualReading()">Take pH/TDS Reading</button>
        <button class="secondary" onclick="showWiFiConfig()">WiFi Settings</button>
      </div>
    </section>

    <section class="grid">
      <div class="card"><h3>Air Temperature</h3><div class="value" id="airTemp">--</div><div class="small">AHT30</div></div>
      <div class="card"><h3>Air Humidity</h3><div class="value" id="humidity">--</div><div class="small">AHT30</div></div>
      <div class="card"><h3>Water Temperature</h3><div class="value" id="waterTemp">--</div><div class="small">DS18B20</div></div>
      <div class="card"><h3>Light Intensity</h3><div class="value" id="lightLux">--</div><div class="small">BH1750 lux</div></div>
      <div class="card"><h3>pH</h3><div class="value" id="phValue">--</div><div class="small" id="phMeta">ADC -- / -- V</div></div>
      <div class="card"><h3>TDS / EC</h3><div class="value" id="tdsValue">--</div><div class="small" id="tdsMeta">EC --</div></div>
    </section>

    <!-- Relay Control Panel -->
    <section class="panel" style="margin-bottom:18px;">
      <h2 class="section-title">Relay Control</h2>
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr));margin-bottom:0;">
        <div class="card" id="airPumpCard">
          <h3>Air Pump</h3>
          <div class="value" id="airPumpState">--</div>
          <div class="small">GPIO 25</div>
          <button id="airPumpBtn" onclick="toggleRelay('airPump')" style="margin-top:12px;width:100%;">Toggle</button>
        </div>
        <div class="card" id="lightCard">
          <h3>Grow Light</h3>
          <div class="value" id="lightState">--</div>
          <div class="small">GPIO 32</div>
          <button id="lightBtn" onclick="toggleRelay('light')" style="margin-top:12px;width:100%;">Toggle</button>
        </div>
      </div>
    </section>

    <section class="panel" style="margin-bottom:18px;">
      <h2 class="section-title">pH/TDS Measurement Schedule</h2>
      <div class="form-grid">
        <div><label>Time</label><input type="time" id="phtdsTime" value="12:00"></div>
      </div>
      <div class="checkbox-row">
        <label><input type="checkbox" id="takePH" checked> Take pH Reading</label>
        <label><input type="checkbox" id="takeTDS" checked> Take TDS Reading</label>
        <label><input type="checkbox" id="logToSD" checked> Log to SD Card</label>
        <label><input type="checkbox" id="publishMongo" checked> Send to MongoDB</label>
      </div>
      <div class="checkbox-row" id="phtdsDaysSelector"></div>
      <div class="actions" style="margin-bottom:12px;"><button onclick="addPHTDSSchedule()">Add pH/TDS Schedule</button></div>
      <div style="overflow:auto;">
        <table>
          <thead><tr><th>#</th><th>Days</th><th>Time</th><th>pH</th><th>TDS</th><th>Log</th><th>MongoDB</th><th>Enabled</th><th>Actions</th></tr>
          </thead>
          <tbody id="phtdsScheduleBody"></tbody>
        </table>
      </div>
    </section>

    <!-- Data Export Section -->
    <section class="panel" style="margin-bottom:18px;">
      <h2 class="section-title">Data Export</h2>
      <div class="actions">
        <button onclick="downloadToday()">Download Today's Data</button>
        <button class="secondary" onclick="refreshFileList()">Refresh File List</button>
      </div>
      <div style="margin-top:12px;">
        <label style="display:inline-block;margin-right:10px;">Download by date:</label>
        <input type="date" id="exportDate">
        <button class="secondary" onclick="downloadByDate()">Download</button>
      </div>
      <div id="fileList" style="margin-top:12px;"></div>
    </section>

    <section class="panel" id="wifiConfigPanel" style="margin-bottom:18px; display:none;">
      <h2 class="section-title">WiFi Settings</h2>
      <div class="form-grid">
        <div>
          <label>WiFi SSID</label>
          <input type="text" id="wifiSSID" placeholder="Enter WiFi SSID" maxlength="32">
        </div>
        <div>
          <label>WiFi Password</label>
          <input type="password" id="wifiPassword" placeholder="Enter WiFi Password" maxlength="64">
        </div>
      </div>
      <div class="actions">
        <button onclick="saveWiFiCredentials()">Save & Connect</button>
        <button class="secondary" onclick="hideWiFiConfig()">Cancel</button>
        <button class="danger" onclick="resetWiFiCredentials()">Reset to Default</button>
      </div>
      <div id="wifiStatus" style="margin-top:10px;color:#1b7f5c;"></div>
    </section>

    <section class="panel" style="margin-bottom:18px;">
      <h2 class="section-title">MongoDB Sync Log</h2>
      <div class="actions" style="margin-bottom:8px;">
        <button class="secondary" onclick="syncNow()">Sync Now</button>
        <button class="clear-btn" onclick="clearHTTPLog()">Clear Log</button>
      </div>
      <div class="mqtt-log" id="httpLog">
        <div>Waiting for data...</div>
      </div>
    </section>

    <section class="panel">
      <h2 class="section-title">System Activity Log</h2>
      <div class="log" id="log"></div>
    </section>
  </div>

  <script>
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    let phtdsScheduleCache = [];

    function log(message) {
      const root = document.getElementById('log');
      const item = document.createElement('div');
      item.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
      root.prepend(item);
      while (root.children.length > 60) root.removeChild(root.lastChild);
    }

    function formatNumber(value, digits = 1, suffix = '') {
      if (value === null || value === undefined || Number.isNaN(Number(value))) return '--';
      return `${Number(value).toFixed(digits)}${suffix}`;
    }

    function buildSelectors() {
      const phtdsDaysSelector = document.getElementById('phtdsDaysSelector');
      
      dayNames.forEach((day, index) => {
        const phtdsDayOption = document.createElement('label');
        phtdsDayOption.innerHTML = `<input type="checkbox" id="phtdsDaySelect${index}">${day}`;
        phtdsDaysSelector.appendChild(phtdsDayOption);
      });
    }

    async function fetchSystem() {
      try {
        const response = await fetch('/system');
        const data = await response.json();
        document.getElementById('deviceId').textContent = `Device: ${data.deviceId}`;
        document.getElementById('wifiState').textContent = `WiFi: ${data.wifiConnected ? 'Connected' : 'Disconnected'}`;
        document.getElementById('mongoState').textContent = `MongoDB: ${data.mongoConnected ? 'Connected' : 'Disconnected'}`;
        document.getElementById('clock').textContent = `Time: ${data.time}`;
        document.getElementById('rtcTime').textContent = `RTC: ${data.rtcTime}`;
        document.getElementById('phTDSReads').textContent = `pH/TDS Reads: ${data.phTDSReadCount || 0}`;
        
        // Fetch SD status
        fetchSDStatus();
      } catch (error) {
        console.error('System fetch failed:', error);
      }
    }
    
    async function fetchSDStatus() {
      try {
        const response = await fetch('/sdStatus');
        const data = await response.json();
        document.getElementById('sdState').textContent = `SD: ${data.available ? 'OK' : 'No Card'}`;
      } catch (error) {
        document.getElementById('sdState').textContent = 'SD: --';
      }
    }

    async function fetchSensorData() {
      try {
        const response = await fetch('/sensorData');
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        document.getElementById('airTemp').textContent = formatNumber(data.airTempC, 1, ' C');
        document.getElementById('humidity').textContent = formatNumber(data.humidityPct, 1, ' %');
        document.getElementById('waterTemp').textContent = formatNumber(data.waterTempC, 1, ' C');
        document.getElementById('lightLux').textContent = formatNumber(data.lightLux, 0, ' lux');
        document.getElementById('phValue').textContent = formatNumber(data.phValue, 2);
        document.getElementById('phMeta').textContent = `ADC ${data.phRaw} / ${formatNumber(data.phVoltage, 3, ' V')}`;
        document.getElementById('tdsValue').textContent = formatNumber(data.tdsPpm, 0, ' ppm');
        document.getElementById('tdsMeta').textContent = `EC ${formatNumber(data.ecMsCm, 3, ' mS/cm')}`;
        log('Sensor data refreshed successfully');
      } catch (error) {
        console.error('Sensor data fetch failed:', error);
        log('Failed to fetch sensor data - check connection');
      }
    }



    async function takeManualReading() {
      const response = await fetch('/takePHTDSReading');
      if (response.ok) {
        log('Manual pH/TDS reading triggered');
        setTimeout(fetchSensorData, 1000);
      } else {
        log('Failed to trigger pH/TDS reading');
      }
    }

    function selectedPHTDSDays() {
      const days = [];
      for (let i = 0; i < dayNames.length; i++) {
        if (document.getElementById(`phtdsDaySelect${i}`).checked) days.push(i);
      }
      return days;
    }

    async function addPHTDSSchedule() {
      const days = selectedPHTDSDays();
      if (!days.length) {
        log('Select at least one day');
        return;
      }
      const [hour, minute] = document.getElementById('phtdsTime').value.split(':').map(Number);
      const takePH = document.getElementById('takePH').checked;
      const takeTDS = document.getElementById('takeTDS').checked;
      const logToSD = document.getElementById('logToSD').checked;
      const publishMongo = document.getElementById('publishMongo').checked;
      
      if (!takePH && !takeTDS) {
        log('Select at least pH or TDS to measure');
        return;
      }
      
      const response = await fetch('/addPHTDSSchedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true, days, hour, minute, takePH, takeTDS, logToSD, publishMongo })
      });
      const data = await response.json();
      if (data.success) {
        log('pH/TDS schedule added');
        loadPHTDSSchedules();
      } else {
        log(`Failed to add pH/TDS schedule: ${data.error || 'unknown error'}`);
      }
    }

    async function deletePHTDSSchedule(index) {
      const response = await fetch(`/deletePHTDSSchedule?index=${index}`, { method: 'POST' });
      if (response.ok) {
        log(`pH/TDS schedule ${index + 1} deleted`);
        loadPHTDSSchedules();
      }
    }

    async function togglePHTDSSchedule(index, enabled) {
      const response = await fetch(`/togglePHTDSSchedule?index=${index}&enabled=${enabled ? 1 : 0}`, { method: 'POST' });
      if (response.ok) {
        log(`pH/TDS schedule ${index + 1} ${enabled ? 'enabled' : 'disabled'}`);
        loadPHTDSSchedules();
      }
    }

    function renderPHTDSSchedules() {
      const body = document.getElementById('phtdsScheduleBody');
      body.innerHTML = '';
      phtdsScheduleCache.forEach((sched, index) => {
        const days = (sched.days || []).map(i => dayNames[i]).join(', ');
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${index + 1}</td>
          <td>${days}</td>
          <td>${String(sched.hour).padStart(2, '0')}:${String(sched.minute).padStart(2, '0')}</td>
          <td>${sched.takePH ? '✓' : '✗'}</td>
          <td>${sched.takeTDS ? '✓' : '✗'}</td>
          <td>${sched.logToSD ? '✓' : '✗'}</td>
          <td>${sched.publishMongo ? '✓' : '✗'}</td>
          <td>${sched.enabled ? 'Yes' : 'No'}</td>
          <td>
            <button class="secondary" onclick="togglePHTDSSchedule(${index}, ${!sched.enabled})">${sched.enabled ? 'Disable' : 'Enable'}</button>
            <button class="danger" onclick="deletePHTDSSchedule(${index})">Delete</button>
          </td>
        `;
        body.appendChild(row);
      });
    }

    async function loadPHTDSSchedules() {
      const response = await fetch('/getPHTDSSchedules');
      const data = await response.json();
      phtdsScheduleCache = data.schedules || [];
      renderPHTDSSchedules();
    }

    async function syncTime() {
      await fetch('/syncTime');
      await fetchSystem();
      log('Time sync requested');
    }

    function showWiFiConfig() {
      document.getElementById('wifiConfigPanel').style.display = 'block';
      // Fetch current WiFi info
      fetch('/wifiConfig')
        .then(r => r.json())
        .then(data => {
          document.getElementById('wifiSSID').value = data.currentSSID || '';
          
          // Show AP mode info if active
          if (data.apMode) {
            document.getElementById('wifiStatus').innerHTML = 
              `<span style="color:#f59e0b;">⚠️ AP Mode Active!</span><br>` +
              `<span>Connect to WiFi: <strong>${data.apName}</strong></span><br>` +
              `<span>Password: <strong>${data.apPassword}</strong></span><br>` +
              `<span>Then open: http://192.168.4.1</span>`;
          } else {
            document.getElementById('wifiStatus').innerHTML = 
              `Current: ${data.currentSSID} | RSSI: ${data.rssi} dBm | IP: ${data.ip}`;
          }
        });
    }

    function hideWiFiConfig() {
      document.getElementById('wifiConfigPanel').style.display = 'none';
    }

    async function saveWiFiCredentials() {
      const ssid = document.getElementById('wifiSSID').value.trim();
      const password = document.getElementById('wifiPassword').value;
      
      if (!ssid) {
        document.getElementById('wifiStatus').style.color = '#b53737';
        document.getElementById('wifiStatus').textContent = 'Please enter WiFi SSID';
        return;
      }
      
      const statusEl = document.getElementById('wifiStatus');
      statusEl.style.color = '#1b7f5c';
      statusEl.textContent = 'Saving credentials and reconnecting...';
      
      const response = await fetch('/wifiConfig', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ssid, password })
      });
      
      if (response.ok) {
        statusEl.textContent = 'WiFi credentials saved! Reconnecting...';
        setTimeout(() => {
          hideWiFiConfig();
          log('WiFi credentials saved - reconnecting');
        }, 2000);
      } else {
        statusEl.style.color = '#b53737';
        statusEl.textContent = 'Failed to save credentials';
      }
    }

    async function resetWiFiCredentials() {
      if (!confirm('Reset WiFi to default? Device will restart.')) return;
      
      const response = await fetch('/wifiReset', { method: 'POST' });
      if (response.ok) {
        log('WiFi reset to default - restarting...');
      }
    }

    // ===== DATA EXPORT FUNCTIONS =====
    async function downloadToday() {
      try {
        const response = await fetch('/download/today');
        if (!response.ok) {
          log('No data for today');
          return;
        }
        const blob = await response.blob();
        downloadBlob(blob, 'sensor_today.csv');
        log('Downloaded today\'s data');
      } catch (error) {
        log('Failed to download today\'s data');
      }
    }

    async function downloadByDate() {
      const dateInput = document.getElementById('exportDate').value;
      if (!dateInput) {
        log('Please select a date');
        return;
      }
      
      try {
        const response = await fetch(`/download/date?date=${dateInput}`);
        if (!response.ok) {
          log('No data for selected date');
          return;
        }
        const blob = await response.blob();
        downloadBlob(blob, `sensor_${dateInput}.csv`);
        log(`Downloaded data for ${dateInput}`);
      } catch (error) {
        log('Failed to download data');
      }
    }

    function downloadBlob(blob, filename) {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }

    async function refreshFileList() {
      try {
        const response = await fetch('/files/list');
        const data = await response.json();
        
        const listDiv = document.getElementById('fileList');
        if (!data.files || data.files.length === 0) {
          listDiv.innerHTML = '<p>No data files found</p>';
          return;
        }
        
        let html = '<table style="width:100%;border-collapse:collapse;"><thead><tr><th style="text-align:left;padding:8px;">File</th><th style="text-align:right;padding:8px;">Size</th></tr></thead><tbody>';
        data.files.forEach(file => {
          html += `<tr><td style="padding:8px;border-bottom:1px solid #ddd;">${file.name}</td><td style="text-align:right;padding:8px;border-bottom:1px solid #ddd;">${formatFileSize(file.size)}</td></tr>`;
        });
        html += '</tbody></table>';
        listDiv.innerHTML = html;
      } catch (error) {
        log('Failed to load file list');
      }
    }

    function formatFileSize(bytes) {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    // ===== RELAY CONTROL =====
    function updateRelayUI(relay, state) {
      const isOn = state === 'on';
      if (relay === 'airPump') {
        document.getElementById('airPumpState').textContent = isOn ? 'ON' : 'OFF';
        document.getElementById('airPumpCard').style.background = isOn
          ? 'linear-gradient(135deg,#059669 0%,#10b981 100%)'
          : 'linear-gradient(135deg,#374151 0%,#6b7280 100%)';
      } else {
        document.getElementById('lightState').textContent = isOn ? 'ON' : 'OFF';
        document.getElementById('lightCard').style.background = isOn
          ? 'linear-gradient(135deg,#d97706 0%,#fbbf24 100%)'
          : 'linear-gradient(135deg,#374151 0%,#6b7280 100%)';
      }
    }

    async function toggleRelay(relay) {
      try {
        const response = await fetch(`/relay/${relay}`, { method: 'POST' });
        const data = await response.json();
        updateRelayUI(relay, data.state);
        log(`Relay ${relay}: ${data.state.toUpperCase()}`);
      } catch (error) {
        log(`Failed to toggle relay ${relay}`);
      }
    }

    async function fetchRelayStatus() {
      try {
        const response = await fetch('/relay/status');
        const data = await response.json();
        updateRelayUI('airPump', data.airPump);
        updateRelayUI('light', data.light);
      } catch (error) { /* ignore */ }
    }

    // ===== HTTP LOG =====
    async function fetchHTTPLog() {
      try {
        const response = await fetch('/httpLog');
        if (!response.ok) return;
        const data = await response.json();
        const logEl = document.getElementById('httpLog');
        logEl.innerHTML = '';
        (data.entries || []).forEach(entry => {
          const div = document.createElement('div');
          div.className = 'entry ' + (entry.includes('FAIL') ? 'failed' : 'success');
          div.textContent = entry;
          logEl.appendChild(div);
        });
      } catch (error) { /* ignore */ }
    }

    async function clearHTTPLog() {
      await fetch('/clearHTTPLog', { method: 'POST' });
      document.getElementById('httpLog').innerHTML = '<div>Log cleared</div>';
    }

    async function syncNow() {
      await fetch('/syncNow', { method: 'POST' });
      log('Manual sync triggered');
    }

    // Initial load
    buildSelectors();
    fetchSystem();
    fetchSensorData();
    loadPHTDSSchedules();
    refreshFileList();
    fetchRelayStatus();

    // Refresh intervals
    setInterval(fetchSystem, 3000);
    setInterval(fetchSensorData, 5000);
    setInterval(loadPHTDSSchedules, 10000);
    setInterval(fetchRelayStatus, 5000);
  </script>
</body>
</html>
)rawliteral";

// ========== UTILITY FUNCTIONS ==========
float analogToVoltage(int raw) {
  return (raw * ADC_REFERENCE_VOLTAGE) / ADC_RESOLUTION;
}

int getMedianFiltered(int pin, int samples) {
  static int analogBuffer[SENSOR_SAMPLE_COUNT];
  
  for (int i = 0; i < samples; i++) {
    analogBuffer[i] = analogRead(pin);
    delayMicroseconds(500);
  }
  
  for (int i = 0; i < samples - 1; i++) {
    for (int j = i + 1; j < samples; j++) {
      if (analogBuffer[j] < analogBuffer[i]) {
        int t = analogBuffer[i];
        analogBuffer[i] = analogBuffer[j];
        analogBuffer[j] = t;
      }
    }
  }
  
  return (samples % 2 == 0) ?
         (analogBuffer[samples / 2 - 1] + analogBuffer[samples / 2]) / 2 :
         analogBuffer[samples / 2];
}

String getISO8601Timestamp(RtcDateTime dt) {
  char timestamp[30];
  sprintf(timestamp, "%04d-%02d-%02dT%02d:%02d:%02d+07:00",
    dt.Year(), dt.Month(), dt.Day(),
    dt.Hour(), dt.Minute(), dt.Second());
  return String(timestamp);
}

String getRtcTimestamp(RtcDateTime dt) {
  char timestamp[30];
  sprintf(timestamp, "%04d-%02d-%02d %02d:%02d:%02d",
    dt.Year(), dt.Month(), dt.Day(),
    dt.Hour(), dt.Minute(), dt.Second());
  return String(timestamp);
}

RtcDateTime getRTCTime() {
  return Rtc.IsDateTimeValid() ? Rtc.GetDateTime() : RtcDateTime(2026, 4, 2, 0, 0, 0);
}

void syncRTCWithNTP() {
  if (WiFi.status() != WL_CONNECTED) return;
  
  struct tm timeinfo;
  if (getLocalTime(&timeinfo, 5000)) {
    RtcDateTime ntpTime(
      timeinfo.tm_year + 1900,
      timeinfo.tm_mon + 1,
      timeinfo.tm_mday,
      timeinfo.tm_hour,
      timeinfo.tm_min,
      timeinfo.tm_sec
    );
    Rtc.SetDateTime(ntpTime);
    Rtc.SetIsRunning(true);
    rtcValid = true;
    Serial.print("[RTC] Synced: ");
    Serial.println(getRtcTimestamp(ntpTime));
  } else {
    Serial.println("[RTC] NTP sync failed");
  }
}

void savePHTDSSchedules() {
  preferences.putInt("phTDSScheduleCount", phTDSScheduleCount);
  for (int i = 0; i < phTDSScheduleCount; i++) {
    preferences.putBytes(("phtds" + String(i)).c_str(), &phTDSchedules[i], sizeof(PHTDSSchedule));
  }
}

void loadPHTDSSchedules() {
  phTDSScheduleCount = preferences.getInt("phTDSScheduleCount", 0);
  for (int i = 0; i < phTDSScheduleCount; i++) {
    preferences.getBytes(("phtds" + String(i)).c_str(), &phTDSchedules[i], sizeof(PHTDSSchedule));
  }
  Serial.printf("Loaded %d pH/TDS schedules\n", phTDSScheduleCount);
}



// ========== SENSOR READING FUNCTIONS ==========
float readWaterTemperature() {
  ds18b20.requestTemperatures();
  float temp = ds18b20.getTempCByIndex(0);
  if (temp == DEVICE_DISCONNECTED_C) {
    sensorData.ds18b20Ok = false;
    return ds18b20FallbackTempC;
  }
  sensorData.ds18b20Ok = true;
  return temp;
}

void readAirTemperatureHumidity() {
  sensors_event_t humEvent, tempEvent;
  if (aht.getEvent(&humEvent, &tempEvent)) {
    sensorData.ahtOk = true;
    sensorData.airTempC = tempEvent.temperature;
    sensorData.humidityPct = humEvent.relative_humidity;
  } else {
    sensorData.ahtOk = false;
    sensorData.airTempC = 0;
    sensorData.humidityPct = 0;
  }
}

void readLightIntensity() {
  float lux = lightMeter.readLightLevel();
  if (lux >= 0) {
    sensorData.bh1750Ok = true;
    sensorData.lightLux = lux;
  } else {
    sensorData.bh1750Ok = false;
    sensorData.lightLux = 0;
  }
}

void readPHValue() {
  sensorData.phRaw = getMedianFiltered(PH_PIN, SENSOR_SAMPLE_COUNT);
  sensorData.phVoltage = analogToVoltage(sensorData.phRaw);
  sensorData.phValue = constrain(
    pha * sensorData.phVoltage * sensorData.phVoltage + 
    phb * sensorData.phVoltage + phc, 
    0.0f, 14.0f
  );
}

void readTDSValue() {
  sensorData.tdsRaw = getMedianFiltered(TDS_PIN, SENSOR_SAMPLE_COUNT);
  sensorData.tdsVoltage = analogToVoltage(sensorData.tdsRaw);
  
  float tdsPPM = (133.42f * pow(sensorData.tdsVoltage, 3) - 
                  255.86f * pow(sensorData.tdsVoltage, 2) + 
                  857.39f * sensorData.tdsVoltage) * 0.5f;
  
  float compCoef = 1.0f + 0.02f * (sensorData.waterTempC - TDS_REFERENCE_TEMP_C);
  sensorData.tdsPpm = tdsPPM / compCoef;
  sensorData.ecMsCm = sensorData.tdsPpm * 0.0005f;
}

void readSensors() {
  if (xSemaphoreTake(sensorMutex, pdMS_TO_TICKS(100)) != pdTRUE) return;
  
  sensorData.rtcTime = getRTCTime();
  sensorData.waterTempC = readWaterTemperature();
  readAirTemperatureHumidity();
  readLightIntensity();
  readPHValue();
  readTDSValue();
  
  sensorData.lastReadTime = millis();
  sensorData.readCount++;
  
  xSemaphoreGive(sensorMutex);
}

void takePHTDSReading(bool takePH, bool takeTDS, bool logToSD, bool publishToMongo) {
  if (xSemaphoreTake(sensorMutex, pdMS_TO_TICKS(100)) != pdTRUE) return;
  
  RtcDateTime now = getRTCTime();
  String timestamp = getISO8601Timestamp(now);
  String readingLog = timestamp + "," + DEVICE_ID + ",";
  
  StaticJsonDocument<512> mongoDoc;
  mongoDoc["device_id"] = DEVICE_ID;
  mongoDoc["timestamp"] = timestamp;
  mongoDoc["type"] = "phtds";
  
  if (takePH) {
    int phRaw = getMedianFiltered(PH_PIN, SENSOR_SAMPLE_COUNT);
    float phVoltage = analogToVoltage(phRaw);
    float phValue = constrain(
      pha * phVoltage * phVoltage + phb * phVoltage + phc,
      0.0f, 14.0f
    );
    
    readingLog += String(phValue, 2) + ",,,";
    mongoDoc["ph_value"] = phValue;
    mongoDoc["ph_raw"] = phRaw;
    mongoDoc["ph_voltage"] = phVoltage;
    sensorData.phTDSReadCount++;
    
    Serial.printf("[pH] Value: %.2f, Raw: %d, Voltage: %.3f V\n", phValue, phRaw, phVoltage);
  } else {
    readingLog += ",,,";
  }
  
  if (takeTDS) {
    int tdsRaw = getMedianFiltered(TDS_PIN, SENSOR_SAMPLE_COUNT);
    float tdsVoltage = analogToVoltage(tdsRaw);
    
    float tdsPPM = (133.42f * pow(tdsVoltage, 3) - 
                    255.86f * pow(tdsVoltage, 2) + 
                    857.39f * tdsVoltage) * 0.5f;
    
    float compCoef = 1.0f + 0.02f * (sensorData.waterTempC - TDS_REFERENCE_TEMP_C);
    tdsPPM = tdsPPM / compCoef;
    float ecMsCm = tdsPPM * 0.0005f;
    
    if (readingLog.endsWith(",")) {
      readingLog += String(tdsPPM, 0) + "," + String(ecMsCm, 3);
    } else {
      readingLog = timestamp + "," + DEVICE_ID + ",,," + String(tdsPPM, 0) + "," + String(ecMsCm, 3);
    }
    
    mongoDoc["tds_value"] = tdsPPM;
    mongoDoc["tds_raw"] = tdsRaw;
    mongoDoc["tds_voltage"] = tdsVoltage;
    mongoDoc["ec_value"] = ecMsCm;
    sensorData.phTDSReadCount++;
    
    Serial.printf("[TDS] Value: %.0f ppm, EC: %.3f mS/cm, Raw: %d, Voltage: %.3f V\n", 
                  tdsPPM, ecMsCm, tdsRaw, tdsVoltage);
  }
  
  xSemaphoreGive(sensorMutex);
  
  // Log to SD card
  if (logToSD && sdAvailable && xSemaphoreTake(sdMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
    String filename = getDailyFileName(PH_TDS_LOG_PREFIX);
    File file = SD.open(filename.c_str(), FILE_APPEND);
    if (file) {
      file.println(readingLog);
      file.close();
    }
    xSemaphoreGive(sdMutex);
  }
  
  // Try to send to MongoDB
  if (publishToMongo && WiFi.status() == WL_CONNECTED) {
    String payload;
    serializeJson(mongoDoc, payload);
    
    if (sendToMongoDB(payload.c_str())) {
      Serial.println("[MongoDB] pH/TDS reading sent");
    } else {
      Serial.println("[MongoDB] pH/TDS send failed");
    }
  }
}

// ========== SD CARD FUNCTIONS ==========

// Get today's file name with prefix
String getDailyFileName(const char* prefix) {
  RtcDateTime now = getRTCTime();
  char filename[40];
  sprintf(filename, "%s_%04d-%02d-%02d.txt", 
    prefix, now.Year(), now.Month(), now.Day());
  return String(filename);
}

// Check if string contains today's date
bool containsTodayDate(const String& str) {
  RtcDateTime now = getRTCTime();
  char today[12];
  sprintf(today, "%04d-%02d-%02d", now.Year(), now.Month(), now.Day());
  return str.indexOf(today) >= 0;
}

// Clean up old log files (keep last MAX_LOG_DAYS)
void cleanupOldLogFiles() {
  if (!sdAvailable) return;
  
  File root = SD.open("/");
  if (!root) return;
  
  File file = root.openNextFile();
  while (file) {
    String name = file.name();
    
    // Skip synced folder and non-log files
    if (name.startsWith(SYNCED_FOLDER) || !name.startsWith("/")) {
      file = root.openNextFile();
      continue;
    }
    
    // Extract date from filename (format: prefix_YYYY-MM-DD.ext)
    int underscoreIdx = name.indexOf('_');
    int dashIdx = name.indexOf('-', underscoreIdx + 5);
    
    if (underscoreIdx > 0 && dashIdx > underscoreIdx) {
      String dateStr = name.substring(underscoreIdx + 1, dashIdx + 3);
      
      // Parse date
      int year = dateStr.substring(0, 4).toInt();
      int month = dateStr.substring(5, 7).toInt();
      int day = dateStr.substring(8, 10).toInt();
      
      RtcDateTime now = getRTCTime();
      int todayTotal = now.Year() * 10000 + now.Month() * 100 + now.Day();
      int fileTotal = year * 10000 + month * 100 + day;
      
      // Delete if older than MAX_LOG_DAYS
      if (todayTotal - fileTotal > MAX_LOG_DAYS) {
        SD.remove(name.c_str());
        Serial.printf("[SD] Deleted old file: %s\n", name.c_str());
      }
    }
    
    file = root.openNextFile();
  }
  root.close();
}

// Get file size
size_t getFileSize(const char* filename) {
  File f = SD.open(filename, FILE_READ);
  if (!f) return 0;
  size_t size = f.size();
  f.close();
  return size;
}

// Count lines in file
int countFileLines(const char* filename) {
  File f = SD.open(filename, FILE_READ);
  if (!f) return 0;
  
  int count = 0;
  while (f.available()) {
    if (f.read() == '\n') count++;
  }
  f.close();
  return count;
}

void writeHeaderToSD() {
  if (!sdAvailable) return;
  
  String filename = getDailyFileName(SENSOR_LOG_PREFIX);
  File file = SD.open(filename.c_str(), FILE_APPEND);
  if (file && file.size() == 0) {
    file.println("timestamp,device_id,ph_value,water_temperature_c,air_temperature_c,ec_value,tds_value,light_intensity,air_humidity,wifi_rssi,synced");
    file.close();
    Serial.println("[SD] Header written: " + filename);
  }
}

void logSensorDataToSD() {
  if (!sdAvailable || xSemaphoreTake(sdMutex, pdMS_TO_TICKS(100)) != pdTRUE) return;
  
  String filename = getDailyFileName(SENSOR_LOG_PREFIX);
  File file = SD.open(filename.c_str(), FILE_APPEND);
  if (file) {
    RtcDateTime now = getRTCTime();
    String timestamp = getISO8601Timestamp(now);
    
    // Log with sync status: 1=synced (online), 0=pending (offline)
    bool isOnline = (WiFi.status() == WL_CONNECTED && mongoConnected);
    file.printf("%s,%s,%.2f,%.2f,%.2f,%.3f,%.0f,%.1f,%.1f,%d,%d\n",
      timestamp.c_str(),
      DEVICE_ID,
      sensorData.phValue,
      sensorData.waterTempC,
      sensorData.airTempC,
      sensorData.ecMsCm,
      sensorData.tdsPpm,
      sensorData.lightLux,
      sensorData.humidityPct,
      WiFi.RSSI(),
      isOnline ? 1 : 0  // Mark as synced if online
    );
    file.close();
  }
  xSemaphoreGive(sdMutex);
}

void logFailedPayload(String payload) {
  if (!sdAvailable || xSemaphoreTake(sdMutex, pdMS_TO_TICKS(100)) != pdTRUE) return;
  
  String filename = getDailyFileName(FAILED_LOG_PREFIX);
  File file = SD.open(filename.c_str(), FILE_APPEND);
  if (file) {
    // Add synced flag (0 = not sent yet)
    file.println(payload + ",0");
    file.close();
  }
  xSemaphoreGive(sdMutex);
}

void retryFailedPayloads() {
  if (!sdAvailable || WiFi.status() != WL_CONNECTED || xSemaphoreTake(sdMutex, pdMS_TO_TICKS(100)) != pdTRUE) return;
  
  String filename = getDailyFileName(FAILED_LOG_PREFIX);
  
  if (!SD.exists(filename.c_str())) {
    xSemaphoreGive(sdMutex);
    return;
  }
  
  // Read all lines
  File readFile = SD.open(filename.c_str(), FILE_READ);
  if (!readFile) {
    xSemaphoreGive(sdMutex);
    return;
  }
  
  String remainingContent = "";
  int linesSent = 0;
  int linesFailed = 0;
  
  while (readFile.available()) {
    String line = readFile.readStringUntil('\n');
    line.trim();
    
    if (line.length() == 0) continue;
    
    // Check if already synced
    int lastComma = line.lastIndexOf(',');
    if (lastComma > 0) {
      String syncFlag = line.substring(lastComma + 1);
      if (syncFlag == "1") {
        remainingContent += line + "\n";
        continue;
      }
    }
    
    // Try to send via HTTP to MongoDB
    String jsonPayload = line.substring(0, lastComma > 0 ? lastComma : line.length());
    if (sendToMongoDB(jsonPayload.c_str())) {
      linesSent++;
      // Mark as synced
      remainingContent += line.substring(0, lastComma > 0 ? lastComma : line.length()) + ",1\n";
    } else {
      linesFailed++;
      remainingContent += line + "\n";
    }
    delay(100);  // Rate limiting
  }
  readFile.close();
  
  // Write back remaining lines
  if (remainingContent.length() > 0) {
    File writeFile = SD.open(filename.c_str(), FILE_WRITE);
    if (writeFile) {
      writeFile.print(remainingContent);
      writeFile.close();
    }
  } else {
    // All sent - move to synced folder
    String syncedFilename = String(SYNCED_FOLDER) + "/" + filename.substring(1);
    
    if (!SD.exists(SYNCED_FOLDER)) {
      SD.mkdir(SYNCED_FOLDER);
    }
    
    if (SD.exists(filename.c_str())) {
      SD.remove(syncedFilename.c_str());
      SD.rename(filename.c_str(), syncedFilename.c_str());
      Serial.printf("[SD] Moved to synced: %s\n", filename.c_str());
    }
  }
  
  Serial.printf("[SD] Retry complete: %d sent, %d remaining\n", linesSent, linesFailed);
  xSemaphoreGive(sdMutex);
}

void sensorTask(void *pvParameters) {
  unsigned long lastRelayPoll    = 0;
  unsigned long lastScheduleCheck = 0;

  // On startup: fetch full config (thresholds + relay states + schedules) from backend
  fetchDeviceConfig();
  lastRelayPoll    = millis();
  lastScheduleCheck = millis();

  while (1) {
    readSensors();

    unsigned long nowMs = millis();

    // Poll relay states every 30 s to pick up live UI toggles between reboots
    if (nowMs - lastRelayPoll >= RELAY_POLL_INTERVAL_MS) {
      fetchAndApplyRelayStates();
      lastRelayPoll = nowMs;
    }

    // Check time-based relay schedules every 60 s
    if (nowMs - lastScheduleCheck >= SCHEDULE_CHECK_INTERVAL_MS) {
      checkRelaySchedules();
      lastScheduleCheck = nowMs;
    }
    
    RtcDateTime now = sensorData.rtcTime;
    String timestamp = getISO8601Timestamp(now);
    
    // Create JSON payload for MongoDB
    StaticJsonDocument<512> doc;
    doc["device_id"] = DEVICE_ID;
    doc["ph_value"] = sensorData.phValue;
    doc["water_temperature_c"] = sensorData.waterTempC;
    doc["air_temperature_c"] = sensorData.airTempC;
    doc["ec_value"] = sensorData.ecMsCm;
    doc["tds_value"] = sensorData.tdsPpm;
    doc["light_intensity"] = sensorData.lightLux;
    doc["air_humidity"] = sensorData.humidityPct;
    doc["timestamp"] = timestamp;
    doc["created_at"] = timestamp;
    
    String payload;
    serializeJson(doc, payload);
    
    // Log to SD card (always, regardless of connection)
    logSensorDataToSD();
    
    // Try to send to Backend if WiFi is connected
    if (WiFi.status() == WL_CONNECTED) {
      if (sendToBackend(payload.c_str())) {
        Serial.println("[Backend] Data sent successfully");
      } else {
        Serial.println("[Backend] Send failed, data saved to SD");
        // Data is already on SD, will retry later
      }
    } else {
      Serial.println("[Backend] WiFi offline, data saved to SD");
    }
    
    // Also try to sync any pending data from previous offline periods
    syncPendingData();
    
    vTaskDelay(pdMS_TO_TICKS(SENSOR_READ_INTERVAL_MS));
  }
}

void phTDSScheduleTask(void *pvParameters) {
  while (1) {
    if (rtcValid && xSemaphoreTake(phTDSScheduleMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
      RtcDateTime now = getRTCTime();
      int currentDay = now.DayOfWeek();
      int currentTimeInMin = now.Hour() * 60 + now.Minute();
      uint32_t currentDayInt = now.Day();
      
      for (int i = 0; i < phTDSScheduleCount; i++) {
        PHTDSSchedule &sched = phTDSchedules[i];
        if (!sched.enabled) continue;
        if (!(sched.days & (1 << currentDay))) continue;
        
        int scheduledTime = sched.hour * 60 + sched.minute;
        if (currentTimeInMin >= scheduledTime && currentTimeInMin < scheduledTime + 1) {
          if (sched.lastTriggerDay != currentDayInt) {
            takePHTDSReading(sched.takePHReading, sched.takeTDSReading, sched.logToSD, true);  // publishToMongoDB
            sched.lastTriggerDay = currentDayInt;
          }
        }
      }
      xSemaphoreGive(phTDSScheduleMutex);
    }
    vTaskDelay(pdMS_TO_TICKS(SCHEDULE_CHECK_INTERVAL_MS));
  }
}

// ========== WEB SERVER HANDLERS ==========
void setupWebServer() {
  server.on("/", HTTP_GET, [](AsyncWebServerRequest *request) {
    request->send_P(200, "text/html", index_html);
  });
  
  server.on("/system", HTTP_GET, [](AsyncWebServerRequest *request) {
    struct tm timeinfo;
    char timeStr[30] = "Not Synced";
    if (getLocalTime(&timeinfo)) {
      strftime(timeStr, sizeof(timeStr), "%Y-%m-%d %H:%M:%S", &timeinfo);
    }
    
    char json[256];
    snprintf(json, sizeof(json),
      "{\"deviceId\":\"%s\",\"wifiConnected\":%d,\"mongoConnected\":%d,\"phTDSReadCount\":%d,\"time\":\"%s\",\"rtcTime\":\"%s\"}",
      DEVICE_ID,
      WiFi.status() == WL_CONNECTED ? 1 : 0,
      mongoConnected ? 1 : 0,
      sensorData.phTDSReadCount,
      timeStr,
      getRtcTimestamp(getRTCTime()).c_str()
    );
    request->send(200, "application/json", json);
  });
  
  server.on("/sdStatus", HTTP_GET, [](AsyncWebServerRequest *request) {
    String json = "{\"available\":";
    json += sdAvailable ? "true" : "false";
    json += ",\"files\":[";
    
    if (sdAvailable) {
      File root = SD.open("/");
      if (root) {
        int count = 0;
        File file = root.openNextFile();
        while (file) {
          String name = file.name();
          // Skip synced folder files
          if (!name.startsWith(SYNCED_FOLDER)) {
            if (count > 0) json += ",";
            json += "{\"name\":\"" + name + "\",\"size\":" + String(file.size()) + "}";
            count++;
          }
          file = root.openNextFile();
        }
        root.close();
      }
    }
    
    json += "]}";
    request->send(200, "application/json", json);
  });
  
  server.on("/sensorData", HTTP_GET, [](AsyncWebServerRequest *request) {
    if (xSemaphoreTake(sensorMutex, pdMS_TO_TICKS(100)) != pdTRUE) {
      request->send(503, "text/plain", "Sensor data unavailable");
      return;
    }
    
    char json[512];
    snprintf(json, sizeof(json),
      "{\"airTempC\":%.2f,\"humidityPct\":%.1f,\"lightLux\":%.1f,\"waterTempC\":%.2f,\"phValue\":%.2f,\"phVoltage\":%.3f,\"tdsPpm\":%.0f,\"ecMsCm\":%.3f,\"phRaw\":%d,\"tdsRaw\":%d}",
      sensorData.airTempC,
      sensorData.humidityPct,
      sensorData.lightLux,
      sensorData.waterTempC,
      sensorData.phValue,
      sensorData.phVoltage,
      sensorData.tdsPpm,
      sensorData.ecMsCm,
      sensorData.phRaw,
      sensorData.tdsRaw
    );
    xSemaphoreGive(sensorMutex);
    request->send(200, "application/json", json);
  });
  

  
  server.on("/takePHTDSReading", HTTP_GET, [](AsyncWebServerRequest *request) {
    takePHTDSReading(true, true, true, true);
    request->send(200, "text/plain", "OK");
  });
  
  server.on("/getPHTDSSchedules", HTTP_GET, [](AsyncWebServerRequest *request) {
    String json = "{\"schedules\":[";
    if (xSemaphoreTake(phTDSScheduleMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
      for (int i = 0; i < phTDSScheduleCount; i++) {
        PHTDSSchedule &s = phTDSchedules[i];
        json += "{\"enabled\":" + String(s.enabled ? "true" : "false") + ",\"days\":[";
        for (int d = 0; d < 7; d++) {
          if (s.days & (1 << d)) json += String(d) + ",";
        }
        if (json.endsWith(",")) json = json.substring(0, json.length() - 1);
        json += "],\"hour\":" + String(s.hour) + ",\"minute\":" + String(s.minute) +
                ",\"takePH\":" + String(s.takePHReading ? "true" : "false") +
                ",\"takeTDS\":" + String(s.takeTDSReading ? "true" : "false") +
                ",\"logToSD\":" + String(s.logToSD ? "true" : "false") +
                ",\"publishMongo\":" + String(s.publishToMongo ? "true" : "false") + "}";
        if (i < phTDSScheduleCount - 1) json += ",";
      }
      xSemaphoreGive(phTDSScheduleMutex);
    }
    json += "]}";
    request->send(200, "application/json", json);
  });
  
  server.on("/addPHTDSSchedule", HTTP_POST, [](AsyncWebServerRequest *request) {
    request->send(200);
  }, NULL, [](AsyncWebServerRequest *request, uint8_t *data, size_t len, size_t index, size_t total) {
    StaticJsonDocument<512> doc;
    if (deserializeJson(doc, data, len)) {
      request->send(400, "application/json", "{\"success\":false,\"error\":\"Invalid JSON\"}");
      return;
    }
    
    if (xSemaphoreTake(phTDSScheduleMutex, pdMS_TO_TICKS(100)) != pdTRUE) {
      request->send(500, "application/json", "{\"success\":false,\"error\":\"Mutex timeout\"}");
      return;
    }
    
    if (phTDSScheduleCount >= MAX_PH_TDS_SCHEDULES) {
      xSemaphoreGive(phTDSScheduleMutex);
      request->send(400, "application/json", "{\"success\":false,\"error\":\"Max schedules reached\"}");
      return;
    }
    
    PHTDSSchedule &sched = phTDSchedules[phTDSScheduleCount++];
    sched.enabled = doc["enabled"];
    sched.hour = doc["hour"];
    sched.minute = doc["minute"];
    sched.takePHReading = doc["takePH"];
    sched.takeTDSReading = doc["takeTDS"];
    sched.logToSD = doc["logToSD"];
    sched.publishToMongo = doc["publishMongo"];
    sched.lastTriggerDay = 0;
    
    uint8_t dMask = 0;
    for (int d : doc["days"].as<JsonArray>()) dMask |= (1 << d);
    sched.days = dMask;
    
    savePHTDSSchedules();
    xSemaphoreGive(phTDSScheduleMutex);
    request->send(200, "application/json", "{\"success\":true}");
  });
  
  server.on("/deletePHTDSSchedule", HTTP_POST, [](AsyncWebServerRequest *request) {
    if (!request->hasParam("index")) {
      request->send(400);
      return;
    }
    
    int index = request->getParam("index")->value().toInt();
    if (xSemaphoreTake(phTDSScheduleMutex, pdMS_TO_TICKS(100)) != pdTRUE) {
      request->send(500);
      return;
    }
    
    if (index >= 0 && index < phTDSScheduleCount) {
      for (int i = index; i < phTDSScheduleCount - 1; i++) {
        phTDSchedules[i] = phTDSchedules[i + 1];
      }
      phTDSScheduleCount--;
      savePHTDSSchedules();
      request->send(200);
    } else {
      request->send(400);
    }
    xSemaphoreGive(phTDSScheduleMutex);
  });
  
  server.on("/togglePHTDSSchedule", HTTP_POST, [](AsyncWebServerRequest *request) {
    if (!request->hasParam("index") || !request->hasParam("enabled")) {
      request->send(400);
      return;
    }
    
    int index = request->getParam("index")->value().toInt();
    bool enabled = request->getParam("enabled")->value().toInt();
    
    if (xSemaphoreTake(phTDSScheduleMutex, pdMS_TO_TICKS(100)) != pdTRUE) {
      request->send(500);
      return;
    }
    
    if (index >= 0 && index < phTDSScheduleCount) {
      phTDSchedules[index].enabled = enabled;
      savePHTDSSchedules();
      request->send(200);
    } else {
      request->send(400);
    }
    xSemaphoreGive(phTDSScheduleMutex);
  });
  
  server.on("/syncTime", HTTP_GET, [](AsyncWebServerRequest *request) {
    configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER);
    struct tm timeinfo;
    if (getLocalTime(&timeinfo, 5000)) {
      timeSynced = true;
      syncRTCWithNTP();
    }
    request->send(200);
  });
  
  // ===== DATA EXPORT ENDPOINTS =====
  
  // Download today's sensor data as CSV
  server.on("/download/today", HTTP_GET, [](AsyncWebServerRequest *request) {
    if (!sdAvailable) {
      request->send(400, "text/plain", "SD card not available");
      return;
    }
    
    String filename = getDailyFileName(SENSOR_LOG_PREFIX);
    if (!SD.exists(filename.c_str())) {
      request->send(404, "text/plain", "No data file for today");
      return;
    }
    
    File file = SD.open(filename.c_str(), FILE_READ);
    if (!file) {
      request->send(500, "text/plain", "Failed to open file");
      return;
    }
    
    String csvContent = "";
    while (file.available()) {
      csvContent += (char)file.read();
    }
    file.close();
    
    request->send(200, "text/csv", csvContent);
  });
  
  // Download sensor data for specific date (e.g., /download/date?date=2026-04-06)
  server.on("/download/date", HTTP_GET, [](AsyncWebServerRequest *request) {
    if (!sdAvailable) {
      request->send(400, "text/plain", "SD card not available");
      return;
    }
    
    String dateStr = "";
    if (request->hasParam("date")) {
      dateStr = request->getParam("date")->value();
    } else {
      // Default to today
      RtcDateTime now = getRTCTime();
      char buf[12];
      sprintf(buf, "%04d-%02d-%02d", now.Year(), now.Month(), now.Day());
      dateStr = String(buf);
    }
    
    char filename[50];
    sprintf(filename, "%s_%s.txt", SENSOR_LOG_PREFIX, dateStr.c_str());
    
    if (!SD.exists(filename)) {
      request->send(404, "text/plain", "No data for this date");
      return;
    }
    
    File file = SD.open(filename, FILE_READ);
    if (!file) {
      request->send(500, "text/plain", "Failed to open file");
      return;
    }
    
    String csvContent = "";
    while (file.available()) {
      csvContent += (char)file.read();
    }
    file.close();
    
    request->send(200, "text/csv", csvContent);
  });
  
  // List all available data files
  server.on("/files/list", HTTP_GET, [](AsyncWebServerRequest *request) {
    if (!sdAvailable) {
      request->send(400, "application/json", "{\"available\":false}");
      return;
    }
    
    String json = "{\"available\":true,\"files\":[";
    File root = SD.open("/");
    int count = 0;
    File file = root.openNextFile();
    while (file) {
      String name = file.name();
      if (name.startsWith("/sensor_") || name.startsWith("/phtds_") || name.startsWith("/failed_")) {
        if (count > 0) json += ",";
        json += "{\"name\":\"" + name.substring(1) + "\",\"size\":" + String(file.size()) + "}";
        count++;
      }
      file = root.openNextFile();
    }
    root.close();
    json += "]}";
    request->send(200, "application/json", json);
  });
  
  // Get data summary (readings count per file)
  server.on("/data/summary", HTTP_GET, [](AsyncWebServerRequest *request) {
    if (!sdAvailable) {
      request->send(400, "text/plain", "SD card not available");
      return;
    }
    
    String json = "{\"files\":[";
    File root = SD.open("/");
    bool first = true;
    File file = root.openNextFile();
    while (file) {
      String name = file.name();
      if (name.startsWith("/sensor_") || name.startsWith("/phtds_") || name.startsWith("/failed_")) {
        int lines = 0;
        String content = "";
        while (file.available()) {
          char c = file.read();
          if (c == '\n') lines++;
          content += c;
        }
        
        if (!first) json += ",";
        first = false;
        
        json += "{\"name\":\"" + name.substring(1) + "\",\"lines\":" + String(lines) + ",\"size\":" + String(file.size()) + "}";
        
        // Reset file position for next iteration
        file.seek(0);
      }
      file = root.openNextFile();
    }
    root.close();
    json += "]}";
    request->send(200, "application/json", json);
  });
  
  // WiFi Configuration endpoints
  server.on("/wifiConfig", HTTP_GET, [](AsyncWebServerRequest *request) {
    String json = "{";
    json += "\"currentSSID\":\"" + String(WiFi.SSID()) + "\",";
    json += "\"rssi\":" + String(WiFi.RSSI()) + ",";
    json += "\"ip\":\"" + WiFi.localIP().toString() + "\",";
    json += "\"apMode\":" + String(apModeActive ? "true" : "false");
    
    if (apModeActive) {
      String apName = String(AP_SSID) + String(DEVICE_ID).substring(0, 6);
      json += ",\"apName\":\"" + apName + "\"";
      json += ",\"apPassword\":\"" + String(AP_PASSWORD) + "\"";
    }
    
    json += "}";
    request->send(200, "application/json", json);
  });
  
  server.on("/wifiConfig", HTTP_POST, [](AsyncWebServerRequest *request) {
    // Handle in body parser below
  }, NULL, [](AsyncWebServerRequest *request, uint8_t *data, size_t len, size_t index, size_t total) {
    StaticJsonDocument<512> doc;
    if (deserializeJson(doc, data, len)) {
      request->send(400, "application/json", "{\"success\":false,\"error\":\"Invalid JSON\"}");
      return;
    }
    
    const char* ssid = doc["ssid"];
    const char* password = doc["password"] | "";
    
    if (!ssid || strlen(ssid) == 0) {
      request->send(400, "application/json", "{\"success\":false,\"error\":\"SSID required\"}");
      return;
    }
    
    // Save to preferences
    saveWiFiCredentials(ssid, password);
    
    // Trigger reconnection with new credentials
    WiFi.disconnect();
    delay(100);
    WiFi.begin(ssid, password);
    

    
    request->send(200, "application/json", "{\"success\":true,\"message\":\"WiFi credentials updated\"}");
  });
  
  server.on("/wifiReset", HTTP_POST, [](AsyncWebServerRequest *request) {
    // Clear stored credentials
    preferences.begin("wifi", false);
    preferences.remove("ssid");
    preferences.remove("password");
    preferences.end();
    
    request->send(200, "application/json", "{\"success\":true,\"message\":\"Resetting to default\"}");
    
    // Restart after delay
    delay(1000);
    ESP.restart();
  });
  
  // Disable AP mode and reconnect to WiFi
  server.on("/wifi/disableAP", HTTP_POST, [](AsyncWebServerRequest *request) {
    if (apModeActive) {
      WiFi.softAPdisconnect(true);
      apModeActive = false;
      
      // Try to reconnect to stored WiFi
      char storedSSID[64] = "";
      char storedPassword[64] = "";
      loadWiFiCredentials(storedSSID, storedPassword);
      
      const char* ssid = strlen(storedSSID) > 0 ? storedSSID : WIFI_SSID;
      const char* password = strlen(storedPassword) > 0 ? storedPassword : WIFI_PASSWORD;
      
      WiFi.mode(WIFI_STA);
      WiFi.begin(ssid, password);
      
      request->send(200, "application/json", "{\"success\":true,\"message\":\"AP disabled, reconnecting to WiFi\"}");
    } else {
      request->send(200, "application/json", "{\"success\":true,\"message\":\"Not in AP mode\"}");
    }
  });
  
  // ===== RELAY CONTROL ENDPOINTS =====
  // POST /relay/airPump?state=on|off  — or omit ?state to toggle
  server.on("/relay/airPump", HTTP_POST, [](AsyncWebServerRequest *request) {
    if (request->hasParam("state")) {
      relayAirPumpOn = (request->getParam("state")->value() == "on");
    } else {
      relayAirPumpOn = !relayAirPumpOn;
    }
    setRelay(RELAY_AIR_PUMP_PIN, relayAirPumpOn);
    Serial.printf("[Relay] Air pump %s\n", relayAirPumpOn ? "ON" : "OFF");
    String json = "{\"relay\":\"airPump\",\"state\":\"";
    json += relayAirPumpOn ? "on" : "off";
    json += "\"}";
    request->send(200, "application/json", json);
  });

  // POST /relay/light?state=on|off  — or omit ?state to toggle
  server.on("/relay/light", HTTP_POST, [](AsyncWebServerRequest *request) {
    if (request->hasParam("state")) {
      relayLightOn = (request->getParam("state")->value() == "on");
    } else {
      relayLightOn = !relayLightOn;
    }
    setRelay(RELAY_LIGHT_PIN, relayLightOn);
    Serial.printf("[Relay] Light %s\n", relayLightOn ? "ON" : "OFF");
    String json = "{\"relay\":\"light\",\"state\":\"";
    json += relayLightOn ? "on" : "off";
    json += "\"}";
    request->send(200, "application/json", json);
  });

  // GET /relay/status
  server.on("/relay/status", HTTP_GET, [](AsyncWebServerRequest *request) {
    String json = "{\"airPump\":\"";
    json += relayAirPumpOn ? "on" : "off";
    json += "\",\"light\":\"";
    json += relayLightOn ? "on" : "off";
    json += "\"}";
    request->send(200, "application/json", json);
  });

  server.begin();
  Serial.println("Web server started");
}

// Helper function to escape JSON strings
String escapeJSON(String str) {
  String escaped = "";
  for (char c : str) {
    if (c == '"') escaped += "\\\"";
    else if (c == '\\') escaped += "\\\\";
    else if (c == '\n') escaped += "\\n";
    else if (c == '\r') escaped += "\\r";
    else escaped += c;
  }
  return escaped;
}

// ========== RELAY CONTROL ==========
void setRelay(int pin, bool on) {
  digitalWrite(pin, on ? RELAY_ON : RELAY_OFF);
}

void initRelays() {
  pinMode(RELAY_AIR_PUMP_PIN, OUTPUT);
  pinMode(RELAY_LIGHT_PIN, OUTPUT);
  setRelay(RELAY_AIR_PUMP_PIN, false);
  setRelay(RELAY_LIGHT_PIN, false);
  Serial.println("[Relay] Air pump (GPIO 25) and light (GPIO 32) initialized OFF");
}

// Fetch full device configuration from the backend on startup.
// Applies: thresholds, sampling interval, relay states, and relay schedules.
void fetchDeviceConfig() {
  if (WiFi.status() != WL_CONNECTED) return;

  String url = String(BACKEND_CONFIG_URL_BASE) + DEVICE_ID + "/config";
  HTTPClient http;
  http.setTimeout(8000);
  http.begin(url);

  int httpCode = http.GET();
  if (httpCode != 200) {
    http.end();
    Serial.printf("[Config] Fetch failed: HTTP %d\n", httpCode);
    return;
  }

  String body = http.getString();
  http.end();

  DynamicJsonDocument doc(2048);
  if (deserializeJson(doc, body)) {
    Serial.println("[Config] Failed to parse config JSON");
    return;
  }

  // --- Thresholds & sampling interval ---
  cfg_ph_min    = doc["ph_min"]    | cfg_ph_min;
  cfg_ph_max    = doc["ph_max"]    | cfg_ph_max;
  cfg_ec_min    = doc["ec_value_min"] | cfg_ec_min;
  cfg_ec_max    = doc["ec_value_max"] | cfg_ec_max;
  cfg_wtemp_min = doc["water_temp_min"] | cfg_wtemp_min;
  cfg_wtemp_max = doc["water_temp_max"] | cfg_wtemp_max;
  cfg_atemp_min = doc["air_temp_min"]   | cfg_atemp_min;
  cfg_atemp_max = doc["air_temp_max"]   | cfg_atemp_max;
  cfg_light_min = doc["light_intensity_min"] | cfg_light_min;
  cfg_light_max = doc["light_intensity_max"] | cfg_light_max;

  int samplingIntervalSec = doc["sampling_interval"] | 30;
  cfg_sampling_interval_ms = (unsigned long)samplingIntervalSec * 1000UL;

  Serial.printf("[Config] Fetched — sampling=%ds ph=[%.1f,%.1f] ec=[%.2f,%.2f]\n",
    samplingIntervalSec, cfg_ph_min, cfg_ph_max, cfg_ec_min, cfg_ec_max);

  // --- Relay states ---
  JsonArray relays = doc["relays"].as<JsonArray>();
  for (JsonObject relay : relays) {
    int id     = relay["relay_id"] | -1;
    bool state = relay["status"]   | false;
    if (id == 0) { relayAirPumpOn = state; setRelay(RELAY_AIR_PUMP_PIN, relayAirPumpOn); }
    else if (id == 1) { relayLightOn = state; setRelay(RELAY_LIGHT_PIN, relayLightOn); }
  }
  Serial.println("[Config] Relay states applied");

  // --- Schedules ---
  relayScheduleCount = 0;
  JsonArray schedules = doc["schedules"].as<JsonArray>();
  for (JsonObject sched : schedules) {
    if (relayScheduleCount >= MAX_RELAY_SCHEDULES) break;

    RelaySchedule& s = relaySchedules[relayScheduleCount];
    s.enabled     = sched["enabled"] | true;
    s.startHour   = sched["startHour"]   | 0;
    s.startMinute = sched["startMinute"] | 0;
    s.stopHour    = sched["stopHour"]    | 0;
    s.stopMinute  = sched["stopMinute"]  | 0;

    // Build day bitmask from days array (0=Sun … 6=Sat)
    s.days = 0;
    JsonArray daysArr = sched["days"].as<JsonArray>();
    for (int d : daysArr) {
      if (d >= 0 && d <= 6) s.days |= (1 << d);
    }

    // Build relay bitmask from relays array
    s.relayMask = 0;
    JsonArray relayIds = sched["relays"].as<JsonArray>();
    for (int r : relayIds) {
      if (r == 0 || r == 1) s.relayMask |= (1 << r);
    }

    if (s.enabled) relayScheduleCount++;
  }
  Serial.printf("[Config] Loaded %d schedule(s)\n", relayScheduleCount);
}

// Check relay schedules against current RTC time and fire setRelay() accordingly.
// Called every 60 s from sensorTask.
void checkRelaySchedules() {
  if (relayScheduleCount == 0 || !rtcValid) return;

  RtcDateTime now = getRTCTime();
  uint8_t hour   = now.Hour();
  uint8_t minute = now.Minute();
  uint8_t dow    = now.DayOfWeek();  // 0=Sunday

  for (int i = 0; i < relayScheduleCount; i++) {
    RelaySchedule& s = relaySchedules[i];
    if (!s.enabled) continue;
    if (!(s.days & (1 << dow))) continue;  // not today

    // Turn ON at start time
    if (hour == s.startHour && minute == s.startMinute) {
      if (s.relayMask & 0x01) { relayAirPumpOn = true;  setRelay(RELAY_AIR_PUMP_PIN, true); }
      if (s.relayMask & 0x02) { relayLightOn   = true;  setRelay(RELAY_LIGHT_PIN, true); }
      Serial.printf("[Schedule] Relay ON  (schedule %d) at %02d:%02d\n", i, hour, minute);
    }
    // Turn OFF at stop time
    if (hour == s.stopHour && minute == s.stopMinute) {
      if (s.relayMask & 0x01) { relayAirPumpOn = false; setRelay(RELAY_AIR_PUMP_PIN, false); }
      if (s.relayMask & 0x02) { relayLightOn   = false; setRelay(RELAY_LIGHT_PIN, false); }
      Serial.printf("[Schedule] Relay OFF (schedule %d) at %02d:%02d\n", i, hour, minute);
    }
  }
}

// Fetch relay states from the backend and apply them to the GPIO pins.
// relay_id 0 → GPIO 25 (air pump), relay_id 1 → GPIO 32 (light).
void fetchAndApplyRelayStates() {
  if (WiFi.status() != WL_CONNECTED) return;

  String url = String(BACKEND_RELAY_URL_BASE) + DEVICE_ID + "/relay-states";
  HTTPClient http;
  http.setTimeout(8000);
  http.begin(url);

  int httpCode = http.GET();
  if (httpCode == 200) {
    String body = http.getString();
    http.end();

    StaticJsonDocument<512> doc;
    if (deserializeJson(doc, body)) {
      Serial.println("[Relay] Failed to parse relay-states JSON");
      return;
    }

    JsonArray relays = doc["relays"].as<JsonArray>();
    for (JsonObject relay : relays) {
      int id     = relay["relay_id"] | -1;
      bool state = relay["status"]   | false;
      if (id == 0) {
        relayAirPumpOn = state;
        setRelay(RELAY_AIR_PUMP_PIN, relayAirPumpOn);
      } else if (id == 1) {
        relayLightOn = state;
        setRelay(RELAY_LIGHT_PIN, relayLightOn);
      }
    }
    Serial.println("[Relay] States synced from backend");
  } else {
    http.end();
    Serial.printf("[Relay] relay-states fetch failed: HTTP %d\n", httpCode);
  }
}

// ========== INITIALIZATION ==========
void initSensors() {
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  Wire.setClock(100000);
  
  ahtAvailable = aht.begin();
  bh1750Available = lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE);
  ds18b20.begin();
  ds18b20Available = ds18b20.getDeviceCount() > 0;
  
  Serial.printf("Sensors: AHT30=%s BH1750=%s DS18B20=%s\n",
    ahtAvailable ? "OK" : "FAIL",
    bh1750Available ? "OK" : "FAIL",
    ds18b20Available ? "OK" : "FAIL");
}

void initRTC() {
  Rtc.Begin();
  Rtc.SetIsWriteProtected(false);
  if (!Rtc.GetIsRunning()) Rtc.SetIsRunning(true);
  
  if (Rtc.IsDateTimeValid()) {
    RtcDateTime now = Rtc.GetDateTime();
    if (now.Year() >= 2024) {
      rtcValid = true;
      Serial.println("[RTC] Valid: " + getRtcTimestamp(now));
      return;
    }
  }
  rtcValid = false;
  Serial.println("[RTC] Needs sync");
}

void initSDCard() {
  SPI.begin(18, 19, 23, SD_CS);
  if (SD.begin(SD_CS)) {
    sdAvailable = true;
    
    // Create synced folder
    if (!SD.exists(SYNCED_FOLDER)) {
      SD.mkdir(SYNCED_FOLDER);
    }
    
    // Write headers for today's files
    writeHeaderToSD();
    
    // Cleanup old files on boot
    cleanupOldLogFiles();
    
    Serial.println("[SD] Initialized with daily rotation");
  } else {
    Serial.println("[SD] Failed");
  }
}

void initWiFi() {
  // Try to load stored WiFi credentials
  char storedSSID[64] = "";
  char storedPassword[64] = "";
  loadWiFiCredentials(storedSSID, storedPassword);
  
  const char* ssid = strlen(storedSSID) > 0 ? storedSSID : WIFI_SSID;
  const char* password = strlen(storedPassword) > 0 ? storedPassword : WIFI_PASSWORD;
  
  Serial.println("Connecting to WiFi SSID: " + String(ssid));
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected - IP: " + WiFi.localIP().toString());
    wifiReconnected = true;
    wifiReconnectTime = millis();
    apModeActive = false;
  } else {
    Serial.println("\nWiFi connection failed - Starting AP Mode");
    startAPMode();
  }
}

void startAPMode() {
  String apName = String(AP_SSID) + String(DEVICE_ID).substring(0, 6);
  
  WiFi.mode(WIFI_AP);
  WiFi.softAP(apName.c_str(), AP_PASSWORD);
  
  Serial.println("AP Mode started: " + apName);
  Serial.println("Password: " + String(AP_PASSWORD));
  Serial.println("AP IP: " + WiFi.softAPIP().toString());
  
  apModeActive = true;
}

void initTime() {
  configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER);
  struct tm timeinfo;
  if (getLocalTime(&timeinfo, 10000)) {
    timeSynced = true;
    syncRTCWithNTP();
    Serial.println("[Time] Synced");
  } else {
    Serial.println("[Time] Sync failed");
  }
}

void setup() {
  Serial.begin(115200);
  delay(100);
  
  Serial.println("\nGreenPulse Environmental Monitor Starting...");
  Serial.println("Direct HTTP to MongoDB Atlas - No MQTT");
  
  // Register WiFi event handler
  WiFi.onEvent(WiFiEvent);
  Serial.println("[WiFi] Event handler registered");
  
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);

  initRelays();
  initSensors();
  initRTC();
  initSDCard();
  
  preferences.begin("greenpulse", false);
  loadPHTDSSchedules();
  
  // Create semaphores
  sensorMutex = xSemaphoreCreateMutex();
  phTDSScheduleMutex = xSemaphoreCreateMutex();
  sdMutex = xSemaphoreCreateMutex();
  dataLogMutex = xSemaphoreCreateMutex();
  
  if (!sensorMutex || !phTDSScheduleMutex || !sdMutex || !dataLogMutex) {
    Serial.println("Semaphore creation failed!");
    while(1) delay(1000);
  }
  
  // Initial sensor read
  readSensors();
  
  initWiFi();
  initTime();
  
  // Create tasks (no MQTT task needed)
  xTaskCreatePinnedToCore(sensorTask, "Sensor", 8192, NULL, 1, &sensorTaskHandle, 1);
  xTaskCreatePinnedToCore(phTDSScheduleTask, "Schedule", 8192, NULL, 2, &phTDSScheduleTaskHandle, 1);
  
  setupWebServer();
  
  Serial.println("System Ready!");
  Serial.println("MongoDB API: " + String(MONGODB_API_URL));
  Serial.println("Web interface available at: http://" + WiFi.localIP().toString());
}

void loop() {
  static unsigned long lastSDLog = 0;
  static unsigned long lastCleanup = 0;
  static bool cleanupDoneToday = false;
  unsigned long now = millis();
  
  if (sdAvailable && (now - lastSDLog >= LOG_INTERVAL_MS)) {
    logSensorDataToSD();
    lastSDLog = now;
  }
  
  // Cleanup old files once per day (check at midnight)
  if (sdAvailable && !cleanupDoneToday) {
    RtcDateTime nowRT = getRTCTime();
    if (nowRT.Hour() == 0 && nowRT.Minute() == 0) {
      cleanupOldLogFiles();
      cleanupDoneToday = true;
    }
  }
  
  // Reset cleanup flag at midnight
  if (sdAvailable) {
    RtcDateTime nowRT = getRTCTime();
    if (nowRT.Hour() == 0 && nowRT.Minute() == 1) {
      cleanupDoneToday = false;
    }
  }
  
  vTaskDelay(pdMS_TO_TICKS(100));
}