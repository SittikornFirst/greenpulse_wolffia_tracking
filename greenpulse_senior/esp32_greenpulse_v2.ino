// ============================================================
// GREENPULSE - Essential Version with Failover Logic + RTC/NTP
// ============================================================
// Pin Configuration:
//   I2C: SDA=16, SCL=17 (AHT30, BH1750)
//   DS18B20: GPIO4
//   pH Sensor: GPIO35 (Analog)
//   TDS Sensor: GPIO34 (Analog)
//   RTC: CLK=14, DAT=27, RST=26
//   SD Card: CS=21
// ============================================================

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Adafruit_AHTX0.h>
#include <BH1750.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <ThreeWire.h>
#include <RtcDS1302.h>
#include <SD.h>
#include <SPI.h>

// ============= PIN DEFINITIONS =============
constexpr int I2C_SDA_PIN = 16;
constexpr int I2C_SCL_PIN = 17;
constexpr int DS18B20_PIN = 4;
constexpr int PH_PIN = 35;
constexpr int TDS_PIN = 34;
constexpr int RTC_CLK_PIN = 14;
constexpr int RTC_DAT_PIN = 27;
constexpr int RTC_RST_PIN = 26;
constexpr int SD_CS = 21;

// ============= RTC OBJECTS =============
ThreeWire myWire(RTC_DAT_PIN, RTC_CLK_PIN, RTC_RST_PIN);  // DAT, CLK, RST
RtcDS1302<ThreeWire> rtc(myWire);

// ============= CONFIGURATION =============
const char* WIFI_SSID = "ICT-SP2025-08";
const char* WIFI_PASSWORD = "0959396462";
const char* BACKEND_API_URL = "https://greenpulse-wolffia-tracking.onrender.com/api/sensor-data";
const char* DEVICE_ID = "GREENPULSE-V1-MKUMW0RG-1JS0A";
const unsigned long READ_INTERVAL = 60000;

// NTP Configuration
const char* NTP_SERVER = "pool.ntp.org";
const long GMT_OFFSET_SEC = 7 * 3600;  // GMT+7
const int DAYLIGHT_OFFSET_SEC = 0;
const unsigned long NTP_SYNC_INTERVAL = 24 * 60 * 60 * 1000;  // 24 hours

// ============= SENSOR CALIBRATION =============
float pha = -0.0562836215f;
float phb = -5.903839f;
float phc = 13.816135f;
const float TDS_FACTOR = 0.5;
const float TEMP_COEFFICIENT = 0.02;
const float VREF = 3.3;
const int ADC_RESOLUTION = 4095;
const int SENSOR_SAMPLE_COUNT = 15;

// ============= EMA FILTER STATE =============
float smoothed_ph = -1.0;
float smoothed_tds = -1.0;

// ============= GLOBAL OBJECTS =============
Adafruit_AHTX0 aht30;
BH1750 lightMeter;
OneWire oneWire(DS18B20_PIN);
DallasTemperature ds18b20(&oneWire);

// ============= SYSTEM STATE =============
bool mongoDBConnected = false;
bool sdCardAvailable = false;
bool rtcAvailable = false;
unsigned long lastReadTime = 0;
unsigned long lastNTPSync = 0;
unsigned long dataCounter = 0;
int sdBackupCounter = 0;  // Count of records in SD backup

// ============= DATA STRUCTURE =============
struct SensorData {
    float ph_value;
    float ec_value;
    float tds_value;
    float water_temperature_c;
    float air_temperature_c;
    float air_humidity;
    float light_intensity;
    String timestamp;
    String data_id;
};

// ============= SETUP =============
void setup() {
    Serial.begin(115200);
    delay(1000);
    
    Serial.println("\n========================================");
    Serial.println("   GREENPULSE - ESSENTIAL MONITOR");
    Serial.println("========================================");
    
    analogReadResolution(12);
    randomSeed(analogRead(36));
    
    initializeSensors();
    initializeRTC();
    initializeSDCard();
    connectToWiFi();
    
    // Initial NTP sync
    syncTimeWithNTP();
    
    // Initialize CSV log file
    initializeCSVLog();
    
    Serial.println("[SYSTEM] Setup complete\n");
}

