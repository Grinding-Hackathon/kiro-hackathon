import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { cacheService } from './cacheService';
import { queryOptimizationService } from './queryOptimizationService';
import os from 'os';

export interface PerformanceAlert {
  id: string;
  type: 'response_time' | 'memory_usage' | 'cpu_usage' | 'error_rate' | 'cache_miss_rate' | 'slow_query';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
  resolved?: boolean;
  resolvedAt?: Date;
}

export interface PerformanceMetrics {
  responseTime: {
    average: number;
    p95: number;
    p99: number;
  };
  throughput: {
    requestsPerSecond: number;
    requestsPerMinute: number;
  };
  errorRate: {
    rate: number;
    count: number;
  };
  systemResources: {
    cpuUsage: number;
    memoryUsage: {
      used: number;
      total: number;
      percentage: number;
    };
    diskUsage?: {
      used: number;
      total: number;
      percentage: number;
    };
  };
  database: {
    connectionPoolUsage: number;
    averageQueryTime: number;
    slowQueries: number;
  };
  cache: {
    hitRate: number;
    missRate: number;
    evictionRate: number;
  };
}

export interface AlertThresholds {
  responseTimeMs: number;
  errorRatePercent: number;
  cpuUsagePercent: number;
  memoryUsagePercent: number;
  cacheHitRatePercent: number;
  slowQueryMs: number;
}

export class PerformanceMonitoringService extends EventEmitter {
  private alerts: PerformanceAlert[] = [];
  private metrics: PerformanceMetrics;
  private thresholds: AlertThresholds;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private responseTimeBuffer: number[] = [];
  private requestCount = 0;
  private errorCount = 0;
  private lastMetricsReset = Date.now();

  constructor() {
    super();
    
    this.thresholds = {
      responseTimeMs: 2000,
      errorRatePercent: 5,
      cpuUsagePercent: 80,
      memoryUsagePercent: 85,
      cacheHitRatePercent: 70,
      slowQueryMs: 1000
    };

    this.metrics = this.initializeMetrics();
    this.startMonitoring();
  }

  private initializeMetrics(): PerformanceMetrics {
    return {
      responseTime: {
        average: 0,
        p95: 0,
        p99: 0
      },
      throughput: {
        requestsPerSecond: 0,
        requestsPerMinute: 0
      },
      errorRate: {
        rate: 0,
        count: 0
      },
      systemResources: {
        cpuUsage: 0,
        memoryUsage: {
          used: 0,
          total: 0,
          percentage: 0
        }
      },
      database: {
        connectionPoolUsage: 0,
        averageQueryTime: 0,
        slowQueries: 0
      },
      cache: {
        hitRate: 0,
        missRate: 0,
        evictionRate: 0
      }
    };
  }

