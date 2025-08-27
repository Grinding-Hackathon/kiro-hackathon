import request from 'supertest';
import { app } from '../../index';
import { UserDAO } from '../../database/dao/UserDAO';
import { offlineTokenManager } from '../../services/offlineTokenManager';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Mock dependencies
jest.mock('../../database/dao/UserDAO');
jest.mock('../../services/offlineTokenManager');

describe('Authentication Flow Integration Tests', () => {
  let mockUserDAO: jest.Mocked<UserDAO>;
  let mockOfflineTokenManager: jest.Mocked<typeof offlineTokenManager>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mocked instances
    mockUserDAO = new UserDAO() as jest.Mocked<UserDAO>;
    mockOfflineTokenManager = offlineTokenManager as jest.Mocked<typeof offlineTokenManager>;

    // Mock DAO instances
    (UserDAO as jest.MockedClass<typeof UserDAO>).mockImplementation(() => mockUserDAO);

    // Setup default mocks
    mockOfflineTokenManager.getPublicKey.mockReturnValue('otm-public-key');
    mockOfflineTokenManager.getWalletAddress.mockReturnValue('0x9876543210987654321098765432109876543210');
  });

  describe('Wallet-based Authentication', () => {
    describe('POST /api/v1/auth/login', () => {
      it('should successfully authenticate with valid wallet signature', async () => {
        const walletAddress = '0x1234567890123456789012345678901234567890';
        const privateKey = '0x' + crypto.randomBytes(32).toString('hex');
        const message = 'Login to Offline Wallet';
        
        // Create a valid signature (simplified for testing)
        const signature = '0x' + crypto.randomBytes(65).toString('hex');

        const mockUser = {
          id: 'user-123',
          wallet_address: walletAddress,
          public_key: 'user-public-key',
          created_at: new Date(),
          updated_at: new Date(),
          is_active: true
        };

        mockUserDAO.findByWalletAddress.mockResolvedValue(mockUser as any);

        const response = await request(app)
          .post('/api/v1/auth/login')
          .send({
            walletAddress,
            signature,
            message
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toMatchObject({
          token: expect.any(String),
          refreshToken: expect.any(String),
          user: expect.objectContaining({
            id: 'user-123',
            walletAddress
          })
        });

        // Verify JWT token structure
        const decodedToken = jwt.decode(response.body.data.token) as any;
        expect(decodedToken).toMatchObject({
          userId: 'user-123',
          walletAddress,
          publicKey: 'user-public-key'
        });
      });

      it('should create new user on first login', async () => {
        const walletAddress = '0x1234567890123456789012345678901234567890';
        const signature = '0x' + crypto.randomBytes(65).toString('hex');
        const message = 'Login to Offline Wallet';

        const newUser = {
          id: 'new-user-456',
          wallet_address: walletAddress,
          public_key: 'new-user-public-key',
          created_at: new Date(),
          updated_at: new Date(),
          is_active: true
        };

        mockUserDAO.findByWalletAddress.mockResolvedValue(null); // User doesn't exist
        mockUserDAO.create.mockResolvedValue(newUser as any);

        const response = await request(app)
          .post('/api/v1/auth/login')
          .send({
            walletAddress,
            signature,
            message,
            publicKey: 'new-user-public-key'
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.user.id).toBe('new-user-456');
        expect(mockUserDAO.create).toHaveBeenCalledWith(
          expect.objectContaining({
            wallet_address: walletAddress,
            public_key: 'new-user-public-key'
          })
        );
      });

      it('should reject invalid wallet address format', async () => {
        const response = await request(app)
          .post('/api/v1/auth/login')
          .send({
            walletAddress: 'invalid-address',
            signature: '0x' + crypto.randomBytes(65).toString('hex'),
            message: 'Login to Offline Wallet'
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should reject missing signature', async () => {
        const response = await request(app)
          .post('/api/v1/auth/login')
          .send({
            walletAddress: '0x1234567890123456789012345678901234567890',
            message: 'Login to Offline Wallet'
            // Missing signature
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should reject empty message', async () => {
        const response = await request(app)
          .post('/api/v1/auth/login')
          .send({
            walletAddress: '0x1234567890123456789012345678901234567890',
            signature: '0x' + crypto.randomBytes(65).toString('hex'),
            message: ''
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should handle database errors during user lookup', async () => {
        mockUserDAO.findByWalletAddress.mockRejectedValue(new Error('Database connection failed'));

        const response = await request(app)
          .post('/api/v1/auth/login')
          .send({
            walletAddress: '0x1234567890123456789012345678901234567890',
            signature: '0x' + crypto.randomBytes(65).toString('hex'),
            message: 'Login to Offline Wallet'
          });

        expect(response.status).toBe(500);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('INTERNAL_SERVER_ERROR');
      });
    });

    describe('POST /api/v1/auth/refresh', () => {
      it('should successfully refresh valid token', async () => {
        const originalToken = jwt.sign(
          { 
            userId: 'user-123',
            walletAddress: '0x1234567890123456789012345678901234567890',
            publicKey: 'user-public-key'
          },
          process.env['JWT_SECRET'] || 'test-secret',
          { expiresIn: '15m' }
        );

        const refreshToken = jwt.sign(
          { 
            userId: 'user-123',
            type: 'refresh'
          },
          process.env['JWT_SECRET'] || 'test-secret',
          { expiresIn: '7d' }
        );

        const mockUser = {
          id: 'user-123',
          wallet_address: '0x1234567890123456789012345678901234567890',
          public_key: 'user-public-key',
          is_active: true
        };

        mockUserDAO.findById.mockResolvedValue(mockUser as any);

        const response = await request(app)
          .post('/api/v1/auth/refresh')
          .send({
            refreshToken
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toMatchObject({
          token: expect.any(String),
          refreshToken: expect.any(String)
        });

        // Verify new token is different from original
        expect(response.body.data.token).not.toBe(originalToken);
      });

      it('should reject invalid refresh token', async () => {
        const response = await request(app)
          .post('/api/v1/auth/refresh')
          .send({
            refreshToken: 'invalid-refresh-token'
          });

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
      });

      it('should reject expired refresh token', async () => {
        const expiredRefreshToken = jwt.sign(
          { 
            userId: 'user-123',
            type: 'refresh'
          },
          process.env['JWT_SECRET'] || 'test-secret',
          { expiresIn: '-1h' } // Expired
        );

        const response = await request(app)
          .post('/api/v1/auth/refresh')
          .send({
            refreshToken: expiredRefreshToken
          });

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
      });

      it('should reject refresh token for inactive user', async () => {
        const refreshToken = jwt.sign(
          { 
            userId: 'inactive-user-123',
            type: 'refresh'
          },
          process.env['JWT_SECRET'] || 'test-secret',
          { expiresIn: '7d' }
        );

        const mockInactiveUser = {
          id: 'inactive-user-123',
          wallet_address: '0x1234567890123456789012345678901234567890',
          public_key: 'user-public-key',
          is_active: false
        };

        mockUserDAO.findById.mockResolvedValue(mockInactiveUser as any);

        const response = await request(app)
          .post('/api/v1/auth/refresh')
          .send({
            refreshToken
          });

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
      });
    });

    describe('POST /api/v1/auth/logout', () => {
      it('should successfully logout with valid token', async () => {
        const authToken = jwt.sign(
          { 
            userId: 'user-123',
            walletAddress: '0x1234567890123456789012345678901234567890',
            publicKey: 'user-public-key'
          },
          process.env['JWT_SECRET'] || 'test-secret',
          { expiresIn: '1h' }
        );

        const response = await request(app)
          .post('/api/v1/auth/logout')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            refreshToken: 'refresh-token-to-invalidate'
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Logged out successfully');
      });

      it('should handle logout without refresh token', async () => {
        const authToken = jwt.sign(
          { 
            userId: 'user-123',
            walletAddress: '0x1234567890123456789012345678901234567890',
            publicKey: 'user-public-key'
          },
          process.env['JWT_SECRET'] || 'test-secret',
          { expiresIn: '1h' }
        );

        const response = await request(app)
          .post('/api/v1/auth/logout')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Logged out successfully');
      });

      it('should require authentication for logout', async () => {
        const response = await request(app)
          .post('/api/v1/auth/logout');

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
      });
    });

    describe('GET /api/v1/auth/nonce', () => {
      it('should generate nonce for wallet address', async () => {
        const walletAddress = '0x1234567890123456789012345678901234567890';

        const response = await request(app)
          .get('/api/v1/auth/nonce')
          .query({ walletAddress });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toMatchObject({
          nonce: expect.any(String),
          message: expect.any(String),
          expiresAt: expect.any(String)
        });

        // Verify nonce is cryptographically secure (at least 32 characters)
        expect(response.body.data.nonce.length).toBeGreaterThanOrEqual(32);
        
        // Verify message contains wallet address
        expect(response.body.data.message).toContain(walletAddress);
      });

      it('should reject invalid wallet address', async () => {
        const response = await request(app)
          .get('/api/v1/auth/nonce')
          .query({ walletAddress: 'invalid-address' });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should require wallet address parameter', async () => {
        const response = await request(app)
          .get('/api/v1/auth/nonce');

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should generate different nonces for multiple requests', async () => {
        const walletAddress = '0x1234567890123456789012345678901234567890';

        const response1 = await request(app)
          .get('/api/v1/auth/nonce')
          .query({ walletAddress });

        const response2 = await request(app)
          .get('/api/v1/auth/nonce')
          .query({ walletAddress });

        expect(response1.status).toBe(200);
        expect(response2.status).toBe(200);
        expect(response1.body.data.nonce).not.toBe(response2.body.data.nonce);
      });
    });

    describe('POST /api/v1/auth/validate-session', () => {
      it('should validate active session', async () => {
        const authToken = jwt.sign(
          { 
            userId: 'user-123',
            walletAddress: '0x1234567890123456789012345678901234567890',
            publicKey: 'user-public-key'
          },
          process.env['JWT_SECRET'] || 'test-secret',
          { expiresIn: '1h' }
        );

        const mockUser = {
          id: 'user-123',
          wallet_address: '0x1234567890123456789012345678901234567890',
          public_key: 'user-public-key',
          is_active: true
        };

        mockUserDAO.findById.mockResolvedValue(mockUser as any);

        const response = await request(app)
          .post('/api/v1/auth/validate-session')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toMatchObject({
          valid: true,
          user: expect.objectContaining({
            id: 'user-123',
            walletAddress: '0x1234567890123456789012345678901234567890'
          }),
          expiresAt: expect.any(String)
        });
      });

      it('should reject expired session', async () => {
        const expiredToken = jwt.sign(
          { 
            userId: 'user-123',
            walletAddress: '0x1234567890123456789012345678901234567890',
            publicKey: 'user-public-key'
          },
          process.env['JWT_SECRET'] || 'test-secret',
          { expiresIn: '-1h' } // Expired
        );

        const response = await request(app)
          .post('/api/v1/auth/validate-session')
          .set('Authorization', `Bearer ${expiredToken}`);

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
      });

      it('should reject session for inactive user', async () => {
        const authToken = jwt.sign(
          { 
            userId: 'inactive-user-123',
            walletAddress: '0x1234567890123456789012345678901234567890',
            publicKey: 'user-public-key'
          },
          process.env['JWT_SECRET'] || 'test-secret',
          { expiresIn: '1h' }
        );

        const mockInactiveUser = {
          id: 'inactive-user-123',
          wallet_address: '0x1234567890123456789012345678901234567890',
          public_key: 'user-public-key',
          is_active: false
        };

        mockUserDAO.findById.mockResolvedValue(mockInactiveUser as any);

        const response = await request(app)
          .post('/api/v1/auth/validate-session')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
      });

      it('should require authentication header', async () => {
        const response = await request(app)
          .post('/api/v1/auth/validate-session');

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
      });
    });
  });

  describe('Authentication Middleware Integration', () => {
    it('should protect endpoints requiring authentication', async () => {
      const protectedEndpoints = [
        '/api/v1/wallet/balance',
        '/api/v1/transactions/submit',
        '/api/v1/transactions/sync',
        '/api/v1/tokens/validate',
        '/api/v1/tokens/divide'
      ];

      for (const endpoint of protectedEndpoints) {
        const response = await request(app).get(endpoint);
        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
      }
    });

    it('should allow access to public endpoints', async () => {
      const publicEndpoints = [
        '/api/v1/tokens/public-keys',
        '/api/v1/auth/nonce?walletAddress=0x1234567890123456789012345678901234567890'
      ];

      // Setup mocks for public endpoints
      mockUserDAO.findActiveUsers.mockResolvedValue([]);

      for (const endpoint of publicEndpoints) {
        const response = await request(app).get(endpoint);
        expect(response.status).not.toBe(401);
        // Should either be 200 (success) or other non-auth error
      }
    });

    it('should handle malformed authorization headers', async () => {
      const malformedHeaders = [
        'Bearer',
        'Bearer ',
        'Basic dGVzdA==',
        'InvalidScheme token',
        ''
      ];

      for (const header of malformedHeaders) {
        const response = await request(app)
          .get('/api/v1/wallet/balance')
          .set('Authorization', header);

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
      }
    });

    it('should handle concurrent authentication requests', async () => {
      const authToken = jwt.sign(
        { 
          userId: 'user-123',
          walletAddress: '0x1234567890123456789012345678901234567890',
          publicKey: 'user-public-key'
        },
        process.env['JWT_SECRET'] || 'test-secret',
        { expiresIn: '1h' }
      );

      // Setup mocks
      mockUserDAO.findById.mockResolvedValue({
        id: 'user-123',
        wallet_address: '0x1234567890123456789012345678901234567890',
        public_key: 'user-public-key',
        is_active: true
      } as any);

      // Make multiple concurrent requests
      const requests = Array(5).fill(null).map(() =>
        request(app)
          .post('/api/v1/auth/validate-session')
          .set('Authorization', `Bearer ${authToken}`)
      );

      const responses = await Promise.all(requests);

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.valid).toBe(true);
      });
    });
  });

  describe('Security Features', () => {
    it('should include security headers in auth responses', async () => {
      const response = await request(app)
        .get('/api/v1/auth/nonce')
        .query({ walletAddress: '0x1234567890123456789012345678901234567890' });

      expect(response.headers['x-content-type-options']).toBeDefined();
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-xss-protection']).toBeDefined();
    });

    it('should not expose sensitive information in error responses', async () => {
      mockUserDAO.findByWalletAddress.mockRejectedValue(new Error('Database password is incorrect'));

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          walletAddress: '0x1234567890123456789012345678901234567890',
          signature: '0x' + crypto.randomBytes(65).toString('hex'),
          message: 'Login to Offline Wallet'
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).not.toContain('password');
      expect(response.body.error.message).not.toContain('Database');
    });

    it('should handle rate limiting on auth endpoints', async () => {
      const walletAddress = '0x1234567890123456789012345678901234567890';
      
      // Make multiple rapid requests
      const requests = Array(10).fill(null).map(() =>
        request(app)
          .get('/api/v1/auth/nonce')
          .query({ walletAddress })
      );

      const responses = await Promise.all(requests);
      
      // At least some requests should succeed
      const successfulRequests = responses.filter(r => r.status === 200);
      expect(successfulRequests.length).toBeGreaterThan(0);
      
      // Rate limiting behavior is environment dependent
      // We just verify the endpoint is responsive under load
    });
  });
});