// ============= MAIN LOOP =============
void loop() {
    unsigned long currentMillis = millis();
    
    // Maintain WiFi connection
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("[WiFi] Reconnecting...");
        connectToWiFi();
    }
    
    // NTP Sync every 24 hours
    if (currentMillis - lastNTPSync >= NTP_SYNC_INTERVAL) {
        syncTimeWithNTP();
    }
    
    // Periodic sensor reading
    if (currentMillis - lastReadTime >= READ_INTERVAL) {
        lastReadTime = currentMillis;
        
        // Show current time on Serial Monitor
        printCurrentTime();
        
        // Read all sensors
        SensorData data = readAllSensors();
        data.data_id = generateDataID();
        
        // Try to send to MongoDB (Backend API)
        mongoDBConnected = sendToMongoDB(data);
        
        // FAILOVER LOGIC:
        // If MongoDB connection fails, trigger SD Card backup logging
        if (!mongoDBConnected) {
            Serial.println("[FAILOVER] MongoDB disconnected - Triggering SD Card backup");
            
            if (sdCardAvailable) {
                writeToSDCard(data);
                sdBackupCounter++;  // Increment backup counter
                Serial.printf("[SD CARD] Data saved to backup (Total: %d records)\n", sdBackupCounter);
            } else {
                Serial.println("[ERROR] SD Card not available - Data will be lost!");
            }
        } else {
            Serial.println("[MongoDB] Data sent successfully");
            
            // Reset counter if we were in failover mode
            if (sdBackupCounter > 0) {
                Serial.printf("[FAILOVER] MongoDB restored - Had %d backup records\n", sdBackupCounter);
            }
            
            // Try to sync any pending backup data when connection is restored
            if (sdCardAvailable && hasBackupData()) {
                syncBackupToMongoDB();
                sdBackupCounter = countBackupRecords();  // Update counter after sync
            } else {
                sdBackupCounter = 0;  // No backup data
            }
        }
        
        // Write to CSV log (includes MongoDB status and SD backup count)
        writeToCSVLog(data, mongoDBConnected, sdBackupCounter);
        
        printSensorSummary(data);
    }
    
    delay(100);
}

// ============= INITIALIZATION =============
void initializeSensors() {
    Serial.println("[SENSORS] Initializing...");
    
    Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
    
    if (aht30.begin()) {
        Serial.println("  [OK] AHT30 - Air Temp & Humidity");
    } else {
        Serial.println("  [FAIL] AHT30");
    }
    
    if (lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE)) {
        Serial.println("  [OK] BH1750 - Light Sensor");
    } else {
        Serial.println("  [FAIL] BH1750");
    }
    
    ds18b20.begin();
    Serial.println("  [OK] DS18B20 - Water Temperature");
    
    pinMode(PH_PIN, INPUT);
    pinMode(TDS_PIN, INPUT);
    Serial.println("  [OK] Analog sensors (pH, TDS)");
}

void initializeRTC() {
    Serial.print("[RTC] Initializing... ");
    
    rtc.Begin();
    
    if (rtc.IsDateTimeValid()) {
        rtcAvailable = true;
        Serial.println("OK");
        
        RtcDateTime now = rtc.GetDateTime();
        Serial.printf("  Current time: %04d-%02d-%02d %02d:%02d:%02d\n",
                      now.Year(), now.Month(), now.Day(),
                      now.Hour(), now.Minute(), now.Second());
    } else {
        rtcAvailable = false;
        Serial.println("FAILED - RTC not valid");
    }
}

void initializeSDCard() {
    Serial.print("[SD CARD] Initializing... ");
    
    SPI.begin(18, 19, 23, SD_CS);
    
    if (!SD.begin(SD_CS)) {
        sdCardAvailable = false;
        Serial.println("FAILED");
        return;
    }
    
    sdCardAvailable = true;
    
    // Create backup file if not exists
    if (!SD.exists("/backup.jsonl")) {
        File file = SD.open("/backup.jsonl", FILE_WRITE);
        if (file) {
            file.println("# GreenPulse Backup Log");
            file.close();
        }
    }
    
    // Count existing backup records
    sdBackupCounter = countBackupRecords();
    if (sdBackupCounter > 0) {
        Serial.printf("OK (%d backup records)\n", sdBackupCounter);
    } else {
        Serial.println("OK");
    }
}

