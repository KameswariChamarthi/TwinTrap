from flask import Flask, render_template, request, jsonify
from flask_sock import Sock
from collections import deque
from detection import detect_evil_twins
import json, threading, database, time
 
app  = Flask(__name__)
sock = Sock(app)
 
is_scanning = False
scan_thread = None
 
scan_log   = deque(maxlen=200)
ws_clients = set()
ws_lock    = threading.Lock()
 
 
# ── Broadcast to all WebSocket clients ───────────────────────────────────────
 
def broadcast(data: dict):
    msg  = json.dumps(data)
    dead = set()
    with ws_lock:
        for ws in ws_clients:
            try:
                ws.send(msg)
            except Exception:
                dead.add(ws)
        ws_clients.difference_update(dead)
 
 
# ── Background scan loop (keeps is_scanning in sync; ESP polls the flag) ─────
 
def run_scan_loop():
    global is_scanning
    while is_scanning:
        time.sleep(1)   # ESP polls /api/scan/status itself; nothing to push here
 
 
# ── Init DB ───────────────────────────────────────────────────────────────────
 
database.init_db()
 
 
# ── Routes ────────────────────────────────────────────────────────────────────
 
@app.route("/")
def index():
    return render_template("index.html")
 
 
# ---------- Scan control endpoints (called by frontend buttons) ---------------
 
@app.route("/api/scan/status", methods=["GET"])
def scan_status():
    """ESP polls this every ~5 s to decide whether to scan."""
    return jsonify({"is_scanning": is_scanning})
 
 
@app.route("/api/scan/start", methods=["POST"])
def start_scan():
    global is_scanning, scan_thread
    if not is_scanning:
        is_scanning = True
        print("\n[Flask] Scanning STARTED")
        scan_thread = threading.Thread(target=run_scan_loop, daemon=True)
        scan_thread.start()
    return jsonify({"status": "scan started", "is_scanning": is_scanning})
 
 
@app.route("/api/scan/stop", methods=["POST"])
def stop_scan():
    global is_scanning
    is_scanning = False          # run_scan_loop exits on next iteration
    print("\n[Flask] Scanning STOPPED")
    return jsonify({"status": "scan stopped", "is_scanning": is_scanning})
 
 
# ---------- Receive live scan data from ESP -----------------------------------
 
@app.route("/api/scan", methods=["POST"])
def receive_scan():
    """
    Called by the ESP8266 after every WiFi.scanNetworks() cycle.
    Body: { device_id, scans: [{ssid, bssid, signal}], alerts: [] }
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "invalid JSON"}), 400
 
    scans     = data.get("scans", [])
    alerts    = data.get("alerts", [])
    device_id = data.get("device_id", "unknown")
 
    # Persist to DB
    for net in scans:
        ssid   = net.get("ssid")
        bssid  = net.get("bssid")
        signal = net.get("signal", 0)
        if ssid and bssid:
            database.insert_scan(ssid, bssid, signal)
 
    # Run evil-twin detection
    evil_twins = detect_evil_twins(scans)
 
    # Shape alerts so the frontend appendAlert() can read .severity / .message
    for ssid in evil_twins:
        alerts.append({
            "type":     "EVIL_TWIN",
            "severity": "HIGH",
            "message":  f"Evil Twin detected for SSID: {ssid}",
            "ssid":     ssid
        })
 
    entry = {
        "device_id":  device_id,
        "scans":      scans,
        "alerts":     alerts,
        "evil_twins": evil_twins,
    }
 
    scan_log.appendleft(entry)
    broadcast({"type": "SCAN_UPDATE", "entry": entry})
 
    return jsonify({
        "status":     "ok",
        "scans":      len(scans),
        "alerts":     len(alerts),
        "evil_twins": evil_twins
    })
 
 
# ---------- History (called on page load) ------------------------------------
 
@app.route("/api/logs", methods=["GET"])
def get_logs():
    """
    Returns DB history shaped as SCAN_UPDATE entries so the frontend's
    `entry.scans.forEach(...)` and deduplication (seenNetworks Map) work.
    Each unique ssid+bssid pair is its own entry to prevent duplicate cards.
    """
    rows = database.fetch_all_scans()
    seen   = set()
    result = []
 
    for row in rows:
        ssid, bssid, signal = row[0], row[1], row[2]
        key = (ssid, bssid)
        if key in seen:
            continue
        seen.add(key)
        result.append({
            "device_id":  "TwinTrap_ESP8266",
            "scans": [{
                "ssid":   ssid,
                "bssid":  bssid,
                "signal": signal,
                "rssi":   signal,   # frontend reads both names
            }],
            "alerts":     [],
            "evil_twins": []
        })
 
    return jsonify(result)
 
 
# ── WebSocket ─────────────────────────────────────────────────────────────────
 
@sock.route("/ws")
def ws_handler(ws):
    with ws_lock:
        ws_clients.add(ws)
    try:
        # Send recent history immediately on connect
        ws.send(json.dumps({"type": "INITIAL", "logs": list(scan_log)[:20]}))
        while True:
            msg = ws.receive(timeout=30)
            if msg is None:
                break
    except Exception:
        pass
    finally:
        with ws_lock:
            ws_clients.discard(ws)
 
 
# ── Entry point ───────────────────────────────────────────────────────────────
 
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)