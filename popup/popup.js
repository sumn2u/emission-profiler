class SVGChart {
  constructor(containerId) {
    this.svg = document.getElementById(containerId);
    this.width = 300;
    this.height = 150;
    this.margin = { top: 10, right: 10, bottom: 20, left: 30 };
    this.data = [];
    this.maxPoints = 30;
    
    this.init();
  }
  
  init() {
    // Clear SVG
    this.svg.innerHTML = '';
    
    // Create chart area
    this.chartGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.chartGroup.setAttribute('transform', `translate(${this.margin.left}, ${this.margin.top})`);
    this.svg.appendChild(this.chartGroup);
    
    // Create axes
    this.createAxes();
    
    // Initial empty state
    this.drawEmptyChart();
  }
  
  createAxes() {
    // Y-axis
    this.yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.chartGroup.appendChild(this.yAxis);
    
    // X-axis line
    const xAxisLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    xAxisLine.setAttribute('x1', 0);
    xAxisLine.setAttribute('y1', this.height - this.margin.top - this.margin.bottom);
    xAxisLine.setAttribute('x2', this.width - this.margin.left - this.margin.right);
    xAxisLine.setAttribute('y2', this.height - this.margin.top - this.margin.bottom);
    xAxisLine.setAttribute('stroke', 'rgba(255, 255, 255, 0.3)');
    xAxisLine.setAttribute('stroke-width', '1');
    this.chartGroup.appendChild(xAxisLine);
  }
  
  addDataPoint(value) {
    // Validate input - ensure it's a valid number
    const numericValue = this.validateNumber(value);
    
    this.data.push(numericValue);
    
    if (this.data.length > this.maxPoints) {
      this.data.shift();
    }
    
    this.updateChart();
  }
  
  validateNumber(value) {
    // Convert to number
    const num = Number(value);
    
    // Check if it's a valid finite number
    if (isNaN(num) || !isFinite(num)) {
      console.warn('Invalid number received for chart:', value, 'defaulting to 0');
      return 0;
    }
    
    // Ensure it's not negative (for power measurements)
    return Math.max(0, num);
  }
  
  updateChart() {
    // Clear previous line and points
    const oldLine = this.chartGroup.querySelector('.data-line');
    const oldArea = this.chartGroup.querySelector('.data-area');
    const oldMessage = this.chartGroup.querySelector('.chart-message');
    
    if (oldLine) oldLine.remove();
    if (oldArea) oldArea.remove();
    if (oldMessage) oldMessage.remove();
    
    // Clear Y-axis labels
    const oldLabels = this.yAxis.querySelectorAll('text');
    oldLabels.forEach(label => label.remove());
    
    if (this.data.length < 2) {
      // If we don't have enough data, show empty chart
      this.drawEmptyChart();
      return;
    }
    
    const chartWidth = this.width - this.margin.left - this.margin.right;
    const chartHeight = this.height - this.margin.top - this.margin.bottom;
    
    // Calculate scales - ensure we have valid max value
    const validData = this.data.filter(v => !isNaN(v) && isFinite(v));
    
    if (validData.length === 0) {
      this.drawEmptyChart();
      return;
    }
    
    const maxValue = Math.max(0.1, Math.max(...validData) * 1.1); // Ensure at least 0.1
    const xScale = chartWidth / Math.max(1, this.data.length - 1);
    const yScale = chartHeight / Math.max(0.1, maxValue); // Avoid division by zero
    
    // Create path for line
    let pathData = '';
    let hasValidPoints = false;
    let lastValidX = 0;
    let lastValidY = 0;
    
    this.data.forEach((value, index) => {
      const numericValue = this.validateNumber(value);
      const x = index * xScale;
      const y = chartHeight - (numericValue * yScale);
      
      // Ensure y is a valid number
      if (isNaN(y) || !isFinite(y)) {
        return; // Skip invalid points
      }
      
      if (!hasValidPoints) {
        pathData += `M ${x} ${y} `;
        hasValidPoints = true;
      } else {
        pathData += `L ${x} ${y} `;
      }
      
      lastValidX = x;
      lastValidY = y;
    });
    
    // If we have no valid points, draw empty chart
    if (!hasValidPoints || pathData.trim() === '') {
      this.drawEmptyChart();
      return;
    }
    
    // Create line
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    line.setAttribute('d', pathData);
    line.setAttribute('fill', 'none');
    line.setAttribute('stroke', 'rgb(75, 192, 192)');
    line.setAttribute('stroke-width', '2');
    line.setAttribute('class', 'data-line');
    this.chartGroup.appendChild(line);
    
    // Create area fill - only if we have a valid path
    try {
      const areaPath = pathData + 
        `L ${lastValidX} ${chartHeight} L 0 ${chartHeight} Z`;
      const area = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      area.setAttribute('d', areaPath);
      area.setAttribute('fill', 'rgba(75, 192, 192, 0.1)');
      area.setAttribute('class', 'data-area');
      this.chartGroup.appendChild(area);
    } catch (error) {
      console.error('Error creating area fill:', error);
      // Continue without area fill
    }
    
    // Update Y-axis labels
    this.updateYAxis(maxValue, chartHeight, yScale);
  }
  
  drawEmptyChart() {
    // Clear any existing chart elements
    const oldLine = this.chartGroup.querySelector('.data-line');
    const oldArea = this.chartGroup.querySelector('.data-area');
    const oldMessage = this.chartGroup.querySelector('.chart-message');
    
    if (oldLine) oldLine.remove();
    if (oldArea) oldArea.remove();
    if (oldMessage) oldMessage.remove();
    
    // Clear Y-axis labels
    const oldLabels = this.yAxis.querySelectorAll('text');
    oldLabels.forEach(label => label.remove());
    
    // Show message or just leave empty
    const message = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    message.setAttribute('x', (this.width - this.margin.left - this.margin.right) / 2);
    message.setAttribute('y', (this.height - this.margin.top - this.margin.bottom) / 2);
    message.setAttribute('text-anchor', 'middle');
    message.setAttribute('dominant-baseline', 'middle');
    message.setAttribute('fill', 'rgba(255, 255, 255, 0.5)');
    message.setAttribute('font-size', '12');
    message.textContent = this.data.length === 0 ? 'Waiting for data...' : 'Processing...';
    message.setAttribute('class', 'chart-message');
    
    this.chartGroup.appendChild(message);
  }
  
  updateYAxis(maxValue, chartHeight, yScale) {
    // Clear existing labels
    const oldLabels = this.yAxis.querySelectorAll('text');
    oldLabels.forEach(label => label.remove());
    
    // Only create labels if maxValue is valid
    if (isNaN(maxValue) || !isFinite(maxValue) || maxValue <= 0) {
      return;
    }
    
    // Create 3 Y-axis labels (0, 50%, 100%)
    for (let i = 0; i <= 2; i++) {
      const value = (maxValue * i / 2);
      
      // Format value appropriately
      let displayValue;
      if (value === 0) {
        displayValue = '0';
      } else if (value < 0.1) {
        displayValue = value.toFixed(3);
      } else if (value < 1) {
        displayValue = value.toFixed(2);
      } else if (value < 10) {
        displayValue = value.toFixed(1);
      } else {
        displayValue = Math.round(value).toString();
      }
      
      const y = chartHeight - (value * yScale);
      
      // Ensure y is a valid number
      if (isNaN(y) || !isFinite(y)) {
        continue;
      }
      
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', -5);
      text.setAttribute('y', y);
      text.setAttribute('text-anchor', 'end');
      text.setAttribute('dominant-baseline', 'middle');
      text.setAttribute('fill', 'rgba(255, 255, 255, 0.7)');
      text.setAttribute('font-size', '10');
      text.textContent = displayValue;
      this.yAxis.appendChild(text);
    }
  }
  
  clear() {
    this.data = [];
    this.updateChart();
  }
  
  reset() {
    this.data = [];
    this.init();
  }
}

