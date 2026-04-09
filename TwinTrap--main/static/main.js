// ==========================================================
// TwinTrap v2 — SPA + Live ESP8266 Scanner + Chart + Alerts
// ==========================================================
(() => {
  document.addEventListener('DOMContentLoaded', () => {
 
    /** ------------------------
     *  Element references
     ------------------------ */
    const sidebar      = document.getElementById('sidebar');
    const menuToggle   = document.getElementById('menuToggle');
    const navLinks     = Array.from(document.querySelectorAll('.sidebar-menu a, a.nav-link'));
    const statusEl     = document.getElementById('status');
    const resultsGrid  = document.getElementById('resultsGridFull');
    const filterSelect = document.getElementById('filterVerdict');
    const countGood    = document.getElementById('count-good');
    const countSusp    = document.getElementById('count-suspicious');
    const countMal     = document.getElementById('count-malicious');
 
    // Start / Stop buttons (from index.html)
    const startScanBtn = document.getElementById('startScanBtn');
    const stopScanBtn  = document.getElementById('stopScanBtn');
 
    /** ------------------------
     *  SPA Navigation
     ------------------------ */
    const pages = ['home','analyze','results','about'];
    function navigate(page) {
      if (!pages.includes(page)) page = 'home';
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.getElementById(page)?.classList.add('active');
      navLinks.forEach(a => a.classList.toggle('active', a.dataset.page === page));
      history.replaceState(null, '', '#' + page);
    }
    window.showPage = navigate;
    navLinks.forEach(a => a.addEventListener('click', e => {
      e.preventDefault();
      navigate(a.dataset.page);
    }));
 
    /** ------------------------
     *  Sidebar toggle
     ------------------------ */
    const updateToggleIcon = () => {
      if (menuToggle) menuToggle.textContent = sidebar.classList.contains('active') ? '✕' : '☰';
    };
    menuToggle?.addEventListener('click', e => {
      e.stopPropagation();
      sidebar.classList.toggle('active');
      updateToggleIcon();
    });
    document.addEventListener('click', e => {
      if (window.innerWidth <= 900 && sidebar && !sidebar.contains(e.target) && e.target !== menuToggle) {
        sidebar.classList.remove('active');
        updateToggleIcon();
      }
    });
    updateToggleIcon();
 
    /** ------------------------
     *  Chart.js setup
     ------------------------ */
    const ctx = document.getElementById('scanChart')?.getContext('2d');
    const scanChart = ctx ? new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          { label: 'Good',       data: [], borderColor: 'green',  backgroundColor: 'rgba(0,255,0,0.2)',   fill: true },
          { label: 'Suspicious', data: [], borderColor: 'orange', backgroundColor: 'rgba(255,165,0,0.2)', fill: true },
          { label: 'Malicious',  data: [], borderColor: 'red',    backgroundColor: 'rgba(255,0,0,0.2)',   fill: true }
        ]
      },
      options: {
        responsive: true,
        animation: { duration: 0 },
        scales: { y: { beginAtZero: true, max: 10 } },
        plugins: { legend: { position: 'top' } }
      }
    }) : null;
 
    /** ------------------------
     *  Deduplication store
     *  key = ssid + "||" + bssid
     ------------------------ */
    const seenNetworks = new Map();
 
    /** ------------------------
     *  Verdict logic
     *  (mirrors what the Results section needs)
     ------------------------ */
    function getVerdict(net, evilTwins) {
      const ssid = net.ssid || '';
      const rssi = net.signal ?? net.rssi ?? 0;
      if (Array.isArray(evilTwins) && evilTwins.includes(ssid)) return 'malicious';
      if (rssi <= -80 || net.open === true || !ssid)             return 'suspicious';
      return 'good';
    }
 
    /** ------------------------
     *  Render AP card into resultsGrid
     ------------------------ */
    function renderAP(net, evilTwins) {
      if (!resultsGrid) return;
 
      const ssid  = net.ssid  || '(hidden)';
      const bssid = net.bssid || '';
      const key   = ssid + '||' + bssid;
 
      // Skip duplicates
      if (seenNetworks.has(key)) return;
      seenNetworks.set(key, true);
 
      const rssi    = net.signal ?? net.rssi ?? 0;
      const verdict = getVerdict(net, evilTwins);
      const enc     = net.encryption || (net.open ? 'OPEN' : 'Secured');
      const score   = verdict === 'malicious' ? 20 : verdict === 'suspicious' ? 55 : 85;
 
      const div = document.createElement('div');
      div.className = `ap-card ${verdict}`;
      div.setAttribute('data-verdict', verdict);
      div.style.borderLeft = `6px solid ${verdict === 'good' ? 'green' : verdict === 'suspicious' ? 'orange' : 'red'}`;
      div.style.background  = verdict === 'good'
        ? 'rgba(0,255,0,0.05)'
        : verdict === 'suspicious'
          ? 'rgba(255,165,0,0.08)'
          : 'rgba(255,0,0,0.1)';
 
      div.innerHTML = `
        <div class="ap-label">${ssid}</div>
        <div class="ap-details">
          BSSID: <code>${bssid}</code> •
          RSSI: ${rssi} dBm •
          Ch: ${net.channel || '—'} •
          ${enc}
        </div>
        <div class="explanation">Score: ${score} — ${verdict.charAt(0).toUpperCase() + verdict.slice(1)}</div>`;
 
      resultsGrid.prepend(div);
      updateCounts();
    }
 
    /** ------------------------
     *  Append to Analyze log table
     ------------------------ */
    function appendScanRow(scan, deviceId) {
      const logTable = document.querySelector('#log-body');
      if (!logTable) return;
 
      // Remove empty-state placeholder
      const emptyRow = logTable.querySelector('.empty-state');
      if (emptyRow) logTable.removeChild(emptyRow);
 
      const rssi      = scan.signal ?? scan.rssi ?? 0;
      const rssiColor = rssi > -60 ? '#16a34a' : rssi > -75 ? '#ca8a04' : '#dc2626';
      const tr        = document.createElement('tr');
      tr.innerHTML    = `
        <td>${new Date().toLocaleTimeString()}</td>
        <td>${deviceId || ''}</td>
        <td>${scan.ssid || '(hidden)'}</td>
        <td style="font-family:monospace;font-size:12px">${scan.bssid || ''}</td>
        <td>${scan.channel || ''}</td>
        <td style="color:${rssiColor}">${rssi} dBm</td>
        <td>${scan.open ? '<span style="color:#dc2626">Open</span>' : 'Secured'}</td>`;
 
      logTable.prepend(tr);
      while (logTable.rows.length > 100) logTable.deleteRow(-1);
    }
 
    /** ------------------------
     *  Append alert to #alerts box
     ------------------------ */
    function appendAlert(alert) {
      const alertBox = document.querySelector('#alerts');
      if (!alertBox) return;
 
      const isHigh = (typeof alert === 'object' ? alert.severity : '') === 'HIGH';
      const msg    = typeof alert === 'string'
        ? alert
        : (alert.message || alert.raw || JSON.stringify(alert));
 
      const div = document.createElement('div');
      div.className = 'alert-item';
      div.style.cssText = `
        padding:10px 14px;border-radius:6px;margin-bottom:8px;
        background:${isHigh ? '#fee2e2' : '#fef9c3'};
        border-left:4px solid ${isHigh ? '#dc2626' : '#ca8a04'};
        color:${isHigh ? '#991b1b' : '#854d0e'};`;
      div.innerHTML = `<strong>${isHigh ? 'EVIL TWIN' : 'ALERT'}</strong>
        — ${msg}
        <span style="float:right;font-size:11px;opacity:.7">${new Date().toLocaleTimeString()}</span>`;
      alertBox.prepend(div);
    }
 
    /** ------------------------
     *  Update summary counts
     ------------------------ */
    function updateCounts() {
      if (!resultsGrid) return;
      let good = 0, suspicious = 0, malicious = 0;
      resultsGrid.querySelectorAll('[data-verdict]').forEach(el => {
        const v = el.getAttribute('data-verdict');
        if (v === 'good')       good++;
        if (v === 'suspicious') suspicious++;
        if (v === 'malicious')  malicious++;
      });
      if (countGood) countGood.textContent = good;
      if (countSusp) countSusp.textContent = suspicious;
      if (countMal)  countMal.textContent  = malicious;
 
      // Update chart with latest counts
      if (scanChart) {
        scanChart.data.labels.push(new Date().toLocaleTimeString());
        scanChart.data.datasets[0].data.push(good);
        scanChart.data.datasets[1].data.push(suspicious);
        scanChart.data.datasets[2].data.push(malicious);
        if (scanChart.data.labels.length > 15) {
          scanChart.data.labels.shift();
          scanChart.data.datasets.forEach(d => d.data.shift());
        }
        scanChart.update('none');
      }
    }
 
    /** ------------------------
     *  Evil-twin floating alert box
     ------------------------ */
    function createAlertBox() {
      const div = document.createElement('div');
      div.id = 'alert-box';
      div.style.cssText = "display:none;position:fixed;top:80px;left:50%;transform:translateX(-50%);" +
        "background:#ff004d;color:#fff;padding:12px 18px;border-radius:8px;z-index:2000;font-weight:bold;";
      document.body.appendChild(div);
      return div;
    }
    function showFloatingAlert(ssids) {
      const box = document.getElementById('alert-box') || createAlertBox();
      box.innerHTML = `⚠️ Evil Twin Detected: ${ssids.join(', ')}`;
      box.style.display = 'block';
      setTimeout(() => { box.style.display = 'none'; }, 9000);
    }
 
    /** ------------------------
     *  Start Scan → POST /api/scan/start
     *  ESP polls /api/scan/status and starts scanning when true
     ------------------------ */
    async function startScan() {
      try {
        const r = await fetch('/api/scan/start', { method: 'POST' });
        const d = await r.json();
        console.log('[TwinTrap] Scan started:', d);
      } catch (e) {
        console.error('[TwinTrap] startScan failed:', e);
      }
      if (startScanBtn) startScanBtn.style.display = 'none';
      if (stopScanBtn)  stopScanBtn.style.display  = '';
      if (statusEl)     statusEl.textContent        = '🔴 Scanning...';
    }
 
    /** ------------------------
     *  Stop Scan → POST /api/scan/stop
     ------------------------ */
    async function stopScan() {
      try {
        const r = await fetch('/api/scan/stop', { method: 'POST' });
        const d = await r.json();
        console.log('[TwinTrap] Scan stopped:', d);
      } catch (e) {
        console.error('[TwinTrap] stopScan failed:', e);
      }
      if (startScanBtn) startScanBtn.style.display = '';
      if (stopScanBtn)  stopScanBtn.style.display  = 'none';
      if (statusEl)     statusEl.textContent        = '🟢 Idle';
    }
 
    // Expose for inline onclick handlers in index.html
    window.startScan  = startScan;
    window.stopScan   = stopScan;
 
    // Also wire up via addEventListener (belt-and-suspenders)
    startScanBtn?.addEventListener('click', e => { e.preventDefault(); startScan(); });
    stopScanBtn?.addEventListener('click',  e => { e.preventDefault(); stopScan(); });
 
    // Sync button state with Flask on page load
    fetch('/api/scan/status')
      .then(r => r.json())
      .then(d => {
        if (d.is_scanning) {
          if (startScanBtn) startScanBtn.style.display = 'none';
          if (stopScanBtn)  stopScanBtn.style.display  = '';
          if (statusEl)     statusEl.textContent        = '🔴 Scanning...';
        }
      })
      .catch(() => {});
 
    /** ------------------------
     *  Filter results
     ------------------------ */
    window.filterResults = (value) => {
      if (!resultsGrid) return;
      resultsGrid.querySelectorAll('.ap-card').forEach(card => {
        card.style.display = (value === 'all' || card.classList.contains(value)) ? '' : 'none';
      });
      updateCounts();
    };
    filterSelect?.addEventListener('change', () => filterResults(filterSelect.value));
 
    /** ------------------------
     *  Export JSON
     ------------------------ */
    window.exportResults = () => {
      if (!resultsGrid) return;
      const nets = Array.from(resultsGrid.querySelectorAll('[data-verdict]')).map(el => ({
        ssid:    el.querySelector('.ap-label')?.textContent.trim() || '',
        details: el.querySelector('.ap-details')?.textContent.trim() || '',
        verdict: el.getAttribute('data-verdict')
      }));
      const report = {
        generatedAt: new Date().toISOString(),
        tool: 'TwinTrap - Fake WiFi Detection Tool',
        analysis: {
          totalNetworks: nets.length,
          trusted:    nets.filter(n => n.verdict === 'good').length,
          suspicious: nets.filter(n => n.verdict === 'suspicious').length,
          malicious:  nets.filter(n => n.verdict === 'malicious').length
        },
        networks: nets
      };
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `twintrap-report-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    };
 
    /** ------------------------
     *  Q&A accordion
     ------------------------ */
    document.querySelectorAll('.question').forEach(q => q.addEventListener('click', () => {
      q.parentElement.classList.toggle('active');
    }));
 
    /** ------------------------
     *  WebSocket — live feed from Flask
     *  Replaces socket.io (backend uses flask-sock / plain WS)
     ------------------------ */
    function connectWS() {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const ws    = new WebSocket(`${proto}://${location.host}/ws`);
 
      ws.onopen = () => {
        console.log('[TwinTrap] WebSocket connected');
        if (statusEl && statusEl.textContent === '○ Offline') statusEl.textContent = '🟢 Idle';
      };
 
      ws.onmessage = (e) => {
        let msg;
        try { msg = JSON.parse(e.data); } catch { return; }
 
        if (msg.type === 'INITIAL') {
          msg.logs.forEach(entry => {
            const scans     = entry.scans      || [];
            const evilTwins = entry.evil_twins || [];
            scans.forEach(s => {
              appendScanRow(s, entry.device_id);
              renderAP(s, evilTwins);
            });
          });
          return;
        }
 
        if (msg.type === 'SCAN_UPDATE') {
          const entry     = msg.entry;
          const scans     = entry.scans      || [];
          const alerts    = entry.alerts     || [];
          const evilTwins = entry.evil_twins || [];
 
          scans.forEach(s => {
            appendScanRow(s, entry.device_id);
            renderAP(s, evilTwins);
          });
 
          alerts.forEach(a => appendAlert(a));
 
          if (evilTwins.length) {
            showFloatingAlert(evilTwins);
          }
        }
      };
 
      ws.onclose = () => {
        console.log('[TwinTrap] WS closed — reconnecting in 3s');
        setTimeout(connectWS, 3000);
      };
 
      ws.onerror = () => ws.close();
    }
 
    /** ------------------------
     *  Bootstrap: load history then open WS
     ------------------------ */
    fetch('/api/logs')
      .then(r => r.json())
      .then(logs => {
        logs.forEach(entry => {
          const scans     = entry.scans      || [];
          const evilTwins = entry.evil_twins || [];
          scans.forEach(s => {
            appendScanRow(s, entry.device_id);
            renderAP(s, evilTwins);
          });
        });
      })
      .catch(() => {})
      .finally(connectWS);
 
    /** ------------------------
     *  Initial navigation
     ------------------------ */
    navigate(window.location.hash?.slice(1) || 'home');
 
  }); // end DOMContentLoaded
})();