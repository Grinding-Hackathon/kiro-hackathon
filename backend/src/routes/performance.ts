import { Router } from 'express';
import { performanceMonitoringService } from '../services/performanceMonitoringService';
import { cacheService } from '../services/cacheService';
import { queryOptimizationService } from '../services/queryOptimizationService';
import { authMiddleware as auth } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

// Get current performance metrics
router.get('/metrics', auth, (_req, res) => {
  try {
    const metrics = performanceMonitoringService.getMetrics();
    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get performance metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve performance metrics'
    });
  }
});

// Get performance alerts
router.get('/alerts', auth, (req, res) => {
  try {
    const includeResolved = req.query['includeResolved'] === 'true';
    const alerts = performanceMonitoringService.getAlerts(includeResolved);
    
    res.json({
      success: true,
      data: alerts,
      count: alerts.length
    });
  } catch (error) {
    logger.error('Failed to get performance alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve performance alerts'
    });
  }
});

// Get active alerts only
router.get('/alerts/active', auth, (_req, res) => {
  try {
    const activeAlerts = performanceMonitoringService.getActiveAlerts();
    
    res.json({
      success: true,
      data: activeAlerts,
      count: activeAlerts.length
    });
  } catch (error) {
    logger.error('Failed to get active alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve active alerts'
    });
  }
});

// Resolve an alert
router.post('/alerts/:alertId/resolve', auth, (req, res) => {
  try {
    const { alertId } = req.params;
    if (!alertId) {
      res.status(400).json({
        success: false,
        error: 'Alert ID is required'
      });
      return;
    }
    const resolved = performanceMonitoringService.resolveAlert(alertId);
    
    if (resolved) {
      res.json({
        success: true,
        message: 'Alert resolved successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Alert not found or already resolved'
      });
    }
  } catch (error) {
    logger.error('Failed to resolve alert:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resolve alert'
    });
  }
});

// Get performance report
router.get('/report', auth, (_req, res) => {
  try {
    const report = performanceMonitoringService.generateReport();
    
    res.json({
      success: true,
      data: report,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to generate performance report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate performance report'
    });
  }
});

// Get alert thresholds
router.get('/thresholds', auth, (_req, res) => {
  try {
    const thresholds = performanceMonitoringService.getThresholds();
    
    res.json({
      success: true,
      data: thresholds
    });
  } catch (error) {
    logger.error('Failed to get alert thresholds:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve alert thresholds'
    });
  }
});

// Update alert thresholds
router.put('/thresholds', auth, (req, res) => {
  try {
    const { body } = req;
    
    // Validate threshold values
    const validThresholds = ['responseTimeMs', 'errorRatePercent', 'cpuUsagePercent', 'memoryUsagePercent', 'cacheHitRatePercent', 'slowQueryMs'];
    const updates: any = {};
    
    for (const [key, value] of Object.entries(body)) {
      if (validThresholds.includes(key) && typeof value === 'number' && value > 0) {
        updates[key] = value;
      }
    }
    
    if (Object.keys(updates).length === 0) {
      res.status(400).json({
        success: false,
        error: 'No valid threshold updates provided'
      });
      return;
    }
    
    performanceMonitoringService.updateThresholds(updates);
    
    res.json({
      success: true,
      message: 'Thresholds updated successfully',
      data: performanceMonitoringService.getThresholds()
    });
  } catch (error) {
    logger.error('Failed to update alert thresholds:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update alert thresholds'
    });
  }
});

// Get cache metrics
router.get('/cache', auth, (_req, res) => {
  try {
    const cacheMetrics = cacheService.getMetrics();
    const hitRate = cacheService.getHitRate();
    const isHealthy = cacheService.isHealthy();
    
    res.json({
      success: true,
      data: {
        metrics: cacheMetrics,
        hitRate,
        isHealthy
      }
    });
  } catch (error) {
    logger.error('Failed to get cache metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve cache metrics'
    });
  }
});

// Get database query metrics
router.get('/database', auth, (_req, res) => {
  try {
    const queryMetrics = queryOptimizationService.getMetrics();
    
    res.json({
      success: true,
      data: queryMetrics
    });
  } catch (error) {
    logger.error('Failed to get database metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve database metrics'
    });
  }
});

// Get database query analysis
router.get('/database/analysis', auth, async (_req, res) => {
  try {
    const analysis = await queryOptimizationService.analyzeQueryPerformance();
    
    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    logger.error('Failed to analyze query performance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze query performance'
    });
  }
});

// Reset performance metrics
router.post('/reset', auth, (_req, res) => {
  try {
    performanceMonitoringService.resetMetrics();
    cacheService.resetMetrics();
    queryOptimizationService.resetMetrics();
    
    res.json({
      success: true,
      message: 'Performance metrics reset successfully'
    });
  } catch (error) {
    logger.error('Failed to reset performance metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset performance metrics'
    });
  }
});

// System health check with performance data
router.get('/health', (_req, res) => {
  try {
    const metrics = performanceMonitoringService.getMetrics();
    const activeAlerts = performanceMonitoringService.getActiveAlerts();
    const cacheHealthy = cacheService.isHealthy();
    
    const status = activeAlerts.length === 0 && cacheHealthy ? 'healthy' : 'degraded';
    
    res.json({
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      performance: {
        responseTime: metrics.responseTime.average,
        errorRate: metrics.errorRate.rate,
        memoryUsage: metrics.systemResources.memoryUsage.percentage,
        cpuUsage: metrics.systemResources.cpuUsage,
        cacheHitRate: metrics.cache.hitRate
      },
      alerts: {
        active: activeAlerts.length,
        critical: activeAlerts.filter(a => a.severity === 'critical').length
      },
      services: {
        cache: cacheHealthy ? 'healthy' : 'unhealthy',
        database: 'healthy' // Could add database health check
      }
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: 'Health check failed'
    });
  }
});

export default router;