class PopupController {
  constructor() {
    this.isProfiling = false;
    this.chart = null;
    this.updateInterval = null;
    this.extensionConnected = true;
    this.lastValidMetrics = {
      power: 0,
      energy: 0,
      co2e: 0
    };
    this.cumulativeEnergy = 0; // Track total energy used
    this.cumulativeCO2 = 0;    // Track total CO2 emissions
    this.startTime = null;     // Track when profiling started
    this.co2Intensity = 475;   // Default CO2 intensity (g/kWh)
    this.lastUpdateTime = null; // Track last update time for accurate time calculations
    this.init();
  }

  async init() {
    this.setupEventListeners();
    await this.loadSettings();
    
    // Check if extension is connected before proceeding
    if (await this.checkExtensionConnection()) {
      await this.checkProfilingStatus();
      this.updateInterval = setInterval(() => this.updateMetrics(), 1000);
    } else {
      this.showConnectionError();
    }
  }

  setupEventListeners() {
    document.getElementById('startBtn').addEventListener('click', () => this.startProfiling());
    document.getElementById('stopBtn').addEventListener('click', () => this.stopProfiling());
    document.getElementById('saveSettings').addEventListener('click', () => this.saveSettings());
    
    // Initialize SVG Chart instead of Chart.js
    this.initChart();
  }

