import request from 'supertest';
import { app } from '../../index';

// Mock the services
jest.mock('../../services/healthMonitoringService');
jest.mock('../../services/fraudDetectionService');
jest.mock('../../services/backupService');
jest.mock('../../middleware/rateLimiter');
jest.mock('../../middleware/auth');
jest.mock('../../utils/logger');

describe('Security Event Reporting and Recommendations', () => {
  const jwt = require('jsonwebtoken');
  const testUserId = 'test-user-123';
  const authToken = `Bearer ${jwt.sign({ userId: testUserId }, process.env['JWT_SECRET'] || 'test-secret', { expiresIn: '1h' })}`;

  beforeAll(() => {
    // Mock auth middleware to always pass
    const authMiddleware = require('../../middleware/auth');
    authMiddleware.authMiddleware = jest.fn((req: any, _res: any, next: any) => {
      req.user = { id: testUserId };
      next();
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup service mocks
    const healthMonitoringService = require('../../services/healthMonitoringService');
    const fraudDetectionService = require('../../services/fraudDetectionService');
    const backupService = require('../../services/backupService');
    const rateLimiter = require('../../middleware/rateLimiter');
    const logger = require('../../utils/logger');

    healthMonitoringService.healthMonitoringService = {
      getCurrentHealth: jest.fn().mockReturnValue({
        overall: 'healthy',
        uptime: 86400,
        checks: [
          { service: 'database', status: 'healthy', responseTime: 10, timestamp: new Date(), message: 'OK' },
          { service: 'blockchain', status: 'healthy', responseTime: 50, timestamp: new Date(), message: 'OK' },
        ],
        timestamp: new Date(),
      }),
      getActiveAlerts: jest.fn().mockReturnValue([]),
    };

    fraudDetectionService.fraudDetectionService = {
      getRecentAlerts: jest.fn().mockReturnValue([]),
      analyzeTransaction: jest.fn().mockResolvedValue([]),
    };

    backupService.backupService = {
      getBackupHistory: jest.fn().mockReturnValue([
        {
          id: 'backup-1',
          filename: 'backup-2024-01-01.sql',
          type: 'full',
          status: 'completed',
          timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
          size: 1024000,
          checksum: 'abc123',
        },
      ]),
    };

    rateLimiter.getSecurityMetrics = jest.fn().mockReturnValue({
      blockedIPs: [],
      suspiciousIPs: [],
      ddosPatterns: {
        rapidRequests: [],
        largePayloads: [],
        repeatedPaths: [],
      },
    });

    logger.auditLogger = {
      logSecurity: jest.fn().mockResolvedValue(undefined),
      logSystem: jest.fn().mockResolvedValue(undefined),
    };
  });

  describe('POST /api/v1/security/events', () => {
    const validSecurityEvent = {
      eventType: 'SUSPICIOUS_ACTIVITY',
      severity: 'MEDIUM',
      description: 'Unusual login pattern detected',
      metadata: {
        loginAttempts: 5,
        timeWindow: '5 minutes',
      },
      deviceInfo: {
        platform: 'iOS',
        version: '17.0',
        model: 'iPhone 14',
      },
    };

    it('should successfully report a security event', async () => {
      const response = await request(app)
        .post('/api/v1/security/events')
        .set('Authorization', authToken)
        .send(validSecurityEvent);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.eventId).toBeDefined();
      expect(response.body.data.status).toBe('processed');
      expect(response.body.data.severity).toBe('MEDIUM');
      expect(response.body.data.recommendations).toBeDefined();
      expect(response.body.message).toContain('Security event reported');
    });

    it('should handle critical security events with appropriate response', async () => {
      const criticalEvent = {
        ...validSecurityEvent,
        severity: 'CRITICAL',
        eventType: 'DEVICE_COMPROMISE',
        description: 'Device jailbreak detected',
      };

      const response = await request(app)
        .post('/api/v1/security/events')
        .set('Authorization', authToken)
        .send(criticalEvent);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.severity).toBe('CRITICAL');
      expect(response.body.message).toContain('Critical security event');
      expect(response.body.data.recommendations).toContain('Consider changing your password immediately');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/v1/security/events')
        .send(validSecurityEvent);

      expect(response.status).toBe(401);
    });

    it('should validate required fields', async () => {
      const invalidEvent = {
        eventType: 'SUSPICIOUS_ACTIVITY',
        // Missing severity and description
      };

      const response = await request(app)
        .post('/api/v1/security/events')
        .set('Authorization', authToken)
        .send(invalidEvent);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Missing required fields');
    });

    it('should validate event type', async () => {
      const invalidEvent = {
        ...validSecurityEvent,
        eventType: 'INVALID_EVENT_TYPE',
      };

      const response = await request(app)
        .post('/api/v1/security/events')
        .set('Authorization', authToken)
        .send(invalidEvent);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid event type');
    });

    it('should validate severity level', async () => {
      const invalidEvent = {
        ...validSecurityEvent,
        severity: 'INVALID_SEVERITY',
      };

      const response = await request(app)
        .post('/api/v1/security/events')
        .set('Authorization', authToken)
        .send(invalidEvent);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid severity');
    });

    it('should trigger fraud detection for high severity events', async () => {
      const highSeverityEvent = {
        ...validSecurityEvent,
        severity: 'HIGH',
        eventType: 'UNAUTHORIZED_ACCESS_ATTEMPT',
      };

      const fraudDetectionService = require('../../services/fraudDetectionService');
      
      const response = await request(app)
        .post('/api/v1/security/events')
        .set('Authorization', authToken)
        .send(highSeverityEvent);

      expect(response.status).toBe(200);
      expect(fraudDetectionService.fraudDetectionService.analyzeTransaction).toHaveBeenCalledWith({
        userId: expect.any(String),
        amount: 0,
        type: 'security_event',
        ip: expect.any(String),
      });
    });

    it('should handle different event types correctly', async () => {
      const eventTypes = [
        'JAILBREAK_DETECTED',
        'SCREEN_RECORDING_DETECTED',
        'BLUETOOTH_SECURITY_ISSUE',
        'QR_CODE_SECURITY_ISSUE',
        'TOKEN_MANIPULATION',
      ];

      for (const eventType of eventTypes) {
        const event = {
          ...validSecurityEvent,
          eventType,
        };

        const response = await request(app)
          .post('/api/v1/security/events')
          .set('Authorization', authToken)
          .send(event);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }
    });
  });

  describe('GET /api/v1/security/recommendations', () => {
    it('should return security recommendations', async () => {
      const response = await request(app)
        .get('/api/v1/security/recommendations')
        .set('Authorization', authToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.securityScore).toBeDefined();
      expect(response.body.data.lastUpdated).toBeDefined();
      expect(response.body.data.totalRecommendations).toBeDefined();
      expect(response.body.data.priorityBreakdown).toBeDefined();
      expect(response.body.data.recommendations).toBeInstanceOf(Array);
      expect(response.body.data.systemStatus).toBeDefined();
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/v1/security/recommendations');

      expect(response.status).toBe(401);
    });

    it('should include recommendations based on system conditions', async () => {
      // Test with unhealthy system to trigger high priority recommendations
      const healthMonitoringService = require('../../services/healthMonitoringService');
      healthMonitoringService.healthMonitoringService.getCurrentHealth.mockReturnValue({
        overall: 'unhealthy',
        uptime: 86400,
        checks: [
          { service: 'database', status: 'unhealthy', responseTime: 1000, timestamp: new Date(), message: 'Slow response' },
        ],
        timestamp: new Date(),
      });

      const response = await request(app)
        .get('/api/v1/security/recommendations')
        .set('Authorization', authToken);

      expect(response.status).toBe(200);
      expect(response.body.data.priorityBreakdown.high).toBeGreaterThan(0);
      
      const highPriorityRecs = response.body.data.recommendations.filter(
        (rec: any) => rec.priority === 'high'
      );
      expect(highPriorityRecs.length).toBeGreaterThan(0);
      
      // Should have system health recommendation
      const healthRec = response.body.data.recommendations.find(
        (rec: any) => rec.id === 'system_health_issue'
      );
      expect(healthRec).toBeDefined();
      expect(healthRec.priority).toBe('high');
    });

    it('should recommend backup creation for users without backups', async () => {
      const backupService = require('../../services/backupService');
      backupService.backupService.getBackupHistory.mockReturnValue([]);

      const response = await request(app)
        .get('/api/v1/security/recommendations')
        .set('Authorization', authToken);

      expect(response.status).toBe(200);
      
      const backupRec = response.body.data.recommendations.find(
        (rec: any) => rec.id === 'create_first_backup'
      );
      expect(backupRec).toBeDefined();
      expect(backupRec.priority).toBe('high');
    });

    it('should recommend backup updates for old backups', async () => {
      const backupService = require('../../services/backupService');
      backupService.backupService.getBackupHistory.mockReturnValue([
        {
          id: 'backup-1',
          filename: 'old-backup.sql',
          type: 'full',
          status: 'completed',
          timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
          size: 1024000,
          checksum: 'abc123',
        },
      ]);

      const response = await request(app)
        .get('/api/v1/security/recommendations')
        .set('Authorization', authToken);

      expect(response.status).toBe(200);
      
      const backupRec = response.body.data.recommendations.find(
        (rec: any) => rec.id === 'update_backup'
      );
      expect(backupRec).toBeDefined();
      expect(backupRec.priority).toBe('medium');
    });

    it('should include system health warnings in recommendations', async () => {
      const healthMonitoringService = require('../../services/healthMonitoringService');
      healthMonitoringService.healthMonitoringService.getCurrentHealth.mockReturnValue({
        overall: 'unhealthy',
        uptime: 86400,
        checks: [
          { service: 'database', status: 'unhealthy', responseTime: 1000, timestamp: new Date(), message: 'Slow response' },
        ],
        timestamp: new Date(),
      });

      const response = await request(app)
        .get('/api/v1/security/recommendations')
        .set('Authorization', authToken);

      expect(response.status).toBe(200);
      
      const healthRec = response.body.data.recommendations.find(
        (rec: any) => rec.id === 'system_health_issue'
      );
      expect(healthRec).toBeDefined();
      expect(healthRec.priority).toBe('high');
    });

    it('should calculate security score based on recommendations', async () => {
      // Setup conditions that should lower security score
      const fraudDetectionService = require('../../services/fraudDetectionService');
      fraudDetectionService.fraudDetectionService.getRecentAlerts.mockReturnValue([
        {
          id: 'alert-1',
          type: 'SUSPICIOUS_TRANSACTION',
          severity: 'HIGH',
          userId: testUserId,
          description: 'Suspicious transaction detected',
          timestamp: new Date(),
          metadata: {},
        },
      ]);

      const backupService = require('../../services/backupService');
      backupService.backupService.getBackupHistory.mockReturnValue([]);

      const response = await request(app)
        .get('/api/v1/security/recommendations')
        .set('Authorization', authToken);

      expect(response.status).toBe(200);
      expect(response.body.data.securityScore).toBeLessThan(100);
    });

    it('should include actionable recommendations with proper action objects', async () => {
      const response = await request(app)
        .get('/api/v1/security/recommendations')
        .set('Authorization', authToken);

      expect(response.status).toBe(200);
      
      const actionableRecs = response.body.data.recommendations.filter(
        (rec: any) => rec.actionable === true
      );
      
      expect(actionableRecs.length).toBeGreaterThan(0);
      
      actionableRecs.forEach((rec: any) => {
        expect(rec.action).toBeDefined();
        expect(rec.action.type).toBeDefined();
        expect(rec.action.label).toBeDefined();
      });
    });

    it('should handle service errors gracefully', async () => {
      const healthMonitoringService = require('../../services/healthMonitoringService');
      healthMonitoringService.healthMonitoringService.getCurrentHealth.mockImplementation(() => {
        throw new Error('Service unavailable');
      });

      const response = await request(app)
        .get('/api/v1/security/recommendations')
        .set('Authorization', authToken);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to generate security recommendations');
    });
  });
});