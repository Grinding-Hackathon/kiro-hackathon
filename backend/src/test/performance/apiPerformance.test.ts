import request from 'supertest';
import { app } from '../../index';
import { TransactionDAO } from '../../database/dao/TransactionDAO';
import { OfflineTokenDAO } from '../../database/dao/OfflineTokenDAO';
import { UserDAO } from '../../database/dao/UserDAO';
import { blockchainService } from '../../services/blockchainService';
import { offlineTokenManager } from '../../services/offlineTokenManager';
import jwt from 'jsonwebtoken';

// Mock dependencies
jest.mock('../../database/dao/TransactionDAO');
jest.mock('../../database/dao/OfflineTokenDAO');
jest.mock('../../database/dao/UserDAO');
jest.mock('../../services/blockchainService');
jest.mock('../../services/offlineTokenManager');

describe('API Performance Tests', () => {
  let authToken: string;
  let mockTransactionDAO: jest.Mocked<TransactionDAO>;
  let mockOfflineTokenDAO: jest.Mocked<OfflineTokenDAO>;
  let mockUserDAO: jest.Mocked<UserDAO>;
  let mockBlockchainService: jest.Mocked<typeof blockchainService>;
  let mockOfflineTokenManager: jest.Mocked<typeof offlineTokenManager>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mocked instances
    mockTransactionDAO = new TransactionDAO() as jest.Mocked<TransactionDAO>;
    mockOfflineTokenDAO = new OfflineTokenDAO() as jest.Mocked<OfflineTokenDAO>;
    mockUserDAO = new UserDAO() as jest.Mocked<UserDAO>;
    mockBlockchainService = blockchainService as jest.Mocked<typeof blockchainService>;
    mockOfflineTokenManager = offlineTokenManager as jest.Mocked<typeof offlineTokenManager>;

    // Mock DAO instances
    (TransactionDAO as jest.MockedClass<typeof TransactionDAO>).mockImplementation(() => mockTransactionDAO);
    (OfflineTokenDAO as jest.MockedClass<typeof OfflineTokenDAO>).mockImplementation(() => mockOfflineTokenDAO);
    (UserDAO as jest.MockedClass<typeof UserDAO>).mockImplementation(() => mockUserDAO);

    // Create auth token
    authToken = jwt.sign(
      { 
        userId: 'perf-user-123',
        walletAddress: '0x1234567890123456789012345678901234567890',
        publicKey: 'perf-public-key'
      },
      process.env['JWT_SECRET'] || 'test-secret',
      { expiresIn: '1h' }
    );

    // Setup fast-responding mocks
    mockBlockchainService.getTokenBalance.mockResolvedValue('1000.00');
    mockOfflineTokenDAO.getUserTokenBalance.mockResolvedValue('500.00');
    mockOfflineTokenDAO.getUserTokenCount.mockResolvedValue(10);
    mockTransactionDAO.getUserPendingTransactions.mockResolvedValue([]);
    mockOfflineTokenManager.getPublicKey.mockReturnValue('otm-public-key');
    mockOfflineTokenManager.getWalletAddress.mockReturnValue('0x9876543210987654321098765432109876543210');
  });

  describe('Response Time Benchmarks', () => {
    it('should respond to wallet balance requests within 500ms', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/v1/wallet/balance')
        .set('Authorization', `Bearer ${authToken}`);

      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(responseTime).toBeLessThan(500);
    });

    it('should respond to transaction submission within 1000ms', async () => {
      const mockTransaction = {
        id: 'perf-tx-123',
        sender_id: 'perf-user-123',
        receiver_id: 'user-456',
        amount: '100.00',
        type: 'offline',
        status: 'pending',
        created_at: new Date(),
        updated_at: new Date()
      };

      mockTransactionDAO.create.mockResolvedValue(mockTransaction as any);

      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/v1/transactions/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          senderId: 'perf-user-123',
          receiverId: 'user-456',
          amount: '100.00',
          type: 'offline',
          senderSignature: 'perf-signature'
        });

      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(responseTime).toBeLessThan(1000);
    });

    it('should respond to token validation within 300ms', async () => {
      const mockToken = {
        id: 'perf-token-123',
        user_id: 'perf-user-123',
        amount: '100.00',
        signature: 'perf-token-signature',
        issued_at: new Date(),
        expires_at: new Date(Date.now() + 86400000),
        status: 'active',
        created_at: new Date()
      };

      mockOfflineTokenDAO.findById.mockResolvedValue(mockToken as any);
      mockOfflineTokenManager.validateToken.mockResolvedValue({ isValid: true, error: null });

      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/v1/tokens/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ tokenId: 'perf-token-123' });

      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(responseTime).toBeLessThan(300);
    });

    it('should respond to public key database requests within 200ms', async () => {
      const mockUsers = Array.from({ length: 100 }, (_, i) => ({
        id: `user-${i}`,
        public_key: `public-key-${i}`,
        wallet_address: `0x${i.toString().padStart(40, '0')}`,
        updated_at: new Date()
      }));

      mockUserDAO.findActiveUsers.mockResolvedValue(mockUsers as any);

      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/v1/tokens/public-keys');

      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(responseTime).toBeLessThan(200);
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should handle 10 concurrent wallet balance requests efficiently', async () => {
      const concurrentRequests = 10;
      const startTime = Date.now();

      const requests = Array(concurrentRequests).fill(null).map(() =>
        request(app)
          .get('/api/v1/wallet/balance')
          .set('Authorization', `Bearer ${authToken}`)
      );

      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Total time should be reasonable for concurrent requests
      expect(totalTime).toBeLessThan(2000);
      
      // Average response time should be acceptable
      const averageResponseTime = totalTime / concurrentRequests;
      expect(averageResponseTime).toBeLessThan(200);
    });

    it('should handle 20 concurrent transaction submissions', async () => {
      const concurrentRequests = 20;
      
      // Setup mocks for transaction creation
      mockTransactionDAO.create.mockImplementation(() => 
        Promise.resolve({
          id: `concurrent-tx-${Math.random()}`,
          sender_id: 'perf-user-123',
          receiver_id: 'user-456',
          amount: '50.00',
          type: 'offline',
          status: 'pending',
          created_at: new Date(),
          updated_at: new Date()
        } as any)
      );

      const startTime = Date.now();

      const requests = Array(concurrentRequests).fill(null).map((_, i) =>
        request(app)
          .post('/api/v1/transactions/submit')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            senderId: 'perf-user-123',
            receiverId: 'user-456',
            amount: '50.00',
            type: 'offline',
            senderSignature: `concurrent-signature-${i}`
          })
      );

      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      });

      // Should handle concurrent writes efficiently
      expect(totalTime).toBeLessThan(5000);
    });

    it('should handle mixed concurrent operations', async () => {
      const mockToken = {
        id: 'mixed-token-123',
        user_id: 'perf-user-123',
        amount: '100.00',
        signature: 'mixed-signature',
        issued_at: new Date(),
        expires_at: new Date(Date.now() + 86400000),
        status: 'active',
        created_at: new Date()
      };

      const mockTransaction = {
        id: 'mixed-tx-123',
        sender_id: 'perf-user-123',
        receiver_id: 'user-456',
        amount: '75.00',
        type: 'offline',
        status: 'pending',
        created_at: new Date(),
        updated_at: new Date()
      };

      mockOfflineTokenDAO.findById.mockResolvedValue(mockToken as any);
      mockOfflineTokenManager.validateToken.mockResolvedValue({ isValid: true, error: null });
      mockTransactionDAO.create.mockResolvedValue(mockTransaction as any);
      mockUserDAO.findActiveUsers.mockResolvedValue([]);

      const startTime = Date.now();

      // Mix of different operation types
      const requests = [
        // 5 balance requests
        ...Array(5).fill(null).map(() =>
          request(app)
            .get('/api/v1/wallet/balance')
            .set('Authorization', `Bearer ${authToken}`)
        ),
        // 3 token validations
        ...Array(3).fill(null).map(() =>
          request(app)
            .post('/api/v1/tokens/validate')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ tokenId: 'mixed-token-123' })
        ),
        // 2 transaction submissions
        ...Array(2).fill(null).map(() =>
          request(app)
            .post('/api/v1/transactions/submit')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              senderId: 'perf-user-123',
              receiverId: 'user-456',
              amount: '75.00',
              type: 'offline',
              senderSignature: 'mixed-signature'
            })
        ),
        // 2 public key requests
        ...Array(2).fill(null).map(() =>
          request(app).get('/api/v1/tokens/public-keys')
        )
      ];

      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;

      // All requests should succeed
      responses.forEach((response, index) => {
        if (index < 5) {
          // Balance requests
          expect(response.status).toBe(200);
        } else if (index < 8) {
          // Token validations
          expect(response.status).toBe(200);
        } else if (index < 10) {
          // Transaction submissions
          expect(response.status).toBe(201);
        } else {
          // Public key requests
          expect(response.status).toBe(200);
        }
        expect(response.body.success).toBe(true);
      });

      // Mixed operations should complete efficiently
      expect(totalTime).toBeLessThan(3000);
    });
  });

  describe('Large Dataset Performance', () => {
    it('should handle transaction sync with large transaction history', async () => {
      const largeTransactionSet = Array.from({ length: 1000 }, (_, i) => ({
        id: `large-tx-${i}`,
        sender_id: 'perf-user-123',
        receiver_id: `user-${i % 10}`,
        amount: `${(i + 1) * 10}.00`,
        type: 'offline',
        status: 'completed',
        created_at: new Date(Date.now() - (i * 60000)), // Each transaction 1 minute apart
        updated_at: new Date()
      }));

      mockTransactionDAO.findByUserId.mockResolvedValue(largeTransactionSet as any);

      const startTime = Date.now();

      const response = await request(app)
        .get('/api/v1/transactions/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ since: '0', limit: '100' });

      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.transactions).toHaveLength(100); // Limited by query
      expect(responseTime).toBeLessThan(1000); // Should handle large datasets efficiently
    });

    it('should handle wallet history with pagination efficiently', async () => {
      const largeHistorySet = Array.from({ length: 500 }, (_, i) => ({
        id: `history-tx-${i}`,
        type: i % 2 === 0 ? 'token_purchase' : 'token_transfer',
        amount: `${(i + 1) * 5}.00`,
        status: 'completed',
        created_at: new Date(Date.now() - (i * 120000)), // Each transaction 2 minutes apart
        blockchain_tx_hash: i % 3 === 0 ? `0xhash${i}` : null,
        sender_id: 'perf-user-123',
        receiver_id: i % 2 === 0 ? null : `user-${i % 5}`,
        metadata: { index: i }
      }));

      mockTransactionDAO.getUserTransactionHistory.mockResolvedValue(largeHistorySet.slice(0, 50) as any);
      mockTransactionDAO.getUserTransactionCount.mockResolvedValue(500);

      const startTime = Date.now();

      const response = await request(app)
        .get('/api/v1/wallet/history')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: '1', limit: '50' });

      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.data).toHaveLength(50);
      expect(response.body.data.pagination.total).toBe(500);
      expect(responseTime).toBeLessThan(800);
    });

    it('should handle public key database with many users', async () => {
      const manyUsers = Array.from({ length: 10000 }, (_, i) => ({
        id: `bulk-user-${i}`,
        public_key: `bulk-public-key-${i}`,
        wallet_address: `0x${i.toString(16).padStart(40, '0')}`,
        updated_at: new Date()
      }));

      mockUserDAO.findActiveUsers.mockResolvedValue(manyUsers as any);

      const startTime = Date.now();

      const response = await request(app)
        .get('/api/v1/tokens/public-keys');

      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Object.keys(response.body.data.publicKeys)).toHaveLength(10000);
      expect(responseTime).toBeLessThan(1500); // Should handle large user base
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should handle multiple large requests without memory leaks', async () => {
      const initialMemory = process.memoryUsage();

      // Simulate multiple large operations
      const operations = [];

      for (let i = 0; i < 50; i++) {
        // Large transaction sync
        const largeTransactionSet = Array.from({ length: 100 }, (_, j) => ({
          id: `mem-tx-${i}-${j}`,
          sender_id: 'perf-user-123',
          receiver_id: `user-${j}`,
          amount: `${j + 1}.00`,
          type: 'offline',
          status: 'completed',
          created_at: new Date(),
          updated_at: new Date()
        }));

        mockTransactionDAO.findByUserId.mockResolvedValue(largeTransactionSet as any);

        operations.push(
          request(app)
            .get('/api/v1/transactions/sync')
            .set('Authorization', `Bearer ${authToken}`)
            .query({ since: '0', limit: '100' })
        );
      }

      const responses = await Promise.all(operations);

      // All operations should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory increase should be reasonable (less than 100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });
  });

  describe('Error Handling Performance', () => {
    it('should handle validation errors quickly', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .post('/api/v1/transactions/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          // Missing required fields
          senderId: 'perf-user-123'
        });

      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(responseTime).toBeLessThan(100); // Error responses should be very fast
    });

    it('should handle authentication errors efficiently', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .get('/api/v1/wallet/balance');
        // No authorization header

      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(responseTime).toBeLessThan(50); // Auth errors should be immediate
    });

    it('should handle database errors without significant delay', async () => {
      mockBlockchainService.getTokenBalance.mockRejectedValue(new Error('Database timeout'));

      const startTime = Date.now();

      const response = await request(app)
        .get('/api/v1/wallet/balance')
        .set('Authorization', `Bearer ${authToken}`);

      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(responseTime).toBeLessThan(1000); // Should fail fast, not hang
    });
  });

  describe('Stress Testing', () => {
    it('should maintain performance under sustained load', async () => {
      const sustainedRequests = 100;
      const batchSize = 10;
      const batches = sustainedRequests / batchSize;
      
      const allResponseTimes: number[] = [];

      for (let batch = 0; batch < batches; batch++) {
        const batchStartTime = Date.now();
        
        const batchRequests = Array(batchSize).fill(null).map(() =>
          request(app)
            .get('/api/v1/wallet/balance')
            .set('Authorization', `Bearer ${authToken}`)
        );

        const batchResponses = await Promise.all(batchRequests);
        const batchTime = Date.now() - batchStartTime;
        
        // All requests in batch should succeed
        batchResponses.forEach(response => {
          expect(response.status).toBe(200);
          expect(response.body.success).toBe(true);
        });

        allResponseTimes.push(batchTime / batchSize);

        // Small delay between batches to simulate realistic usage
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Calculate performance metrics
      const averageResponseTime = allResponseTimes.reduce((a, b) => a + b, 0) / allResponseTimes.length;
      const maxResponseTime = Math.max(...allResponseTimes);
      const minResponseTime = Math.min(...allResponseTimes);

      // Performance should remain consistent
      expect(averageResponseTime).toBeLessThan(200);
      expect(maxResponseTime).toBeLessThan(500);
      expect(maxResponseTime - minResponseTime).toBeLessThan(300); // Variance should be reasonable
    });
  });
});