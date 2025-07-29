import { Request, Response } from 'express';
import { asyncHandler } from '@/middleware/errorHandler';
import { fraudDetectionService } from '@/services/fraudDetectionService';
import { healthMonitoringService } from '@/services/healthMonitoringService';
import { backupService } from '@/services/backupService';
import { auditLogger } from '@/utils/logger';
import { getSecurityMetrics as getRateLimitMetrics } from '@/middleware/rateLimiter';

/**
 * Get system health status
 */
export const getSystemHealth = asyncHandler(async (_req: Request, res: Response) => {
  const health = await healthMonitoringService.forceHealthCheck();
  
  res.json({
    success: true,
    data: health,
  });
});

/**
 * Get active health alerts
 */
export const getHealthAlerts = asyncHandler(async (_req: Request, res: Response) => {
  const alerts = healthMonitoringService.getActiveAlerts();
  
  res.json({
    success: true,
    data: {
      alerts,
      count: alerts.length,
    },
  });
});

/**
 * Get fraud detection alerts
 */
export const getFraudAlerts = asyncHandler(async (req: Request, res: Response) => {
  const { severity, limit } = req.query;
  
  let alerts = fraudDetectionService.getRecentAlerts(
    limit ? parseInt(limit as string) : 100
  );
  
  if (severity) {
    alerts = fraudDetectionService.getAlertsBySeverity(severity as any);
  }
  
  res.json({
    success: true,
    data: {
      alerts,
      count: alerts.length,
    },
  });
});

/**
 * Get backup history
 */
export const getBackupHistory = asyncHandler(async (_req: Request, res: Response) => {
  const history = backupService.getBackupHistory();
  
  res.json({
    success: true,
    data: {
      backups: history,
      count: history.length,
    },
  });
});

/**
 * Create manual backup
 */