void connectToWiFi() {
    Serial.printf("[WiFi] Connecting to: %s ", WIFI_SSID);
    
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
        delay(500);
        Serial.print(".");
        attempts++;
    }
    
    if (WiFi.status() == WL_CONNECTED) {
        Serial.printf(" Connected (IP: %s)\n", WiFi.localIP().toString().c_str());
    } else {
        Serial.println(" FAILED");
    }
}

// ============= NTP TIME SYNC =============
void syncTimeWithNTP() {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("[NTP] Cannot sync - No WiFi");
        return;
    }
    
    Serial.println("[NTP] Syncing time with servers...");
    
    // Configure multiple NTP servers for redundancy
    configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, 
               "pool.ntp.org", "time.google.com", "time.windows.com");
    
    // Retry logic with delay - wait for NTP sync
    struct tm timeinfo;
    int retry = 0;
    const int MAX_RETRIES = 10;
    
    while (!getLocalTime(&timeinfo) && retry < MAX_RETRIES) {
        Serial.print(".");
        delay(500);  // Wait 500ms between retries
        retry++;
    }
    
    // Check if we got the time
    if (retry >= MAX_RETRIES) {
        Serial.println("\n[NTP] Failed to obtain time after retries");
        
        // FALLBACK: Continue using existing RTC time
        if (rtcAvailable) {
            RtcDateTime now = rtc.GetDateTime();
            Serial.printf("[NTP] FALLBACK: Using RTC time %04d-%02d-%02d %02d:%02d:%02d\n",
                          now.Year(), now.Month(), now.Day(),
                          now.Hour(), now.Minute(), now.Second());
        } else {
            Serial.println("[NTP] FALLBACK: No RTC available - time may be inaccurate");
        }
        
        // Still update lastNTPSync to prevent constant retry attempts
        lastNTPSync = millis();
        return;
    }
    
    Serial.println("\n[NTP] Time synced successfully");
    
    // Update RTC with NTP time
    if (rtcAvailable) {
        RtcDateTime ntpTime(
            timeinfo.tm_year + 1900,
            timeinfo.tm_mon + 1,
            timeinfo.tm_mday,
            timeinfo.tm_hour,
            timeinfo.tm_min,
            timeinfo.tm_sec
        );
        rtc.SetDateTime(ntpTime);
        Serial.println("[NTP] RTC updated successfully");
    }
    
    lastNTPSync = millis();
    
    // Print synced time
    char timeString[30];
    strftime(timeString, sizeof(timeString), "%Y-%m-%d %H:%M:%S", &timeinfo);
    Serial.printf("[NTP] Synced time: %s (GMT+7)\n", timeString);
}

void printCurrentTime() {
    if (rtcAvailable) {
        RtcDateTime now = rtc.GetDateTime();
        Serial.printf("\n[TIME] %04d-%02d-%02d %02d:%02d:%02d\n",
                      now.Year(), now.Month(), now.Day(),
                      now.Hour(), now.Minute(), now.Second());
    } else {
        // Fallback to system time if RTC not available
        struct tm timeinfo;
        if (getLocalTime(&timeinfo)) {
            char timeString[30];
            strftime(timeString, sizeof(timeString), "%Y-%m-%d %H:%M:%S", &timeinfo);
            Serial.printf("\n[TIME] %s (NTP)\n", timeString);
        } else {
            Serial.printf("\n[TIME] %lu seconds since boot\n", millis() / 1000);
        }
    }
}

// ============= SENSOR READING =============
SensorData readAllSensors() {
    SensorData data;
    
    // Water Temperature (DS18B20)
    ds18b20.requestTemperatures();
    data.water_temperature_c = ds18b20.getTempCByIndex(0);
    
    // pH Sensor
    data.ph_value = readPHValue();
    
    // TDS Sensor
    data.tds_value = readTDSValue(data.water_temperature_c);
    data.ec_value = data.tds_value * 2.0;
    
    // Air Temperature & Humidity (AHT30)
    sensors_event_t humidity, temp;
    aht30.getEvent(&humidity, &temp);
    data.air_temperature_c = temp.temperature;
    data.air_humidity = humidity.relative_humidity;
    
    // Light Intensity (BH1750)
    data.light_intensity = lightMeter.readLightLevel();
    
    // Timestamp from RTC
    data.timestamp = getISOTimestamp();
    
    return data;
}

