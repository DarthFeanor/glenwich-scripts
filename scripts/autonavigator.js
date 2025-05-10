// ==UserScript==
// @name         Glenwich Navigator (Styled)
// @namespace    https://github.com/DarthFeanor/glenwich-scripts
// @version      1.22
// @description  Navigation widget with auto-nav, persistent map data, styled like other Glenwich utilities
// @author       Txdxrxv
// @match        https://glenwich.com/*
// @exclude      https://wiki.glenwich.com/*
// @icon         https://glenwich.com/favicon.png
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';
    const VERSION = '1.22';
    const directionPaths = {
        north: 'm18 15-6-6-6 6',
        south: 'm6 9 6 6 6-6',
        east:  'm9 18 6-6-6-6',
        west:  'm15 18-6-6 6-6'
    };
    let locationData = { current: '', locations: {}, connections: {} };
    let widgetInterval, autoNavInterval;
    let autoNavigating = false;
    let navPath = [];
    let navDestination = '';
    let lastDirection = '';
    let isMinimized = false;
    // Inject CSS for widget
    function injectStyles() {
        const css = `
            #nav-widget { position: fixed; top:10px; right:10px; width:300px; background:#2b140e; border:2px solid #ffb83f; color:#ffb83f; font-family:monospace; font-size:12px; z-index:9999; border-radius:5px; }
            #nav-widget.minimized .content { display:none; }
            #nav-widget .header { display:flex; justify-content:space-between; align-items:center; padding:6px 10px; background:rgba(0,0,0,0.3); border-bottom:1px solid #ffb83f; cursor:move; }
            #nav-widget .header .title { flex-grow:1; text-align:center; font-weight:bold; }
            #nav-widget .header .subtitle { text-align:center; font-size:10px; color:#ffb83f; opacity:0.8; }
            #nav-widget .header .minimize-btn { background:none; border:none; color:#ffb83f; cursor:pointer; font-size:16px; width:24px; height:24px; }
            #nav-widget .content { padding:12px; background:rgba(0,0,0,0.1); }
            #nav-widget .location { text-align:center; padding:10px; background:#4a1810; border-radius:4px; margin-bottom:10px; text-transform:capitalize; }
            #nav-widget .buttons { display:flex; flex-direction:column; align-items:center; gap:6px; margin-bottom:10px; }
            #nav-widget .buttons button { width:40px; height:40px; background:#4a1810; color:#ffb83f; border:1px solid #ffb83f; border-radius:4px; font-size:20px; cursor:pointer; }
            #nav-widget .destinations { border-top:1px solid #ffb83f; padding-top:8px; margin-bottom:10px; }
            #nav-widget select, #nav-widget .go-btn { width:100%; padding:8px; background:#4a1810; color:#ffb83f; border:1px solid #ffb83f; border-radius:4px; font-size:14px; margin-bottom:8px; }
            #nav-widget .go-btn { cursor:pointer; font-weight:bold; }
            #nav-widget .status { display:flex; align-items:center; justify-content:center; font-size:14px; color:#aaa; width:100%; white-space: pre-wrap; word-break: break-word; background: rgba(0,0,0,0.2); padding:16px; border:1px solid #654321; border-radius:4px; }
            #nav-widget .footer { text-align:center; font-size:10px; color:#999; font-style:italic; margin-top:10px; border-top:1px solid #ffb83f; padding-top:8px; }
        `;
        const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
    }
    // Create widget DOM
    function createWidget() {
        injectStyles();
        const w = document.createElement('div'); w.id = 'nav-widget'; w.classList.add('minimized');
        // header
        const h = document.createElement('div'); h.className = 'header';
        const t = document.createElement('span'); t.className = 'title'; t.textContent = `Navigator v${VERSION}`;

        // Add subtitle "powered by Gods"
        const subtitle = document.createElement('div');
        subtitle.className = 'subtitle';
        subtitle.textContent = 'powered by Gods';

        const m = document.createElement('button'); m.className = 'minimize-btn'; m.textContent = '+'; m.title = 'Maximize';
        m.addEventListener('click', toggleMinimize);

        const titleContainer = document.createElement('div');
        titleContainer.style.flexGrow = '1';
        titleContainer.appendChild(t);
        titleContainer.appendChild(subtitle);

        h.append(titleContainer, m); w.append(h);
        // content
        const c = document.createElement('div'); c.className = 'content';
        const loc = document.createElement('div'); loc.id = 'nav-current-location'; loc.className = 'location'; loc.textContent = 'Loading...'; c.append(loc);
        const btns = document.createElement('div'); btns.className = 'buttons';
        btns.innerHTML = `<div><button id="nav-north">▲</button></div><div><button id="nav-west">◀</button><button id="nav-east">▶</button></div><div><button id="nav-south">▼</button></div>`;
        c.append(btns);
        const dest = document.createElement('div'); dest.className = 'destinations';
        dest.innerHTML = `<select id="nav-destination"><option value="" disabled selected>Select destination...</option></select><button id="nav-go" class="go-btn" disabled>Go</button>`;
        c.append(dest);
        const s = document.createElement('div'); s.id = 'nav-status'; s.className = 'status'; s.textContent = 'Idle'; c.append(s);

        // Add footer with attribution
        const footer = document.createElement('div');
        footer.className = 'footer';
        footer.textContent = 'made by the "Gods" guild';
        c.append(footer);

        w.append(c); document.body.appendChild(w);
        // listeners
        ['north','south','east','west'].forEach(d => document.getElementById(`nav-${d}`).addEventListener('click', () => manualNav(d)));
        const sel = document.getElementById('nav-destination'); sel.addEventListener('change', () => document.getElementById('nav-go').disabled = !sel.value);
        document.getElementById('nav-go').addEventListener('click', () => startAutoNav(sel.value));
        makeDraggable(w,h);
    }
    // Toggle minimize
    function toggleMinimize() {
        isMinimized = !isMinimized;
        const w = document.getElementById('nav-widget'); w.classList.toggle('minimized', isMinimized);
        const b = w.querySelector('.minimize-btn'); b.textContent = isMinimized ? '+' : '−'; b.title = isMinimized ? 'Maximize' : 'Minimize';
    }
    // Draggable
    function makeDraggable(el, hd) {
        let dx=0, dy=0, x=0, y=0;
        hd.addEventListener('mousedown', e => { dx = e.clientX - x; dy = e.clientY - y; document.addEventListener('mousemove', drag); document.addEventListener('mouseup', drop); });
        function drag(e) { x = e.clientX - dx; y = e.clientY - dy; el.style.transform = `translate(${x}px,${y}px)`; }
        function drop() { document.removeEventListener('mousemove', drag); document.removeEventListener('mouseup', drop); }
    }
    // Persistence
    function loadData() { try { const s = localStorage.getItem('glenwichNavigator'); if (s) locationData = JSON.parse(s); } catch {} }
    function saveData() { localStorage.setItem('glenwichNavigator', JSON.stringify(locationData)); }
    function initDefault() { const d = getDefault(); locationData = { current: 'glenwich', ...d }; saveData(); }
    function getDefault() { return {
        locations: {"al pisheh":1,"glenwich":1,"plaistow":1,"ashenmere":1,"dunwyke cliffs":1,"dunwyke":1,"fractured abyss":1,"east plaistow":1,"south plaistow":1,"draymoor fields":1,"stonecross":1,"draymoor":1,"qaz hollow":1,"lostmere":1,"riverford":1,"south glenwich":1,"kilcarnen wood":1},
        connections: {"glenwich":{"east":"plaistow","south":"south glenwich"},"plaistow":{"west":"glenwich","east":"east plaistow","south":"south plaistow"},"ashenmere":{"west":"east plaistow","east":"dunwyke","south":"riverford"},"dunwyke cliffs":{"west":"dunwyke"},"dunwyke":{"east":"dunwyke cliffs","south":"fractured abyss","west":"ashenmere"},"fractured abyss":{"north":"dunwyke","west":"riverford"},"east plaistow":{"east":"ashenmere","south":"kilcarnen wood","west":"plaistow"},"south plaistow":{"north":"plaistow","south":"draymoor fields","west":"south glenwich","east":"kilcarnen wood"},"draymoor fields":{"north":"south plaistow","east":"stonecross","west":"draymoor"},"stonecross":{"west":"draymoor fields","north":"kilcarnen wood"},"draymoor":{"north":"south glenwich","east":"draymoor fields","south":"lostmere"},"qaz hollow":{"north":"lostmere","south":"al pisheh"},"al pisheh":{"north":"qaz hollow"},"lostmere":{"north":"draymoor","south":"qaz hollow"},"riverford":{"west":"kilcarnen wood","north":"ashenmere","east":"fractured abyss"},"south glenwich":{"north":"glenwich","east":"south plaistow","south":"draymoor"},"kilcarnen wood":{"north":"east plaistow","south":"stonecross","east":"riverford","west":"south plaistow"}}
    }; }
    // Main loop
    function updateAll() { updateLocation(); updateDirections(); updateDestinations(); updateStatus(); }
    function updateLocation() {
        const sels=['p.capitalize.font-bold','p.capitalize','[class*="text-[#ffb83f]"] p'];
        for (const sel of sels) {
            const el = document.querySelector(sel);
            if (!el) continue;
            const txt = el.textContent.trim();
            if (/roll the dice/i.test(txt)) continue;
            if (!txt || /last played\s.*ago/i.test(txt)) continue;
            if (locationData.current && locationData.current !== txt) recordConnection(locationData.current, txt);
            locationData.current = txt;
            if (!locationData.locations[txt]) { locationData.locations[txt] = 1; saveData(); }
            document.getElementById('nav-current-location').textContent = txt;
            if (autoNavigating && txt === navDestination) stopAuto();
            return;
        }
        document.getElementById('nav-current-location').textContent = 'Unknown';
    }
    function recordConnection(f, t) {
        if (!lastDirection) return;
        const rev = { north:'south', south:'north', east:'west', west:'east' };
        locationData.connections[f] = locationData.connections[f]||{};
        locationData.connections[f][lastDirection] = t;
        locationData.connections[t] = locationData.connections[t]||{};
        locationData.connections[t][rev[lastDirection]] = f;
        lastDirection = '';
        saveData();
    }
    function updateDirections() {
        const gameBtns = Array.from(document.querySelectorAll('button')).filter(b=>b.querySelector('svg path'));
        for (const dir in directionPaths) {
            const btn = document.getElementById(`nav-${dir}`);
            const ok = gameBtns.some(g => g.querySelector('svg path').getAttribute('d') === directionPaths[dir]);
            btn.disabled = !ok;
            btn.style.opacity = ok ? '1' : '0.4';
        }
    }
    function updateDestinations() {
        const sel = document.getElementById('nav-destination'), prev = sel.value;
        sel.innerHTML = '';
        const ph = new Option('Select destination...',''); ph.disabled = true; ph.selected = true; sel.add(ph);
        Object.keys(locationData.locations).filter(l=>l && l !== locationData.current).sort().forEach(l => sel.add(new Option(l, l)));
        if ([...sel.options].some(o => o.value === prev)) sel.value = prev;
        document.getElementById('nav-go').disabled = !sel.value;
    }
    function manualNav(dir) {
        lastDirection = dir;
        const gameBtns = Array.from(document.querySelectorAll('button')).filter(b=>b.querySelector('svg path'));
        const btn = gameBtns.find(g => g.querySelector('svg path').getAttribute('d') === directionPaths[dir]);
        if (btn) btn.click();
    }
    function findPath(start, end) {
        if (start === end) return [];
        const q = [{loc: start, path: []}];
        const seen = {[start]: true};
        while (q.length) {
            const {loc, path} = q.shift();
            const conns = locationData.connections[loc] || {};
            for (const d in conns) {
                const nxt = conns[d];
                if (seen[nxt]) continue;
                const np = path.concat({direction: d, location: nxt});
                if (nxt === end) return np;
                seen[nxt] = true;
                q.push({loc: nxt, path: np});
            }
        }
        return null;
    }
    function startAutoNav(dest) {
        if (!locationData.current || !dest || locationData.current === dest) return;
        navDestination = dest;
        navPath = findPath(locationData.current, dest) || [];
        autoNavigating = true;
        clearInterval(autoNavInterval);
        autoNavInterval = setInterval(stepAuto, 1500);
    }
    function stepAuto() {
        if (!autoNavigating) return;
        if (!navPath.length) { stopAuto(); return; }
        const next = navPath[0];
        if (locationData.current !== next.location) manualNav(next.direction);
        else navPath.shift();
    }
    function stopAuto() {
        autoNavigating = false;
        clearInterval(autoNavInterval);
    }
    function updateStatus() {
        const s = document.getElementById('nav-status');
        if (autoNavigating) {
            s.textContent = `To ${navDestination} — Steps left: ${navPath.length.toLocaleString()}`;
            s.style.color = '#7fff7f';
        } else {
            s.textContent = 'Idle';
            s.style.color = '#aaa';
        }
    }
    function init() {
        createWidget();
        loadData();
        if (!Object.keys(locationData.locations).length) initDefault();
        updateAll();
        widgetInterval = setInterval(updateAll, 1000);
        document.addEventListener('keydown', e => {
            if (e.altKey && e.key.toLowerCase() === 'n') {
                const w = document.getElementById('nav-widget');
                w.style.display = w.style.display === 'none' ? 'block' : 'none';
            }
        });
    }
    function updateAll() { updateLocation(); updateDirections(); updateDestinations(); updateStatus(); }
    if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', init);
    else init();
})();
