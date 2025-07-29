import request from 'supertest';
import { app } from '../index';

describe('Security Integration Tests', () => {
  const mockAuthToken = 'Bearer mock-jwt-token';

  // Mock JWT verification for protected routes
  beforeEach(() => {
    // Mock auth middleware to pass through
    jest.doMock('../middleware/auth', () => ({
      authMiddleware: jest.fn((req: any, _res: any, next: any) => {
        req.user = { id: 'user-123', walletAddress: '0x742d35Cc6634C0532925a3b8D4C0C8b3C2e1e1e1' };
        next();
      }),
    }));
  });

  describe('Security Endpoints', () => {
    it('should return system health status', async () => {
      const response = await request(app)
        .get('/api/v1/security/health')
        .set('Authorization', mockAuthToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('overall');
      expect(response.body.data).toHaveProperty('checks');
    });

    it('should return security metrics', async () => {
      const response = await request(app)
        .get('/api/v1/security/metrics')
        .set('Authorization', mockAuthToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('systemHealth');
      expect(response.body.data).toHaveProperty('alerts');
      expect(response.body.data).toHaveProperty('fraud');
      expect(response.body.data).toHaveProperty('backups');
    });

    it('should return fraud alerts', async () => {
      const response = await request(app)
        .get('/api/v1/security/fraud/alerts')
        .set('Authorization', mockAuthToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('alerts');
      expect(response.body.data).toHaveProperty('count');
    });

    it('should return backup history', async () => {
      const response = await request(app)
        .get('/api/v1/security/backups')
        .set('Authorization', mockAuthToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('backups');
      expect(response.body.data).toHaveProperty('count');
    });

    it('should create manual backup', async () => {
      const response = await request(app)
        .post('/api/v1/security/backups')
        .set('Authorization', mockAuthToken)
        .send({ type: 'full' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.type).toBe('full');
    });

    it('should trigger security scan', async () => {
      const response = await request(app)
        .post('/api/v1/security/scan')
        .set('Authorization', mockAuthToken)
        .send({ scanType: 'health' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should return disaster recovery status', async () => {
      const response = await request(app)
        .get('/api/v1/security/disaster-recovery/status')
        .set('Authorization', mockAuthToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('status');
    });
  });

  describe('Security Middleware', () => {
    it('should handle rate limiting gracefully', async () => {
      // Make multiple requests to test rate limiting (should pass due to mocking)
      const promises = Array.from({ length: 5 }, () =>
        request(app).get('/health')
      );

      const responses = await Promise.all(promises);
      
      // All should succeed due to mocking
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    it('should handle DDoS protection gracefully', async () => {
      const response = await request(app)
        .get('/health')
        .set('User-Agent', 'test-agent');

      expect(response.status).toBe(200);
    });
  });
});