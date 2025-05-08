// ==UserScript==
// @name         Glenwich Auto Re-enter Dungeon
// @namespace    https://github.com/DarthFeanor/glenwich-scripts
// @version      1.0
// @description  Automatically re-enters the dungeon after dying in combat
// @author       Claude
// @match        https://*.glenwich.com/*
// @match        https://glenwich.com/*
// @icon         https://glenwich.com/favicon.png
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // Configuration
    const SCAN_INTERVAL_MS = 1000; // Check for the dialog every second
    let isEnabled = false;
    let intervalId = null;
    let displayElement = null;

    // Wait for the game to fully load
    const readyCheck = setInterval(() => {
        if (document.querySelector('.tooltip')) {
            clearInterval(readyCheck);
            initAutoReenter();
        }
    }, 1000);

    // Create the display panel
    function createDisplayPanel() {
        // Check if panel already exists
        if (document.getElementById('auto-reenter-panel')) {
            return document.getElementById('auto-reenter-panel');
        }

        // Create panel
        const panel = document.createElement('div');
        panel.id = 'auto-reenter-panel';
        panel.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            width: 220px;
            background-color: #2b140e;
            border: 2px solid #ffb83f;
            color: #ffb83f;
            padding: 10px;
            font-family: monospace;
            z-index: 9999;
            border-radius: 5px;
            font-size: 12px;
        `;

        // Create header with drag handle
        const header = document.createElement('div');
        header.innerHTML = '<b>Auto Re-enter Dungeon</b>';
        header.style.cssText = `
            text-align: center;
            font-size: 14px;
            border-bottom: 1px solid #ffb83f;
            padding-bottom: 5px;
            margin-bottom: 5px;
            cursor: move;
        `;
        panel.appendChild(header);

        // Make panel draggable
        makeDraggable(panel, header);

        // Add content container
        const content = document.createElement('div');
        content.id = 'auto-reenter-content';
        content.style.cssText = `
            margin-bottom: 10px;
        `;
        panel.appendChild(content);

        // Add toggle button
        const toggleContainer = document.createElement('div');
        toggleContainer.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 10px;
        `;

        const toggleLabel = document.createElement('span');
        toggleLabel.textContent = 'Enable Auto Re-enter:';
        toggleContainer.appendChild(toggleLabel);

        const toggleSwitch = document.createElement('label');
        toggleSwitch.className = 'toggle-switch';
        toggleSwitch.style.cssText = `
            position: relative;
            display: inline-block;
            width: 46px;
            height: 20px;
        `;

        const toggleInput = document.createElement('input');
        toggleInput.type = 'checkbox';
        toggleInput.id = 'auto-reenter-toggle';
        toggleInput.style.cssText = `
            opacity: 0;
            width: 0;
            height: 0;
        `;
        toggleInput.addEventListener('change', function(e) {
            if (e.target.checked) {
                startAutoReenter();
            } else {
                stopAutoReenter();
            }
        });

        const toggleSlider = document.createElement('span');
        toggleSlider.className = 'toggle-slider';
        toggleSlider.style.cssText = `
            position: absolute;
            cursor: pointer;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: #4a1810;
            transition: .3s;
            border-radius: 20px;
        `;
        toggleSlider.innerHTML = `
            <span style="
                position: absolute;
                content: '';
                height: 16px;
                width: 16px;
                left: 2px;
                bottom: 2px;
                background-color: #8a4e32;
                transition: .3s;
                border-radius: 50%;
                transform: translateX(0);
            " id="toggle-knob"></span>
        `;

        toggleSwitch.appendChild(toggleInput);
        toggleSwitch.appendChild(toggleSlider);
        toggleContainer.appendChild(toggleSwitch);
        panel.appendChild(toggleContainer);

        // Add status display
        const statusDisplay = document.createElement('div');
        statusDisplay.id = 'auto-reenter-status';
        statusDisplay.style.cssText = `
            margin-bottom: 10px;
            font-style: italic;
            font-size: 11px;
            color: #cccccc;
        `;
        statusDisplay.textContent = 'Status: Inactive';
        panel.appendChild(statusDisplay);

        // Add buttons container
        const buttonsContainer = document.createElement('div');
        buttonsContainer.style.cssText = `
            display: flex;
            gap: 5px;
            margin-top: 5px;
        `;

        // Add close button
        const closeBtn = document.createElement('button');
        closeBtn.innerText = 'Close';
        closeBtn.style.cssText = `
            background-color: #2a2a2a;
            color: #ffb83f;
            border: 1px solid #ffb83f;
            padding: 3px 8px;
            cursor: pointer;
            border-radius: 3px;
            flex: 1;
        `;
        closeBtn.addEventListener('click', () => {
            panel.style.display = 'none';
        });
        buttonsContainer.appendChild(closeBtn);

        panel.appendChild(buttonsContainer);
        document.body.appendChild(panel);

        return panel;
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
            // Call function whenever the cursor moves
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
            element.style.right = "auto";
        }

        function closeDragElement() {
            // Stop moving when mouse button is released
            document.onmouseup = null;
            document.onmousemove = null;
        }
    }

    // Function to check for the "Are you sure?" dialog and click Enter
    function checkForDungeonDialog() {
        if (!isEnabled) return;

        // Look for the "Are you sure?" dialog with the characteristic text and buttons
        const dialogHeaders = Array.from(document.querySelectorAll('h3.text-xl.font-bold.text-center'))
            .filter(h => h.textContent === 'Are you sure?');

        if (dialogHeaders.length > 0) {
            console.log('[Auto Re-enter] Dungeon dialog detected - automatically re-entering');

            // Find the dialog container
            const dialogHeader = dialogHeaders[0];
            const dialogContainer = dialogHeader.closest('.flex.flex-col.w-full.border-2');

            if (dialogContainer) {
                // Find the "Enter" button
                const buttons = dialogContainer.querySelectorAll('button');
                const enterButton = Array.from(buttons).find(btn => btn.textContent === 'Enter');

                if (enterButton) {
                    // Click the Enter button
                    console.log('[Auto Re-enter] Clicking "Enter" button');
                    enterButton.click();

                    // Update status indicator
                    const statusIndicator = document.getElementById('auto-reenter-status');
                    if (statusIndicator) {
                        statusIndicator.textContent = 'Last action: Re-entered at ' + new Date().toLocaleTimeString();
                    }

                    updateContent();
                } else {
                    console.log('[Auto Re-enter] Could not find "Enter" button');
                }
            }
        }
    }

    // Function to start the auto re-enter feature
    function startAutoReenter() {
        if (intervalId) clearInterval(intervalId);
        intervalId = setInterval(checkForDungeonDialog, SCAN_INTERVAL_MS);
        isEnabled = true;

        // Update UI
        const statusIndicator = document.getElementById('auto-reenter-status');
        if (statusIndicator) {
            statusIndicator.textContent = 'Status: Active - Waiting for dungeon dialog...';
            statusIndicator.style.color = '#7fff7f';
        }

        const toggleKnob = document.getElementById('toggle-knob');
        if (toggleKnob) {
            toggleKnob.style.transform = 'translateX(26px)';
            toggleKnob.style.backgroundColor = '#ffb83f';
        }

        updateContent();
        console.log('[Auto Re-enter] Enabled');
    }

    // Function to stop the auto re-enter feature
    function stopAutoReenter() {
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }
        isEnabled = false;

        // Update UI
        const statusIndicator = document.getElementById('auto-reenter-status');
        if (statusIndicator) {
            statusIndicator.textContent = 'Status: Inactive';
            statusIndicator.style.color = '#cccccc';
        }

        const toggleKnob = document.getElementById('toggle-knob');
        if (toggleKnob) {
            toggleKnob.style.transform = 'translateX(0)';
            toggleKnob.style.backgroundColor = '#8a4e32';
        }

        updateContent();
        console.log('[Auto Re-enter] Disabled');
    }

    // Update content display
    function updateContent() {
        if (!displayElement) return;

        displayElement.innerHTML = `
            <div style="font-size: 11px; margin-bottom: 5px;">
                This script will automatically click the "Enter" button
                when you die in the dungeon, allowing continuous farming.
            </div>
            <div style="color: ${isEnabled ? '#7fff7f' : '#ff7f7f'}; font-weight: bold;">
                Currently: ${isEnabled ? 'ENABLED' : 'DISABLED'}
            </div>
        `;
    }

    // Main initialization function
    function initAutoReenter() {
        console.log('[Auto Re-enter] Initializing Auto Re-enter Dungeon script...');

        // Create display panel
        const panel = createDisplayPanel();
        displayElement = panel.querySelector('#auto-reenter-content');

        // Initial content update
        updateContent();

        // Add toggle hotkey (Alt+D)
        document.addEventListener('keydown', (e) => {
            if (e.altKey && e.key === 'd') {
                const panel = document.getElementById('auto-reenter-panel');
                if (panel) {
                    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
                }
            }
        });

        // Expose for manual activation
        window.glenwichAutoReenter = {
            toggle: () => {
                const panel = document.getElementById('auto-reenter-panel');
                if (panel) {
                    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
                }
            },
            enable: () => {
                const toggleInput = document.getElementById('auto-reenter-toggle');
                if (toggleInput && !toggleInput.checked) {
                    toggleInput.checked = true;
                    startAutoReenter();
                }
            },
            disable: () => {
                const toggleInput = document.getElementById('auto-reenter-toggle');
                if (toggleInput && toggleInput.checked) {
                    toggleInput.checked = false;
                    stopAutoReenter();
                }
            },
            isEnabled: () => isEnabled
        };

        console.log('[Auto Re-enter] Initialized successfully! Press Alt+D to toggle the display.');
    }
})();
