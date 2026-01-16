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
    this.init();
  }

  init() {
    // Monitor resource loading
    this.setupResourceObserver();
    
    // Monitor memory usage
    this.setupMemoryMonitor();
    
    // Monitor CPU usage via requestAnimationFrame
    this.setupCPUMonitor();
    
    // Listen for messages from background
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
    
    // Send periodic updates to background
    setInterval(() => {
      this.collectMetrics();
    }, 1000);
  }

  setupResourceObserver() {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach(entry => {
        this.metrics.network.push({
          name: entry.name,
          type: entry.entryType,
          size: entry.decodedBodySize || entry.transferSize || 0,
          duration: entry.duration,
          startTime: entry.startTime
        });
      });
    });
    
    observer.observe({ entryTypes: ['resource', 'navigation', 'paint'] });
    this.observers.push(observer);
  }

  setupMemoryMonitor() {
    if (performance.memory) {
      setInterval(() => {
        this.metrics.memory.push({
          timestamp: Date.now(),
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize
        });
      }, 5000);
    }
  }

  setupCPUMonitor() {
    let lastFrameTime = performance.now();
    let frameCount = 0;
    
    const measureCPU = () => {
      const now = performance.now();
      frameCount++;
      
      if (now - lastFrameTime >= 1000) {
        const fps = frameCount;
        const cpuEstimate = Math.min(100, fps / 60 * 100); // Estimate CPU usage from FPS
        
        this.metrics.cpu.push({
          timestamp: Date.now(),
          estimate: cpuEstimate,
          fps: fps
        });
        
        frameCount = 0;
        lastFrameTime = now;
      }
      
      requestAnimationFrame(measureCPU);
    };
    
    requestAnimationFrame(measureCPU);
  }

  collectMetrics() {
    const metrics = {
      timestamp: Date.now(),
      cpu: this.getCurrentCPU(),
      memory: this.getCurrentMemory(),
      network: this.getRecentNetwork(),
      timings: this.getPerformanceTimings()
    };
    
    // Send to background script
    chrome.runtime.sendMessage({
      action: 'updatePageMetrics',
      metrics: metrics
    });
    
    return metrics;
  }

  getCurrentCPU() {
    if (this.metrics.cpu.length === 0) return 0;
    return this.metrics.cpu[this.metrics.cpu.length - 1].estimate;
  }

  getCurrentMemory() {
    if (this.metrics.memory.length === 0) return 0;
    const last = this.metrics.memory[this.metrics.memory.length - 1];
    return last.usedJSHeapSize / 1024 / 1024; // Convert to MB
  }

  getRecentNetwork() {
    const oneMinuteAgo = Date.now() - 60000;
    return this.metrics.network.filter(m => m.startTime > oneMinuteAgo);
  }

  getPerformanceTimings() {
    const timing = performance.timing;
    return {
      loadTime: timing.loadEventEnd - timing.navigationStart,
      domReady: timing.domContentLoadedEventEnd - timing.navigationStart,
      interactive: timing.domInteractive - timing.navigationStart
    };
  }

  handleMessage(request, sender, sendResponse) {
    if (request.action === 'getPageMetrics') {
      sendResponse({
        success: true,
        metrics: this.collectMetrics()
      });
    }
  }
}

// Initialize the page monitor
const pageMonitor = new PagePowerMonitor();

// Expose API to the page (optional)
window.__chromePowerProfiler = {
  getMetrics: () => pageMonitor.collectMetrics(),
  startProfiling: () => chrome.runtime.sendMessage({ action: 'startProfiling' }),
  stopProfiling: () => chrome.runtime.sendMessage({ action: 'stopProfiling' })
};