export const createBackup = asyncHandler(async (req: Request, res: Response) => {
  const { type } = req.body;
  
  if (!['full', 'incremental', 'logs'].includes(type)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid backup type',
      message: 'Backup type must be one of: full, incremental, logs',
    });
  }

  let backup;
  
  try {
    switch (type) {
      case 'full':
        backup = await backupService.createFullBackup();
        break;
      case 'incremental':
        backup = await backupService.createIncrementalBackup();
        break;
      case 'logs':
        backup = await backupService.createLogsBackup();
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid backup type',
          message: 'Backup type must be one of: full, incremental, logs',
        });
    }

    await auditLogger.logSystem({
      action: 'MANUAL_BACKUP_CREATED',
      details: {
        type,
        backupId: backup.id,
        initiatedBy: (req as any).user?.id,
      },
    });

    return res.json({
      success: true,
      data: backup,
      message: `${type} backup created successfully`,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Backup creation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Verify backup integrity
 */
export const verifyBackup = asyncHandler(async (req: Request, res: Response) => {
  const { backupId } = req.params;
  
  if (!backupId) {
    return res.status(400).json({
      success: false,
      error: 'Backup ID required',
      message: 'Backup ID parameter is required',
    });
  }
  
  try {
    const isValid = await backupService.verifyBackup(backupId);
    const backup = backupService.getBackup(backupId);
    
    return res.json({
      success: true,
      data: {
        backupId,
        isValid,
        backup,
      },
    });
  } catch (error) {
    return res.status(404).json({
      success: false,
      error: 'Backup not found',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get security metrics dashboard
 */
export const getSecurityMetrics = asyncHandler(async (_req: Request, res: Response) => {
  const health = healthMonitoringService.getCurrentHealth();
  const healthAlerts = healthMonitoringService.getActiveAlerts();
  const fraudAlerts = fraudDetectionService.getRecentAlerts(50);
  const backupHistory = backupService.getBackupHistory();
  const rateLimitMetrics = getRateLimitMetrics();
  
  // Calculate metrics
  const criticalFraudAlerts = fraudAlerts.filter(alert => alert.severity === 'CRITICAL').length;
  const highFraudAlerts = fraudAlerts.filter(alert => alert.severity === 'HIGH').length;
  const criticalHealthAlerts = healthAlerts.filter(alert => alert.severity === 'CRITICAL').length;
  
  const recentBackups = backupHistory
    .filter(backup => {
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      return backup.timestamp > oneDayAgo;
    });
  
  const successfulBackups = recentBackups.filter(backup => backup.status === 'completed').length;
  const failedBackups = recentBackups.filter(backup => backup.status === 'failed').length;

  res.json({
    success: true,
    data: {
      systemHealth: {
        overall: health?.overall || 'unknown',
        uptime: health?.uptime || 0,
        lastCheck: health?.timestamp || null,
      },
      alerts: {
        critical: criticalFraudAlerts + criticalHealthAlerts,
        high: highFraudAlerts,
        total: fraudAlerts.length + healthAlerts.length,
      },
      fraud: {
        totalAlerts: fraudAlerts.length,
        critical: criticalFraudAlerts,
        high: highFraudAlerts,
        recentCount: fraudAlerts.filter(alert => {
          const oneHourAgo = new Date();
          oneHourAgo.setHours(oneHourAgo.getHours() - 1);
          return alert.timestamp > oneHourAgo;
        }).length,
      },
      security: {
        blockedIPs: rateLimitMetrics.blockedIPs.length,
        suspiciousIPs: rateLimitMetrics.suspiciousIPs.length,
        ddosPatterns: {
          rapidRequests: rateLimitMetrics.ddosPatterns.rapidRequests.length,
          largePayloads: rateLimitMetrics.ddosPatterns.largePayloads.length,
          repeatedPaths: rateLimitMetrics.ddosPatterns.repeatedPaths.length,
        },
      },
      backups: {
        total: backupHistory.length,
        recent: recentBackups.length,
        successful: successfulBackups,
        failed: failedBackups,
        lastBackup: backupHistory
          .filter(b => b.status === 'completed')
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0]?.timestamp || null,
      },
      services: health?.checks.map(check => ({
        name: check.service,
        status: check.status,
        responseTime: check.responseTime,
        lastCheck: check.timestamp,
      })) || [],
      rateLimitDetails: rateLimitMetrics,
    },
  });
});

/**
 * Get disaster recovery status
 */
export const getDisasterRecoveryStatus = asyncHandler(async (_req: Request, res: Response) => {
  const status = backupService.getDisasterRecoveryStatus();
  
  res.json({
    success: true,
    data: status,
  });
});

/**
 * Test recovery procedures
 */
export const testRecoveryProcedures = asyncHandler(async (_req: Request, res: Response) => {
  try {
    const testResults = await backupService.testRecoveryProcedures();
    
    res.json({
      success: true,
      data: testResults,
      message: 'Recovery procedures test completed',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Recovery test failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Create disaster recovery plan
 */
export const createDisasterRecoveryPlan = asyncHandler(async (_req: Request, res: Response) => {
  try {
    const plan = await backupService.createDisasterRecoveryPlan();
    
    res.json({
      success: true,
      data: plan,
      message: 'Disaster recovery plan created successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to create disaster recovery plan',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get detailed security information
 */
export const getSecurityDetails = asyncHandler(async (_req: Request, res: Response) => {
  const rateLimitMetrics = getRateLimitMetrics();
  const recentFraudAlerts = fraudDetectionService.getRecentAlerts(20);
  const activeHealthAlerts = healthMonitoringService.getActiveAlerts();
  
  res.json({
    success: true,
    data: {
      rateLimiting: rateLimitMetrics,
      fraudDetection: {
        recentAlerts: recentFraudAlerts,
        alertsBySeverity: {
          critical: fraudDetectionService.getAlertsBySeverity('CRITICAL'),
          high: fraudDetectionService.getAlertsBySeverity('HIGH'),
          medium: fraudDetectionService.getAlertsBySeverity('MEDIUM'),
          low: fraudDetectionService.getAlertsBySeverity('LOW'),
        },
      },
      healthMonitoring: {
        activeAlerts: activeHealthAlerts,
        currentHealth: healthMonitoringService.getCurrentHealth(),
      },
      timestamp: new Date(),
    },
  });
});

/**
 * Trigger security scan
 */
export const triggerSecurityScan = asyncHandler(async (req: Request, res: Response) => {
  const { scanType } = req.body;
  
  if (!['health', 'fraud', 'backup_integrity'].includes(scanType)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid scan type',
      message: 'Scan type must be one of: health, fraud, backup_integrity',
    });
  }

  try {
    let results;
    
    switch (scanType) {
      case 'health':
        results = await healthMonitoringService.forceHealthCheck();
        break;
      case 'fraud':
        // Run comprehensive fraud detection scan
        const fraudScanResults = await fraudDetectionService.runComprehensiveScan();
        results = {
          message: 'Fraud detection scan completed',
          alertsGenerated: fraudScanResults.length,
          alerts: fraudScanResults,
        };
        break;
      case 'backup_integrity':
        const backups = backupService.getBackupHistory();
        const verificationResults = [];
        
        for (const backup of backups.slice(0, 10)) { // Check last 10 backups
          try {
            const isValid = await backupService.verifyBackup(backup.id);
            verificationResults.push({
              backupId: backup.id,
              filename: backup.filename,
              isValid,
            });
          } catch (error) {
            verificationResults.push({
              backupId: backup.id,
              filename: backup.filename,
              isValid: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
        
        results = {
          message: 'Backup integrity scan completed',
          verificationResults,
        };
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid scan type',
          message: 'Scan type must be one of: health, fraud, backup_integrity',
        });
    }

    await auditLogger.logSecurity({
      userId: (req as any).user?.id,
      action: 'SECURITY_SCAN_TRIGGERED',
      severity: 'LOW',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      details: {
        scanType,
        results,
      },
    });

    return res.json({
      success: true,
      data: results,
      message: `${scanType} scan completed successfully`,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Security scan failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});