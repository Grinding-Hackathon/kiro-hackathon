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