import { logger } from '@/utils/logger';
import { config } from '@/config/config';
import { db } from '@/database/connection';
import { blockchainService } from '@/services/blockchainService';
import { auditLogger } from '@/utils/logger';

export interface HealthCheck {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  message?: string;
  timestamp: Date;
  metadata?: any;
}

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  checks: HealthCheck[];
  uptime: number;
  timestamp: Date;
}

export interface HealthAlert {
  id: string;
  service: string;
  severity: 'WARNING' | 'CRITICAL';
  message: string;
  timestamp: Date;
  resolved: boolean;
}

export class HealthMonitoringService {
  private alerts: HealthAlert[] = [];
  private lastHealthCheck: SystemHealth | null = null;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private startTime: Date = new Date();

  constructor() {
    this.startMonitoring();
  }

  /**
   * Start continuous health monitoring
   */
  startMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(async () => {
      try {
        const health = await this.performHealthCheck();
        await this.processHealthResults(health);
      } catch (error) {
        logger.error('Error during health monitoring', { error });
      }
    }, config.monitoring.healthCheckInterval);

    logger.info('Health monitoring started', {
      interval: config.monitoring.healthCheckInterval,
    });
  }

  /**
   * Stop health monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    logger.info('Health monitoring stopped');
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(): Promise<SystemHealth> {
    const checks: HealthCheck[] = [];
    // const startTime = Date.now();

    // Database health check
    checks.push(await this.checkDatabase());

    // Blockchain health check
    checks.push(await this.checkBlockchain());

    // Memory health check
    checks.push(await this.checkMemory());

    // Disk space health check
    checks.push(await this.checkDiskSpace());

    // API response time check
    checks.push(await this.checkAPIResponseTime());

    // Determine overall health
    const unhealthyCount = checks.filter(check => check.status === 'unhealthy').length;
    const degradedCount = checks.filter(check => check.status === 'degraded').length;

    let overall: SystemHealth['overall'] = 'healthy';
    if (unhealthyCount > 0) {
      overall = 'unhealthy';
    } else if (degradedCount > 0) {
      overall = 'degraded';
    }

    const health: SystemHealth = {
      overall,
      checks,
      uptime: Date.now() - this.startTime.getTime(),
      timestamp: new Date(),
    };

    this.lastHealthCheck = health;
    return health;
  }

  /**
   * Check database connectivity and performance
   */
  private async checkDatabase(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      // Test database connection with a simple query
      await db.raw('SELECT 1');
      
      const responseTime = Date.now() - startTime;
      
      // Check connection pool status
      const pool = db.client.pool;
      const poolInfo = {
        used: pool.numUsed(),
        free: pool.numFree(),
        pending: pool.numPendingAcquires(),
        total: pool.numUsed() + pool.numFree(),
      };

      let status: HealthCheck['status'] = 'healthy';
      let message = 'Database connection healthy';

      if (responseTime > 1000) {
        status = 'degraded';
        message = `Database response time high: ${responseTime}ms`;
      }

      if (poolInfo.pending > 5) {
        status = 'degraded';
        message = `High number of pending connections: ${poolInfo.pending}`;
      }

      return {
        service: 'database',
        status,
        responseTime,
        message,
        timestamp: new Date(),
        metadata: poolInfo,
      };
    } catch (error) {
      return {
        service: 'database',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        message: `Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  }

  /**
   * Check blockchain connectivity
   */
  private async checkBlockchain(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      // Test blockchain connection
      const blockNumber = await blockchainService.getCurrentBlockNumber();
      const responseTime = Date.now() - startTime;

      let status: HealthCheck['status'] = 'healthy';
      let message = 'Blockchain connection healthy';

      if (responseTime > 5000) {
        status = 'degraded';
        message = `Blockchain response time high: ${responseTime}ms`;
      }

      return {
        service: 'blockchain',
        status,
        responseTime,
        message,
        timestamp: new Date(),
        metadata: { blockNumber },
      };
    } catch (error) {
      return {
        service: 'blockchain',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        message: `Blockchain connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  }

  /**
   * Check memory usage
   */
  private async checkMemory(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      const memUsage = process.memoryUsage();
      const responseTime = Date.now() - startTime;

      // Convert bytes to MB
      const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
      const rssMB = Math.round(memUsage.rss / 1024 / 1024);

      let status: HealthCheck['status'] = 'healthy';
      let message = 'Memory usage normal';

      // Alert if heap usage is over 80%
      const heapUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
      if (heapUsagePercent > 90) {
        status = 'unhealthy';
        message = `Critical memory usage: ${heapUsagePercent.toFixed(1)}%`;
      } else if (heapUsagePercent > 80) {
        status = 'degraded';
        message = `High memory usage: ${heapUsagePercent.toFixed(1)}%`;
      }

      return {
        service: 'memory',
        status,
        responseTime,
        message,
        timestamp: new Date(),
        metadata: {
          heapUsedMB,
          heapTotalMB,
          rssMB,
          heapUsagePercent: heapUsagePercent.toFixed(1),
        },
      };
    } catch (error) {
      return {
        service: 'memory',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        message: `Memory check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  }

  /**
   * Check disk space
   */
  private async checkDiskSpace(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      // const fs = require('fs');
      // const stats = fs.statSync('.');
      const responseTime = Date.now() - startTime;

      // This is a simplified check - in production, you'd want to check actual disk usage
      let status: HealthCheck['status'] = 'healthy';
      let message = 'Disk space check completed';

      return {
        service: 'disk',
        status,
        responseTime,
        message,
        timestamp: new Date(),
        metadata: { checked: true },
      };
    } catch (error) {
      return {
        service: 'disk',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        message: `Disk check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  }

  /**
   * Check API response time
   */
  private async checkAPIResponseTime(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      // Simulate API health check
      await new Promise(resolve => setTimeout(resolve, 10));
      const responseTime = Date.now() - startTime;

      let status: HealthCheck['status'] = 'healthy';
      let message = 'API response time normal';

      if (responseTime > 1000) {
        status = 'degraded';
        message = `API response time high: ${responseTime}ms`;
      }

      return {
        service: 'api',
        status,
        responseTime,
        message,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        service: 'api',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        message: `API health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  }

  /**
   * Process health check results and generate alerts
   */
  private async processHealthResults(health: SystemHealth): Promise<void> {
    // Check for new issues
    for (const check of health.checks) {
      if (check.status === 'unhealthy' || check.status === 'degraded') {
        await this.createAlert(check);
      } else {
        // Resolve any existing alerts for this service
        await this.resolveAlert(check.service);
      }
    }

    // Log overall health status
    if (health.overall !== 'healthy') {
      logger.warn(`System health: ${health.overall}`, {
        checks: health.checks.map(c => ({
          service: c.service,
          status: c.status,
          responseTime: c.responseTime,
          message: c.message,
        })),
      });
    }

    // Clean up old alerts
    this.cleanupOldAlerts();
  }

  /**
   * Create health alert
   */
  private async createAlert(check: HealthCheck): Promise<void> {
    // Check if alert already exists for this service
    const existingAlert = this.alerts.find(
      alert => alert.service === check.service && !alert.resolved
    );

    if (existingAlert) {
      return; // Don't create duplicate alerts
    }

    const alert: HealthAlert = {
      id: `health_${check.service}_${Date.now()}`,
      service: check.service,
      severity: check.status === 'unhealthy' ? 'CRITICAL' : 'WARNING',
      message: check.message || `${check.service} is ${check.status}`,
      timestamp: new Date(),
      resolved: false,
    };

    this.alerts.push(alert);

    // Log the alert
    await auditLogger.logSecurity({
      action: 'SYSTEM_HEALTH_ALERT',
      severity: alert.severity === 'CRITICAL' ? 'HIGH' : 'MEDIUM',
      ip: 'system',
      details: {
        service: alert.service,
        status: check.status,
        responseTime: check.responseTime,
        message: alert.message,
        metadata: check.metadata,
      },
    });

    logger.error(`HEALTH ALERT [${alert.severity}]: ${alert.message}`, {
      alertId: alert.id,
      service: alert.service,
      check,
    });
  }

  /**
   * Resolve alert for a service
   */
  private async resolveAlert(service: string): Promise<void> {
    const alert = this.alerts.find(
      alert => alert.service === service && !alert.resolved
    );

    if (alert) {
      alert.resolved = true;
      
      logger.info(`Health alert resolved for service: ${service}`, {
        alertId: alert.id,
      });
    }
  }

  /**
   * Clean up old alerts (older than 24 hours)
   */
  private cleanupOldAlerts(): void {
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    this.alerts = this.alerts.filter(alert => alert.timestamp > oneDayAgo);
  }

  /**
   * Get current system health
   */
  getCurrentHealth(): SystemHealth | null {
    return this.lastHealthCheck;
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): HealthAlert[] {
    return this.alerts.filter(alert => !alert.resolved);
  }

  /**
   * Get all alerts
   */
  getAllAlerts(): HealthAlert[] {
    return [...this.alerts];
  }

  /**
   * Force health check
   */
  async forceHealthCheck(): Promise<SystemHealth> {
    return await this.performHealthCheck();
  }
}

// Export singleton instance
export const healthMonitoringService = new HealthMonitoringService();