import { Router } from 'express';
import { authMiddleware as auth } from '@/middleware/auth';
import { rateLimiter } from '@/middleware/rateLimiter';
import {
  getSystemHealth,
  getHealthAlerts,
  getFraudAlerts,
  getBackupHistory,
  createBackup,
  verifyBackup,
  getSecurityMetrics,
  getSecurityDetails,
  getDisasterRecoveryStatus,
  testRecoveryProcedures,
  createDisasterRecoveryPlan,
  getMobileSecurityStatus,
  reportSecurityEvent,
  getSecurityRecommendations,
  triggerSecurityScan,
} from '@/controllers/securityController';

const router = Router();

// Apply authentication and rate limiting to all security routes
router.use(auth);
router.use(rateLimiter);

/**
 * @swagger
 * /api/security/health:
 *   get:
 *     summary: Get system health status
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System health status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     overall:
 *                       type: string
 *                       enum: [healthy, degraded, unhealthy]
 *                     checks:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           service:
 *                             type: string
 *                           status:
 *                             type: string
 *                           responseTime:
 *                             type: number
 *                           message:
 *                             type: string
 *                     uptime:
 *                       type: number
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 */
router.get('/health', getSystemHealth);

/**
 * @swagger
 * /api/security/health/alerts:
 *   get:
 *     summary: Get active health alerts
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Active health alerts
 */
router.get('/health/alerts', getHealthAlerts);

/**
 * @swagger
 * /api/security/fraud/alerts:
 *   get:
 *     summary: Get fraud detection alerts
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *           enum: [LOW, MEDIUM, HIGH, CRITICAL]
 *         description: Filter by alert severity
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *         description: Maximum number of alerts to return
 *     responses:
 *       200:
 *         description: Fraud detection alerts
 */
router.get('/fraud/alerts', getFraudAlerts);

/**
 * @swagger
 * /api/security/backups:
 *   get:
 *     summary: Get backup history
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Backup history
 */
router.get('/backups', getBackupHistory);

/**
 * @swagger
 * /api/security/backups:
 *   post:
 *     summary: Create manual backup
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [full, incremental, logs]
 *                 description: Type of backup to create
 *     responses:
 *       200:
 *         description: Backup created successfully
 *       400:
 *         description: Invalid backup type
 *       500:
 *         description: Backup creation failed
 */
router.post('/backups', createBackup);

/**
 * @swagger
 * /api/security/backups/{backupId}/verify:
 *   get:
 *     summary: Verify backup integrity
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: backupId
 *         required: true
 *         schema:
 *           type: string
 *         description: Backup ID to verify
 *     responses:
 *       200:
 *         description: Backup verification result
 *       404:
 *         description: Backup not found
 */
router.get('/backups/:backupId/verify', verifyBackup);

/**
 * @swagger
 * /api/security/metrics:
 *   get:
 *     summary: Get security metrics dashboard
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Security metrics and dashboard data
 */
router.get('/metrics', getSecurityMetrics);

/**
 * @swagger
 * /api/security/details:
 *   get:
 *     summary: Get detailed security information
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Detailed security information including rate limiting, fraud detection, and health monitoring
 */
router.get('/details', getSecurityDetails);

/**
 * @swagger
 * /api/security/disaster-recovery/status:
 *   get:
 *     summary: Get disaster recovery status
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Disaster recovery status and recommendations
 */
router.get('/disaster-recovery/status', getDisasterRecoveryStatus);

/**
 * @swagger
 * /api/security/disaster-recovery/test:
 *   post:
 *     summary: Test recovery procedures
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Recovery procedures test results
 *       500:
 *         description: Recovery test failed
 */
router.post('/disaster-recovery/test', testRecoveryProcedures);

/**
 * @swagger
 * /api/security/disaster-recovery/plan:
 *   post:
 *     summary: Create disaster recovery plan
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Disaster recovery plan created successfully
 *       500:
 *         description: Failed to create disaster recovery plan
 */
router.post('/disaster-recovery/plan', createDisasterRecoveryPlan);

/**
 * @swagger
 * /api/security/mobile/status:
 *   get:
 *     summary: Get mobile security status
 *     description: Get security status information tailored for mobile app display
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Mobile security status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     overallStatus:
 *                       type: string
 *                       enum: [secure, warning, critical]
 *                     securityScore:
 *                       type: number
 *                       minimum: 0
 *                       maximum: 100
 *                     lastUpdated:
 *                       type: string
 *                       format: date-time
 *                     systemHealth:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                         uptime:
 *                           type: number
 *                         servicesOnline:
 *                           type: number
 *                         totalServices:
 *                           type: number
 *                     alerts:
 *                       type: object
 *                       properties:
 *                         critical:
 *                           type: number
 *                         userSpecific:
 *                           type: number
 *                         total:
 *                           type: number
 *                     backup:
 *                       type: object
 *                       properties:
 *                         lastBackup:
 *                           type: object
 *                           nullable: true
 *                         recommendBackup:
 *                           type: boolean
 *                     security:
 *                       type: object
 *                       properties:
 *                         blockedThreats:
 *                           type: number
 *                         suspiciousActivity:
 *                           type: number
 *                         ddosProtection:
 *                           type: object
 *                     recommendations:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           title:
 *                             type: string
 *                           description:
 *                             type: string
 *                           priority:
 *                             type: string
 *                             enum: [high, medium, low]
 *                           actionable:
 *                             type: boolean
 */
