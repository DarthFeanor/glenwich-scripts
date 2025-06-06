// ==UserScript==
// @name         Glenwich Ultimate Toolkit
// @version      10.1
// @description  Ultimate toolkit for Glenwich
// @author       Txdxrxv
// @match        https://glenwich.com/*
// @exclude      https://wiki.glenwich.com/*
// @icon         https://glenwich.com/favicon.png
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // ============= MODULE CONFIGURATION =============
    // Set to false to disable modules completely
    const MODULE_CONFIG = {
        exchange: true,   // Exchange automation module
        bank: true,       // Auto banking module
        nav: true,        // Navigation helper module
        xp: true,         // XP tracking module
        dungeon: false     // Dungeon auto re-enter module
    };

    // ============= UNIFIED CONFIG AND STATE =============
    const TOOLKIT = {
        version: '10.1',
        modules: MODULE_CONFIG, // Add module config reference
        config: {
            // Exchange module config
            exchange: {
                checkInterval: 500
            },
            // Bank module config
            bank: {
                checkInterval: 750,
                actionDelay: 500,
                maxLogEntries: 50,
                initDelay: 1000,
                maxConsecutiveEmptyScans: 3
            },
            // Navigation module config
            nav: {
                checkInterval: 1000
            },
            // XP Tracker module config
            xp: {
                updateInterval: 10000,
                runWindow: 5 * 60 * 1000
            },
            // Dungeon re-enter module config
            dungeon: {
                scanInterval: 1000
            }
        },
        state: {
            activeTab: '', // Will be set to first enabled module
            isMinimized: false,
            // Exchange state
            exchange: {
                isProcessing: false,
                shouldCancel: false,
                sensorState: 'idle'
            },
            // Bank state
            bank: {
                isRunning: false,
                isBankDetected: false,
                itemsDeposited: 0,
                totalValue: 0,
                depositing: false,
                sessionStart: null,
                intervalId: null,
                emptyScansCount: 0
            },
            // Navigator state
            nav: {
                locationData: { current: '', locations: {}, connections: {} },
                autoNavigating: false,
                navPath: [],
                navDestination: '',
                lastDirection: '',
                widgetInterval: null,
                autoNavInterval: null
            },
            // XP Tracker state
            xp: {
                skillData: {},
                intervalId: null,
                tooltipObserver: null
            },
            // Dungeon re-enter state
            dungeon: {
                isEnabled: false,
                intervalId: null,
                reentryCount: 0,
                lastActionTime: '-'
            }
        },
        dom: {} // Will hold references to important DOM elements
    };

    // Get list of enabled modules
    function getEnabledModules() {
        return Object.keys(MODULE_CONFIG).filter(module => MODULE_CONFIG[module]);
    }

    // Get first enabled module for default tab
    function getDefaultTab() {
        const enabled = getEnabledModules();
        return enabled.length > 0 ? enabled[0] : 'exchange';
    }

    // ============= INIT SEQUENCE =============
    // Main initialization
    function initToolkit() {
        // Set default active tab to first enabled module
        TOOLKIT.state.activeTab = getDefaultTab();

        injectStyles();
        createWidget();
        // Initialize modules when game is ready
        checkGameReady();
    }

    function checkGameReady() {
        // Wait for the game to be ready (when tooltips are available)
        const readyCheck = setInterval(() => {
            if (document.querySelector('.tooltip')) {
                clearInterval(readyCheck);
                console.log('[Glenwich Toolkit] Game ready, initializing modules...');

                // Initialize only enabled modules
                if (MODULE_CONFIG.exchange) initExchangeModule();
                if (MODULE_CONFIG.bank) initBankModule();
                if (MODULE_CONFIG.nav) initNavModule();
                if (MODULE_CONFIG.xp) initXPModule();
                if (MODULE_CONFIG.dungeon) initDungeonModule();

                // Show active tab
                showTab(TOOLKIT.state.activeTab);

                // Add keyboard shortcuts (Alt+T for toolkit, Alt+E for Exchange tab if enabled)
                document.addEventListener('keydown', e => {
                    if (e.altKey && e.key.toLowerCase() === 't') {
                        toggleWidget();
                    } else if (e.altKey && e.key.toLowerCase() === 'e' && MODULE_CONFIG.exchange) {
                        TOOLKIT.dom.widget.style.display = 'block';
                        showTab('exchange');
                    }
                });

                console.log('[Glenwich Toolkit] Enabled modules initialized:', getEnabledModules().join(', '));
            }
        }, 500);
    }

    function toggleWidget() {
        const widget = document.getElementById('glenwich-toolkit');
        widget.style.display = widget.style.display === 'none' ? 'block' : 'none';
    }

    // ============= WIDGET UI =============
    // Create the unified toolkit widget
    function createWidget() {
        // Main widget container
        const widget = document.createElement('div');
        widget.id = 'glenwich-toolkit';

        // Create header
        const header = document.createElement('div');
        header.className = 'tk-header';

        // Title container with main title and subtitle
        const titleContainer = document.createElement('div');
        titleContainer.className = 'tk-title-container';
        const title = document.createElement('div');
        title.className = 'tk-title';
        title.textContent = `Glenwich Toolkit v${TOOLKIT.version}`;
        const subtitle = document.createElement('div');
        subtitle.className = 'tk-subtitle';
        subtitle.textContent = 'powered by Gods';
        titleContainer.append(title, subtitle);

        const minBtn = document.createElement('button');
        minBtn.className = 'tk-minimize-btn';
        minBtn.textContent = TOOLKIT.state.isMinimized ? '+' : '−';
        minBtn.addEventListener('click', toggleMinimize);
        header.append(titleContainer, minBtn);
        widget.append(header);

        // Create tab bar - only for enabled modules
        const tabBar = document.createElement('div');
        tabBar.className = 'tk-tabs';

        // Define all available tabs
        const allTabs = [
            { id: 'exchange', label: 'Exchange' },
            { id: 'bank', label: 'Bank' },
            { id: 'nav', label: 'Nav' },
            { id: 'xp', label: 'XP' },
            { id: 'dungeon', label: 'Dungeon' }
        ];

        // Filter to only enabled tabs
        const enabledTabs = allTabs.filter(tab => MODULE_CONFIG[tab.id]);

        // Create tab buttons for enabled modules only
        enabledTabs.forEach(tab => {
            const tabBtn = document.createElement('button');
            tabBtn.className = 'tk-tab-btn';
            tabBtn.setAttribute('data-tab', tab.id);
            tabBtn.textContent = tab.label;
            tabBtn.addEventListener('click', () => {
                showTab(tab.id);
            });
            tabBar.append(tabBtn);
        });

        // Only add tab bar if there are enabled modules
        if (enabledTabs.length > 0) {
            widget.append(tabBar);
        }

        // Create content area
        const content = document.createElement('div');
        content.className = 'tk-content';

        // Create content containers for enabled modules only
        enabledTabs.forEach(tab => {
            const tabContent = document.createElement('div');
            tabContent.className = 'tk-tab-content';
            tabContent.id = `tk-${tab.id}-content`;
            content.append(tabContent);
        });

        // Add message if no modules are enabled
        if (enabledTabs.length === 0) {
            const noModulesMsg = document.createElement('div');
            noModulesMsg.className = 'tk-tab-content';
            noModulesMsg.style.display = 'block';
            noModulesMsg.innerHTML = `
                <div class="tk-info" style="text-align: center; padding: 20px;">
                    <div style="color: #ff7f7f; margin-bottom: 10px;">No modules enabled</div>
                    <div style="font-size: 11px; color: #aaa;">
                        Edit the MODULE_CONFIG section in the script to enable modules.
                    </div>
                </div>
            `;
            content.append(noModulesMsg);
        }

        widget.append(content);

        // Create footer
        const footer = document.createElement('div');
        footer.className = 'tk-footer';
        const footerContent = document.createElement('div');
        footerContent.className = 'tk-footer-content';

        // Add attribution text
        const attribution = document.createElement('div');
        attribution.className = 'tk-attribution';
        attribution.textContent = 'made by the "Gods" Guild';

        const closeBtn = document.createElement('button');
        closeBtn.className = 'tk-btn';
        closeBtn.textContent = 'Close';
        closeBtn.addEventListener('click', () => {
            widget.style.display = 'none';
        });
        footerContent.append(attribution, closeBtn);
        footer.append(footerContent);
        widget.append(footer);

        // Make widget draggable
        makeDraggable(widget, header);
        // Add widget to document
        document.body.appendChild(widget);

        // Store important DOM references
        TOOLKIT.dom.widget = widget;
        TOOLKIT.dom.minBtn = minBtn;
        TOOLKIT.dom.tabBtns = tabBar.querySelectorAll('.tk-tab-btn');
        TOOLKIT.dom.tabContents = content.querySelectorAll('.tk-tab-content');
    }

    // Toggle minimize/maximize
    function toggleMinimize() {
        TOOLKIT.state.isMinimized = !TOOLKIT.state.isMinimized;
        TOOLKIT.dom.widget.classList.toggle('tk-minimized', TOOLKIT.state.isMinimized);
        TOOLKIT.dom.minBtn.textContent = TOOLKIT.state.isMinimized ? '+' : '−';
    }

    // Show specific tab
    function showTab(tabId) {
        // Only show tab if module is enabled
        if (!MODULE_CONFIG[tabId]) return;

        TOOLKIT.state.activeTab = tabId;
        // Update tab buttons
        TOOLKIT.dom.tabBtns.forEach(btn => {
            if (btn.getAttribute('data-tab') === tabId) {
                btn.classList.add('tk-active');
            } else {
                btn.classList.remove('tk-active');
            }
        });
        // Update tab content visibility
        TOOLKIT.dom.tabContents.forEach(content => {
            if (content.id === `tk-${tabId}-content`) {
                content.style.display = 'block';
            } else {
                content.style.display = 'none';
            }
        });
    }

    // Make an element draggable
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

    // Sleep utility function
    function sleep(ms) {
        return new Promise(res=>setTimeout(res, ms));
    }

    // ============= STYLES =============
    // Inject unified stylesheet for the toolkit
    function injectStyles() {
        const css = `
            /* Main Toolkit Styles */
            #glenwich-toolkit {
                position: fixed;
                top: 10px;
                right: 10px;
                width: 270px;
                background: rgba(43,20,14,0.95);
                border: 2px solid #ffb83f;
                color: #ffb83f;
                font-family: monospace;
                font-size: 12px;
                z-index: 100000;
                border-radius: 5px;
                box-shadow: 0 3px 8px rgba(0,0,0,0.5);
            }
            #glenwich-toolkit.tk-minimized .tk-content,
            #glenwich-toolkit.tk-minimized .tk-tabs,
            #glenwich-toolkit.tk-minimized .tk-footer {
                display: none;
            }
            .tk-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 6px 10px;
                background: rgba(0,0,0,0.3);
                border-bottom: 1px solid #ffb83f;
                cursor: move;
            }
            .tk-title-container {
                flex-grow: 1;
                text-align: center;
            }
            .tk-title {
                font-weight: bold;
                font-size: 14px;
            }
            .tk-subtitle {
                font-size: 10px;
                color: #ffb83f;
                opacity: 0.8;
            }
            .tk-minimize-btn {
                background: none;
                border: none;
                color: #ffb83f;
                cursor: pointer;
                font-size: 16px;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .tk-tabs {
                display: flex;
                justify-content: space-between;
                border-bottom: 1px solid #ffb83f;
            }
            .tk-tab-btn {
                flex: 1;
                padding: 5px;
                background: #2a2a2a;
                color: #ffb83f;
                border: none;
                border-right: 1px solid #ffb83f;
                cursor: pointer;
                font-size: 12px;
                font-family: monospace;
            }
            .tk-tab-btn:last-child {
                border-right: none;
            }
            .tk-tab-btn.tk-active {
                background: #4a1810;
                font-weight: bold;
            }
            .tk-content {
                max-height: 350px;
                overflow-y: auto;
            }
            .tk-tab-content {
                display: none;
                padding: 10px;
            }
            .tk-footer {
                display: flex;
                padding: 6px 10px;
                border-top: 1px solid #ffb83f;
                background: rgba(0,0,0,0.3);
            }
            .tk-footer-content {
                display: flex;
                width: 100%;
                justify-content: space-between;
                align-items: center;
                gap: 10px;
            }
            .tk-attribution {
                font-size: 10px;
                color: #999;
                font-style: italic;
                max-width: 65%;
                text-overflow: ellipsis;
                overflow: hidden;
            }
            .tk-btn {
                min-width: 60px;
                flex: 0 0 auto;
                padding: 5px;
                background: #2a2a2a;
                color: #ffb83f;
                border: 1px solid #ffb83f;
                border-radius: 3px;
                cursor: pointer;
                font-size: 12px;
                font-family: monospace;
            }
            .tk-btn:hover {
                background: #3d1e14;
            }
            .tk-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            /* Shared Component Styles */
            .tk-status-row {
                display: flex;
                align-items: center;
                margin-bottom: 6px;
            }
            .tk-indicator {
                width: 10px;
                height: 10px;
                border-radius: 50%;
                border: 1px solid #333;
                margin-right: 6px;
            }
            .tk-on { background: #7fff7f; }
            .tk-off { background: #ff7f7f; }
            .tk-processing { background: #ffff7f; }
            .tk-controls {
                display: flex;
                gap: 6px;
                margin: 8px 0;
            }
            .tk-info {
                font-size: 11px;
                margin-bottom: 8px;
                color: #ccc;
                font-style: italic;
            }
            .tk-stats {
                display: flex;
                justify-content: space-between;
                background: #1f1209;
                border-radius: 4px;
                padding: 8px;
                font-size: 12px;
                margin-bottom: 8px;
            }
            .tk-stat {
                text-align: center;
            }
            .tk-stat-label {
                font-size: 10px;
                color: #aaa;
            }
            .tk-stat-value {
                color: #ffb83f;
            }
            .tk-log-container {
                max-height: 140px;
                background: #1f1209;
                border-radius: 4px;
                padding: 8px;
                overflow-y: auto;
                margin-bottom: 8px;
            }
            .tk-log-list {
                list-style: none;
                margin: 0;
                padding: 0;
                font-size: 11px;
            }
            .tk-log-list li {
                margin-bottom: 4px;
                border-bottom: 1px solid #3d1e14;
                padding-bottom: 4px;
            }
            .tk-log-time {
                color: #aaa;
                font-size: 9px;
                margin-right: 4px;
            }
            .tk-log-info { color: #7fbfff; }
            .tk-log-success { color: #7fff7f; }
            .tk-log-error { color: #ff7f7f; }

            /* Exchange Module Styles */
            .tk-input-row {
                display: flex;
                flex-direction: column;
                margin-bottom: 8px;
            }
            .tk-input-row label {
                margin-bottom: 3px;
            }
            .tk-input-row input {
                background: #241008;
                border: 1px solid #ffb83f;
                color: #ffb83f;
                padding: 4px;
                border-radius: 3px;
                width: 100%;
            }
            .tk-btn-group {
                display: flex;
                gap: 5px;
                margin-top: 5px;
            }

            /* Navigator Module Styles */
            .tk-nav-location {
                text-align: center;
                padding: 10px;
                background: #4a1810;
                border-radius: 4px;
                margin-bottom: 10px;
                text-transform: capitalize;
            }
            .tk-nav-buttons {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 6px;
                margin-bottom: 10px;
            }
            .tk-nav-buttons button {
                width: 40px;
                height: 40px;
                background: #4a1810;
                color: #ffb83f;
                border: 1px solid #ffb83f;
                border-radius: 4px;
                font-size: 20px;
                cursor: pointer;
            }
            .tk-nav-destinations {
                border-top: 1px solid #ffb83f;
                padding-top: 8px;
                margin-bottom: 10px;
            }

            /* XP Tracker Styles */
            .tk-skill-section {
                margin-bottom: 8px;
                padding-bottom: 6px;
                border-bottom: 1px dashed #654321;
            }
            .tk-skill-title {
                display: flex;
                justify-content: space-between;
                color: #ffffff;
                font-weight: bold;
                margin-bottom: 4px;
            }
            .tk-skill-stats .tk-row {
                display: flex;
                justify-content: space-between;
                font-size: 11px;
                margin-bottom: 2px;
            }
        `;
        const styleEl = document.createElement('style');
        styleEl.textContent = css;
        document.head.appendChild(styleEl);
    }

    // ============= EXCHANGE MODULE =============
    function initExchangeModule() {
        const exchangeState = TOOLKIT.state.exchange;
        const container = document.getElementById('tk-exchange-content');

        // Create exchange module UI
        container.innerHTML = `
            <div class="tk-info">Automate exchange operations with quantity and price control.</div>
            <!-- Status row -->
            <div class="tk-status-row">
                <span class="tk-indicator tk-off" id="tk-exchange-sensor"></span>
                <span id="tk-exchange-status">Ready</span>
            </div>
            <!-- Inputs -->
            <div class="tk-input-row">
                <label for="tk-exchange-quantity">Quantity:</label>
                <input type="number" id="tk-exchange-quantity" min="1" value="100">
            </div>
            <div class="tk-input-row">
                <label for="tk-exchange-price">Price per Item (gp):</label>
                <input type="number" id="tk-exchange-price" min="1" value="5">
            </div>
            <!-- Action buttons -->
            <div class="tk-btn-group">
                <button class="tk-btn" id="tk-exchange-quantity-btn">Apply Quantity</button>
                <button class="tk-btn" id="tk-exchange-price-btn">Apply Price</button>
            </div>
            <div class="tk-btn-group">
                <button class="tk-btn" id="tk-exchange-buy-btn">Buy</button>
                <button class="tk-btn" id="tk-exchange-sell-btn">Sell</button>
            </div>
            <!-- Log -->
            <div class="tk-log-container" id="tk-exchange-log-container">
                <ul class="tk-log-list" id="tk-exchange-log-list"></ul>
            </div>
            <!-- Controls -->
            <div class="tk-controls">
                <button class="tk-btn" id="tk-exchange-reset">Reset</button>
            </div>
        `;

        // Store DOM references
        TOOLKIT.dom.exchange = {
            sensor: document.getElementById('tk-exchange-sensor'),
            status: document.getElementById('tk-exchange-status'),
            quantityInput: document.getElementById('tk-exchange-quantity'),
            priceInput: document.getElementById('tk-exchange-price'),
            quantityBtn: document.getElementById('tk-exchange-quantity-btn'),
            priceBtn: document.getElementById('tk-exchange-price-btn'),
            buyBtn: document.getElementById('tk-exchange-buy-btn'),
            sellBtn: document.getElementById('tk-exchange-sell-btn'),
            resetBtn: document.getElementById('tk-exchange-reset'),
            logContainer: document.getElementById('tk-exchange-log-container'),
            logList: document.getElementById('tk-exchange-log-list')
        };

        // Add event listeners
        TOOLKIT.dom.exchange.quantityBtn.addEventListener('click', () => {
            if (!exchangeState.isProcessing) applyQuantity();
        });

        TOOLKIT.dom.exchange.priceBtn.addEventListener('click', () => {
            if (!exchangeState.isProcessing) applyPrice();
        });

        TOOLKIT.dom.exchange.buyBtn.addEventListener('click', () => {
            if (!exchangeState.isProcessing) executeTrade('Buy');
        });

        TOOLKIT.dom.exchange.sellBtn.addEventListener('click', () => {
            if (!exchangeState.isProcessing) executeTrade('Sell');
        });

        TOOLKIT.dom.exchange.resetBtn.addEventListener('click', resetExchangeValues);

        // Initial log
        exchangeLog('Exchange module initialized', 'info');
    }

    // Exchange module functions
    function exchangeLog(msg, type='info') {
        const logEl = TOOLKIT.dom.exchange.logList;
        const time = new Date().toLocaleTimeString();
        const li = document.createElement('li');
        li.innerHTML = `<span class="tk-log-time">${time}</span> <span class="tk-log-${type}">${msg}</span>`;
        logEl.appendChild(li);

        // Limit log entries
        while (logEl.children.length > 50) {
            logEl.removeChild(logEl.firstChild);
        }

        // Auto-scroll to bottom
        TOOLKIT.dom.exchange.logContainer.scrollTop = TOOLKIT.dom.exchange.logContainer.scrollHeight;
        console.log(`[Exchange] ${msg}`);
    }

    function updateExchangeStatus(status) {
        const exchangeState = TOOLKIT.state.exchange;
        const statusEl = TOOLKIT.dom.exchange.status;
        const sensorEl = TOOLKIT.dom.exchange.sensor;

        if (statusEl) statusEl.textContent = status;

        if (sensorEl) {
            if (status.includes('Success')) {
                sensorEl.className = 'tk-indicator tk-on';
                exchangeState.sensorState = 'success';
            } else if (status.includes('Error')) {
                sensorEl.className = 'tk-indicator tk-off';
                exchangeState.sensorState = 'error';
            } else if (status.includes('Processing')) {
                sensorEl.className = 'tk-indicator tk-processing';
                exchangeState.sensorState = 'processing';
            } else {
                sensorEl.className = 'tk-indicator';
                exchangeState.sensorState = 'idle';
            }
        }

        exchangeLog(status);
    }

    function resetExchangeValues() {
        const exchangeState = TOOLKIT.state.exchange;
        exchangeState.shouldCancel = true;

        TOOLKIT.dom.exchange.quantityInput.value = '100';
        TOOLKIT.dom.exchange.priceInput.value = '5';

        updateExchangeStatus('Cancelled: values reset');

        setTimeout(() => {
            exchangeState.isProcessing = false;
            exchangeState.shouldCancel = false;
            updateExchangeStatus('Ready');
        }, 300);
    }

    function getCurrentQuantity() {
        try {
            const spans = document.querySelectorAll('span.font-bold.text-\\[\\#d4af37\\]');
            for(const s of spans) {
                const p = s.previousElementSibling;
                if(p && p.textContent.includes('Quantity:')) {
                    return parseInt(s.textContent.replace(/,/g,''))||0;
                }
            }

            const el = document.evaluate(
                "//span[contains(text(),'Quantity:')]/following-sibling::span",
                document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null
            ).singleNodeValue;

            return el ? parseInt(el.textContent.replace(/,/g,''))||0 : 0;
        } catch {
            return 0;
        }
    }

    function getCurrentPrice() {
        try {
            const spans = document.querySelectorAll('span.font-bold.text-\\[\\#d4af37\\]');
            for(const s of spans) {
                const p = s.previousElementSibling;
                if(p && p.textContent.includes('Price per Item:')) {
                    return parseInt(s.textContent.split(' ')[0])||0;
                }
            }

            const el = document.evaluate(
                "//span[contains(text(),'Price per Item:')]/following-sibling::span",
                document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null
            ).singleNodeValue;

            return el ? parseInt(el.textContent.split(' ')[0])||0 : 0;
        } catch {
            return 0;
        }
    }

    function findExactButton(text) {
        return Array.from(document.querySelectorAll('button')).find(b =>
            b.textContent.trim() === text
        ) || null;
    }

    // Live-tracking + optimal applyQuantity
    async function applyQuantity() {
        const exchangeState = TOOLKIT.state.exchange;
        exchangeState.isProcessing = true;
        exchangeState.shouldCancel = false;

        const input = TOOLKIT.dom.exchange.quantityInput;
        const target = parseInt(input.value, 10) || 0;

        updateExchangeStatus(`Processing: Live-adjusting to ${target}...`);

        const denomNames = ['1K','100','10','5','1'];
        const plusBtn = findExactButton('+');
        const minusBtn = findExactButton('-');

        while(!exchangeState.shouldCancel) {
            const current = getCurrentQuantity();
            const diff = target - current;

            if(diff === 0) break;

            updateExchangeStatus(`Current: ${current}, Target: ${target}`);

            const absDiff = Math.abs(diff);
            const actionBtn = diff > 0 ? plusBtn : minusBtn;

            // choose denom closest to remaining diff (under or over)
            const candidates = denomNames.map(name => {
                const btn = findExactButton(name);
                const val = name === '1K' ? 1000 : parseInt(name, 10);
                return btn ? { name, val, btn } : null;
            }).filter(d => d);

            const chosen = candidates.sort((a, b) =>
                Math.abs(absDiff - a.val) - Math.abs(absDiff - b.val)
            )[0];

            if(!chosen) {
                actionBtn.click();
                await sleep(50);
                continue;
            }

            exchangeLog(`Setting denom: ${chosen.name}`);
            chosen.btn.click();
            await sleep(50);

            exchangeLog(`Stepping ${diff > 0 ? '+' : '-'}${chosen.val}`);
            actionBtn.click();
            await sleep(50);
        }

        if(!exchangeState.shouldCancel) {
            updateExchangeStatus(`Success: Reached ${getCurrentQuantity()}`);
        } else {
            updateExchangeStatus('Cancelled');
        }

        exchangeState.isProcessing = false;
        exchangeState.shouldCancel = false;
    }

    // Price adjustment helper function
    function clickButtonMultipleTimes(button, count, cb, batchSize=3, delay=100) {
        const exchangeState = TOOLKIT.state.exchange;
        if(count <= 0 || exchangeState.shouldCancel) {
            if(cb) cb();
            return;
        }

        const clicks = Math.min(batchSize, count);
        let done = 0;

        function batch() {
            if(exchangeState.shouldCancel) return;

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

    // Price adjustment function
    function applyPrice() {
        const exchangeState = TOOLKIT.state.exchange;
        if(exchangeState.isProcessing) return;

        exchangeState.isProcessing = true;
        exchangeState.shouldCancel = false;

        const target = parseInt(TOOLKIT.dom.exchange.priceInput.value, 10) || 0;
        const current = getCurrentPrice();

        updateExchangeStatus(`Processing: Setting price ${current}→${target}...`);

        const inc = findExactButton('+ 10%');
        const dec = findExactButton('- 10%');

        if(!inc || !dec) {
            updateExchangeStatus('Error: Price buttons missing');
            exchangeState.isProcessing = false;
            return;
        }

        const diff = Math.abs(target - current);
        const isUp = target > current;

        if(diff > 50) {
            const est = Math.ceil(
                Math.log((isUp ? target/current : current/target)) / Math.log(1.1)
            );
            const start = Math.max(1, Math.floor(est * 0.7));
            clickButtonMultipleTimes(isUp ? inc : dec, start, () => fineTune(), 5, 100);
        } else {
            fineTune();
        }

        function fineTune() {
            if(exchangeState.shouldCancel) {
                exchangeState.isProcessing = false;
                return;
            }

            const cur = getCurrentPrice();

            if(cur === target) {
                updateExchangeStatus(`Success: Price ${cur}`);
                exchangeState.isProcessing = false;
                return;
            }

            const btn = cur < target ? inc : dec;
            btn.click();

            setTimeout(() => {
                const nw = getCurrentPrice();

                if(nw === cur || (cur < target && nw >= target) || (cur > target && nw <= target)) {
                    updateExchangeStatus(`Success: Price ${nw}`);
                    exchangeState.isProcessing = false;
                } else {
                    fineTune();
                }
            }, 200);
        }
    }

    // Execute trade function
    function executeTrade(action) {
        const exchangeState = TOOLKIT.state.exchange;
        if(exchangeState.isProcessing) return;

        exchangeState.isProcessing = true;
        updateExchangeStatus(`Processing: ${action}...`);

        const btn = findExactButton(action);

        if(!btn) {
            updateExchangeStatus(`Error: ${action} missing`);
            exchangeState.isProcessing = false;
            return;
        }

        try {
            btn.click();
            updateExchangeStatus(`Success: ${action}`);
        } catch(e) {
            updateExchangeStatus(`Error: ${action} failed`);
        }

        exchangeState.isProcessing = false;
    }

    // ============= BANK MODULE =============
    function initBankModule() {
        const bankState = TOOLKIT.state.bank;
        const container = document.getElementById('tk-bank-content');
        // Create bank module UI
        container.innerHTML = `
            <div class="tk-info">Automatically bank items without Luck Bonuses, Offensive Stats, Defensive Stats, or Level Requirements.</div>
            <!-- Status rows -->
            <div class="tk-status-row">
                <span class="tk-indicator tk-off" id="tk-bank-indicator"></span>
                <span class="tk-status-label" id="tk-bank-status">Bank: Not Detected</span>
            </div>
            <div class="tk-status-row">
                <span class="tk-indicator tk-off" id="tk-run-indicator"></span>
                <span class="tk-status-label" id="tk-run-status">Status: Stopped</span>
            </div>
            <!-- Controls -->
            <div class="tk-controls">
                <button class="tk-btn" id="tk-bank-toggle">Start</button>
                <button class="tk-btn" id="tk-bank-check">Check</button>
            </div>
            <!-- Stats -->
            <div class="tk-stats">
                <div class="tk-stat">
                    <div class="tk-stat-label">Deposited</div>
                    <div class="tk-stat-value" id="tk-stat-items">0</div>
                </div>
                <div class="tk-stat">
                    <div class="tk-stat-label">Quantity</div>
                    <div class="tk-stat-value" id="tk-stat-value">0</div>
                </div>
                <div class="tk-stat">
                    <div class="tk-stat-label">Run Time</div>
                    <div class="tk-stat-value" id="tk-stat-time">00:00</div>
                </div>
            </div>
            <!-- Log -->
            <div class="tk-log-container" id="tk-bank-log-container">
                <ul class="tk-log-list" id="tk-bank-log-list"></ul>
            </div>
        `;

        // Store DOM references
        TOOLKIT.dom.bank = {
            bankIndicator: document.getElementById('tk-bank-indicator'),
            bankStatus: document.getElementById('tk-bank-status'),
            runIndicator: document.getElementById('tk-run-indicator'),
            runStatus: document.getElementById('tk-run-status'),
            toggleBtn: document.getElementById('tk-bank-toggle'),
            checkBtn: document.getElementById('tk-bank-check'),
            statItems: document.getElementById('tk-stat-items'),
            statValue: document.getElementById('tk-stat-value'),
            statTime: document.getElementById('tk-stat-time'),
            logContainer: document.getElementById('tk-bank-log-container'),
            logList: document.getElementById('tk-bank-log-list')
        };

        // Add event listeners
        TOOLKIT.dom.bank.toggleBtn.addEventListener('click', toggleBankAuto);
        TOOLKIT.dom.bank.checkBtn.addEventListener('click', () => {
            bankAddLog('Manual bank check', 'info');
            detectBank();
        });

        // Start bank detection
        detectBank();
        setInterval(detectBank, 3000);

        // Initial log
        bankAddLog('Bank module initialized', 'info');
    }

    function toggleBankAuto() {
        const bankState = TOOLKIT.state.bank;
        if (!bankState.isBankDetected) {
            bankAddLog('Cannot start: bank not detected', 'error');
            return;
        }
        bankState.isRunning ? stopBankAuto() : startBankAuto();
    }

    function startBankAuto() {
        const bankState = TOOLKIT.state.bank;
        const dom = TOOLKIT.dom.bank;
        bankState.isRunning = true;
        bankState.emptyScansCount = 0; // Reset empty scans counter when starting
        dom.toggleBtn.classList.add('tk-active');
        dom.toggleBtn.textContent = 'Stop';
        dom.runIndicator.classList.replace('tk-off', 'tk-on');
        dom.runStatus.textContent = 'Status: Running';
        bankState.sessionStart = new Date();
        bankState.intervalId = setInterval(() => {
            updateBankRunTime();
            if (bankState.isBankDetected && !bankState.depositing) {
                processInventory();
            }
        }, TOOLKIT.config.bank.checkInterval);
        bankAddLog('Auto banking started', 'success');
        // Run immediately if bank is detected
        if (bankState.isBankDetected && !bankState.depositing) {
            processInventory();
        }
    }

    function stopBankAuto() {
        const bankState = TOOLKIT.state.bank;
        const dom = TOOLKIT.dom.bank;
        bankState.isRunning = false;
        dom.toggleBtn.classList.remove('tk-active');
        dom.toggleBtn.textContent = 'Start';
        dom.runIndicator.classList.replace('tk-on', 'tk-off');
        dom.runStatus.textContent = 'Status: Stopped';
        if (bankState.intervalId) {
            clearInterval(bankState.intervalId);
            bankState.intervalId = null;
        }
        bankAddLog('Auto banking stopped', 'info');
    }

    function updateBankRunTime() {
        const bankState = TOOLKIT.state.bank;
        if (!bankState.sessionStart) return;
        const now = new Date();
        const diff = Math.floor((now - bankState.sessionStart) / 1000);
        const minutes = Math.floor(diff / 60).toString().padStart(2, '0');
        const seconds = (diff % 60).toString().padStart(2, '0');
        TOOLKIT.dom.bank.statTime.textContent = `${minutes}:${seconds}`;
    }

    function detectBank() {
        const bankState = TOOLKIT.state.bank;
        const prev = bankState.isBankDetected;
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
        bankState.isBankDetected = detected;
        // Update UI
        const dom = TOOLKIT.dom.bank;
        dom.bankIndicator.classList.toggle('tk-on', detected);
        dom.bankIndicator.classList.toggle('tk-off', !detected);
        dom.bankStatus.textContent = detected ? 'Bank: Detected' : 'Bank: Not Detected';
        // Log status changes
        if (detected && !prev) bankAddLog('Bank detected', 'success');
        if (!detected && prev) bankAddLog('Bank lost', 'error');
    }

    function processInventory() {
        const bankState = TOOLKIT.state.bank;
        if (bankState.depositing || !bankState.isRunning) return;
        bankAddLog('Scanning inventory...', 'info');
        // Find the inventory heading
        const invHeading = Array.from(document.querySelectorAll('h2')).find(h =>
            h.textContent.trim() === 'Inventory'
        );
        if (!invHeading) {
            bankAddLog('Inventory heading not found', 'error');
            return;
        }
        // Find the container with the inventory
        let container = invHeading;
        while (container && !container.classList.contains('rounded-lg'))
            container = container.parentElement;
        if (!container) {
            bankAddLog('Inventory container not found', 'error');
            return;
        }
        bankAddLog('Found inventory container', 'success');
        // Find all items within the inventory container
        const items = container.querySelectorAll('.w-full.aspect-square.border-2.border-\\[\\#4f3e37\\].rounded');
        if (!items.length) {
            bankAddLog('No inventory items found', 'error');
            return;
        }
        bankAddLog(`Found ${items.length} inventory items`, 'info');
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
            // Reset the empty scans counter when we find eligible items
            bankState.emptyScansCount = 0;
            bankAddLog(`Found ${eligible.length} eligible items`, 'success');
            const item = eligible[0];
            processItem(item.element, item.name, item.quantity);
        } else {
            // Increment empty scans counter
            bankState.emptyScansCount++;
            // Check if we've hit the maximum number of consecutive empty scans
            if (bankState.emptyScansCount >= TOOLKIT.config.bank.maxConsecutiveEmptyScans) {
                bankAddLog('No bankable items found in multiple scans. Auto-stopping.', 'info');
                stopBankAuto();
            } else {
                bankAddLog(`No eligible items found (scan ${bankState.emptyScansCount}/${TOOLKIT.config.bank.maxConsecutiveEmptyScans})`, 'info');
            }
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
                    const match = quantityText.match(/x\s([0-9,]+)/);
                    if (match && match[1]) {
                        quantity = parseInt(match[1].replace(/,/g, '')) || 1;
                    }
                }
            }
        }
        bankAddLog(`Extracted item info: ${name} (x${quantity})`, 'info');
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
        const bankState = TOOLKIT.state.bank;
        const dom = TOOLKIT.dom.bank;
        if (!el || bankState.depositing) return;
        bankState.depositing = true;
        bankAddLog(`Processing item: ${name} (x${qty})`, 'info');
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
                    bankAddLog(`Depositing ${name} (x${qty})...`, 'info');
                    // Update stats
                    bankState.itemsDeposited++;
                    dom.statItems.textContent = bankState.itemsDeposited;
                    bankState.totalValue += qty;
                    dom.statValue.textContent = bankState.totalValue;
                    // Click the deposit button
                    depositBtn.click();
                    // Reset depositing flag after a delay
                    setTimeout(() => {
                        bankAddLog(`Successfully deposited ${name} (x${qty})`, 'success');
                        bankState.depositing = false;
                    }, TOOLKIT.config.bank.actionDelay);
                } else {
                    bankAddLog('Deposit button not found or disabled', 'error');
                    bankState.depositing = false;
                }
            }, TOOLKIT.config.bank.actionDelay);
        } catch (error) {
            // Remove the visual indicator
            el.style.border = origBorder;
            bankAddLog(`Error clicking item: ${error.message}`, 'error');
            bankState.depositing = false;
        }
    }

    function bankAddLog(msg, type='info') {
        const dom = TOOLKIT.dom.bank;
        const li = document.createElement('li');
        const now = new Date();
        const ts = `[${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}]`;
        li.innerHTML = `<span class="tk-log-time">${ts}</span> <span class="tk-log-${type}">${msg}</span>`;
        dom.logList.appendChild(li);
        // Limit log entries
        while (dom.logList.children.length > TOOLKIT.config.bank.maxLogEntries)
            dom.logList.removeChild(dom.logList.firstChild);
        // Auto-scroll to bottom
        dom.logContainer.scrollTop = dom.logContainer.scrollHeight;
    }

    // ============= NAVIGATOR MODULE =============
    function initNavModule() {
        const navState = TOOLKIT.state.nav;
        const container = document.getElementById('tk-nav-content');
        // Create navigator module UI
        container.innerHTML = `
            <!-- Current Location -->
            <div class="tk-nav-location" id="tk-nav-location">Loading...</div>
            <!-- Direction Buttons -->
            <div class="tk-nav-buttons">
                <div><button id="tk-nav-north">▲</button></div>
                <div>
                    <button id="tk-nav-west">◀</button>
                    <button id="tk-nav-east">▶</button>
                </div>
                <div><button id="tk-nav-south">▼</button></div>
            </div>
            <!-- Destinations -->
            <div class="tk-nav-destinations">
                <select id="tk-nav-destination">
                    <option value="" disabled selected>Select destination…</option>
                </select>
                <button id="tk-nav-go" class="tk-btn" disabled>Go</button>
            </div>
            <!-- Status -->
            <div class="tk-stats">
                <div class="tk-stat">
                    <div class="tk-stat-label">Status</div>
                    <div class="tk-stat-value" id="tk-nav-status">Idle</div>
                </div>
            </div>
        `;

        // Store DOM references
        TOOLKIT.dom.nav = {
            location: document.getElementById('tk-nav-location'),
            northBtn: document.getElementById('tk-nav-north'),
            eastBtn: document.getElementById('tk-nav-east'),
            westBtn: document.getElementById('tk-nav-west'),
            southBtn: document.getElementById('tk-nav-south'),
            destinationSelect: document.getElementById('tk-nav-destination'),
            goBtn: document.getElementById('tk-nav-go'),
            statusValue: document.getElementById('tk-nav-status')
        };

        // Create a set of valid locations from default data
        const defaultLocations = getDefaultNavData().locations;
        const validLocations = new Set(Object.keys(defaultLocations));

        // Direction paths for detecting movement buttons
        const directionPaths = {
            north: 'm18 15-6-6-6 6',
            south: 'm6 9 6 6 6-6',
            east:  'm9 18 6-6-6-6',
            west:  'm15 18-6-6 6-6'
        };

        // Add event listeners
        ['north', 'south', 'east', 'west'].forEach(dir => {
            TOOLKIT.dom.nav[`${dir}Btn`].addEventListener('click', () => manualNav(dir));
        });

        const destSelect = TOOLKIT.dom.nav.destinationSelect;
        destSelect.addEventListener('change', () => {
            TOOLKIT.dom.nav.goBtn.disabled = !destSelect.value;
        });

        TOOLKIT.dom.nav.goBtn.addEventListener('click', () => {
            startAutoNav(destSelect.value);
        });

        // Load navigation data
        loadNavData();
        if (!Object.keys(navState.locationData.locations).length) {
            initDefaultNavData();
        } else {
            // Clean up any invalid locations from saved data
            cleanupInvalidLocations();
        }

        // Start updating
        updateNav();
        navState.widgetInterval = setInterval(updateNav, TOOLKIT.config.nav.checkInterval);

        // Clean up any invalid locations from the saved data
        function cleanupInvalidLocations() {
            const locations = navState.locationData.locations;
            const connections = navState.locationData.connections;
            // Remove invalid locations
            Object.keys(locations).forEach(loc => {
                if (!validLocations.has(loc)) {
                    delete locations[loc];
                }
            });
            // Remove invalid connections
            Object.keys(connections).forEach(loc => {
                if (!validLocations.has(loc)) {
                    delete connections[loc];
                } else {
                    // Check each direction
                    Object.keys(connections[loc]).forEach(dir => {
                        const targetLoc = connections[loc][dir];
                        if (!validLocations.has(targetLoc)) {
                            delete connections[loc][dir];
                        }
                    });
                }
            });
            // Save cleaned data
            saveNavData();
        }

        function manualNav(dir) {
            navState.lastDirection = dir;
            const gameBtns = Array.from(document.querySelectorAll('button')).filter(b =>
                b.querySelector('svg path')
            );
            const btn = gameBtns.find(g =>
                g.querySelector('svg path').getAttribute('d') === directionPaths[dir]
            );
            if (btn) btn.click();
        }

        function updateNav() {
            updateLocation();
            updateDirections();
            updateDestinations();
            updateNavStatus();
        }

        function updateLocation() {
            const selectors = ['p.capitalize.font-bold', 'p.capitalize', '[class="text-[#ffb83f]"] p'];
            for (const sel of selectors) {
                const el = document.querySelector(sel);
                if (!el) continue;
                const txt = el.textContent.trim();
                if (/roll the dice/i.test(txt)) continue;
                if (!txt || /last played\s.*ago/i.test(txt)) continue;
                // Only record current location if it's a valid location from default set
                if (validLocations.has(txt)) {
                    if (navState.locationData.current && navState.locationData.current !== txt) {
                        recordConnection(navState.locationData.current, txt);
                    }
                    navState.locationData.current = txt;
                    // Only update locations if it's in the valid set
                    if (!navState.locationData.locations[txt]) {
                        navState.locationData.locations[txt] = 1;
                        saveNavData();
                    }
                    TOOLKIT.dom.nav.location.textContent = txt;
                    if (navState.autoNavigating && txt === navState.navDestination) {
                        stopAutoNav();
                    }
                } else {
                    // For non-valid locations, still display but don't save
                    TOOLKIT.dom.nav.location.textContent = txt;
                }
                return;
            }
            TOOLKIT.dom.nav.location.textContent = 'Unknown';
        }

        function recordConnection(from, to) {
            if (!navState.lastDirection) return;
            // Only record connections between valid locations
            if (!validLocations.has(from) || !validLocations.has(to)) {
                navState.lastDirection = '';
                return;
            }
            const rev = { north: 'south', south: 'north', east: 'west', west: 'east' };
            navState.locationData.connections[from] = navState.locationData.connections[from] || {};
            navState.locationData.connections[from][navState.lastDirection] = to;
            navState.locationData.connections[to] = navState.locationData.connections[to] || {};
            navState.locationData.connections[to][rev[navState.lastDirection]] = from;
            navState.lastDirection = '';
            saveNavData();
        }

        function updateDirections() {
            const gameBtns = Array.from(document.querySelectorAll('button')).filter(b =>
                b.querySelector('svg path')
            );
            for (const dir in directionPaths) {
                const btn = TOOLKIT.dom.nav[`${dir}Btn`];
                const pathD = directionPaths[dir];
                const enabled = gameBtns.some(g =>
                    g.querySelector('svg path').getAttribute('d') === pathD
                );
                btn.disabled = !enabled;
                btn.style.opacity = enabled ? '1' : '0.4';
            }
        }

        function updateDestinations() {
            const select = TOOLKIT.dom.nav.destinationSelect;
            const prevValue = select.value;
            // Clear options
            select.innerHTML = '';
            // Add placeholder
            const placeholder = new Option('Select destination…', '');
            placeholder.disabled = true;
            placeholder.selected = true;
            select.add(placeholder);
            // Add location options - only include valid locations
            Object.keys(navState.locationData.locations)
                .filter(loc => loc && loc !== navState.locationData.current && validLocations.has(loc))
                .sort()
                .forEach(loc => {
                    select.add(new Option(loc, loc));
                });
            // Restore previous selection if possible
            if ([...select.options].some(opt => opt.value === prevValue)) {
                select.value = prevValue;
            }
            // Update go button state
            TOOLKIT.dom.nav.goBtn.disabled = !select.value;
        }

        function updateNavStatus() {
            const status = TOOLKIT.dom.nav.statusValue;
            if (navState.autoNavigating) {
                status.textContent = `To ${navState.navDestination} — Steps: ${navState.navPath.length}`;
                status.style.color = '#7fff7f';
            } else {
                status.textContent = 'Idle';
                status.style.color = '#aaa';
            }
        }

        function findPath(start, end) {
            if (start === end) return [];
            const queue = [{ loc: start, path: [] }];
            const seen = { [start]: true };
            while (queue.length) {
                const { loc, path } = queue.shift();
                const connections = navState.locationData.connections[loc] || {};
                for (const dir in connections) {
                    const nextLoc = connections[dir];
                    // Skip invalid locations in pathfinding
                    if (!validLocations.has(nextLoc)) continue;
                    if (seen[nextLoc]) continue;
                    const newPath = path.concat({ direction: dir, location: nextLoc });
                    if (nextLoc === end) return newPath;
                    seen[nextLoc] = true;
                    queue.push({ loc: nextLoc, path: newPath });
                }
            }
            return null;
        }

        function startAutoNav(destination) {
            if (!navState.locationData.current || !destination || navState.locationData.current === destination) {
                return;
            }
            navState.navDestination = destination;
            navState.navPath = findPath(navState.locationData.current, destination) || [];
            navState.autoNavigating = true;
            clearInterval(navState.autoNavInterval);
            navState.autoNavInterval = setInterval(stepAutoNav, 1500);
        }

        function stepAutoNav() {
            if (!navState.autoNavigating) return;
            if (!navState.navPath.length) {
                stopAutoNav();
                return;
            }
            const next = navState.navPath[0];
            if (navState.locationData.current !== next.location) {
                manualNav(next.direction);
            } else {
                navState.navPath.shift();
            }
        }

        function stopAutoNav() {
            navState.autoNavigating = false;
            clearInterval(navState.autoNavInterval);
        }
    }

    // Load navigation data from localStorage
    function loadNavData() {
        try {
            const data = localStorage.getItem('glenwichNavigator');
            if (data) {
                TOOLKIT.state.nav.locationData = JSON.parse(data);
            }
        } catch (error) {
            console.error('[Nav] Error loading data:', error);
        }
    }

    // Save navigation data to localStorage
    function saveNavData() {
        try {
            localStorage.setItem('glenwichNavigator', JSON.stringify(TOOLKIT.state.nav.locationData));
        } catch (error) {
            console.error('[Nav] Error saving data:', error);
        }
    }

    // Return default navigation data
    function getDefaultNavData() {
        return {
            locations: {"al pisheh":1,"glenwich":1,"plaistow":1,"ashenmere":1,"dunwyke cliffs":1,"dunwyke":1,"fractured abyss":1,"east plaistow":1,"south plaistow":1,"draymoor fields":1,"stonecross":1,"draymoor":1,"qaz hollow":1,"lostmere":1,"riverford":1,"south glenwich":1,"kilcarnen wood":1},
            connections: {"glenwich":{"east":"plaistow","south":"south glenwich"},"plaistow":{"west":"glenwich","east":"east plaistow","south":"south plaistow"},"ashenmere":{"west":"east plaistow","east":"dunwyke","south":"riverford"},"dunwyke cliffs":{"west":"dunwyke"},"dunwyke":{"east":"dunwyke cliffs","south":"fractured abyss","west":"ashenmere"},"fractured abyss":{"north":"dunwyke","west":"riverford"},"east plaistow":{"east":"ashenmere","south":"kilcarnen wood","west":"plaistow"},"south plaistow":{"north":"plaistow","south":"draymoor fields","west":"south glenwich","east":"kilcarnen wood"},"draymoor fields":{"north":"south plaistow","east":"stonecross","west":"draymoor"},"stonecross":{"west":"draymoor fields","north":"kilcarnen wood"},"draymoor":{"north":"south glenwich","east":"draymoor fields","south":"lostmere"},"qaz hollow":{"north":"lostmere","south":"al pisheh"},"al pisheh":{"north":"qaz hollow"},"lostmere":{"north":"draymoor","south":"qaz hollow"},"riverford":{"west":"kilcarnen wood","north":"ashenmere","east":"fractured abyss"},"south glenwich":{"north":"glenwich","east":"south plaistow","south":"draymoor"},"kilcarnen wood":{"north":"east plaistow","south":"stonecross","east":"riverford","west":"south plaistow"}}
        };
    }

    // Initialize default navigation data
    function initDefaultNavData() {
        TOOLKIT.state.nav.locationData = {
            current: 'glenwich',
            ...getDefaultNavData()
        };
        saveNavData();
    }

    // ============= XP TRACKER MODULE =============
    function initXPModule() {
        const xpState = TOOLKIT.state.xp;
        const container = document.getElementById('tk-xp-content');
        // Create XP tracker module UI with reset button
        container.innerHTML = `
            <div class="tk-info">Automaticaly track skills data to see experience tracking data.</div>
            <div id="tk-xp-content-inner">
                <div class="tk-no-data">Start an action to start tracking.</div>
            </div>
            <div class="tk-controls">
                <button class="tk-btn" id="tk-xp-refresh">Refresh</button>
                <button class="tk-btn" id="tk-xp-reset">Reset</button>
            </div>
        `;

        // Store DOM references
        TOOLKIT.dom.xp = {
            content: document.getElementById('tk-xp-content-inner'),
            refreshBtn: document.getElementById('tk-xp-refresh'),
            resetBtn: document.getElementById('tk-xp-reset')
        };

        // Add event listeners
        TOOLKIT.dom.xp.refreshBtn.addEventListener('click', () => {
            updateXPData();
            updateXPDisplay();
        });

        // Add event listener for reset button
        TOOLKIT.dom.xp.resetBtn.addEventListener('click', resetXPData);

        // Scan initial data
        scanInitialXPData();

        // Set up observers
        setupXPObserver();

        // Start updating
        updateXPDisplay();
        xpState.intervalId = setInterval(() => {
            updateXPData();
            updateXPDisplay();
        }, TOOLKIT.config.xp.updateInterval);

        // Set up mutation observer to watch for tooltips
        new MutationObserver(() => {
            if (document.querySelectorAll('.tooltip').length) {
                setupXPObserver();
            }
        }).observe(document.body, { childList: true, subtree: true });
    }

    function scanInitialXPData() {
        const xpState = TOOLKIT.state.xp;
        document.querySelectorAll('.tooltip').forEach(tooltip => {
            const row = tooltip.querySelector('.cursor-pointer');
            if (!row) return;
            const name = getSkillName(tooltip);
            const level = getSkillLevel(tooltip);
            const content = tooltip.querySelector('.tooltip-content');
            const data = parseXPData(content);
            if (!data) return;
            xpState.skillData[name] = {
                name,
                level: level.text,
                numericLevel: level.value,
                initialLevel: level.value, // Store initial numeric level
                levelsGained: 0, // Initialize levels gained
                initialExp: data.totalExp,
                expToLevel: data.expToLevel,
                latestExp: data.totalExp,
                initialTimestamp: Date.now(),
                latestTimestamp: Date.now(),
                expGainRate: 0,
                runningAvg: 0,
                timeToLevel: '?',
                isActive: false,
                expHistory: [{ timestamp: Date.now(), exp: data.totalExp }]
            };
        });
        return Object.keys(xpState.skillData).length > 0;
    }

    function updateXPData() {
        const xpState = TOOLKIT.state.xp;
        document.querySelectorAll('.tooltip').forEach(tooltip => {
            const row = tooltip.querySelector('.cursor-pointer');
            if (!row) return;
            const name = getSkillName(tooltip);
            const skill = xpState.skillData[name];
            if (!skill) return;
            // Update level data
            const currentLevel = getSkillLevel(tooltip);
            // Update skill level if changed
            if (currentLevel.text !== skill.level) {
                skill.level = currentLevel.text;
                skill.numericLevel = currentLevel.value;
                // Calculate levels gained
                skill.levelsGained = currentLevel.value - skill.initialLevel;
            }
            const content = tooltip.querySelector('.tooltip-content');
            const data = parseXPData(content);
            if (!data) return;
            const now = Date.now();
            if (data.totalExp !== skill.latestExp) {
                const timeMinutes = (now - skill.latestTimestamp) / 60000;
                const expDiff = data.totalExp - skill.latestExp;
                skill.expHistory.push({ timestamp: now, exp: data.totalExp });
                skill.expHistory = skill.expHistory.filter(p =>
                    p.timestamp >= now - TOOLKIT.config.xp.runWindow * 1.5
                );
                if (timeMinutes > 0.05) {
                    skill.expGainRate = expDiff / timeMinutes;
                    skill.runningAvg = calculateRunningAverage(skill.expHistory);
                    skill.isActive = true;
                }
                skill.latestExp = data.totalExp;
                skill.latestTimestamp = now;
                skill.expToLevel = data.expToLevel;
                if (skill.runningAvg > 0) {
                    const minutesToLevel = skill.expToLevel / skill.runningAvg;
                    if (minutesToLevel < 60) {
                        skill.timeToLevel = `${Math.ceil(minutesToLevel).toLocaleString()}m`;
                    } else if (minutesToLevel < 1440) {
                        skill.timeToLevel = `${Math.ceil(minutesToLevel/60).toLocaleString()}h`;
                    } else {
                        skill.timeToLevel = `${Math.ceil(minutesToLevel/1440).toLocaleString()}d`;
                    }
                } else {
                    skill.timeToLevel = '∞';
                }
            } else if ((now - skill.latestTimestamp) / 60000 > 5) {
                skill.isActive = false;
            }
        });
    }

    function updateXPDisplay() {
        const xpState = TOOLKIT.state.xp;
        const contentEl = TOOLKIT.dom.xp.content;
        contentEl.innerHTML = '';
        const skills = Object.values(xpState.skillData)
            .sort((a, b) => b.isActive - a.isActive || a.name.localeCompare(b.name));
        if (!skills.length) {
            contentEl.innerHTML = `<div class="tk-no-data">Hover over skills to start tracking.</div>`;
            return;
        }
        let activeSkillsFound = false;
        skills.forEach(skill => {
            if (!skill.isActive) return;
            activeSkillsFound = true;
            const section = document.createElement('div');
            section.className = 'tk-skill-section';
            const header = document.createElement('div');
            header.className = 'tk-skill-title';
            // Add level gain indicator if levels gained > 0
            header.innerHTML = `
                <span>${skill.name} ${skill.level}${skill.levelsGained > 0 ? ` <span style="color:#7fff7f">(+${skill.levelsGained})</span>` : ''}</span>
                <span>+${(skill.latestExp - skill.initialExp).toLocaleString()}xp</span>
            `;
            section.append(header);
            const stats = document.createElement('div');
            stats.className = 'tk-skill-stats';
            const statRows = [
                ['Now', `${Math.round(skill.expGainRate).toLocaleString()}/m`],
                ['Avg5', `${Math.round(skill.runningAvg).toLocaleString()}/m`],
                ['HrAvg', `${Math.round(skill.runningAvg * 60).toLocaleString()}/h`],
                ['Remaining', `${skill.expToLevel.toLocaleString()}xp`],
                ['ToLvl', skill.timeToLevel]
            ];
            statRows.forEach(([label, value]) => {
                const row = document.createElement('div');
                row.className = 'tk-row';
                row.innerHTML = `<span>${label}</span><span>${value}</span>`;
                stats.append(row);
            });
            section.append(stats);
            contentEl.append(section);
        });
        if (!activeSkillsFound) {
            contentEl.innerHTML = `<div class="tk-no-data">No active skills. Start an action to track.</div>`;
        }
    }

    function resetXPData() {
        const xpState = TOOLKIT.state.xp;
        // Clear all skill data
        xpState.skillData = {};
        // Re-scan for initial data
        scanInitialXPData();
        // Update the display
        updateXPDisplay();
        // Log the reset
        console.log('[Glenwich Toolkit] XP tracking data reset');
    }

    function setupXPObserver() {
        const xpState = TOOLKIT.state.xp;
        if (xpState.tooltipObserver) {
            xpState.tooltipObserver.disconnect();
        }
        xpState.tooltipObserver = new MutationObserver(() => {
            updateXPData();
            updateXPDisplay();
        });
        document.querySelectorAll('.tooltip').forEach(tooltip => {
            xpState.tooltipObserver.observe(tooltip, { attributes: true });
        });
    }

    function getSkillName(tooltip) {
        const nameEl = tooltip.querySelector('.flex.flex-row.items-center.capitalize');
        return nameEl ? nameEl.textContent.trim() : 'Unknown';
    }

    function getSkillLevel(tooltip) {
        const levelEl = tooltip.querySelector('.font-mono');
        if (!levelEl) return { text: '0/0', value: 0 };
        const levelText = levelEl.textContent.trim();
        // Parse the numeric level (e.g. from format "5/99" extract 5)
        const levelMatch = levelText.match(/^(\d+)/);
        const numericLevel = levelMatch ? parseInt(levelMatch[1], 10) : 0;
        return {
            text: levelText,
            value: numericLevel
        };
    }

    function parseXPData(element) {
        if (!element) return null;
        const text = element.textContent;
        if (!text || !text.includes('Total Experience')) return null;
        const totalMatch = text.match(/([0-9,]+)\s+Total Experience/);
        const levelMatch = text.match(/([0-9,]+)\s+to Level Up/);
        if (!totalMatch || !levelMatch) return null;
        return {
            totalExp: parseInt(totalMatch[1].replace(/,/g, ''), 10),
            expToLevel: parseInt(levelMatch[1].replace(/,/g, ''), 10)
        };
    }

    function calculateRunningAverage(history) {
        const now = Date.now();
        const cutoff = now - TOOLKIT.config.xp.runWindow;
        const recent = history.filter(point => point.timestamp >= cutoff);
        if (recent.length < 2) return 0;
        recent.sort((a, b) => a.timestamp - b.timestamp);
        const expDiff = recent[recent.length - 1].exp - recent[0].exp;
        const timeDiffMinutes = (recent[recent.length - 1].timestamp - recent[0].timestamp) / 60000;
        return timeDiffMinutes > 0 ? expDiff / timeDiffMinutes : 0;
    }

    // ============= DUNGEON MODULE =============
    function initDungeonModule() {
        const dungeonState = TOOLKIT.state.dungeon;
        const container = document.getElementById('tk-dungeon-content');
        // Create dungeon re-enter module UI
        container.innerHTML = `
            <div class="tk-info">Automatically re-enters the dungeon after death.</div>
            <!-- Status rows -->
            <div class="tk-status-row">
                <span class="tk-indicator tk-off" id="tk-dungeon-indicator"></span>
                <span class="tk-status-label">Auto Reentry: Inactive</span>
            </div>
            <!-- Stats -->
            <div class="tk-stats">
                <div class="tk-stat">
                    <div class="tk-stat-label">Re-entries</div>
                    <div class="tk-stat-value" id="tk-dungeon-count">0</div>
                </div>
                <div class="tk-stat">
                    <div class="tk-stat-label">Last Action</div>
                    <div class="tk-stat-value" id="tk-dungeon-time">-</div>
                </div>
                <div class="tk-stat">
                    <div class="tk-stat-label">Scan Interval</div>
                    <div class="tk-stat-value">${(TOOLKIT.config.dungeon.scanInterval/1000)}s</div>
                </div>
            </div>
            <!-- Controls -->
            <div class="tk-controls">
                <button class="tk-btn" id="tk-dungeon-toggle">Enable</button>
            </div>
        `;

        // Store DOM references
        TOOLKIT.dom.dungeon = {
            indicator: document.getElementById('tk-dungeon-indicator'),
            countValue: document.getElementById('tk-dungeon-count'),
            timeValue: document.getElementById('tk-dungeon-time'),
            toggleBtn: document.getElementById('tk-dungeon-toggle')
        };

        // Add event listeners
        TOOLKIT.dom.dungeon.toggleBtn.addEventListener('click', toggleDungeonAuto);
    }

    function toggleDungeonAuto() {
        const dungeonState = TOOLKIT.state.dungeon;
        if (dungeonState.isEnabled) {
            stopDungeonAuto();
        } else {
            startDungeonAuto();
        }
    }

    function startDungeonAuto() {
        const dungeonState = TOOLKIT.state.dungeon;
        const dom = TOOLKIT.dom.dungeon;
        dungeonState.isEnabled = true;
        clearInterval(dungeonState.intervalId);
        dungeonState.intervalId = setInterval(checkDungeonDialog, TOOLKIT.config.dungeon.scanInterval);
        // Update UI
        dom.indicator.classList.replace('tk-off', 'tk-on');
        dom.indicator.nextSibling.textContent = 'Auto Reentry: Active';
        dom.toggleBtn.textContent = 'Disable';
        dom.toggleBtn.classList.add('tk-active');
    }

    function stopDungeonAuto() {
        const dungeonState = TOOLKIT.state.dungeon;
        const dom = TOOLKIT.dom.dungeon;
        dungeonState.isEnabled = false;
        clearInterval(dungeonState.intervalId);
        dungeonState.intervalId = null;
        // Update UI
        dom.indicator.classList.replace('tk-on', 'tk-off');
        dom.indicator.nextSibling.textContent = 'Auto Reentry: Inactive';
        dom.toggleBtn.textContent = 'Enable';
        dom.toggleBtn.classList.remove('tk-active');
    }

    function checkDungeonDialog() {
        const dungeonState = TOOLKIT.state.dungeon;
        if (!dungeonState.isEnabled) return;
        // Look for the "Are you sure?" dialog
        const dialogHeaders = Array.from(document.querySelectorAll('h3.text-xl.font-bold.text-center'))
            .filter(h => h.textContent === 'Are you sure?');
        if (dialogHeaders.length === 0) return;
        // Find the dialog container
        const dialogHeader = dialogHeaders[0];
        const dialogContainer = dialogHeader.closest('.flex.flex-col.w-full.border-2');
        if (!dialogContainer) return;
        // Find the "Enter" button
        const buttons = dialogContainer.querySelectorAll('button');
        const enterButton = Array.from(buttons).find(btn => btn.textContent === 'Enter');
        if (!enterButton) return;
        // Click the Enter button
        enterButton.click();
        // Update stats
        dungeonState.reentryCount++;
        dungeonState.lastActionTime = new Date().toLocaleTimeString();
        TOOLKIT.dom.dungeon.countValue.textContent = dungeonState.reentryCount.toLocaleString();
        TOOLKIT.dom.dungeon.timeValue.textContent = dungeonState.lastActionTime;
    }

    // ============= INITIALIZATION =============
    // Start the toolkit
    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', initToolkit);
    } else {
        initToolkit();
    }
})();
