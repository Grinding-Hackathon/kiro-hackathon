import request from 'supertest';
import { app } from '../../index';
import jwt from 'jsonwebtoken';
import { config } from '../../config/config';

describe('Mobile App - Backend Integration Tests', () => {
  let authToken: string;
  let testUserId: string;
  let testWalletAddress: string;


  beforeAll(async () => {
    // Setup test data
    testWalletAddress = '0x1234567890123456789012345678901234567890';
    testUserId = 'test-user-123';
    
    // Create auth token for testing
    authToken = jwt.sign(
      { userId: testUserId, walletAddress: testWalletAddress },
      config.jwt.secret,
      { expiresIn: '1h' }
    );


  });

  describe('Token Purchase and Redemption Flow', () => {
    it('should complete full token purchase flow', async () => {
      // Step 1: User authentication
      const authResponse = await request(app)
        .post('/api/auth/login')
        .send({
          walletAddress: testWalletAddress,
          signature: 'mock-signature'
        });

      expect(authResponse.status).toBe(200);
      expect(authResponse.body).toHaveProperty('token');

      // Step 2: Check initial balance
      const balanceResponse = await request(app)
        .get('/api/wallet/balance')
        .set('Authorization', `Bearer ${authToken}`);

      expect(balanceResponse.status).toBe(200);
      expect(balanceResponse.body).toHaveProperty('blockchainBalance');
      expect(balanceResponse.body).toHaveProperty('offlineTokenBalance');

      // Step 3: Purchase offline tokens
      const purchaseResponse = await request(app)
        .post('/api/tokens/purchase')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 100,
          walletAddress: testWalletAddress
        });

      expect(purchaseResponse.status).toBe(200);
      expect(purchaseResponse.body).toHaveProperty('tokens');
      expect(Array.isArray(purchaseResponse.body.tokens)).toBe(true);
      expect(purchaseResponse.body.tokens.length).toBeGreaterThan(0);

      // Verify token structure
      const token = purchaseResponse.body.tokens[0];
      expect(token).toHaveProperty('id');
      expect(token).toHaveProperty('amount');
      expect(token).toHaveProperty('signature');
      expect(token).toHaveProperty('expirationDate');

      // Step 4: Redeem tokens
      const redemptionResponse = await request(app)
        .post('/api/tokens/redeem')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          tokens: purchaseResponse.body.tokens,
          walletAddress: testWalletAddress
        });

      expect(redemptionResponse.status).toBe(200);
      expect(redemptionResponse.body).toHaveProperty('transactionHash');
      expect(redemptionResponse.body).toHaveProperty('amount');
    });

    it('should handle token expiration and automatic refund', async () => {
      // Create expired token scenario
      const expiredTokenResponse = await request(app)
        .post('/api/tokens/purchase')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 50,
          walletAddress: testWalletAddress,
          expirationMinutes: -1 // Already expired for testing
        });

      expect(expiredTokenResponse.status).toBe(200);

      // Attempt to redeem expired token
      const redemptionResponse = await request(app)
        .post('/api/tokens/redeem')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          tokens: expiredTokenResponse.body.tokens,
          walletAddress: testWalletAddress
        });

      expect(redemptionResponse.status).toBe(400);
      expect(redemptionResponse.body).toHaveProperty('error');
      expect(redemptionResponse.body.error).toContain('expired');

      // Check automatic refund processing
      const refundResponse = await request(app)
        .post('/api/tokens/process-expired')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          walletAddress: testWalletAddress
        });

      expect(refundResponse.status).toBe(200);
      expect(refundResponse.body).toHaveProperty('refundedAmount');
    });
  });

  describe('Offline Transaction Processing and Synchronization', () => {
    it('should validate offline transaction signatures', async () => {
      // Get OTM public key for validation
      const publicKeyResponse = await request(app)
        .get('/api/keys/public');

      expect(publicKeyResponse.status).toBe(200);
      expect(publicKeyResponse.body).toHaveProperty('otmPublicKey');

      // Simulate offline transaction validation
      const offlineTransaction = {
        id: 'offline-tx-123',
        senderId: 'sender-456',
        receiverId: 'receiver-789',
        amount: 25,
        tokenIds: ['token-1', 'token-2'],
        senderSignature: 'mock-sender-signature',
        receiverSignature: 'mock-receiver-signature',
        timestamp: new Date().toISOString()
      };

      const validationResponse = await request(app)
        .post('/api/transactions/validate-offline')
        .set('Authorization', `Bearer ${authToken}`)
        .send(offlineTransaction);

      expect(validationResponse.status).toBe(200);
      expect(validationResponse.body).toHaveProperty('isValid');
      expect(validationResponse.body).toHaveProperty('validationDetails');
    });

    it('should synchronize offline transactions when back online', async () => {
      // Simulate multiple offline transactions
      const offlineTransactions = [
        {
          id: 'offline-tx-1',
          senderId: testUserId,
          receiverId: 'receiver-1',
          amount: 10,
          timestamp: new Date().toISOString(),
          status: 'pending_sync'
        },
        {
          id: 'offline-tx-2',
          senderId: 'sender-2',
          receiverId: testUserId,
          amount: 15,
          timestamp: new Date().toISOString(),
          status: 'pending_sync'
        }
      ];

      const syncResponse = await request(app)
        .post('/api/transactions/sync-offline')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          transactions: offlineTransactions,
          walletAddress: testWalletAddress
        });

      expect(syncResponse.status).toBe(200);
      expect(syncResponse.body).toHaveProperty('syncedTransactions');
      expect(syncResponse.body).toHaveProperty('failedTransactions');
      expect(Array.isArray(syncResponse.body.syncedTransactions)).toBe(true);
    });
  });

  describe('Automatic Token Management', () => {
    it('should handle automatic token purchase based on balance threshold', async () => {
      // Set auto-purchase configuration
      const configResponse = await request(app)
        .post('/api/wallet/auto-purchase-config')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          enabled: true,
          threshold: 20,
          purchaseAmount: 100,
          walletAddress: testWalletAddress
        });

      expect(configResponse.status).toBe(200);

      // Simulate low balance scenario
      const lowBalanceResponse = await request(app)
        .post('/api/wallet/check-auto-purchase')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentBalance: 15,
          walletAddress: testWalletAddress
        });

      expect(lowBalanceResponse.status).toBe(200);
      expect(lowBalanceResponse.body).toHaveProperty('shouldPurchase');
      expect(lowBalanceResponse.body.shouldPurchase).toBe(true);
      expect(lowBalanceResponse.body).toHaveProperty('recommendedAmount');
    });

    it('should monitor token expiration and send notifications', async () => {
      // Create tokens with different expiration times
      const tokenResponse = await request(app)
        .post('/api/tokens/purchase')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 50,
          walletAddress: testWalletAddress,
          expirationHours: 1 // Expires in 1 hour
        });

      expect(tokenResponse.status).toBe(200);

      // Check expiration monitoring
      const expirationCheckResponse = await request(app)
        .get('/api/tokens/expiration-check')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ walletAddress: testWalletAddress });

      expect(expirationCheckResponse.status).toBe(200);
      expect(expirationCheckResponse.body).toHaveProperty('expiringTokens');
      expect(expirationCheckResponse.body).toHaveProperty('notificationsSent');
    });
  });

  describe('Security Measures and Error Handling', () => {
    it('should prevent double-spending attacks', async () => {
      // Purchase tokens
      const purchaseResponse = await request(app)
        .post('/api/tokens/purchase')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 30,
          walletAddress: testWalletAddress
        });

      expect(purchaseResponse.status).toBe(200);
      const tokens = purchaseResponse.body.tokens;

      // Attempt to redeem same tokens twice
      const firstRedemption = await request(app)
        .post('/api/tokens/redeem')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          tokens: tokens,
          walletAddress: testWalletAddress
        });

      expect(firstRedemption.status).toBe(200);

      // Second redemption should fail
      const secondRedemption = await request(app)
        .post('/api/tokens/redeem')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          tokens: tokens,
          walletAddress: testWalletAddress
        });

      expect(secondRedemption.status).toBe(400);
      expect(secondRedemption.body).toHaveProperty('error');
      expect(secondRedemption.body.error).toContain('already redeemed');
    });

    it('should handle invalid token signatures', async () => {
      // Create token with invalid signature
      const invalidToken = {
        id: 'invalid-token-123',
        amount: 50,
        signature: 'invalid-signature',
        expirationDate: new Date(Date.now() + 86400000).toISOString()
      };

      const redemptionResponse = await request(app)
        .post('/api/tokens/redeem')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          tokens: [invalidToken],
          walletAddress: testWalletAddress
        });

      expect(redemptionResponse.status).toBe(400);
      expect(redemptionResponse.body).toHaveProperty('error');
      expect(redemptionResponse.body.error).toContain('invalid signature');
    });

    it('should handle rate limiting for API endpoints', async () => {
      // Make multiple rapid requests to test rate limiting
      const requests = [];
      for (let i = 0; i < 10; i++) {
        requests.push(
          request(app)
            .get('/api/wallet/balance')
            .set('Authorization', `Bearer ${authToken}`)
        );
      }

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should handle network errors gracefully', async () => {
      // Simulate network error scenario
      const networkErrorResponse = await request(app)
        .post('/api/tokens/purchase')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 100,
          walletAddress: testWalletAddress,
          simulateNetworkError: true
        });

      expect(networkErrorResponse.status).toBe(503);
      expect(networkErrorResponse.body).toHaveProperty('error');
      expect(networkErrorResponse.body).toHaveProperty('retryAfter');
    });
  });

  describe('End-to-End User Scenarios', () => {
    it('should handle complete user journey from registration to transaction', async () => {
      const newUserWallet = '0x9876543210987654321098765432109876543210';
      
      // Step 1: User registration/first login
      const registrationResponse = await request(app)
        .post('/api/auth/register')
        .send({
          walletAddress: newUserWallet,
          publicKey: 'user-public-key'
        });

      expect(registrationResponse.status).toBe(201);
      expect(registrationResponse.body).toHaveProperty('userId');

      // Step 2: Purchase tokens
      const newUserToken = jwt.sign(
        { userId: registrationResponse.body.userId, walletAddress: newUserWallet },
        config.jwt.secret,
        { expiresIn: '1h' }
      );

      const purchaseResponse = await request(app)
        .post('/api/tokens/purchase')
        .set('Authorization', `Bearer ${newUserToken}`)
        .send({
          amount: 200,
          walletAddress: newUserWallet
        });

      expect(purchaseResponse.status).toBe(200);

      // Step 3: Simulate offline transaction
      const offlineTransaction = {
        id: 'user-journey-tx',
        senderId: registrationResponse.body.userId,
        receiverId: testUserId,
        amount: 75,
        tokenIds: purchaseResponse.body.tokens.slice(0, 2).map((t: any) => t.id),
        timestamp: new Date().toISOString()
      };

      // Step 4: Sync transaction when back online
      const syncResponse = await request(app)
        .post('/api/transactions/sync-offline')
        .set('Authorization', `Bearer ${newUserToken}`)
        .send({
          transactions: [offlineTransaction],
          walletAddress: newUserWallet
        });

      expect(syncResponse.status).toBe(200);

      // Step 5: Check final balances
      const finalBalanceResponse = await request(app)
        .get('/api/wallet/balance')
        .set('Authorization', `Bearer ${newUserToken}`);

      expect(finalBalanceResponse.status).toBe(200);
      expect(finalBalanceResponse.body.offlineTokenBalance).toBeLessThan(200);
    });

    it('should handle multi-user offline transaction scenario', async () => {
      // Create multiple test users
      const users: Array<{
        id: string;
        walletAddress: string;
        token: string;
        tokens?: any[];
      }> = [];
      
      for (let i = 0; i < 3; i++) {
        const walletAddress = `0x${i.toString().padStart(40, '0')}`;
        const userResponse = await request(app)
          .post('/api/auth/register')
          .send({
            walletAddress: walletAddress,
            publicKey: `user-${i}-public-key`
          });

        const token = jwt.sign(
          { userId: userResponse.body.userId, walletAddress: walletAddress },
          config.jwt.secret,
          { expiresIn: '1h' }
        );

        users.push({
          id: userResponse.body.userId,
          walletAddress: walletAddress,
          token: token
        });
      }

      // Each user purchases tokens
      for (const user of users) {
        const purchaseResponse = await request(app)
          .post('/api/tokens/purchase')
          .set('Authorization', `Bearer ${user.token}`)
          .send({
            amount: 100,
            walletAddress: user.walletAddress
          });

        expect(purchaseResponse.status).toBe(200);
        user.tokens = purchaseResponse.body.tokens;
      }

      // Simulate chain of offline transactions
      const transactions = [
        {
          id: 'multi-tx-1',
          senderId: users[0]!.id,
          receiverId: users[1]!.id,
          amount: 30
        },
        {
          id: 'multi-tx-2',
          senderId: users[1]!.id,
          receiverId: users[2]!.id,
          amount: 20
        },
        {
          id: 'multi-tx-3',
          senderId: users[2]!.id,
          receiverId: users[0]!.id,
          amount: 10
        }
      ];

      // Sync all transactions
      for (let i = 0; i < transactions.length; i++) {
        const syncResponse = await request(app)
          .post('/api/transactions/sync-offline')
          .set('Authorization', `Bearer ${users[i]!.token}`)
          .send({
            transactions: [transactions[i]],
            walletAddress: users[i]!.walletAddress
          });

        expect(syncResponse.status).toBe(200);
      }

      // Verify final balances for all users
      for (const user of users) {
        const balanceResponse = await request(app)
          .get('/api/wallet/balance')
          .set('Authorization', `Bearer ${user.token}`);

        expect(balanceResponse.status).toBe(200);
        expect(balanceResponse.body).toHaveProperty('offlineTokenBalance');
      }
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle concurrent token purchases', async () => {
      const concurrentRequests = [];
      
      for (let i = 0; i < 5; i++) {
        concurrentRequests.push(
          request(app)
            .post('/api/tokens/purchase')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              amount: 50,
              walletAddress: testWalletAddress
            })
        );
      }

      const responses = await Promise.all(concurrentRequests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('tokens');
      });
    });

    it('should handle large batch token redemption', async () => {
      // Purchase many tokens
      const largePurchaseResponse = await request(app)
        .post('/api/tokens/purchase')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 1000,
          walletAddress: testWalletAddress
        });

      expect(largePurchaseResponse.status).toBe(200);

      // Redeem all tokens at once
      const redemptionResponse = await request(app)
        .post('/api/tokens/redeem')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          tokens: largePurchaseResponse.body.tokens,
          walletAddress: testWalletAddress
        });

      expect(redemptionResponse.status).toBe(200);
      expect(redemptionResponse.body).toHaveProperty('transactionHash');
    });
  });
});