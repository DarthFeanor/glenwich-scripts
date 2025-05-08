// ==UserScript==
// @name         Glenwich Experience Tracker
// @namespace    https://github.com/DarthFeanor/glenwich-scripts
// @version      1.1
// @description  Tracks XP gain rates and estimates time until next level in Glenwich Online with 5-minute running average
// @author       Claude
// @match        https://*.glenwich.com/*
// @match        https://glenwich.com/*
// @icon         https://glenwich.com/favicon.png
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
  'use strict';
  
  // Wait for the game to fully load
  const readyCheck = setInterval(() => {
      if (document.querySelector('.tooltip')) {
          clearInterval(readyCheck);
          initExpTracker();
      }
  }, 1000);

  // Store initial experience values and timestamps
  const skillData = {};
  const updateInterval = 10000; // Update display every 10 seconds
  let displayElement = null;
  let tooltipObserver = null;
  
  // Configuration for running average
  const runningAverageWindow = 5 * 60 * 1000; // 5 minutes in milliseconds

  // Create the display panel
  function createDisplayPanel() {
      // Check if panel already exists
      if (document.getElementById('exp-tracker-panel')) {
          return document.getElementById('exp-tracker-panel');
      }
      
      // Create panel
      const panel = document.createElement('div');
      panel.id = 'exp-tracker-panel';
      panel.style.cssText = `
          position: fixed;
          top: 10px;
          right: 10px;
          width: 300px;
          max-height: 80vh;
          overflow-y: auto;
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
      header.innerHTML = '<b>Glenwich XP Tracker</b>';
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
      content.id = 'exp-tracker-content';
      panel.appendChild(content);
      
      // Add buttons container
      const buttonsContainer = document.createElement('div');
      buttonsContainer.style.cssText = `
          display: flex;
          gap: 5px;
          margin-top: 5px;
      `;
      
      // Add refresh button
      const refreshBtn = document.createElement('button');
      refreshBtn.innerText = 'Refresh';
      refreshBtn.style.cssText = `
          background-color: #2a2a2a;
          color: #ffb83f;
          border: 1px solid #ffb83f;
          padding: 3px 8px;
          cursor: pointer;
          border-radius: 3px;
          flex: 1;
      `;
      refreshBtn.addEventListener('click', () => {
          updateExpData();
          updateDisplay();
      });
      buttonsContainer.appendChild(refreshBtn);
      
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

  // Parse experience data from tooltip content
  function parseExpData(tooltipElement) {
      if (!tooltipElement) return null;
      
      const expText = tooltipElement.textContent;
      if (!expText.includes('Total Experience') || !expText.includes('to Level Up')) return null;
      
      const totalExpMatch = expText.match(/([0-9,]+)\s+Total Experience/);
      const toLevelMatch = expText.match(/([0-9,]+)\s+to Level Up/);
      
      if (!totalExpMatch || !toLevelMatch) return null;
      
      return {
          totalExp: parseInt(totalExpMatch[1].replace(/,/g, ''), 10),
          expToLevel: parseInt(toLevelMatch[1].replace(/,/g, ''), 10)
      };
  }

  // Find and extract the skill name from a skill row element
  function getSkillNameFromRow(skillRow) {
      const skillNameElement = skillRow.querySelector('.flex.flex-row.items-center.capitalize');
      return skillNameElement ? skillNameElement.textContent.trim() : 'Unknown skill';
  }

  // Get skill level from row
  function getSkillLevelFromRow(skillRow) {
      const levelElement = skillRow.querySelector('.font-mono');
      if (!levelElement) return '0/0';
      return levelElement.textContent.trim();
  }

  // Calculate running average of XP gain based on data points in the last 5 minutes
  function calculateRunningAverage(expHistory) {
      const now = Date.now();
      const cutoffTime = now - runningAverageWindow;
      
      // Filter to only include data points from the last 5 minutes
      const recentDataPoints = expHistory.filter(point => point.timestamp >= cutoffTime);
      
      if (recentDataPoints.length < 2) {
          return 0; // Not enough data for an accurate average
      }
      
      // Sort by timestamp to ensure we're working with chronological data
      recentDataPoints.sort((a, b) => a.timestamp - b.timestamp);
      
      // Calculate total exp gained over the period
      const oldestPoint = recentDataPoints[0];
      const newestPoint = recentDataPoints[recentDataPoints.length - 1];
      
      const totalExpGained = newestPoint.exp - oldestPoint.exp;
      const timeSpanMinutes = (newestPoint.timestamp - oldestPoint.timestamp) / 60000;
      
      // Return exp gain per minute
      return timeSpanMinutes > 0 ? totalExpGained / timeSpanMinutes : 0;
  }

  // Scan the page for all skill tooltips and save initial data
  function scanInitialData() {
      const tooltips = document.querySelectorAll('.tooltip');
      
      tooltips.forEach(tooltip => {
          const skillRow = tooltip.querySelector('.cursor-pointer');
          if (!skillRow) return;
          
          const skillName = getSkillNameFromRow(tooltip);
          const skillLevel = getSkillLevelFromRow(tooltip);
          
          // Find tooltip content
          const tooltipContent = tooltip.querySelector('.tooltip-content');
          if (!tooltipContent) return;
          
          const expData = parseExpData(tooltipContent);
          if (!expData) return;
          
          // Store initial data
          skillData[skillName] = {
              name: skillName,
              level: skillLevel,
              initialExp: expData.totalExp,
              expToLevel: expData.expToLevel,
              latestExp: expData.totalExp,
              initialTimestamp: Date.now(),
              latestTimestamp: Date.now(),
              expGainRate: 0,
              runningAvgExpRate: 0,
              timeToLevel: '?',
              isActive: false,
              expHistory: [{ timestamp: Date.now(), exp: expData.totalExp }]
          };
      });
      
      console.log('[XP Tracker] Initial skill data collected:', skillData);
      return Object.keys(skillData).length > 0;
  }

  // Update experience data for skills
  function updateExpData() {
      const tooltips = document.querySelectorAll('.tooltip');
      let anyActiveSkill = false;
      
      tooltips.forEach(tooltip => {
          const skillRow = tooltip.querySelector('.cursor-pointer');
          if (!skillRow) return;
          
          const skillName = getSkillNameFromRow(tooltip);
          if (!skillData[skillName]) return;
          
          const skillLevel = getSkillLevelFromRow(tooltip);
          
          // Find tooltip content
          const tooltipContent = tooltip.querySelector('.tooltip-content');
          if (!tooltipContent) return;
          
          const expData = parseExpData(tooltipContent);
          if (!expData) return;
          
          // Update data
          const currentTime = Date.now();
          const currentSkill = skillData[skillName];
          
          // Update level in case of level up
          currentSkill.level = skillLevel;
          
          // Check if there's been a change in experience
          if (expData.totalExp !== currentSkill.latestExp) {
              // Add new data point to history
              currentSkill.expHistory.push({
                  timestamp: currentTime,
                  exp: expData.totalExp
              });
              
              // Cleanup old data points (older than window + extra buffer for calculations)
              const oldestAllowedTime = currentTime - (runningAverageWindow * 1.5);
              currentSkill.expHistory = currentSkill.expHistory.filter(
                  point => point.timestamp >= oldestAllowedTime
              );
              
              // Calculate instant rate for display purposes
              const timeDiffMinutes = (currentTime - currentSkill.latestTimestamp) / 60000;
              const expDiff = expData.totalExp - currentSkill.latestExp;
              
              // Only update if time difference is reasonable (prevent division by zero or tiny numbers)
              if (timeDiffMinutes > 0.05) {
                  currentSkill.expGainRate = expDiff / timeDiffMinutes;
                  currentSkill.isActive = true;
                  anyActiveSkill = true;
                  
                  // Calculate running average
                  currentSkill.runningAvgExpRate = calculateRunningAverage(currentSkill.expHistory);
              }
              
              // Update latest values
              currentSkill.latestExp = expData.totalExp;
              currentSkill.latestTimestamp = currentTime;
              
              // Update exp to level
              currentSkill.expToLevel = expData.expToLevel;
              
              // Calculate time to level up based on running average
              if (currentSkill.runningAvgExpRate > 0) {
                  const minutesToLevel = currentSkill.expToLevel / currentSkill.runningAvgExpRate;
                  
                  if (minutesToLevel < 60) {
                      currentSkill.timeToLevel = `${Math.ceil(minutesToLevel)} min`;
                  } else if (minutesToLevel < 24 * 60) {
                      currentSkill.timeToLevel = `${Math.ceil(minutesToLevel / 60)} hours`;
                  } else {
                      currentSkill.timeToLevel = `${Math.ceil(minutesToLevel / (60 * 24))} days`;
                  }
              } else {
                  currentSkill.timeToLevel = '∞';
              }
          } else {
              // Check if skill is still active
              const timeSinceUpdate = (currentTime - currentSkill.latestTimestamp) / 60000;
              if (timeSinceUpdate > 5) {
                  currentSkill.isActive = false;
              } else if (currentSkill.isActive) {
                  anyActiveSkill = true;
              }
          }
      });
      
      return anyActiveSkill;
  }

  // Update the display
  function updateDisplay() {
      if (!displayElement) {
          const panel = createDisplayPanel();
          displayElement = panel.querySelector('#exp-tracker-content');
      }
      
      let html = '';
      
      // Sort skills - active skills first, then by name
      const sortedSkills = Object.values(skillData)
          .sort((a, b) => {
              if (a.isActive !== b.isActive) return b.isActive - a.isActive;
              return a.name.localeCompare(b.name);
          });
      
      // Add active skills
      sortedSkills.forEach(skill => {
          if (!skill.isActive) return;
          
          const expGained = skill.latestExp - skill.initialExp;
          const totalMinutes = (skill.latestTimestamp - skill.initialTimestamp) / 60000;
          const overallRate = totalMinutes > 0 ? expGained / totalMinutes : 0;
          
          html += `
              <div style="margin-bottom: 5px; padding-bottom: 3px; border-bottom: 1px dashed #654321;">
                  <div style="display: flex; justify-content: space-between;">
                      <span style="color: #ffffff;">${skill.name}</span>
                      <span>${skill.level}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; font-size: 11px;">
                      <span>Current XP/min:</span>
                      <span>${Math.round(skill.expGainRate)} xp</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; font-size: 11px;">
                      <span>5-min Avg XP/min:</span>
                      <span>${Math.round(skill.runningAvgExpRate)} xp</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; font-size: 11px;">
                      <span>Level up in:</span>
                      <span>${skill.timeToLevel}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; font-size: 11px;">
                      <span>Total gained:</span>
                      <span>${expGained.toLocaleString()} xp</span>
                  </div>
              </div>
          `;
      });
      
      // Add header for inactive skills if needed
      const inactiveSkills = sortedSkills.filter(skill => !skill.isActive);
      if (inactiveSkills.length > 0 && html !== '') {
          html += `<div style="margin: 5px 0; font-size: 11px; color: #aaa;">Inactive Skills:</div>`;
      }
      
      // Add inactive skills (compact view)
      inactiveSkills.forEach(skill => {
          html += `
              <div style="display: flex; justify-content: space-between; font-size: 10px; color: #aaa; margin-bottom: 2px;">
                  <span>${skill.name}</span>
                  <span>${skill.level} (${skill.expToLevel.toLocaleString()} to lvl)</span>
              </div>
          `;
      });
      
      // If no skills found yet
      if (sortedSkills.length === 0) {
          html = '<div style="color: #ff6b6b;">No skill data found. Try hovering over some skills first.</div>';
      }
      
      displayElement.innerHTML = html;
  }

  // Setup tooltip observer to detect when tooltips become visible
  function setupTooltipObserver() {
      // Disconnect existing observer if it exists
      if (tooltipObserver) {
          tooltipObserver.disconnect();
      }
      
      tooltipObserver = new MutationObserver((mutations) => {
          mutations.forEach(mutation => {
              if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                  updateExpData();
              }
          });
      });
      
      // Observe all tooltips for class changes (which happen on hover)
      document.querySelectorAll('.tooltip').forEach(tooltip => {
          tooltipObserver.observe(tooltip, { attributes: true });
      });
  }

  // Main initialization function
  function initExpTracker() {
      console.log('[XP Tracker] Initializing Glenwich XP Tracker with 5-minute running average...');
      
      // Create display panel
      const panel = createDisplayPanel();
      displayElement = panel.querySelector('#exp-tracker-content');
      
      // Initial scan
      if (!scanInitialData()) {
          displayElement.innerHTML = '<div style="color: #ff6b6b;">No skill data found. Try hovering over some skills first.</div>';
      }
      
      // Setup tooltip observer
      setupTooltipObserver();
      
      // Set up interval to update data and display
      updateDisplay();
      
      setInterval(() => {
          const anyActiveSkill = updateExpData();
          updateDisplay();
          
          // Keep console clean
          if (anyActiveSkill) {
              console.log(`[XP Tracker] Updated at ${new Date().toLocaleTimeString()}`);
          }
      }, updateInterval);
      
      // Setup page change observer to handle single-page-app navigation
      const bodyObserver = new MutationObserver((mutations) => {
          if (document.querySelectorAll('.tooltip').length > 0) {
              setupTooltipObserver();
          }
      });
      
      bodyObserver.observe(document.body, { 
          childList: true, 
          subtree: true 
      });
      
      // Add toggle hotkey (Alt+X)
      document.addEventListener('keydown', (e) => {
          if (e.altKey && e.key === 'x') {
              const panel = document.getElementById('exp-tracker-panel');
              if (panel) {
                  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
              }
          }
      });
      
      // Expose for manual activation
      window.glenwichExpTracker = {
          refresh: () => {
              updateExpData();
              updateDisplay();
              console.log('[XP Tracker] Manually refreshed');
          },
          toggle: () => {
              const panel = document.getElementById('exp-tracker-panel');
              if (panel) {
                  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
              }
          },
          getData: () => skillData,
          getRunningAverage: (skillName) => {
              if (skillData[skillName]) {
                  return calculateRunningAverage(skillData[skillName].expHistory);
              }
              return 0;
          }
      };
      
      console.log('[XP Tracker] Initialized successfully! Press Alt+X to toggle the display.');
  }
})();