  initChart() {
    try {
      this.chart = new SVGChart('powerChartSVG');
    } catch (error) {
      console.error('Failed to initialize chart:', error);
      this.showChartError();
    }
  }

  showChartError() {
    const chartContainer = document.querySelector('.chart-container');
    if (chartContainer) {
      chartContainer.innerHTML = '<div class="chart-error">Failed to load chart</div>';
    }
  }

  // Helper method to check if extension is connected
  async checkExtensionConnection() {
    try {
      // Try to access runtime.id first
      chrome.runtime.id;
      
      // Send a ping message to verify connection
      const response = await this.safeSendMessage({ action: 'ping' });
      this.extensionConnected = response !== null;
      return this.extensionConnected;
    } catch (error) {
      console.log('Connection check failed:', error.message);
      this.extensionConnected = false;
      return false;
    }
  }

  // Safe message sending with error handling
  async safeSendMessage(message, timeout = 3000) {
    if (!this.extensionConnected) {
      console.log('Extension not connected, cannot send message');
      return null;
    }

    return new Promise((resolve) => {
      try {
        // Set timeout for message response
        const timeoutId = setTimeout(() => {
          console.log('Message timeout for action:', message.action);
          resolve(null);
        }, timeout);

        chrome.runtime.sendMessage(message, (response) => {
          clearTimeout(timeoutId);
          
          if (chrome.runtime.lastError) {
            const error = chrome.runtime.lastError;
            console.log('Message send error for action', message.action, ':', error.message);
            
            if (error.message.includes('Extension context invalidated') ||
                error.message.includes('Could not establish connection')) {
              this.extensionConnected = false;
              this.showConnectionError();
            }
            resolve(null);
          } else {
            resolve(response);
          }
        });
      } catch (error) {
        console.error('Error in safeSendMessage:', error);
        if (error.message.includes('Extension context invalidated')) {
          this.extensionConnected = false;
          this.showConnectionError();
        }
        resolve(null);
      }
    });
  }

  showConnectionError() {
    document.getElementById('status').textContent = 'Extension Error';
    document.getElementById('status').style.background = 'rgba(244, 67, 54, 0.3)';
    document.getElementById('status').style.color = '#ff8a80';
    
    // Disable buttons
    document.getElementById('startBtn').disabled = true;
    document.getElementById('stopBtn').disabled = true;
    
    // Show error in metrics
    document.getElementById('currentPower').textContent = '--';
    document.getElementById('energyUsed').textContent = '--';
    document.getElementById('co2Emissions').textContent = '--';
  }

  showConnectedStatus() {
    const status = document.getElementById('status');
    if (status) {
      status.textContent = this.isProfiling ? 'Profiling' : 'Idle';
      status.style.background = this.isProfiling 
        ? 'rgba(76, 175, 80, 0.3)' 
        : 'rgba(255, 255, 255, 0.2)';
      status.style.color = '';
    }
  }

