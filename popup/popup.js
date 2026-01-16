class PopupController {
  constructor() {
    this.isProfiling = false;
    this.chart = null;
    this.updateInterval = null;
    this.init();
  }

  async init() {
    this.setupEventListeners();
    await this.loadSettings();
    await this.checkProfilingStatus();
    this.updateInterval = setInterval(() => this.updateMetrics(), 1000);
  }

  setupEventListeners() {
    document.getElementById('startBtn').addEventListener('click', () => this.startProfiling());
    document.getElementById('stopBtn').addEventListener('click', () => this.stopProfiling());
    document.getElementById('saveSettings').addEventListener('click', () => this.saveSettings());
    
    // Initialize Chart.js
    this.initChart();
  }

  initChart() {
    const ctx = document.getElementById('powerChart').getContext('2d');
    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: 'Power (W)',
          data: [],
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.1)',
          tension: 0.4,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          x: {
            display: false
          },
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: 'rgba(255, 255, 255, 0.7)'
            }
          }
        }
      }
    });
  }

  async startProfiling() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'startProfiling' });
      if (response.success) {
        this.isProfiling = true;
        this.updateUI();
      }
    } catch (error) {
      console.error('Error starting profiling:', error);
    }
  }

  async stopProfiling() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'stopProfiling' });
      if (response.success) {
        this.isProfiling = false;
        this.updateUI();
        if (response.summary) {
          this.displaySummary(response.summary);
        }
      }
    } catch (error) {
      console.error('Error stopping profiling:', error);
    }
  }

  async updateMetrics() {
    if (!this.isProfiling) return;
    
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getCurrentMetrics' });
      if (response.success && response.metrics) {
        this.displayCurrentMetrics(response.metrics);
        this.updateChart(response.metrics);
      }
    } catch (error) {
      console.error('Error updating metrics:', error);
    }
  }

  async checkProfilingStatus() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getCurrentMetrics' });
      if (response.success) {
        this.isProfiling = response.isProfiling;
        this.updateUI();
      }
    } catch (error) {
      console.error('Error checking status:', error);
    }
  }

  displayCurrentMetrics(metrics) {
    // Format power value
    const power = metrics.power || 0;
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
    
    // Format energy value
    const energy = metrics.energy || 0;
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
    } else {
      energyDisplay = (energy * 1000000).toFixed(0);
      energyUnit = 'µWh';
    }
    
    // Format CO2 value
    const co2e = metrics.co2e || 0;
    let co2Display, co2Unit;
    
    if (co2e >= 1000) {
      co2Display = (co2e / 1000).toFixed(2);
      co2Unit = 'kgCO₂e';
    } else if (co2e >= 1) {
      co2Display = co2e.toFixed(1);
      co2Unit = 'gCO₂e';
    } else {
      co2Display = (co2e * 1000).toFixed(0);
      co2Unit = 'mgCO₂e';
    }
    
    // Update DOM
    document.getElementById('currentPower').textContent = powerDisplay;
    document.getElementById('currentPowerUnit').textContent = powerUnit;
    document.getElementById('energyUsed').textContent = energyDisplay;
    document.getElementById('energyUnit').textContent = energyUnit;
    document.getElementById('co2Emissions').textContent = co2Display;
    document.getElementById('co2Unit').textContent = co2Unit;
    
    // Update status
    document.getElementById('status').textContent = this.isProfiling ? 'Profiling' : 'Idle';
    document.getElementById('status').style.background = this.isProfiling 
      ? 'rgba(76, 175, 80, 0.3)' 
      : 'rgba(255, 255, 255, 0.2)';
  }

  updateChart(metrics) {
    if (!this.chart) return;
    
    const power = metrics.power || 0;
    const timestamp = new Date(metrics.timestamp).toLocaleTimeString([], { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    
    // Add new data point
    this.chart.data.labels.push(timestamp);
    this.chart.data.datasets[0].data.push(power);
    
    // Keep only last 30 points
    if (this.chart.data.labels.length > 30) {
      this.chart.data.labels.shift();
      this.chart.data.datasets[0].data.shift();
    }
    
    this.chart.update('none');
  }

  displaySummary(summary) {
    // Display summary statistics
    if (summary) {
      document.getElementById('sessionDuration').textContent = `${summary.duration.toFixed(1)}s`;
      document.getElementById('sampleCount').textContent = summary.sampleCount;
      
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
  }

  updateUI() {
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    
    startBtn.disabled = this.isProfiling;
    stopBtn.disabled = !this.isProfiling;
  }

  async loadSettings() {
    try {
      const data = await chrome.storage.local.get(['co2Intensity']);
      if (data.co2Intensity) {
        document.getElementById('co2Intensity').value = data.co2Intensity;
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  async saveSettings() {
    try {
      const co2Intensity = parseFloat(document.getElementById('co2Intensity').value);
      await chrome.storage.local.set({ co2Intensity });
      await chrome.runtime.sendMessage({ 
        action: 'setCO2Intensity', 
        intensity: co2Intensity 
      });
      
      // Show success feedback
      const saveBtn = document.getElementById('saveSettings');
      const originalText = saveBtn.textContent;
      saveBtn.textContent = 'Saved!';
      setTimeout(() => {
        saveBtn.textContent = originalText;
      }, 1500);
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }
}

// Initialize the popup controller
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});