  startMonitoring(intervalMs: number = 30000): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
      this.checkAlerts();
    }, intervalMs);

    logger.info('Performance monitoring started');
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    logger.info('Performance monitoring stopped');
  }

  recordResponseTime(responseTimeMs: number): void {
    this.responseTimeBuffer.push(responseTimeMs);
    this.requestCount++;

    // Keep buffer size manageable
    if (this.responseTimeBuffer.length > 1000) {
      this.responseTimeBuffer = this.responseTimeBuffer.slice(-500);
    }
  }

  recordError(): void {
    this.errorCount++;
  }

  private async collectMetrics(): Promise<void> {
    try {
      // Calculate response time metrics
      if (this.responseTimeBuffer.length > 0) {
        const sorted = [...this.responseTimeBuffer].sort((a, b) => a - b);
        this.metrics.responseTime.average = sorted.reduce((a, b) => a + b, 0) / sorted.length;
        this.metrics.responseTime.p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
        this.metrics.responseTime.p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;
      }

      // Calculate throughput
      const timeSinceReset = (Date.now() - this.lastMetricsReset) / 1000;
      this.metrics.throughput.requestsPerSecond = this.requestCount / timeSinceReset;
      this.metrics.throughput.requestsPerMinute = this.requestCount / (timeSinceReset / 60);

      // Calculate error rate
      this.metrics.errorRate.count = this.errorCount;
      this.metrics.errorRate.rate = this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0;

      // System resource metrics
      await this.collectSystemMetrics();

      // Database metrics
      await this.collectDatabaseMetrics();

      // Cache metrics
      await this.collectCacheMetrics();

      logger.debug('Performance metrics collected', this.metrics);
    } catch (error) {
      logger.error('Failed to collect performance metrics:', error);
    }
  }

  private async collectSystemMetrics(): Promise<void> {
    // CPU usage
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    });

    this.metrics.systemResources.cpuUsage = 100 - (totalIdle / totalTick) * 100;

    // Memory usage
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    this.metrics.systemResources.memoryUsage = {
      used: usedMemory,
      total: totalMemory,
      percentage: (usedMemory / totalMemory) * 100
    };
  }

  private async collectDatabaseMetrics(): Promise<void> {
    try {
      const queryMetrics = queryOptimizationService.getMetrics();
      
      this.metrics.database = {
        connectionPoolUsage: 0, // Would need to implement pool monitoring
        averageQueryTime: queryMetrics.averageExecutionTime,
        slowQueries: queryMetrics.slowQueries.length
      };
    } catch (error) {
      logger.error('Failed to collect database metrics:', error);
    }
  }

  private async collectCacheMetrics(): Promise<void> {
    try {
      const cacheMetrics = cacheService.getMetrics();
      const total = cacheMetrics.hits + cacheMetrics.misses;
      
      this.metrics.cache = {
        hitRate: total > 0 ? (cacheMetrics.hits / total) * 100 : 0,
        missRate: total > 0 ? (cacheMetrics.misses / total) * 100 : 0,
        evictionRate: 0 // Would need Redis eviction stats
      };
    } catch (error) {
      logger.error('Failed to collect cache metrics:', error);
    }
  }

  private checkAlerts(): void {
    const newAlerts: PerformanceAlert[] = [];

    // Response time alert
    if (this.metrics.responseTime.average > this.thresholds.responseTimeMs) {
      newAlerts.push(this.createAlert(
        'response_time',
        'high',
        `Average response time (${this.metrics.responseTime.average.toFixed(2)}ms) exceeds threshold`,
        this.metrics.responseTime.average,
        this.thresholds.responseTimeMs
      ));
    }

    // Error rate alert
    if (this.metrics.errorRate.rate > this.thresholds.errorRatePercent) {
      newAlerts.push(this.createAlert(
        'error_rate',
        'high',
        `Error rate (${this.metrics.errorRate.rate.toFixed(2)}%) exceeds threshold`,
        this.metrics.errorRate.rate,
        this.thresholds.errorRatePercent
      ));
    }

    // CPU usage alert
    if (this.metrics.systemResources.cpuUsage > this.thresholds.cpuUsagePercent) {
      newAlerts.push(this.createAlert(
        'cpu_usage',
        'medium',
        `CPU usage (${this.metrics.systemResources.cpuUsage.toFixed(2)}%) exceeds threshold`,
        this.metrics.systemResources.cpuUsage,
        this.thresholds.cpuUsagePercent
      ));
    }

    // Memory usage alert
    if (this.metrics.systemResources.memoryUsage.percentage > this.thresholds.memoryUsagePercent) {
      newAlerts.push(this.createAlert(
        'memory_usage',
        'high',
        `Memory usage (${this.metrics.systemResources.memoryUsage.percentage.toFixed(2)}%) exceeds threshold`,
        this.metrics.systemResources.memoryUsage.percentage,
        this.thresholds.memoryUsagePercent
      ));
    }

    // Cache hit rate alert
    if (this.metrics.cache.hitRate < this.thresholds.cacheHitRatePercent) {
      newAlerts.push(this.createAlert(
        'cache_miss_rate',
        'medium',
        `Cache hit rate (${this.metrics.cache.hitRate.toFixed(2)}%) below threshold`,
        this.metrics.cache.hitRate,
        this.thresholds.cacheHitRatePercent
      ));
    }

    // Slow query alert
    if (this.metrics.database.slowQueries > 0) {
      newAlerts.push(this.createAlert(
        'slow_query',
        'medium',
        `${this.metrics.database.slowQueries} slow queries detected`,
        this.metrics.database.slowQueries,
        0
      ));
    }

    // Process new alerts
    newAlerts.forEach(alert => {
      this.alerts.push(alert);
      this.emit('alert', alert);
      logger.warn('Performance alert triggered:', alert);
    });

    // Clean up old resolved alerts (keep last 100)
    this.alerts = this.alerts.slice(-100);
  }

  private createAlert(
    type: PerformanceAlert['type'],
    severity: PerformanceAlert['severity'],
    message: string,
    value: number,
    threshold: number
  ): PerformanceAlert {
    return {
      id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity,
      message,
      value,
      threshold,
      timestamp: new Date(),
      resolved: false
    };
  }

  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      this.emit('alertResolved', alert);
      logger.info('Performance alert resolved:', alertId);
      return true;
    }
    return false;
  }

  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  getAlerts(includeResolved: boolean = false): PerformanceAlert[] {
    return this.alerts.filter(alert => includeResolved || !alert.resolved);
  }

  getActiveAlerts(): PerformanceAlert[] {
    return this.alerts.filter(alert => !alert.resolved);
  }

  updateThresholds(newThresholds: Partial<AlertThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    logger.info('Performance alert thresholds updated:', this.thresholds);
  }

  getThresholds(): AlertThresholds {
    return { ...this.thresholds };
  }

  resetMetrics(): void {
    this.responseTimeBuffer = [];
    this.requestCount = 0;
    this.errorCount = 0;
    this.lastMetricsReset = Date.now();
    this.metrics = this.initializeMetrics();
    logger.info('Performance metrics reset');
  }

  // Generate performance report
  generateReport(): {
    summary: string;
    metrics: PerformanceMetrics;
    alerts: PerformanceAlert[];
    recommendations: string[];
  } {
    const activeAlerts = this.getActiveAlerts();
    const recommendations: string[] = [];

    if (this.metrics.responseTime.average > 1000) {
      recommendations.push('Consider optimizing slow endpoints or adding caching');
    }

    if (this.metrics.cache.hitRate < 80) {
      recommendations.push('Review caching strategy to improve hit rate');
    }

    if (this.metrics.systemResources.memoryUsage.percentage > 70) {
      recommendations.push('Monitor memory usage and consider scaling resources');
    }

    if (this.metrics.database.slowQueries > 5) {
      recommendations.push('Optimize database queries and add appropriate indexes');
    }

    const summary = `Performance Report: ${activeAlerts.length} active alerts, ` +
      `${this.metrics.responseTime.average.toFixed(2)}ms avg response time, ` +
      `${this.metrics.errorRate.rate.toFixed(2)}% error rate`;

    return {
      summary,
      metrics: this.metrics,
      alerts: activeAlerts,
      recommendations
    };
  }
}

// Singleton instance
export const performanceMonitoringService = new PerformanceMonitoringService();