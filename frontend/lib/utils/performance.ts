// Performance monitoring utilities for frontend
import { useEffect } from 'react';

export interface PerformanceMetrics {
  timestamp: number;
  duration: number;
  endpoint?: string;
  operation: string;
  success: boolean;
  errorType?: string;
  userAgent?: string;
  connectionType?: string;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private observers: PerformanceObserver[] = [];

  constructor() {
    this.initializeObservers();
  }

  private initializeObservers() {
    // Observe navigation timing
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      const navObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.entryType === 'navigation') {
            this.recordNavigation(entry as PerformanceNavigationTiming);
          }
        });
      });

      try {
        navObserver.observe({ entryTypes: ['navigation'] });
        this.observers.push(navObserver);
      } catch (e) {
        console.warn('Navigation timing not supported');
      }

      // Observe resource loading
      const resourceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.entryType === 'resource') {
            this.recordResource(entry as PerformanceResourceTiming);
          }
        });
      });

      try {
        resourceObserver.observe({ entryTypes: ['resource'] });
        this.observers.push(resourceObserver);
      } catch (e) {
        console.warn('Resource timing not supported');
      }

      // Observe long tasks
      const longTaskObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          this.recordLongTask(entry);
        });
      });

      try {
        longTaskObserver.observe({ entryTypes: ['longtask'] });
        this.observers.push(longTaskObserver);
      } catch (e) {
        console.warn('Long task timing not supported');
      }
    }
  }

  private recordNavigation(entry: PerformanceNavigationTiming) {
    const metric: PerformanceMetrics = {
      timestamp: Date.now(),
      duration: entry.loadEventEnd - entry.fetchStart,
      operation: 'page_load',
      success: true
    };

    this.metrics.push(metric);
    this.sendMetricIfNeeded(metric);
  }

  private recordResource(entry: PerformanceResourceTiming) {
    // Only track API calls and critical resources
    if (entry.name.includes('/api/') || 
        entry.name.includes('.js') || 
        entry.name.includes('.css')) {
      
      const metric: PerformanceMetrics = {
        timestamp: Date.now(),
        duration: entry.responseEnd - entry.requestStart,
        endpoint: entry.name,
        operation: 'resource_load',
        success: entry.responseEnd > 0
      };

      this.metrics.push(metric);
    }
  }

  private recordLongTask(entry: PerformanceEntry) {
    const metric: PerformanceMetrics = {
      timestamp: Date.now(),
      duration: entry.duration,
      operation: 'long_task',
      success: false // Long tasks are performance issues
    };

    this.metrics.push(metric);
    
    // Log warning for long tasks in development
    if (process.env.NODE_ENV === 'development') {
      console.warn(`Long task detected: ${entry.duration}ms`);
    }
  }

  // Manually record API call performance
  recordApiCall(endpoint: string, duration: number, success: boolean, errorType?: string) {
    const metric: PerformanceMetrics = {
      timestamp: Date.now(),
      duration,
      endpoint,
      operation: 'api_call',
      success,
      errorType
    };

    this.metrics.push(metric);
    this.sendMetricIfNeeded(metric);
  }

  // Record component render performance
  recordComponentRender(componentName: string, duration: number) {
    const metric: PerformanceMetrics = {
      timestamp: Date.now(),
      duration,
      operation: `component_render_${componentName}`,
      success: true
    };

    this.metrics.push(metric);
  }

  private sendMetricIfNeeded(metric: PerformanceMetrics) {
    // Send critical metrics immediately
    if (!metric.success || 
        metric.duration > 3000 || 
        metric.operation === 'long_task') {
      this.sendMetrics([metric]);
    }
  }

  // Send metrics to backend (batched)
  private async sendMetrics(metrics: PerformanceMetrics[]) {
    if (typeof window === 'undefined' || metrics.length === 0) return;

    try {
      // Only send in production or if explicitly enabled
      if (process.env.NODE_ENV === 'production' || 
          process.env.NEXT_PUBLIC_ENABLE_METRICS === 'true') {
        
        const payload = {
          metrics,
          session: this.getSessionId(),
          timestamp: Date.now(),
          userAgent: navigator.userAgent,
          connectionType: this.getConnectionType()
        };

        // Use beacon API for reliable delivery
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/v1/metrics', JSON.stringify(payload));
        } else {
          // Fallback to fetch
          fetch('/api/v1/metrics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            keepalive: true
          }).catch(() => {
            // Ignore errors for metrics
          });
        }
      }
    } catch (error) {
      // Ignore errors for metrics collection
      console.debug('Failed to send metrics:', error);
    }
  }

  private getSessionId(): string {
    if (typeof window === 'undefined') return 'unknown';
    
    let sessionId = sessionStorage.getItem('performance_session_id');
    if (!sessionId) {
      sessionId = Math.random().toString(36).substring(2, 15);
      sessionStorage.setItem('performance_session_id', sessionId);
    }
    return sessionId;
  }

  private getConnectionType(): string {
    if (typeof window === 'undefined') return 'unknown';
    
    const connection = (navigator as any).connection || 
                      (navigator as any).mozConnection || 
                      (navigator as any).webkitConnection;
    
    return connection?.effectiveType || 'unknown';
  }

  // Get performance summary
  getSummary() {
    const now = Date.now();
    const last5Minutes = this.metrics.filter(m => now - m.timestamp < 5 * 60 * 1000);
    
    return {
      totalMetrics: this.metrics.length,
      recentMetrics: last5Minutes.length,
      averageApiTime: this.getAverageApiTime(last5Minutes),
      errorRate: this.getErrorRate(last5Minutes),
      longTasks: last5Minutes.filter(m => m.operation === 'long_task').length
    };
  }

  private getAverageApiTime(metrics: PerformanceMetrics[]): number {
    const apiCalls = metrics.filter(m => m.operation === 'api_call');
    if (apiCalls.length === 0) return 0;
    
    const total = apiCalls.reduce((sum, m) => sum + m.duration, 0);
    return Math.round(total / apiCalls.length);
  }

  private getErrorRate(metrics: PerformanceMetrics[]): number {
    if (metrics.length === 0) return 0;
    
    const errors = metrics.filter(m => !m.success).length;
    return Math.round((errors / metrics.length) * 100);
  }

  // Cleanup
  destroy() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    this.metrics = [];
  }

  // Flush remaining metrics
  flush() {
    if (this.metrics.length > 0) {
      this.sendMetrics([...this.metrics]);
      this.metrics = [];
    }
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

// React hook for component performance
export function usePerformanceMonitor(componentName: string) {
  const startTime = Date.now();

  useEffect(() => {
    return () => {
      const duration = Date.now() - startTime;
      performanceMonitor.recordComponentRender(componentName, duration);
    };
  }, [componentName, startTime]);
}

// API call wrapper with performance tracking
export async function trackApiCall<T>(
  endpoint: string,
  apiCall: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  
  try {
    const result = await apiCall();
    const duration = Date.now() - startTime;
    
    performanceMonitor.recordApiCall(endpoint, duration, true);
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorType = error instanceof Error ? error.name : 'UnknownError';
    
    performanceMonitor.recordApiCall(endpoint, duration, false, errorType);
    throw error;
  }
}

// Web Vitals integration
export function measureWebVitals() {
  if (typeof window === 'undefined') return;

  // Largest Contentful Paint
  const lcpObserver = new PerformanceObserver((list) => {
    const entries = list.getEntries();
    const lastEntry = entries[entries.length - 1];
    
    performanceMonitor.recordApiCall(
      'web_vitals_lcp',
      lastEntry.startTime,
      lastEntry.startTime < 2500 // Good LCP is < 2.5s
    );
  });

  try {
    lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
  } catch (e) {
    console.warn('LCP not supported');
  }

  // First Input Delay
  const fidObserver = new PerformanceObserver((list) => {
    const entries = list.getEntries();
    entries.forEach((entry: any) => {
      // Type assertion needed as processingStart is not in base PerformanceEntry type
      if ('processingStart' in entry && 'startTime' in entry) {
        const fid = entry.processingStart - entry.startTime;
        
        performanceMonitor.recordApiCall(
          'web_vitals_fid',
          fid,
          fid < 100 // Good FID is < 100ms
        );
      }
    });
  });

  try {
    fidObserver.observe({ entryTypes: ['first-input'] });
  } catch (e) {
    console.warn('FID not supported');
  }
}

// Initialize on page load
if (typeof window !== 'undefined') {
  window.addEventListener('load', measureWebVitals);
  
  // Flush metrics before page unload
  window.addEventListener('beforeunload', () => {
    performanceMonitor.flush();
  });
  
  // Cleanup on page hide
  window.addEventListener('pagehide', () => {
    performanceMonitor.destroy();
  });
}

// Error boundary performance tracking
export function trackErrorBoundary(error: Error, componentStack: string) {
  performanceMonitor.recordApiCall(
    'error_boundary',
    0,
    false,
    error.name
  );
}