  async startProfiling() {
    if (!this.extensionConnected) {
      if (!await this.checkExtensionConnection()) {
        this.showConnectionError();
        return;
      }
    }

    try {
      const response = await this.safeSendMessage({ action: 'startProfiling' });
      if (response && response.success) {
        this.isProfiling = true;
        this.startTime = Date.now(); // Reset start time
        this.lastUpdateTime = Date.now(); // Reset last update time
        this.cumulativeEnergy = 0;   // Reset cumulative energy
        this.cumulativeCO2 = 0;      // Reset cumulative CO2
        this.updateUI();
        this.showConnectedStatus();
        
        // Reset chart when starting new profiling session
        if (this.chart) {
          this.chart.reset();
        }
        
        // Reset metrics display
        this.displayCurrentMetrics({
          power: 0,
          energy: 0,
          co2e: 0
        });
        
        console.log('Profiling started. CO2 intensity:', this.co2Intensity, 'g/kWh');
      } else if (response === null) {
        // Connection failed
        this.showConnectionError();
      } else {
        console.log('Start profiling failed:', response);
      }
    } catch (error) {
      console.error('Error starting profiling:', error);
      if (error.message.includes('Extension context invalidated')) {
        this.extensionConnected = false;
        this.showConnectionError();
      }
    }
  }

  async stopProfiling() {
    if (!this.extensionConnected) {
      if (!await this.checkExtensionConnection()) {
        this.showConnectionError();
        return;
      }
    }

    try {
      const response = await this.safeSendMessage({ action: 'stopProfiling' });
      if (response && response.success) {
        this.isProfiling = false;
        this.updateUI();
        this.showConnectedStatus();
        
        // Calculate final duration
        const duration = this.startTime ? (Date.now() - this.startTime) / 1000 : 0;
        
        if (response.summary) {
          this.displaySummary(response.summary);
          
          // Also update display with our calculated cumulative values
          this.displayFinalCumulativeValues(duration);
        } else {
          // If no summary from service worker, show our calculated values
          this.displayFinalCumulativeValues(duration);
        }
        
        console.log('Profiling stopped. Final values:', {
          duration: duration + 's',
          energy: this.cumulativeEnergy + 'Wh',
          co2: this.cumulativeCO2 + 'gCO₂e',
          avgPower: (this.cumulativeEnergy / (duration / 3600)).toFixed(3) + 'W'
        });
      } else if (response === null) {
        this.showConnectionError();
      } else {
        console.log('Stop profiling failed:', response);
      }
    } catch (error) {
      console.error('Error stopping profiling:', error);
      if (error.message.includes('Extension context invalidated')) {
        this.extensionConnected = false;
        this.showConnectionError();
      }
    }
  }

  displayFinalCumulativeValues(duration) {
    // Update session details with our calculated values
    document.getElementById('sessionDuration').textContent = `${duration.toFixed(1)}s`;
    
    const avgPower = duration > 0 ? (this.cumulativeEnergy / (duration / 3600)) : 0;
    let avgPowerDisplay;
    
    if (avgPower >= 1000) {
      avgPowerDisplay = `${(avgPower / 1000).toFixed(3)} kW`;
    } else if (avgPower >= 1) {
      avgPowerDisplay = `${avgPower.toFixed(3)} W`;
    } else if (avgPower >= 0.001) {
      avgPowerDisplay = `${(avgPower * 1000).toFixed(3)} mW`;
    } else {
      avgPowerDisplay = `${(avgPower * 1000000).toFixed(0)} µW`;
    }
    
    document.getElementById('avgPower').textContent = avgPowerDisplay;
    
    // Estimate sample count based on duration (approx 1 sample per second)
    const sampleCount = Math.round(duration);
    document.getElementById('sampleCount').textContent = sampleCount;
  }

