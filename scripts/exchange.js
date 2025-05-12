// ==UserScript==
// @name         Glenwich Exchange Controller (Enhanced)
// @namespace    https://github.com/DarthFeanor/glenwich-scripts
// @version      9.2
// @description  Enhanced exchange controller with live tracking & optimal path for Glenwich
// @author       Txdxrxv
// @match        https://glenwich.com/*
// @exclude      https://wiki.glenwich.com/*
// @icon         https://glenwich.com/favicon.png
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    const VERSION = '9.2';
    let panel, isProcessing = false, shouldCancel = false;

    // Inject UI styles
    function injectStyles() {
        const css = `
            #exchange-control-panel { position: fixed; top:10px; right:10px; width:240px; background:#2b140e; border:2px solid #ffb83f; color:#ffb83f; font-family:monospace; font-size:12px; z-index:9999; border-radius:5px; }
            #exchange-control-panel .header { display:flex; justify-content:space-between; align-items:center; padding:5px 8px; background:rgba(0,0,0,0.3); border-bottom:1px solid #ffb83f; cursor:move; }
            #exchange-control-panel .header .title-container { flex-grow:1; text-align:center; }
            #exchange-control-panel .header .title { font-weight:bold; }
            #exchange-control-panel .header .subtitle { font-size:10px; color:#ffb83f; opacity:0.8; margin-top:2px; }
            #exchange-control-panel .header .sensor { width:10px; height:10px; border-radius:50%; background:#f77; margin-right:6px; border:1px solid #333; }
            #exchange-control-panel .header .minimize-btn { background:none; border:none; color:#ffb83f; cursor:pointer; font-size:16px; width:24px; height:24px; }
            #exchange-control-panel .content { padding:5px 8px; max-height:70vh; overflow-y:auto; }
            #exchange-control-panel.minimized .content, #exchange-control-panel.minimized .footer, #exchange-control-panel.minimized .attribution { display:none; }
            .stat-row { display:flex; justify-content:space-between; margin-bottom:4px; }
            #exchange-control-panel .input-row { display:flex; flex-direction:column; margin-bottom:8px; }
            #exchange-control-panel .input-row label { margin-bottom:3px; }
            #exchange-control-panel .input-row input { background:#241008; border:1px solid #ffb83f; color:#ffb83f; padding:4px; border-radius:3px; width:100%; }
            #exchange-control-panel .attribution { text-align:center; font-size:10px; color:#999; font-style:italic; padding:5px 8px; border-top:1px solid #654321; }
            #exchange-control-panel .footer { display:flex; gap:5px; padding:5px 8px; border-top:1px solid #ffb83f; background:#2a2a2a; }
            #exchange-control-panel .btn { flex:1; background:#2a2a2a; border:1px solid #ffb83f; color:#ffb83f; padding:4px; border-radius:3px; cursor:pointer; font-size:12px; }
            #exchange-control-panel .btn:hover { background:#3a3a3a; }
            #exchange-control-panel .btn-group { display:flex; gap:5px; margin-top:5px; }
            #exchange-control-panel .log { font-size:10px; color:#999; margin-top:5px; max-height:60px; overflow-y:auto; }
        `;
        const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
    }

    // Build panel UI
    function createPanel() {
        panel = document.createElement('div'); panel.id = 'exchange-control-panel';
        // header
        const header = document.createElement('div'); header.className = 'header';
        const sensor = document.createElement('div'); sensor.className = 'sensor'; sensor.id = 'exchange-sensor';
        const titleContainer = document.createElement('div'); titleContainer.className = 'title-container';
        const title = document.createElement('div'); title.className = 'title'; title.textContent = `Exchange Control v${VERSION}`;
        const subtitle = document.createElement('div'); subtitle.className = 'subtitle'; subtitle.textContent = 'powered by Gods';
        titleContainer.append(title, subtitle);
        const minimize = document.createElement('button'); minimize.className = 'minimize-btn'; minimize.textContent = '−'; minimize.title = 'Minimize'; minimize.addEventListener('click', toggleMinimize);
        header.append(sensor, titleContainer, minimize); panel.append(header);
        // content
        const content = document.createElement('div'); content.className = 'content';
        // inputs
        const quantityRow = document.createElement('div'); quantityRow.className = 'input-row';
        const quantityLabel = document.createElement('label'); quantityLabel.textContent = 'Quantity:';
        const quantityInput = document.createElement('input'); quantityInput.type = 'number'; quantityInput.id = 'exchange-quantity'; quantityInput.min = '1'; quantityInput.value = '100';
        quantityRow.append(quantityLabel, quantityInput);
        const priceRow = document.createElement('div'); priceRow.className = 'input-row';
        const priceLabel = document.createElement('label'); priceLabel.textContent = 'Price per Item (gp):';
        const priceInput = document.createElement('input'); priceInput.type = 'number'; priceInput.id = 'exchange-price'; priceInput.min = '1'; priceInput.value = '5';
        priceRow.append(priceLabel, priceInput);
        // buttons
        const actionBtns = document.createElement('div'); actionBtns.className = 'btn-group';
        const quantityBtn = document.createElement('button'); quantityBtn.className = 'btn'; quantityBtn.textContent = 'Apply Quantity'; quantityBtn.addEventListener('click', () => { if(!isProcessing) applyQuantity(); });
        const priceBtn = document.createElement('button'); priceBtn.className = 'btn'; priceBtn.textContent = 'Apply Price'; priceBtn.addEventListener('click', () => { if(!isProcessing) applyPrice(); });
        actionBtns.append(quantityBtn, priceBtn);
        const tradeBtns = document.createElement('div'); tradeBtns.className = 'btn-group'; tradeBtns.style.marginTop = '5px';
        const buyBtn = document.createElement('button'); buyBtn.className = 'btn'; buyBtn.textContent = 'Buy'; buyBtn.addEventListener('click', () => { if(!isProcessing) executeTrade('Buy'); });
        const sellBtn = document.createElement('button'); sellBtn.className = 'btn'; sellBtn.textContent = 'Sell'; sellBtn.addEventListener('click', () => { if(!isProcessing) executeTrade('Sell'); });
        tradeBtns.append(buyBtn, sellBtn);
        // status & log
        const statusRow = document.createElement('div'); statusRow.className = 'stat-row'; statusRow.style.marginTop = '10px'; statusRow.style.borderTop = '1px solid #654321'; statusRow.style.paddingTop = '8px';
        const statusLabel = document.createElement('span'); statusLabel.textContent = 'Status:';
        const statusValue = document.createElement('span'); statusValue.id = 'exchange-status'; statusValue.textContent = 'Ready';
        statusRow.append(statusLabel, statusValue);
        const logArea = document.createElement('div'); logArea.id = 'exchange-log'; logArea.className = 'log';
        content.append(quantityRow, priceRow, actionBtns, tradeBtns, statusRow, logArea); panel.append(content);
        // footer
        const attribution = document.createElement('div'); attribution.className = 'attribution'; attribution.textContent = 'made by the "Gods" guild';
        const footer = document.createElement('div'); footer.className = 'footer';
        const resetBtn = document.createElement('button'); resetBtn.className = 'btn'; resetBtn.textContent = 'Reset'; resetBtn.addEventListener('click', resetValues);
        const closeBtn = document.createElement('button'); closeBtn.className = 'btn'; closeBtn.textContent = 'Close'; closeBtn.addEventListener('click', () => panel.style.display = 'none');
        footer.append(resetBtn, closeBtn); panel.append(attribution, footer);
        makeDraggable(panel, header); document.body.append(panel);
    }

    function toggleMinimize() {
        const minimized = panel.classList.toggle('minimized');
        const btn = panel.querySelector('.minimize-btn'); btn.textContent = minimized ? '+' : '−'; btn.title = minimized ? 'Maximize' : 'Minimize';
    }

    function makeDraggable(el, handle) {
        let dx=0, dy=0;
        handle.addEventListener('mousedown', e => {
            e.preventDefault(); dx = e.clientX - el.getBoundingClientRect().left; dy = e.clientY - el.getBoundingClientRect().top;
            document.addEventListener('mousemove', drag); document.addEventListener('mouseup', up);
        });
        function drag(e) { el.style.left = (e.clientX - dx) + 'px'; el.style.top = (e.clientY - dy) + 'px'; el.style.right = 'auto'; }
        function up() { document.removeEventListener('mousemove', drag); document.removeEventListener('mouseup', up); }
    }

    function log(msg) {
        const logEl = document.getElementById('exchange-log'); const time = new Date().toLocaleTimeString(); logEl.innerHTML += `${time}: ${msg}<br>`; logEl.scrollTop = logEl.scrollHeight; console.log(msg);
    }

    function updateStatus(status) {
        const statusEl = document.getElementById('exchange-status'); if(statusEl) statusEl.textContent = status;
        const sensorEl = document.getElementById('exchange-sensor'); if(sensorEl) sensorEl.style.background = status.includes('Success') ? '#7f7' : status.includes('Error') ? '#f77' : status.includes('Processing') ? '#ff7' : '#aaa';
        log(status);
    }

    function resetValues() {
        shouldCancel = true;
        document.getElementById('exchange-quantity').value = '100';
        document.getElementById('exchange-price').value = '5';
        updateStatus('Cancelled: values reset');
        setTimeout(() => { isProcessing = false; shouldCancel = false; updateStatus('Ready'); }, 300);
    }

    function getCurrentQuantity() {
        try {
            const spans = document.querySelectorAll('span.font-bold.text-\\[\\#d4af37\\]');
            for(const s of spans) { const p = s.previousElementSibling; if(p && p.textContent.includes('Quantity:')) return parseInt(s.textContent.replace(/,/g,''))||0; }
            const el = document.evaluate("//span[contains(text(),'Quantity:')]/following-sibling::span", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            return el ? parseInt(el.textContent.replace(/,/g,''))||0 : 0;
        } catch { return 0; }
    }

    function getCurrentPrice() {
        try {
            const spans = document.querySelectorAll('span.font-bold.text-\\[\\#d4af37\\]');
            for(const s of spans) { const p = s.previousElementSibling; if(p && p.textContent.includes('Price per Item:')) return parseInt(s.textContent.split(' ')[0])||0; }
            const el = document.evaluate("//span[contains(text(),'Price per Item:')]/following-sibling::span", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            return el ? parseInt(el.textContent.split(' ')[0])||0 : 0;
        } catch { return 0; }
    }

    function findExactButton(text) { return Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim()===text) || null; }
    function sleep(ms) { return new Promise(res=>setTimeout(res, ms)); }

    // Live-tracking + optimal applyQuantity
    async function applyQuantity() {
        isProcessing = true;
        shouldCancel = false;
        const input = document.getElementById('exchange-quantity');
        const target = parseInt(input.value, 10) || 0;
        updateStatus(`Processing: Live-adjusting to ${target}...`);

        const denomNames = ['1K','100','10','5','1'];
        const plusBtn = findExactButton('+');
        const minusBtn = findExactButton('-');

        while(!shouldCancel) {
            const current = getCurrentQuantity();
            const diff = target - current;
            if(diff === 0) break;
            updateStatus(`Current: ${current}, Target: ${target}`);

            const absDiff = Math.abs(diff);
            const actionBtn = diff > 0 ? plusBtn : minusBtn;

            // choose denom closest to remaining diff (under or over)
            const candidates = denomNames.map(name => {
                const btn = findExactButton(name);
                const val = name === '1K' ? 1000 : parseInt(name, 10);
                return btn ? { name, val, btn } : null;
            }).filter(d => d);

            const chosen = candidates.sort((a, b) => Math.abs(absDiff - a.val) - Math.abs(absDiff - b.val))[0];
            if(!chosen) {
                actionBtn.click();
                await sleep(100);
                continue;
            }

            log(`Setting denom: ${chosen.name}`);
            chosen.btn.click();
            await sleep(100);

            log(`Stepping ${diff > 0 ? '+' : '-'}${chosen.val}`);
            actionBtn.click();
            await sleep(100);
        }

        if(!shouldCancel) updateStatus(`Success: Reached ${getCurrentQuantity()}`);
        else updateStatus('Cancelled');
        isProcessing = false;
        shouldCancel = false;
    }

    // Price adjustment
    function clickButtonMultipleTimes(button, count, cb, batchSize=3, delay=100) {
        if(count <= 0 || shouldCancel) { if(cb) cb(); return; }
        const clicks = Math.min(batchSize, count);
        let done = 0;
        function batch() {
            if(shouldCancel) return;
            if(done >= clicks) {
                setTimeout(() => {
                    done = 0;
                    clickButtonMultipleTimes(button, count - clicks, cb, batchSize, delay);
                }, 200);
                return;
            }
            button.click();
            done++;
            setTimeout(batch, delay);
        }
        batch();
    }

    function applyPrice() {
        if(isProcessing) return;
        isProcessing = true;
        shouldCancel = false;
        const target = parseInt(document.getElementById('exchange-price').value, 10) || 0;
        const current = getCurrentPrice();
        updateStatus(`Processing: Setting price ${current}→${target}...`);
        const inc = findExactButton('+ 10%');
        const dec = findExactButton('- 10%');
        if(!inc || !dec) { updateStatus('Error: Price buttons missing'); isProcessing = false; return; }
        const diff = Math.abs(target - current);
        const isUp = target > current;
        if(diff > 50) {
            const est = Math.ceil(
                Math.log((isUp ? target/current : current/target)) / Math.log(1.1)
            );
            const start = Math.max(1, Math.floor(est * 0.7));
            clickButtonMultipleTimes(isUp ? inc : dec, start, () => fineTune(), 5, 100);
        } else fineTune();

        function fineTune() {
            if(shouldCancel) { isProcessing = false; return; }
            const cur = getCurrentPrice();
            if(cur === target) { updateStatus(`Success: Price ${cur}`); isProcessing = false; return; }
            const btn = cur < target ? inc : dec;
            btn.click();
            setTimeout(() => {
                const nw = getCurrentPrice();
                if(nw === cur || (cur < target && nw >= target) || (cur > target && nw <= target)) {
                    updateStatus(`Success: Price ${nw}`);
                    isProcessing = false;
                } else fineTune();
            }, 200);
        }
    }

    // Execute trade
    function executeTrade(action) {
        if(isProcessing) return;
        isProcessing = true;
        updateStatus(`Processing: ${action}...`);
        const btn = findExactButton(action);
        if(!btn) { updateStatus(`Error: ${action} missing`); isProcessing = false; return; }
        try { btn.click(); updateStatus(`Success: ${action}`); } catch(e) { updateStatus(`Error: ${action} failed`); }
        isProcessing = false;
    }

    // Init
    const ready = setInterval(() => {
        if(document.querySelector('.tooltip')) {
            clearInterval(ready);
            injectStyles(); createPanel(); updateStatus('Ready');
            document.addEventListener('keydown', e => {
                if(e.altKey && e.key.toLowerCase()==='e') {
                    panel.style.display = panel.style.display==='none' ? 'block' : 'none';
                }
            });
        }
    }, 500);
})();
