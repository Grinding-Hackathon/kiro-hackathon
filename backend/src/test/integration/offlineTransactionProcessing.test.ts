import request from 'supertest';
import { app } from '../../index';
import { TransactionDAO } from '../../database/dao/TransactionDAO';
import { OfflineTokenDAO } from '../../database/dao/OfflineTokenDAO';
import { UserDAO } from '../../database/dao/UserDAO';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { describe } from 'node:test';

describe('Offline Transaction Processing Integration Tests', () => {
  let transactionDAO: TransactionDAO;
  let offlineTokenDAO: OfflineTokenDAO;
  let userDAO: UserDAO;
  let authToken: string;
  let testUserId: string;
  let testTokenId: string;

  beforeAll(async () => {
    transactionDAO = new TransactionDAO();
    offlineTokenDAO = new OfflineTokenDAO();
    userDAO = new UserDAO();
    
    // Create test user
    const testUser = await userDAO.create({
      wallet_address: '0x1234567890123456789012345678901234567890',
      public_key: 'test_public_key'
    });
    
    testUserId = testUser!.id;
    authToken = 'Bearer test_token';

    // Create test token
    const testToken = await offlineTokenDAO.create({
      user_id: testUserId,
      amount: '100.00',
      signature: 'test_signature',
      issuer_public_key: 'issuer_key',
      expires_at: new Date(Date.now() + 86400000) // 1 day from now
    });
    
    testTokenId = testToken!.id;
  });

  afterAll(async () => {
    // Clean up test data - skip for now as delete method may not be implemented
    // if (testTokenId) {
    //   await offlineTokenDAO.delete(testTokenId);
    // }
    // if (testUserId) {
    //   await userDAO.delete(testUserId);
    // }
  });

  describe('POST /api/v1/transactions/sync-offline', () => {
    it('should process valid offline transactions', async () => {
      const offlineTransactions = [
        {
          id: 'local_tx_1',
          senderId: testUserId,
          receiverId: 'receiver_123',
          amount: '50.00',
          type: 'offline',
          senderSignature: 'sender_sig_123',
          receiverSignature: 'receiver_sig_123',
          timestamp: new Date().toISOString()
        }
      ];

      const response = await request(app)
        .post('/api/v1/transactions/sync-offline')
        .set('Authorization', authToken)
        .send({ transactions: offlineTransactions })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.processedTransactions).toHaveLength(1);
      expect(response.body.data.processedTransactions[0].status).toBe('accepted');
      expect(response.body.data.conflicts).toHaveLength(0);

      // Clean up created transaction - skip for now
      // const createdTxId = response.body.data.processedTransactions[0].serverTransactionId;
      // if (createdTxId) {
      //   await transactionDAO.delete(createdTxId);
      // }
    });

    it('should handle validation errors in offline transactions', async () => {
      const invalidTransactions = [
        {
          id: 'local_tx_invalid',
          // Missing required fields
          type: 'offline'
        }
      ];

      const response = await request(app)
        .post('/api/v1/transactions/sync-offline')
        .set('Authorization', authToken)
        .send({ transactions: invalidTransactions })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.processedTransactions).toHaveLength(1);
      expect(response.body.data.processedTransactions[0].status).toBe('rejected');
      expect(response.body.data.processedTransactions[0].reason).toContain('Missing required fields');
    });

    it('should detect double spending conflicts', async () => {
      // First, create a transaction that uses the token
      const existingTransaction = await transactionDAO.create({
        sender_id: testUserId,
        receiver_id: 'receiver_456',
        amount: '30.00',
        type: 'token_redemption',
        token_ids: [testTokenId]
      });

      // Update it to completed status
      if (existingTransaction) {
        await transactionDAO.update(existingTransaction.id, { status: 'completed' });
      }

      const conflictingTransactions = [
        {
          id: 'local_tx_conflict',
          senderId: testUserId,
          receiverId: 'receiver_789',
          amount: '40.00',
          type: 'token_redemption',
          tokenIds: [testTokenId], // Same token already used
          timestamp: new Date().toISOString()
        }
      ];

      const response = await request(app)
        .post('/api/v1/transactions/sync-offline')
        .set('Authorization', authToken)
        .send({ transactions: conflictingTransactions })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.processedTransactions).toHaveLength(1);
      expect(response.body.data.processedTransactions[0].status).toBe('conflict');
      expect(response.body.data.conflicts).toHaveLength(1);
      expect(response.body.data.conflicts[0].conflictType).toBe('double_spend');

      // Clean up - skip for now
      // if (existingTransaction) {
      //   await transactionDAO.delete(existingTransaction.id);
      // }
    });

    it('should require authentication', async () => {
      const offlineTransactions = [
        {
          id: 'local_tx_unauth',
          amount: '25.00',
          type: 'offline',
          timestamp: new Date().toISOString()
        }
      ];

      await request(app)
        .post('/api/v1/transactions/sync-offline')
        .send({ transactions: offlineTransactions })
        .expect(401);
    });

    it('should handle batch processing of multiple transactions', async () => {
      const batchTransactions = [
        {
          id: 'local_tx_batch_1',
          senderId: testUserId,
          receiverId: 'receiver_batch_1',
          amount: '10.00',
          type: 'offline',
          senderSignature: 'batch_sig_1',
          timestamp: new Date().toISOString()
        },
        {
          id: 'local_tx_batch_2',
          senderId: testUserId,
          receiverId: 'receiver_batch_2',
          amount: '15.00',
          type: 'offline',
          senderSignature: 'batch_sig_2',
          timestamp: new Date().toISOString()
        },
        {
          id: 'local_tx_batch_invalid',
          // Invalid transaction - missing amount
          type: 'offline'
        }
      ];

      const response = await request(app)
        .post('/api/v1/transactions/sync-offline')
        .set('Authorization', authToken)
        .send({ transactions: batchTransactions })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.processedTransactions).toHaveLength(3);
      
      // Check that valid transactions were accepted
      const acceptedTxs = response.body.data.processedTransactions.filter((tx: any) => tx.status === 'accepted');
      const rejectedTxs = response.body.data.processedTransactions.filter((tx: any) => tx.status === 'rejected');
      
      expect(acceptedTxs).toHaveLength(2);
      expect(rejectedTxs).toHaveLength(1);

      // Clean up accepted transactions - skip for now
      // for (const acceptedTx of acceptedTxs) {
      //   if (acceptedTx.serverTransactionId) {
      //     await transactionDAO.delete(acceptedTx.serverTransactionId);
      //   }
      // }
    });
  });
});