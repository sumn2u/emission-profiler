// Service worker for Chrome Power Profiler

class PowerProfiler {
  constructor() {
    this.samples = [];
    this.startTime = Date.now();
    this.isProfiling = false;
    this.sampleInterval = null;
    this.co2Intensity = 475; // Default: world average gCO2e/kWh
    this.metricsHistory = [];
    this.maxHistorySize = 1000;
    this.pageMetrics = new Map(); // Store metrics from content scripts
  }

  async startProfiling() {
    if (this.isProfiling) return;
    
    this.isProfiling = true;
    this.startTime = Date.now();
    this.samples = [];
    
    this.sampleInterval = setInterval(async () => {
      await this.collectSample();
    }, 1000); // Sample every second
    
    console.log('Power profiling started');
  }

  stopProfiling() {
    if (!this.isProfiling) return;
    
    this.isProfiling = false;
    if (this.sampleInterval) {
      clearInterval(this.sampleInterval);
      this.sampleInterval = null;
    }
    
    console.log('Power profiling stopped');
    return this.getSummary();
  }

  async collectSample() {
    try {
      // Get aggregated metrics from all active tabs
      const aggregatedMetrics = this.aggregatePageMetrics();
      const powerEstimate = this.estimatePower(aggregatedMetrics);
      
      // Validate power estimate
      const validatedPower = this.validatePower(powerEstimate);
      
      const sample = {
        timestamp: Date.now(),
        power: validatedPower,
        metrics: aggregatedMetrics,
        energy: validatedPower / 3600, // Convert W to Wh for 1-second sample
        co2e: this.calculateCO2e(validatedPower / 3600)
      };
      
      this.samples.push(sample);
      this.addToHistory(sample);
      
      // Keep only last hour of samples (3600 seconds)
      if (this.samples.length > 3600) {
        this.samples.shift();
      }
      
      return sample;
    } catch (error) {
      console.error('Error collecting sample:', error);
      
      // Return a default valid sample on error
      const defaultSample = {
        timestamp: Date.now(),
        power: 0.5,
        metrics: {},
        energy: 0.5 / 3600,
        co2e: this.calculateCO2e(0.5 / 3600)
      };
      
      this.samples.push(defaultSample);
      return defaultSample;
    }
  }

  aggregatePageMetrics() {
    const aggregated = {
      cpuTotal: 0,
      memoryTotal: 0,
      networkTotal: 0,
      tabCount: this.pageMetrics.size,
      tabs: []
    };
    
    // Aggregate metrics from all tabs
    for (const [tabId, metrics] of this.pageMetrics) {
      aggregated.cpuTotal += metrics.cpu || 0;
      aggregated.memoryTotal += metrics.memory || 0;
      aggregated.networkTotal += metrics.network || 0;
      
      aggregated.tabs.push({
        tabId,
        cpu: metrics.cpu || 0,
        memory: metrics.memory || 0,
        network: metrics.network || 0,
        url: metrics.url || 'unknown',
        domain: metrics.domain || 'unknown'
      });
    }
    
    return aggregated;
  }

  updatePageMetrics(tabId, metrics) {
    // Validate incoming metrics
    const validatedMetrics = {
      timestamp: Date.now(),
      cpu: this.validateNumber(metrics.cpu, 0, 100),
      memory: this.validateNumber(metrics.memory, 0, 10000),
      network: this.validateNumber(metrics.network, 0, 1000),
      power: this.validateNumber(metrics.power, 0, 100),
      url: metrics.url || 'unknown',
      domain: metrics.domain || 'unknown'
    };
    
    this.pageMetrics.set(tabId, validatedMetrics);
    
    // Clean up old entries (older than 5 seconds)
    for (const [id, tabMetrics] of this.pageMetrics) {
      if (Date.now() - tabMetrics.timestamp > 5000) {
        this.pageMetrics.delete(id);
      }
    }
  }

  validateNumber(value, min, max) {
    const num = Number(value);
    if (isNaN(num) || !isFinite(num)) {
      return min;
    }
    return Math.max(min, Math.min(max, num));
  }

  validatePower(power) {
    const num = Number(power);
    if (isNaN(num) || !isFinite(num)) {
      console.warn('Invalid power value received, defaulting to 0.5W');
      return 0.5;
    }
    
    // Clamp between 0.1W and 100W (reasonable range for browser tabs)
    return Math.max(0.1, Math.min(100, num));
  }

