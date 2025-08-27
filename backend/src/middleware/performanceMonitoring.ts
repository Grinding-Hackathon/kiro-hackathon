import { Request, Response, NextFunction } from 'express';
import { performanceMonitoringService } from '../services/performanceMonitoringService';
import { logger } from '../utils/logger';

// Extend Request interface to include performance tracking
declare global {
  namespace Express {
    interface Request {
      startTime?: number;
      performanceId?: string;
    }
  }
}

export interface PerformanceTrackingOptions {
  trackResponseTime?: boolean;
  trackMemoryUsage?: boolean;
  trackErrors?: boolean;
  slowRequestThreshold?: number;
  excludePaths?: string[];
}

export const performanceTrackingMiddleware = (options: PerformanceTrackingOptions = {}) => {
  const {
    trackResponseTime = true,
    trackMemoryUsage = false,
    trackErrors = true,
    slowRequestThreshold = 1000,
    excludePaths = ['/metrics', '/health']
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    // Skip tracking for excluded paths
    if (excludePaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    // Start performance tracking
    if (trackResponseTime) {
      req.startTime = Date.now();
      req.performanceId = `${req.method}_${req.path}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Track memory usage before request processing
    let initialMemory: NodeJS.MemoryUsage | undefined;
    if (trackMemoryUsage) {
      initialMemory = process.memoryUsage();
    }

    // Override res.end to capture response metrics
    const originalEnd = res.end.bind(res);
    res.end = function(chunk?: any, encoding?: any) {
      try {
        // Track response time
        if (trackResponseTime && req.startTime) {
          const responseTime = Date.now() - req.startTime;
          performanceMonitoringService.recordResponseTime(responseTime);

          // Log slow requests
          if (responseTime > slowRequestThreshold) {
            logger.warn('Slow request detected:', {
              method: req.method,
              path: req.path,
              responseTime,
              statusCode: res.statusCode,
              performanceId: req.performanceId
            });
          }
        }

        // Track errors
        if (trackErrors && res.statusCode >= 400) {
          performanceMonitoringService.recordError();
          
          logger.error('Request error tracked:', {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            performanceId: req.performanceId
          });
        }

        // Track memory usage after request processing
        if (trackMemoryUsage && initialMemory) {
          const finalMemory = process.memoryUsage();
          const memoryDelta = {
            rss: finalMemory.rss - initialMemory.rss,
            heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
            heapTotal: finalMemory.heapTotal - initialMemory.heapTotal,
            external: finalMemory.external - initialMemory.external
          };

          if (memoryDelta.heapUsed > 10 * 1024 * 1024) { // 10MB threshold
            logger.warn('High memory usage request:', {
              method: req.method,
              path: req.path,
              memoryDelta,
              performanceId: req.performanceId
            });
          }
        }
      } catch (error) {
        logger.error('Performance tracking error:', error);
      }

      return originalEnd(chunk, encoding);
    };

    next();
  };
};

// Middleware for request tracing
export const requestTracingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const traceId = req.headers['x-trace-id'] as string || 
    `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Add trace ID to request
  req.headers['x-trace-id'] = traceId;
  
  // Add trace ID to response headers
  res.setHeader('x-trace-id', traceId);
  
  // Add trace ID to logger context
  const originalLogger = logger;
  (req as any).logger = originalLogger.child({ traceId });
  
  // Log request start
  logger.info('Request started:', {
    traceId,
    method: req.method,
    path: req.path,
    userAgent: req.headers['user-agent'],
    ip: req.ip
  });

  // Log request completion
  res.on('finish', () => {
    logger.info('Request completed:', {
      traceId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      responseTime: req.startTime ? Date.now() - req.startTime : undefined
    });
  });

  next();
};

// Middleware for API endpoint performance monitoring
export const endpointPerformanceMiddleware = (endpointName: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    res.on('finish', () => {
      const responseTime = Date.now() - startTime;
      
      // Record endpoint-specific metrics
      logger.debug(`Endpoint performance: ${endpointName}`, {
        responseTime,
        statusCode: res.statusCode,
        method: req.method
      });
      
      // You could extend this to track per-endpoint metrics
      // in a more granular way if needed
    });
    
    next();
  };
};

// Health check middleware that includes performance metrics
export const healthCheckMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (req.path === '/health') {
    const metrics = performanceMonitoringService.getMetrics();
    const alerts = performanceMonitoringService.getActiveAlerts();
    
    const healthStatus = {
      status: alerts.length === 0 ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      metrics: {
        responseTime: metrics.responseTime.average,
        errorRate: metrics.errorRate.rate,
        memoryUsage: metrics.systemResources.memoryUsage.percentage,
        cpuUsage: metrics.systemResources.cpuUsage
      },
      alerts: alerts.length,
      version: process.env['npm_package_version'] || '1.0.0'
    };
    
    return res.json(healthStatus);
  }
  
  return next();
};

// Performance dashboard middleware
export const performanceDashboardMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (req.path === '/performance') {
    const report = performanceMonitoringService.generateReport();
    return res.json(report);
  }
  
  return next();
};