  async updateMetrics() {
    if (!this.isProfiling || !this.extensionConnected) return;
    
    try {
      const response = await this.safeSendMessage({ action: 'getCurrentMetrics' });
      if (response && response.success && response.metrics) {
        // Validate metrics before displaying
        const validatedMetrics = this.validateMetrics(response.metrics);
        
        // Update cumulative calculations
        this.updateCumulativeCalculations(validatedMetrics);
        
        // Display metrics with cumulative values
        this.displayCurrentMetrics(validatedMetrics);
        this.updateChart(validatedMetrics);
        
        // Store last valid metrics for fallback
        this.lastValidMetrics = {
          power: validatedMetrics.power,
          energy: this.cumulativeEnergy,
          co2e: this.cumulativeCO2
        };
        
        // Update profiling status from response
        if (response.isProfiling !== undefined) {
          this.isProfiling = response.isProfiling;
          this.updateUI();
        }
      } else if (response === null) {
        // Connection failed, try to reconnect
        if (await this.checkExtensionConnection()) {
          // If reconnected, update UI
          this.showConnectedStatus();
        } else {
          this.showConnectionError();
        }
      } else {
        console.log('Failed to get metrics:', response);
      }
    } catch (error) {
      console.error('Error updating metrics:', error);
      if (error.message.includes('Extension context invalidated')) {
        this.extensionConnected = false;
        this.showConnectionError();
      }
    }
  }

  updateCumulativeCalculations(metrics) {
    const now = Date.now();
    const currentPower = metrics.power || 0;
    
    // Calculate time elapsed since last update (in hours)
    let timeElapsedHours = 1 / 3600; // Default to 1 second if first update
    
    if (this.lastUpdateTime) {
      const timeElapsedSeconds = (now - this.lastUpdateTime) / 1000;
      timeElapsedHours = timeElapsedSeconds / 3600;
    }
    
    // Calculate energy for this time period
    // Energy (Wh) = Power (W) × Time (hours)
    const energyThisPeriod = currentPower * timeElapsedHours;
    
    // Add to cumulative energy
    this.cumulativeEnergy += energyThisPeriod;
    
    // Calculate CO2 for this time period
    // CO2 (g) = Energy (kWh) × CO2 Intensity (g/kWh)
    const energyKWhThisPeriod = energyThisPeriod / 1000; // Convert Wh to kWh
    const co2ThisPeriod = energyKWhThisPeriod * this.co2Intensity;
    
    // Add to cumulative CO2
    this.cumulativeCO2 += co2ThisPeriod;
    
    // Update last update time
    this.lastUpdateTime = now;
    
    // Debug logging (only log every 10 seconds to avoid console spam)
    if (!this.lastDebugLog || now - this.lastDebugLog > 10000) {
      console.log('Cumulative calculations update:', {
        currentPower: currentPower + 'W',
        timeElapsed: (timeElapsedHours * 3600).toFixed(1) + 's',
        energyThisPeriod: energyThisPeriod.toFixed(6) + 'Wh',
        cumulativeEnergy: this.cumulativeEnergy.toFixed(6) + 'Wh',
        co2ThisPeriod: co2ThisPeriod.toFixed(6) + 'g',
        cumulativeCO2: this.cumulativeCO2.toFixed(6) + 'g',
        co2Intensity: this.co2Intensity + 'g/kWh'
      });
      this.lastDebugLog = now;
    }
  }

  validateMetrics(metrics) {
    return {
      timestamp: metrics.timestamp || Date.now(),
      power: this.validateNumber(metrics.power, 0, 1000),
      energy: this.validateNumber(metrics.energy, 0, 10000),
      co2e: this.validateNumber(metrics.co2e, 0, 10000),
      cumulativeEnergy: this.validateNumber(metrics.cumulativeEnergy, 0, 10000),
      cumulativeCO2: this.validateNumber(metrics.cumulativeCO2, 0, 10000)
    };
  }

  validateNumber(value, min, max) {
    const num = Number(value);
    if (isNaN(num) || !isFinite(num)) {
      console.warn('Invalid number:', value, 'using fallback', min);
      return min;
    }
    return Math.max(min, Math.min(max, num));
  }

  async checkProfilingStatus() {
    try {
      const response = await this.safeSendMessage({ action: 'getCurrentMetrics' });
      if (response && response.success) {
        this.isProfiling = response.isProfiling || false;
        this.updateUI();
        this.showConnectedStatus();
      } else if (response === null) {
        this.showConnectionError();
      }
    } catch (error) {
      console.error('Error checking status:', error);
      if (error.message.includes('Extension context invalidated')) {
        this.extensionConnected = false;
        this.showConnectionError();
      }
    }
  }