  estimatePower(metrics) {
    try {
      // Enhanced power estimation model based on aggregated metrics
      let totalPower = 0;
      
      // Base power per tab (idle)
      const basePowerPerTab = 0.3; // 0.3W per idle tab
      totalPower += basePowerPerTab * Math.max(1, metrics.tabCount);
      
      // CPU power (proportional to CPU usage)
      // Assuming 2W at 100% CPU utilization per core
      const cpuPowerFactor = 0.02; // 0.02W per 1% CPU
      totalPower += metrics.cpuTotal * cpuPowerFactor;
      
      // Memory power (DRAM power)
      // Roughly 0.001W per MB
      const memoryPowerFactor = 0.001;
      totalPower += metrics.memoryTotal * memoryPowerFactor;
      
      // Network power (radio/interface power)
      const networkPowerFactor = 0.001;
      totalPower += metrics.networkTotal * networkPowerFactor;
      
      // Add power for active tab (if we have any tabs)
      if (metrics.tabs.length > 0) {
        const activeTabBoost = 0.1; // Extra power for user interaction
        totalPower += activeTabBoost;
      }
      
      return this.validatePower(totalPower);
    } catch (error) {
      console.error('Error estimating power:', error);
      return 0.5; // Default fallback
    }
  }

  calculateCO2e(energyWh) {
    try {
      // Convert Wh to kWh and multiply by carbon intensity
      const energyKWh = energyWh / 1000;
      const co2 = energyKWh * this.co2Intensity;
      
      // Validate result
      if (isNaN(co2) || !isFinite(co2) || co2 < 0) {
        return 0;
      }
      
      return co2;
    } catch (error) {
      console.error('Error calculating CO2e:', error);
      return 0;
    }
  }

  addToHistory(sample) {
    // Validate sample before adding to history
    const validatedSample = {
      timestamp: sample.timestamp,
      power: this.validatePower(sample.power),
      energy: this.validateNumber(sample.energy, 0, 100),
      co2e: this.validateNumber(sample.co2e, 0, 1000),
      metrics: sample.metrics || {}
    };
    
    this.metricsHistory.push(validatedSample);
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory.shift();
    }
  }

  getCurrentMetrics() {
    if (this.samples.length === 0) {
      // Return default metrics if no samples yet
      return {
        timestamp: Date.now(),
        power: 0,
        energy: 0,
        co2e: 0,
        metrics: {}
      };
    }
    
    const latestSample = this.samples[this.samples.length - 1];
    
    // Validate the latest sample
    return {
      timestamp: latestSample.timestamp || Date.now(),
      power: this.validatePower(latestSample.power),
      energy: this.validateNumber(latestSample.energy, 0, 100),
      co2e: this.validateNumber(latestSample.co2e, 0, 1000),
      metrics: latestSample.metrics || {}
    };
  }

  getSummary() {
    if (this.samples.length === 0) {
      return {
        totalEnergy: 0,
        totalCO2e: 0,
        avgPower: 0,
        duration: 0,
        sampleCount: 0,
        samples: []
      };
    }
    
    // Filter out any invalid samples
    const validSamples = this.samples.filter(sample => 
      this.validatePower(sample.power) > 0 &&
      !isNaN(sample.energy) &&
      !isNaN(sample.co2e)
    );
    
    if (validSamples.length === 0) {
      return {
        totalEnergy: 0,
        totalCO2e: 0,
        avgPower: 0,
        duration: 0,
        sampleCount: 0,
        samples: []
      };
    }
    
    const totalEnergy = validSamples.reduce((sum, sample) => {
      const energy = this.validateNumber(sample.energy, 0, 100);
      return sum + energy;
    }, 0);
    
    const totalCO2e = validSamples.reduce((sum, sample) => {
      const co2 = this.validateNumber(sample.co2e, 0, 1000);
      return sum + co2;
    }, 0);
    
    const avgPower = validSamples.length > 0 ? 
      totalEnergy / (validSamples.length / 3600) : 0;
    
    const duration = validSamples.length > 0 ? 
      (validSamples[validSamples.length - 1].timestamp - validSamples[0].timestamp) / 1000 :
      0;
    
    return {
      totalEnergy,
      totalCO2e,
      avgPower: this.validatePower(avgPower),
      duration,
      sampleCount: validSamples.length,
      samples: validSamples
    };
  }

  getRangeSummary(startTime, endTime) {
    const rangeSamples = this.samples.filter(sample => 
      sample.timestamp >= startTime && 
      sample.timestamp <= endTime &&
      this.validatePower(sample.power) > 0
    );
    
    if (rangeSamples.length === 0) {
      return {
        totalEnergy: 0,
        totalCO2e: 0,
        avgPower: 0,
        rangeDuration: (endTime - startTime) / 1000,
        sampleCount: 0
      };
    }
    
    const totalEnergy = rangeSamples.reduce((sum, sample) => {
      const energy = this.validateNumber(sample.energy, 0, 100);
      return sum + energy;
    }, 0);
    
    const totalCO2e = rangeSamples.reduce((sum, sample) => {
      const co2 = this.validateNumber(sample.co2e, 0, 1000);
      return sum + co2;
    }, 0);
    
    const rangeDuration = (endTime - startTime) / 1000;
    const avgPower = rangeDuration > 0 ? 
      totalEnergy / (rangeDuration / 3600) : 0;
    
    return {
      totalEnergy,
      totalCO2e,
      avgPower: this.validatePower(avgPower),
      rangeDuration,
      sampleCount: rangeSamples.length
    };
  }

  formatPowerValue(power) {
    const validatedPower = this.validatePower(power);
    
    if (validatedPower >= 1000) {
      return { value: validatedPower / 1000, unit: 'kW', precision: 3 };
    } else if (validatedPower >= 1) {
      return { value: validatedPower, unit: 'W', precision: 3 };
    } else if (validatedPower >= 0.001) {
      return { value: validatedPower * 1000, unit: 'mW', precision: 3 };
    } else {
      return { value: validatedPower * 1000000, unit: 'µW', precision: 0 };
    }
  }

  formatEnergyValue(energy) {
    const validatedEnergy = this.validateNumber(energy, 0, 1000000);
    
    if (validatedEnergy >= 1000) {
      return { value: validatedEnergy / 1000, unit: 'kWh', precision: 3 };
    } else if (validatedEnergy >= 1) {
      return { value: validatedEnergy, unit: 'Wh', precision: 3 };
    } else if (validatedEnergy >= 0.001) {
      return { value: validatedEnergy * 1000, unit: 'mWh', precision: 3 };
    } else {
      return { value: validatedEnergy * 1000000, unit: 'µWh', precision: 0 };
    }
  }

  formatCO2Value(co2) {
    const validatedCO2 = this.validateNumber(co2, 0, 1000000);
    
    if (validatedCO2 >= 1000) {
      return { value: validatedCO2 / 1000, unit: 'kgCO₂e', precision: 2 };
    } else if (validatedCO2 >= 1) {
      return { value: validatedCO2, unit: 'gCO₂e', precision: 1 };
    } else {
      return { value: validatedCO2 * 1000, unit: 'mgCO₂e', precision: 0 };
    }
  }
}

