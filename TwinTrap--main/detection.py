from collections import defaultdict

def detect_evil_twins(scan_data):
    """
    Input: List of dicts → [{ssid, bssid, signal}, ...]
    Returns: List of SSIDs suspected as evil twins.
    """

    ssid_map = defaultdict(set)

    for network in scan_data:
        ssid = network.get('ssid')
        bssid = network.get('bssid')
        if ssid and bssid:
            ssid_map[ssid].add(bssid)

    # Evil twin = same SSID appearing with multiple unique BSSIDs
    evil_twins = [ssid for ssid, bssids in ssid_map.items() if len(bssids) > 1]

    if evil_twins:
        print(f"[⚠️ Detection] Evil Twin(s) found: {evil_twins}")
    else:
        print("[✅ Detection] No Evil Twins found.")

    return evil_twins
