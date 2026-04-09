import sqlite3
from datetime import datetime

DB_PATH = "twintrap.db"

def get_connection():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS wifi_scans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ssid TEXT NOT NULL,
            bssid TEXT NOT NULL,
            signal_strength INTEGER,
            timestamp TEXT
        )
    """)
    conn.commit()
    conn.close()
    print("[DB] Initialized successfully.")

def insert_scan(ssid, bssid, signal_strength):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO wifi_scans (ssid, bssid, signal_strength, timestamp)
        VALUES (?, ?, ?, ?)
    """, (ssid, bssid, signal_strength, datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
    conn.commit()
    conn.close()

def fetch_all_scans():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT ssid, bssid, signal_strength, timestamp FROM wifi_scans ORDER BY id DESC")
    data = cursor.fetchall()
    conn.close()
    return data
