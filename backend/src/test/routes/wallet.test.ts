import request from 'supertest';
import express from 'express';
import walletRoutes from '../../routes/wallet';
import { authMiddleware } from '../../middleware/auth';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { afterEach } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';

// Mock dependencies
jest.mock('../../middleware/auth');
jest.mock('../../controllers/walletController');

const mockAuthMiddleware = authMiddleware as jest.MockedFunction<typeof authMiddleware>;

describe('Wallet Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Mock auth middleware to pass through
    mockAuthMiddleware.mockImplementation((req, _res, next) => {
      (req as any).user = {
        id: 'user123',
        walletAddress: '0x1234567890123456789012345678901234567890',
        publicKey: 'publickey123'
      };
      next();
    });

    app.use('/api/v1/wallet', walletRoutes);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Route Registration', () => {
    it('should register GET /balance route', async () => {
      const response = await request(app)
        .get('/api/v1/wallet/balance');
      
      // Should not return 404 (route exists)
      expect(response.status).not.toBe(404);
    });

    it('should register GET /history route', async () => {
      const response = await request(app)
        .get('/api/v1/wallet/history');
      
      // Should not return 404 (route exists)
      expect(response.status).not.toBe(404);
    });

    it('should register GET /:walletId/balance route', async () => {
      const response = await request(app)
        .get('/api/v1/wallet/user123/balance');
      
      // Should not return 404 (route exists)
      expect(response.status).not.toBe(404);
    });

    it('should register POST /tokens/purchase route', async () => {
      const response = await request(app)
        .post('/api/v1/wallet/tokens/purchase')
        .send({ amount: 100 });
      
      // Should not return 404 (route exists)
      expect(response.status).not.toBe(404);
    });

    it('should register POST /tokens/redeem route', async () => {
      const response = await request(app)
        .post('/api/v1/wallet/tokens/redeem')
        .send({ tokens: [{ id: 'token1', signature: 'sig1' }] });
      
      // Should not return 404 (route exists)
      expect(response.status).not.toBe(404);
    });

    it('should register GET /keys/public route', async () => {
      const response = await request(app)
        .get('/api/v1/wallet/keys/public');
      
      // Should not return 404 (route exists)
      expect(response.status).not.toBe(404);
    });
  });

  describe('Route Parameters', () => {
    it('should handle wallet history with query parameters', async () => {
      const response = await request(app)
        .get('/api/v1/wallet/history')
        .query({
          page: '2',
          limit: '10',
          type: 'token_purchase',
          status: 'completed',
          sortBy: 'amount',
          sortOrder: 'desc'
        });
      
      // Should not return 404 (route exists and handles query params)
      expect(response.status).not.toBe(404);
    });

    it('should handle wallet balance by ID with path parameter', async () => {
      const walletId = 'user123';
      const response = await request(app)
        .get(`/api/v1/wallet/${walletId}/balance`);
      
      // Should not return 404 (route exists and handles path params)
      expect(response.status).not.toBe(404);
    });
  });

  describe('Route Order', () => {
    it('should prioritize specific routes over parameterized routes', async () => {
      // Test that /history comes before /:walletId/balance
      const historyResponse = await request(app)
        .get('/api/v1/wallet/history');
      
      const balanceResponse = await request(app)
        .get('/api/v1/wallet/user123/balance');
      
      // Both should exist and not conflict
      expect(historyResponse.status).not.toBe(404);
      expect(balanceResponse.status).not.toBe(404);
    });
  });
});