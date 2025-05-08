// ==UserScript==
// @name         Glenwich Online Auto Bank Items
// @namespace    https://github.com/DarthFeanor/glenwich-scripts
// @version      2.0
// @description  Automatically bank items without Luck Bonuses, Offensive Stats, Defensive Stats, or Level Requirements with widget
// @author       Claude
// @match        *://glenwich.com/*
// @match        *://*.glenwich.com/*
// @icon         https://glenwich.com/favicon.png
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // Configuration
    const config = {
        checkInterval: 1500,     // How often to check for items (ms)
        actionDelay: 800,        // Delay between actions (ms)
        maxLogEntries: 50,       // Maximum log entries
        initDelay: 5000          // Wait before initializing (ms)
    };

    // State tracking
    const state = {
        isRunning: false,
        isBankDetected: false,
        itemsDeposited: 0,
        totalValue: 0,
        depositing: false,
        sessionStart: null,
        intervalId: null,
        minimized: false
    };

    // DOM elements (will be set in createWidget)
    let widget, logContainer, logElement, bankStatusIndicator,
        runStatusIndicator, toggleButton, statsDeposited, statsValue, statsTime;

    // Wait for game to load completely before initializing
    setTimeout(() => {
        console.log('[Auto Bank] Initializing Auto Bank Items script...');
        createStyles();
        createWidget();
        startPeriodicBankCheck();
    }, config.initDelay);

    // Create widget styles
    function createStyles() {
        const styleElement = document.createElement('style');
        styleElement.textContent = `
            #glenwich-auto-bank-widget {
                position: fixed;
                top: 70px;
                right: 10px;
                width: 220px;
                background-color: #2b140e;
                border: 2px solid #ffb83f;
                border-radius: 5px;
                color: #ffb83f;
                z-index: 10000;
                font-family: monospace;
                font-size: 12px;
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.5);
                transition: box-shadow 0.3s;
                overflow: hidden;
            }
            #glenwich-auto-bank-widget:hover {
                box-shadow: 0 6px 12px rgba(0, 0, 0, 0.7);
            }
            #glenwich-auto-bank-header {
                text-align: center;
                background-color: #2b140e;
                padding: 8px 12px;
                cursor: move;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid #ffb83f;
            }
            #glenwich-auto-bank-header h3 {
                margin: 0;
                font-size: 14px;
                font-weight: bold;
                flex-grow: 1;
                text-align: center;
            }
            #glenwich-auto-bank-content {
                padding: 10px;
            }
            #glenwich-auto-bank-status {
                margin-bottom: 10px;
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            .glenwich-status-indicator {
                display: inline-block;
                width: 12px;
                height: 12px;
                border-radius: 50%;
                margin-right: 6px;
            }
            .glenwich-status-on {
                background-color: #7fff7f;
            }
            .glenwich-status-off {
                background-color: #ff7f7f;
            }
            #glenwich-auto-bank-controls {
                display: flex;
                gap: 5px;
                margin-bottom: 10px;
            }
            .glenwich-button {
                background-color: #2a2a2a;
                color: #ffb83f;
                border: 1px solid #ffb83f;
                border-radius: 3px;
                padding: 3px 8px;
                cursor: pointer;
                font-size: 12px;
                transition: background-color 0.2s;
                flex: 1;
            }
            .glenwich-button:hover {
                background-color: #3d1e14;
            }
            .glenwich-button.active {
                background-color: #4a1810;
            }
            #glenwich-auto-bank-log-container {
                max-height: 120px;
                overflow-y: auto;
                margin-top: 8px;
                background-color: #1f1209;
                border-radius: 3px;
                padding: 8px;
            }
            #glenwich-auto-bank-log {
                font-size: 11px;
                color: #e0e0e0;
                margin: 0;
                padding: 0;
                list-style-type: none;
            }
            #glenwich-auto-bank-log li {
                margin-bottom: 4px;
                padding-bottom: 4px;
                border-bottom: 1px solid #3d1e14;
            }
            #glenwich-auto-bank-log li:last-child {
                border-bottom: none;
            }
            .glenwich-log-time {
                color: #aaa;
                font-size: 9px;
            }
            .glenwich-log-success {
                color: #7fff7f;
            }
            .glenwich-log-error {
                color: #ff7f7f;
            }
            .glenwich-log-info {
                color: #7fbfff;
            }
            .glenwich-minimize-button {
                background: none;
                border: none;
                color: #ffb83f;
                cursor: pointer;
                font-size: 16px;
                padding: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                width: 24px;
                height: 24px;
            }
            .glenwich-stats {
                display: flex;
                justify-content: space-between;
                margin-top: 8px;
                background-color: #1f1209;
                border-radius: 3px;
                padding: 8px;
                font-size: 11px;
            }
            .glenwich-stats div {
                display: flex;
                flex-direction: column;
                align-items: center;
            }
            .glenwich-stats-label {
                font-size: 9px;
                color: #aaa;
            }
            .glenwich-stats-value {
                font-size: 12px;
                color: #ffb83f;
            }
            .glenwich-info-text {
                font-size: 11px;
                margin-bottom: 5px;
                color: #cccccc;
                font-style: italic;
            }
        `;
        document.head.appendChild(styleElement);
    }

    // Create the widget
    function createWidget() {
        // Create widget container
        widget = document.createElement('div');
        widget.id = 'glenwich-auto-bank-widget';

        // Header with drag handle
        const header = document.createElement('div');
        header.id = 'glenwich-auto-bank-header';
        header.innerHTML = '<h3>Auto Bank Items</h3>';

        // Minimize button
        const minimizeBtn = document.createElement('button');
        minimizeBtn.className = 'glenwich-minimize-button';
        minimizeBtn.innerHTML = '−';
        minimizeBtn.title = 'Minimize';
        minimizeBtn.addEventListener('click', toggleMinimize);
        header.appendChild(minimizeBtn);

        // Widget content
        const content = document.createElement('div');
        content.id = 'glenwich-auto-bank-content';

        // Info text
        const infoText = document.createElement('div');
        infoText.className = 'glenwich-info-text';
        infoText.innerHTML = 'This script will automatically bank items without Luck Bonuses, Offensive Stats, Defensive Stats, or Level Requirements.';
        content.appendChild(infoText);

        // Status indicators
        const statusContainer = document.createElement('div');
        statusContainer.id = 'glenwich-auto-bank-status';

        // Bank detection status
        const bankStatus = document.createElement('div');
        bankStatusIndicator = document.createElement('span');
        bankStatusIndicator.className = 'glenwich-status-indicator glenwich-status-off';
        bankStatus.appendChild(bankStatusIndicator);
        bankStatus.appendChild(document.createTextNode('Bank: Not Detected'));

        // Running status
        const runStatus = document.createElement('div');
        runStatusIndicator = document.createElement('span');
        runStatusIndicator.className = 'glenwich-status-indicator glenwich-status-off';
        runStatus.appendChild(runStatusIndicator);
        runStatus.appendChild(document.createTextNode('Status: Stopped'));

        statusContainer.appendChild(bankStatus);
        statusContainer.appendChild(runStatus);
        content.appendChild(statusContainer);

        // Controls
        const controls = document.createElement('div');
        controls.id = 'glenwich-auto-bank-controls';

        // Toggle button
        toggleButton = document.createElement('button');
        toggleButton.className = 'glenwich-button';
        toggleButton.innerText = 'Start Auto Bank';
        toggleButton.addEventListener('click', toggleAutoBanker);
        controls.appendChild(toggleButton);

        // Manual check button
        const manualCheckButton = document.createElement('button');
        manualCheckButton.className = 'glenwich-button';
        manualCheckButton.innerText = 'Check Bank';
        manualCheckButton.addEventListener('click', () => {
            addLog('Manually checking for bank...', 'info');
            checkForBank();
        });
        controls.appendChild(manualCheckButton);

        content.appendChild(controls);

        // Stats
        const stats = document.createElement('div');
        stats.className = 'glenwich-stats';

        // Items deposited stat
        const depositedStat = document.createElement('div');
        const depositedLabel = document.createElement('span');
        depositedLabel.className = 'glenwich-stats-label';
        depositedLabel.innerText = 'Items Deposited';
        statsDeposited = document.createElement('span');
        statsDeposited.className = 'glenwich-stats-value';
        statsDeposited.innerText = '0';
        depositedStat.appendChild(depositedLabel);
        depositedStat.appendChild(statsDeposited);

        // Total value stat
        const valueStat = document.createElement('div');
        const valueLabel = document.createElement('span');
        valueLabel.className = 'glenwich-stats-label';
        valueLabel.innerText = 'Total Quantity';
        statsValue = document.createElement('span');
        statsValue.className = 'glenwich-stats-value';
        statsValue.innerText = '0';
        valueStat.appendChild(valueLabel);
        valueStat.appendChild(statsValue);

        // Run time stat
        const timeStat = document.createElement('div');
        const timeLabel = document.createElement('span');
        timeLabel.className = 'glenwich-stats-label';
        timeLabel.innerText = 'Run Time';
        statsTime = document.createElement('span');
        statsTime.className = 'glenwich-stats-value';
        statsTime.innerText = '00:00';
        timeStat.appendChild(timeLabel);
        timeStat.appendChild(statsTime);

        stats.appendChild(depositedStat);
        stats.appendChild(valueStat);
        stats.appendChild(timeStat);
        content.appendChild(stats);

        // Log
        const logContainerEl = document.createElement('div');
        logContainerEl.id = 'glenwich-auto-bank-log-container';
        logContainer = logContainerEl;

        logElement = document.createElement('ul');
        logElement.id = 'glenwich-auto-bank-log';

        logContainerEl.appendChild(logElement);
        content.appendChild(logContainerEl);

        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.innerText = 'Close';
        closeBtn.className = 'glenwich-button';
        closeBtn.style.marginTop = '10px';
        closeBtn.addEventListener('click', () => {
            widget.style.display = 'none';
        });
        content.appendChild(closeBtn);

        // Assemble the widget
        widget.appendChild(header);
        widget.appendChild(content);
        document.body.appendChild(widget);

        // Make the widget draggable
        makeDraggable(widget, header);

        // Add initial log entry
        addLog('Auto Banker initialized. Press ALT+B to toggle widget.', 'info');

        // Add keyboard shortcut (Alt+B)
        document.addEventListener('keydown', (e) => {
            if (e.altKey && e.key === 'b') {
                widget.style.display = widget.style.display === 'none' ? 'block' : 'none';
            }
        });
    }

    // Start periodic bank check
    function startPeriodicBankCheck() {
        // Check for bank every 3 seconds
        setInterval(() => {
            checkForBank();
        }, 3000);

        // Check immediately
        setTimeout(checkForBank, 500);
    }

    // Make an element draggable
    function makeDraggable(element, handle) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

        handle.onmousedown = dragMouseDown;

        function dragMouseDown(e) {
            e = e || window.event;
            e.preventDefault();
            // Get the mouse cursor position at startup
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            // Call a function whenever the cursor moves
            document.onmousemove = elementDrag;
        }

        function elementDrag(e) {
            e = e || window.event;
            e.preventDefault();
            // Calculate the new cursor position
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            // Set the element's new position
            element.style.top = (element.offsetTop - pos2) + "px";
            element.style.left = (element.offsetLeft - pos1) + "px";
            element.style.right = 'auto';
        }

        function closeDragElement() {
            // Stop moving when mouse button is released
            document.onmouseup = null;
            document.onmousemove = null;
        }
    }

    // Toggle the minimized state
    function toggleMinimize() {
        const content = document.getElementById('glenwich-auto-bank-content');
        const minimizeBtn = document.querySelector('.glenwich-minimize-button');

        state.minimized = !state.minimized;

        if (state.minimized) {
            content.style.display = 'none';
            minimizeBtn.innerHTML = '+';
            minimizeBtn.title = 'Maximize';
        } else {
            content.style.display = 'block';
            minimizeBtn.innerHTML = '−';
            minimizeBtn.title = 'Minimize';
        }
    }

    // Add a log entry
    function addLog(message, type = 'info') {
        const logItem = document.createElement('li');
        const time = new Date();
        const timeStr = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}:${time.getSeconds().toString().padStart(2, '0')}`;

        logItem.innerHTML = `<span class="glenwich-log-time">[${timeStr}]</span> <span class="glenwich-log-${type}">${message}</span>`;
        logElement.appendChild(logItem);

        // Auto-scroll to bottom
        logContainer.scrollTop = logContainer.scrollHeight;

        // Limit log entries
        while (logElement.children.length > config.maxLogEntries) {
            logElement.removeChild(logElement.firstChild);
        }
    }

    // Toggle auto banker
    function toggleAutoBanker() {
        state.isRunning = !state.isRunning;

        if (state.isRunning) {
            // Start the auto banker
            toggleButton.innerText = 'Stop Auto Bank';
            toggleButton.classList.add('active');
            runStatusIndicator.className = 'glenwich-status-indicator glenwich-status-on';
            runStatusIndicator.nextSibling.textContent = 'Status: Running';

            // Record start time
            state.sessionStart = new Date();

            // Start interval
            state.intervalId = setInterval(() => {
                // Update run time
                updateRunTime();

                // Only process inventory if bank is detected and not currently depositing
                if (state.isBankDetected && !state.depositing) {
                    processInventory();
                }
            }, config.checkInterval);

            addLog('Auto banking started', 'success');

            // Run immediately once
            if (state.isBankDetected) {
                processInventory();
            }
        } else {
            // Stop the auto banker
            toggleButton.innerText = 'Start Auto Bank';
            toggleButton.classList.remove('active');
            runStatusIndicator.className = 'glenwich-status-indicator glenwich-status-off';
            runStatusIndicator.nextSibling.textContent = 'Status: Stopped';

            // Clear interval
            if (state.intervalId !== null) {
                clearInterval(state.intervalId);
                state.intervalId = null;
            }

            addLog('Auto banking stopped', 'info');
        }
    }

    // Update run time display
    function updateRunTime() {
        if (!state.sessionStart) return;

        const now = new Date();
        const diff = Math.floor((now - state.sessionStart) / 1000);
        const minutes = Math.floor(diff / 60).toString().padStart(2, '0');
        const seconds = (diff % 60).toString().padStart(2, '0');

        statsTime.innerText = `${minutes}:${seconds}`;
    }

    // Check if bank is detected
    function checkForBank() {
        // Check for bank teller's counter using multiple methods
        const wasDetected = state.isBankDetected;
        let detected = false;

        // Method 1: Check for button with "Deposit" text
        const depositButtons = Array.from(document.querySelectorAll('button')).filter(btn =>
            btn.textContent && btn.textContent.trim() === 'Deposit'
        );

        if (depositButtons.length > 0) {
            detected = true;
        }

        // Method 2: Check for h2 elements with "Bank Tellers" text
        if (!detected) {
            const bankHeadings = Array.from(document.querySelectorAll('h2')).filter(heading =>
                heading.textContent && heading.textContent.includes('Bank Tellers')
            );

            if (bankHeadings.length > 0) {
                detected = true;
            }
        }

        // Method 3: Check for text in body that indicates bank
        if (!detected && document.body.textContent && document.body.textContent.includes('Bank Tellers')) {
            detected = true;
        }

        // Update state and UI
        state.isBankDetected = detected;

        if (state.isBankDetected) {
            bankStatusIndicator.className = 'glenwich-status-indicator glenwich-status-on';
            bankStatusIndicator.nextSibling.textContent = 'Bank: Detected';

            if (!wasDetected) {
                addLog('Bank detected', 'success');
            }
        } else {
            bankStatusIndicator.className = 'glenwich-status-indicator glenwich-status-off';
            bankStatusIndicator.nextSibling.textContent = 'Bank: Not Detected';

            if (wasDetected) {
                addLog('Bank no longer detected', 'error');
            }
        }
    }

    // Main function to process inventory
    function processInventory() {
        if (state.depositing) return;

        addLog('Scanning inventory...', 'info');

        // First, find the inventory container by its heading
        const inventoryHeadings = Array.from(document.querySelectorAll('h2')).filter(heading =>
            heading.textContent && heading.textContent.trim() === 'Inventory'
        );

        if (!inventoryHeadings.length) {
            addLog('Inventory heading not found', 'error');
            return;
        }

        // Find the container that contains the inventory heading
        const inventoryHeading = inventoryHeadings[0];
        const inventoryContainer = findInventoryContainer(inventoryHeading);

        if (!inventoryContainer) {
            addLog('Inventory container not found', 'error');
            return;
        }

        addLog('Found inventory container', 'success');

        // Only look for items within the inventory container
        const inventoryItems = inventoryContainer.querySelectorAll('.w-full.aspect-square.border-2.border-\\[\\#4f3e37\\].rounded');

        if (!inventoryItems || inventoryItems.length === 0) {
            addLog('No inventory items found', 'error');
            return;
        }

        addLog(`Found ${inventoryItems.length} inventory items`, 'info');

        // Find eligible items
        let eligibleItems = [];

        for (const item of inventoryItems) {
            // First try to get tooltip from hidden div
            const tooltip = item.querySelector('.tooltip');
            if (!tooltip) continue;

            // Get tooltip container
            const tooltipContainer = tooltip.querySelector('.tooltipContainer');
            if (!tooltipContainer) continue;

            // Check if item is eligible for banking
            if (isItemEligibleForBanking(tooltipContainer)) {
                // Get item name and quantity
                const itemInfo = extractItemInfo(tooltipContainer, item);

                eligibleItems.push({
                    element: item,
                    name: itemInfo.name,
                    quantity: itemInfo.quantity
                });
            }
        }

        // Process the first eligible item
        if (eligibleItems.length > 0) {
            addLog(`Found ${eligibleItems.length} eligible items`, 'success');
            const item = eligibleItems[0];
            processItem(item.element, item.name, item.quantity);
        } else {
            addLog('No eligible items found', 'info');
        }
    }

    // Find the inventory container from the heading
    function findInventoryContainer(inventoryHeading) {
        // Navigate up to find the containing div
        let container = inventoryHeading;

        // Go up to find the top-level container with rounded corners
        while (container && !container.classList.contains('rounded-lg')) {
            container = container.parentElement;
            if (!container) return null;
        }

        return container;
    }

    // Extract item info (name and quantity)
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

    // Check if an item is eligible for banking
    function isItemEligibleForBanking(tooltipContainer) {
        if (!tooltipContainer) return false;

        // Get the tooltip text content
        const text = tooltipContainer.textContent || '';

        // Check for lack of stats sections
        const hasLuckBonuses = text.includes('Luck Bonuses');
        const hasOffensiveStats = text.includes('Offensive Stats');
        const hasDefensiveStats = text.includes('Defensive Stats');
        const hasLevelRequirements = text.includes('Level Requirements');

        // Only select items that don't have any of these sections
        return !hasLuckBonuses && !hasOffensiveStats && !hasDefensiveStats && !hasLevelRequirements;
    }

    // Process an individual item
    function processItem(item, itemName, itemQuantity) {
        if (!item || state.depositing) return;

        // Set depositing flag
        state.depositing = true;

        addLog(`Processing item: ${itemName} (x${itemQuantity})`, 'info');

        // Add a visual indicator that we're clicking this item
        const originalBorder = item.style.border;
        item.style.border = '2px solid #ff0000';

        // Click on the item to add it to the bank counter
        try {
            item.click();

            // Wait for the item to be added to the bank counter
            setTimeout(() => {
                // Remove the visual indicator
                item.style.border = originalBorder;

                // Find and click the deposit button
                const depositButton = findDepositButton();
                if (depositButton && !depositButton.disabled) {
                    addLog(`Depositing ${itemName} (x${itemQuantity})...`, 'info');

                    // Update stats
                    state.itemsDeposited++;
                    state.totalValue += itemQuantity;

                    // Update stats display
                    statsDeposited.innerText = state.itemsDeposited;
                    statsValue.innerText = state.totalValue;

                    // Click the deposit button
                    depositButton.click();

                    // Reset depositing flag after a delay
                    setTimeout(() => {
                        addLog(`Successfully deposited ${itemName} (x${itemQuantity})`, 'success');
                        state.depositing = false;
                    }, config.actionDelay);
                } else {
                    addLog('Deposit button not found or disabled', 'error');
                    state.depositing = false;
                }
            }, config.actionDelay);
        } catch (error) {
            // Remove the visual indicator
            item.style.border = originalBorder;

            addLog(`Error clicking item: ${error.message}`, 'error');
            state.depositing = false;
        }
    }

    // Find the deposit button
    function findDepositButton() {
        // Simply look for any button with "Deposit" text
        const buttons = document.querySelectorAll('button');

        for (const button of buttons) {
            if (button.textContent && button.textContent.trim() === 'Deposit') {
                return button;
            }
        }

        return null;
    }
})();
