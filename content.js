// Content script for Chrome Power Profiler

class PagePowerMonitor {
  constructor() {
    this.metrics = {
      cpu: [],
      memory: [],
      network: [],
      timings: []
    };
    
    this.observers = [];
    this.isConnected = true;
    this.pendingMetrics = [];
    this.maxPendingMetrics = 10;
    this.reconnectionAttempts = 0;
    this.maxReconnectionAttempts = 5;
    this.init();
  }

  init() {
    // Start monitoring regardless of connection status
    this.startMonitoring();
    
    // Check connection and set up message listener
    this.checkConnection().then(isConnected => {
      if (isConnected) {
        console.log('Extension connected, starting metrics collection');
      } else {
        console.log('Extension not connected initially, metrics will be cached');
        this.scheduleReconnection();
      }
    });
    
    // Listen for messages from background
    this.setupMessageListener();
  }

  startMonitoring() {
    try {
      // Monitor resource loading
      this.setupResourceObserver();
      
      // Monitor memory usage
      this.setupMemoryMonitor();
      
      // Monitor CPU usage via requestAnimationFrame
      this.setupCPUMonitor();
      
      // Send periodic updates to background
      this.metricsInterval = setInterval(() => {
        this.collectAndSendMetrics();
      }, 1000);
      
      console.log('Page power monitoring started');
    } catch (error) {
      console.error('Failed to start monitoring:', error);
    }
  }