// Initialize the profiler
const profiler = new PowerProfiler();

// Message handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
    switch (request.action) {
      case 'startProfiling':
        profiler.startProfiling();
        sendResponse({ success: true });
        break;
        
      case 'stopProfiling':
        const summary = profiler.stopProfiling();
        sendResponse({ success: true, summary });
        break;
        
      case 'getCurrentMetrics':
        const currentMetrics = profiler.getCurrentMetrics();
        sendResponse({ 
          success: true, 
          metrics: currentMetrics,
          isProfiling: profiler.isProfiling
        });
        break;
        
      case 'getRangeSummary':
        const rangeSummary = profiler.getRangeSummary(request.startTime, request.endTime);
        sendResponse({ success: true, summary: rangeSummary });
        break;
        
      case 'getFullSummary':
        const fullSummary = profiler.getSummary();
        sendResponse({ success: true, summary: fullSummary });
        break;
        
      case 'setCO2Intensity':
        if (request.intensity !== undefined) {
          const intensity = Number(request.intensity);
          if (!isNaN(intensity) && isFinite(intensity) && intensity >= 0 && intensity <= 1000) {
            profiler.co2Intensity = intensity;
            sendResponse({ success: true });
          } else {
            sendResponse({ success: false, error: 'Invalid intensity value' });
          }
        }
        break;
        
      case 'updatePageMetrics':
        if (sender && sender.tab && request.metrics) {
          profiler.updatePageMetrics(sender.tab.id, request.metrics);
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: 'Invalid metrics or sender' });
        }
        break;
        
      case 'ping':
        sendResponse({ alive: true, timestamp: Date.now() });
        break;
        
      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
  } catch (error) {
    console.error('Error handling message:', error);
    sendResponse({ 
      success: false, 
      error: error.message,
      timestamp: Date.now()
    });
  }
  
  return true; // Keep message channel open for async response
});

// Clean up when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  profiler.pageMetrics.delete(tabId);
});

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading') {
    // Clear metrics when tab starts loading
    profiler.pageMetrics.delete(tabId);
  }
});