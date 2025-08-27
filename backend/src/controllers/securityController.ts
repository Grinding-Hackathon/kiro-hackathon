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
 * Get mobile security status - tailored for mobile app display
 */
export const getMobileSecurityStatus = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  
  // Get current system health
  const health = healthMonitoringService.getCurrentHealth();
  
  // Get recent fraud alerts (last 24 hours)
  const recentFraudAlerts = fraudDetectionService.getRecentAlerts(50).filter(alert => {
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    return alert.timestamp > oneDayAgo;
  });
  
  // Get user-specific fraud alerts if available
  const userFraudAlerts = recentFraudAlerts.filter(alert => 
    alert.userId === userId || alert.metadata?.affectedUsers?.includes(userId)
  );
  
  // Get active health alerts
  const healthAlerts = healthMonitoringService.getActiveAlerts();
  
  // Get recent backup status
  const backupHistory = backupService.getBackupHistory();
  const lastBackup = backupHistory
    .filter(b => b.status === 'completed')
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
  
  // Get rate limiting metrics
  const rateLimitMetrics = getRateLimitMetrics();
  
  // Calculate security score (0-100)
  let securityScore = 100;
  
  // Deduct points for critical issues
  const criticalFraudAlerts = recentFraudAlerts.filter(alert => alert.severity === 'CRITICAL').length;
  const criticalHealthAlerts = healthAlerts.filter(alert => alert.severity === 'CRITICAL').length;
  
  securityScore -= (criticalFraudAlerts * 20); // -20 per critical fraud alert
  securityScore -= (criticalHealthAlerts * 15); // -15 per critical health alert
  securityScore -= (userFraudAlerts.length * 10); // -10 per user-specific alert
  
  // Deduct points for system health issues
  if (health?.overall === 'unhealthy') {
    securityScore -= 30;
  } else if (health?.overall === 'degraded') {
    securityScore -= 15;
  }
  
  // Deduct points for backup issues
  if (!lastBackup) {
    securityScore -= 10;
  } else {
    const backupAge = Date.now() - lastBackup.timestamp.getTime();
    const hoursOld = backupAge / (1000 * 60 * 60);
    if (hoursOld > 48) { // More than 2 days old
      securityScore -= 5;
    }
  }
  
  // Ensure score doesn't go below 0
  securityScore = Math.max(0, securityScore);
  
  // Determine overall security status
  let overallStatus: 'secure' | 'warning' | 'critical';
  if (securityScore >= 80) {
    overallStatus = 'secure';
  } else if (securityScore >= 50) {
    overallStatus = 'warning';
  } else {
    overallStatus = 'critical';
  }
  
  // Generate mobile-friendly recommendations
  const recommendations: Array<{
    id: string;
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    actionable: boolean;
  }> = [];
  
  if (criticalFraudAlerts > 0) {
    recommendations.push({
      id: 'fraud_alerts',
      title: 'Critical Security Alerts',
      description: `${criticalFraudAlerts} critical fraud alert${criticalFraudAlerts > 1 ? 's' : ''} detected. Review your recent transactions.`,
      priority: 'high',
      actionable: true,
    });
  }
  
  if (userFraudAlerts.length > 0) {
    recommendations.push({
      id: 'user_fraud_alerts',
      title: 'Account Security Alert',
      description: `${userFraudAlerts.length} security alert${userFraudAlerts.length > 1 ? 's' : ''} related to your account. Please review.`,
      priority: 'high',
      actionable: true,
    });
  }
  
  if (health?.overall === 'unhealthy') {
    recommendations.push({
      id: 'system_health',
      title: 'System Health Issue',
      description: 'Some system services are experiencing issues. Functionality may be limited.',
      priority: 'medium',
      actionable: false,
    });
  }
  
  if (rateLimitMetrics.blockedIPs.length > 10) {
    recommendations.push({
      id: 'security_activity',
      title: 'Increased Security Activity',
      description: 'Higher than normal security activity detected. Your account remains protected.',
      priority: 'low',
      actionable: false,
    });
  }
  
  if (!lastBackup || (Date.now() - lastBackup.timestamp.getTime()) > (48 * 60 * 60 * 1000)) {
    recommendations.push({
      id: 'backup_status',
      title: 'Backup Recommendation',
      description: 'Consider creating a fresh backup of your wallet data.',
      priority: 'medium',
      actionable: true,
    });
  }
  
  // If no issues, add positive reinforcement
  if (recommendations.length === 0) {
    recommendations.push({
      id: 'all_good',
      title: 'Security Status Good',
      description: 'Your wallet security is operating normally. Keep up the good practices!',
      priority: 'low',
      actionable: false,
    });
  }
  
  const response = {
    overallStatus,
    securityScore,
    lastUpdated: new Date(),
    systemHealth: {
      status: health?.overall || 'unknown',
      uptime: health?.uptime || 0,
      servicesOnline: health?.checks?.filter(check => check.status === 'healthy').length || 0,
      totalServices: health?.checks?.length || 0,
    },
    alerts: {
      critical: criticalFraudAlerts + criticalHealthAlerts,
      userSpecific: userFraudAlerts.length,
      total: recentFraudAlerts.length + healthAlerts.length,
    },
    backup: {
      lastBackup: lastBackup ? {
        timestamp: lastBackup.timestamp,
        type: lastBackup.type,
        status: lastBackup.status,
        ageHours: Math.floor((Date.now() - lastBackup.timestamp.getTime()) / (1000 * 60 * 60)),
      } : null,
      recommendBackup: !lastBackup || (Date.now() - lastBackup.timestamp.getTime()) > (24 * 60 * 60 * 1000),
    },
    security: {
      blockedThreats: rateLimitMetrics.blockedIPs.length,
      suspiciousActivity: rateLimitMetrics.suspiciousIPs.length,
      ddosProtection: {
        active: rateLimitMetrics.ddosPatterns.rapidRequests.length > 0 ||
                rateLimitMetrics.ddosPatterns.largePayloads.length > 0 ||
                rateLimitMetrics.ddosPatterns.repeatedPaths.length > 0,
        threatsBlocked: rateLimitMetrics.ddosPatterns.rapidRequests.length +
                       rateLimitMetrics.ddosPatterns.largePayloads.length +
                       rateLimitMetrics.ddosPatterns.repeatedPaths.length,
      },
    },
    recommendations,
  };
  
  res.json({
    success: true,
    data: response,
  });
});

