/*
  GreenPulse ESP32 Sensor DEBUG (No SD, No RTC)

  Sensors:
  - pH (analog): GPIO34  (use voltage divider if sensor is 5V)
  - TDS/EC (analog): GPIO35
  - DS18B20 (1-Wire): GPIO4 (+4.7kΩ pull-up to 3.3V)
  - AHT20 (I2C): SDA=21, SCL=22
  - BH1750 (I2C): SDA=21, SCL=22

  Adjustable read interval: set READ_INTERVAL_MS
*/

#include <Wire.h>
#include <Adafruit_AHTX0.h>
#include <BH1750.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <WiFi.h>
#include <PubSubClient.h>

// ---------- CONFIG ----------
#define PH_PIN       34
#define TDS_PIN      35
#define ONE_WIRE_BUS 4

// --- WIFI & MQTT CREDENTIALS ---
const char* ssid = "Firstz";
const char* password = "0971902368";

const char* mqtt_server = "broker.emqx.io";
const int mqtt_port = 1883;
const char* mqtt_user = ""; // Leave empty "" if no auth
const char* mqtt_password = ""; // Leave empty "" if no auth
const char* mqtt_topic_pub = "greenpulse/sensors";
const char* mqtt_topic_sub = "greenpulse/config";

WiFiClient espClient;
PubSubClient client(espClient);

// CHANGE THIS VALUE: 5000, 10000, or 15000 ms
unsigned long READ_INTERVAL_MS = 5000;   // 5s default

// ---------- Globals ----------
Adafruit_AHTX0 aht;
BH1750 lightMeter;
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature ds18b20(&oneWire);

const float ADC_REF        = 3.3;
const int   ADC_RES        = 4095;
const float WATER_TEMP_REF = 25.0;

float PH_SLOPE  = -5.7;
float PH_OFFSET = 15.77;

const int SCOUNT = 40;
int analogBuffer[SCOUNT];

unsigned long lastReadMillis = 0;

// ---------- Helper functions ----------
float analogToVoltage(int raw) {
  return (raw * ADC_REF) / ADC_RES;
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
         analogBuffer[samples / 2];
}

float readDS18B20C() {
  ds18b20.requestTemperatures();
  float t = ds18b20.getTempCByIndex(0);
  return (t != DEVICE_DISCONNECTED_C) ? t : WATER_TEMP_REF;
}

float readPH() {
  int   medianRaw = getMedianFiltered(PH_PIN, SCOUNT);
  float v         = analogToVoltage(medianRaw);

  Serial.print("pH RAW ADC: ");
  Serial.print(medianRaw);
  Serial.print("  Voltage: ");
  Serial.println(v, 4);   // show voltage

  float pH        = PH_SLOPE * v + PH_OFFSET;
  return pH;
}


float readTDSppm(float tempC) {
  delay(100);
  int   medianRaw = getMedianFiltered(TDS_PIN, SCOUNT);
  float v         = analogToVoltage(medianRaw);

  Serial.print("TDS RAW ADC: ");
  Serial.print(medianRaw);
  Serial.print("  Voltage: ");
  Serial.println(v, 3);

  float tdsValue = (133.42 * v * v * v
                    - 255.86 * v * v
                    + 857.39 * v) * 0.5;
  float compCoef = 1.0 + 0.02 * (tempC - WATER_TEMP_REF);
  return tdsValue / compCoef;
}


float tdsToECmS(float tdsPPM) {
  return tdsPPM * 0.0005;   // approx EC (mS/cm)
}

bool initI2C() {
  Wire.begin(21, 22);
  Wire.setClock(100000);
  delay(100);

  bool ok = true;

  if (!aht.begin()) {
    Serial.println("ERROR: AHT20 not found");
    ok = false;
  } else {
    Serial.println("✓ AHT20 initialized");
  }

  if (lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE, 0x23) ||
      lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE, 0x5C)) {
    Serial.println("✓ BH1750 initialized");
  } else {
    Serial.println("ERROR: BH1750 not found");
    ok = false;
  }

  return ok;
}

void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("Connecting to ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("");
  Serial.println("WiFi connected");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());
}

