import request from 'supertest';
import { app } from '../../index';
import { ethers } from 'ethers';

describe('Authentication Flow Integration', () => {
  let wallet: ethers.HDNodeWallet;
  let walletAddress: string;

  beforeAll(() => {
    // Create a test wallet
    wallet = ethers.Wallet.createRandom();
    walletAddress = wallet.address;
  });

  afterEach(async () => {
    // Clean up any test data
    jest.clearAllMocks();
  });

  describe('Complete Authentication Flow', () => {
    it('should complete full auth flow: nonce -> login -> validate -> logout', async () => {
      // Step 1: Get nonce
      const nonceResponse = await request(app)
        .get('/api/v1/auth/nonce')
        .query({ walletAddress })
        .expect(200);

      expect(nonceResponse.body.success).toBe(true);
      expect(nonceResponse.body.data.nonce).toBeDefined();
      expect(nonceResponse.body.data.message).toBeDefined();
      expect(nonceResponse.body.data.timestamp).toBeDefined();
      expect(nonceResponse.body.data.expiresAt).toBeDefined();

      const { message } = nonceResponse.body.data;

      // Step 2: Sign message and login
      const signature = await wallet.signMessage(message);

      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          walletAddress,
          signature,
          message,
        })
        .expect(200);

      expect(loginResponse.body.success).toBe(true);
      expect(loginResponse.body.data.token).toBeDefined();
      expect(loginResponse.body.data.refreshToken).toBeDefined();
      expect(loginResponse.body.data.expiresIn).toBeDefined();
      expect(loginResponse.body.data.user).toBeDefined();

      const { token, refreshToken } = loginResponse.body.data;

      // Step 3: Validate session
      const sessionResponse = await request(app)
        .get('/api/v1/auth/validate-session')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(sessionResponse.body.success).toBe(true);
      expect(sessionResponse.body.data.valid).toBe(true);
      expect(sessionResponse.body.data.user).toBeDefined();

      // Step 4: Get active sessions
      const sessionsResponse = await request(app)
        .get('/api/v1/auth/sessions')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(sessionsResponse.body.success).toBe(true);
      expect(sessionsResponse.body.data.sessions).toBeDefined();
      expect(sessionsResponse.body.data.totalSessions).toBeGreaterThan(0);

      // Step 5: Refresh token
      const refreshResponse = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(refreshResponse.body.success).toBe(true);
      expect(refreshResponse.body.data.accessToken).toBeDefined();
      expect(refreshResponse.body.data.refreshToken).toBeDefined();

      // Step 6: Logout
      const logoutResponse = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .send({ allDevices: false })
        .expect(200);

      expect(logoutResponse.body.success).toBe(true);

      // Step 7: Verify token is blacklisted
      const invalidSessionResponse = await request(app)
        .get('/api/v1/auth/validate-session')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);

      expect(invalidSessionResponse.body.success).toBe(false);
    });

    it('should handle logout from all devices', async () => {
      // Get nonce and login
      const nonceResponse = await request(app)
        .get('/api/v1/auth/nonce')
        .query({ walletAddress })
        .expect(200);

      const { message } = nonceResponse.body.data;
      const signature = await wallet.signMessage(message);

      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          walletAddress,
          signature,
          message,
        })
        .expect(200);

      const { token } = loginResponse.body.data;

      // Logout from all devices
      const logoutResponse = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .send({ allDevices: true })
        .expect(200);

      expect(logoutResponse.body.success).toBe(true);
      expect(logoutResponse.body.message).toContain('all devices');

      // Verify token is invalidated
      await request(app)
        .get('/api/v1/auth/validate-session')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    });

    it('should reject expired nonce', async () => {
      // Create an expired message manually
      const nonce = 'test-nonce';
      const expiredTimestamp = Date.now() - 10 * 60 * 1000; // 10 minutes ago
      const expiredMessage = `Login to Offline Wallet\nWallet: ${walletAddress}\nNonce: ${nonce}\nTimestamp: ${expiredTimestamp}`;
      
      const signature = await wallet.signMessage(expiredMessage);

      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          walletAddress,
          signature,
          message: expiredMessage,
        })
        .expect(400);

      expect(loginResponse.body.success).toBe(false);
      expect(loginResponse.body.error.message).toContain('expired');
    });

    it('should reject invalid signature', async () => {
      const nonceResponse = await request(app)
        .get('/api/v1/auth/nonce')
        .query({ walletAddress })
        .expect(200);

      const { message } = nonceResponse.body.data;
      
      // Use wrong signature
      const wrongWallet = ethers.Wallet.createRandom();
      const wrongSignature = await wrongWallet.signMessage(message);

      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          walletAddress,
          signature: wrongSignature,
          message,
        })
        .expect(401);

      expect(loginResponse.body.success).toBe(false);
      expect(loginResponse.body.error.message).toContain('signature');
    });

    it('should reject malformed nonce message', async () => {
      const malformedMessage = 'Invalid message format';
      const signature = await wallet.signMessage(malformedMessage);

      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          walletAddress,
          signature,
          message: malformedMessage,
        })
        .expect(400);

      expect(loginResponse.body.success).toBe(false);
      expect(loginResponse.body.error.message).toContain('nonce');
    });
  });

  describe('Token Refresh Flow', () => {
    it('should refresh tokens successfully', async () => {
      // Login first
      const nonceResponse = await request(app)
        .get('/api/v1/auth/nonce')
        .query({ walletAddress })
        .expect(200);

      const { message } = nonceResponse.body.data;
      const signature = await wallet.signMessage(message);

      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          walletAddress,
          signature,
          message,
        })
        .expect(200);

      const { refreshToken } = loginResponse.body.data;

      // Refresh token
      const refreshResponse = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(refreshResponse.body.success).toBe(true);
      expect(refreshResponse.body.data.accessToken).toBeDefined();
      expect(refreshResponse.body.data.refreshToken).toBeDefined();
      expect(refreshResponse.body.data.expiresIn).toBeDefined();
      expect(refreshResponse.body.data.user).toBeDefined();

      // Verify new token works
      const newToken = refreshResponse.body.data.accessToken;
      await request(app)
        .get('/api/v1/auth/validate-session')
        .set('Authorization', `Bearer ${newToken}`)
        .expect(200);
    });

    it('should reject invalid refresh token', async () => {
      const invalidRefreshToken = 'invalid.refresh.token';

      const refreshResponse = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: invalidRefreshToken })
        .expect(401);

      expect(refreshResponse.body.success).toBe(false);
    });
  });

  describe('Security Features', () => {
    it('should detect and handle suspicious activity', async () => {
      // This test would require more complex setup to simulate suspicious activity
      // For now, we'll test that the session validation includes security checks
      
      const nonceResponse = await request(app)
        .get('/api/v1/auth/nonce')
        .query({ walletAddress })
        .expect(200);

      const { message } = nonceResponse.body.data;
      const signature = await wallet.signMessage(message);

      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          walletAddress,
          signature,
          message,
        })
        .expect(200);

      const { token } = loginResponse.body.data;

      // Validate session (should include security checks)
      const sessionResponse = await request(app)
        .get('/api/v1/auth/validate-session')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(sessionResponse.body.success).toBe(true);
      expect(sessionResponse.body.data.sessionInfo).toBeDefined();
    });
  });
});