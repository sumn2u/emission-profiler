
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
      const metrics = await this.collectMetrics();
      const powerEstimate = this.estimatePower(metrics);
      const sample = {
        timestamp: Date.now(),
        power: powerEstimate,
        metrics: metrics,
        energy: powerEstimate / 3600, // Convert W to Wh for 1-second sample
        co2e: this.calculateCO2e(powerEstimate / 3600)
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
      return null;
    }
  }

  async collectMetrics() {
    const metrics = {};
    
    // CPU metrics
    if (chrome.system && chrome.system.cpu) {
      const cpuInfo = await new Promise(resolve => {
        chrome.system.cpu.getInfo(resolve);
      });
      metrics.cpu = cpuInfo;
    }
    
    // Memory metrics
    if (chrome.system && chrome.system.memory) {
      const memoryInfo = await new Promise(resolve => {
        chrome.system.memory.getInfo(resolve);
      });
      metrics.memory = memoryInfo;
    }
    
    // Performance metrics
    if (performance && performance.memory) {
      metrics.jsMemory = {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize
      };
    }
    
    // Navigation timing
    const perfEntries = performance.getEntriesByType('navigation');
    if (perfEntries.length > 0) {
      metrics.navigation = perfEntries[0];
    }
    
    // Resource timing
    metrics.resources = performance.getEntriesByType('resource');
    
    return metrics;
  }

  estimatePower(metrics) {
    // Heuristic power estimation model
    // These are example coefficients - would need calibration
    let totalPower = 0;
    
    // Base power (idle)
    totalPower += 1.0; // 1W base
    
    // CPU power estimation
    if (metrics.cpu && metrics.cpu.processors) {
      metrics.cpu.processors.forEach(processor => {
        const cpuUsage = processor.usage;
        totalPower += cpuUsage * 2.0; // 2W per 100% CPU
      });
    }
    
    // Memory power estimation
    if (metrics.jsMemory) {
      const memoryUsage = metrics.jsMemory.usedJSHeapSize / 1024 / 1024; // MB
      totalPower += memoryUsage * 0.01; // 0.01W per MB
    }
    
    // Network activity power
    if (metrics.resources && metrics.resources.length > 0) {
      totalPower += metrics.resources.length * 0.05; // 0.05W per resource
    }
    
    return totalPower;
  }

  calculateCO2e(energyWh) {
    // Convert Wh to kWh and multiply by carbon intensity
    const energyKWh = energyWh / 1000;
    return energyKWh * this.co2Intensity;
  }

  addToHistory(sample) {
    this.metricsHistory.push(sample);
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory.shift();
    }
  }

  getSummary() {
    if (this.samples.length === 0) return null;
    
    const totalEnergy = this.samples.reduce((sum, sample) => sum + sample.energy, 0);
    const totalCO2e = this.samples.reduce((sum, sample) => sum + sample.co2e, 0);
    const avgPower = totalEnergy / (this.samples.length / 3600);
    const duration = (Date.now() - this.startTime) / 1000;
    
    return {
      totalEnergy, // Wh
      totalCO2e,   // gCO2e
      avgPower,    // W
      duration,    // seconds
      sampleCount: this.samples.length,
      samples: this.samples
    };
  }

  getRangeSummary(startTime, endTime) {
    const rangeSamples = this.samples.filter(sample => 
      sample.timestamp >= startTime && sample.timestamp <= endTime
    );
    
    if (rangeSamples.length === 0) return null;
    
    const totalEnergy = rangeSamples.reduce((sum, sample) => sum + sample.energy, 0);
    const totalCO2e = rangeSamples.reduce((sum, sample) => sum + sample.co2e, 0);
    const rangeDuration = (endTime - startTime) / 1000;
    const avgPower = totalEnergy / (rangeDuration / 3600);
    
    return {
      totalEnergy,
      totalCO2e,
      avgPower,
      rangeDuration,
      sampleCount: rangeSamples.length
    };
  }

  formatPowerValue(power) {
    if (power >= 1000) {
      return { value: power / 1000, unit: 'kW', precision: 3 };
    } else if (power >= 1) {
      return { value: power, unit: 'W', precision: 3 };
    } else if (power >= 0.001) {
      return { value: power * 1000, unit: 'mW', precision: 3 };
    } else {
      return { value: power * 1000000, unit: 'µW', precision: 0 };
    }
  }

  formatEnergyValue(energy) {
    if (energy >= 1000) {
      return { value: energy / 1000, unit: 'kWh', precision: 3 };
    } else if (energy >= 1) {
      return { value: energy, unit: 'Wh', precision: 3 };
    } else if (energy >= 0.001) {
      return { value: energy * 1000, unit: 'mWh', precision: 3 };
    } else {
      return { value: energy * 1000000, unit: 'µWh', precision: 0 };
    }
  }

  formatCO2Value(co2) {
    if (co2 >= 1000) {
      return { value: co2 / 1000, unit: 'kgCO₂e', precision: 2 };
    } else if (co2 >= 1) {
      return { value: co2, unit: 'gCO₂e', precision: 1 };
    } else {
      return { value: co2 * 1000, unit: 'mgCO₂e', precision: 0 };
    }
  }
}

// Initialize the profiler
const profiler = new PowerProfiler();

// Message handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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
      const currentSample = profiler.samples[profiler.samples.length - 1];
      sendResponse({ 
        success: true, 
        metrics: currentSample,
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
      if (request.intensity) {
        profiler.co2Intensity = request.intensity;
        sendResponse({ success: true });
      }
      break;
      
    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }
  
  return true; // Keep message channel open for async response
});