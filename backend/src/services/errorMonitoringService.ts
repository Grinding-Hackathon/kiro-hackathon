import { logger, auditLogger } from '../utils/logger';
import { ErrorCode } from '../types';
import { ErrorSeverity, ErrorCategory } from '../utils/errorResponseBuilder';

/**
 * Error monitoring and alerting service
 */
export class ErrorMonitoringService {
  private errorCounts: Map<string, number> = new Map();
  private errorRates: Map<string, { count: number; timestamp: number }[]> = new Map();
  private alertThresholds = {
    errorRate: {
      window: 5 * 60 * 1000, // 5 minutes
      threshold: 50, // 50 errors per 5 minutes
    },
    criticalErrors: {
      window: 1 * 60 * 1000, // 1 minute
      threshold: 5, // 5 critical errors per minute
    },
    authenticationFailures: {
      window: 5 * 60 * 1000, // 5 minutes
      threshold: 10, // 10 auth failures per 5 minutes
    },
    fraudDetection: {
      window: 1 * 60 * 1000, // 1 minute
      threshold: 1, // 1 fraud detection per minute
    },
  };

  /**
   * Track error occurrence and check for alerts
   */
  async trackError(
    errorCode: ErrorCode,
    severity: ErrorSeverity,
    category: ErrorCategory,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    const now = Date.now();
    const errorKey = `${category}:${errorCode}`;

    // Update error counts
    this.errorCounts.set(errorKey, (this.errorCounts.get(errorKey) || 0) + 1);

    // Update error rates
    if (!this.errorRates.has(errorKey)) {
      this.errorRates.set(errorKey, []);
    }
    const rates = this.errorRates.get(errorKey)!;
    rates.push({ count: 1, timestamp: now });

    // Clean old entries
    this.cleanOldEntries(errorKey, now);

    // Check for alerts
    await this.checkAlerts(errorCode, severity, category, metadata);

    // Log error metrics
    logger.info('Error tracked', {
      errorCode,
      severity,
      category,
      totalCount: this.errorCounts.get(errorKey),
      recentRate: rates.length,
      metadata,
    });
  }

  /**
   * Check if any alert thresholds are exceeded
   */
  private async checkAlerts(
    errorCode: ErrorCode,
    severity: ErrorSeverity,
    category: ErrorCategory,
    metadata: any
  ): Promise<void> {
    const now = Date.now();

    // Check critical error rate
    if (severity === ErrorSeverity.CRITICAL) {
      const criticalErrors = this.getErrorsInWindow(
        'CRITICAL',
        now,
        this.alertThresholds.criticalErrors.window
      );
      
      if (criticalErrors >= this.alertThresholds.criticalErrors.threshold) {
        await this.triggerAlert('CRITICAL_ERROR_RATE_EXCEEDED', {
          errorCode,
          severity,
          category,
          count: criticalErrors,
          threshold: this.alertThresholds.criticalErrors.threshold,
          window: this.alertThresholds.criticalErrors.window,
          metadata,
        });
      }
    }

    // Check authentication failure rate
    if (category === ErrorCategory.AUTHENTICATION) {
      const authErrors = this.getErrorsInWindow(
        'AUTHENTICATION',
        now,
        this.alertThresholds.authenticationFailures.window
      );
      
      if (authErrors >= this.alertThresholds.authenticationFailures.threshold) {
        await this.triggerAlert('AUTHENTICATION_FAILURE_RATE_EXCEEDED', {
          errorCode,
          count: authErrors,
          threshold: this.alertThresholds.authenticationFailures.threshold,
          window: this.alertThresholds.authenticationFailures.window,
          metadata,
        });
      }
    }

    // Check fraud detection alerts
    if (errorCode === ErrorCode.FRAUD_DETECTED) {
      const fraudErrors = this.getErrorsInWindow(
        'FRAUD',
        now,
        this.alertThresholds.fraudDetection.window
      );
      
      if (fraudErrors >= this.alertThresholds.fraudDetection.threshold) {
        await this.triggerAlert('FRAUD_DETECTION_SPIKE', {
          errorCode,
          count: fraudErrors,
          threshold: this.alertThresholds.fraudDetection.threshold,
          window: this.alertThresholds.fraudDetection.window,
          metadata,
        });
      }
    }

    // Check overall error rate
    const totalErrors = this.getTotalErrorsInWindow(
      now,
      this.alertThresholds.errorRate.window
    );
    
    if (totalErrors >= this.alertThresholds.errorRate.threshold) {
      await this.triggerAlert('HIGH_ERROR_RATE', {
        count: totalErrors,
        threshold: this.alertThresholds.errorRate.threshold,
        window: this.alertThresholds.errorRate.window,
        topErrors: this.getTopErrors(10),
      });
    }
  }

