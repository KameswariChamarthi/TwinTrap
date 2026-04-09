//ESP8266.ino:

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>

// -------------------- CONFIGURATION -------------------
const char* WIFI_SSID       = "******";           // your Wi‑Fi
const char* WIFI_PASS       = "*******";

const char* TARGET_SSID     = "******";           // network to watch
const char* EXPECTED_BSSID  = "";               // optional BSSID check

const char* SERVER_IP       = "***.***.***.***"; // your laptop IP
const int   SERVER_PORT     = 5000;
// ---------------------------------------------------

WiFiClient wifiClient;
bool shouldScan = false;   // will be updated by fetchScanStatus()

void setup() {
  Serial.begin(115200);
  delay(200);

  Serial.println();
  Serial.println("Starting TwinTrap ESP8266...");

  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  delay(100);

  WiFi.begin(WIFI_SSID, WIFI_PASS);

  Serial.print("Connecting to WiFi ");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.println("WiFi connected");
  Serial.print("ESP IP: ");
  Serial.println(WiFi.localIP());
}

String buildScanJson() {
  int n = WiFi.scanNetworks(false, true);
  Serial.printf(" >> Scan found %d networks\n", n);

  String json = "{\"device_id\":\"TwinTrap_ESP8266\",\"scans\":[";
  bool first = true;
  int targetCount = 0;

  for (int i = 0; i < n; i++) {
    String ssid  = WiFi.SSID(i);
    String bssid = WiFi.BSSIDstr(i);
    int  rssi   = WiFi.RSSI(i);

    if (!ssid.isEmpty()) {
      if (!first) json += ",";
      first = false;

      ssid.replace("\"", "\\\"");

      json += "{\"ssid\":\"" + ssid + "\",";
      json += "\"bssid\":\"" + bssid + "\",";
      json += "\"signal\":" + String(rssi) + "}";

      if (ssid == String(TARGET_SSID)) {
        targetCount++;
        Serial.printf("   → Target SSID: %s\n", ssid.c_str());
      }
    }
  }

  if (targetCount > 1) {
    Serial.println("⚠ Possible evil twin (same SSID, multiple)");
  }
  json += "],\"alerts\":[]}";

  WiFi.scanDelete();
  return json;
}

void sendScanToFlask(String scanJson) {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  http.begin(wifiClient, "http://" + String(SERVER_IP) + ":" + String(SERVER_PORT) + "/api/scan");
  http.addHeader("Content-Type", "application/json");

  int code = http.POST(scanJson);
  String resp = http.getString();

  if (code > 0) {
    Serial.printf(" → POST /api/scan: %d\n", code);
    Serial.println("Resp: " + resp);
  } else {
    Serial.printf(" → POST /api/scan failed: %d\n", code);
  }
  http.end();
}

// Ask Flask: "should I be scanning now?"
bool fetchScanStatus() {
  if (WiFi.status() != WL_CONNECTED) return false;

  HTTPClient http;
  http.begin(wifiClient, "http://" + String(SERVER_IP) + ":" + String(SERVER_PORT) + "/api/scan/status");

  int code = http.GET();
  if (code <= 0) {
    Serial.printf(" GET /api/scan/status failed: %d\n", code);
    http.end();
    return false;
  }

  String body = http.getString();
  http.end();

  if (body.indexOf("\"is_scanning\": true") > -1) {
    Serial.println(" ESP: scan enabled by Flask");
    return true;
  } else {
    Serial.println(" ESP: scan disabled by Flask");
    return false;
  }
}

void loop() {
  // Ask Flask every ~5 seconds whether to scan
  shouldScan = fetchScanStatus();
  delay(500);

  if (shouldScan) {
    String scanJson = buildScanJson();
    sendScanToFlask(scanJson);
    delay(5000);
  } else {
    delay(5000);
  }
}
