// ==UserScript==
// @name         Glenwich Online Auto Bank Items (Styled)
// @namespace    https://github.com/DarthFeanor/glenwich-scripts
// @version      2.7
// @description  Automatically bank items without Luck Bonuses, Offensive Stats, Defensive Stats, or Level Requirements with styled widget
// @author       Txdxrxv
// @match        *://glenwich.com/*
// @match        *://*.glenwich.com/*
// @icon         https://glenwich.com/favicon.png
// @grant        none
// @run-at       document-idle
// ==/UserScript==
(function() {
    'use strict';
    const config = { checkInterval: 1500, actionDelay: 800, maxLogEntries: 50, initDelay: 5000 };
    const state = { isRunning: false, isBankDetected: false, itemsDeposited: 0, totalValue: 0, depositing: false, sessionStart: null, intervalId: null, minimized: true };
    let widget, logContainer, logList;
    let bankIndicator, bankLabel, runIndicator, runLabel;
    let toggleBtn;
    let statItems, statValue, statTime;

    setTimeout(() => {
        console.log('[Auto Bank] Initializing Auto Bank Items script...');
        injectStyles();
        createWidget();
        detectBank();
        // continuous bank detection
        setInterval(detectBank, 3000);
    }, config.initDelay);

    function injectStyles() {
        const css = `
            #bank-widget { position: fixed; top: 70px; right: 10px; width: 260px; background: rgba(43,20,14,0.95); border: 1px solid #ffb83f; border-radius: 6px; color: #ffb83f; font-family: Arial, sans-serif; font-size: 13px; box-shadow: 0 3px 8px rgba(0,0,0,0.5); z-index: 100000; }
            #bank-widget.minimized .content { display: none; }
            #bank-widget .header { display: flex; align-items: center; justify-content: space-between; padding: 8px; background: rgba(0,0,0,0.3); border-bottom: 1px solid #ffb83f; cursor: move; }
            #bank-widget .title-container { flex: 1; text-align: center; }
            #bank-widget .title { font-weight: bold; font-size: 14px; user-select: none; }
            #bank-widget .subtitle { font-size: 10px; color: #ffb83f; opacity: 0.8; user-select: none; }
            #bank-widget .min-btn { background: none; border: none; color: #ffb83f; font-size: 16px; cursor: pointer; }
            #bank-widget .content { padding: 10px; background: rgba(0,0,0,0.1); }
            .status-row { display: flex; align-items: center; margin-bottom: 6px; }
            .status-label { margin-left: 6px; font-size: 12px; }
            .indicator { width: 10px; height: 10px; border-radius: 50%; border: 1px solid #333; }
            .on { background: #7fff7f; }
            .off { background: #ff7f7f; }
            .controls { display: flex; gap: 6px; margin: 8px 0; }
            .btn { flex: 1; padding: 5px; background: #2a2a2a; border: 1px solid #ffb83f; border-radius: 4px; color: #ffb83f; cursor: pointer; font-size: 13px; transition: background 0.2s; }
            .btn:hover { background: #3d1e14; }
            .btn.active { background: #4a1810; }
            .info { font-size: 11px; margin-bottom: 8px; color: #ccc; font-style: italic; }
            .stats { display: flex; justify-content: space-between; background: #1f1209; border-radius: 4px; padding: 8px; font-size: 12px; }
            .stat { text-align: center; }
            .stat-label { font-size: 10px; color: #aaa; }
            .stat-value { color: #ffb83f; }
            #log-container { max-height: 140px; background: #1f1209; border-radius: 4px; padding: 8px; overflow-y: auto; }
            #log-list { list-style: none; margin: 0; padding: 0; font-size: 11px; }
            #log-list li { margin-bottom: 4px; border-bottom: 1px solid #3d1e14; padding-bottom: 4px; }
            .log-time { color: #aaa; font-size: 9px; margin-right: 4px; }
            .log-info { color: #7fbfff; }
            .log-success { color: #7fff7f; }
            .log-error { color: #ff7f7f; }
            .footer { display: flex; justify-content: space-between; align-items: center; margin-top: 8px; gap: 10px; }
            .attribution { font-size: 10px; color: #999; font-style: italic; max-width: 65%; text-overflow: ellipsis; overflow: hidden; }
        `;
        const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
    }

    function makeStat(label) {
        const stat = document.createElement('div');
        stat.className = 'stat';

        const statLabel = document.createElement('div');
        statLabel.className = 'stat-label';
        statLabel.textContent = label;

        const statValue = document.createElement('div');
        statValue.className = 'stat-value';
        statValue.textContent = '0';

        stat.append(statLabel, statValue);
        return [stat, statValue];
    }

    function makeDraggable(el, handle) {
        let dragging = false, startX=0, startY=0, offsetX=0, offsetY=0;

        handle.addEventListener('mousedown', e => {
            e.preventDefault();
            dragging = true;
            startX = e.clientX - offsetX;
            startY = e.clientY - offsetY;
            document.addEventListener('mousemove', onDrag);
            document.addEventListener('mouseup', onStop);
        });

        function onDrag(e) {
            if (!dragging) return;
            offsetX = e.clientX - startX;
            offsetY = e.clientY - startY;
            el.style.transform = `translate(${offsetX}px,${offsetY}px)`;
        }

        function onStop() {
            dragging = false;
            document.removeEventListener('mousemove', onDrag);
            document.removeEventListener('mouseup', onStop);
        }
    }

    function createWidget() {
        widget = document.createElement('div');
        widget.id = 'bank-widget';
        widget.classList.add('minimized');

        const header = document.createElement('div');
        header.className = 'header';

        // Create title container with main title and subtitle
        const titleContainer = document.createElement('div');
        titleContainer.className = 'title-container';

        const title = document.createElement('div');
        title.className = 'title';
        title.textContent = 'Auto Bank Items';

        const subtitle = document.createElement('div');
        subtitle.className = 'subtitle';
        subtitle.textContent = 'powered by Gods';

        titleContainer.append(title, subtitle);

        const minBtn = document.createElement('button');
        minBtn.className = 'min-btn';
        minBtn.textContent = state.minimized ? '+' : '−';
        minBtn.addEventListener('click', () => {
            state.minimized = !state.minimized;
            widget.classList.toggle('minimized', state.minimized);
            minBtn.textContent = state.minimized ? '+' : '−';
        });

        header.append(titleContainer, minBtn);
        widget.append(header);

        const content = document.createElement('div');
        content.className = 'content';

        const info = document.createElement('div');
        info.className = 'info';
        info.textContent = 'Automatically bank items without Luck Bonuses, Offensive Stats, Defensive Stats, or Level Requirements.';
        content.append(info);

        // Bank status
        const bankRow = document.createElement('div');
        bankRow.className = 'status-row';
        bankIndicator = document.createElement('span');
        bankIndicator.className = 'indicator off';
        bankLabel = document.createElement('span');
        bankLabel.className = 'status-label';
        bankLabel.textContent = 'Bank: Not Detected';
        bankRow.append(bankIndicator, bankLabel);
        content.append(bankRow);

        // Run status
        const runRow = document.createElement('div');
        runRow.className = 'status-row';
        runIndicator = document.createElement('span');
        runIndicator.className = 'indicator off';
        runLabel = document.createElement('span');
        runLabel.className = 'status-label';
        runLabel.textContent = 'Status: Stopped';
        runRow.append(runIndicator, runLabel);
        content.append(runRow);

        // Controls
        const ctr = document.createElement('div');
        ctr.className = 'controls';
        toggleBtn = document.createElement('button');
        toggleBtn.className = 'btn';
        toggleBtn.textContent = 'Start';
        toggleBtn.addEventListener('click', toggleAuto);

        const checkBtn = document.createElement('button');
        checkBtn.className = 'btn';
        checkBtn.textContent = 'Check';
        checkBtn.addEventListener('click', () => {
            addLog('Manual bank check', 'info');
            detectBank();
        });

        ctr.append(toggleBtn, checkBtn);
        content.append(ctr);

        // Stats
        const statsDiv = document.createElement('div');
        statsDiv.className = 'stats';
        const [de,posVal] = makeStat('Deposited');
        statItems = posVal;
        const [qa,qtyVal] = makeStat('Quantity');
        statValue = qtyVal;
        const [rt,rtVal] = makeStat('Run Time');
        statTime = rtVal;
        statsDiv.append(de, qa, rt);
        content.append(statsDiv);

        // Log
        logContainer = document.createElement('div');
        logContainer.id = 'log-container';
        logList = document.createElement('ul');
        logList.id = 'log-list';
        logContainer.append(logList);
        content.append(logContainer);

        // Footer with attribution and close button
        const footer = document.createElement('div');
        footer.className = 'footer';

        // Add attribution text
        const attribution = document.createElement('div');
        attribution.className = 'attribution';
        attribution.textContent = 'made by the "Gods" Guild';

        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'btn';
        closeBtn.textContent = 'Close';
        closeBtn.style.width = '60px';
        closeBtn.addEventListener('click', () => widget.style.display = 'none');

        footer.append(attribution, closeBtn);
        content.append(footer);

        widget.append(content);
        document.body.appendChild(widget);

        makeDraggable(widget, header);

        // Add Alt+B keyboard shortcut
        document.addEventListener('keydown', e => {
            if(e.altKey && e.key.toLowerCase()==='b')
                widget.style.display = widget.style.display==='none'?'block':'none';
        });

        addLog('Widget initialized. Press Alt+B to toggle.', 'info');
    }

    function toggleAuto() {
        if (!state.isBankDetected) {
            addLog('Cannot start: bank not detected', 'error');
            return;
        }
        state.isRunning ? stopAuto() : startAuto();
    }

    function startAuto() {
        state.isRunning = true;
        toggleBtn.classList.add('active');
        toggleBtn.textContent = 'Stop';
        runIndicator.classList.replace('off', 'on');
        runLabel.textContent = 'Status: Running';

        state.sessionStart = new Date();
        state.intervalId = setInterval(() => {
            updateRunTime();
            if (state.isBankDetected && !state.depositing) processInventory();
        }, config.checkInterval);

        addLog('Auto banking started', 'success');

        // Run immediately if bank is detected
        if (state.isBankDetected && !state.depositing) {
            processInventory();
        }
    }

    function stopAuto() {
        state.isRunning = false;
        toggleBtn.classList.remove('active');
        toggleBtn.textContent = 'Start';
        runIndicator.classList.replace('on', 'off');
        runLabel.textContent = 'Status: Stopped';

        if (state.intervalId) {
            clearInterval(state.intervalId);
            state.intervalId = null;
        }

        addLog('Auto banking stopped', 'info');
    }

    function updateRunTime() {
        if (!state.sessionStart) return;

        const diff = Math.floor((Date.now() - state.sessionStart) / 1000);
        const m = String(Math.floor(diff / 60)).padStart(2, '0');
        const s = String(diff % 60).padStart(2, '0');
        statTime.textContent = `${m}:${s}`;
    }

    function detectBank() {
        const prev = state.isBankDetected;

        // Method 1: Check for buttons with "Deposit" text
        const hasDeposit = Array.from(document.querySelectorAll('button')).some(b =>
            b.textContent.trim() === 'Deposit'
        );

        // Method 2: Check for h2 elements with "Bank Tellers" text
        const hasHeading = Array.from(document.querySelectorAll('h2')).some(h =>
            h.textContent.includes('Bank Tellers')
        );

        // Method 3: Check if text in body contains "Bank Tellers"
        const hasBodyText = document.body.textContent && document.body.textContent.includes('Bank Tellers');

        const detected = hasDeposit || hasHeading || hasBodyText;
        state.isBankDetected = detected;

        // Update UI
        bankIndicator.classList.toggle('on', detected);
        bankIndicator.classList.toggle('off', !detected);
        bankLabel.textContent = detected ? 'Bank: Detected' : 'Bank: Not Detected';

        // Log status changes
        if (detected && !prev) addLog('Bank detected', 'success');
        if (!detected && prev) addLog('Bank lost', 'error');
    }

    function processInventory() {
        if (state.depositing || !state.isRunning) return;

        addLog('Scanning inventory...', 'info');

        // Find the inventory heading
        const invHeading = Array.from(document.querySelectorAll('h2')).find(h =>
            h.textContent.trim() === 'Inventory'
        );

        if (!invHeading) {
            addLog('Inventory heading not found', 'error');
            return;
        }

        // Find the container with the inventory
        let container = invHeading;
        while (container && !container.classList.contains('rounded-lg'))
            container = container.parentElement;

        if (!container) {
            addLog('Inventory container not found', 'error');
            return;
        }

        addLog('Found inventory container', 'success');

        // Find all items within the inventory container
        const items = container.querySelectorAll('.w-full.aspect-square.border-2.border-\\[\\#4f3e37\\].rounded');

        if (!items.length) {
            addLog('No inventory items found', 'error');
            return;
        }

        addLog(`Found ${items.length} inventory items`, 'info');

        // Find eligible items (without stats/requirements)
        const eligible = [];

        items.forEach(item => {
            const tooltip = item.querySelector('.tooltip');
            if (!tooltip) return;

            const tooltipContainer = tooltip.querySelector('.tooltipContainer');
            if (!tooltipContainer) return;

            if (isItemEligibleForBanking(tooltipContainer)) {
                eligible.push({
                    element: item,
                    ...extractItemInfo(tooltipContainer, item)
                });
            }
        });

        if (eligible.length) {
            addLog(`Found ${eligible.length} eligible items`, 'success');
            const item = eligible[0];
            processItem(item.element, item.name, item.quantity);
        } else {
            addLog('No eligible items found', 'info');
        }
    }

    function isItemEligibleForBanking(tooltipContainer) {
        if (!tooltipContainer) return false;

        const text = tooltipContainer.textContent || '';

        // Check for lack of stats sections
        const hasLuckBonuses = text.includes('Luck Bonuses');
        const hasOffensiveStats = text.includes('Offensive Stats');
        const hasDefensiveStats = text.includes('Defensive Stats');
        const hasLevelRequirements = text.includes('Level Requirements');

        // Only select items that don't have any of these sections
        return !hasLuckBonuses && !hasOffensiveStats && !hasDefensiveStats && !hasLevelRequirements;
    }

    function extractItemInfo(tooltipContainer, itemElement) {
        let name = 'Unknown Item';
        let quantity = 1;

        // Try to find the item name
        const nameElement = tooltipContainer.querySelector('h3');
        if (nameElement) {
            name = nameElement.textContent.trim();
        }

        // Try to find the quantity using the absolute positioned element
        const quantityElement = itemElement.querySelector('.z-120.text-\\[\\#ffb83f\\].absolute.font-bold.bottom-1.left-1.text-xs');
        if (quantityElement) {
            const quantityText = quantityElement.textContent.trim();

            // Parse the quantity - handle cases like "2", "2K", etc.
            if (quantityText.endsWith('K')) {
                quantity = parseInt(quantityText.replace('K', '')) * 1000;
            } else if (quantityText.endsWith('M')) {
                quantity = parseInt(quantityText.replace('M', '')) * 1000000;
            } else {
                quantity = parseInt(quantityText.replace(/,/g, '')) || 1;
            }
        } else {
            // Alternative: check inside the tooltip for quantity
            const tooltipQuantityElement = tooltipContainer.querySelector('.text-\\[\\#ffb83f\\] span.text-\\[6pt\\]');
            if (tooltipQuantityElement && tooltipQuantityElement.parentElement) {
                const quantityText = tooltipQuantityElement.parentElement.textContent.trim();
                if (quantityText) {
                    // Extract just the number part from "x 2,045" format
                    const match = quantityText.match(/x\s*([0-9,]+)/);
                    if (match && match[1]) {
                        quantity = parseInt(match[1].replace(/,/g, '')) || 1;
                    }
                }
            }
        }

        addLog(`Extracted item info: ${name} (x${quantity})`, 'info');
        return { name, quantity };
    }

    function findDepositButton() {
        // Find all buttons and look for one with "Deposit" text
        const buttons = document.querySelectorAll('button');

        for (const button of buttons) {
            if (button.textContent && button.textContent.trim() === 'Deposit') {
                return button;
            }
        }

        return null;
    }

    function processItem(el, name, qty) {
        if (!el || state.depositing) return;

        state.depositing = true;

        addLog(`Processing item: ${name} (x${qty})`, 'info');

        // Add a visual indicator that we're clicking this item
        const origBorder = el.style.border;
        el.style.border = '2px solid red';

        // Click on the item to add it to the bank counter
        try {
            el.click();

            // Wait for the item to be added to the bank counter
            setTimeout(() => {
                // Remove the visual indicator
                el.style.border = origBorder;

                // Find and click the deposit button
                const depositBtn = findDepositButton();
                if (depositBtn && !depositBtn.disabled) {
                    addLog(`Depositing ${name} (x${qty})...`, 'info');

                    // Update stats
                    state.itemsDeposited++;
                    statItems.textContent = state.itemsDeposited;
                    state.totalValue += qty;
                    statValue.textContent = state.totalValue;

                    // Click the deposit button
                    depositBtn.click();

                    // Reset depositing flag after a delay
                    setTimeout(() => {
                        addLog(`Successfully deposited ${name} (x${qty})`, 'success');
                        state.depositing = false;
                    }, config.actionDelay);
                } else {
                    addLog('Deposit button not found or disabled', 'error');
                    state.depositing = false;
                }
            }, config.actionDelay);
        } catch (error) {
            // Remove the visual indicator
            el.style.border = origBorder;

            addLog(`Error clicking item: ${error.message}`, 'error');
            state.depositing = false;
        }
    }

    function addLog(msg, type='info') {
        const li = document.createElement('li');
        const now = new Date();
        const ts = `[${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}]`;
        li.innerHTML = `<span class="log-time">${ts}</span> <span class="log-${type}">${msg}</span>`;
        logList.appendChild(li);

        // Limit log entries
        while (logList.children.length > config.maxLogEntries)
            logList.removeChild(logList.firstChild);

        // Auto-scroll to bottom
        logContainer.scrollTop = logContainer.scrollHeight;
    }
})();