  displayCurrentMetrics(metrics) {
    // Use power from current metrics, but use our calculated cumulative values
    const power = metrics.power || 0;
    const energy = this.cumulativeEnergy || 0;
    const co2e = this.cumulativeCO2 || 0;
    
    // Format power value
    let powerDisplay, powerUnit;
    if (power >= 1000) {
      powerDisplay = (power / 1000).toFixed(3);
      powerUnit = 'kW';
    } else if (power >= 1) {
      powerDisplay = power.toFixed(3);
      powerUnit = 'W';
    } else if (power >= 0.001) {
      powerDisplay = (power * 1000).toFixed(3);
      powerUnit = 'mW';
    } else {
      powerDisplay = (power * 1000000).toFixed(0);
      powerUnit = 'µW';
    }
    
    // Format energy value (show more precision for small values)
    let energyDisplay, energyUnit;
    if (energy >= 1000) {
      energyDisplay = (energy / 1000).toFixed(3);
      energyUnit = 'kWh';
    } else if (energy >= 1) {
      energyDisplay = energy.toFixed(3);
      energyUnit = 'Wh';
    } else if (energy >= 0.001) {
      energyDisplay = (energy * 1000).toFixed(3);
      energyUnit = 'mWh';
    } else if (energy >= 0.000001) {
      energyDisplay = (energy * 1000000).toFixed(3);
      energyUnit = 'µWh';
    } else {
      energyDisplay = '0';
      energyUnit = 'Wh';
    }
    
    // Format CO2 value
    let co2Display, co2Unit;
    if (co2e >= 1000) {
      co2Display = (co2e / 1000).toFixed(2);
      co2Unit = 'kgCO₂e';
    } else if (co2e >= 1) {
      co2Display = co2e.toFixed(1);
      co2Unit = 'gCO₂e';
    } else if (co2e >= 0.001) {
      co2Display = (co2e * 1000).toFixed(1);
      co2Unit = 'mgCO₂e';
    } else if (co2e >= 0.000001) {
      co2Display = (co2e * 1000000).toFixed(0);
      co2Unit = 'µgCO₂e';
    } else {
      co2Display = '0';
      co2Unit = 'gCO₂e';
    }
    
    // Update DOM
    document.getElementById('currentPower').textContent = powerDisplay;
    document.getElementById('currentPowerUnit').textContent = powerUnit;
    document.getElementById('energyUsed').textContent = energyDisplay;
    document.getElementById('energyUnit').textContent = energyUnit;
    document.getElementById('co2Emissions').textContent = co2Display;
    document.getElementById('co2Unit').textContent = co2Unit;
    
    // Debug: Show raw values occasionally
    if (!this.lastDisplayDebug || Date.now() - this.lastDisplayDebug > 5000) {
      console.log('Displaying metrics:', {
        power: power + 'W',
        cumulativeEnergy: energy + 'Wh',
        cumulativeCO2: co2e + 'g',
        powerDisplay: powerDisplay + powerUnit,
        energyDisplay: energyDisplay + energyUnit,
        co2Display: co2Display + co2Unit,
        co2Intensity: this.co2Intensity + 'g/kWh'
      });
      this.lastDisplayDebug = Date.now();
    }
  }

  updateChart(metrics) {
    if (!this.chart) return;
    
    const power = metrics.power || 0;
    
    // Ensure it's a valid number before passing to chart
    const numericPower = Number(power);
    
    if (isNaN(numericPower) || !isFinite(numericPower)) {
      console.warn('Invalid power value for chart:', power);
      // Use fallback value
      this.chart.addDataPoint(this.lastValidMetrics.power || 0);
    } else {
      this.chart.addDataPoint(numericPower);
    }
  }

