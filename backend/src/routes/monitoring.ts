import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { errorMonitoringService } from '../services/errorMonitoringService';
import { ResponseBuilder } from '../utils/responseBuilder';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

/**
 * @swagger
 * /api/v1/monitoring/errors:
 *   get:
 *     summary: Get error monitoring statistics
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Error statistics retrieved successfully
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
 *                     totalErrors:
 *                       type: number
 *                     errorsByCategory:
 *                       type: object
 *                     errorsByCode:
 *                       type: object
 *                     recentErrorRate:
 *                       type: number
 *                     topErrors:
 *                       type: array
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 */
router.get('/errors', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const requestId = ResponseBuilder.getRequestId(req);
  
  // Only allow admin users to access monitoring data
  const user = (req as any).user;
  if (!user || user.role !== 'admin') {
    const response = ResponseBuilder.authorizationError(
      'Admin access required for monitoring data',
      requestId
    );
    return res.status(403).json(response);
  }

  const statistics = errorMonitoringService.getErrorStatistics();
  
  const response = ResponseBuilder.success(statistics, 'Error statistics retrieved', requestId);
  return res.json(response);
}));

/**
 * @swagger
 * /api/v1/monitoring/health:
 *   get:
 *     summary: Get system health status
 *     tags: [Monitoring]
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
 *                     status:
 *                       type: string
 *                     timestamp:
 *                       type: string
 *                     uptime:
 *                       type: number
 *                     memory:
 *                       type: object
 *                     errors:
 *                       type: object
 */
router.get('/health', asyncHandler(async (req: Request, res: Response) => {
  const requestId = ResponseBuilder.getRequestId(req);
  
  const statistics = errorMonitoringService.getErrorStatistics();
  const memoryUsage = process.memoryUsage();
  
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      external: Math.round(memoryUsage.external / 1024 / 1024),
    },
    errors: {
      recentErrorRate: statistics.recentErrorRate,
      totalErrors: statistics.totalErrors,
    },
  };
  
  const response = ResponseBuilder.success(healthData, 'System health retrieved', requestId);
  res.json(response);
}));

/**
 * @swagger
 * /api/v1/monitoring/alerts/thresholds:
 *   put:
 *     summary: Update alert thresholds
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               errorRate:
 *                 type: object
 *                 properties:
 *                   window:
 *                     type: number
 *                   threshold:
 *                     type: number
 *               criticalErrors:
 *                 type: object
 *                 properties:
 *                   window:
 *                     type: number
 *                   threshold:
 *                     type: number
 *     responses:
 *       200:
 *         description: Alert thresholds updated successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 */
router.put('/alerts/thresholds', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const requestId = ResponseBuilder.getRequestId(req);
  
  // Only allow admin users to update thresholds
  const user = (req as any).user;
  if (!user || user.role !== 'admin') {
    const response = ResponseBuilder.authorizationError(
      'Admin access required to update alert thresholds',
      requestId
    );
    return res.status(403).json(response);
  }

  const thresholds = req.body;
  errorMonitoringService.updateAlertThresholds(thresholds);
  
  const response = ResponseBuilder.success(
    { updated: true },
    'Alert thresholds updated successfully',
    requestId
  );
  return res.json(response);
}));

export default router;