float readPHValue() {
    int rawValue = getMedianFiltered(PH_PIN);
    float voltage = (rawValue * VREF) / ADC_RESOLUTION;
    
    // Your exact calibration formula
    float current_ph = pha * voltage * voltage + phb * voltage + phc;
    current_ph = constrain(current_ph, 0.0, 14.0);
    
    // Exponential Moving Average (EMA)
    if (smoothed_ph < 0) {
        smoothed_ph = current_ph;
    } else {
        smoothed_ph = (current_ph * 0.15) + (smoothed_ph * 0.85); // 15% new, 85% old
    }
    
    return smoothed_ph;
}

float readTDSValue(float waterTemp) {
    int rawValue = getMedianFiltered(TDS_PIN);
    float voltage = (rawValue * VREF) / ADC_RESOLUTION;
    
    // Temperature compensation
    float tempComp = 1.0 + TEMP_COEFFICIENT * (waterTemp - 25.0);
    float voltageComp = voltage / tempComp;
    
    // Calculate TDS
    float current_tds = (133.42 * voltageComp * voltageComp * voltageComp 
                 - 255.86 * voltageComp * voltageComp 
                 + 857.39 * voltageComp) * TDS_FACTOR;
    
    if (current_tds < 0) current_tds = 0;
    
    // Exponential Moving Average (EMA)
    if (smoothed_tds < 0) {
        smoothed_tds = current_tds;
    } else {
        smoothed_tds = (current_tds * 0.15) + (smoothed_tds * 0.85); // 15% new, 85% old
    }
    
    return smoothed_tds;
}

int getMedianFiltered(int pin) {
    int readings[SENSOR_SAMPLE_COUNT];
    
    for (int i = 0; i < SENSOR_SAMPLE_COUNT; i++) {
        readings[i] = analogRead(pin);
        delay(20); // 20ms delay gives wider spread for hardware median
    }
    
    // Bubble sort for median
    for (int i = 0; i < SENSOR_SAMPLE_COUNT - 1; i++) {
        for (int j = 0; j < SENSOR_SAMPLE_COUNT - i - 1; j++) {
            if (readings[j] > readings[j + 1]) {
                int temp = readings[j];
                readings[j] = readings[j + 1];
                readings[j + 1] = temp;
            }
        }
    }
    
    return readings[SENSOR_SAMPLE_COUNT / 2];
}

// ============= JSON FORMATTER =============
String formatJSON(SensorData data) {
    StaticJsonDocument<512> doc;
    
    doc["device_id"] = DEVICE_ID;
    doc["data_id"] = data.data_id;
    doc["timestamp"] = data.timestamp;  // RTC timestamp with +07:00 offset
    doc["ph_value"] = round(data.ph_value * 1000000) / 1000000.0;
    doc["ec_value"] = round(data.ec_value * 100) / 100.0;
    doc["tds_value"] = round(data.tds_value * 100) / 100.0;
    doc["water_temperature_c"] = round(data.water_temperature_c * 10000) / 10000.0;
    doc["air_temperature_c"] = round(data.air_temperature_c * 10000) / 10000.0;
    doc["air_humidity"] = round(data.air_humidity * 10000) / 10000.0;
    doc["light_intensity"] = round(data.light_intensity * 10000) / 10000.0;
    doc["created_at"]["$date"] = data.timestamp;
    doc["updated_at"]["$date"] = data.timestamp;
    doc["__v"] = 0;
    
    String jsonString;
    serializeJson(doc, jsonString);
    return jsonString;
}

// ============= MONGODB (BACKEND API) =============
bool sendToMongoDB(SensorData data) {
    if (WiFi.status() != WL_CONNECTED) {
        return false;
    }
    
    String jsonPayload = formatJSON(data);
    
    HTTPClient http;
    http.begin(BACKEND_API_URL);
    http.addHeader("Content-Type", "application/json");
    http.setTimeout(10000);
    
    int httpCode = http.POST(jsonPayload);
    bool success = (httpCode == 200 || httpCode == 201);
    
    http.end();
    return success;
}

