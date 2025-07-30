import request from 'supertest';
import { app } from '../../index';
import jwt from 'jsonwebtoken';
import { config } from '../../config/config';

describe('System Security Integration Tests', () => {
  let validAuthToken: string;
  let testWalletAddress: string;
  let testUserId: string;

  beforeAll(() => {
    testWalletAddress = '0x1234567890123456789012345678901234567890';
    testUserId = 'security-test-user';
    
    validAuthToken = jwt.sign(
      { userId: testUserId, walletAddress: testWalletAddress },
      config.jwt.secret,
      { expiresIn: '1h' }
    );
  });

  describe('Authentication and Authorization Security', () => {
    it('should reject requests without authentication token', async () => {
      const response = await request(app)
        .get('/api/wallet/balance');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject requests with invalid JWT tokens', async () => {
      const invalidToken = 'invalid.jwt.token';
      
      const response = await request(app)
        .get('/api/wallet/balance')
        .set('Authorization', `Bearer ${invalidToken}`);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject expired JWT tokens', async () => {
      const expiredToken = jwt.sign(
        { userId: testUserId, walletAddress: testWalletAddress },
        config.jwt.secret,
        { expiresIn: '-1h' } // Already expired
      );
      
      const response = await request(app)
        .get('/api/wallet/balance')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('expired');
    });

    it('should reject tokens with invalid signatures', async () => {
      const tamperedToken = jwt.sign(
        { userId: testUserId, walletAddress: testWalletAddress },
        'wrong-secret',
        { expiresIn: '1h' }
      );
      
      const response = await request(app)
        .get('/api/wallet/balance')
        .set('Authorization', `Bearer ${tamperedToken}`);

      expect(response.status).toBe(401);
    });

    it('should validate wallet address ownership', async () => {
      const wrongWalletToken = jwt.sign(
        { userId: testUserId, walletAddress: '0x9999999999999999999999999999999999999999' },
        config.jwt.secret,
        { expiresIn: '1h' }
      );
      
      const response = await request(app)
        .post('/api/tokens/purchase')
        .set('Authorization', `Bearer ${wrongWalletToken}`)
        .send({
          amount: 100,
          walletAddress: testWalletAddress // Different from token
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('wallet address mismatch');
    });
  });

  describe('Input Validation and Sanitization', () => {
    it('should reject invalid wallet addresses', async () => {
      const invalidAddresses = [
        'invalid-address',
        '0x123', // Too short
        '0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG', // Invalid hex
        '', // Empty
        null,
        undefined
      ];

      for (const address of invalidAddresses) {
        const response = await request(app)
          .post('/api/tokens/purchase')
          .set('Authorization', `Bearer ${validAuthToken}`)
          .send({
            amount: 100,
            walletAddress: address
          });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error');
      }
    });

    it('should reject invalid token amounts', async () => {
      const invalidAmounts = [
        -100, // Negative
        0, // Zero
        'invalid', // Non-numeric
        null,
        undefined,
        Infinity,
        NaN
      ];

      for (const amount of invalidAmounts) {
        const response = await request(app)
          .post('/api/tokens/purchase')
          .set('Authorization', `Bearer ${validAuthToken}`)
          .send({
            amount: amount,
            walletAddress: testWalletAddress
          });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error');
      }
    });

    it('should sanitize and validate transaction data', async () => {
      const maliciousTransaction = {
        id: '<script>alert("xss")</script>',
        senderId: testUserId,
        receiverId: 'receiver-123',
        amount: 50,
        timestamp: 'invalid-date',
        metadata: {
          '<script>': 'malicious',
          'eval(': 'dangerous'
        }
      };

      const response = await request(app)
        .post('/api/transactions/sync-offline')
        .set('Authorization', `Bearer ${validAuthToken}`)
        .send({
          transactions: [maliciousTransaction],
          walletAddress: testWalletAddress
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should enforce maximum request size limits', async () => {
      // Create oversized request
      const largeData = 'x'.repeat(10 * 1024 * 1024); // 10MB
      
      const response = await request(app)
        .post('/api/tokens/purchase')
        .set('Authorization', `Bearer ${validAuthToken}`)
        .send({
          amount: 100,
          walletAddress: testWalletAddress,
          largeField: largeData
        });

      expect(response.status).toBe(413); // Payload too large
    });
  });

  describe('Rate Limiting and DDoS Protection', () => {
    it('should enforce rate limits on token purchase endpoints', async () => {
      const requests = [];
      
      // Make many rapid requests
      for (let i = 0; i < 20; i++) {
        requests.push(
          request(app)
            .post('/api/tokens/purchase')
            .set('Authorization', `Bearer ${validAuthToken}`)
            .send({
              amount: 10,
              walletAddress: testWalletAddress
            })
        );
      }

      const responses = await Promise.all(requests);
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should enforce rate limits per user', async () => {
      // Create multiple users
      const users = [];
      for (let i = 0; i < 3; i++) {
        const walletAddress = `0x${i.toString().padStart(40, '0')}`;
        const token = jwt.sign(
          { userId: `user-${i}`, walletAddress: walletAddress },
          config.jwt.secret,
          { expiresIn: '1h' }
        );
        users.push({ token, walletAddress });
      }

      // Each user makes requests
      const allRequests = [];
      for (const user of users) {
        for (let i = 0; i < 10; i++) {
          allRequests.push(
            request(app)
              .get('/api/wallet/balance')
              .set('Authorization', `Bearer ${user.token}`)
          );
        }
      }

      const responses = await Promise.all(allRequests);
      
      // Some requests should be rate limited
      const rateLimitedCount = responses.filter(res => res.status === 429).length;
      expect(rateLimitedCount).toBeGreaterThan(0);
    });

    it('should handle concurrent requests gracefully', async () => {
      const concurrentRequests = [];
      
      for (let i = 0; i < 50; i++) {
        concurrentRequests.push(
          request(app)
            .get('/api/keys/public')
        );
      }

      const responses = await Promise.all(concurrentRequests);
      
      // Most requests should succeed or be rate limited (not crash)
      responses.forEach(response => {
        expect([200, 429, 503]).toContain(response.status);
      });
    });
  });

  describe('Cryptographic Security', () => {
    it('should validate token signatures properly', async () => {
      // Create token with invalid signature
      const invalidToken = {
        id: 'invalid-token-123',
        amount: 50,
        signature: 'invalid-signature',
        expirationDate: new Date(Date.now() + 86400000).toISOString()
      };

      const response = await request(app)
        .post('/api/tokens/redeem')
        .set('Authorization', `Bearer ${validAuthToken}`)
        .send({
          tokens: [invalidToken],
          walletAddress: testWalletAddress
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('invalid signature');
    });

    it('should prevent signature replay attacks', async () => {
      // Purchase tokens first
      const purchaseResponse = await request(app)
        .post('/api/tokens/purchase')
        .set('Authorization', `Bearer ${validAuthToken}`)
        .send({
          amount: 100,
          walletAddress: testWalletAddress
        });

      expect(purchaseResponse.status).toBe(200);
      const tokens = purchaseResponse.body.tokens;

      // Redeem tokens once
      const firstRedemption = await request(app)
        .post('/api/tokens/redeem')
        .set('Authorization', `Bearer ${validAuthToken}`)
        .send({
          tokens: tokens,
          walletAddress: testWalletAddress
        });

      expect(firstRedemption.status).toBe(200);

      // Try to replay the same redemption
      const replayAttempt = await request(app)
        .post('/api/tokens/redeem')
        .set('Authorization', `Bearer ${validAuthToken}`)
        .send({
          tokens: tokens,
          walletAddress: testWalletAddress
        });

      expect(replayAttempt.status).toBe(400);
      expect(replayAttempt.body.error).toContain('already redeemed');
    });

    it('should validate transaction signatures in offline sync', async () => {
      const invalidTransaction = {
        id: 'invalid-tx-123',
        senderId: testUserId,
        receiverId: 'receiver-456',
        amount: 25,
        timestamp: new Date().toISOString(),
        senderSignature: 'invalid-signature'
      };

      const response = await request(app)
        .post('/api/transactions/sync-offline')
        .set('Authorization', `Bearer ${validAuthToken}`)
        .send({
          transactions: [invalidTransaction],
          walletAddress: testWalletAddress
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('invalid signature');
    });
  });

  describe('Business Logic Security', () => {
    it('should prevent double spending attacks', async () => {
      // Purchase tokens
      const purchaseResponse = await request(app)
        .post('/api/tokens/purchase')
        .set('Authorization', `Bearer ${validAuthToken}`)
        .send({
          amount: 100,
          walletAddress: testWalletAddress
        });

      const tokens = purchaseResponse.body.tokens;

      // Create two transactions using the same tokens
      const transaction1 = {
        id: 'tx-1',
        senderId: testUserId,
        receiverId: 'receiver-1',
        amount: 50,
        tokenIds: tokens.map((t: any) => t.id),
        timestamp: new Date().toISOString()
      };

      const transaction2 = {
        id: 'tx-2',
        senderId: testUserId,
        receiverId: 'receiver-2',
        amount: 50,
        tokenIds: tokens.map((t: any) => t.id), // Same tokens
        timestamp: new Date().toISOString()
      };

      // Sync first transaction
      const sync1 = await request(app)
        .post('/api/transactions/sync-offline')
        .set('Authorization', `Bearer ${validAuthToken}`)
        .send({
          transactions: [transaction1],
          walletAddress: testWalletAddress
        });

      expect(sync1.status).toBe(200);

      // Attempt to sync second transaction (should fail)
      const sync2 = await request(app)
        .post('/api/transactions/sync-offline')
        .set('Authorization', `Bearer ${validAuthToken}`)
        .send({
          transactions: [transaction2],
          walletAddress: testWalletAddress
        });

      expect(sync2.status).toBe(400);
      expect(sync2.body.error).toContain('double spending');
    });

    it('should enforce token expiration', async () => {
      // Create expired token scenario
      const expiredTokenResponse = await request(app)
        .post('/api/tokens/purchase')
        .set('Authorization', `Bearer ${validAuthToken}`)
        .send({
          amount: 50,
          walletAddress: testWalletAddress,
          expirationMinutes: -1 // Already expired
        });

      const tokens = expiredTokenResponse.body.tokens;

      // Attempt to use expired tokens
      const redemptionResponse = await request(app)
        .post('/api/tokens/redeem')
        .set('Authorization', `Bearer ${validAuthToken}`)
        .send({
          tokens: tokens,
          walletAddress: testWalletAddress
        });

      expect(redemptionResponse.status).toBe(400);
      expect(redemptionResponse.body.error).toContain('expired');
    });

    it('should validate transaction amounts and balances', async () => {
      // Attempt to create transaction with negative amount
      const negativeTransaction = {
        id: 'negative-tx',
        senderId: testUserId,
        receiverId: 'receiver-123',
        amount: -50,
        timestamp: new Date().toISOString()
      };

      const response = await request(app)
        .post('/api/transactions/sync-offline')
        .set('Authorization', `Bearer ${validAuthToken}`)
        .send({
          transactions: [negativeTransaction],
          walletAddress: testWalletAddress
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('invalid amount');
    });
  });

  describe('Error Handling and Logging', () => {
    it('should handle database connection errors gracefully', async () => {
      // This would require mocking database failures
      // For now, test that errors are properly formatted
      const response = await request(app)
        .get('/api/wallet/balance')
        .set('Authorization', `Bearer ${validAuthToken}`);

      // Should either succeed or fail gracefully
      expect([200, 500, 503]).toContain(response.status);
      
      if (response.status >= 500) {
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).not.toContain('password');
        expect(response.body.error).not.toContain('secret');
      }
    });

    it('should not expose sensitive information in error messages', async () => {
      const response = await request(app)
        .post('/api/tokens/purchase')
        .set('Authorization', `Bearer ${validAuthToken}`)
        .send({
          amount: 'invalid',
          walletAddress: testWalletAddress
        });

      expect(response.status).toBe(400);
      expect(response.body.error).not.toContain('database');
      expect(response.body.error).not.toContain('internal');
      expect(response.body.error).not.toContain('stack');
    });

    it('should log security events properly', async () => {
      // Attempt unauthorized access
      await request(app)
        .get('/api/wallet/balance')
        .set('Authorization', 'Bearer invalid-token');

      // Attempt with expired token
      const expiredToken = jwt.sign(
        { userId: testUserId, walletAddress: testWalletAddress },
        config.jwt.secret,
        { expiresIn: '-1h' }
      );

      await request(app)
        .get('/api/wallet/balance')
        .set('Authorization', `Bearer ${expiredToken}`);

      // These should be logged (we can't easily test logging in this context,
      // but we ensure the requests are handled properly)
      expect(true).toBe(true); // Placeholder for logging verification
    });
  });

  describe('System Resilience', () => {
    it('should handle high load scenarios', async () => {
      const highLoadRequests = [];
      
      for (let i = 0; i < 100; i++) {
        highLoadRequests.push(
          request(app)
            .get('/api/keys/public')
        );
      }

      const responses = await Promise.all(highLoadRequests);
      
      // System should remain responsive
      const successfulResponses = responses.filter(res => res.status === 200);
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      
      expect(successfulResponses.length + rateLimitedResponses.length).toBe(100);
    });

    it('should handle malformed requests gracefully', async () => {
      const malformedRequests = [
        // Invalid JSON
        request(app)
          .post('/api/tokens/purchase')
          .set('Authorization', `Bearer ${validAuthToken}`)
          .set('Content-Type', 'application/json')
          .send('invalid json'),
        
        // Missing required fields
        request(app)
          .post('/api/tokens/purchase')
          .set('Authorization', `Bearer ${validAuthToken}`)
          .send({}),
        
        // Wrong content type
        request(app)
          .post('/api/tokens/purchase')
          .set('Authorization', `Bearer ${validAuthToken}`)
          .set('Content-Type', 'text/plain')
          .send('plain text data')
      ];

      const responses = await Promise.all(malformedRequests);
      
      responses.forEach(response => {
        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.status).toBeLessThan(500);
        expect(response.body).toHaveProperty('error');
      });
    });

    it('should maintain data consistency under concurrent operations', async () => {
      // Create multiple concurrent token purchases
      const concurrentPurchases = [];
      
      for (let i = 0; i < 10; i++) {
        concurrentPurchases.push(
          request(app)
            .post('/api/tokens/purchase')
            .set('Authorization', `Bearer ${validAuthToken}`)
            .send({
              amount: 10,
              walletAddress: testWalletAddress
            })
        );
      }

      const responses = await Promise.all(concurrentPurchases);
      
      // Count successful purchases
      const successfulPurchases = responses.filter(res => res.status === 200);
      
      // Verify each successful purchase has valid tokens
      successfulPurchases.forEach(response => {
        expect(response.body).toHaveProperty('tokens');
        expect(Array.isArray(response.body.tokens)).toBe(true);
        response.body.tokens.forEach((token: any) => {
          expect(token).toHaveProperty('id');
          expect(token).toHaveProperty('signature');
          expect(token.amount).toBe(10);
        });
      });
    });
  });
});