import request from 'supertest';
import { app } from '../../index';
import { TransactionDAO } from '../../database/dao/TransactionDAO';
import { OfflineTokenDAO } from '../../database/dao/OfflineTokenDAO';
import { UserDAO } from '../../database/dao/UserDAO';
import { blockchainService } from '../../services/blockchainService';
import { offlineTokenManager } from '../../services/offlineTokenManager';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Mock dependencies
jest.mock('../../database/dao/TransactionDAO');
jest.mock('../../database/dao/OfflineTokenDAO');
jest.mock('../../database/dao/UserDAO');
jest.mock('../../services/blockchainService');
jest.mock('../../services/offlineTokenManager');

describe('Complete Transaction Workflow E2E Tests', () => {
  let senderAuthToken: string;
  let receiverAuthToken: string;
  let mockTransactionDAO: jest.Mocked<TransactionDAO>;
  let mockOfflineTokenDAO: jest.Mocked<OfflineTokenDAO>;
  let mockUserDAO: jest.Mocked<UserDAO>;
  let mockBlockchainService: jest.Mocked<typeof blockchainService>;
  let mockOfflineTokenManager: jest.Mocked<typeof offlineTokenManager>;

  const senderUser = {
    id: 'sender-user-123',
    wallet_address: '0x1111111111111111111111111111111111111111',
    public_key: 'sender-public-key',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date()
  };

  const receiverUser = {
    id: 'receiver-user-456',
    wallet_address: '0x2222222222222222222222222222222222222222',
    public_key: 'receiver-public-key',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date()
  };

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

    // Create auth tokens
    senderAuthToken = jwt.sign(
      { 
        userId: senderUser.id,
        walletAddress: senderUser.wallet_address,
        publicKey: senderUser.public_key
      },
      process.env['JWT_SECRET'] || 'test-secret',
      { expiresIn: '1h' }
    );

    receiverAuthToken = jwt.sign(
      { 
        userId: receiverUser.id,
        walletAddress: receiverUser.wallet_address,
        publicKey: receiverUser.public_key
      },
      process.env['JWT_SECRET'] || 'test-secret',
      { expiresIn: '1h' }
    );

    // Setup default mocks
    mockUserDAO.findById
      .mockImplementation((id) => {
        if (id === senderUser.id) return Promise.resolve(senderUser as any);
        if (id === receiverUser.id) return Promise.resolve(receiverUser as any);
        return Promise.resolve(null);
      });

    mockBlockchainService.getTokenBalance.mockResolvedValue('1000.00');
    mockOfflineTokenDAO.getUserTokenBalance.mockResolvedValue('500.00');
    mockOfflineTokenDAO.getUserTokenCount.mockResolvedValue(10);
    mockTransactionDAO.getUserPendingTransactions.mockResolvedValue([]);
    mockOfflineTokenManager.getPublicKey.mockReturnValue('otm-public-key');
    mockOfflineTokenManager.getWalletAddress.mockReturnValue('0x9876543210987654321098765432109876543210');
  });

  describe('Complete Online Transaction Workflow', () => {
    it('should complete full online transaction from submission to confirmation', async () => {
      const transactionAmount = '100.00';
      let transactionId: string;

      // Step 1: Sender submits online transaction
      const mockTransaction = {
        id: 'online-tx-123',
        sender_id: senderUser.id,
        receiver_id: receiverUser.id,
        amount: transactionAmount,
        type: 'online',
        status: 'pending',
        blockchain_tx_hash: null,
        created_at: new Date(),
        updated_at: new Date(),
        error_message: null,
        metadata: {}
      };

      mockTransactionDAO.create.mockResolvedValue(mockTransaction as any);
      mockTransactionDAO.update.mockResolvedValue(mockTransaction as any);

      const submitResponse = await request(app)
        .post('/api/v1/transactions/submit')
        .set('Authorization', `Bearer ${senderAuthToken}`)
        .send({
          senderId: senderUser.id,
          receiverId: receiverUser.id,
          amount: transactionAmount,
          type: 'online'
        });

      expect(submitResponse.status).toBe(201);
      expect(submitResponse.body.success).toBe(true);
      expect(submitResponse.body.data.transactionId).toBe('online-tx-123');
      expect(submitResponse.body.data.status).toBe('pending');

      transactionId = submitResponse.body.data.transactionId;

      // Step 2: Simulate blockchain processing (transaction gets blockchain hash)
      const updatedTransaction = {
        ...mockTransaction,
        blockchain_tx_hash: '0xabc123def456',
        status: 'completed'
      };

      mockTransactionDAO.findById.mockResolvedValue(updatedTransaction as any);
      mockBlockchainService.getTransaction.mockResolvedValue({
        hash: '0xabc123def456',
        confirmations: 3,
        blockNumber: 12345,
        gasUsed: '21000'
      } as any);

      // Step 3: Sender checks transaction status
      const senderStatusResponse = await request(app)
        .get(`/api/v1/transactions/${transactionId}/status`)
        .set('Authorization', `Bearer ${senderAuthToken}`);

      expect(senderStatusResponse.status).toBe(200);
      expect(senderStatusResponse.body.success).toBe(true);
      expect(senderStatusResponse.body.data).toMatchObject({
        transactionId,
        status: 'completed',
        blockchainTxHash: '0xabc123def456',
        confirmations: 3
      });

      // Step 4: Receiver checks transaction status
      const receiverStatusResponse = await request(app)
        .get(`/api/v1/transactions/${transactionId}/status`)
        .set('Authorization', `Bearer ${receiverAuthToken}`);

      expect(receiverStatusResponse.status).toBe(200);
      expect(receiverStatusResponse.body.success).toBe(true);
      expect(receiverStatusResponse.body.data.transactionId).toBe(transactionId);

      // Step 5: Both users sync their transactions
      const senderTransactions = [updatedTransaction];
      const receiverTransactions = [updatedTransaction];

      mockTransactionDAO.findByUserId
        .mockImplementation((userId) => {
          if (userId === senderUser.id) return Promise.resolve(senderTransactions as any);
          if (userId === receiverUser.id) return Promise.resolve(receiverTransactions as any);
          return Promise.resolve([]);
        });

      const senderSyncResponse = await request(app)
        .get('/api/v1/transactions/sync')
        .set('Authorization', `Bearer ${senderAuthToken}`)
        .query({ since: '0' });

      expect(senderSyncResponse.status).toBe(200);
      expect(senderSyncResponse.body.success).toBe(true);
      expect(senderSyncResponse.body.data.transactions).toHaveLength(1);
      expect(senderSyncResponse.body.data.transactions[0].id).toBe(transactionId);

      const receiverSyncResponse = await request(app)
        .get('/api/v1/transactions/sync')
        .set('Authorization', `Bearer ${receiverAuthToken}`)
        .query({ since: '0' });

      expect(receiverSyncResponse.status).toBe(200);
      expect(receiverSyncResponse.body.success).toBe(true);
      expect(receiverSyncResponse.body.data.transactions).toHaveLength(1);
      expect(receiverSyncResponse.body.data.transactions[0].id).toBe(transactionId);

      // Step 6: Verify wallet balances are updated
      const senderBalanceResponse = await request(app)
        .get('/api/v1/wallet/balance')
        .set('Authorization', `Bearer ${senderAuthToken}`);

      expect(senderBalanceResponse.status).toBe(200);
      expect(senderBalanceResponse.body.success).toBe(true);
      expect(senderBalanceResponse.body.data.totalBalance).toBe(1500.00); // 1000 + 500

      const receiverBalanceResponse = await request(app)
        .get('/api/v1/wallet/balance')
        .set('Authorization', `Bearer ${receiverAuthToken}`);

      expect(receiverBalanceResponse.status).toBe(200);
      expect(receiverBalanceResponse.body.success).toBe(true);
      expect(receiverBalanceResponse.body.data.totalBalance).toBe(1500.00); // 1000 + 500
    });
  });

  describe('Complete Offline Transaction Workflow', () => {
    it('should complete full offline transaction with token validation and division', async () => {
      const paymentAmount = 75;
      const tokenAmount = 200;

      // Step 1: Sender purchases tokens
      const mockTokens = [
        {
          id: 'token-1',
          userId: senderUser.id,
          amount: tokenAmount,
          signature: 'token-signature-1',
          issuedAt: new Date(),
          expiresAt: new Date(Date.now() + 86400000),
          isSpent: false
        }
      ];

      const mockTokenRecord = {
        id: 'token-record-1',
        user_id: senderUser.id,
        amount: tokenAmount.toString(),
        signature: 'token-signature-1',
        issued_at: new Date(),
        expires_at: new Date(Date.now() + 86400000),
        status: 'active',
        created_at: new Date()
      };

      const mockPurchaseTransaction = {
        id: 'purchase-tx-123',
        sender_id: senderUser.id,
        amount: tokenAmount.toString(),
        type: 'token_purchase',
        status: 'completed'
      };

      mockOfflineTokenManager.issueTokens.mockResolvedValue(mockTokens as any);
      mockOfflineTokenDAO.create.mockResolvedValue(mockTokenRecord as any);
      mockTransactionDAO.create.mockResolvedValue(mockPurchaseTransaction as any);

      const purchaseResponse = await request(app)
        .post('/api/v1/wallet/tokens/purchase')
        .set('Authorization', `Bearer ${senderAuthToken}`)
        .send({ amount: tokenAmount });

      expect(purchaseResponse.status).toBe(200);
      expect(purchaseResponse.body.success).toBe(true);
      expect(purchaseResponse.body.data.tokens).toHaveLength(1);
      expect(purchaseResponse.body.data.tokens[0].amount).toBe(tokenAmount);

      const tokenId = purchaseResponse.body.data.tokens[0].id;

      // Step 2: Sender validates token before use
      const mockValidationResult = {
        isValid: true,
        error: null
      };

      mockOfflineTokenDAO.findById.mockResolvedValue(mockTokenRecord as any);
      mockOfflineTokenManager.validateToken.mockResolvedValue(mockValidationResult);

      const validationResponse = await request(app)
        .post('/api/v1/tokens/validate')
        .set('Authorization', `Bearer ${senderAuthToken}`)
        .send({ tokenId });

      expect(validationResponse.status).toBe(200);
      expect(validationResponse.body.success).toBe(true);
      expect(validationResponse.body.data.valid).toBe(true);
      expect(validationResponse.body.data.validationDetails.signatureValid).toBe(true);

      // Step 3: Sender divides token for payment (75) and change (125)
      const mockPaymentToken = {
        id: 'payment-token-id',
        userId: senderUser.id,
        amount: paymentAmount,
        signature: 'payment-signature',
        issuedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
        isSpent: false
      };

      const mockChangeToken = {
        id: 'change-token-id',
        userId: senderUser.id,
        amount: tokenAmount - paymentAmount,
        signature: 'change-signature',
        issuedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
        isSpent: false
      };

      const mockPaymentTokenRecord = {
        id: 'payment-record-id',
        user_id: senderUser.id,
        amount: paymentAmount.toString(),
        signature: 'payment-signature',
        issued_at: new Date(),
        expires_at: new Date(Date.now() + 86400000)
      };

      const mockChangeTokenRecord = {
        id: 'change-record-id',
        user_id: senderUser.id,
        amount: (tokenAmount - paymentAmount).toString(),
        signature: 'change-signature',
        issued_at: new Date(),
        expires_at: new Date(Date.now() + 86400000)
      };

      mockOfflineTokenManager.issueTokens
        .mockResolvedValueOnce([mockPaymentToken] as any)
        .mockResolvedValueOnce([mockChangeToken] as any);
      mockOfflineTokenDAO.create
        .mockResolvedValueOnce(mockPaymentTokenRecord as any)
        .mockResolvedValueOnce(mockChangeTokenRecord as any);
      mockOfflineTokenDAO.update.mockResolvedValue(undefined);

      const divisionResponse = await request(app)
        .post('/api/v1/tokens/divide')
        .set('Authorization', `Bearer ${senderAuthToken}`)
        .send({ tokenId, paymentAmount });

      expect(divisionResponse.status).toBe(200);
      expect(divisionResponse.body.success).toBe(true);
      expect(divisionResponse.body.data.paymentToken.amount).toBe(paymentAmount);
      expect(divisionResponse.body.data.changeToken.amount).toBe(tokenAmount - paymentAmount);

      const paymentTokenId = divisionResponse.body.data.paymentToken.id;

      // Step 4: Sender creates offline transaction
      const mockOfflineTransaction = {
        id: 'offline-tx-456',
        sender_id: senderUser.id,
        receiver_id: receiverUser.id,
        amount: paymentAmount.toString(),
        type: 'offline',
        status: 'pending',
        token_ids: [paymentTokenId],
        sender_signature: 'offline-signature-123',
        created_at: new Date(),
        updated_at: new Date(),
        metadata: {
          connectionType: 'bluetooth',
          deviceType: 'iPhone'
        }
      };

      mockTransactionDAO.create.mockResolvedValue(mockOfflineTransaction as any);

      const offlineTransactionResponse = await request(app)
        .post('/api/v1/transactions/submit')
        .set('Authorization', `Bearer ${senderAuthToken}`)
        .send({
          senderId: senderUser.id,
          receiverId: receiverUser.id,
          amount: paymentAmount.toString(),
          type: 'offline',
          senderSignature: 'offline-signature-123',
          tokenIds: [paymentTokenId],
          metadata: {
            connectionType: 'bluetooth',
            deviceType: 'iPhone'
          }
        });

      expect(offlineTransactionResponse.status).toBe(201);
      expect(offlineTransactionResponse.body.success).toBe(true);
      expect(offlineTransactionResponse.body.data.transactionId).toBe('offline-tx-456');

      // Step 5: Simulate offline transaction sync from mobile device
      const offlineTransactionData = {
        id: 'mobile-local-tx-1',
        senderId: senderUser.id,
        receiverId: receiverUser.id,
        amount: paymentAmount.toString(),
        type: 'offline',
        senderSignature: 'offline-signature-123',
        tokenIds: [paymentTokenId],
        timestamp: new Date().toISOString(),
        metadata: {
          connectionType: 'bluetooth',
          deviceType: 'iPhone',
          syncReason: 'connectivity_restored'
        }
      };

      const mockSyncedTransaction = {
        id: 'synced-tx-789',
        sender_id: senderUser.id,
        receiver_id: receiverUser.id,
        amount: paymentAmount.toString(),
        type: 'offline',
        status: 'completed',
        created_at: new Date(),
        updated_at: new Date()
      };

      // Mock token validation for sync
      const mockPaymentTokenForSync = {
        id: paymentTokenId,
        user_id: senderUser.id,
        amount: paymentAmount.toString(),
        status: 'active',
        expires_at: new Date(Date.now() + 86400000)
      };

      mockOfflineTokenDAO.findById.mockResolvedValue(mockPaymentTokenForSync as any);
      mockTransactionDAO.findByStatus.mockResolvedValue([]); // No conflicts
      mockTransactionDAO.create.mockResolvedValue(mockSyncedTransaction as any);
      mockOfflineTokenDAO.update.mockResolvedValue(undefined);

      const syncResponse = await request(app)
        .post('/api/v1/transactions/sync-offline')
        .set('Authorization', `Bearer ${senderAuthToken}`)
        .send({ 
          transactions: [offlineTransactionData],
          syncMetadata: {
            lastOnlineAt: new Date(Date.now() - 3600000).toISOString(),
            queueSize: 1,
            syncReason: 'connectivity_restored'
          }
        });

      expect(syncResponse.status).toBe(200);
      expect(syncResponse.body.success).toBe(true);
      expect(syncResponse.body.data.processedTransactions).toHaveLength(1);
      expect(syncResponse.body.data.processedTransactions[0]).toMatchObject({
        localId: 'mobile-local-tx-1',
        serverTransactionId: 'synced-tx-789',
        status: 'accepted'
      });
      expect(syncResponse.body.data.conflicts).toHaveLength(0);

      // Step 6: Receiver checks their transaction history
      const receiverTransactions = [mockSyncedTransaction];
      mockTransactionDAO.getUserTransactionHistory.mockResolvedValue(receiverTransactions as any);
      mockTransactionDAO.getUserTransactionCount.mockResolvedValue(1);

      const receiverHistoryResponse = await request(app)
        .get('/api/v1/wallet/history')
        .set('Authorization', `Bearer ${receiverAuthToken}`)
        .query({ limit: '10' });

      expect(receiverHistoryResponse.status).toBe(200);
      expect(receiverHistoryResponse.body.success).toBe(true);
      expect(receiverHistoryResponse.body.data.data).toHaveLength(1);
      expect(receiverHistoryResponse.body.data.data[0]).toMatchObject({
        id: 'synced-tx-789',
        type: 'offline',
        amount: paymentAmount,
        status: 'completed'
      });

      // Step 7: Verify token status was updated
      expect(mockOfflineTokenDAO.update).toHaveBeenCalledWith(paymentTokenId, { status: 'spent' });
    });
  });

  describe('Complete Token Redemption Workflow', () => {
    it('should complete full token redemption from validation to blockchain transfer', async () => {
      const redemptionAmount = 150;

      // Step 1: User has tokens to redeem
      const mockTokensToRedeem = [
        { id: 'redeem-token-1', signature: 'redeem-signature-1' },
        { id: 'redeem-token-2', signature: 'redeem-signature-2' }
      ];

      const mockRedemptionResult = {
        amount: redemptionAmount,
        blockchainTxHash: '0xredemption123'
      };

      const mockRedemptionTransaction = {
        id: 'redemption-tx-123',
        receiver_id: senderUser.id,
        amount: redemptionAmount.toString(),
        type: 'token_redemption',
        blockchain_tx_hash: '0xredemption123',
        status: 'completed'
      };

      mockOfflineTokenManager.redeemTokens.mockResolvedValue(mockRedemptionResult as any);
      mockOfflineTokenDAO.markAsRedeemed.mockResolvedValue(undefined);
      mockTransactionDAO.create.mockResolvedValue(mockRedemptionTransaction as any);
      mockBlockchainService.getTokenBalance.mockResolvedValue('1150.00'); // Updated balance

      const redemptionResponse = await request(app)
        .post('/api/v1/wallet/tokens/redeem')
        .set('Authorization', `Bearer ${senderAuthToken}`)
        .send({ tokens: mockTokensToRedeem });

      expect(redemptionResponse.status).toBe(200);
      expect(redemptionResponse.body.success).toBe(true);
      expect(redemptionResponse.body.data).toMatchObject({
        transactionHash: '0xredemption123',
        blockchainBalance: 1150.00
      });

      // Step 2: Verify tokens were marked as redeemed
      expect(mockOfflineTokenDAO.markAsRedeemed).toHaveBeenCalledWith('redeem-token-1');
      expect(mockOfflineTokenDAO.markAsRedeemed).toHaveBeenCalledWith('redeem-token-2');

      // Step 3: Verify transaction was recorded
      expect(mockTransactionDAO.create).toHaveBeenCalledWith({
        receiver_id: senderUser.id,
        amount: redemptionAmount.toString(),
        type: 'token_redemption',
        blockchain_tx_hash: '0xredemption123'
      });

      // Step 4: Check updated wallet balance
      const balanceResponse = await request(app)
        .get('/api/v1/wallet/balance')
        .set('Authorization', `Bearer ${senderAuthToken}`);

      expect(balanceResponse.status).toBe(200);
      expect(balanceResponse.body.success).toBe(true);
      expect(balanceResponse.body.data.balances.blockchain.amount).toBe(1150.00);

      // Step 5: Verify transaction appears in history
      const historyTransactions = [mockRedemptionTransaction];
      mockTransactionDAO.getUserTransactionHistory.mockResolvedValue(historyTransactions as any);
      mockTransactionDAO.getUserTransactionCount.mockResolvedValue(1);

      const historyResponse = await request(app)
        .get('/api/v1/wallet/history')
        .set('Authorization', `Bearer ${senderAuthToken}`)
        .query({ type: 'token_redemption' });

      expect(historyResponse.status).toBe(200);
      expect(historyResponse.body.success).toBe(true);
      expect(historyResponse.body.data.data).toHaveLength(1);
      expect(historyResponse.body.data.data[0]).toMatchObject({
        id: 'redemption-tx-123',
        type: 'token_redemption',
        amount: redemptionAmount,
        status: 'completed'
      });
    });
  });

  describe('Error Recovery Workflows', () => {
    it('should handle transaction failure and recovery', async () => {
      // Step 1: Submit transaction that will fail
      const mockFailedTransaction = {
        id: 'failed-tx-123',
        sender_id: senderUser.id,
        receiver_id: receiverUser.id,
        amount: '100.00',
        type: 'online',
        status: 'failed',
        error_message: 'Insufficient blockchain balance',
        created_at: new Date(),
        updated_at: new Date()
      };

      mockTransactionDAO.create.mockResolvedValue(mockFailedTransaction as any);
      mockTransactionDAO.markAsFailed.mockResolvedValue(undefined);

      const failedSubmitResponse = await request(app)
        .post('/api/v1/transactions/submit')
        .set('Authorization', `Bearer ${senderAuthToken}`)
        .send({
          senderId: senderUser.id,
          receiverId: receiverUser.id,
          amount: '100.00',
          type: 'online'
        });

      expect(failedSubmitResponse.status).toBe(201);
      expect(failedSubmitResponse.body.success).toBe(true);

      // Step 2: Check transaction status shows failure
      mockTransactionDAO.findById.mockResolvedValue(mockFailedTransaction as any);

      const statusResponse = await request(app)
        .get(`/api/v1/transactions/${mockFailedTransaction.id}/status`)
        .set('Authorization', `Bearer ${senderAuthToken}`);

      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body.success).toBe(true);
      expect(statusResponse.body.data.status).toBe('failed');
      expect(statusResponse.body.data.errorMessage).toBe('Insufficient blockchain balance');

      // Step 3: User retries with sufficient balance
      const mockSuccessfulTransaction = {
        id: 'retry-tx-456',
        sender_id: senderUser.id,
        receiver_id: receiverUser.id,
        amount: '50.00',
        type: 'online',
        status: 'completed',
        blockchain_tx_hash: '0xretry123',
        created_at: new Date(),
        updated_at: new Date()
      };

      mockTransactionDAO.create.mockResolvedValue(mockSuccessfulTransaction as any);
      mockTransactionDAO.update.mockResolvedValue(mockSuccessfulTransaction as any);

      const retryResponse = await request(app)
        .post('/api/v1/transactions/submit')
        .set('Authorization', `Bearer ${senderAuthToken}`)
        .send({
          senderId: senderUser.id,
          receiverId: receiverUser.id,
          amount: '50.00',
          type: 'online'
        });

      expect(retryResponse.status).toBe(201);
      expect(retryResponse.body.success).toBe(true);
      expect(retryResponse.body.data.transactionId).toBe('retry-tx-456');

      // Step 4: Verify both transactions appear in history
      const allTransactions = [mockFailedTransaction, mockSuccessfulTransaction];
      mockTransactionDAO.getUserTransactionHistory.mockResolvedValue(allTransactions as any);
      mockTransactionDAO.getUserTransactionCount.mockResolvedValue(2);

      const historyResponse = await request(app)
        .get('/api/v1/wallet/history')
        .set('Authorization', `Bearer ${senderAuthToken}`);

      expect(historyResponse.status).toBe(200);
      expect(historyResponse.body.success).toBe(true);
      expect(historyResponse.body.data.data).toHaveLength(2);
      
      const failedTx = historyResponse.body.data.data.find((tx: any) => tx.id === 'failed-tx-123');
      const successfulTx = historyResponse.body.data.data.find((tx: any) => tx.id === 'retry-tx-456');
      
      expect(failedTx.status).toBe('failed');
      expect(successfulTx.status).toBe('completed');
    });

    it('should handle offline transaction conflicts and resolution', async () => {
      const conflictedTokenId = 'conflict-token-123';

      // Step 1: Create offline transactions that will conflict
      const offlineTransactions = [
        {
          id: 'mobile-tx-1',
          senderId: senderUser.id,
          receiverId: receiverUser.id,
          amount: '50.00',
          type: 'token_redemption',
          tokenIds: [conflictedTokenId],
          timestamp: new Date(Date.now() - 1800000).toISOString() // 30 minutes ago
        },
        {
          id: 'mobile-tx-2',
          senderId: senderUser.id,
          receiverId: 'other-user-789',
          amount: '30.00',
          type: 'token_redemption',
          tokenIds: [conflictedTokenId],
          timestamp: new Date(Date.now() - 900000).toISOString() // 15 minutes ago
        }
      ];

      // Mock token exists and is valid
      const mockToken = {
        id: conflictedTokenId,
        user_id: senderUser.id,
        amount: '50.00',
        status: 'active',
        expires_at: new Date(Date.now() + 86400000)
      };

      // Mock existing transaction (first one was already processed)
      const mockExistingTransaction = {
        id: 'existing-conflict-tx',
        sender_id: senderUser.id,
        receiver_id: receiverUser.id,
        amount: '50.00',
        type: 'token_redemption',
        status: 'completed',
        token_ids: [conflictedTokenId]
      };

      mockOfflineTokenDAO.findById.mockResolvedValue(mockToken as any);
      mockTransactionDAO.findByStatus.mockResolvedValue([mockExistingTransaction] as any);
      mockTransactionDAO.create.mockResolvedValue({
        id: 'accepted-tx-1',
        sender_id: senderUser.id,
        receiver_id: receiverUser.id,
        amount: '50.00',
        type: 'token_redemption',
        status: 'completed'
      } as any);

      const syncResponse = await request(app)
        .post('/api/v1/transactions/sync-offline')
        .set('Authorization', `Bearer ${senderAuthToken}`)
        .send({ transactions: offlineTransactions });

      expect(syncResponse.status).toBe(200);
      expect(syncResponse.body.success).toBe(true);
      
      // First transaction should be accepted (no conflict yet)
      expect(syncResponse.body.data.processedTransactions[0]).toMatchObject({
        localId: 'mobile-tx-1',
        status: 'accepted'
      });

      // Second transaction should have conflict
      expect(syncResponse.body.data.processedTransactions[1]).toMatchObject({
        localId: 'mobile-tx-2',
        status: 'conflict'
      });

      expect(syncResponse.body.data.conflicts).toHaveLength(1);
      expect(syncResponse.body.data.conflicts[0]).toMatchObject({
        localId: 'mobile-tx-2',
        conflictType: 'double_spend',
        resolution: 'server_wins'
      });
    });
  });

  describe('Multi-User Interaction Workflows', () => {
    it('should handle peer-to-peer transaction between two users', async () => {
      const transactionAmount = '25.00';

      // Step 1: Both users check their initial balances
      const senderInitialBalance = await request(app)
        .get('/api/v1/wallet/balance')
        .set('Authorization', `Bearer ${senderAuthToken}`);

      const receiverInitialBalance = await request(app)
        .get('/api/v1/wallet/balance')
        .set('Authorization', `Bearer ${receiverAuthToken}`);

      expect(senderInitialBalance.status).toBe(200);
      expect(receiverInitialBalance.status).toBe(200);

      // Step 2: Sender initiates P2P transaction
      const mockP2PTransaction = {
        id: 'p2p-tx-123',
        sender_id: senderUser.id,
        receiver_id: receiverUser.id,
        amount: transactionAmount,
        type: 'offline',
        status: 'pending',
        sender_signature: 'sender-p2p-signature',
        created_at: new Date(),
        updated_at: new Date()
      };

      mockTransactionDAO.create.mockResolvedValue(mockP2PTransaction as any);

      const p2pResponse = await request(app)
        .post('/api/v1/transactions/submit')
        .set('Authorization', `Bearer ${senderAuthToken}`)
        .send({
          senderId: senderUser.id,
          receiverId: receiverUser.id,
          amount: transactionAmount,
          type: 'offline',
          senderSignature: 'sender-p2p-signature',
          metadata: {
            connectionType: 'qr_code',
            p2pMethod: 'qr_scan'
          }
        });

      expect(p2pResponse.status).toBe(201);
      expect(p2pResponse.body.success).toBe(true);

      const transactionId = p2pResponse.body.data.transactionId;

      // Step 3: Receiver confirms transaction (simulated by signature)
      const confirmedTransaction = {
        ...mockP2PTransaction,
        status: 'completed',
        receiver_signature: 'receiver-p2p-signature'
      };

      mockTransactionDAO.findById.mockResolvedValue(confirmedTransaction as any);
      mockTransactionDAO.update.mockResolvedValue(confirmedTransaction as any);

      // Step 4: Both users check transaction status
      const senderStatusCheck = await request(app)
        .get(`/api/v1/transactions/${transactionId}/status`)
        .set('Authorization', `Bearer ${senderAuthToken}`);

      const receiverStatusCheck = await request(app)
        .get(`/api/v1/transactions/${transactionId}/status`)
        .set('Authorization', `Bearer ${receiverAuthToken}`);

      expect(senderStatusCheck.status).toBe(200);
      expect(senderStatusCheck.body.data.status).toBe('completed');
      expect(receiverStatusCheck.status).toBe(200);
      expect(receiverStatusCheck.body.data.status).toBe('completed');

      // Step 5: Both users sync their transaction history
      mockTransactionDAO.findByUserId
        .mockImplementation((userId) => {
          if (userId === senderUser.id || userId === receiverUser.id) {
            return Promise.resolve([confirmedTransaction] as any);
          }
          return Promise.resolve([]);
        });

      const senderSync = await request(app)
        .get('/api/v1/transactions/sync')
        .set('Authorization', `Bearer ${senderAuthToken}`)
        .query({ since: '0' });

      const receiverSync = await request(app)
        .get('/api/v1/transactions/sync')
        .set('Authorization', `Bearer ${receiverAuthToken}`)
        .query({ since: '0' });

      expect(senderSync.status).toBe(200);
      expect(senderSync.body.data.transactions).toHaveLength(1);
      expect(receiverSync.status).toBe(200);
      expect(receiverSync.body.data.transactions).toHaveLength(1);

      // Step 6: Verify transaction appears in both users' history
      mockTransactionDAO.getUserTransactionHistory.mockResolvedValue([confirmedTransaction] as any);
      mockTransactionDAO.getUserTransactionCount.mockResolvedValue(1);

      const senderHistory = await request(app)
        .get('/api/v1/wallet/history')
        .set('Authorization', `Bearer ${senderAuthToken}`);

      const receiverHistory = await request(app)
        .get('/api/v1/wallet/history')
        .set('Authorization', `Bearer ${receiverAuthToken}`);

      expect(senderHistory.status).toBe(200);
      expect(senderHistory.body.data.data[0].counterparty).toBe(receiverUser.id);
      expect(receiverHistory.status).toBe(200);
      expect(receiverHistory.body.data.data[0].counterparty).toBe(senderUser.id);
    });
  });
});