// ============= SD CARD BACKUP =============
int countBackupRecords() {
    if (!sdCardAvailable) return 0;
    
    File file = SD.open("/backup.jsonl", FILE_READ);
    if (!file) return 0;
    
    file.readStringUntil('\n');  // Skip header
    int count = 0;
    
    while (file.available()) {
        String line = file.readStringUntil('\n');
        if (line.length() > 10) count++;
    }
    file.close();
    
    return count;
}

void writeToSDCard(SensorData data) {
    if (!sdCardAvailable) return;
    
    String jsonLine = formatJSON(data);
    
    File file = SD.open("/backup.jsonl", FILE_APPEND);
    if (!file) {
        Serial.println("[SD CARD] Error: Cannot open file");
        return;
    }
    
    file.println(jsonLine);
    file.close();
}

bool hasBackupData() {
    if (!sdCardAvailable) return false;
    
    File file = SD.open("/backup.jsonl", FILE_READ);
    if (!file) return false;
    
    file.readStringUntil('\n');  // Skip header
    bool hasData = file.available() > 10;
    file.close();
    
    return hasData;
}

void syncBackupToMongoDB() {
    if (!sdCardAvailable || WiFi.status() != WL_CONNECTED) return;
    
    File file = SD.open("/backup.jsonl", FILE_READ);
    if (!file) return;
    
    Serial.println("[SYNC] Reading backup data from SD card...");
    
    file.readStringUntil('\n');  // Skip header
    
    // Count total records and read all into memory (batch processing)
    const int MAX_BATCH = 50;  // Process up to 50 records at a time
    String lines[MAX_BATCH];
    int totalRecords = 0;
    
    while (file.available() && totalRecords < MAX_BATCH) {
        String line = file.readStringUntil('\n');
        line.trim();
        if (line.length() > 10) {
            lines[totalRecords++] = line;
        }
    }
    file.close();
    
    if (totalRecords == 0) {
        Serial.println("[SYNC] No backup data to sync");
        return;
    }
    
    Serial.printf("[SYNC] Found %d records to sync\n", totalRecords);
    
    // Send all records to MongoDB
    int synced = 0;
    for (int i = 0; i < totalRecords; i++) {
        HTTPClient http;
        http.begin(BACKEND_API_URL);
        http.addHeader("Content-Type", "application/json");
        http.setTimeout(10000);
        
        int httpCode = http.POST(lines[i]);
        if (httpCode == 200 || httpCode == 201) {
            synced++;
            Serial.printf("[SYNC] %d/%d sent\n", synced, totalRecords);
        } else {
            Serial.printf("[SYNC] Failed at record %d (HTTP %d)\n", i + 1, httpCode);
            break;
        }
        http.end();
        delay(50);  // Small delay between requests
    }
    
    // Check if there are more records in file (beyond MAX_BATCH)
    File checkFile = SD.open("/backup.jsonl", FILE_READ);
    int remainingInFile = 0;
    if (checkFile) {
        checkFile.readStringUntil('\n');  // Skip header
        while (checkFile.available()) {
            String line = checkFile.readStringUntil('\n');
            if (line.length() > 10) remainingInFile++;
        }
        checkFile.close();
    }
    
    // Rewrite file with unsynced data + any remaining data beyond batch
    File newFile = SD.open("/backup.jsonl", FILE_WRITE);
    newFile.println("# GreenPulse Backup Log");
    
    // Write unsynced records from this batch
    for (int i = synced; i < totalRecords; i++) {
        newFile.println(lines[i]);
    }
    newFile.close();
    
    Serial.printf("[SYNC] Complete: %d synced, %d remaining\n", synced, totalRecords - synced);
    
    // If we hit the batch limit and there might be more, schedule another sync
    if (totalRecords == MAX_BATCH && remainingInFile > MAX_BATCH) {
        Serial.println("[SYNC] More data available - will continue in next cycle");
    }
}

