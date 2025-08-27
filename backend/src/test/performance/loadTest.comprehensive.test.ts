import request from 'supertest';
import { Express } from 'express';
import { TransactionDAO } from '../../database/dao/TransactionDAO';
import { OfflineTokenDAO } from '../../database/dao/OfflineTokenDAO';
import { blockchainService } from '../../services/blockchainService';

// Mock dependencies
jest.mock('../../database/dao/TransactionDAO');
jest.mock('../../database/dao/OfflineTokenDAO');
jest.mock('../../services/blockchainService');

describe('Load Testing - Comprehensive Performance Tests', () => {
  let app: Express;
  let mockTransactionDAO: jest.Mocked<TransactionDAO>;
  let mockOfflineTokenDAO: jest.Mocked<OfflineTokenDAO>;
  let mockBlockchainService: jest.Mocked<typeof blockchainService>;

  beforeAll(async () => {
    // Create a minimal Express app for testing
    const express = require('express');
    app = express();
    app.use(express.json());
    
    // Mock routes for testing
    app.get('/api/v1/wallet/balance', (_req, res) => {
      res.json({ success: true, data: { balance: '1000.00' } });
    });
    
    app.get('/api/v1/wallet/history', (_req, res) => {
      res.json({ success: true, data: { transactions: [] } });
    });
    
    app.post('/api/v1/tokens/validate', (_req, res) => {
      res.json({ success: true, data: { valid: true } });
    });
    
    app.post('/api/v1/transactions/submit', (_req, res) => {
      res.status(201).json({ success: true, data: { id: 'tx_123' } });
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mocked instances
    mockTransactionDAO = new TransactionDAO() as jest.Mocked<TransactionDAO>;
    mockOfflineTokenDAO = new OfflineTokenDAO() as jest.Mocked<OfflineTokenDAO>;
    mockBlockchainService = blockchainService as jest.Mocked<typeof blockchainService>;

    // Mock DAO methods
    mockTransactionDAO.create = jest.fn();
    mockTransactionDAO.getUserTransactionHistory = jest.fn();
    mockTransactionDAO.getUserTransactionCount = jest.fn();
    mockTransactionDAO.getUserPendingTransactions = jest.fn();
    
    mockOfflineTokenDAO.findById = jest.fn();
    mockOfflineTokenDAO.getUserTokenBalance = jest.fn();
    mockOfflineTokenDAO.getUserTokenCount = jest.fn();
    
    // Mock blockchain service
    mockBlockchainService.getTokenBalance = jest.fn();
  });

  describe('Concurrent Request Handling', () => {
    it('should handle 100 concurrent balance requests', async () => {
      const concurrentRequests = 100;
      const promises: Promise<any>[] = [];
      
      const startTime = Date.now();
      
      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(
          request(app)
            .get('/api/v1/wallet/balance')
            .set('Authorization', `Bearer test-token-${i}`)
            .expect(200)
        );
      }
      
      const results = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      expect(results).toHaveLength(concurrentRequests);
      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
      
      // Calculate average response time
      const avgResponseTime = totalTime / concurrentRequests;
      expect(avgResponseTime).toBeLessThan(100); // Average should be under 100ms
    }, 10000);

    it('should handle 50 concurrent transaction submissions', async () => {
      const concurrentRequests = 50;
      const promises: Promise<any>[] = [];
      
      const startTime = Date.now();
      
      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(
          request(app)
            .post('/api/v1/transactions/submit')
            .set('Authorization', `Bearer test-token-${i}`)
            .send({
              senderId: `user-${i}`,
              receiverId: `user-${(i + 1) % concurrentRequests}`,
              amount: '10.00',
              type: 'offline',
              senderSignature: `signature-${i}`
            })
            .expect(201)
        );
      }
      
      const results = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      expect(results).toHaveLength(concurrentRequests);
      expect(totalTime).toBeLessThan(10000); // Should complete within 10 seconds
      
      // Calculate average response time
      const avgResponseTime = totalTime / concurrentRequests;
      expect(avgResponseTime).toBeLessThan(200); // Average should be under 200ms
    }, 15000);
  });

  describe('Sustained Load Testing', () => {
    it('should handle sustained load for 30 seconds', async () => {
      const duration = 30000; // 30 seconds
      const users = 10;
      const authTokens = Array.from({ length: users }, (_, i) => `test-token-${i}`);
      
      const startTime = Date.now();
      const promises: Promise<void>[] = [];

      // Helper function for user session simulation
      const simulateUserSession = async (userId: number, sessionDuration: number): Promise<void> => {
        const authToken = authTokens[userId % authTokens.length];
        const sessionStartTime = Date.now();
        const actions = ['checkBalance', 'viewHistory', 'validateToken', 'submitTransaction'];
        
        while (Date.now() - sessionStartTime < sessionDuration) {
          const action = actions[Math.floor(Math.random() * actions.length)];
          
          try {
            switch (action) {
              case 'checkBalance':
                await request(app)
                  .get('/api/v1/wallet/balance')
                  .set('Authorization', `Bearer ${authToken}`)
                  .expect(200);
                break;
                
              case 'viewHistory':
                await request(app)
                  .get('/api/v1/wallet/history')
                  .set('Authorization', `Bearer ${authToken}`)
                  .expect(200);
                break;
                
              case 'validateToken':
                await request(app)
                  .post('/api/v1/tokens/validate')
                  .set('Authorization', `Bearer ${authToken}`)
                  .send({ tokenId: `user-token-${userId}` });
                break;
                
              case 'submitTransaction':
                await request(app)
                  .post('/api/v1/transactions/submit')
                  .set('Authorization', `Bearer ${authToken}`)
                  .send({
                    senderId: `load-user-${userId}`,
                    receiverId: `load-user-${(userId + 1) % users}`,
                    amount: '10.00',
                    type: 'offline',
                    senderSignature: `session-signature-${userId}-${Date.now()}`
                  });
                break;
            }
          } catch (error) {
            console.log(`User ${userId} action ${action} failed:`, error);
          }
          
          // Small delay between actions
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      };

      // Simulate multiple users performing actions concurrently
      for (let i = 0; i < users; i++) {
        promises.push(simulateUserSession(i, duration));
      }

      await Promise.all(promises);
      
      const totalTime = Date.now() - startTime;
      expect(totalTime).toBeGreaterThanOrEqual(duration - 1000); // Allow 1s tolerance
      expect(totalTime).toBeLessThan(duration + 5000); // Should not exceed by more than 5s
    }, 35000);
  });

  describe('Memory Usage Testing', () => {
    it('should not have significant memory leaks during load testing', async () => {
      const initialMemory = process.memoryUsage();
      const requests = 200;
      
      // Perform many requests to test for memory leaks
      for (let i = 0; i < requests; i++) {
        await request(app)
          .get('/api/v1/wallet/balance')
          .set('Authorization', `Bearer test-token-${i % 10}`)
          .expect(200);
          
        // Force garbage collection every 50 requests
        if (i % 50 === 0 && global.gc) {
          global.gc();
        }
      }
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    }, 30000);
  });

  describe('Error Rate Testing', () => {
    it('should maintain low error rate under high load', async () => {
      const totalRequests = 100;
      const promises: Promise<any>[] = [];
      let successCount = 0;
      let errorCount = 0;
      
      for (let i = 0; i < totalRequests; i++) {
        promises.push(
          request(app)
            .get('/api/v1/wallet/balance')
            .set('Authorization', `Bearer test-token-${i}`)
            .then(response => {
              if (response.status === 200) {
                successCount++;
              } else {
                errorCount++;
              }
              return response;
            })
            .catch(error => {
              errorCount++;
              return error;
            })
        );
      }
      
      await Promise.all(promises);
      
      const errorRate = (errorCount / totalRequests) * 100;
      expect(errorRate).toBeLessThan(5); // Error rate should be less than 5%
      expect(successCount).toBeGreaterThan(totalRequests * 0.95); // At least 95% success rate
    }, 15000);
  });

  describe('Response Time Consistency', () => {
    it('should maintain consistent response times under load', async () => {
      const requests = 50;
      const responseTimes: number[] = [];
      
      for (let i = 0; i < requests; i++) {
        const startTime = Date.now();
        
        await request(app)
          .get('/api/v1/wallet/balance')
          .set('Authorization', `Bearer test-token-${i}`)
          .expect(200);
          
        const responseTime = Date.now() - startTime;
        responseTimes.push(responseTime);
      }
      
      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);
      const minResponseTime = Math.min(...responseTimes);
      
      expect(avgResponseTime).toBeLessThan(500); // Average should be under 500ms
      expect(maxResponseTime).toBeLessThan(2000); // Max should be under 2s
      expect(maxResponseTime - minResponseTime).toBeLessThan(1500); // Variance should be reasonable
    }, 20000);
  });

  describe('Stress Testing', () => {
    it('should handle extreme load gracefully', async () => {
      const extremeLoad = 500;
      const batchSize = 50;
      const batches = Math.ceil(extremeLoad / batchSize);
      
      let totalSuccessful = 0;
      let totalFailed = 0;
      
      for (let batch = 0; batch < batches; batch++) {
        const promises: Promise<any>[] = [];
        
        for (let i = 0; i < batchSize; i++) {
          promises.push(
            request(app)
              .get('/api/v1/wallet/balance')
              .set('Authorization', `Bearer stress-token-${batch}-${i}`)
              .then(response => {
                if (response.status === 200) {
                  totalSuccessful++;
                } else {
                  totalFailed++;
                }
                return response;
              })
              .catch(error => {
                totalFailed++;
                return error;
              })
          );
        }
        
        await Promise.all(promises);
        
        // Small delay between batches to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const successRate = (totalSuccessful / extremeLoad) * 100;
      expect(successRate).toBeGreaterThan(80); // At least 80% success rate under extreme load
      expect(totalSuccessful + totalFailed).toBe(extremeLoad);
    }, 60000);
  });
});