  /**
   * Get error count in time window for specific category
   */
  private getErrorsInWindow(category: string, now: number, window: number): number {
    let count = 0;
    for (const [key, rates] of this.errorRates.entries()) {
      if (key.startsWith(category) || category === 'CRITICAL') {
        count += rates.filter(r => now - r.timestamp <= window).length;
      }
    }
    return count;
  }

  /**
   * Get total error count in time window
   */
  private getTotalErrorsInWindow(now: number, window: number): number {
    let count = 0;
    for (const rates of this.errorRates.values()) {
      count += rates.filter(r => now - r.timestamp <= window).length;
    }
    return count;
  }

  /**
   * Get top errors by count
   */
  private getTopErrors(limit: number): Array<{ errorKey: string; count: number }> {
    return Array.from(this.errorCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([errorKey, count]) => ({ errorKey, count }));
  }

  /**
   * Clean old entries from error rates
   */
  private cleanOldEntries(errorKey: string, now: number): void {
    const rates = this.errorRates.get(errorKey);
    if (rates) {
      const maxWindow = Math.max(
        this.alertThresholds.errorRate.window,
        this.alertThresholds.criticalErrors.window,
        this.alertThresholds.authenticationFailures.window,
        this.alertThresholds.fraudDetection.window
      );
      
      const filtered = rates.filter(r => now - r.timestamp <= maxWindow);
      this.errorRates.set(errorKey, filtered);
    }
  }

  /**
   * Trigger alert
   */
  private async triggerAlert(alertType: string, details: any): Promise<void> {
    try {
      // Log alert
      logger.error(`ALERT: ${alertType}`, details);

      // Log to audit system
      await auditLogger.logSecurity({
        action: 'SYSTEM_HEALTH_ALERT',
        severity: 'HIGH',
        details: {
          alertType,
          ...details,
        },
      });

      // In a production system, you would also:
      // - Send notifications to monitoring systems (PagerDuty, Slack, etc.)
      // - Update metrics dashboards
      // - Trigger automated responses if configured
      
      // For now, we'll just log and store in audit trail
      this.logAlertMetrics(alertType, details);
      
    } catch (error) {
      logger.error('Failed to trigger alert', { error, alertType, details });
    }
  }

  /**
   * Log alert metrics for monitoring dashboards
   */
  private logAlertMetrics(alertType: string, details: any): void {
    // This would integrate with metrics collection systems like Prometheus
    logger.info('Alert metrics', {
      metric: 'alert_triggered',
      alertType,
      timestamp: new Date().toISOString(),
      details,
    });
  }

  /**
   * Get error statistics
   */
  getErrorStatistics(): {
    totalErrors: number;
    errorsByCategory: Record<string, number>;
    errorsByCode: Record<string, number>;
    recentErrorRate: number;
    topErrors: Array<{ errorKey: string; count: number }>;
  } {
    const now = Date.now();
    const window = 5 * 60 * 1000; // 5 minutes

    const errorsByCategory: Record<string, number> = {};
    const errorsByCode: Record<string, number> = {};
    let recentErrors = 0;

    for (const [key, rates] of this.errorRates.entries()) {
      const [category, code] = key.split(':');
      if (category && code) {
        const recentCount = rates.filter(r => now - r.timestamp <= window).length;
        
        errorsByCategory[category] = (errorsByCategory[category] || 0) + recentCount;
        errorsByCode[code] = (errorsByCode[code] || 0) + recentCount;
        recentErrors += recentCount;
      }
    }

    return {
      totalErrors: Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0),
      errorsByCategory,
      errorsByCode,
      recentErrorRate: recentErrors,
      topErrors: this.getTopErrors(10),
    };
  }

  /**
   * Reset error statistics (useful for testing)
   */
  resetStatistics(): void {
    this.errorCounts.clear();
    this.errorRates.clear();
  }

  /**
   * Update alert thresholds
   */
  updateAlertThresholds(thresholds: Partial<typeof this.alertThresholds>): void {
    this.alertThresholds = { ...this.alertThresholds, ...thresholds };
    logger.info('Alert thresholds updated', this.alertThresholds);
  }
}

// Export singleton instance
export const errorMonitoringService = new ErrorMonitoringService();