/**
 * Report security event from mobile app
 */
export const reportSecurityEvent = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const { eventType, severity, description, metadata, deviceInfo } = req.body;
  
  // Validate required fields
  if (!eventType || !severity || !description) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields',
      message: 'eventType, severity, and description are required',
    });
  }
  
  // Validate event type
  const validEventTypes = [
    'SUSPICIOUS_ACTIVITY',
    'UNAUTHORIZED_ACCESS_ATTEMPT',
    'DEVICE_COMPROMISE',
    'UNUSUAL_BEHAVIOR',
    'SECURITY_BREACH',
    'MALWARE_DETECTED',
    'PHISHING_ATTEMPT',
    'SOCIAL_ENGINEERING',
    'DATA_LEAK',
    'AUTHENTICATION_FAILURE',
    'BIOMETRIC_FAILURE',
    'JAILBREAK_DETECTED',
    'DEBUG_MODE_DETECTED',
    'SCREEN_RECORDING_DETECTED',
    'SCREENSHOT_DETECTED',
    'NETWORK_ANOMALY',
    'BLUETOOTH_SECURITY_ISSUE',
    'QR_CODE_SECURITY_ISSUE',
    'TOKEN_MANIPULATION',
    'TRANSACTION_ANOMALY',
    'WALLET_TAMPERING',
    'BACKUP_SECURITY_ISSUE',
    'OTHER'
  ];
  
  if (!validEventTypes.includes(eventType)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid event type',
      message: `Event type must be one of: ${validEventTypes.join(', ')}`,
    });
  }
  
  // Validate severity
  const validSeverities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  if (!validSeverities.includes(severity)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid severity',
      message: `Severity must be one of: ${validSeverities.join(', ')}`,
    });
  }
  
  try {
    const eventId = `mobile_event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date();
    
    // Create security event record
    const securityEvent = {
      id: eventId,
      type: eventType,
      severity,
      userId,
      source: 'mobile_app',
      description,
      metadata: {
        ...metadata,
        deviceInfo,
        reportedAt: timestamp,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      },
      timestamp,
    };
    
    // Log the security event
    await auditLogger.logSecurity({
      userId,
      action: `MOBILE_SECURITY_EVENT_${eventType}`,
      severity: severity as any,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      details: securityEvent,
    });
    
    // Create fraud alert if severity is HIGH or CRITICAL
    if (severity === 'HIGH' || severity === 'CRITICAL') {
      // Trigger fraud detection analysis
      await fraudDetectionService.analyzeTransaction({
        userId,
        amount: 0, // No amount for security events
        type: 'security_event',
        ip: req.ip,
      });
    }
    
    // Determine response based on severity
    let responseMessage = 'Security event reported successfully';
    let recommendations: string[] = [];
    
    switch (severity) {
      case 'CRITICAL':
        responseMessage = 'Critical security event reported. Immediate action may be required.';
        recommendations = [
          'Consider changing your password immediately',
          'Review recent account activity',
          'Contact support if you suspect unauthorized access',
          'Enable additional security measures if available',
        ];
        break;
      case 'HIGH':
        responseMessage = 'High priority security event reported. Please review your account security.';
        recommendations = [
          'Review recent account activity',
          'Ensure your device is secure',
          'Consider updating your security settings',
        ];
        break;
      case 'MEDIUM':
        responseMessage = 'Security event reported. We\'ll monitor for similar activity.';
        recommendations = [
          'Keep your app updated',
          'Be cautious of suspicious activity',
        ];
        break;
      case 'LOW':
        responseMessage = 'Security event logged for monitoring purposes.';
        recommendations = [
          'Continue following security best practices',
        ];
        break;
    }
    
    // Log successful event reporting
    auditLogger.logSystem({
      action: 'MOBILE_SECURITY_EVENT_PROCESSED',
      details: {
        eventId,
        eventType,
        severity,
        userId,
        processed: true,
      },
    });
    
    return res.json({
      success: true,
      data: {
        eventId,
        status: 'processed',
        severity,
        timestamp,
        recommendations,
      },
      message: responseMessage,
    });
  } catch (error) {
    auditLogger.logSystem({
      action: 'MOBILE_SECURITY_EVENT_ERROR',
      details: {
        eventType,
        severity,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to process security event',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get security recommendations for mobile users
 */
export const getSecurityRecommendations = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  
  try {
    // Get user's recent activity and security status
    const health = healthMonitoringService.getCurrentHealth();
    const recentFraudAlerts = fraudDetectionService.getRecentAlerts(50).filter(alert => {
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      return alert.timestamp > oneDayAgo;
    });
    
    const userFraudAlerts = recentFraudAlerts.filter(alert => 
      alert.userId === userId || alert.metadata?.affectedUsers?.includes(userId)
    );
    
    const backupHistory = backupService.getBackupHistory();
    const lastBackup = backupHistory
      .filter(b => b.status === 'completed')
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
    
    const rateLimitMetrics = getRateLimitMetrics();
    
    // Generate personalized recommendations
    const recommendations: Array<{
      id: string;
      category: 'authentication' | 'device_security' | 'transaction_safety' | 'backup' | 'monitoring' | 'general';
      title: string;
      description: string;
      priority: 'high' | 'medium' | 'low';
      actionable: boolean;
      action?: {
        type: 'navigate' | 'external' | 'setting' | 'contact';
        target?: string;
        label: string;
      };
      completed?: boolean;
    }> = [];
    
    // High priority recommendations based on current security status
    if (userFraudAlerts.length > 0) {
      recommendations.push({
        id: 'review_fraud_alerts',
        category: 'monitoring',
        title: 'Review Security Alerts',
        description: `You have ${userFraudAlerts.length} security alert${userFraudAlerts.length > 1 ? 's' : ''} that require attention.`,
        priority: 'high',
        actionable: true,
        action: {
          type: 'navigate',
          target: '/security/alerts',
          label: 'View Alerts',
        },
      });
    }
    
    if (health?.overall === 'unhealthy') {
      recommendations.push({
        id: 'system_health_issue',
        category: 'monitoring',
        title: 'System Health Alert',
        description: 'Some security services are experiencing issues. Your account remains protected, but some features may be limited.',
        priority: 'high',
        actionable: false,
      });
    }
    
    // Backup recommendations
    if (!lastBackup) {
      recommendations.push({
        id: 'create_first_backup',
        category: 'backup',
        title: 'Create Your First Backup',
        description: 'Protect your wallet by creating a secure backup of your data.',
        priority: 'high',
        actionable: true,
        action: {
          type: 'navigate',
          target: '/backup/create',
          label: 'Create Backup',
        },
      });
    } else {
      const backupAge = Date.now() - lastBackup.timestamp.getTime();
      const daysOld = Math.floor(backupAge / (1000 * 60 * 60 * 24));
      
      if (daysOld > 7) {
        recommendations.push({
          id: 'update_backup',
          category: 'backup',
          title: 'Update Your Backup',
          description: `Your last backup is ${daysOld} days old. Consider creating a fresh backup.`,
          priority: daysOld > 30 ? 'high' : 'medium',
          actionable: true,
          action: {
            type: 'navigate',
            target: '/backup/create',
            label: 'Create New Backup',
          },
        });
      }
    }
    
    // Device security recommendations
    recommendations.push({
      id: 'enable_biometric_auth',
      category: 'authentication',
      title: 'Enable Biometric Authentication',
      description: 'Use Face ID or Touch ID for faster and more secure access to your wallet.',
      priority: 'medium',
      actionable: true,
      action: {
        type: 'setting',
        target: 'biometric_auth',
        label: 'Enable in Settings',
      },
    });
    
    recommendations.push({
      id: 'enable_auto_lock',
      category: 'device_security',
      title: 'Enable Auto-Lock',
      description: 'Automatically lock your wallet after a period of inactivity for enhanced security.',
      priority: 'medium',
      actionable: true,
      action: {
        type: 'setting',
        target: 'auto_lock',
        label: 'Configure Auto-Lock',
      },
    });
    
    // Transaction safety recommendations
    recommendations.push({
      id: 'verify_recipients',
      category: 'transaction_safety',
      title: 'Always Verify Recipients',
      description: 'Double-check recipient addresses before sending transactions to prevent loss of funds.',
      priority: 'medium',
      actionable: false,
    });
    
    recommendations.push({
      id: 'use_qr_codes',
      category: 'transaction_safety',
      title: 'Use QR Codes for Addresses',
      description: 'Scan QR codes instead of manually typing addresses to reduce errors and improve security.',
      priority: 'low',
      actionable: false,
    });
    
    // General security recommendations
    recommendations.push({
      id: 'keep_app_updated',
      category: 'general',
      title: 'Keep App Updated',
      description: 'Always use the latest version of the app to benefit from security improvements.',
      priority: 'medium',
      actionable: true,
      action: {
        type: 'external',
        target: 'app_store',
        label: 'Check for Updates',
      },
    });
    
    recommendations.push({
      id: 'secure_network',
      category: 'device_security',
      title: 'Use Secure Networks',
      description: 'Avoid using public Wi-Fi for wallet operations. Use cellular data or trusted networks.',
      priority: 'medium',
      actionable: false,
    });
    
    recommendations.push({
      id: 'regular_security_review',
      category: 'monitoring',
      title: 'Regular Security Reviews',
      description: 'Periodically review your transaction history and security settings.',
      priority: 'low',
      actionable: true,
      action: {
        type: 'navigate',
        target: '/security/review',
        label: 'Review Security',
      },
    });
    
    // Advanced recommendations based on threat level
    if (rateLimitMetrics.blockedIPs.length > 50) {
      recommendations.push({
        id: 'high_threat_activity',
        category: 'monitoring',
        title: 'Increased Threat Activity',
        description: 'We\'re detecting higher than normal threat activity. Your account is protected, but stay vigilant.',
        priority: 'medium',
        actionable: false,
      });
    }
    
    // Sort recommendations by priority
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    recommendations.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);
    
    // Generate security score based on recommendations
    const highPriorityCount = recommendations.filter(r => r.priority === 'high').length;
    const mediumPriorityCount = recommendations.filter(r => r.priority === 'medium').length;
    
    let securityScore = 100;
    securityScore -= (highPriorityCount * 15); // -15 per high priority issue
    securityScore -= (mediumPriorityCount * 5); // -5 per medium priority issue
    securityScore = Math.max(0, securityScore);
    
    const response = {
      securityScore,
      lastUpdated: new Date(),
      totalRecommendations: recommendations.length,
      priorityBreakdown: {
        high: highPriorityCount,
        medium: mediumPriorityCount,
        low: recommendations.filter(r => r.priority === 'low').length,
      },
      recommendations,
      systemStatus: {
        overallHealth: health?.overall || 'unknown',
        activeThreats: recentFraudAlerts.length,
        userSpecificAlerts: userFraudAlerts.length,
        lastBackup: lastBackup ? {
          timestamp: lastBackup.timestamp,
          ageInDays: Math.floor((Date.now() - lastBackup.timestamp.getTime()) / (1000 * 60 * 60 * 24)),
        } : null,
      },
    };
    
    return res.json({
      success: true,
      data: response,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to generate security recommendations',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
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