  displaySummary(summary) {
    if (!summary) return;
    
    // Display summary statistics from service worker
    document.getElementById('sessionDuration').textContent = `${(summary.duration || 0).toFixed(1)}s`;
    document.getElementById('sampleCount').textContent = summary.sampleCount || 0;
    
    const avgPower = summary.avgPower || 0;
    let avgPowerDisplay;
    
    if (avgPower >= 1000) {
      avgPowerDisplay = `${(avgPower / 1000).toFixed(3)} kW`;
    } else if (avgPower >= 1) {
      avgPowerDisplay = `${avgPower.toFixed(3)} W`;
    } else if (avgPower >= 0.001) {
      avgPowerDisplay = `${(avgPower * 1000).toFixed(3)} mW`;
    } else {
      avgPowerDisplay = `${(avgPower * 1000000).toFixed(0)} µW`;
    }
    
    document.getElementById('avgPower').textContent = avgPowerDisplay;
  }

  updateUI() {
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    
    if (startBtn) {
      startBtn.disabled = this.isProfiling || !this.extensionConnected;
    }
    if (stopBtn) {
      stopBtn.disabled = !this.isProfiling || !this.extensionConnected;
    }
  }

  async loadSettings() {
    try {
      const data = await chrome.storage.local.get(['co2Intensity']);
      if (data.co2Intensity !== undefined) {
        const intensity = Number(data.co2Intensity);
        if (!isNaN(intensity) && intensity >= 0 && intensity <= 1000) {
          this.co2Intensity = intensity;
          document.getElementById('co2Intensity').value = intensity;
          console.log('Loaded CO2 intensity:', this.co2Intensity, 'g/kWh');
        } else {
          console.warn('Invalid CO2 intensity in storage:', data.co2Intensity, 'using default 475');
        }
      } else {
        console.log('No CO2 intensity in storage, using default 475 g/kWh');
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  async saveSettings() {
    if (!this.extensionConnected) {
      if (!await this.checkExtensionConnection()) {
        this.showConnectionError();
        return;
      }
    }

    try {
      const co2Intensity = parseFloat(document.getElementById('co2Intensity').value);
      
      // Validate input
      if (isNaN(co2Intensity) || co2Intensity < 0 || co2Intensity > 1000) {
        alert('Please enter a valid CO2 intensity between 0 and 1000 g/kWh');
        return;
      }
      
      // Update local value
      this.co2Intensity = co2Intensity;
      
      // Save to storage
      await chrome.storage.local.set({ co2Intensity });
      
      // Send to service worker
      const response = await this.safeSendMessage({ 
        action: 'setCO2Intensity', 
        intensity: co2Intensity 
      });
      
      if (response && response.success) {
        // Show success feedback
        const saveBtn = document.getElementById('saveSettings');
        const originalText = saveBtn.textContent;
        saveBtn.textContent = 'Saved!';
        saveBtn.style.background = 'rgba(76, 175, 80, 0.3)';
        
        setTimeout(() => {
          saveBtn.textContent = originalText;
          saveBtn.style.background = '';
        }, 1500);
        
        console.log('Updated CO2 intensity to:', this.co2Intensity, 'g/kWh');
        
        // If we're currently profiling, recalculate CO2 with new intensity
        if (this.isProfiling && this.cumulativeEnergy > 0) {
          // Recalculate CO2 with new intensity
          const energyKWh = this.cumulativeEnergy / 1000;
          this.cumulativeCO2 = energyKWh * this.co2Intensity;
          console.log('Recalculated CO2 with new intensity:', this.cumulativeCO2 + 'g');
        }
      } else if (response === null) {
        this.showConnectionError();
      } else {
        console.log('Failed to save settings:', response);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      if (error.message.includes('Extension context invalidated')) {
        this.extensionConnected = false;
        this.showConnectionError();
      }
    }
  }
}

// Initialize the popup controller
document.addEventListener('DOMContentLoaded', () => {
  try {
    new PopupController();
  } catch (error) {
    console.error('Failed to initialize popup:', error);
    
    // Show error to user
    const status = document.getElementById('status');
    if (status) {
      status.textContent = 'Initialization Failed';
      status.style.background = 'rgba(244, 67, 54, 0.3)';
      status.style.color = '#ff8a80';
    }
    
    // Disable all buttons
    const buttons = document.querySelectorAll('button');
    buttons.forEach(btn => btn.disabled = true);
  }
});