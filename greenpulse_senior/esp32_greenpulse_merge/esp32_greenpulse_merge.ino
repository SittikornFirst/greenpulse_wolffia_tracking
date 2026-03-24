/*
  GreenPulse ESP32 - Complete Controller with pH/TDS Scheduling
  Features: Web Interface, FreeRTOS, MQTT, Time Schedules, Relays, Sensors
  Added: pH/TDS scheduling, Auto-Provisioning, Dual SD Logging
*/

#include <WiFi.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <PubSubClient.h>
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

// ========== CONFIGURATION ==========
// WiFi Credentials
const char *WIFI_SSID = "FFirst";
const char *WIFI_PASSWORD = "0971902368";

// Device Configuration
String DEVICE_ID = "";  // Loaded from NVS or provisioned via MQTT
bool provisioned = false;
const char *MQTT_SERVER = "broker.emqx.io";
const uint16_t MQTT_PORT = 1883;

// MQTT Topics
const char* MQTT_TOPIC_PUB = "greenpulse/sensors";
String MQTT_TOPIC_SUB = "";  // Built dynamically after provisioning
const char* MQTT_TOPIC_PH_TDS = "greenpulse/phtds";
const char* MQTT_TOPIC_REGISTER = "greenpulse/register/+";

// Time Settings (Thailand UTC+7)
const char *NTP_SERVER = "pool.ntp.org";
const long GMT_OFFSET_SEC = 7 * 3600;
const int DAYLIGHT_OFFSET_SEC = 0;

// Relay Configuration
const int relayPins[] = {5, 13, 12, 15, 2, 18};
const int relayCount = sizeof(relayPins) / sizeof(relayPins[0]);
const bool RELAY_ACTIVE_HIGH = true;
bool relayStates[relayCount] = {false};

// I2C Pins
const int I2C_SDA_PIN = 21;
const int I2C_SCL_PIN = 22;
const int DS18B20_PIN = 4;
const int PH_PIN = 34;
const int TDS_PIN = 35;

// Sensor Configuration
const int MAX_SCHEDULES = 20;
const int MAX_PH_TDS_SCHEDULES = 10;
const int SENSOR_SAMPLE_COUNT = 40;
const int ADC_RESOLUTION = 4095;
const float ADC_REFERENCE_VOLTAGE = 3.3f;
const float TDS_REFERENCE_TEMP_C = 25.0f;

// SD Card Config
#define SD_CS_PIN 27
bool sdAvailable = false;
const char* BACKLOG_FILE = "/backlog.jsonl";
const char* BACKLOG_TEMP = "/backlog.tmp";
const char* PH_TDS_LOG = "/phtds_log.txt";
const char* LOG_DIR = "/logs";

const uint32_t WIFI_RECONNECT_INTERVAL_MS = 10000;
const uint16_t FAILED_RETRY_DELAY_MS = 100;

// Sensor Calibration
float phSlope = 6.3781f;
float phOffset = -1.8633f;
float tdsScale = 0.5f;
float ds18b20FallbackTempC = 25.0f;

// ========== STRUCTURES ==========
struct Schedule {
  bool enabled;
  uint8_t relayMask;
  uint8_t days;
  uint16_t startHour;
  uint16_t startMinute;
  uint16_t stopHour;
  uint16_t stopMinute;
  uint32_t lastTriggerDay;
};

struct PHTDSSchedule {
  bool enabled;
  uint8_t days;
  uint16_t hour;
  uint16_t minute;
  uint32_t lastTriggerDay;
  bool takePHReading;
  bool takeTDSReading;
  bool logToSD;
  bool publishToMQTT;
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
};

// ========== GLOBAL VARIABLES ==========
AsyncWebServer server(80);
WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);
Preferences preferences;
Adafruit_AHTX0 aht;
BH1750 lightMeter;
OneWire oneWire(DS18B20_PIN);
DallasTemperature ds18b20(&oneWire);

Schedule schedules[MAX_SCHEDULES];
PHTDSSchedule phTDSchedules[MAX_PH_TDS_SCHEDULES];
SensorSnapshot sensorData;
int scheduleCount = 0;
int phTDSScheduleCount = 0;
bool timeSynced = false;
bool ahtAvailable = false;
bool bh1750Available = false;
bool ds18b20Available = false;
unsigned long lastWiFiReconnectAttempt = 0;

int analogBuffer[SENSOR_SAMPLE_COUNT];

// FreeRTOS Handles
TaskHandle_t sensorTaskHandle = NULL;
TaskHandle_t scheduleTaskHandle = NULL;
TaskHandle_t phTDSScheduleTaskHandle = NULL;
TaskHandle_t mqttTaskHandle = NULL;

// Semaphores
SemaphoreHandle_t sensorMutex;
SemaphoreHandle_t scheduleMutex;
SemaphoreHandle_t phTDSScheduleMutex;
SemaphoreHandle_t relayMutex;
SemaphoreHandle_t sdMutex;

