import request from 'supertest';
import { app } from '../../index';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';

// Mock the services
jest.mock('../../services/healthMonitoringService');
jest.mock('../../services/fraudDetectionService');
jest.mock('../../services/backupService');
jest.mock('../../middleware/rateLimiter');
jest.mock('../../middleware/auth');

describe('Mobile Security Status Endpoint', () => {
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
  });

  describe('GET /api/v1/security/mobile/status', () => {
    it('should return secure status when all systems are healthy', async () => {
      const response = await request(app)
        .get('/api/v1/security/mobile/status')
        .set('Authorization', authToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.overallStatus).toBe('secure');
      expect(response.body.data.securityScore).toBe(100);
      expect(response.body.data.systemHealth.status).toBe('healthy');
      expect(response.body.data.alerts.critical).toBe(0);
      expect(response.body.data.backup.recommendBackup).toBe(false);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/v1/security/mobile/status');

      expect(response.status).toBe(401);
    });

    it('should handle service errors gracefully', async () => {
      const healthMonitoringService = require('../../services/healthMonitoringService');
      healthMonitoringService.healthMonitoringService.getCurrentHealth.mockReturnValue(null);

      const response = await request(app)
        .get('/api/v1/security/mobile/status')
        .set('Authorization', authToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.systemHealth.status).toBe('unknown');
    });
  });
});