# GreenPulse Monitor - Technical Documentation

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Hardware Details](#hardware-details)
3. [Software Architecture](#software-architecture)
4. [Data Flow](#data-flow)
5. [Failover Logic](#failover-logic)
6. [Data Formats](#data-formats)
7. [Sensor Calibration](#sensor-calibration)
8. [Time Management](#time-management)
9. [Deployment Guide](#deployment-guide)
10. [Troubleshooting](#troubleshooting)

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        GREENPULSE SYSTEM                    │
├─────────────────────────────────────────────────────────────┤
│  SENSORS          ESP32 PROCESSING         OUTPUTS          │
│  ───────          ────────────────         ───────          │
│                                                             │
│  ┌─────────┐     ┌──────────────┐      ┌──────────────┐    │
│  │  AHT30  │────▶│              │      │   MongoDB    │    │
│  │(Air T/H)│     │   Sensor     │─────▶│   (Cloud)    │    │
│  └─────────┘     │   Reading    │      └──────────────┘    │
│                  │              │              ▲            │
│  ┌─────────┐     │              │              │            │
│  │  BH1750 │────▶│   Data       │      ┌───────┴──────┐    │
│  │ (Light) │     │   Processing │      │   SD Card    │    │
│  └─────────┘     │              │◀─────│  (Failover)  │    │
│                  │              │      └──────────────┘    │
│  ┌─────────┐     │   Time       │              ▲            │
│  │ DS18B20 │────▶│   Management │              │            │
│  │(Water T)│     │              │      ┌───────┴──────┐    │
│  └─────────┘     │   Failover   │      │  CSV Logger  │    │
│                  │   Logic      │─────▶│ (Monthly)    │    │
│  ┌─────────┐     │              │      └──────────────┘    │
│  │  pH     │────▶│              │                          │
│  │(Analog) │     └──────────────┘                          │
│  └─────────┘                                               │
│                                                             │
│  ┌─────────┐                                               │
│  │  TDS    │────▶                                          │
│  │(Analog) │                                               │
│  └─────────┘                                               │
│                                                             │
│  ┌─────────┐                                               │
│  │ DS1302  │────▶ RTC (Real-Time Clock)                    │
│  │   RTC   │                                               │
│  └─────────┘                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Hardware Details

### Pin Configuration

| Pin    | Function | Connected To  |
| ------ | -------- | ------------- |
| GPIO16 | I2C SDA  | AHT30, BH1750 |
| GPIO17 | I2C SCL  | AHT30, BH1750 |
| GPIO4  | OneWire  | DS18B20       |
| GPIO35 | ADC      | pH Sensor     |
| GPIO34 | ADC      | TDS Sensor    |
| GPIO14 | RTC CLK  | DS1302 CLK    |
| GPIO27 | RTC DAT  | DS1302 DAT    |
| GPIO26 | RTC RST  | DS1302 RST    |
| GPIO21 | SPI CS   | SD Card CS    |
| GPIO18 | SPI SCK  | SD Card SCK   |
| GPIO19 | SPI MISO | SD Card MISO  |
| GPIO23 | SPI MOSI | SD Card MOSI  |

### Sensor Specifications

#### AHT30 (Air Temperature & Humidity)

- **Interface**: I2C (0x38 address)
- **Temperature Range**: -40°C to 85°C
- **Humidity Range**: 0% to 100% RH
- **Accuracy**: ±0.3°C, ±2% RH

#### BH1750 (Light Intensity)

- **Interface**: I2C (0x23 address)
- **Range**: 1 - 65535 lux
- **Resolution**: 1 lux

#### DS18B20 (Water Temperature)

- **Interface**: OneWire
- **Range**: -55°C to 125°C
- **Accuracy**: ±0.5°C
- **Resolution**: 12-bit (0.0625°C)

#### pH Sensor (Analog)

- **Interface**: ADC (GPIO35)
- **Range**: 0-14 pH
- **Voltage**: 0-3.3V
- **Calibration**: Quadratic formula

#### TDS Sensor (Analog)

- **Interface**: ADC (GPIO34)
- **Range**: 0-1000 ppm (expandable)
- **Temperature Compensation**: Automatic

#### DS1302 (Real-Time Clock)

- **Interface**: 3-wire serial
- **Backup**: CR2032 battery
- **Accuracy**: ±2 minutes/month

---

## Software Architecture

### Main Components

```cpp
// Core Modules
1. Sensor Reading Module
   - readAllSensors()
   - readPHValue()
   - readTDSValue()
   - getMedianFiltered()

2. Data Transmission Module
   - sendToMongoDB()
   - formatJSON()

3. Failover Module
   - writeToSDCard()
   - syncBackupToMongoDB()
   - countBackupRecords()

4. Time Management Module
   - syncTimeWithNTP()
   - getISOTimestamp()
   - printCurrentTime()

5. Logging Module
   - writeToCSVLog()
   - initializeCSVLog()
   - getCSVFilename()
```

### State Management

```cpp
// System State Variables
bool mongoDBConnected;    // Current MongoDB connection status
bool sdCardAvailable;     // SD card initialization status
bool rtcAvailable;        // RTC initialization status
int sdBackupCounter;      // Number of records in SD backup
```

---

## Data Flow

### Normal Operation

```
1. Read Sensors (every 60 seconds)
   ↓
2. Format Data (JSON)
   ↓
3. Send to MongoDB
   ↓
4. Log to CSV (with OK status)
   ↓
5. Print Summary
```

### Failover Operation

```
1. Read Sensors (every 60 seconds)
   ↓
2. Format Data (JSON)
   ↓
3. Send to MongoDB → FAILS
   ↓
4. Write to SD Card (/backup.jsonl)
   ↓
5. Increment sdBackupCounter
   ↓
6. Log to CSV (with FAIL status + counter)
   ↓
7. Print Summary (with backup count)
```

### Recovery Operation

```
1. Read Sensors
   ↓
2. Send to MongoDB → SUCCESS
   ↓
3. Check SD Card for backup data
   ↓
4. Sync backup to MongoDB (batch of 50)
   ↓
5. Remove synced records from SD
   ↓
6. Reset sdBackupCounter
   ↓
7. Continue normal operation
```

---

## Failover Logic

### Trigger Conditions

Failover activates when ANY of these occur:

- WiFi disconnected
- MongoDB API returns non-200 status
- HTTP timeout (10 seconds)
- Network error

### Backup Process

```cpp
if (!mongoDBConnected) {
    // Increment counter
    sdBackupCounter++;

    // Save to SD card
    writeToSDCard(data);

    // Log to CSV with FAIL status
    writeToCSVLog(data, false, sdBackupCounter);

    // Alert user
    Serial.println("[FAILOVER] MongoDB disconnected");
    Serial.printf("[SD CARD] Total backup records: %d\n", sdBackupCounter);
}
```

### Sync Process

```cpp
if (mongoDBConnected && hasBackupData()) {
    // Read up to 50 records from SD
    syncBackupToMongoDB();

    // Update counter
    sdBackupCounter = countBackupRecords();
}
```

### Batch Processing

- **Batch Size**: 50 records maximum per sync cycle
- **Delay**: 50ms between each HTTP request
- **Timeout**: 10 seconds per request
- **Retry**: Failed records kept for next cycle

---

## Data Formats

### MongoDB JSON Format

```json
{
  "device_id": "GREENPULSE-V1-MKUMW0RG-1JS0A",
  "data_id": "75a19cdd-4682-4b30-ad68-9e336494ec9b",
  "timestamp": "2024-04-18T14:30:00.000+07:00",
  "ph_value": 7.48,
  "ec_value": 900.4,
  "tds_value": 450.2,
  "water_temperature_c": 25.5,
  "air_temperature_c": 28.3,
  "air_humidity": 65.2,
  "light_intensity": 1250.0,
  "created_at": { "$date": "2024-04-18T14:30:00.000+07:00" },
  "updated_at": { "$date": "2024-04-18T14:30:00.000+07:00" },
  "__v": 0
}
```

### SD Card Backup Format (JSON Lines)

```json
{"device_id":"...","data_id":"...","timestamp":"...",...}
{"device_id":"...","data_id":"...","timestamp":"...",...}
```

### CSV Log Format

```csv
timestamp,ph_value,tds_value,ec_value,water_temp_c,air_temp_c,air_humidity,light_lux,mongodb_status,sd_backup_count
2024-04-18T14:30:00.000+07:00,7.48,450.2,900.4,25.50,28.30,65.20,1250.0,OK,0
2024-04-18T14:31:00.000+07:00,7.45,448.5,897.0,25.52,28.32,65.15,1248.5,FAIL,1
2024-04-18T14:32:00.000+07:00,7.46,449.0,898.0,25.51,28.31,65.18,1249.0,FAIL,2
```

---

## Sensor Calibration

### pH Sensor Calibration

**Formula**: `pH = a × V² + b × V + c`

Where:

- `V` = ADC voltage (0-3.3V)
- `a = -0.0562836215`
- `b = -5.903839`
- `c = 13.816135`

**Calibration Procedure**:

1. Prepare pH 4.0, 7.0, and 10.0 buffer solutions
2. Measure voltage at each pH level
3. Use quadratic regression to find a, b, c coefficients
4. Update values in code

### TDS Sensor Calibration

**Formula**:

```
TDS = (133.42 × Vc³ - 255.86 × Vc² + 857.39 × Vc) × TDS_FACTOR

Where:
  Vc = V / (1 + 0.02 × (T - 25))
  V = measured voltage
  T = water temperature (°C)
  TDS_FACTOR = 0.5
```

**Temperature Compensation**:

- Reference temperature: 25°C
- Compensation rate: 2% per °C

---

## Time Management

### NTP Synchronization

**Configuration**:

- Server: `pool.ntp.org` (primary), `time.google.com`, `time.windows.com` (fallback)
- Sync interval: 24 hours
- Timezone: GMT+7 (Thailand)
- Retry attempts: 10 (with 500ms delay)

**Process**:

```
1. Connect to WiFi
2. Query NTP servers
3. Retry up to 10 times if failed
4. Update RTC with NTP time
5. If NTP fails, use existing RTC time
```

### Timestamp Format

**ISO 8601 with timezone offset**:

```
2024-04-18T14:30:00.000+07:00
```

**Components**:

- Date: `YYYY-MM-DD`
- Time: `HH:MM:SS`
- Milliseconds: `.000`
- Timezone: `+07:00` (GMT+7)

---

## Deployment Guide

### Prerequisites

1. **Hardware**:
   - ESP32 DevKit
   - All sensors listed in hardware section
   - Breadboard and jumper wires
   - Micro SD card (minimum 4GB, Class 10)
   - CR2032 battery for RTC

2. **Software**:
   - Arduino IDE 1.8.x or 2.x
   - ESP32 board support package
   - Required libraries (see README.md)

3. **Services**:
   - MongoDB database (or backend API)
   - WiFi network with internet access

### Step-by-Step Deployment

#### 1. Hardware Assembly

```
ESP32 Pinout:
                    ┌─────────────┐
    3.3V ───────────┤VIN       GND├─────────── GND
    EN  ────────────┤EN        IO23├─────────── SD MOSI
    GPIO36 ─────────┤VP/IO36   IO22├─────────── (unused)
    GPIO39 ─────────┤VN/IO39   IO1 ├─────────── TX0
    GPIO34 (TDS) ───┤IO34      IO3 ├─────────── RX0
    GPIO35 (pH) ────┤IO35      IO21├─────────── SD CS
    GPIO32 ─────────┤IO32      IO19├─────────── SD MISO
    GPIO33 ─────────┤IO33      IO18├─────────── SD SCK
    GPIO25 ─────────┤IO25       IO5 ├─────────── (unused)
    GPIO26 (RTC RST)┤IO26       IO17├─────────── I2C SCL
    GPIO27 (RTC DAT)┤IO27       IO16├─────────── I2C SDA
    GPIO14 (RTC CLK)┤IO14       IO4 ├─────────── DS18B20
    GPIO12 ─────────┤IO12       IO0 ├─────────── BOOT
    GPIO13 ─────────┤IO13      IO2 ├─────────── (unused)
    GPIO9  ─────────┤SD2       IO15├─────────── (unused)
    GPIO10 ─────────┤SD3       IO13├─────────── (unused)
    GPIO11 ─────────┤CMD       IO12├─────────── (unused)
    GPIO6  ─────────┤SD0       IO14├─────────── (unused)
    GPIO7  ─────────┤SD1       IO27├─────────── (unused)
    GPIO8  ─────────┤CLK       IO25├─────────── (unused)
                    └─────────────┘
```

#### 2. Software Setup

1. Install Arduino IDE
2. Add ESP32 board support:
   - File → Preferences → Additional Board Manager URLs
   - Add: `https://dl.espressif.com/dl/package_esp32_index.json`
   - Tools → Board → Board Manager → Search "ESP32" → Install

3. Install required libraries:
   - Sketch → Include Library → Manage Libraries
   - Search and install each library from README.md

4. Configure the code:

   ```cpp
   // WiFi credentials
   const char* WIFI_SSID = "your-ssid";
   const char* WIFI_PASSWORD = "your-password";

   // Backend API
   const char* BACKEND_API_URL = "https://your-api.com/api/sensor-data";

   // Device ID (unique per device)
   const char* DEVICE_ID = "GREENPULSE-V1-XXXXXX";
   ```

5. Select board and port:
   - Tools → Board → ESP32 Dev Module
   - Tools → Port → Select your COM port

6. Upload the code:
   - Sketch → Upload
   - Wait for "Done uploading"

#### 3. Initial Testing

1. Open Serial Monitor (Tools → Serial Monitor)
2. Set baud rate to 115200
3. Press RST button on ESP32
4. Verify startup messages:

   ```
   ========================================
      GREENPULSE - ESSENTIAL MONITOR
   ========================================
   [SENSORS] Initializing...
     [OK] AHT30 - Air Temp & Humidity
     [OK] BH1750 - Light Sensor
     [OK] DS18B20 - Water Temperature
     [OK] Analog sensors (pH, TDS)
   [RTC] Initializing... OK
   [SD CARD] Initializing... OK
   [WiFi] Connecting to: your-ssid .... Connected
   [NTP] Syncing time with servers... OK
   [SYSTEM] Setup complete
   ```

5. Check sensor readings appear every 60 seconds

#### 4. Field Deployment

1. **Power Supply**:
   - Use 5V/2A USB power adapter
   - Or 3.7V LiPo battery with charging module

2. **Waterproofing**:
   - Use waterproof DS18B20 probe
   - Seal all connections with heat shrink
   - Place ESP32 in waterproof enclosure

3. **Sensor Placement**:
   - pH and TDS probes in nutrient solution
   - DS18B20 submerged in water
   - AHT30 and BH1750 in air (avoid direct sunlight)

4. **SD Card**:
   - Format as FAT32
   - Insert before power-on
   - Check files created after first run

5. **Monitoring**:
   - Check Serial Monitor for errors
   - Verify data in MongoDB
   - Check SD card files periodically

---

## Troubleshooting

### Common Issues

#### 1. NTP Sync Fails

**Symptom**: `[NTP] Failed to obtain time after retries`

**Solutions**:

- Check WiFi internet connection
- Verify firewall allows UDP port 123
- Check NTP servers are accessible
- System will use RTC time as fallback

#### 2. SD Card Not Detected

**Symptom**: `[SD CARD] Initializing... FAILED`

**Solutions**:

- Format SD card as FAT32
- Check wiring (CS=21, SCK=18, MISO=19, MOSI=23)
- Try different SD card
- Check card is inserted properly

#### 3. MongoDB Connection Fails

**Symptom**: `[FAILOVER] MongoDB disconnected`

**Solutions**:

- Check WiFi connection
- Verify API URL is correct
- Check backend server is running
- Check SSL certificate validity
- Data will be saved to SD card

#### 4. Sensor Readings Invalid

**Symptom**: pH shows 0 or 14, TDS shows negative

**Solutions**:

- Check sensor connections
- Verify calibration coefficients
- Check probe is in solution
- Clean probes if contaminated

#### 5. RTC Time Wrong

**Symptom**: Timestamp shows wrong date/time

**Solutions**:

- Replace CR2032 battery
- Check RTC wiring (CLK=14, DAT=27, RST=26)
- Force NTP sync by restarting
- Check RTC crystal is soldered

### Debug Mode

Enable verbose logging by adding to `setup()`:

```cpp
Serial.setDebugOutput(true);
```

### Serial Commands

While not implemented by default, you can add these for debugging:

```cpp
// In loop(), check for serial commands
if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    if (cmd == "status") printSystemStatus();
    if (cmd == "sensors") forceSensorRead();
    if (cmd == "sync") syncTimeWithNTP();
    if (cmd == "format") formatSDCard();
}
```

---

## Performance Specifications

| Metric                | Value                |
| --------------------- | -------------------- |
| Sensor Read Interval  | 60 seconds           |
| NTP Sync Interval     | 24 hours             |
| SD Card Batch Size    | 50 records           |
| HTTP Timeout          | 10 seconds           |
| ADC Resolution        | 12-bit (4096 levels) |
| Median Filter Samples | 10                   |
| CSV File Rotation     | Monthly              |
| Max CSV File Size     | Limited by SD card   |

---

## Security Considerations

1. **WiFi Credentials**: Store in code (not in repository)
2. **API Keys**: Use environment variables or secure storage
3. **SSL/TLS**: Verify certificates for HTTPS connections
4. **Device ID**: Use unique identifier per device
5. **SD Card**: Encrypt sensitive data if required

---

## Maintenance

### Monthly

- Check SD card free space
- Download and archive CSV files
- Clean sensor probes
- Verify calibration

### Quarterly

- Replace RTC battery if needed
- Check wiring connections
- Update firmware if available
- Review MongoDB data retention

### Annually

- Full sensor recalibration
- Hardware inspection
- Backup configuration
- Document any changes

---

## Version History

| Version | Date       | Changes                             |
| ------- | ---------- | ----------------------------------- |
| 1.0     | 2024-04-18 | Initial release with failover logic |

---

## Support

For issues or questions:

1. Check this documentation
2. Review Serial Monitor logs
3. Verify hardware connections
4. Test with minimal configuration
5. Contact project maintainer
