// ==UserScript==
// @name         GeoFS Flight Utility Panel
// @version      1.8
// @description  GeoFS panel: Flight timer, Fuel (manual), Logbook (TXT), Route Time Calculator. Author: AeroBaden
// @author       AeroBaden
// @match        https://www.geo-fs.com/geofs.php?v=*
// @match        https://*.geo-fs.com/geofs.php*
// @grant        none
// ==/UserScript==

(function(){
'use strict';

if(window.geofsUtilityPanel) return;

// ---------- Panel UI ----------
function createPanel(){
    const panel=document.createElement('div');
    panel.id='geofs-utility-panel';
    panel.classList.add('hidden');
    panel.innerHTML=`
        <style>
            #geofs-utility-panel {position:fixed;bottom:50px;left:10px;width:360px;background:rgba(30,41,59,0.95);color:white;border-radius:12px;padding:10px;font-family:'Segoe UI',sans-serif;box-shadow:0 8px 32px rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.15);z-index:10000;font-size:13px;}
            .tabs{display:flex;margin-bottom:8px;flex-wrap:wrap;}
            .tab-btn{flex:1;background:#334155;border:none;padding:6px;margin:1px;border-radius:6px;cursor:pointer;color:#cbd5e1;font-weight:bold;font-size:12px;}
            .tab-btn.active{background:#3b82f6;color:white;}
            .tab-content{display:none;max-height:320px;overflow:auto;}
            .tab-content.active{display:block;}
            .hidden{display:none!important;}
            .utility-btn{background:#3b82f6;border:none;padding:6px 8px;border-radius:6px;cursor:pointer;color:white;margin:4px 0;font-size:12px;font-weight:bold;}
            .utility-btn:hover{background:#2563eb;}
            .input-box{width:100%;padding:6px;margin:4px 0;border-radius:6px;border:1px solid #475569;background:rgba(51,65,85,0.8);color:white;}
            .log-entry{border-bottom:1px solid #475569;padding:4px 0;}
        </style>

        <div class="tabs">
            <button class="tab-btn active" data-tab="timer">⏱ Timer</button>
            <button class="tab-btn" data-tab="fuel">⛽ Fuel</button>
            <button class="tab-btn" data-tab="logbook">📓 Logbook</button>
            <button class="tab-btn" data-tab="route">🛫 Route</button>
        </div>

        <div id="tab-timer" class="tab-content active">
            <div id="timer-display">00:00:00</div>
            <button class="utility-btn" id="start-timer">Start</button>
            <button class="utility-btn" id="stop-timer">Stop</button>
            <button class="utility-btn" id="reset-timer">Reset</button>
        </div>

        <div id="tab-fuel" class="tab-content">
            <p>Fuel Remaining:</p>
            <input class="input-box" id="fuel-current" placeholder="Enter manually (kg or %)">
            <p>Burn Rate (kg/min):</p>
            <input class="input-box" id="fuel-burn" placeholder="Enter burn rate manually">
            <p>Endurance: <span id="fuel-endurance">-</span> min</p>
        </div>

        <div id="tab-logbook" class="tab-content">
            <textarea id="log-notes" class="input-box" placeholder="Notes..."></textarea>
            <button class="utility-btn" id="save-log">Save Entry</button>
            <button class="utility-btn" id="download-log">Download Logbook</button>
            <div id="log-entries"></div>
        </div>

        <div id="tab-route" class="tab-content">
            <input class="input-box" id="route-departure" placeholder="Departure ICAO">
            <input class="input-box" id="route-destination" placeholder="Destination ICAO">
            <input class="input-box" id="route-speed" placeholder="Cruise speed (knots)">
            <input class="input-box" id="route-altitude" placeholder="Altitude (ft)">
            <button class="utility-btn" id="calculate-route">Calculate Time</button>
            <p>Estimated Duration: <span id="route-duration">-</span> h</p>
        </div>
    `;
    document.body.appendChild(panel);
    return panel;
}

function createToggleButton(){
    const btn=document.createElement('button');
    btn.id='utility-toggle';
    btn.textContent='🕒';
    btn.style=`position:fixed;bottom:10px;left:10px;z-index:10001;background:#1e293b;color:white;border:none;border-radius:50%;width:36px;height:36px;font-size:16px;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.3);`;
    btn.onclick=()=>panel.classList.toggle('hidden');
    document.body.appendChild(btn);
    return btn;
}

class GeoFSUtilityPanel{
    constructor(panel){
        this.panel=panel;
        this.timerInterval=null;
        this.elapsedSeconds=0;
        this.logbook=JSON.parse(localStorage.getItem('geofsLogbook')||'[]');
        this.initTabs();
        this.initTimer();
        this.initFuel();
        this.initLogbook();
        this.initRouteCalculator();
        console.log('GeoFS Flight Utility Panel loaded!');
    }

    initTabs(){
        const tabButtons=this.panel.querySelectorAll('.tab-btn');
        tabButtons.forEach(btn=>{
            btn.addEventListener('click',()=>{
                tabButtons.forEach(b=>b.classList.remove('active'));
                btn.classList.add('active');
                const tabContents=this.panel.querySelectorAll('.tab-content');
                tabContents.forEach(c=>c.classList.remove('active'));
                this.panel.querySelector(`#tab-${btn.dataset.tab}`).classList.add('active');
            });
        });
    }

    initTimer(){
        const display=document.getElementById('timer-display');
        document.getElementById('start-timer').onclick=()=>{
            if(this.timerInterval) return;
            this.timerInterval=setInterval(()=>{
                this.elapsedSeconds++;
                const h=String(Math.floor(this.elapsedSeconds/3600)).padStart(2,'0');
                const m=String(Math.floor((this.elapsedSeconds%3600)/60)).padStart(2,'0');
                const s=String(this.elapsedSeconds%60).padStart(2,'0');
                display.textContent=`${h}:${m}:${s}`;
            },1000);
        };
        document.getElementById('stop-timer').onclick=()=>{clearInterval(this.timerInterval);this.timerInterval=null;};
        document.getElementById('reset-timer').onclick=()=>{this.elapsedSeconds=0;display.textContent='00:00:00';clearInterval(this.timerInterval);this.timerInterval=null;};
    }

    initFuel(){
        const fuelInput=document.getElementById('fuel-current');
        const burnInput=document.getElementById('fuel-burn');
        const enduranceSpan=document.getElementById('fuel-endurance');
        [fuelInput,burnInput].forEach(input=>{
            input.addEventListener('input',()=>{
                const fuel=parseFloat(fuelInput.value);
                const burn=parseFloat(burnInput.value);
                if(fuel>0 && burn>0) enduranceSpan.textContent=Math.round(fuel/burn);
            });
        });
    }

    initLogbook(){
        const notes=document.getElementById('log-notes');
        const saveBtn=document.getElementById('save-log');
        const downloadBtn=document.getElementById('download-log');
        const logEntries=document.getElementById('log-entries');
        const renderLog=()=>{
            logEntries.innerHTML='';
            this.logbook.forEach(entry=>{
                const div=document.createElement('div');
                div.className='log-entry';
                div.textContent=`${entry.date} - ${entry.text}`;
                logEntries.appendChild(div);
            });
        };
        saveBtn.onclick=()=>{
            const text=notes.value.trim();
            if(!text) return;
            this.logbook.push({date:new Date().toLocaleString(),text});
            localStorage.setItem('geofsLogbook',JSON.stringify(this.logbook));
            notes.value='';
            renderLog();
        };
        downloadBtn.onclick=()=>{
            let content='';
            this.logbook.forEach(entry=>content+=`${entry.date} - ${entry.text}\n`);
            const blob=new Blob([content],{type:'text/plain'});
            const url=URL.createObjectURL(blob);
            const a=document.createElement('a');
            a.href=url;a.download='GeoFS_Logbook.txt';a.click();URL.revokeObjectURL(url);
        };
        renderLog();
    }

    initRouteCalculator(){
        const dep=document.getElementById('route-departure');
        const dest=document.getElementById('route-destination');
        const speedInput=document.getElementById('route-speed');
        const altInput=document.getElementById('route-altitude');
        const durationSpan=document.getElementById('route-duration');
        document.getElementById('calculate-route').onclick=()=>{
            const depVal=dep.value.trim().toUpperCase();
            const destVal=dest.value.trim().toUpperCase();
            const speed=parseFloat(speedInput.value);
            if(!depVal||!destVal||isNaN(speed)||speed<=0){durationSpan.textContent='Invalid input';return;}
            // Simplified straight-line distance: approximate
            const lat1=0, lon1=0, lat2=1, lon2=1; // Placeholder: ideally fetch airport coords
            const distanceNm=500; // Placeholder distance
            const duration=distanceNm/speed;
            durationSpan.textContent=duration.toFixed(2);
        };
    }
}

const panel=createPanel();
createToggleButton();
window.geofsUtilityPanel=new GeoFSUtilityPanel(panel);
})();
