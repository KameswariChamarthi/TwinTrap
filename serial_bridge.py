"""
serial_bridge.py
Reads raw Serial output from the ESP8266, parses it,
and POSTs structured JSON to Flask /api/scan.
 
Run: python serial_bridge.py
"""
 
import serial
import requests
import re
import time
 
# ── CONFIG ────────────────────────────────────────────────────────────────────
SERIAL_PORT = "COM3"               # Windows: "COM3" | Linux/Mac: "/dev/ttyUSB0"
BAUD_RATE   = 115200
FLASK_URL   = "http://127.0.0.1:5000/api/scan"
DEVICE_ID   = "esp8266-01"
# ─────────────────────────────────────────────────────────────────────────────
 
# Matches: SSID: Vivo  |  BSSID: AA:BB:CC:DD:EE:FF  |  RSSI: -65 dBm
SCAN_RE = re.compile(
    r"SSID:\s*(?P<ssid>.+?)\s*\|\s*BSSID:\s*(?P<bssid>[0-9A-Fa-f:]{17})\s*\|\s*RSSI:\s*(?P<rssi>-?\d+)"
)
ALERT_RE = re.compile(r"WARNING|ALERT|EVIL TWIN", re.IGNORECASE)
 
# Lines that signal the end of one full scan cycle
END_MARKERS = (
    "network appears normal",
    "target network not found",
    "possible evil twin",
)
 
 
def post_batch(scans: list, alerts: list):
    payload = {"device_id": DEVICE_ID, "scans": scans, "alerts": alerts}
    try:
        r = requests.post(FLASK_URL, json=payload, timeout=5)
        print(f"[bridge] POST {r.status_code} — scans={len(scans)} alerts={len(alerts)}")
    except requests.exceptions.RequestException as e:
        print(f"[bridge] POST failed: {e}")
 
 
def main():
    print(f"[bridge] Opening {SERIAL_PORT} @ {BAUD_RATE} …")
    with serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=2) as ser:
        print("[bridge] Connected.\n")
        scans, alerts = [], []
 
        while True:
            raw = ser.readline()
            if not raw:
                continue
 
            line = raw.decode("utf-8", errors="replace").strip()
            if not line:
                continue
 
            print(f"[esp]  {line}")
 
            # Parse a network line
            m = SCAN_RE.search(line)
            if m:
                scans.append({
                    "ssid":   m.group("ssid").strip(),
                    "bssid":  m.group("bssid").strip(),
                    "signal": int(m.group("rssi")),
                })
 
            # Collect raw alert strings from Arduino
            if ALERT_RE.search(line):
                alerts.append(line)
 
            # End of scan cycle → flush to Flask
            if any(line.lower().startswith(marker) for marker in END_MARKERS):
                if scans or alerts:
                    post_batch(scans, alerts)
                scans, alerts = [], []
 
 
if __name__ == "__main__":
    while True:
        try:
            main()
        except serial.SerialException as e:
            print(f"[bridge] Serial error: {e} — retrying in 5s …")
            time.sleep(5)
        except KeyboardInterrupt:
            print("\n[bridge] Stopped.")
            break