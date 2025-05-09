// ==UserScript==
// @name         Glenwich Auto Re-enter Dungeon (Styled)
// @namespace    https://github.com/DarthFeanor/glenwich-scripts
// @version      1.6
// @description  Auto re-enters dungeon after death, with styled UI and detailed stats
// @author       Txdxrxv
// @match        https://*.glenwich.com/*
// @match        https://glenwich.com/*
// @icon         https://glenwich.com/favicon.png
// @grant        none
// @run-at       document-idle
// ==/UserScript==
(function() {
    'use strict';

    const SCAN_INTERVAL_MS = 1000;
    const VERSION = '1.6';
    let isEnabled = false, intervalId = null;
    let panel, toggleBtn;
    let reentryCount = 0;
    let lastActionTime = '-';

    function injectStyles() {
        const css = `
            #auto-reenter-panel { position: fixed; top:10px; right:10px; width:220px; background:#2b140e; border:2px solid #ffb83f; color:#ffb83f; font-family:monospace; font-size:12px; z-index:9999; border-radius:5px; }
            #auto-reenter-panel .header { display:flex; justify-content:space-between; align-items:center; padding:5px 8px; background:rgba(0,0,0,0.3); border-bottom:1px solid #ffb83f; cursor:move; }
            #auto-reenter-panel .header .title-container { flex-grow:1; text-align:center; }
            #auto-reenter-panel .header .title { font-weight:bold; }
            #auto-reenter-panel .header .subtitle { font-size:10px; color:#ffb83f; opacity:0.8; margin-top:2px; }
            #auto-reenter-panel .header .sensor { width:10px; height:10px; border-radius:50%; background:#f77; margin-right:6px; border:1px solid #333; }
            #auto-reenter-panel .header .minimize-btn { background:none; border:none; color:#ffb83f; cursor:pointer; font-size:16px; width:24px; height:24px; }
            #auto-reenter-panel .content { padding:5px 8px; max-height:70vh; overflow-y:auto; }
            #auto-reenter-panel.minimized .content, #auto-reenter-panel.minimized .footer, #auto-reenter-panel.minimized .attribution { display:none; }
            .stat-row { display:flex; justify-content:space-between; margin-bottom:4px; }
            #auto-reenter-panel .attribution { text-align:center; font-size:10px; color:#999; font-style:italic; padding:5px 8px; border-top:1px solid #654321; }
            #auto-reenter-panel .footer { display:flex; gap:5px; padding:5px 8px; border-top:1px solid #ffb83f; background:#2a2a2a; }
            #auto-reenter-panel .btn { flex:1; background:#2a2a2a; border:1px solid #ffb83f; color:#ffb83f; padding:4px; border-radius:3px; cursor:pointer; font-size:12px; }
            #auto-reenter-panel .btn:hover { background:#3a3a3a; }
        `;
        const style = document.createElement('style'); style.textContent = css;
        document.head.appendChild(style);
    }

    function createPanel() {
        panel = document.createElement('div'); panel.id = 'auto-reenter-panel';
        const header = document.createElement('div'); header.className = 'header';
        const sensor = document.createElement('div'); sensor.className = 'sensor'; sensor.id = 'reenter-sensor';

        // Create title container with main title and subtitle
        const titleContainer = document.createElement('div');
        titleContainer.className = 'title-container';

        // Main title
        const title = document.createElement('div');
        title.className = 'title';
        title.textContent = `Auto Re-enter v${VERSION}`;

        // Subtitle - powered by Gods
        const subtitle = document.createElement('div');
        subtitle.className = 'subtitle';
        subtitle.textContent = 'powered by Gods';

        titleContainer.append(title, subtitle);

        const minimize = document.createElement('button'); minimize.className = 'minimize-btn'; minimize.textContent = '−'; minimize.title = 'Minimize';
        minimize.addEventListener('click', toggleMinimize);
        header.append(sensor, titleContainer, minimize);
        panel.append(header);

        const content = document.createElement('div'); content.className = 'content';
        // stats
        ['Status', 'Re-entries', 'Last Action', 'Interval'].forEach(label => {
            const row = document.createElement('div'); row.className = 'stat-row';
            const lbl = document.createElement('span'); lbl.textContent = label;
            const val = document.createElement('span'); val.id = 'reenter-' + label.toLowerCase().replace(/ /g, '-');
            val.textContent = label === 'Status' ? 'Inactive' : label === 'Interval' ? `${SCAN_INTERVAL_MS/1000}s` : '-';
            row.append(lbl, val);
            content.append(row);
        });
        panel.append(content);

        // Add attribution footer
        const attribution = document.createElement('div');
        attribution.className = 'attribution';
        attribution.textContent = 'made by the "Gods" guild';
        panel.append(attribution);

        const footer = document.createElement('div'); footer.className = 'footer';
        const toggle = document.createElement('button'); toggle.className = 'btn'; toggle.id = 'reenter-toggle'; toggle.textContent = 'Enable';
        toggle.addEventListener('click', () => isEnabled ? stop() : start());
        const close = document.createElement('button'); close.className = 'btn'; close.textContent = 'Close';
        close.addEventListener('click', () => panel.style.display = 'none');
        footer.append(toggle, close);
        panel.append(footer);

        makeDraggable(panel, header);
        document.body.append(panel);
        toggleBtn = toggle;
    }

    function toggleMinimize() {
        const minimized = panel.classList.toggle('minimized');
        const btn = panel.querySelector('.minimize-btn'); btn.textContent = minimized ? '+' : '−'; btn.title = minimized ? 'Maximize' : 'Minimize';
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

    function updateStats() {
        document.getElementById('reenter-status').textContent = isEnabled ? 'Active' : 'Inactive';
        document.getElementById('reenter-re-entries').textContent = reentryCount.toLocaleString();
        document.getElementById('reenter-last-action').textContent = lastActionTime;
        document.getElementById('reenter-interval').textContent = `${(SCAN_INTERVAL_MS/1000).toLocaleString()}s`;
        document.getElementById('reenter-sensor').style.background = isEnabled ? '#7f7' : '#f77';
        toggleBtn.textContent = isEnabled ? 'Disable' : 'Enable';
    }

    function checkDialog() {
        if (!isEnabled) return;
        const hdr = Array.from(document.querySelectorAll('h3.text-xl.font-bold.text-center'))
            .find(h => h.textContent === 'Are you sure?');
        if (!hdr) return;
        const btn = Array.from(hdr.closest('.flex.flex-col.w-full.border-2').querySelectorAll('button'))
            .find(b => b.textContent.trim() === 'Enter');
        if (!btn) return;
        btn.click(); reentryCount++; lastActionTime = new Date().toLocaleTimeString(); updateStats();
    }

    function start() {
        isEnabled = true; clearInterval(intervalId);
        intervalId = setInterval(checkDialog, SCAN_INTERVAL_MS);
        updateStats();
    }

    function stop() {
        isEnabled = false; clearInterval(intervalId);
        updateStats();
    }

    // init on load
    const ready = setInterval(() => {
        if (document.querySelector('.tooltip')) {
            clearInterval(ready);
            injectStyles(); createPanel(); updateStats();
            document.addEventListener('keydown', e => {
                if (e.altKey && e.key.toLowerCase() === 'd')
                    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
            });
        }
    }, 500);
})();