router.get('/mobile/status', getMobileSecurityStatus);

/**
 * @swagger
 * /api/security/events:
 *   post:
 *     summary: Report security event from mobile app
 *     description: Allow mobile app to report security events for monitoring and fraud detection
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - eventType
 *               - severity
 *               - description
 *             properties:
 *               eventType:
 *                 type: string
 *                 enum: [
 *                   SUSPICIOUS_ACTIVITY,
 *                   UNAUTHORIZED_ACCESS_ATTEMPT,
 *                   DEVICE_COMPROMISE,
 *                   UNUSUAL_BEHAVIOR,
 *                   SECURITY_BREACH,
 *                   MALWARE_DETECTED,
 *                   PHISHING_ATTEMPT,
 *                   SOCIAL_ENGINEERING,
 *                   DATA_LEAK,
 *                   AUTHENTICATION_FAILURE,
 *                   BIOMETRIC_FAILURE,
 *                   JAILBREAK_DETECTED,
 *                   DEBUG_MODE_DETECTED,
 *                   SCREEN_RECORDING_DETECTED,
 *                   SCREENSHOT_DETECTED,
 *                   NETWORK_ANOMALY,
 *                   BLUETOOTH_SECURITY_ISSUE,
 *                   QR_CODE_SECURITY_ISSUE,
 *                   TOKEN_MANIPULATION,
 *                   TRANSACTION_ANOMALY,
 *                   WALLET_TAMPERING,
 *                   BACKUP_SECURITY_ISSUE,
 *                   OTHER
 *                 ]
 *                 description: Type of security event
 *               severity:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH, CRITICAL]
 *                 description: Severity level of the event
 *               description:
 *                 type: string
 *                 description: Detailed description of the security event
 *               metadata:
 *                 type: object
 *                 description: Additional metadata about the event
 *               deviceInfo:
 *                 type: object
 *                 description: Device information for context
 *     responses:
 *       200:
 *         description: Security event reported successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     eventId:
 *                       type: string
 *                     status:
 *                       type: string
 *                     severity:
 *                       type: string
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                     recommendations:
 *                       type: array
 *                       items:
 *                         type: string
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid request data
 *       500:
 *         description: Failed to process security event
 */
router.post('/events', reportSecurityEvent);

/**
 * @swagger
 * /api/security/recommendations:
 *   get:
 *     summary: Get security recommendations for mobile users
 *     description: Get personalized security recommendations based on user behavior and current threat landscape
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Security recommendations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     securityScore:
 *                       type: number
 *                       minimum: 0
 *                       maximum: 100
 *                     lastUpdated:
 *                       type: string
 *                       format: date-time
 *                     totalRecommendations:
 *                       type: number
 *                     priorityBreakdown:
 *                       type: object
 *                       properties:
 *                         high:
 *                           type: number
 *                         medium:
 *                           type: number
 *                         low:
 *                           type: number
 *                     recommendations:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           category:
 *                             type: string
 *                             enum: [authentication, device_security, transaction_safety, backup, monitoring, general]
 *                           title:
 *                             type: string
 *                           description:
 *                             type: string
 *                           priority:
 *                             type: string
 *                             enum: [high, medium, low]
 *                           actionable:
 *                             type: boolean
 *                           action:
 *                             type: object
 *                             nullable: true
 *                           completed:
 *                             type: boolean
 *                             nullable: true
 *                     systemStatus:
 *                       type: object
 *                       properties:
 *                         overallHealth:
 *                           type: string
 *                         activeThreats:
 *                           type: number
 *                         userSpecificAlerts:
 *                           type: number
 *                         lastBackup:
 *                           type: object
 *                           nullable: true
 *       500:
 *         description: Failed to generate security recommendations
 */
router.get('/recommendations', getSecurityRecommendations);

/**
 * @swagger
 * /api/security/scan:
 *   post:
 *     summary: Trigger security scan
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - scanType
 *             properties:
 *               scanType:
 *                 type: string
 *                 enum: [health, fraud, backup_integrity]
 *                 description: Type of security scan to perform
 *     responses:
 *       200:
 *         description: Security scan completed
 *       400:
 *         description: Invalid scan type
 *       500:
 *         description: Security scan failed
 */
router.post('/scan', triggerSecurityScan);

export default router;