// ========== HTML WEB INTERFACE ==========
const char index_html[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>GreenPulse Wolffia Controller</title>
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
    .relay-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; }
    .relay-card { border:1px solid var(--line); border-radius:14px; padding:14px; background:#fbfdfb; }
    .relay-state { display:inline-block; margin:8px 0 12px; padding:5px 10px; border-radius:999px; font-size:12px; font-weight:700; }
    .on { background:#d7f4e8; color:#0a6a48; }
    .off { background:#f6d9d9; color:#8d2f2f; }
    button { border:0; border-radius:10px; padding:10px 14px; background:var(--accent); color:white; cursor:pointer; font-weight:600; }
    button.secondary { background:#dbe9e2; color:#23473a; }
    button.danger { background:var(--danger); }
    button.info { background:#2c7da0; }
    .form-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; margin-bottom:12px; }
    label { display:block; font-size:13px; color:var(--muted); margin-bottom:4px; }
    .checkbox-row label { display:flex; align-items:center; gap:6px; margin:0; color:#183028; }
    input { width:100%; padding:10px; border-radius:10px; border:1px solid var(--line); background:#fff; }
    input[type="checkbox"] { width:auto; }
    table { width:100%; border-collapse:collapse; }
    th,td { text-align:left; padding:10px 8px; border-bottom:1px solid var(--line); vertical-align:top; }
    .log { background:#13211b; color:#d7f7e8; padding:14px; border-radius:14px; min-height:180px; max-height:280px; overflow:auto; font-family:Consolas,monospace; font-size:12px; }
    .log div { margin-bottom:6px; }
  </style>
</head>
<body>
  <div class="wrap">
    <section class="hero">
      <h1>GreenPulse Wolffia Controller</h1>
      <div class="meta">
        <span id="deviceId"></span>
        <span id="wifiState">WiFi: --</span>
        <span id="mqttState">MQTT: --</span>
        <span id="clock">Time: --</span>
        <span id="phTDSReads">pH/TDS Reads: --</span>
      </div>
      <div class="actions">
        <button onclick="syncTime()">Sync Time</button>
        <button class="secondary" onclick="fetchSensorData()">Refresh Sensors</button>
        <button class="secondary" onclick="loadSchedules()">Refresh Schedules</button>
        <button class="info" onclick="loadPHTDSSchedules()">Refresh pH/TDS Schedules</button>
        <button class="info" onclick="takeManualReading()">Take pH/TDS Reading</button>
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

    <section class="panel" style="margin-bottom:18px;">
      <h2 class="section-title">Manual Relay Control</h2>
      <div class="relay-grid" id="relayGrid"></div>
    </section>

    <section class="panel" style="margin-bottom:18px;">
      <h2 class="section-title">Schedule Manager (Relays)</h2>
      <div class="form-grid">
        <div><label>Start Time</label><input type="time" id="startTime" value="08:00"></div>
        <div><label>Stop Time</label><input type="time" id="stopTime" value="18:00"></div>
      </div>
      <div class="checkbox-row" id="relaySelector"></div>
      <div class="checkbox-row" id="daysSelector"></div>
      <div class="actions" style="margin-bottom:12px;"><button onclick="addSchedule()">Add Schedule</button></div>
      <div style="overflow:auto;">
         <table>
          <thead><tr><th>#</th><th>Relays</th><th>Days</th><th>Start</th><th>Stop</th><th>Enabled</th><th>Actions</th></tr></thead>
          <tbody id="scheduleBody"></tbody>
         </table>
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
        <label><input type="checkbox" id="publishMQTT" checked> Publish to MQTT</label>
      </div>
      <div class="checkbox-row" id="phtdsDaysSelector"></div>
      <div class="actions" style="margin-bottom:12px;"><button onclick="addPHTDSSchedule()">Add pH/TDS Schedule</button></div>
      <div style="overflow:auto;">
         <table>
          <thead><tr><th>#</th><th>Days</th><th>Time</th><th>pH</th><th>TDS</th><th>Log</th><th>MQTT</th><th>Enabled</th><th>Actions</th></tr></thead>
          <tbody id="phtdsScheduleBody"></tbody>
         </table>
      </div>
    </section>

    <section class="panel">
      <h2 class="section-title">Activity Log</h2>
      <div class="log" id="log"></div>
    </section>
  </div>

  <script>
    const relayPins = [5, 13, 12, 15, 2, 18];
    const relayNames = ['Pump A', 'Pump B', 'Grow Light', 'Aerator', 'Valve', 'Spare'];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    let scheduleCache = [];
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
      const relaySelector = document.getElementById('relaySelector');
      const daysSelector = document.getElementById('daysSelector');
      const phtdsDaysSelector = document.getElementById('phtdsDaysSelector');
      const relayGrid = document.getElementById('relayGrid');
      
      relayNames.forEach((name, index) => {
        const relayOption = document.createElement('label');
        relayOption.innerHTML = `<input type="checkbox" id="relaySelect${index}">${name}`;
        relaySelector.appendChild(relayOption);

        const card = document.createElement('div');
        card.className = 'relay-card';
        card.innerHTML = `
          <strong>${name}</strong>
          <span>GPIO ${relayPins[index]}</span>
          <div class="relay-state off" id="relayState${index}">OFF</div>
          <div class="actions">
            <button onclick="controlRelay(${index}, true)">ON</button>
            <button class="secondary" onclick="controlRelay(${index}, false)">OFF</button>
          </div>
        `;
        relayGrid.appendChild(card);
      });

      dayNames.forEach((day, index) => {
        const dayOption = document.createElement('label');
        dayOption.innerHTML = `<input type="checkbox" id="daySelect${index}">${day}`;
        daysSelector.appendChild(dayOption);
        
        const phtdsDayOption = document.createElement('label');
        phtdsDayOption.innerHTML = `<input type="checkbox" id="phtdsDaySelect${index}">${day}`;
        phtdsDaysSelector.appendChild(phtdsDayOption);
      });
    }

    function updateRelayCard(index, state) {
      const el = document.getElementById(`relayState${index}`);
      el.textContent = state ? 'ON' : 'OFF';
      el.className = `relay-state ${state ? 'on' : 'off'}`;
    }

    async function fetchSystem() {
      const response = await fetch('/system');
      const data = await response.json();
      document.getElementById('deviceId').textContent = `Device: ${data.deviceId}`;
      document.getElementById('wifiState').textContent = `WiFi: ${data.wifiConnected ? 'Connected' : 'Disconnected'}`;
      document.getElementById('mqttState').textContent = `MQTT: ${data.mqttConnected ? 'Connected' : 'Disconnected'}`;
      document.getElementById('clock').textContent = `Time: ${data.time}`;
      document.getElementById('phTDSReads').textContent = `pH/TDS Reads: ${data.phTDSReadCount || 0}`;
    }

    async function fetchSensorData() {
      try {
        const response = await fetch('/sensorData');
        const data = await response.json();
        document.getElementById('airTemp').textContent = formatNumber(data.airTempC, 1, ' C');
        document.getElementById('humidity').textContent = formatNumber(data.humidityPct, 1, ' %');
        document.getElementById('waterTemp').textContent = formatNumber(data.waterTempC, 1, ' C');
        document.getElementById('lightLux').textContent = formatNumber(data.lightLux, 0, ' lx');
        document.getElementById('phValue').textContent = formatNumber(data.phValue, 2);
        document.getElementById('phMeta').textContent = `ADC ${data.phRaw} / ${formatNumber(data.phVoltage, 3, ' V')}`;
        document.getElementById('tdsValue').textContent = formatNumber(data.tdsPpm, 0, ' ppm');
        document.getElementById('tdsMeta').textContent = `EC ${formatNumber(data.ecMsCm, 3, ' mS/cm')}`;
      } catch (error) {
        log('Failed to fetch sensor data');
      }
    }

    async function fetchRelayStates() {
      const response = await fetch('/states');
      const states = await response.json();
      states.forEach((state, index) => updateRelayCard(index, state));
    }

    async function controlRelay(index, state) {
      const response = await fetch(`/relay?index=${index}&state=${state ? 1 : 0}`);
      if (response.ok) {
        updateRelayCard(index, state);
        log(`Relay ${index + 1} set to ${state ? 'ON' : 'OFF'}`);
      } else {
        log(`Failed to change relay ${index + 1}`);
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

    function selectedRelays() {
      const relays = [];
      for (let i = 0; i < relayNames.length; i++) {
        if (document.getElementById(`relaySelect${i}`).checked) relays.push(i);
      }
      return relays;
    }

    function selectedDays() {
      const days = [];
      for (let i = 0; i < dayNames.length; i++) {
        if (document.getElementById(`daySelect${i}`).checked) days.push(i);
      }
      return days;
    }

    function selectedPHTDSDays() {
      const days = [];
      for (let i = 0; i < dayNames.length; i++) {
        if (document.getElementById(`phtdsDaySelect${i}`).checked) days.push(i);
      }
      return days;
    }

    async function addSchedule() {
      const relays = selectedRelays();
      const days = selectedDays();
      if (!relays.length || !days.length) {
        log('Select at least one relay and one day');
        return;
      }
      const [startHour, startMinute] = document.getElementById('startTime').value.split(':').map(Number);
      const [stopHour, stopMinute] = document.getElementById('stopTime').value.split(':').map(Number);
      const response = await fetch('/addSchedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true, relays, days, startHour, startMinute, stopHour, stopMinute })
      });
      const data = await response.json();
      if (data.success) {
        log('Schedule added');
        loadSchedules();
      } else {
        log(`Failed to add schedule: ${data.error || 'unknown error'}`);
      }
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
      const publishMQTT = document.getElementById('publishMQTT').checked;
      
      if (!takePH && !takeTDS) {
        log('Select at least pH or TDS to measure');
        return;
      }
      
      const response = await fetch('/addPHTDSSchedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true, days, hour, minute, takePH, takeTDS, logToSD, publishMQTT })
      });
      const data = await response.json();
      if (data.success) {
        log('pH/TDS schedule added');
        loadPHTDSSchedules();
      } else {
        log(`Failed to add pH/TDS schedule: ${data.error || 'unknown error'}`);
      }
    }

    async function deleteSchedule(index) {
      const response = await fetch(`/deleteSchedule?index=${index}`, { method: 'POST' });
      if (response.ok) {
        log(`Schedule ${index + 1} deleted`);
        loadSchedules();
      }
    }

    async function deletePHTDSSchedule(index) {
      const response = await fetch(`/deletePHTDSSchedule?index=${index}`, { method: 'POST' });
      if (response.ok) {
        log(`pH/TDS schedule ${index + 1} deleted`);
        loadPHTDSSchedules();
      }
    }

    async function toggleSchedule(index, enabled) {
      const response = await fetch(`/toggleSchedule?index=${index}&enabled=${enabled ? 1 : 0}`, { method: 'POST' });
      if (response.ok) {
        log(`Schedule ${index + 1} ${enabled ? 'enabled' : 'disabled'}`);
        loadSchedules();
      }
    }

    async function togglePHTDSSchedule(index, enabled) {
      const response = await fetch(`/togglePHTDSSchedule?index=${index}&enabled=${enabled ? 1 : 0}`, { method: 'POST' });
      if (response.ok) {
        log(`pH/TDS schedule ${index + 1} ${enabled ? 'enabled' : 'disabled'}`);
        loadPHTDSSchedules();
      }
    }

    function renderSchedules() {
      const body = document.getElementById('scheduleBody');
      body.innerHTML = '';
      scheduleCache.forEach((schedule, index) => {
        const relays = (schedule.relays || []).map(i => relayNames[i] || `Relay ${i + 1}`).join(', ');
        const days = (schedule.days || []).map(i => dayNames[i]).join(', ');
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${index + 1}</td>
          <td>${relays}</td>
          <td>${days}</td>
          <td>${String(schedule.startHour).padStart(2, '0')}:${String(schedule.startMinute).padStart(2, '0')}</td>
          <td>${String(schedule.stopHour).padStart(2, '0')}:${String(schedule.stopMinute).padStart(2, '0')}</td>
          <td>${schedule.enabled ? 'Yes' : 'No'}</td>
          <td>
            <button class="secondary" onclick="toggleSchedule(${index}, ${!schedule.enabled})">${schedule.enabled ? 'Disable' : 'Enable'}</button>
            <button class="danger" onclick="deleteSchedule(${index})">Delete</button>
          </td>
        `;
        body.appendChild(row);
      });
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
          <td>${sched.publishMQTT ? '✓' : '✗'}</td>
          <td>${sched.enabled ? 'Yes' : 'No'}</td>
          <td>
            <button class="secondary" onclick="togglePHTDSSchedule(${index}, ${!sched.enabled})">${sched.enabled ? 'Disable' : 'Enable'}</button>
            <button class="danger" onclick="deletePHTDSSchedule(${index})">Delete</button>
          </td>
        `;
        body.appendChild(row);
      });
    }

    async function loadSchedules() {
      const response = await fetch('/getSchedules');
      const data = await response.json();
      scheduleCache = data.schedules || [];
      renderSchedules();
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

    buildSelectors();
    fetchSystem();
    fetchSensorData();
    fetchRelayStates();
    loadSchedules();
    loadPHTDSSchedules();
    setInterval(fetchSystem, 3000);
    setInterval(fetchSensorData, 5000);
    setInterval(fetchRelayStates, 3000);
    setInterval(loadSchedules, 10000);
    setInterval(loadPHTDSSchedules, 10000);
  </script>
</body>
</html>
)rawliteral";

// ========== UTILITY FUNCTIONS ==========
float analogToVoltage(int raw) {
  return (raw * ADC_REFERENCE_VOLTAGE) / ADC_RESOLUTION;
}

int getMedianFiltered(int pin, int samples) {
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
         (analogBuffer[samples / 2]);
}

String getTimestamp() {
  struct tm timeinfo;
  if(!getLocalTime(&timeinfo)) return "N/A";
  char timeStringBuff[50];
  strftime(timeStringBuff, sizeof(timeStringBuff), "%Y-%m-%d %H:%M:%S", &timeinfo);
  return String(timeStringBuff);
}

void connectWiFi(bool force = false) {
  if (WiFi.status() == WL_CONNECTED) return;

  unsigned long now = millis();
  if (!force && (now - lastWiFiReconnectAttempt) < WIFI_RECONNECT_INTERVAL_MS) {
    return;
  }

  lastWiFiReconnectAttempt = now;
  Serial.printf("[WiFi] Connecting to %s...\n", WIFI_SSID);
  WiFi.disconnect(false, false);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

void saveSchedules() {
  preferences.putInt("scheduleCount", scheduleCount);
  for (int i = 0; i < scheduleCount; i++) {
    String key = "sched" + String(i);
    preferences.putBytes(key.c_str(), &schedules[i], sizeof(Schedule));
  }
  Serial.printf("Saved %d schedules to flash\n", scheduleCount);
}

void loadSchedules() {
  scheduleCount = preferences.getInt("scheduleCount", 0);
  for (int i = 0; i < scheduleCount; i++) {
    String key = "sched" + String(i);
    preferences.getBytes(key.c_str(), &schedules[i], sizeof(Schedule));
  }
  Serial.printf("Loaded %d schedules from flash\n", scheduleCount);
}

void savePHTDSSchedules() {
  preferences.putInt("phTDSScheduleCount", phTDSScheduleCount);
  for (int i = 0; i < phTDSScheduleCount; i++) {
    String key = "phtds" + String(i);
    preferences.putBytes(key.c_str(), &phTDSchedules[i], sizeof(PHTDSSchedule));
  }
  Serial.printf("Saved %d pH/TDS schedules to flash\n", phTDSScheduleCount);
}

void loadPHTDSSchedules() {
  phTDSScheduleCount = preferences.getInt("phTDSScheduleCount", 0);
  for (int i = 0; i < phTDSScheduleCount; i++) {
    String key = "phtds" + String(i);
    preferences.getBytes(key.c_str(), &phTDSchedules[i], sizeof(PHTDSSchedule));
  }
  Serial.printf("Loaded %d pH/TDS schedules from flash\n", phTDSScheduleCount);
}

void readSensors() {
  xSemaphoreTake(sensorMutex, portMAX_DELAY);
  
  ds18b20.requestTemperatures();
  float waterTemp = ds18b20.getTempCByIndex(0);
  if (waterTemp == DEVICE_DISCONNECTED_C) {
    sensorData.ds18b20Ok = false;
    waterTemp = ds18b20FallbackTempC;
  } else {
    sensorData.ds18b20Ok = true;
  }
  sensorData.waterTempC = waterTemp;
  
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
  
  float lux = lightMeter.readLightLevel();
  if (lux >= 0) {
    sensorData.bh1750Ok = true;
    sensorData.lightLux = lux;
  } else {
    sensorData.bh1750Ok = false;
    sensorData.lightLux = 0;
  }
  
  sensorData.phRaw = getMedianFiltered(PH_PIN, SENSOR_SAMPLE_COUNT);
  sensorData.phVoltage = analogToVoltage(sensorData.phRaw);
  sensorData.phValue = (phSlope * sensorData.phVoltage) + phOffset;
  
  sensorData.tdsRaw = getMedianFiltered(TDS_PIN, SENSOR_SAMPLE_COUNT);
  sensorData.tdsVoltage = analogToVoltage(sensorData.tdsRaw);
  float tdsPPM = (133.42 * pow(sensorData.tdsVoltage, 3) - 
                   255.86 * pow(sensorData.tdsVoltage, 2) + 
                   857.39 * sensorData.tdsVoltage) * 0.5;
  float compCoef = 1.0 + 0.02 * (waterTemp - TDS_REFERENCE_TEMP_C);
  sensorData.tdsPpm = tdsPPM / compCoef;
  sensorData.ecMsCm = sensorData.tdsPpm * 0.0005;
  
  sensorData.lastReadTime = millis();
  sensorData.readCount++;
  
  xSemaphoreGive(sensorMutex);
}

void takePHTDSReading(bool takePH, bool takeTDS, bool logToSD, bool publishToMQTT) {
  xSemaphoreTake(sensorMutex, portMAX_DELAY);
  
  String readingLog = getTimestamp() + ",";
  
  if (takePH) {
    int phRaw = getMedianFiltered(PH_PIN, SENSOR_SAMPLE_COUNT);
    float phVoltage = analogToVoltage(phRaw);
    float phValue = (phSlope * phVoltage) + phOffset;
    readingLog += String(phRaw) + "," + String(phVoltage, 3) + "," + String(phValue, 2);
    sensorData.phTDSReadCount++;
    
    Serial.printf("[pH] Raw: %d, Voltage: %.3f V, pH: %.2f\n", phRaw, phVoltage, phValue);
    
    if (publishToMQTT && mqttClient.connected()) {
      String payload = "{";
      payload += "\"device_id\":\"" + DEVICE_ID + "\",";
      payload += "\"type\":\"ph\",";
      payload += "\"timestamp\":\"" + getTimestamp() + "\",";
      payload += "\"raw\":" + String(phRaw) + ",";
      payload += "\"voltage\":" + String(phVoltage, 3) + ",";
      payload += "\"value\":" + String(phValue, 2);
      payload += "}";
      mqttClient.publish(MQTT_TOPIC_PH_TDS, payload.c_str());
    }
  } else {
    readingLog += ",,,";
  }
  
  readingLog += ",";
  
  if (takeTDS) {
    int tdsRaw = getMedianFiltered(TDS_PIN, SENSOR_SAMPLE_COUNT);
    float tdsVoltage = analogToVoltage(tdsRaw);
    float waterTemp = sensorData.waterTempC;
    float tdsPPM = (133.42 * pow(tdsVoltage, 3) - 
                     255.86 * pow(tdsVoltage, 2) + 
                     857.39 * tdsVoltage) * 0.5;
    float compCoef = 1.0 + 0.02 * (waterTemp - TDS_REFERENCE_TEMP_C);
    tdsPPM = tdsPPM / compCoef;
    float ecMsCm = tdsPPM * 0.0005;
    
    readingLog += String(tdsRaw) + "," + String(tdsVoltage, 3) + "," + String(tdsPPM, 0) + "," + String(ecMsCm, 3);
    sensorData.phTDSReadCount++;
    
    Serial.printf("[TDS] Raw: %d, Voltage: %.3f V, TDS: %.0f ppm, EC: %.3f mS/cm\n", 
                  tdsRaw, tdsVoltage, tdsPPM, ecMsCm);
    
    if (publishToMQTT && mqttClient.connected()) {
      String payload = "{";
      payload += "\"device_id\":\"" + DEVICE_ID + "\",";
      payload += "\"type\":\"tds\",";
      payload += "\"timestamp\":\"" + getTimestamp() + "\",";
      payload += "\"raw\":" + String(tdsRaw) + ",";
      payload += "\"voltage\":" + String(tdsVoltage, 3) + ",";
      payload += "\"ppm\":" + String(tdsPPM, 0) + ",";
      payload += "\"ec\":" + String(ecMsCm, 3);
      payload += "}";
      mqttClient.publish(MQTT_TOPIC_PH_TDS, payload.c_str());
    }
  }
  
  xSemaphoreGive(sensorMutex);
  
  if (logToSD && sdAvailable) {
    xSemaphoreTake(sdMutex, portMAX_DELAY);
    File file = SD.open(PH_TDS_LOG, FILE_APPEND);
    if (file) {
      file.println(readingLog);
      file.close();
      Serial.println("[SD] pH/TDS reading logged");
    } else {
      Serial.println("[SD] Failed to open pH/TDS log");
    }
    xSemaphoreGive(sdMutex);
  }
}

// ========== SYSTEM EVENT LOGGER ==========
void sysLog(String level, String msg) {
  String ts = getTimestamp();
  String logLine = "[" + ts + "] [" + level + "] " + msg;
  Serial.println(logLine);

  if (!sdAvailable) return;
  if (xSemaphoreTake(sdMutex, pdMS_TO_TICKS(1000))) {
    // Ensure /logs directory exists
    if (!SD.exists(LOG_DIR)) {
      SD.mkdir(LOG_DIR);
    }
    // Build filename: /logs/YYYY-MM-DD.log
    String filename = String(LOG_DIR) + "/" + ts.substring(0, 10) + ".log";
    File file = SD.open(filename.c_str(), FILE_APPEND);
    if (file) {
      file.println(logLine);
      file.close();
    }
    xSemaphoreGive(sdMutex);
  }
}

// ========== DATA BACKLOG (for offline sync) ==========
void saveBacklog(String payload) {
  if (!sdAvailable) return;
  
  if (xSemaphoreTake(sdMutex, pdMS_TO_TICKS(1000))) {
    File file = SD.open(BACKLOG_FILE, FILE_APPEND);
    if (file) {
      file.println(payload);
      file.close();
      sysLog("INFO", "Sensor payload saved to backlog");
    } else {
      Serial.println("[SD] Failed to open backlog file for writing.");
    }
    xSemaphoreGive(sdMutex);
  }
}

void retryBacklog() {
  if (!sdAvailable) return;

  if (xSemaphoreTake(sdMutex, pdMS_TO_TICKS(1000))) {
    if (SD.exists(BACKLOG_FILE)) {
      File file = SD.open(BACKLOG_FILE, FILE_READ);
      if (file) {
        sysLog("INFO", "Found backlog data. Retrying sync...");
        SD.remove(BACKLOG_TEMP);
        File tempFile = SD.open(BACKLOG_TEMP, FILE_WRITE);
        bool allSent = true;
        int sentCount = 0;
        if (!tempFile) {
          file.close();
          xSemaphoreGive(sdMutex);
          sysLog("ERROR", "Failed to open backlog temp file");
          return;
        }

        while (file.available()) {
          String payload = file.readStringUntil('\n');
          payload.trim();
          if (payload.length() == 0) {
            continue;
          }

          if (mqttClient.connected() && mqttClient.publish(MQTT_TOPIC_PUB, payload.c_str())) {
            sentCount++;
            delay(FAILED_RETRY_DELAY_MS);
          } else {
            sysLog("WARN", "Backlog resend failed. Keeping remaining entries.");
            tempFile.println(payload);
            allSent = false;

            while (file.available()) {
              String pendingPayload = file.readStringUntil('\n');
              pendingPayload.trim();
              if (pendingPayload.length() > 0) {
                tempFile.println(pendingPayload);
              }
            }
            break;
          }
        }

        file.close();
        tempFile.close();
        
        if (allSent) {
          SD.remove(BACKLOG_FILE);
          SD.remove(BACKLOG_TEMP);
          sysLog("INFO", "Backlog cleared. Sent " + String(sentCount) + " entries.");
        } else {
          SD.remove(BACKLOG_FILE);
          SD.rename(BACKLOG_TEMP, BACKLOG_FILE);
          sysLog("INFO", "Partial backlog sync. Sent " + String(sentCount) + " entries.");
        }
      }
    }
    xSemaphoreGive(sdMutex);
  }
}

// ========== MQTT CALLBACK ==========
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String msg;
  for (int i = 0; i < length; i++) msg += (char)payload[i];
  String topicStr = String(topic);

  // ---- PROVISIONING: Handle registration messages ----
  if (topicStr.startsWith("greenpulse/register/") && !provisioned) {
    StaticJsonDocument<512> doc;
    DeserializationError error = deserializeJson(doc, msg);
    if (error) {
      sysLog("ERROR", "Failed to parse registration JSON");
      return;
    }

    const char* event = doc["event"];
    if (event && strcmp(event, "device_registered") == 0) {
      String newId = doc["device_id"].as<String>();
      if (newId.length() > 0) {
        DEVICE_ID = newId;
        MQTT_TOPIC_SUB = "greenpulse/control/" + DEVICE_ID;
        provisioned = true;

        // Save to NVS for future boots
        preferences.putString("deviceId", DEVICE_ID);
        sysLog("INFO", "Device provisioned with ID: " + DEVICE_ID);

        // Unsubscribe from wildcard, subscribe to our control topic
        mqttClient.unsubscribe(MQTT_TOPIC_REGISTER);
        mqttClient.subscribe(MQTT_TOPIC_SUB.c_str());
        sysLog("INFO", "Subscribed to control topic: " + MQTT_TOPIC_SUB);
      }
    }
    return;
  }

  // ---- NORMAL COMMANDS (only when provisioned) ----
  sysLog("DEBUG", "MQTT Command: " + msg);

  StaticJsonDocument<1024> doc;
  DeserializationError error = deserializeJson(doc, msg);
  if (error) {
    sysLog("ERROR", "Failed to parse MQTT JSON command");
    return;
  }

  const char* command = doc["command"];
  if (!command) return;
  
  if (strcmp(command, "update_relay") == 0) {
    int r = doc["relay"];
    bool status = doc["status"];
    if (r >= 0 && r < relayCount) {
      xSemaphoreTake(relayMutex, portMAX_DELAY);
      relayStates[r] = status;
      digitalWrite(relayPins[r], status ? HIGH : LOW);
      xSemaphoreGive(relayMutex);
      sysLog("INFO", "Relay " + String(r) + " set to " + String(status ? "ON" : "OFF") + " via cloud");
    }
  }

  if (strcmp(command, "update_schedules") == 0) {
    JsonArray schedArray = doc["schedules"];
    
    xSemaphoreTake(scheduleMutex, portMAX_DELAY);
    scheduleCount = 0;
    
    for (JsonObject s : schedArray) {
      if (scheduleCount >= MAX_SCHEDULES) break;

      schedules[scheduleCount].enabled = s["enabled"];
      schedules[scheduleCount].startHour = s["startHour"];
      schedules[scheduleCount].startMinute = s["startMinute"];
      schedules[scheduleCount].stopHour = s["stopHour"];
      schedules[scheduleCount].stopMinute = s["stopMinute"];
      schedules[scheduleCount].lastTriggerDay = 0;

      uint8_t rMask = 0;
      for (int r : s["relays"].as<JsonArray>()) {
        rMask |= (1 << r);
      }
      schedules[scheduleCount].relayMask = rMask;

      uint8_t dMask = 0;
      for (int d : s["days"].as<JsonArray>()) {
        dMask |= (1 << d);
      }
      schedules[scheduleCount].days = dMask;

      scheduleCount++;
    }
    xSemaphoreGive(scheduleMutex);
    
    saveSchedules();
    sysLog("INFO", "Updated & saved " + String(scheduleCount) + " schedules via cloud");
  }
  
  if (strcmp(command, "take_reading") == 0) {
    bool takePH = doc["ph"] | true;
    bool takeTDS = doc["tds"] | true;
    bool logToSD = doc["log"] | true;
    bool publish = doc["publish"] | true;
    takePHTDSReading(takePH, takeTDS, logToSD, publish);
    sysLog("INFO", "Manual pH/TDS reading triggered via cloud");
  }
}

// ========== FREE RTOS TASKS ==========
static bool wasWiFiConnected = false;

void mqttTask(void *pvParameters) {
  while (1) {
    bool wifiConnected = (WiFi.status() == WL_CONNECTED);

    // Detect WiFi state transitions for logging
    if (wifiConnected && !wasWiFiConnected) {
      sysLog("INFO", "WiFi connected. IP: " + WiFi.localIP().toString());
      // Re-sync NTP after reconnect
      configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER);
      struct tm timeinfo;
      if (getLocalTime(&timeinfo, 5000)) {
        timeSynced = true;
        sysLog("INFO", "NTP re-synced after WiFi reconnect");
      }
    } else if (!wifiConnected && wasWiFiConnected) {
      sysLog("WARN", "WiFi disconnected. Logging to SD card.");
    }
    wasWiFiConnected = wifiConnected;

    if (!wifiConnected) {
      connectWiFi();
      if (mqttClient.connected()) {
        mqttClient.disconnect();
      }
    } else {
      if (!mqttClient.connected()) {
        sysLog("INFO", "MQTT connecting...");
        String clientId = "GreenPulse-" + String(random(0xffff), HEX);
        if (mqttClient.connect(clientId.c_str())) {
          sysLog("INFO", "MQTT connected");

          if (provisioned) {
            // Normal mode: subscribe to our device control topic
            mqttClient.subscribe(MQTT_TOPIC_SUB.c_str());
            sysLog("INFO", "Subscribed to: " + MQTT_TOPIC_SUB);
            retryBacklog();
          } else {
            // Provisioning mode: listen for registration messages
            mqttClient.subscribe(MQTT_TOPIC_REGISTER);
            sysLog("INFO", "Provisioning mode: listening on greenpulse/register/+");
          }
        } else {
          sysLog("ERROR", "MQTT connect failed, rc=" + String(mqttClient.state()));
        }
      } else {
        mqttClient.loop();
      }
    }
    vTaskDelay(pdMS_TO_TICKS(500));
  }
}

void sensorTask(void *pvParameters) {
  const TickType_t xDelay = pdMS_TO_TICKS(10000);
  
  while (1) {
    readSensors();

    // Only publish/backlog if device is provisioned
    if (provisioned) {
      String payload = "{";
      payload += "\"device_id\":\"" + DEVICE_ID + "\",";
      payload += "\"ts\":\"" + getTimestamp() + "\",";
      payload += "\"water_c\":" + String(sensorData.waterTempC, 2) + ",";
      payload += "\"air_c\":" + String(sensorData.airTempC, 2) + ",";
      payload += "\"hum\":" + String(sensorData.humidityPct, 1) + ",";
      payload += "\"lux\":" + String(sensorData.lightLux, 1) + ",";
      payload += "\"ph\":{\"adc\":" + String(sensorData.phRaw) + ",\"v\":" + String(sensorData.phVoltage, 3) + ",\"val\":" + String(sensorData.phValue, 2) + "},";
      payload += "\"tds\":{\"adc\":" + String(sensorData.tdsRaw) + ",\"v\":" + String(sensorData.tdsVoltage, 3) + ",\"ppm\":" + String(sensorData.tdsPpm, 0) + ",\"ec\":" + String(sensorData.ecMsCm, 3) + "},";
      payload += "\"relays\":[";
      
      xSemaphoreTake(relayMutex, portMAX_DELAY);
      for(int i = 0; i < relayCount; i++) {
        payload += relayStates[i] ? "1" : "0";
        if (i < relayCount - 1) payload += ",";
      }
      xSemaphoreGive(relayMutex);
      payload += "]}";

      if (mqttClient.connected() && mqttClient.publish(MQTT_TOPIC_PUB, payload.c_str())) {
        // Published OK — no log to avoid noise in system log
      } else {
        sysLog("WARN", "MQTT publish failed. Saving to backlog.");
        saveBacklog(payload);
      }
    }
    
    vTaskDelay(xDelay);
  }
}

void scheduleTask(void *pvParameters) {
  const TickType_t xDelay = pdMS_TO_TICKS(2000);
  
  while (1) {
    if (timeSynced) {
      struct tm timeinfo;
      if (getLocalTime(&timeinfo)) {
        int currentDay = timeinfo.tm_wday;
        int currentTimeInMin = timeinfo.tm_hour * 60 + timeinfo.tm_min;
        uint32_t currentDayInt = (uint32_t)timeinfo.tm_yday;
        
        xSemaphoreTake(scheduleMutex, portMAX_DELAY);
        for (int i = 0; i < scheduleCount; i++) {
          if (!schedules[i].enabled) continue;
          if (!(schedules[i].days & (1 << currentDay))) continue;
          
          int startTime = schedules[i].startHour * 60 + schedules[i].startMinute;
          int stopTime = schedules[i].stopHour * 60 + schedules[i].stopMinute;
          
          if (currentTimeInMin >= startTime && currentTimeInMin < stopTime) {
            if (schedules[i].lastTriggerDay != currentDayInt) {
              xSemaphoreTake(relayMutex, portMAX_DELAY);
              for (int r = 0; r < relayCount; r++) {
                if (schedules[i].relayMask & (1 << r)) {
                  digitalWrite(relayPins[r], HIGH);
                  relayStates[r] = true;
                }
              }
              xSemaphoreGive(relayMutex);
              schedules[i].lastTriggerDay = currentDayInt;
              Serial.printf("[Auto] Schedule %d ON\n", i);
            }
          } else if (currentTimeInMin >= stopTime) {
            if (schedules[i].lastTriggerDay == currentDayInt) {
              xSemaphoreTake(relayMutex, portMAX_DELAY);
              for (int r = 0; r < relayCount; r++) {
                if (schedules[i].relayMask & (1 << r)) {
                  digitalWrite(relayPins[r], LOW);
                  relayStates[r] = false;
                }
              }
              xSemaphoreGive(relayMutex);
              schedules[i].lastTriggerDay = 0;
              Serial.printf("[Auto] Schedule %d OFF\n", i);
            }
          }
        }
        xSemaphoreGive(scheduleMutex);
      }
    }
    vTaskDelay(xDelay);
  }
}

void phTDSScheduleTask(void *pvParameters) {
  const TickType_t xDelay = pdMS_TO_TICKS(60000);
  
  while (1) {
    if (timeSynced) {
      struct tm timeinfo;
      if (getLocalTime(&timeinfo)) {
        int currentDay = timeinfo.tm_wday;
        int currentTimeInMin = timeinfo.tm_hour * 60 + timeinfo.tm_min;
        uint32_t currentDayInt = (uint32_t)timeinfo.tm_yday;
        
        xSemaphoreTake(phTDSScheduleMutex, portMAX_DELAY);
        for (int i = 0; i < phTDSScheduleCount; i++) {
          if (!phTDSchedules[i].enabled) continue;
          if (!(phTDSchedules[i].days & (1 << currentDay))) continue;
          
          int scheduledTime = phTDSchedules[i].hour * 60 + phTDSchedules[i].minute;
          
          if (currentTimeInMin >= scheduledTime && currentTimeInMin < scheduledTime + 1) {
            if (phTDSchedules[i].lastTriggerDay != currentDayInt) {
              takePHTDSReading(
                phTDSchedules[i].takePHReading,
                phTDSchedules[i].takeTDSReading,
                phTDSchedules[i].logToSD,
                phTDSchedules[i].publishToMQTT
              );
              phTDSchedules[i].lastTriggerDay = currentDayInt;
              Serial.printf("[Auto] pH/TDS Schedule %d triggered at %02d:%02d\n", 
                           i, phTDSchedules[i].hour, phTDSchedules[i].minute);
            }
          }
        }
        xSemaphoreGive(phTDSScheduleMutex);
      }
    }
    vTaskDelay(xDelay);
  }
}

// ========== WEB SERVER HANDLERS ==========
void setupWebServer() {
  server.on("/", HTTP_GET, [](AsyncWebServerRequest *request) {
    request->send_P(200, "text/html", index_html);
  });
  
  server.on("/system", HTTP_GET, [](AsyncWebServerRequest *request) {
    String json = "{";
    json += "\"deviceId\":\"" + DEVICE_ID + "\",";
    json += "\"provisioned\":" + String(provisioned ? "true" : "false") + ",";
    json += "\"wifiConnected\":" + String(WiFi.status() == WL_CONNECTED) + ",";
    json += "\"mqttConnected\":" + String(mqttClient.connected()) + ",";
    json += "\"phTDSReadCount\":" + String(sensorData.phTDSReadCount) + ",";
    
    struct tm timeinfo;
    char timeStr[30];
    if(getLocalTime(&timeinfo)) {
      strftime(timeStr, sizeof(timeStr), "%Y-%m-%d %H:%M:%S", &timeinfo);
      json += "\"time\":\"" + String(timeStr) + "\"";
    } else {
      json += "\"time\":\"Not Synced\"";
    }
    json += "}";
    request->send(200, "application/json", json);
  });
  
  server.on("/sensorData", HTTP_GET, [](AsyncWebServerRequest *request) {
    xSemaphoreTake(sensorMutex, portMAX_DELAY);
    String json = "{";
    json += "\"airTempC\":" + String(sensorData.airTempC) + ",";
    json += "\"humidityPct\":" + String(sensorData.humidityPct) + ",";
    json += "\"lightLux\":" + String(sensorData.lightLux) + ",";
    json += "\"waterTempC\":" + String(sensorData.waterTempC) + ",";
    json += "\"phValue\":" + String(sensorData.phValue) + ",";
    json += "\"phVoltage\":" + String(sensorData.phVoltage) + ",";
    json += "\"tdsPpm\":" + String(sensorData.tdsPpm) + ",";
    json += "\"ecMsCm\":" + String(sensorData.ecMsCm) + ",";
    json += "\"phRaw\":" + String(sensorData.phRaw) + ",";
    json += "\"tdsRaw\":" + String(sensorData.tdsRaw);
    json += "}";
    xSemaphoreGive(sensorMutex);
    request->send(200, "application/json", json);
  });
  
  server.on("/states", HTTP_GET, [](AsyncWebServerRequest *request) {
    String json = "[";
    xSemaphoreTake(relayMutex, portMAX_DELAY);
    for (int i = 0; i < relayCount; i++) {
      json += relayStates[i] ? "true" : "false";
      if (i < relayCount - 1) json += ",";
    }
    xSemaphoreGive(relayMutex);
    json += "]";
    request->send(200, "application/json", json);
  });
  
  server.on("/relay", HTTP_GET, [](AsyncWebServerRequest *request) {
    if (request->hasParam("index") && request->hasParam("state")) {
      int index = request->getParam("index")->value().toInt();
      bool state = request->getParam("state")->value().toInt();
      if (index >= 0 && index < relayCount) {
        xSemaphoreTake(relayMutex, portMAX_DELAY);
        relayStates[index] = state;
        digitalWrite(relayPins[index], state ? HIGH : LOW);
        xSemaphoreGive(relayMutex);
        request->send(200, "text/plain", "OK");
        return;
      }
    }
    request->send(400, "text/plain", "Bad Request");
  });
  
  server.on("/takePHTDSReading", HTTP_GET, [](AsyncWebServerRequest *request) {
    takePHTDSReading(true, true, true, true);
    request->send(200, "text/plain", "OK");
  });
  
  server.on("/getSchedules", HTTP_GET, [](AsyncWebServerRequest *request) {
    String json = "{\"schedules\":[";
    xSemaphoreTake(scheduleMutex, portMAX_DELAY);
    for (int i = 0; i < scheduleCount; i++) {
      json += "{";
      json += "\"enabled\":" + String(schedules[i].enabled ? "true" : "false") + ",";
      json += "\"relays\":[";
      for (int r = 0; r < relayCount; r++) {
        if (schedules[i].relayMask & (1 << r)) {
          json += String(r) + ",";
        }
      }
      if (json.endsWith(",")) json = json.substring(0, json.length() - 1);
      json += "],";
      json += "\"days\":[";
      for (int d = 0; d < 7; d++) {
        if (schedules[i].days & (1 << d)) {
          json += String(d) + ",";
        }
      }
      if (json.endsWith(",")) json = json.substring(0, json.length() - 1);
      json += "],";
      json += "\"startHour\":" + String(schedules[i].startHour) + ",";
      json += "\"startMinute\":" + String(schedules[i].startMinute) + ",";
      json += "\"stopHour\":" + String(schedules[i].stopHour) + ",";
      json += "\"stopMinute\":" + String(schedules[i].stopMinute);
      json += "}";
      if (i < scheduleCount - 1) json += ",";
    }
    xSemaphoreGive(scheduleMutex);
    json += "]}";
    request->send(200, "application/json", json);
  });
  
  server.on("/getPHTDSSchedules", HTTP_GET, [](AsyncWebServerRequest *request) {
    String json = "{\"schedules\":[";
    xSemaphoreTake(phTDSScheduleMutex, portMAX_DELAY);
    for (int i = 0; i < phTDSScheduleCount; i++) {
      json += "{";
      json += "\"enabled\":" + String(phTDSchedules[i].enabled ? "true" : "false") + ",";
      json += "\"days\":[";
      for (int d = 0; d < 7; d++) {
        if (phTDSchedules[i].days & (1 << d)) {
          json += String(d) + ",";
        }
      }
      if (json.endsWith(",")) json = json.substring(0, json.length() - 1);
      json += "],";
      json += "\"hour\":" + String(phTDSchedules[i].hour) + ",";
      json += "\"minute\":" + String(phTDSchedules[i].minute) + ",";
      json += "\"takePH\":" + String(phTDSchedules[i].takePHReading ? "true" : "false") + ",";
      json += "\"takeTDS\":" + String(phTDSchedules[i].takeTDSReading ? "true" : "false") + ",";
      json += "\"logToSD\":" + String(phTDSchedules[i].logToSD ? "true" : "false") + ",";
      json += "\"publishMQTT\":" + String(phTDSchedules[i].publishToMQTT ? "true" : "false");
      json += "}";
      if (i < phTDSScheduleCount - 1) json += ",";
    }
    xSemaphoreGive(phTDSScheduleMutex);
    json += "]}";
    request->send(200, "application/json", json);
  });
  
  server.on("/addSchedule", HTTP_POST, [](AsyncWebServerRequest *request) {
    request->send(200);
  }, NULL, [](AsyncWebServerRequest *request, uint8_t *data, size_t len, size_t index, size_t total) {
    StaticJsonDocument<512> doc;
    DeserializationError error = deserializeJson(doc, data, len);
    if (error) {
      request->send(400, "application/json", "{\"success\":false,\"error\":\"Invalid JSON\"}");
      return;
    }
    
    xSemaphoreTake(scheduleMutex, portMAX_DELAY);
    if (scheduleCount < MAX_SCHEDULES) {
      schedules[scheduleCount].enabled = doc["enabled"];
      schedules[scheduleCount].startHour = doc["startHour"];
      schedules[scheduleCount].startMinute = doc["startMinute"];
      schedules[scheduleCount].stopHour = doc["stopHour"];
      schedules[scheduleCount].stopMinute = doc["stopMinute"];
      schedules[scheduleCount].lastTriggerDay = 0;
      
      uint8_t rMask = 0;
      for (int r : doc["relays"].as<JsonArray>()) {
        rMask |= (1 << r);
      }
      schedules[scheduleCount].relayMask = rMask;
      
      uint8_t dMask = 0;
      for (int d : doc["days"].as<JsonArray>()) {
        dMask |= (1 << d);
      }
      schedules[scheduleCount].days = dMask;
      
      scheduleCount++;
      saveSchedules();
      request->send(200, "application/json", "{\"success\":true}");
    } else {
      request->send(400, "application/json", "{\"success\":false,\"error\":\"Max schedules reached\"}");
    }
    xSemaphoreGive(scheduleMutex);
  });
  
  server.on("/addPHTDSSchedule", HTTP_POST, [](AsyncWebServerRequest *request) {
    request->send(200);
  }, NULL, [](AsyncWebServerRequest *request, uint8_t *data, size_t len, size_t index, size_t total) {
    StaticJsonDocument<512> doc;
    DeserializationError error = deserializeJson(doc, data, len);
    if (error) {
      request->send(400, "application/json", "{\"success\":false,\"error\":\"Invalid JSON\"}");
      return;
    }
    
    xSemaphoreTake(phTDSScheduleMutex, portMAX_DELAY);
    if (phTDSScheduleCount < MAX_PH_TDS_SCHEDULES) {
      phTDSchedules[phTDSScheduleCount].enabled = doc["enabled"];
      phTDSchedules[phTDSScheduleCount].hour = doc["hour"];
      phTDSchedules[phTDSScheduleCount].minute = doc["minute"];
      phTDSchedules[phTDSScheduleCount].takePHReading = doc["takePH"];
      phTDSchedules[phTDSScheduleCount].takeTDSReading = doc["takeTDS"];
      phTDSchedules[phTDSScheduleCount].logToSD = doc["logToSD"];
      phTDSchedules[phTDSScheduleCount].publishToMQTT = doc["publishMQTT"];
      phTDSchedules[phTDSScheduleCount].lastTriggerDay = 0;
      
      uint8_t dMask = 0;
      for (int d : doc["days"].as<JsonArray>()) {
        dMask |= (1 << d);
      }
      phTDSchedules[phTDSScheduleCount].days = dMask;
      
      phTDSScheduleCount++;
      savePHTDSSchedules();
      request->send(200, "application/json", "{\"success\":true}");
    } else {
      request->send(400, "application/json", "{\"success\":false,\"error\":\"Max pH/TDS schedules reached\"}");
    }
    xSemaphoreGive(phTDSScheduleMutex);
  });
  
  server.on("/deleteSchedule", HTTP_POST, [](AsyncWebServerRequest *request) {
    if (request->hasParam("index")) {
      int index = request->getParam("index")->value().toInt();
      xSemaphoreTake(scheduleMutex, portMAX_DELAY);
      if (index >= 0 && index < scheduleCount) {
        for (int i = index; i < scheduleCount - 1; i++) {
          schedules[i] = schedules[i + 1];
        }
        scheduleCount--;
        saveSchedules();
        request->send(200);
      } else {
        request->send(400);
      }
      xSemaphoreGive(scheduleMutex);
    } else {
      request->send(400);
    }
  });
  
  server.on("/deletePHTDSSchedule", HTTP_POST, [](AsyncWebServerRequest *request) {
    if (request->hasParam("index")) {
      int index = request->getParam("index")->value().toInt();
      xSemaphoreTake(phTDSScheduleMutex, portMAX_DELAY);
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
    } else {
      request->send(400);
    }
  });
  
  server.on("/toggleSchedule", HTTP_POST, [](AsyncWebServerRequest *request) {
    if (request->hasParam("index") && request->hasParam("enabled")) {
      int index = request->getParam("index")->value().toInt();
      bool enabled = request->getParam("enabled")->value().toInt();
      xSemaphoreTake(scheduleMutex, portMAX_DELAY);
      if (index >= 0 && index < scheduleCount) {
        schedules[index].enabled = enabled;
        saveSchedules();
        request->send(200);
      } else {
        request->send(400);
      }
      xSemaphoreGive(scheduleMutex);
    } else {
      request->send(400);
    }
  });
  
  server.on("/togglePHTDSSchedule", HTTP_POST, [](AsyncWebServerRequest *request) {
    if (request->hasParam("index") && request->hasParam("enabled")) {
      int index = request->getParam("index")->value().toInt();
      bool enabled = request->getParam("enabled")->value().toInt();
      xSemaphoreTake(phTDSScheduleMutex, portMAX_DELAY);
      if (index >= 0 && index < phTDSScheduleCount) {
        phTDSchedules[index].enabled = enabled;
        savePHTDSSchedules();
        request->send(200);
      } else {
        request->send(400);
      }
      xSemaphoreGive(phTDSScheduleMutex);
    } else {
      request->send(400);
    }
  });
  
  server.on("/syncTime", HTTP_GET, [](AsyncWebServerRequest *request) {
    configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER);
    struct tm timeinfo;
    if (getLocalTime(&timeinfo, 5000)) {
      timeSynced = true;
    }
    request->send(200);
  });

  // Clear saved device ID (for re-provisioning)
  server.on("/clearDeviceId", HTTP_POST, [](AsyncWebServerRequest *request) {
    preferences.remove("deviceId");
    DEVICE_ID = "";
    provisioned = false;
    sysLog("WARN", "Device ID cleared. Reboot to enter provisioning mode.");
    request->send(200, "application/json", "{\"success\":true,\"message\":\"Device ID cleared. Reboot to re-provision.\"}");
  });
  
  server.begin();
  sysLog("INFO", "Web server started");
}

// ========== SETUP ==========
void setup() {
  Serial.begin(115200);
  delay(100);
  
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);
  
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  
  ahtAvailable = aht.begin();
  if (!ahtAvailable) Serial.println("AHT30 not found");
  
  bh1750Available = lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE, 0x23);
  if (!bh1750Available) Serial.println("BH1750 not found");
  
  ds18b20.begin();
  ds18b20Available = ds18b20.getDeviceCount() > 0;
  if (!ds18b20Available) Serial.println("DS18B20 not found");
  
  if (SD.begin(SD_CS_PIN)) {
    Serial.println("SD Card Initialized.");
    sdAvailable = true;
  } else {
    Serial.println("SD Card Initialization failed!");
    sdAvailable = false;
  }
  
  preferences.begin("greenpulse", false);

  // Load device ID from NVS
  DEVICE_ID = preferences.getString("deviceId", "");
  if (DEVICE_ID.length() > 0) {
    provisioned = true;
    MQTT_TOPIC_SUB = "greenpulse/control/" + DEVICE_ID;
    Serial.println("[PROVISION] Loaded device ID: " + DEVICE_ID);
  } else {
    provisioned = false;
    Serial.println("[PROVISION] No device ID saved. Entering provisioning mode...");
    Serial.println("[PROVISION] Create a device in the web dashboard to auto-provision.");
  }

  loadSchedules();
  loadPHTDSSchedules();
  
  for (int i = 0; i < relayCount; i++) {
    pinMode(relayPins[i], OUTPUT);
    digitalWrite(relayPins[i], LOW);
  }
  
  memset(&sensorData, 0, sizeof(sensorData));
  readSensors();
  
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.persistent(true);
  connectWiFi(true);
  Serial.print("Connecting to WiFi");
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
    wasWiFiConnected = true;
  } else {
    Serial.println("\nWiFi connection failed — will keep retrying in background");
  }
  
  mqttClient.setServer(MQTT_SERVER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
  mqttClient.setBufferSize(1024);  // Larger buffer for registration messages
  
  configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER);
  struct tm timeinfo;
  if (getLocalTime(&timeinfo, 10000)) {
    timeSynced = true;
    Serial.println("Time synchronized");
  } else {
    Serial.println("Time sync failed — will retry after WiFi reconnects");
  }
  
  sensorMutex = xSemaphoreCreateMutex();
  scheduleMutex = xSemaphoreCreateMutex();
  phTDSScheduleMutex = xSemaphoreCreateMutex();
  relayMutex = xSemaphoreCreateMutex();
  sdMutex = xSemaphoreCreateMutex();
  
  xTaskCreatePinnedToCore(mqttTask, "MQTT Task", 8192, NULL, 1, &mqttTaskHandle, 1);
  xTaskCreatePinnedToCore(sensorTask, "Sensor Task", 4096, NULL, 1, &sensorTaskHandle, 1);
  xTaskCreatePinnedToCore(scheduleTask, "Schedule Task", 4096, NULL, 2, &scheduleTaskHandle, 1);
  xTaskCreatePinnedToCore(phTDSScheduleTask, "pH/TDS Task", 4096, NULL, 2, &phTDSScheduleTaskHandle, 1);
  
  setupWebServer();
  
  sysLog("INFO", "System Ready! Device: " + (provisioned ? DEVICE_ID : String("UNPROVISIONED")));
}

void loop() {
  vTaskDelay(pdMS_TO_TICKS(1000));
}