  setupMessageListener() {
    try {
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        return this.handleMessage(request, sender, sendResponse);
      });
    } catch (error) {
      console.error('Failed to setup message listener:', error);
    }
  }

  stopMonitoring() {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
    
    if (this.memoryInterval) {
      clearInterval(this.memoryInterval);
      this.memoryInterval = null;
    }
    
    this.observers.forEach(observer => {
      try {
        observer.disconnect();
      } catch (e) {
        // Ignore disconnection errors
      }
    });
    this.observers = [];
    
    console.log('Page power monitoring stopped');
  }

  async checkConnection() {
    try {
      // Check if runtime API is available
      if (!chrome.runtime || !chrome.runtime.sendMessage) {
        this.isConnected = false;
        return false;
      }
      
      // Send a ping to verify connection
      const response = await this.sendMessageWithTimeout({ action: 'ping' }, 1000);
      this.isConnected = response !== null;
      
      if (this.isConnected) {
        this.reconnectionAttempts = 0;
        console.log('Extension connection verified');
      }
      
      return this.isConnected;
    } catch (error) {
      console.log('Connection check failed:', error.message);
      this.isConnected = false;
      return false;
    }
  }

  setupResourceObserver() {
    try {
      if (!window.PerformanceObserver) {
        console.log('PerformanceObserver not supported');
        return;
      }
      
      const observer = new PerformanceObserver((list) => {
        try {
          const entries = list.getEntries();
          entries.forEach(entry => {
            this.metrics.network.push({
              name: entry.name,
              type: entry.entryType,
              size: entry.decodedBodySize || entry.transferSize || 0,
              duration: entry.duration,
              startTime: entry.startTime
            });
            
            // Keep network metrics list from growing too large
            if (this.metrics.network.length > 1000) {
              this.metrics.network.shift();
            }
          });
        } catch (error) {
          console.error('Error processing performance entries:', error);
        }
      });
      
      try {
        observer.observe({ entryTypes: ['resource', 'navigation', 'paint'] });
        this.observers.push(observer);
      } catch (error) {
        console.error('Failed to observe performance entries:', error);
        // Try with a safer approach
        try {
          observer.observe({ entryTypes: ['resource'] });
          this.observers.push(observer);
        } catch (e) {
          console.error('Failed to observe even with reduced entry types:', e);
        }
      }
    } catch (error) {
      console.error('Failed to setup resource observer:', error);
    }
  }

  setupMemoryMonitor() {
    try {
      if (performance && performance.memory) {
        this.memoryInterval = setInterval(() => {
          try {
            this.metrics.memory.push({
              timestamp: Date.now(),
              usedJSHeapSize: performance.memory.usedJSHeapSize,
              totalJSHeapSize: performance.memory.totalJSHeapSize
            });
            
            // Keep memory metrics list from growing too large
            if (this.metrics.memory.length > 100) {
              this.metrics.memory.shift();
            }
          } catch (error) {
            console.error('Memory monitoring error:', error);
          }
        }, 5000);
      }
    } catch (error) {
      console.error('Failed to setup memory monitor:', error);
    }
  }

  setupCPUMonitor() {
    try {
      let lastFrameTime = performance.now();
      let frameCount = 0;
      
      const measureCPU = () => {
        try {
          const now = performance.now();
          frameCount++;
          
          if (now - lastFrameTime >= 1000) {
            const fps = frameCount;
            const cpuEstimate = Math.min(100, fps / 60 * 100);
            
            this.metrics.cpu.push({
              timestamp: Date.now(),
              estimate: cpuEstimate,
              fps: fps
            });
            
            // Keep CPU metrics list from growing too large
            if (this.metrics.cpu.length > 100) {
              this.metrics.cpu.shift();
            }
            
            frameCount = 0;
            lastFrameTime = now;
          }
          
          requestAnimationFrame(measureCPU);
        } catch (error) {
          console.error('CPU monitoring error:', error);
          // Try to continue monitoring after error
          setTimeout(() => {
            try {
              requestAnimationFrame(measureCPU);
            } catch (e) {
              console.error('Failed to restart CPU monitoring:', e);
            }
          }, 100);
        }
      };
      
      requestAnimationFrame(measureCPU);
    } catch (error) {
      console.error('Failed to setup CPU monitor:', error);
    }
  }

  collectMetrics() {
    try {
      const cpu = this.getCurrentCPU();
      const memory = this.getCurrentMemory();
      const network = this.getRecentNetwork();
      const timings = this.getPerformanceTimings();
      
      // Calculate power estimate based on CPU and memory
      const powerEstimate = this.calculatePowerEstimate(cpu, memory, network);
      
      const metrics = {
        timestamp: Date.now(),
        cpu: cpu,
        memory: memory,
        network: network.length, // Send count instead of full array
        timings: timings,
        power: powerEstimate, // Add power estimate
        url: window.location.href,
        domain: window.location.hostname
      };
      
      return metrics;
    } catch (error) {
      console.error('Error collecting metrics:', error);
      // Return minimal valid metrics
      return {
        timestamp: Date.now(),
        cpu: 0,
        memory: 0,
        network: 0,
        timings: { loadTime: 0, domReady: 0, interactive: 0 },
        power: 0,
        url: window.location.href || 'unknown',
        domain: window.location.hostname || 'unknown'
      };
    }
  }

  calculatePowerEstimate(cpu, memory, network) {
    try {
      // Base power for idle browser tab (in watts)
      const BASE_POWER = 0.5;
      
      // Power per CPU percentage (scaled estimate)
      const CPU_POWER_FACTOR = 0.02;
      
      // Power per MB of memory
      const MEMORY_POWER_FACTOR = 0.001;
      
      // Power per network request
      const NETWORK_POWER_FACTOR = 0.005;
      
      // Calculate power estimate
      const cpuPower = (cpu || 0) * CPU_POWER_FACTOR;
      const memoryPower = (memory || 0) * MEMORY_POWER_FACTOR;
      const networkPower = (network.length || 0) * NETWORK_POWER_FACTOR;
      
      const totalPower = BASE_POWER + cpuPower + memoryPower + networkPower;
      
      // Return power in watts
      return Math.max(0.1, Math.min(10, totalPower)); // Clamp between 0.1W and 10W
    } catch (error) {
      console.error('Error calculating power estimate:', error);
      return 0.5; // Default power estimate
    }
  }

  async collectAndSendMetrics() {
    try {
      // Collect metrics first
      const metrics = this.collectMetrics();
      
      // Only send if we have valid power data
      if (typeof metrics.power !== 'number' || isNaN(metrics.power) || !isFinite(metrics.power)) {
        console.warn('Invalid power value, skipping send:', metrics.power);
        metrics.power = 0.5; // Set default
      }
      
      if (!this.isConnected) {
        // Cache metrics while disconnected
        this.cacheMetrics(metrics);
        return;
      }
      
      // Send metrics
      await this.sendMetrics(metrics);
      
    } catch (error) {
      console.error('Error in collectAndSendMetrics:', error);
      // Don't cache failed collections
    }
  }

  async sendMetrics(metrics) {
    try {
      const response = await this.sendMessageWithTimeout({
        action: 'updatePageMetrics',
        metrics: metrics
      }, 2000);
      
      if (response === null) {
        this.isConnected = false;
        this.cacheMetrics(metrics);
        this.scheduleReconnection();
        return false;
      }
      
      // If we successfully sent and have pending metrics, flush them
      if (response && response.success && this.pendingMetrics.length > 0) {
        await this.flushPendingMetrics();
      }
      
      return true;
    } catch (error) {
      console.error('Send metrics error:', error.message);
      
      if (error.message.includes('Extension context invalidated') ||
          error.message.includes('Could not establish connection') ||
          error.message.includes('The message port closed')) {
        this.isConnected = false;
        this.cacheMetrics(metrics);
        this.scheduleReconnection();
      }
      
      return false;
    }
  }

  sendMessageWithTimeout(message, timeout = 3000) {
    return new Promise((resolve) => {
      if (!this.isConnected) {
        resolve(null);
        return;
      }
      
      const timeoutId = setTimeout(() => {
        console.log('Message timeout:', message.action);
        resolve(null);
      }, timeout);
      
      try {
        // Check if runtime API is still available
        if (!chrome.runtime || !chrome.runtime.sendMessage) {
          clearTimeout(timeoutId);
          this.isConnected = false;
          resolve(null);
          return;
        }
        
        chrome.runtime.sendMessage(message, (response) => {
          clearTimeout(timeoutId);
          
          if (chrome.runtime.lastError) {
            const error = chrome.runtime.lastError;
            console.log('Runtime error for', message.action, ':', error.message);
            
            if (error.message.includes('Extension context invalidated') ||
                error.message.includes('Could not establish connection') ||
                error.message.includes('The message port closed')) {
              this.isConnected = false;
            }
            resolve(null);
          } else {
            resolve(response);
          }
        });
      } catch (error) {
        clearTimeout(timeoutId);
        console.log('Send message error:', error.message);
        
        if (error.message.includes('Extension context invalidated')) {
          this.isConnected = false;
        }
        resolve(null);
      }
    });
  }

  cacheMetrics(metrics) {
    try {
      this.pendingMetrics.push(metrics);
      
      // Keep only recent metrics
      if (this.pendingMetrics.length > this.maxPendingMetrics) {
        this.pendingMetrics.shift();
      }
      
      if (this.pendingMetrics.length % 10 === 0) {
        console.log(`Cached metrics (${this.pendingMetrics.length} pending)`);
      }
    } catch (error) {
      console.error('Error caching metrics:', error);
    }
  }

  async flushPendingMetrics() {
    if (!this.isConnected || this.pendingMetrics.length === 0) {
      return;
    }
    
    console.log(`Flushing ${this.pendingMetrics.length} pending metrics`);
    
    const metricsToSend = [...this.pendingMetrics];
    this.pendingMetrics = [];
    
    let successCount = 0;
    for (const metric of metricsToSend) {
      try {
        const success = await this.sendMetrics(metric);
        if (success) {
          successCount++;
        } else {
          // If send fails, stop and cache the rest
          this.pendingMetrics.push(...metricsToSend.slice(metricsToSend.indexOf(metric)));
          break;
        }
        // Small delay between sends to avoid overwhelming
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (error) {
        console.error('Error flushing metric:', error);
        this.pendingMetrics.push(...metricsToSend.slice(metricsToSend.indexOf(metric)));
        break;
      }
    }
    
    console.log(`Successfully flushed ${successCount} metrics`);
  }

  scheduleReconnection() {
    if (this.reconnectionAttempts >= this.maxReconnectionAttempts) {
      console.log('Max reconnection attempts reached');
      return;
    }
    
    this.reconnectionAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectionAttempts), 30000);
    
    console.log(`Scheduling reconnection attempt ${this.reconnectionAttempts} in ${delay}ms`);
    
    setTimeout(async () => {
      const connected = await this.checkConnection();
      if (connected) {
        console.log('Reconnected to extension');
        // Send any pending metrics
        await this.flushPendingMetrics();
      } else {
        this.scheduleReconnection();
      }
    }, delay);
  }

  getCurrentCPU() {
    try {
      if (this.metrics.cpu.length === 0) return 0;
      const lastCPU = this.metrics.cpu[this.metrics.cpu.length - 1];
      return lastCPU.estimate || 0;
    } catch (error) {
      return 0;
    }
  }

  getCurrentMemory() {
    try {
      if (this.metrics.memory.length === 0) return 0;
      const last = this.metrics.memory[this.metrics.memory.length - 1];
      return (last.usedJSHeapSize || 0) / 1024 / 1024;
    } catch (error) {
      return 0;
    }
  }

  getRecentNetwork() {
    try {
      const oneMinuteAgo = Date.now() - 60000;
      return this.metrics.network.filter(m => m.startTime > oneMinuteAgo);
    } catch (error) {
      return [];
    }
  }

  getPerformanceTimings() {
    try {
      const timing = performance.timing;
      return {
        loadTime: timing.loadEventEnd - timing.navigationStart,
        domReady: timing.domContentLoadedEventEnd - timing.navigationStart,
        interactive: timing.domInteractive - timing.navigationStart
      };
    } catch (error) {
      return {
        loadTime: 0,
        domReady: 0,
        interactive: 0
      };
    }
  }

  handleMessage(request, sender, sendResponse) {
    try {
      if (request.action === 'getPageMetrics') {
        const metrics = this.collectMetrics();
        sendResponse({
          success: this.isConnected,
          metrics: metrics,
          isConnected: this.isConnected
        });
        return true;
      }
      
      if (request.action === 'ping') {
        sendResponse({ alive: true });
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ success: false, error: error.message });
      return false;
    }
  }
}

