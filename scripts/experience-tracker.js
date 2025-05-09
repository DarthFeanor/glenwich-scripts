// ==UserScript==
// @name         Glenwich Experience Tracker (Enhanced)
// @namespace    https://github.com/DarthFeanor/glenwich-scripts
// @version      1.5
// @description  Tracks XP gain rates and estimates time until next level, with hourly avg and remaining XP (thousands separated)
// @author       Txdxrxv
// @match        https://*.glenwich.com/*
// @match        https://glenwich.com/*
// @icon         https://glenwich.com/favicon.png
// @grant        none
// @run-at       document-idle
// ==/UserScript==
(function() {
    'use strict';

    const UPDATE_INTERVAL = 10000;    // refresh every 10s
    const RUN_WINDOW = 5 * 60 * 1000;  // 5-min running avg
    const VERSION = '1.5';

    let skillData = {};
    let panel, displayElement, tooltipObserver;
    let isMinimized = false;

    function injectStyles() {
        const css = `
            #exp-tracker-panel { position: fixed; top:10px; right:10px; width:220px; background:#2b140e; border:2px solid #ffb83f; color:#ffb83f; font-family:monospace; font-size:12px; z-index:9999; border-radius:5px; }
            #exp-tracker-panel .header { display:flex; justify-content:space-between; align-items:center; font-size:14px; border-bottom:1px solid #ffb83f; padding:5px 8px; cursor:move; }
            #exp-tracker-panel .header .title { flex-grow:1; text-align:center; font-weight:bold; }
            #exp-tracker-panel .header .subtitle { text-align:center; font-size:10px; color:#ffb83f; opacity:0.8; margin-top:2px; }
            #exp-tracker-panel .header .minimize-btn { background:none; border:none; color:#ffb83f; cursor:pointer; font-size:16px; width:24px; height:24px; padding:0; }
            #exp-tracker-panel .content { padding:5px 8px; max-height:70vh; overflow-y:auto; }
            #exp-tracker-panel.minimized .content, #exp-tracker-panel.minimized .footer, #exp-tracker-panel.minimized .attribution { display:none; }
            .skill-section { margin-bottom:8px; padding-bottom:6px; border-bottom:1px dashed #654321; }
            .skill-title { display:flex; justify-content:space-between; color:#ffffff; font-weight:bold; margin-bottom:4px; }
            .skill-stats .row { display:flex; justify-content:space-between; font-size:11px; margin-bottom:2px; }
            #exp-tracker-panel .attribution { text-align:center; font-size:10px; color:#999; font-style:italic; padding:5px 8px; border-top:1px solid #654321; }
            #exp-tracker-panel .footer { display:flex; gap:5px; padding:5px 8px; border-top:1px solid #ffb83f; background:#2a2a2a; }
            #exp-tracker-panel .btn { flex:1; background:#2a2a2a; border:1px solid #ffb83f; color:#ffb83f; padding:4px; cursor:pointer; border-radius:3px; font-size:12px; }
            #exp-tracker-panel .btn:hover { background:#3a3a3a; }
            .no-data { text-align:center; color:#ff6b6b; padding:10px; font-style:italic; }
        `;
        const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
    }

    function createPanel() {
        panel = document.createElement('div'); panel.id='exp-tracker-panel';
        const hdr = document.createElement('div'); hdr.className='header';

        // Title container with main title and subtitle
        const titleContainer = document.createElement('div');
        titleContainer.className = 'title';

        // Main title
        const title = document.createElement('div');
        title.textContent = `XP Tracker v${VERSION}`;

        // Subtitle - powered by Gods
        const subtitle = document.createElement('div');
        subtitle.className = 'subtitle';
        subtitle.textContent = 'powered by Gods';

        titleContainer.append(title, subtitle);

        const btn = document.createElement('button'); btn.className='minimize-btn'; btn.textContent='−'; btn.title='Minimize'; btn.addEventListener('click', toggleMinimize);
        hdr.append(titleContainer, btn); panel.append(hdr);
        const content = document.createElement('div'); content.className='content'; content.id='exp-tracker-content'; panel.append(content);

        // Add attribution footer
        const attribution = document.createElement('div');
        attribution.className = 'attribution';
        attribution.textContent = 'made by the "Gods" guild';
        panel.append(attribution);

        const footer = document.createElement('div'); footer.className='footer';
        const refresh = document.createElement('button'); refresh.className='btn'; refresh.textContent='Refresh'; refresh.addEventListener('click', () => { updateExpData(); updateDisplay(); });
        const close = document.createElement('button'); close.className='btn'; close.textContent='Close'; close.addEventListener('click', () => panel.style.display='none');
        footer.append(refresh, close); panel.append(footer);
        makeDraggable(panel, hdr); document.body.append(panel);
    }

    function toggleMinimize() {
        isMinimized = !isMinimized;
        panel.classList.toggle('minimized', isMinimized);
        const btn = panel.querySelector('.minimize-btn');
        btn.textContent = isMinimized ? '+' : '−';
        btn.title = isMinimized ? 'Maximize' : 'Minimize';
    }

    function makeDraggable(el, handle) {
        let x=0,y=0,dx=0,dy=0;
        handle.addEventListener('mousedown', e => {
            dx = e.clientX - x; dy = e.clientY - y;
            document.addEventListener('mousemove', drag);
            document.addEventListener('mouseup', up);
        });
        function drag(e) { x = e.clientX - dx; y = e.clientY - dy; el.style.transform = `translate(${x}px,${y}px)`; }
        function up() { document.removeEventListener('mousemove', drag); document.removeEventListener('mouseup', up); }
    }

    function parseExpData(el) {
        const text = el?.textContent;
        if (!text || !text.includes('Total Experience')) return null;
        const t = text.match(/([0-9,]+)\s+Total Experience/);
        const l = text.match(/([0-9,]+)\s+to Level Up/);
        if (!t || !l) return null;
        return { totalExp: parseInt(t[1].replace(/,/g,''),10), expToLevel: parseInt(l[1].replace(/,/g,''),10) };
    }
    function getSkillName(r) { return r.querySelector('.flex.flex-row.items-center.capitalize')?.textContent.trim()||'Unknown'; }
    function getSkillLevel(r) { return r.querySelector('.font-mono')?.textContent.trim()||'0/0'; }
    function calculateRunningAverage(hist) {
        const now = Date.now(), cut = now - RUN_WINDOW;
        const recent = hist.filter(p => p.timestamp >= cut);
        if (recent.length < 2) return 0;
        recent.sort((a,b) => a.timestamp - b.timestamp);
        const de = recent.at(-1).exp - recent[0].exp;
        const dm = (recent.at(-1).timestamp - recent[0].timestamp) / 60000;
        return dm > 0 ? de/dm : 0;
    }

    function scanInitialData() {
        document.querySelectorAll('.tooltip').forEach(tt => {
            const row = tt.querySelector('.cursor-pointer'); if (!row) return;
            const name = getSkillName(tt), lvl = getSkillLevel(tt);
            const content = tt.querySelector('.tooltip-content'), data = parseExpData(content);
            if (!data) return;
            skillData[name] = {
                name, level: lvl,
                initialExp: data.totalExp, expToLevel: data.expToLevel,
                latestExp: data.totalExp, initialTimestamp: Date.now(), latestTimestamp: Date.now(),
                expGainRate: 0, runningAvg: 0, timeToLevel: '?', isActive: false,
                expHistory: [{ timestamp: Date.now(), exp: data.totalExp }]
            };
        });
        return Object.keys(skillData).length > 0;
    }

    function updateExpData() {
        document.querySelectorAll('.tooltip').forEach(tt => {
            const row = tt.querySelector('.cursor-pointer'); if (!row) return;
            const name = getSkillName(tt), sk = skillData[name]; if (!sk) return;
            const content = tt.querySelector('.tooltip-content'), data = parseExpData(content); if (!data) return;
            const now = Date.now();
            if (data.totalExp !== sk.latestExp) {
                const dm = (now - sk.latestTimestamp)/60000, de = data.totalExp - sk.latestExp;
                sk.expHistory.push({ timestamp: now, exp: data.totalExp });
                sk.expHistory = sk.expHistory.filter(p => p.timestamp >= now - RUN_WINDOW*1.5);
                if (dm > 0.05) {
                    sk.expGainRate = de/dm;
                    sk.runningAvg = calculateRunningAverage(sk.expHistory);
                    sk.isActive = true;
                }
                sk.latestExp = data.totalExp;
                sk.latestTimestamp = now;
                sk.expToLevel = data.expToLevel;
                if (sk.runningAvg > 0) {
                    const mins = sk.expToLevel / sk.runningAvg;
                    sk.timeToLevel = mins < 60 ? `${Math.ceil(mins).toLocaleString()}m`
                        : mins < 1440 ? `${Math.ceil(mins/60).toLocaleString()}h`
                        : `${Math.ceil(mins/1440).toLocaleString()}d`;
                } else sk.timeToLevel = '∞';
            } else if ((Date.now() - sk.latestTimestamp)/60000 > 5) sk.isActive = false;
        });
    }

    function updateDisplay() {
        displayElement.innerHTML = '';
        const skills = Object.values(skillData).sort((a,b) => b.isActive - a.isActive || a.name.localeCompare(b.name));
        if (!skills.length) {
            displayElement.innerHTML = `<div class=\"no-data\">Hover over skills to start.</div>`;
            return;
        }
        skills.forEach(s => {
            if (!s.isActive) return;
            const sec = document.createElement('div'); sec.className = 'skill-section';
            const hdr = document.createElement('div'); hdr.className = 'skill-title';
            hdr.innerHTML = `<span>${s.name} ${s.level}</span><span>+${(s.latestExp - s.initialExp).toLocaleString()}xp</span>`;
            sec.append(hdr);
            const stats = document.createElement('div'); stats.className = 'skill-stats';
            [
                ['Now', `${Math.round(s.expGainRate).toLocaleString()}/m`],
                ['Avg5', `${Math.round(s.runningAvg).toLocaleString()}/m`],
                ['HrAvg', `${Math.round(s.runningAvg * 60).toLocaleString()}/h`],
                ['Remaining', `${s.expToLevel.toLocaleString()}xp`],
                ['ToLvl', s.timeToLevel]
            ].forEach(([lbl, val]) => {
                const row = document.createElement('div'); row.className = 'row';
                row.innerHTML = `<span>${lbl}</span><span>${val}</span>`;
                stats.append(row);
            });
            sec.append(stats);
            displayElement.append(sec);
        });
    }

    function setupObserver() {
        if (tooltipObserver) tooltipObserver.disconnect();
        tooltipObserver = new MutationObserver(() => { updateExpData(); updateDisplay(); });
        document.querySelectorAll('.tooltip').forEach(tt => tooltipObserver.observe(tt, { attributes: true }));
    }

    function init() {
        injectStyles(); createPanel();
        displayElement = document.getElementById('exp-tracker-content');
        if (!scanInitialData()) {
            displayElement.innerHTML = `<div class=\"no-data\">Hover over skills to start.</div>`;
        }
        setupObserver(); updateDisplay();
        setInterval(() => { updateExpData(); updateDisplay(); }, UPDATE_INTERVAL);
        new MutationObserver(() => {
            if (document.querySelectorAll('.tooltip').length) setupObserver();
        }).observe(document.body, { childList: true, subtree: true });
        document.addEventListener('keydown', e => {
            if (e.altKey && e.key.toLowerCase() === 'x') {
                panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
            }
        });
        console.log('[XP Tracker] v' + VERSION + ' initialized');
    }

    const ready = setInterval(() => {
        if (document.querySelector('.tooltip')) {
            clearInterval(ready);
            init();
        }
    }, 500);
})();
