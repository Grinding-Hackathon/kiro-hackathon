import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createServer } from 'http';
import swaggerUi from 'swagger-ui-express';

import { config } from '@/config/config';
import { logger, auditLogger } from '@/utils/logger';
import { errorHandler, fraudDetectionMiddleware } from '@/middleware/errorHandler';
import { rateLimiter, trackSuspiciousActivity, progressiveDelay, ddosProtection } from '@/middleware/rateLimiter';
import { metricsMiddleware, metricsHandler } from '@/middleware/metrics';
import { initializeDatabase, closeDatabase } from '@/database/init';
import { swaggerSpec, swaggerOptions } from '@/config/swagger';
import { healthMonitoringService } from '@/services/healthMonitoringService';
import { backupService } from '@/services/backupService';
import { fraudDetectionService } from '@/services/fraudDetectionService';
import apiRoutes from '@/routes';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const server = createServer(app);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.cors.origin,
  credentials: true,
}));

// Logging middleware
app.use(morgan('combined', {
  stream: {
    write: (message: string) => logger.info(message.trim()),
  },
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Metrics middleware (before other middleware to capture all requests)
app.use(metricsMiddleware);

// Security middleware
app.use(ddosProtection);
app.use(trackSuspiciousActivity);
app.use(progressiveDelay);
app.use(rateLimiter);
app.use(fraudDetectionMiddleware);

// Metrics endpoint
app.get('/metrics', metricsHandler);

// Health check endpoint
app.get('/health', async (_req, res) => {
  try {
    const systemHealth = await healthMonitoringService.forceHealthCheck();
    res.status(systemHealth.overall === 'healthy' ? 200 : 503).json({
      status: systemHealth.overall.toUpperCase(),
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.env,
      checks: systemHealth.checks,
    });
  } catch (error) {
    res.status(503).json({
      status: 'UNHEALTHY',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.env,
      error: 'Health check failed',
    });
  }
});

// API Documentation
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerOptions));

// API routes
app.use('/api/v1', apiRoutes);

// Catch-all for undefined API routes
app.use('/api/*', (_req, res) => {
  res.status(404).json({
    success: false,
    error: 'API endpoint not found',
    message: 'The requested API endpoint does not exist',
    timestamp: new Date().toISOString(),
  });
});

// Error handling middleware
app.use(errorHandler);

// Initialize database and start server
async function startServer() {
  try {
    // Initialize database
    await initializeDatabase();
    logger.info('✅ Database initialized successfully');

    // Initialize security services
    healthMonitoringService.startMonitoring();
    backupService.scheduleAutomaticBackups();
    fraudDetectionService.startPeriodicScans();
    logger.info('✅ Security services initialized');

    // Log system startup
    await auditLogger.logSystem({
      action: 'SYSTEM_START',
      details: {
        environment: config.env,
        port: config.port,
        host: config.host,
      },
    });

    // Start server
    const PORT = config.port;
    const HOST = config.host;

    server.listen(PORT, HOST, () => {
      logger.info(`🚀 Server running on http://${HOST}:${PORT}`);
      logger.info(`📊 Environment: ${config.env}`);
      logger.info(`🔒 CORS enabled for: ${config.cors.origin}`);
      logger.info(`💾 Database connected to: ${config.database.name}`);
      logger.info(`🛡️  Security monitoring active`);
      logger.info(`💾 Automatic backups scheduled`);
    });
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  // Log system shutdown
  await auditLogger.logSystem({
    action: 'SYSTEM_SHUTDOWN',
    details: { signal: 'SIGTERM' },
  });
  
  server.close(async () => {
    // Stop monitoring services
    healthMonitoringService.stopMonitoring();
    
    await closeDatabase();
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  
  // Log system shutdown
  await auditLogger.logSystem({
    action: 'SYSTEM_SHUTDOWN',
    details: { signal: 'SIGINT' },
  });
  
  server.close(async () => {
    // Stop monitoring services
    healthMonitoringService.stopMonitoring();
    
    await closeDatabase();
    logger.info('Process terminated');
    process.exit(0);
  });
});

export { app, server };