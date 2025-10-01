// ==UserScript==
// @name         GeoFS Flight Utility Panel
// @version      1.0
// @description  Flight Utility Panel: Timer, Fuel, Logbook, Route Calculator, Emergency Squawk Codes
// @author       AeroBaden
// @match        https://www.geo-fs.com/geofs.php?v=*
// @match        https://*.geo-fs.com/geofs.php*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    if(window.geofsUtilityPanel) return;

    // ================= Styles =================
    const style = document.createElement("style");
    style.textContent = `
    #geofs-utility-btn { position: fixed; bottom: 15px; left: 15px; background: rgba(30,41,59,0.8); color: white; border: none; border-radius: 50%; width: 50px; height: 50px; font-size: 20px; cursor: pointer; z-index: 10001; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 12px rgba(0,0,0,0.5);}
    #geofs-utility-panel { position: fixed; top: 60px; right: 20px; width: 360px; max-height: 80vh; background: rgba(30,41,59,0.95); color: white; border-radius: 12px; padding: 16px; font-family: 'Segoe UI', sans-serif; box-shadow: 0 8px 32px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1); z-index: 10000; display: none; flex-direction: column; overflow-y: auto;}
    .tab-buttons { display: flex; margin-bottom: 10px; }
    .tab-buttons button { flex: 1; padding: 6px; background: #374151; border: none; color: white; cursor: pointer; border-radius: 6px 6px 0 0;}
    .tab-buttons button.active { background: #3b82f6;}
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    .input-box { width: 100%; padding: 6px; margin-bottom: 8px; background: #1f2937; border: 1px solid #4b5563; border-radius: 6px; color: white; }
    .utility-btn { width: 100%; background: #3b82f6; border: none; padding: 8px; border-radius: 6px; color: white; cursor: pointer; margin-bottom: 6px; }
    .utility-btn:hover { background: #2563eb; }
    #squawk-indicator { position: fixed; top: 10px; left: 50%; transform: translateX(-50%); font-size: 22px; font-weight: bold; color: red; text-shadow: 0 0 8px red; display: none; z-index: 10002; }
    @keyframes blink { 0%,50%,100%{opacity:1;} 25%,75%{opacity:0.2;} }
    .blink { animation: blink 1s infinite; }
    `;
    document.head.appendChild(style);

    // ================= UI =================
    const button = document.createElement("button");
    button.id = "geofs-utility-btn";
    button.textContent = "⏱";
    document.body.appendChild(button);

    const panel = document.createElement("div");
    panel.id = "geofs-utility-panel";
    panel.innerHTML = `
      <div class="tab-buttons">
        <button data-tab="tab-timer" class="active">Timer</button>
        <button data-tab="tab-fuel">Fuel</button>
        <button data-tab="tab-log">Logbook</button>
        <button data-tab="tab-route">Route</button>
        <button data-tab="tab-squawk">Squawk</button>
      </div>

      <div id="tab-timer" class="tab-content active">
        <button class="utility-btn" id="startTimer">Start/Resume</button>
        <button class="utility-btn" id="pauseTimer">Pause</button>
        <button class="utility-btn" id="resetTimer">Reset</button>
        <div id="timerDisplay">00:00:00</div>
      </div>

      <div id="tab-fuel" class="tab-content">
        <input id="fuelFlow" class="input-box" type="number" placeholder="Fuel Flow (kg/hr)">
        <input id="fuelTime" class="input-box" type="number" placeholder="Flight Time (hrs)">
        <button class="utility-btn" id="calcFuel">Calculate Fuel</button>
        <div id="fuelResult"></div>
      </div>

      <div id="tab-log" class="tab-content">
        <textarea id="logNotes" class="input-box" style="height:120px;" placeholder="Write your log notes here..."></textarea>
        <button class="utility-btn" id="saveLog">Save Log Entry</button>
        <button class="utility-btn" id="downloadLog">Download Logbook</button>
        <div id="logEntries"></div>
      </div>

      <div id="tab-route" class="tab-content">
        <input id="depCode" class="input-box" type="text" placeholder="Departure ICAO/IATA">
        <input id="arrCode" class="input-box" type="text" placeholder="Destination ICAO/IATA">
        <select id="aircraftSelect" class="input-box">
          <option value="">-- Select Aircraft --</option>
          <option value="PIPER">Piper Cub (75 kt)</option>
          <option value="C172">Cessna 172 (120 kt)</option>
          <option value="ALPHAJET">Alphajet PAF (420 kt)</option>
          <option value="B737">Boeing 737-700 (450 kt)</option>
          <option value="PHENOM100">Embraer Phenom 100 (390 kt)</option>
          <option value="TWINOTTER">Twin Otter (180 kt)</option>
          <option value="F16">F-16 Fighting Falcon (550 kt)</option>
          <option value="PITTS">Pitts S1 Special (180 kt)</option>
          <option value="A380">Airbus A380 (490 kt)</option>
          <option value="DC3">Douglas DC-3 (180 kt)</option>
          <option value="SU35">Sukhoi Su-35 (650 kt)</option>
          <option value="CONC">Concorde (1150 kt)</option>
          <option value="C152">Cessna 152 (110 kt)</option>
          <option value="A350">Airbus A350-900 (480 kt)</option>
          <option value="B77W">Boeing 777-300ER (480 kt)</option>
          <option value="PC7">Pilatus PC-7 Mk1 (230 kt)</option>
          <option value="DHC2">DHC-2 Beaver (140 kt)</option>
          <option value="AN140">Antonov An-140 (270 kt)</option>
          <option value="F18">F/A-18 Super Hornet (570 kt)</option>
          <option value="B55">Beechcraft Baron B55 (190 kt)</option>
          <option value="RAFALE">Dassault Rafale (600 kt)</option>
        </select>
        <button class="utility-btn" id="calcRoute">Calculate Route</button>
        <div id="routeResult"></div>
      </div>

      <div id="tab-squawk" class="tab-content">
        <input id="squawkCode" class="input-box" type="text" placeholder="Enter Squawk Code">
        <button class="utility-btn" id="setSquawk">Set Squawk</button>
        <button class="utility-btn" id="clearSquawk">Clear Squawk</button>
        <div>
          <button class="utility-btn" data-code="7500">7500 - Hijack</button>
          <button class="utility-btn" data-code="7600">7600 - Radio Failure</button>
          <button class="utility-btn" data-code="7700">7700 - Emergency</button>
        </div>
      </div>
    `;
    document.body.appendChild(panel);

    const squawkIndicator = document.createElement("div");
    squawkIndicator.id="squawk-indicator";
    document.body.appendChild(squawkIndicator);

    // ================= Logic =================

    // Toggle panel
    button.onclick=()=> panel.style.display = (panel.style.display==="flex"?"none":"flex");

    // Tabs
    panel.querySelectorAll(".tab-buttons button").forEach(btn=>{
        btn.onclick=()=>{
            panel.querySelectorAll(".tab-buttons button").forEach(b=>b.classList.remove("active"));
            panel.querySelectorAll(".tab-content").forEach(tc=>tc.classList.remove("active"));
            btn.classList.add("active");
            panel.querySelector("#"+btn.dataset.tab).classList.add("active");
        };
    });

    // Timer
    let timerInterval, startTime, elapsedTime=0;
    const timerDisplay = document.getElementById("timerDisplay");

    document.getElementById("startTimer").onclick = ()=>{
        if(!timerInterval){
            startTime = Date.now()-elapsedTime;
            timerInterval=setInterval(updateTimer,1000);
        }
    };
    document.getElementById("pauseTimer").onclick = ()=>{
        if(timerInterval){ clearInterval(timerInterval); timerInterval=null;}
    };
    document.getElementById("resetTimer").onclick = ()=>{
        clearInterval(timerInterval); timerInterval=null; elapsedTime=0;
        timerDisplay.textContent="00:00:00";
    };
    function updateTimer(){
        elapsedTime = Date.now()-startTime;
        const hrs=Math.floor(elapsedTime/3600000);
        const mins=Math.floor((elapsedTime%3600000)/60000);
        const secs=Math.floor((elapsedTime%60000)/1000);
        timerDisplay.textContent=[hrs,mins,secs].map(v=>String(v).padStart(2,"0")).join(":");
    }

    // Fuel
    document.getElementById("calcFuel").onclick=()=>{
        const flow=parseFloat(document.getElementById("fuelFlow").value);
        const time=parseFloat(document.getElementById("fuelTime").value);
        if(isNaN(flow)||isNaN(time)){document.getElementById("fuelResult").textContent="Invalid input"; return;}
        document.getElementById("fuelResult").textContent=`Fuel Required: ${(flow*time).toFixed(1)} kg`;
    };

    // Logbook
    const logKey="geofsLogbook";
    let logEntries=JSON.parse(localStorage.getItem(logKey)||"[]");
    const logEntriesDiv=document.getElementById("logEntries");

    function renderLog(){
        logEntriesDiv.innerHTML="";
        logEntries.forEach((entry,i)=>{
            const div=document.createElement("div");
            div.textContent=`${i+1}. ${entry}`;
            logEntriesDiv.appendChild(div);
        });
    }
    renderLog();

    document.getElementById("saveLog").onclick=()=>{
        const val=document.getElementById("logNotes").value.trim();
        if(!val) return;
        logEntries.push(val);
        localStorage.setItem(logKey,JSON.stringify(logEntries));
        document.getElementById("logNotes").value="";
        renderLog();
    };

    document.getElementById("downloadLog").onclick=()=>{
        const blob=new Blob([logEntries.join("\n")],{type:"text/plain"});
        const url=URL.createObjectURL(blob);
        const a=document.createElement("a");
        a.href=url; a.download="GeoFS_Logbook.txt"; a.click();
        URL.revokeObjectURL(url);
    };

    // Route Calculator
    const aircraftSpeeds={
        "PIPER":75,"C172":120,"ALPHAJET":420,"B737":450,"PHENOM100":390,"TWINOTTER":180,"F16":550,"PITTS":180,
        "A380":490,"DC3":180,"SU35":650,"CONC":1150,"C152":110,"A350":480,"B77W":480,"PC7":230,"DHC2":140,"AN140":270,"F18":570,"B55":190,"RAFALE":600
    };
    const airports={
        "KLAX":{lat:33.9416,lon:-118.4085},"LAX":{lat:33.9416,lon:-118.4085},
        "KJFK":{lat:40.641,lon:-73.778},"JFK":{lat:40.641,lon:-73.778},
        "EGLL":{lat:51.4775,lon:-0.4614},"LHR":{lat:51.4775,lon:-0.4614},
        "EDDF":{lat:50.033,lon:8.570},"FRA":{lat:50.033,lon:8.570},
        "EHAM":{lat:52.308,lon:4.764},"AMS":{lat:52.308,lon:4.764},
        "OMDB":{lat:25.253,lon:55.365},"DXB":{lat:25.253,lon:55.365}
    };

    document.getElementById("calcRoute").onclick=()=>{
        const dep=document.getElementById("depCode").value.trim().toUpperCase();
        const arr=document.getElementById("arrCode").value.trim().toUpperCase();
        const ac=document.getElementById("aircraftSelect").value;
        const resultDiv=document.getElementById("routeResult");
        if(!airports[dep]||!airports[arr]||!ac){ resultDiv.textContent="Invalid input or aircraft not selected"; return;}
        const toRad=d=>d*Math.PI/180;
        const R=6371;
        const dLat=toRad(airports[arr].lat-airports[dep].lat);
        const dLon=toRad(airports[arr].lon-airports[dep].lon);
        const a=Math.sin(dLat/2)**2+Math.cos(toRad(airports[dep].lat))*Math.cos(toRad(airports[arr].lat))*Math.sin(dLon/2)**2;
        const km=R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
        const nm=km/1.852;
        const hrs=nm/aircraftSpeeds[ac];
        const h=Math.floor(hrs); const m=Math.floor((hrs-h)*60);
        resultDiv.textContent=`Route: ${dep} → ${arr}\nDistance: ${nm.toFixed(1)} NM (${km.toFixed(1)} km)\nAircraft: ${ac}\nETA: ~${h}h ${m}m`;
    };

    // Squawk
    let activeSquawk=null;
    function updateSquawkUI(){
        if(activeSquawk){ squawkIndicator.textContent=activeSquawk; squawkIndicator.style.display="block"; squawkIndicator.classList.add("blink"); }
        else { squawkIndicator.style.display="none"; squawkIndicator.classList.remove("blink"); }
    }

    document.getElementById("setSquawk").onclick=()=>{
        const code=document.getElementById("squawkCode").value.trim();
        if(!code) return;
        activeSquawk=code;
        updateSquawkUI();
    };
    document.getElementById("clearSquawk").onclick=()=>{
        activeSquawk=null;
        updateSquawkUI();
    };
    panel.querySelectorAll("#tab-squawk .utility-btn[data-code]").forEach(btn=>{
        btn.onclick=()=>{
            activeSquawk=btn.dataset.code;
            updateSquawkUI();
        };
    });

    window.geofsUtilityPanel=true;
})();