// Initialize the page monitor with error handling
let pageMonitor = null;

try {
  pageMonitor = new PagePowerMonitor();
  
  // Clean up on page unload
  window.addEventListener('beforeunload', () => {
    if (pageMonitor) {
      pageMonitor.stopMonitoring();
    }
  });
  
  // Expose API to the page (optional, with safety checks)
  Object.defineProperty(window, '__chromePowerProfiler', {
    value: {
      getMetrics: () => pageMonitor ? pageMonitor.collectMetrics() : null,
      startProfiling: () => pageMonitor ? pageMonitor.startMonitoring() : false,
      stopProfiling: () => pageMonitor ? pageMonitor.stopMonitoring() : false,
      isConnected: () => pageMonitor ? pageMonitor.isConnected : false
    },
    writable: false,
    configurable: true
  });
  
  console.log('Chrome Power Profiler content script loaded successfully');
} catch (error) {
  console.error('Failed to initialize Chrome Power Profiler:', error);
  
  // Still expose a minimal API even if initialization fails
  Object.defineProperty(window, '__chromePowerProfiler', {
    value: {
      getMetrics: () => ({ error: 'Monitor not initialized' }),
      startProfiling: () => false,
      stopProfiling: () => false,
      isConnected: () => false
    },
    writable: false,
    configurable: true
  });
}