// ============= CSV LOGGER =============
String getCSVFilename() {
    // Generate filename based on current month: /log_2024_04.csv
    char filename[25];
    if (rtcAvailable) {
        RtcDateTime now = rtc.GetDateTime();
        snprintf(filename, sizeof(filename), "/log_%04d_%02d.csv", now.Year(), now.Month());
    } else {
        // Fallback to default
        snprintf(filename, sizeof(filename), "/log_2024_01.csv");
    }
    return String(filename);
}

void initializeCSVLog() {
    if (!sdCardAvailable) return;
    
    String filename = getCSVFilename();
    
    // Check if file exists, if not create with header
    if (!SD.exists(filename.c_str())) {
        File file = SD.open(filename.c_str(), FILE_WRITE);
        if (file) {
            file.println("timestamp,ph_value,tds_value,ec_value,water_temp_c,air_temp_c,air_humidity,light_lux,mongodb_status,sd_backup_count");
            file.close();
            Serial.printf("[CSV] Created new log file: %s\n", filename.c_str());
        }
    } else {
        Serial.printf("[CSV] Using existing log file: %s\n", filename.c_str());
    }
}

void writeToCSVLog(SensorData data, bool mongoStatus, int sdBackupCount) {
    if (!sdCardAvailable) return;
    
    String filename = getCSVFilename();
    
    // Check if we need to create new file (month changed)
    if (!SD.exists(filename.c_str())) {
        initializeCSVLog();
    }
    
    File file = SD.open(filename.c_str(), FILE_APPEND);
    if (!file) {
        Serial.println("[CSV] Error: Cannot open log file");
        return;
    }
    
    // Format: timestamp,ph,tds,ec,water_temp,air_temp,humidity,light,mongodb_status,sd_backup_count
    file.printf("%s,%.2f,%.1f,%.1f,%.2f,%.2f,%.2f,%.1f,%s,%d\n",
                data.timestamp.c_str(),
                data.ph_value,
                data.tds_value,
                data.ec_value,
                data.water_temperature_c,
                data.air_temperature_c,
                data.air_humidity,
                data.light_intensity,
                mongoStatus ? "OK" : "FAIL",
                sdBackupCount);
    
    file.close();
}

// ============= UTILITIES =============
String generateDataID() {
    dataCounter++;
    String id = String(DEVICE_ID);
    id += "-";
    id += String(millis());
    id += "-";
    id += String(dataCounter);
    return id;
}

String getISOTimestamp() {
    char timestamp[35];  // Increased size for +07:00 offset
    
    if (rtcAvailable) {
        RtcDateTime now = rtc.GetDateTime();
        snprintf(timestamp, sizeof(timestamp), 
                 "%04d-%02d-%02dT%02d:%02d:%02d.000+07:00",
                 now.Year(), now.Month(), now.Day(),
                 now.Hour(), now.Minute(), now.Second());
    } else {
        // Fallback to NTP time
        struct tm timeinfo;
        if (getLocalTime(&timeinfo)) {
            strftime(timestamp, sizeof(timestamp), "%Y-%m-%dT%H:%M:%S.000+07:00", &timeinfo);
        } else {
            snprintf(timestamp, sizeof(timestamp), "2024-01-01T00:00:00.000+07:00");
        }
    }
    
    return String(timestamp);
}

void printSensorSummary(SensorData data) {
    Serial.println("------------- SENSOR READINGS -------------");
    Serial.printf("pH:        %.2f\n", data.ph_value);
    Serial.printf("TDS:       %.1f ppm\n", data.tds_value);
    Serial.printf("EC:        %.1f uS/cm\n", data.ec_value);
    Serial.printf("Water Temp:%.2f C\n", data.water_temperature_c);
    Serial.printf("Air Temp:  %.2f C\n", data.air_temperature_c);
    Serial.printf("Humidity:  %.2f %%\n", data.air_humidity);
    Serial.printf("Light:     %.1f lux\n", data.light_intensity);
    Serial.printf("MongoDB:   %s  |  SD Card: %s\n", 
                  mongoDBConnected ? "CONNECTED" : "DISCONNECTED",
                  sdCardAvailable ? "READY" : "NOT READY");
    if (sdBackupCounter > 0) {
        Serial.printf("SD Backup: %d records pending\n", sdBackupCounter);
    }
    Serial.println("-------------------------------------------\n");
}
