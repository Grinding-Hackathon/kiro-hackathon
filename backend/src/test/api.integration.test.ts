import request from 'supertest';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';

import { config } from '../config/config';
import { errorHandler } from '../middleware/errorHandler';
import { rateLimiter } from '../middleware/rateLimiter';
import { swaggerSpec, swaggerOptions } from '../config/swagger';
import apiRoutes from '../routes';

// Create a test app instance without starting the server
const createTestApp = () => {
  const app = express();

  // Security middleware
  app.use(helmet());
  app.use(cors({
    origin: config.cors.origin,
    credentials: true,
  }));

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Rate limiting
  app.use(rateLimiter);

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.env,
    });
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

  return app;
};

describe('API Integration Tests', () => {
  let app: express.Application;

  beforeAll(() => {
    app = createTestApp();
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('OK');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
    });
  });

  describe('API Documentation', () => {
    it('should serve Swagger documentation', async () => {
      const response = await request(app).get('/api/docs/');
      
      expect(response.status).toBe(200);
      expect(response.text).toContain('Offline Wallet API Documentation');
    });
  });

  describe('Public Endpoints', () => {
    it('should return OTM public key', async () => {
      const response = await request(app).get('/api/v1/wallet/keys/public');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('publicKey');
      expect(response.body.data).toHaveProperty('walletAddress');
    });

    it('should return nonce for valid wallet address', async () => {
      const response = await request(app)
        .get('/api/v1/auth/nonce')
        .query({ walletAddress: '0x742d35Cc6634C0532925a3b8D4C0C8b3C2e1e1e1' });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('nonce');
      expect(response.body.data).toHaveProperty('message');
    });
  });

  describe('Protected Endpoints', () => {
    it('should return 401 for protected endpoints without auth', async () => {
      const response = await request(app).get('/api/v1/wallet/balance');
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Authorization header is required');
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent API endpoints', async () => {
      const response = await request(app).get('/api/v1/non-existent');
      
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('API endpoint not found');
    });

    it('should handle validation errors properly', async () => {
      const response = await request(app)
        .get('/api/v1/auth/nonce')
        .query({ walletAddress: 'invalid-address' });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid wallet address');
    });
  });
});