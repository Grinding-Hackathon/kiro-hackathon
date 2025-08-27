import request from 'supertest';
import { app } from '../../index';
import { TransactionDAO } from '../../database/dao/TransactionDAO';
import { UserDAO } from '../../database/dao/UserDAO';

describe('Transaction Sync Integration Tests', () => {
  let transactionDAO: TransactionDAO;
  let userDAO: UserDAO;
  let authToken: string;
  let testUserId: string;

  beforeAll(async () => {
    transactionDAO = new TransactionDAO();
    userDAO = new UserDAO();
    
    // Create test user and get auth token
    const testUser = await userDAO.create({
      wallet_address: '0x1234567890123456789012345678901234567890',
      public_key: 'test_public_key'
    });
    
    testUserId = testUser!.id;
    
    // Mock auth token (in real implementation, this would come from auth service)
    authToken = 'Bearer test_token';
  });

  afterAll(async () => {
    // Clean up test data - skip for now as delete method may not be implemented
    // if (testUserId) {
    //   await userDAO.delete(testUserId);
    // }
  });

  describe('GET /api/v1/transactions/sync', () => {
    it('should sync transactions with proper pagination', async () => {
      // Create test transactions
      const transaction1 = await transactionDAO.create({
        sender_id: testUserId,
        receiver_id: 'receiver_1',
        amount: '100.00',
        type: 'offline'
      });

      const transaction2 = await transactionDAO.create({
        sender_id: 'sender_1',
        receiver_id: testUserId,
        amount: '50.00',
        type: 'online'
      });

      const response = await request(app)
        .get('/api/v1/transactions/sync')
        .set('Authorization', authToken)
        .query({
          since: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
          limit: 10,
          offset: 0
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.transactions).toHaveLength(2);
      expect(response.body.data.totalCount).toBe(2);
      expect(response.body.data.hasMore).toBe(false);
      expect(response.body.data.lastSyncTimestamp).toBeDefined();

      // Clean up - skip for now as delete method may not be implemented
      // if (transaction1) await transactionDAO.delete(transaction1.id);
      // if (transaction2) await transactionDAO.delete(transaction2.id);
    });
  });
});