// Default Callback function to handle incoming MQTT messages
void callback(char* topic, byte* payload, unsigned int length) {
  Serial.print("Message arrived on topic: ");
  Serial.print(topic);
  Serial.print(". Message: ");
  
  String messageTemp;
  for (int i = 0; i < length; i++) {
    Serial.print((char)payload[i]);
    messageTemp += (char)payload[i];
  }
  Serial.println();

  // Handle configuration topic
  if (String(topic) == mqtt_topic_sub) {
    // We expect the payload to just be a number like "10000" for 10 seconds.
    // If you are sending JSON {"interval": 10000}, you would need ArduinoJson to parse it. Let's assume a simple string payload for now.
    long newInterval = messageTemp.toInt();
    if (newInterval >= 1000) { // Safety check, don't read faster than 1s 
      READ_INTERVAL_MS = newInterval;
      Serial.print("Updated READ_INTERVAL_MS to: ");
      Serial.println(READ_INTERVAL_MS);
    } else {
      Serial.println("Invalid interval received. Keeping old interval.");
    }
  }
}

void reconnect() {
  // Loop until we're reconnected
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    // Create a random client ID
    String clientId = "GreenPulse-ESP32-";
    clientId += String(random(0xffff), HEX);
    
    // Attempt to connect
    if (client.connect(clientId.c_str(), mqtt_user, mqtt_password)) {
      Serial.println("connected");
      // Subscribe to the configuration topic
      client.subscribe(mqtt_topic_sub);
      Serial.print("Subscribed to ");
      Serial.println(mqtt_topic_sub);
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      // Wait 5 seconds before retrying
      delay(5000);
    }
  }
}

// ---------- Setup / Loop ----------
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n=== GreenPulse Sensor DEBUG (No RTC, No SD) ===\n");

  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);

  ds18b20.begin();
  Serial.println("✓ DS18B20 initialized");

  initI2C();

  setup_wifi();
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);

  Serial.println("=== Setup Complete ===\n");
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  unsigned long now = millis();

  // Non‑blocking timing using millis()
  if (now - lastReadMillis < READ_INTERVAL_MS) return;
  lastReadMillis = now;

  Serial.println("--- Reading Sensors ---");

  float waterTemp = readDS18B20C();
  Serial.print("Water Temp: ");
  Serial.print(waterTemp, 2);
  Serial.println(" °C");

  sensors_event_t humEvent, tempEvent;
  bool ahtOK = aht.getEvent(&humEvent, &tempEvent);
  if (ahtOK) {
    Serial.print("Air Temp: ");
    Serial.print(tempEvent.temperature, 2);
    Serial.println(" °C");
    Serial.print("Air Humidity: ");
    Serial.print(humEvent.relative_humidity, 1);
    Serial.println(" %");
  } else {
    Serial.println("WARNING: AHT20 read failed");
  }

  float lux = lightMeter.readLightLevel();
  Serial.print("Light: ");
  Serial.print(lux, 1);
  Serial.println(" lux");

  float ph = readPH();
  Serial.print("pH: ");
  Serial.println(ph, 2);

  float tdsPPM = readTDSppm(waterTemp);
  float ec_mS  = tdsToECmS(tdsPPM);
  Serial.print("TDS: ");
  Serial.print(tdsPPM, 0);
  Serial.println(" ppm");
  Serial.print("EC: ");
  Serial.print(ec_mS, 3);
  Serial.println(" mS/cm");

  // --- Construct JSON and Publish to MQTT ---
  String payload = "{";
  payload += "\"water_c\":" + String(waterTemp, 2);
  if (ahtOK) {
    payload += ",\"air_c\":" + String(tempEvent.temperature, 2);
    payload += ",\"humidity\":" + String(humEvent.relative_humidity, 1);
  } else {
    payload += ",\"air_c\":null,\"humidity\":null";
  }
  payload += ",\"light_lux\":" + String(lux, 1);
  payload += ",\"ph\":" + String(ph, 2);
  payload += ",\"tds_ppm\":" + String(tdsPPM, 0);
  payload += ",\"ec_ms\":" + String(ec_mS, 3);
  payload += "}";

  Serial.println("\nPublishing to MQTT: " + payload);
  if (client.publish(mqtt_topic_pub, payload.c_str())) {
    Serial.println("Publish successful!");
  } else {
    Serial.println("Publish failed!");
  }

  Serial.println("----------------------\n");
}
