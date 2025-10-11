// ==UserScript==
// @name         GeoFS Flight Utility Panel
// @version      1.1
// @description  GeoFS panel: Timer (pause/reset), Fuel, Logbook (TXT), Route Calculator (ICAO/IATA, default cruise), Emergency Squawk (overlay), Mouse-driven Calculator with flight helpers. Author: AeroBaden
// @author       AeroBaden
// @match        https://www.geo-fs.com/geofs.php?v=*
// @match        https://*.geo-fs.com/geofs.php*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';
  if (window.geofsUtilityPanel) return;
  window.geofsUtilityPanel = true;

  /* ---------- STYLES ---------- */
  const style = document.createElement('style');
  style.textContent = `
    #gfu-btn { position: fixed; bottom: 12px; left: 12px; z-index:10050;
      width:44px;height:44px;border-radius:8px;background:#1e293b;color:#fff;border:none;font-size:18px;
      display:flex;align-items:center;justify-content:center;box-shadow:0 6px 20px rgba(0,0,0,0.4);cursor:pointer;}
    #gfu-panel { position: fixed; top: 60px; right: 20px; width:420px; max-height:82vh; overflow:auto;
      background: rgba(17,24,39,0.97); color: #e6eef8; border-radius:12px; padding:12px; z-index:10050;
      box-shadow:0 12px 40px rgba(2,6,23,0.6); border:1px solid rgba(255,255,255,0.04); font-family: 'Segoe UI', sans-serif; font-size:13px; display:none;}
    .gfu-tabs { display:flex; gap:6px; margin-bottom:10px; flex-wrap:wrap; }
    .gfu-tab-btn { flex:1; padding:6px 8px; background:#0f1724; color:#9fb3d6; border-radius:6px; border:none; cursor:pointer; font-weight:600;}
    .gfu-tab-btn.active { background:#2563eb; color:#fff; }
    .gfu-tab { display:none; }
    .gfu-tab.active { display:block; }
    .gfu-input { width:100%; padding:8px; margin:6px 0; border-radius:6px; border:1px solid #334155; background:#0b1220; color:#e6eef8; }
    .gfu-btn { width:100%; background:#2563eb; border:none; color:white; padding:8px; border-radius:6px; cursor:pointer; margin:6px 0; }
    .gfu-btn.small { width:auto; padding:6px 8px; display:inline-block; margin-right:6px; }
    .gfu-result { background:rgba(255,255,255,0.02); padding:8px; border-radius:6px; margin-top:6px; white-space:pre-wrap; color:#dbeafe; }
    .gfu-log-entry { padding:6px 4px; border-bottom:1px solid rgba(255,255,255,0.03); }
    #gfu-squawk-overlay { position: fixed; top:10px; left:50%; transform:translateX(-50%); z-index:10060;
      background:rgba(255,0,0,0.06); padding:8px 14px; border-radius:8px; color:#ffdddd; font-weight:700; display:none;
      box-shadow:0 0 18px rgba(255,0,0,0.15); font-size:20px; }
    @keyframes gfu-blink { 0%{opacity:1;} 50%{opacity:0.15;} 100%{opacity:1;} }
    .gfu-blink { animation: gfu-blink 1s infinite; color: #ffb3b3; text-shadow:0 0 8px rgba(255,0,0,0.25); }
    /* Calculator grid */
    .calc-display { background:#071022; padding:10px; border-radius:6px; color:#cfe8ff; font-size:18px; text-align:right; min-height:34px; }
    .calc-grid { display:grid; grid-template-columns: repeat(4, 1fr); gap:6px; margin-top:8px; }
    .calc-key { background:#0f1724; border:1px solid #16202b; padding:10px; border-radius:6px; text-align:center; cursor:pointer; color:#d7ecff; font-weight:600; user-select:none; }
    .calc-key.op { background:#184b8a; }
    .calc-key.action { background:#2a303a; }
  `;
  document.head.appendChild(style);

  /* ---------- UI ---------- */
  const btn = document.createElement('button');
  btn.id = 'gfu-btn';
  btn.title = 'GeoFS Flight Utility';
  btn.innerText = '⏱';
  document.body.appendChild(btn);

  const panel = document.createElement('div');
  panel.id = 'gfu-panel';
  panel.innerHTML = `
    <div class="gfu-tabs">
      <button class="gfu-tab-btn active" data-tab="tab-timer">Timer</button>
      <button class="gfu-tab-btn" data-tab="tab-fuel">Fuel</button>
      <button class="gfu-tab-btn" data-tab="tab-log">Logbook</button>
      <button class="gfu-tab-btn" data-tab="tab-route">Route</button>
      <button class="gfu-tab-btn" data-tab="tab-squawk">Squawk</button>
      <button class="gfu-tab-btn" data-tab="tab-calc">Calculator</button>
    </div>

    <div id="tab-timer" class="gfu-tab active">
      <div style="display:flex;gap:8px;">
        <button class="gfu-btn" id="gfu-start">Start / Resume</button>
        <button class="gfu-btn" id="gfu-pause">Pause</button>
        <button class="gfu-btn" id="gfu-reset">Reset</button>
      </div>
      <div id="gfu-timer-display" class="gfu-result" style="font-size:20px;text-align:center;">00:00:00</div>
    </div>

    <div id="tab-fuel" class="gfu-tab">
      <input id="gfu-fuel-flow" class="gfu-input" placeholder="Fuel flow (kg/hr)">
      <input id="gfu-fuel-time" class="gfu-input" placeholder="Flight time (hours)">
      <button class="gfu-btn" id="gfu-calc-fuel">Calculate Fuel Required</button>
      <div id="gfu-fuel-result" class="gfu-result"></div>
    </div>

    <div id="tab-log" class="gfu-tab">
      <textarea id="gfu-log-text" class="gfu-input" rows="5" placeholder="Notes..."></textarea>
      <div style="display:flex;gap:8px;">
        <button class="gfu-btn" id="gfu-save-log">Save Entry</button>
        <button class="gfu-btn" id="gfu-download-log">Download .txt</button>
      </div>
      <div id="gfu-log-list" class="gfu-result"></div>
    </div>

    <div id="tab-route" class="gfu-tab">
      <input id="gfu-dep" class="gfu-input" placeholder="Departure ICAO/IATA (e.g. EDDF or FRA)">
      <input id="gfu-arr" class="gfu-input" placeholder="Destination ICAO/IATA (e.g. KJFK or JFK)">
      <div style="display:flex;gap:8px;">
        <button class="gfu-btn" id="gfu-calc-route">Calculate Route (default cruise 450 kt)</button>
        <button class="gfu-btn" id="gfu-clear-route">Clear</button>
      </div>
      <div id="gfu-route-result" class="gfu-result"></div>
    </div>

    <div id="tab-squawk" class="gfu-tab">
      <input id="gfu-squawk-input" class="gfu-input" placeholder="Enter squawk code (4 digits)">
      <div style="display:flex;gap:8px;">
        <button class="gfu-btn" id="gfu-set-squawk">Set Squawk</button>
        <button class="gfu-btn" id="gfu-clear-squawk">Clear</button>
      </div>
      <div style="display:flex;gap:6px;margin-top:8px;">
        <button class="gfu-btn small" data-code="7500">7500</button>
        <button class="gfu-btn small" data-code="7600">7600</button>
        <button class="gfu-btn small" data-code="7700">7700</button>
      </div>
      <div id="gfu-squawk-status" class="gfu-result"></div>
    </div>

    <div id="tab-calc" class="gfu-tab">
      <div class="calc-display" id="calc-display">0</div>
      <div class="calc-grid" id="calc-grid">
        <!-- row 1 -->
        <div class="calc-key" data-key="7">7</div>
        <div class="calc-key" data-key="8">8</div>
        <div class="calc-key" data-key="9">9</div>
        <div class="calc-key op" data-key="/">÷</div>
        <!-- row 2 -->
        <div class="calc-key" data-key="4">4</div>
        <div class="calc-key" data-key="5">5</div>
        <div class="calc-key" data-key="6">6</div>
        <div class="calc-key op" data-key="*">×</div>
        <!-- row 3 -->
        <div class="calc-key" data-key="1">1</div>
        <div class="calc-key" data-key="2">2</div>
        <div class="calc-key" data-key="3">3</div>
        <div class="calc-key op" data-key="-">−</div>
        <!-- row 4 -->
        <div class="calc-key" data-key="0">0</div>
        <div class="calc-key" data-key=".">.</div>
        <div class="calc-key action" data-key="C">C</div>
        <div class="calc-key op" data-key="+">+</div>
        <!-- row 5 -->
        <div class="calc-key action" data-key="fuel">Fuel Burn</div>
        <div class="calc-key action" data-key="descent">Descent</div>
        <div class="calc-key action" data-key="glide">Glide</div>
        <div class="calc-key action" data-key="=">=</div>
      </div>
      <div id="calc-help" class="gfu-result" style="margin-top:8px; font-size:12px;">
        Special keys:<br>
        <b>Fuel Burn</b> =&gt; multiply flow(kg/hr) × hours → kg (prompts)<br>
        <b>Descent</b> =&gt; calculates Top Of Descent (NM) from altitude(ft), descent rate(fpm) &amp; groundspeed(kt) (prompts)<br>
        <b>Glide</b> =&gt; glide distance (NM) from altitude(ft) &amp; glide ratio (e.g. 15) (prompts)
      </div>
    </div>
  `;
  document.body.appendChild(panel);

  const overlay = document.createElement('div');
  overlay.id = 'gfu-squawk-overlay';
  document.body.appendChild(overlay);

  /* ---------- Small airport DB (ICAO/IATA) ---------- */
  const AIRPORTS = {
    "EDDF": { lat: 50.033, lon: 8.570 }, "FRA": { lat: 50.033, lon: 8.570 },
    "KJFK": { lat: 40.641, lon: -73.778 }, "JFK": { lat: 40.641, lon: -73.778 },
    "EGLL": { lat: 51.4775, lon: -0.4614 }, "LHR": { lat: 51.4775, lon: -0.4614 },
    "EHAM": { lat: 52.308, lon: 4.764 }, "AMS": { lat: 52.308, lon: 4.764 },
    "KLAX": { lat: 33.9416, lon: -118.4085 }, "LAX": { lat: 33.9416, lon: -118.4085 },
    "OMDB": { lat: 25.253, lon: 55.365 }, "DXB": { lat: 25.253, lon: 55.365 },
    "RJTT": { lat: 35.552, lon: 139.779 }, "HND": { lat: 35.552, lon: 139.779 },
    "RJAA": { lat: 35.7647, lon: 140.386 }, "NRT": { lat: 35.7647, lon: 140.386 },
    "EHAM": { lat: 52.308, lon: 4.764 }, "AMS": { lat: 52.308, lon: 4.764 }
  };

  /* ---------- Helpers ---------- */
  function toUpperTrim(s) { return (s || '').toString().trim().toUpperCase(); }

  function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const r = Math.PI / 180;
    const dLat = (lat2 - lat1) * r;
    const dLon = (lon2 - lon1) * r;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * r) * Math.cos(lat2 * r) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function formatDurationFromHours(hours) {
    const totalMinutes = Math.round(hours * 60);
    const days = Math.floor(totalMinutes / (24 * 60));
    const hrs = Math.floor((totalMinutes % (24 * 60)) / 60);
    const mins = totalMinutes % 60;
    return (days > 0 ? `${days}d ` : '') + `${hrs}h ${mins}m`;
  }

  /* ---------- Panel behavior ---------- */
  btn.addEventListener('click', () => {
    panel.style.display = panel.style.display === 'flex' ? 'none' : 'flex';
  });

  panel.querySelectorAll('.gfu-tab-btn').forEach(b => {
    b.addEventListener('click', () => {
      panel.querySelectorAll('.gfu-tab-btn').forEach(x => x.classList.remove('active'));
      panel.querySelectorAll('.gfu-tab').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      const tab = b.dataset.tab;
      const el = document.getElementById(tab);
      if (el) el.classList.add('active');
    });
  });

  /* ---------- Timer (start/resume/pause/reset) ---------- */
  let timerInterval = null;
  let startTime = 0; // timestamp when started (ms)
  let elapsed = 0; // ms elapsed before running (ms)

  const timerDisplay = document.getElementById('gfu-timer-display');
  function updateTimerDisplay() {
    const ms = elapsed + (timerInterval ? Date.now() - startTime : 0);
    const s = Math.floor(ms / 1000);
    const hh = Math.floor(s / 3600); const mm = Math.floor((s % 3600) / 60); const ss = s % 60;
    timerDisplay.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  }

  document.getElementById('gfu-start').addEventListener('click', () => {
    if (!timerInterval) {
      startTime = Date.now();
      timerInterval = setInterval(updateTimerDisplay, 250);
      // If elapsed is 0 and no previous, startTime=now (already set)
    }
  });

  document.getElementById('gfu-pause').addEventListener('click', () => {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
      elapsed += Date.now() - startTime;
      updateTimerDisplay();
    }
  });

  document.getElementById('gfu-reset').addEventListener('click', () => {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    startTime = 0; elapsed = 0;
    updateTimerDisplay();
  });

  updateTimerDisplay();

  /* ---------- Fuel ---------- */
  document.getElementById('gfu-calc-fuel').addEventListener('click', () => {
    const flow = parseFloat(document.getElementById('gfu-fuel-flow').value);
    const time = parseFloat(document.getElementById('gfu-fuel-time').value);
    const out = document.getElementById('gfu-fuel-result');
    if (isNaN(flow) || isNaN(time)) { out.textContent = 'Invalid input'; return; }
    const req = flow * time;
    // Show hours in hh:mm and dd:hh:mm
    const hours = time;
    const hhmm = formatDurationFromHours(hours);
    out.textContent = `Fuel required: ${req.toFixed(1)} kg\nFlight time: ${hours.toFixed(2)} h (${hhmm})`;
  });

  /* ---------- Logbook ---------- */
  const LOG_KEY = 'gfu_logbook_v1';
  let logEntries = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
  const logList = document.getElementById('gfu-log-list');

  function renderLog() {
    logList.innerHTML = '';
    logEntries.forEach((e, i) => {
      const d = document.createElement('div');
      d.className = 'gfu-log-entry';
      d.textContent = `${i + 1}. [${e.ts}] ${e.text}`;
      logList.appendChild(d);
    });
  }
  renderLog();

  document.getElementById('gfu-save-log').addEventListener('click', () => {
    const txt = document.getElementById('gfu-log-text').value.trim();
    if (!txt) return;
    logEntries.push({ ts: new Date().toLocaleString(), text: txt });
    localStorage.setItem(LOG_KEY, JSON.stringify(logEntries));
    document.getElementById('gfu-log-text').value = '';
    renderLog();
  });

  document.getElementById('gfu-download-log').addEventListener('click', () => {
    const lines = logEntries.map(e => `[${e.ts}] ${e.text}`).join('\n');
    const blob = new Blob([lines], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'GeoFS_Logbook.txt'; a.click(); URL.revokeObjectURL(url);
  });

  /* ---------- Route Calculator (no aircraft selection; default cruise = 450 kt) ---------- */
  document.getElementById('gfu-calc-route').addEventListener('click', () => {
    const dep = toUpperTrim(document.getElementById('gfu-dep').value);
    const arr = toUpperTrim(document.getElementById('gfu-arr').value);
    const out = document.getElementById('gfu-route-result');
    if (!dep || !arr) { out.textContent = 'Please enter both departure and destination codes.'; return; }
    const a1 = AIRPORTS[dep];
    const a2 = AIRPORTS[arr];
    if (!a1 || !a2) { out.textContent = 'Airport not found in DB. Use ICAO/IATA from the included list or add more airports.'; return; }

    const km = haversineKm(a1.lat, a1.lon, a2.lat, a2.lon);
    const nm = km / 1.852;
    const cruise = 450; // default cruise speed in kt
    const hours = nm / cruise;
    const hh = Math.floor(hours);
    const mm = Math.floor((hours - hh) * 60);
    out.textContent = `Route: ${dep} → ${arr}\nDistance: ${nm.toFixed(1)} NM (${km.toFixed(1)} km)\nAssumed cruise: ${cruise} kt\nETA: ~${hh}h ${mm}m (${formatDurationFromHours(hours)})`;
  });

  document.getElementById('gfu-clear-route').addEventListener('click', () => {
    document.getElementById('gfu-dep').value = '';
    document.getElementById('gfu-arr').value = '';
    document.getElementById('gfu-route-result').textContent = '';
  });

  /* ---------- Squawk ---------- */
  let activeSquawk = null;
  function setSquawk(code) {
    activeSquawk = code;
    overlay.textContent = `SQUAWK ${code}`;
    overlay.style.display = 'block';
    overlay.classList.add('gfu-blink');
    document.getElementById('gfu-squawk-status').textContent = `Active: ${code}`;
    // try blinking aircraft model (best-effort; may fail silently)
    try {
      if (typeof geofs !== 'undefined' && geofs.aircraft && geofs.aircraft.instance && geofs.aircraft.instance.model && geofs.aircraft.instance.model.object3d) {
        // add a CSS class to object3d element (if DOM-like) - Three.js objects don't accept classList
        // Alternative: toggle visibility of a red sprite if present (not implemented). So this is a gentle best-effort:
        const model = geofs.aircraft.instance.model;
        if (model.object3d && model.object3d.traverse) {
          model.object3d.traverse(o => {
            if (o.material) {
              if (o.material.emissive) {
                o.material.emissive.setRGB(1, 0, 0);
              }
            }
          });
        }
      }
    } catch (e) { /* ignore */ }
  }

  function clearSquawk() {
    activeSquawk = null;
    overlay.style.display = 'none';
    overlay.classList.remove('gfu-blink');
    document.getElementById('gfu-squawk-status').textContent = 'No active squawk';
  }

  document.getElementById('gfu-set-squawk').addEventListener('click', () => {
    const code = toUpperTrim(document.getElementById('gfu-squawk-input').value);
    if (!/^\d{3,4}$/.test(code)) { document.getElementById('gfu-squawk-status').textContent = 'Enter 3 or 4 digit code'; return; }
    setSquawk(code);
  });

  document.getElementById('gfu-clear-squawk').addEventListener('click', () => { clearSquawk(); });

  panel.querySelectorAll('#tab-squawk button[data-code]').forEach(b => {
    b.addEventListener('click', () => setSquawk(b.dataset.code));
  });

  /* ---------- Calculator (mouse-driven) ---------- */
  const calcDisplay = document.getElementById('calc-display');
  let calcExpr = ''; // expression string

  function showCalc(val) { calcDisplay.textContent = val; }

  function clearCalc() { calcExpr = ''; showCalc('0'); }

  function pushCalc(key) {
    if (key === 'C') { clearCalc(); return; }
    if (key === '=') {
      try {
        // sanitize: allow digits, operators + - * / . and parentheses
        const safe = calcExpr.replace(/[^0-9+\-*/(). ]/g, '');
        const res = Function(`"use strict";return (${safe})`)(); // evaluate
        showCalc(String(res));
        calcExpr = String(res);
      } catch (e) {
        showCalc('Error');
        calcExpr = '';
      }
      return;
    }
    // append number or operator
    calcExpr += key;
    showCalc(calcExpr);
  }

  // special flight helpers
  async function handleFuelBurn() {
    const flowStr = prompt('Fuel flow (kg/hr)?', '800');
    const timeStr = prompt('Time (hours)?', '2');
    const flow = parseFloat(flowStr), time = parseFloat(timeStr);
    if (isNaN(flow) || isNaN(time)) { alert('Invalid numbers'); return; }
    const used = flow * time;
    showCalc(`${used.toFixed(1)} kg`);
    calcExpr = String(used);
  }

  async function handleDescent() {
    // TOD approximate: distance_nm = (alt_ft / (descent_rate_fpm)) * (groundspeed_kt / 60)
    const altStr = prompt('Alt (feet)?', '30000');
    const rateStr = prompt('Descent rate (fpm)?', '1800');
    const gsStr = prompt('Groundspeed (kt)?', '450');
    const alt = parseFloat(altStr), rate = parseFloat(rateStr), gs = parseFloat(gsStr);
    if (isNaN(alt) || isNaN(rate) || isNaN(gs) || rate <= 0) { alert('Invalid numbers'); return; }
    const hours = alt / (rate * 60); // WRONG formula? correct: time (hrs) = alt(ft)/rate(fpm)/60
    const timeHrs = (alt / rate) / 60; // alt (ft) / rate (ft/min) = minutes; /60 => hours
    const nm = timeHrs * gs;
    showCalc(`${nm.toFixed(1)} NM (TOD)`); calcExpr = String(nm.toFixed(1));
  }

  async function handleGlide() {
    // glide distance (NM) = (alt_ft / 6076) * glide_ratio
    const altStr = prompt('Altitude (feet)?', '10000');
    const ratioStr = prompt('Glide ratio (e.g. 15 means 15:1)?', '15');
    const alt = parseFloat(altStr), ratio = parseFloat(ratioStr);
    if (isNaN(alt) || isNaN(ratio) || ratio <= 0) { alert('Invalid numbers'); return; }
    const nm = (alt / 6076) * ratio;
    showCalc(`${nm.toFixed(1)} NM (glide)`); calcExpr = String(nm.toFixed(1));
  }

  document.getElementById('calc-grid').addEventListener('click', (ev) => {
    const keyEl = ev.target.closest('.calc-key');
    if (!keyEl) return;
    const k = keyEl.dataset.key;
    if (!k) return;
    if (k === 'fuel') return handleFuelBurn();
    if (k === 'descent') return handleDescent();
    if (k === 'glide') return handleGlide();
    if (k === 'C') { clearCalc(); return; }
    if (k === '=') { pushCalc('='); return; }
    // numeric or operator
    pushCalc(k);
  });

  clearCalc();

  /* ---------- initial small message ---------- */
  console.log('GeoFS Flight Utility Panel v1.1 loaded (AeroBaden)');

})();
