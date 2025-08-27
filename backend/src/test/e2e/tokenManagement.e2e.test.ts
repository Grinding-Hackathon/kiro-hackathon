import request from 'supertest';
import { app } from '../../index';
import { OfflineTokenDAO } from '../../database/dao/OfflineTokenDAO';
import { UserDAO } from '../../database/dao/UserDAO';
import { TransactionDAO } from '../../database/dao/TransactionDAO';
import { offlineTokenManager } from '../../services/offlineTokenManager';
import { blockchainService } from '../../services/blockchainService';
import jwt from 'jsonwebtoken';

// Mock dependencies
jest.mock('../../database/dao/OfflineTokenDAO');
jest.mock('../../database/dao/UserDAO');
jest.mock('../../database/dao/TransactionDAO');
jest.mock('../../services/offlineTokenManager');
jest.mock('../../services/blockchainService');

describe('Token Management E2E Tests', () => {
  let userAuthToken: string;
  let mockOfflineTokenDAO: jest.Mocked<OfflineTokenDAO>;
  let mockUserDAO: jest.Mocked<UserDAO>;
  let mockTransactionDAO: jest.Mocked<TransactionDAO>;
  let mockOfflineTokenManager: jest.Mocked<typeof offlineTokenManager>;
  let mockBlockchainService: jest.Mocked<typeof blockchainService>;

  const testUser = {
    id: 'token-user-123',
    wallet_address: '0x1234567890123456789012345678901234567890',
    public_key: 'user-public-key',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date()
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mocked instances
    mockOfflineTokenDAO = new OfflineTokenDAO() as jest.Mocked<OfflineTokenDAO>;
    mockUserDAO = new UserDAO() as jest.Mocked<UserDAO>;
    mockTransactionDAO = new TransactionDAO() as jest.Mocked<TransactionDAO>;
    mockOfflineTokenManager = offlineTokenManager as jest.Mocked<typeof offlineTokenManager>;
    mockBlockchainService = blockchainService as jest.Mocked<typeof blockchainService>;

    // Mock DAO instances
    (OfflineTokenDAO as jest.MockedClass<typeof OfflineTokenDAO>).mockImplementation(() => mockOfflineTokenDAO);
    (UserDAO as jest.MockedClass<typeof UserDAO>).mockImplementation(() => mockUserDAO);
    (TransactionDAO as jest.MockedClass<typeof TransactionDAO>).mockImplementation(() => mockTransactionDAO);

    // Create auth token
    userAuthToken = jwt.sign(
      { 
        userId: testUser.id,
        walletAddress: testUser.wallet_address,
        publicKey: testUser.public_key
      },
      process.env['JWT_SECRET'] || 'test-secret',
      { expiresIn: '1h' }
    );

    // Setup default mocks
    mockUserDAO.findById.mockResolvedValue(testUser as any);
    mockOfflineTokenManager.getPublicKey.mockReturnValue('otm-public-key');
    mockOfflineTokenManager.getWalletAddress.mockReturnValue('0x9876543210987654321098765432109876543210');
    mockBlockchainService.getTokenBalance.mockResolvedValue('1000.00');
  });

  describe('Complete Token Lifecycle', () => {
    it('should handle complete token lifecycle from purchase to redemption', async () => {
      const purchaseAmount = 500;
      const divisionAmount = 200;
      const redemptionAmount = 150;

      // Step 1: Purchase tokens
      const mockPurchasedTokens = [
        {
          id: 'purchased-token-1',
          userId: testUser.id,
          amount: 250,
          signature: 'purchase-signature-1',
          issuedAt: new Date(),
          expiresAt: new Date(Date.now() + 86400000),
          isSpent: false
        },
        {
          id: 'purchased-token-2',
          userId: testUser.id,
          amount: 250,
          signature: 'purchase-signature-2',
          issuedAt: new Date(),
          expiresAt: new Date(Date.now() + 86400000),
          isSpent: false
        }
      ];

      const mockTokenRecords = [
        {
          id: 'token-record-1',
          user_id: testUser.id,
          amount: '250.00',
          signature: 'purchase-signature-1',
          issued_at: new Date(),
          expires_at: new Date(Date.now() + 86400000),
          status: 'active',
          created_at: new Date()
        },
        {
          id: 'token-record-2',
          user_id: testUser.id,
          amount: '250.00',
          signature: 'purchase-signature-2',
          issued_at: new Date(),
          expires_at: new Date(Date.now() + 86400000),
          status: 'active',
          created_at: new Date()
        }
      ];

      const mockPurchaseTransaction = {
        id: 'purchase-tx-123',
        sender_id: testUser.id,
        amount: purchaseAmount.toString(),
        type: 'token_purchase',
        status: 'completed'
      };

      mockOfflineTokenManager.issueTokens.mockResolvedValue(mockPurchasedTokens as any);
      mockOfflineTokenDAO.create
        .mockResolvedValueOnce(mockTokenRecords[0] as any)
        .mockResolvedValueOnce(mockTokenRecords[1] as any);
      mockTransactionDAO.create.mockResolvedValue(mockPurchaseTransaction as any);

      const purchaseResponse = await request(app)
        .post('/api/v1/wallet/tokens/purchase')
        .set('Authorization', `Bearer ${userAuthToken}`)
        .send({ amount: purchaseAmount });

      expect(purchaseResponse.status).toBe(200);
      expect(purchaseResponse.body.success).toBe(true);
      expect(purchaseResponse.body.data.tokens).toHaveLength(2);
      expect(purchaseResponse.body.data.tokens[0].amount).toBe(250);
      expect(purchaseResponse.body.data.tokens[1].amount).toBe(250);

      const firstTokenId = purchaseResponse.body.data.tokens[0].id;

      // Step 2: Validate purchased token
      const mockValidationResult = {
        isValid: true,
        error: null
      };

      mockOfflineTokenDAO.findById.mockResolvedValue(mockTokenRecords[0] as any);
      mockOfflineTokenManager.validateToken.mockResolvedValue(mockValidationResult);

      const validationResponse = await request(app)
        .post('/api/v1/tokens/validate')
        .set('Authorization', `Bearer ${userAuthToken}`)
        .send({ tokenId: firstTokenId });

      expect(validationResponse.status).toBe(200);
      expect(validationResponse.body.success).toBe(true);
      expect(validationResponse.body.data.valid).toBe(true);
      expect(validationResponse.body.data.validationDetails).toMatchObject({
        signatureValid: true,
        notExpired: true,
        notSpent: true,
        ownershipValid: true
      });

      // Step 3: Divide token for payment
      const mockPaymentToken = {
        id: 'payment-token-id',
        userId: testUser.id,
        amount: divisionAmount,
        signature: 'payment-signature',
        issuedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
        isSpent: false
      };

      const mockChangeToken = {
        id: 'change-token-id',
        userId: testUser.id,
        amount: 250 - divisionAmount,
        signature: 'change-signature',
        issuedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
        isSpent: false
      };

      const mockPaymentTokenRecord = {
        id: 'payment-record-id',
        user_id: testUser.id,
        amount: divisionAmount.toString(),
        signature: 'payment-signature',
        issued_at: new Date(),
        expires_at: new Date(Date.now() + 86400000)
      };

      const mockChangeTokenRecord = {
        id: 'change-record-id',
        user_id: testUser.id,
        amount: (250 - divisionAmount).toString(),
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
        .set('Authorization', `Bearer ${userAuthToken}`)
        .send({ tokenId: firstTokenId, paymentAmount: divisionAmount });

      expect(divisionResponse.status).toBe(200);
      expect(divisionResponse.body.success).toBe(true);
      expect(divisionResponse.body.data.originalToken.status).toBe('spent');
      expect(divisionResponse.body.data.paymentToken.amount).toBe(divisionAmount);
      expect(divisionResponse.body.data.changeToken.amount).toBe(250 - divisionAmount);

      const paymentTokenId = divisionResponse.body.data.paymentToken.id;
      const changeTokenId = divisionResponse.body.data.changeToken.id;

      // Step 4: Validate divided tokens
      const mockPaymentTokenForValidation = {
        id: paymentTokenId,
        user_id: testUser.id,
        amount: divisionAmount.toString(),
        signature: 'payment-signature',
        issued_at: new Date(),
        expires_at: new Date(Date.now() + 86400000),
        status: 'active',
        created_at: new Date()
      };

      mockOfflineTokenDAO.findById.mockResolvedValue(mockPaymentTokenForValidation as any);

      const paymentTokenValidation = await request(app)
        .post('/api/v1/tokens/validate')
        .set('Authorization', `Bearer ${userAuthToken}`)
        .send({ tokenId: paymentTokenId });

      expect(paymentTokenValidation.status).toBe(200);
      expect(paymentTokenValidation.body.success).toBe(true);
      expect(paymentTokenValidation.body.data.valid).toBe(true);
      expect(paymentTokenValidation.body.data.token.amount).toBe(divisionAmount);

      // Step 5: Prepare tokens for redemption
      const tokensToRedeem = [
        { id: paymentTokenId, signature: 'payment-signature' },
        { id: changeTokenId, signature: 'change-signature' }
      ];

      const mockRedemptionResult = {
        amount: redemptionAmount,
        blockchainTxHash: '0xredemption456'
      };

      const mockRedemptionTransaction = {
        id: 'redemption-tx-456',
        receiver_id: testUser.id,
        amount: redemptionAmount.toString(),
        type: 'token_redemption',
        blockchain_tx_hash: '0xredemption456',
        status: 'completed'
      };

      mockOfflineTokenManager.redeemTokens.mockResolvedValue(mockRedemptionResult as any);
      mockOfflineTokenDAO.markAsRedeemed.mockResolvedValue(undefined);
      mockTransactionDAO.create.mockResolvedValue(mockRedemptionTransaction as any);
      mockBlockchainService.getTokenBalance.mockResolvedValue('1150.00'); // Updated balance

      const redemptionResponse = await request(app)
        .post('/api/v1/wallet/tokens/redeem')
        .set('Authorization', `Bearer ${userAuthToken}`)
        .send({ tokens: tokensToRedeem });

      expect(redemptionResponse.status).toBe(200);
      expect(redemptionResponse.body.success).toBe(true);
      expect(redemptionResponse.body.data.transactionHash).toBe('0xredemption456');
      expect(redemptionResponse.body.data.blockchainBalance).toBe(1150.00);

      // Step 6: Verify tokens were marked as redeemed
      expect(mockOfflineTokenDAO.markAsRedeemed).toHaveBeenCalledWith(paymentTokenId);
      expect(mockOfflineTokenDAO.markAsRedeemed).toHaveBeenCalledWith(changeTokenId);

      // Step 7: Verify final wallet balance
      mockOfflineTokenDAO.getUserTokenBalance.mockResolvedValue('250.00'); // Only second token remains
      mockOfflineTokenDAO.getUserTokenCount.mockResolvedValue(1);
      mockTransactionDAO.getUserPendingTransactions.mockResolvedValue([]);

      const finalBalanceResponse = await request(app)
        .get('/api/v1/wallet/balance')
        .set('Authorization', `Bearer ${userAuthToken}`);

      expect(finalBalanceResponse.status).toBe(200);
      expect(finalBalanceResponse.body.success).toBe(true);
      expect(finalBalanceResponse.body.data.balances.blockchain.amount).toBe(1150.00);
      expect(finalBalanceResponse.body.data.balances.offline.amount).toBe(250.00);
      expect(finalBalanceResponse.body.data.balances.offline.tokenCount).toBe(1);
      expect(finalBalanceResponse.body.data.totalBalance).toBe(1400.00);
    });
  });

  describe('Token Validation Scenarios', () => {
    it('should handle various token validation scenarios', async () => {
      // Test Case 1: Valid active token
      const validToken = {
        id: 'valid-token-123',
        user_id: testUser.id,
        amount: '100.00',
        signature: 'valid-signature',
        issued_at: new Date(),
        expires_at: new Date(Date.now() + 86400000), // 1 day from now
        status: 'active',
        created_at: new Date()
      };

      mockOfflineTokenDAO.findById.mockResolvedValue(validToken as any);
      mockOfflineTokenManager.validateToken.mockResolvedValue({ isValid: true, error: null });

      const validTokenResponse = await request(app)
        .post('/api/v1/tokens/validate')
        .set('Authorization', `Bearer ${userAuthToken}`)
        .send({ tokenId: 'valid-token-123' });

      expect(validTokenResponse.status).toBe(200);
      expect(validTokenResponse.body.data.valid).toBe(true);
      expect(validTokenResponse.body.data.validationDetails).toMatchObject({
        signatureValid: true,
        notExpired: true,
        notSpent: true,
        ownershipValid: true
      });

      // Test Case 2: Expired token
      const expiredToken = {
        id: 'expired-token-456',
        user_id: testUser.id,
        amount: '100.00',
        signature: 'expired-signature',
        issued_at: new Date(),
        expires_at: new Date(Date.now() - 86400000), // 1 day ago
        status: 'active',
        created_at: new Date()
      };

      mockOfflineTokenDAO.findById.mockResolvedValue(expiredToken as any);

      const expiredTokenResponse = await request(app)
        .post('/api/v1/tokens/validate')
        .set('Authorization', `Bearer ${userAuthToken}`)
        .send({ tokenId: 'expired-token-456' });

      expect(expiredTokenResponse.status).toBe(200);
      expect(expiredTokenResponse.body.data.valid).toBe(false);
      expect(expiredTokenResponse.body.data.validationDetails.notExpired).toBe(false);

      // Test Case 3: Spent token
      const spentToken = {
        id: 'spent-token-789',
        user_id: testUser.id,
        amount: '100.00',
        signature: 'spent-signature',
        issued_at: new Date(),
        expires_at: new Date(Date.now() + 86400000),
        status: 'spent',
        created_at: new Date()
      };

      mockOfflineTokenDAO.findById.mockResolvedValue(spentToken as any);

      const spentTokenResponse = await request(app)
        .post('/api/v1/tokens/validate')
        .set('Authorization', `Bearer ${userAuthToken}`)
        .send({ tokenId: 'spent-token-789' });

      expect(spentTokenResponse.status).toBe(200);
      expect(spentTokenResponse.body.data.valid).toBe(false);
      expect(spentTokenResponse.body.data.validationDetails.notSpent).toBe(false);

      // Test Case 4: Invalid signature
      const invalidSignatureToken = {
        id: 'invalid-sig-token-101',
        user_id: testUser.id,
        amount: '100.00',
        signature: 'invalid-signature',
        issued_at: new Date(),
        expires_at: new Date(Date.now() + 86400000),
        status: 'active',
        created_at: new Date()
      };

      mockOfflineTokenDAO.findById.mockResolvedValue(invalidSignatureToken as any);
      mockOfflineTokenManager.validateToken.mockResolvedValue({ 
        isValid: false, 
        error: 'Invalid signature' 
      });

      const invalidSigResponse = await request(app)
        .post('/api/v1/tokens/validate')
        .set('Authorization', `Bearer ${userAuthToken}`)
        .send({ tokenId: 'invalid-sig-token-101' });

      expect(invalidSigResponse.status).toBe(200);
      expect(invalidSigResponse.body.data.valid).toBe(false);
      expect(invalidSigResponse.body.data.validationDetails.signatureValid).toBe(false);

      // Test Case 5: Token owned by different user
      const otherUserToken = {
        id: 'other-user-token-202',
        user_id: 'other-user-456',
        amount: '100.00',
        signature: 'other-signature',
        issued_at: new Date(),
        expires_at: new Date(Date.now() + 86400000),
        status: 'active',
        created_at: new Date()
      };

      mockOfflineTokenDAO.findById.mockResolvedValue(otherUserToken as any);
      mockOfflineTokenManager.validateToken.mockResolvedValue({ isValid: true, error: null });

      const otherUserResponse = await request(app)
        .post('/api/v1/tokens/validate')
        .set('Authorization', `Bearer ${userAuthToken}`)
        .send({ tokenId: 'other-user-token-202' });

      expect(otherUserResponse.status).toBe(200);
      expect(otherUserResponse.body.data.valid).toBe(false);
      expect(otherUserResponse.body.data.validationDetails.ownershipValid).toBe(false);
    });
  });

  describe('Token Division Edge Cases', () => {
    it('should handle various token division scenarios', async () => {
      // Test Case 1: Division with no change (exact amount)
      const exactDivisionToken = {
        id: 'exact-token-123',
        user_id: testUser.id,
        amount: '100.00',
        signature: 'exact-signature',
        issued_at: new Date(),
        expires_at: new Date(Date.now() + 86400000),
        status: 'active',
        created_at: new Date(),
        metadata: {}
      };

      const mockPaymentToken = {
        id: 'exact-payment-token',
        userId: testUser.id,
        amount: 100,
        signature: 'exact-payment-signature',
        issuedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
        isSpent: false
      };

      const mockPaymentTokenRecord = {
        id: 'exact-payment-record',
        user_id: testUser.id,
        amount: '100.00',
        signature: 'exact-payment-signature',
        issued_at: new Date(),
        expires_at: new Date(Date.now() + 86400000)
      };

      mockOfflineTokenDAO.findById.mockResolvedValue(exactDivisionToken as any);
      mockOfflineTokenManager.issueTokens.mockResolvedValue([mockPaymentToken] as any);
      mockOfflineTokenDAO.create.mockResolvedValue(mockPaymentTokenRecord as any);
      mockOfflineTokenDAO.update.mockResolvedValue(undefined);

      const exactDivisionResponse = await request(app)
        .post('/api/v1/tokens/divide')
        .set('Authorization', `Bearer ${userAuthToken}`)
        .send({ tokenId: 'exact-token-123', paymentAmount: 100 });

      expect(exactDivisionResponse.status).toBe(200);
      expect(exactDivisionResponse.body.success).toBe(true);
      expect(exactDivisionResponse.body.data.paymentToken.amount).toBe(100);
      expect(exactDivisionResponse.body.data.changeToken).toBeUndefined();

      // Test Case 2: Division with minimal change (0.01)
      const minimalChangeToken = {
        id: 'minimal-token-456',
        user_id: testUser.id,
        amount: '100.01',
        signature: 'minimal-signature',
        issued_at: new Date(),
        expires_at: new Date(Date.now() + 86400000),
        status: 'active',
        created_at: new Date(),
        metadata: {}
      };

      const mockMinimalPaymentToken = {
        id: 'minimal-payment-token',
        userId: testUser.id,
        amount: 100,
        signature: 'minimal-payment-signature',
        issuedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
        isSpent: false
      };

      const mockMinimalChangeToken = {
        id: 'minimal-change-token',
        userId: testUser.id,
        amount: 0.01,
        signature: 'minimal-change-signature',
        issuedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
        isSpent: false
      };

      const mockMinimalPaymentRecord = {
        id: 'minimal-payment-record',
        user_id: testUser.id,
        amount: '100.00',
        signature: 'minimal-payment-signature',
        issued_at: new Date(),
        expires_at: new Date(Date.now() + 86400000)
      };

      const mockMinimalChangeRecord = {
        id: 'minimal-change-record',
        user_id: testUser.id,
        amount: '0.01',
        signature: 'minimal-change-signature',
        issued_at: new Date(),
        expires_at: new Date(Date.now() + 86400000)
      };

      mockOfflineTokenDAO.findById.mockResolvedValue(minimalChangeToken as any);
      mockOfflineTokenManager.issueTokens
        .mockResolvedValueOnce([mockMinimalPaymentToken] as any)
        .mockResolvedValueOnce([mockMinimalChangeToken] as any);
      mockOfflineTokenDAO.create
        .mockResolvedValueOnce(mockMinimalPaymentRecord as any)
        .mockResolvedValueOnce(mockMinimalChangeRecord as any);

      const minimalChangeResponse = await request(app)
        .post('/api/v1/tokens/divide')
        .set('Authorization', `Bearer ${userAuthToken}`)
        .send({ tokenId: 'minimal-token-456', paymentAmount: 100 });

      expect(minimalChangeResponse.status).toBe(200);
      expect(minimalChangeResponse.body.success).toBe(true);
      expect(minimalChangeResponse.body.data.paymentToken.amount).toBe(100);
      expect(minimalChangeResponse.body.data.changeToken.amount).toBe(0.01);

      // Test Case 3: Attempt to divide inactive token
      const inactiveToken = {
        id: 'inactive-token-789',
        user_id: testUser.id,
        amount: '100.00',
        signature: 'inactive-signature',
        issued_at: new Date(),
        expires_at: new Date(Date.now() + 86400000),
        status: 'spent',
        created_at: new Date()
      };

      mockOfflineTokenDAO.findById.mockResolvedValue(inactiveToken as any);

      const inactiveTokenResponse = await request(app)
        .post('/api/v1/tokens/divide')
        .set('Authorization', `Bearer ${userAuthToken}`)
        .send({ tokenId: 'inactive-token-789', paymentAmount: 50 });

      expect(inactiveTokenResponse.status).toBe(422);
      expect(inactiveTokenResponse.body.success).toBe(false);

      // Test Case 4: Attempt to divide with amount exceeding token value
      const smallToken = {
        id: 'small-token-101',
        user_id: testUser.id,
        amount: '50.00',
        signature: 'small-signature',
        issued_at: new Date(),
        expires_at: new Date(Date.now() + 86400000),
        status: 'active',
        created_at: new Date()
      };

      mockOfflineTokenDAO.findById.mockResolvedValue(smallToken as any);

      const excessiveAmountResponse = await request(app)
        .post('/api/v1/tokens/divide')
        .set('Authorization', `Bearer ${userAuthToken}`)
        .send({ tokenId: 'small-token-101', paymentAmount: 100 });

      expect(excessiveAmountResponse.status).toBe(422);
      expect(excessiveAmountResponse.body.success).toBe(false);
    });
  });

  describe('Public Key Database Management', () => {
    it('should handle public key database operations', async () => {
      // Test Case 1: Retrieve public key database with multiple users
      const mockUsers = [
        {
          id: 'user-1',
          public_key: 'public-key-1',
          wallet_address: '0x1111111111111111111111111111111111111111',
          updated_at: new Date()
        },
        {
          id: 'user-2',
          public_key: 'public-key-2',
          wallet_address: '0x2222222222222222222222222222222222222222',
          updated_at: new Date()
        },
        {
          id: testUser.id,
          public_key: testUser.public_key,
          wallet_address: testUser.wallet_address,
          updated_at: new Date()
        }
      ];

      mockUserDAO.findActiveUsers.mockResolvedValue(mockUsers as any);

      const publicKeysResponse = await request(app)
        .get('/api/v1/tokens/public-keys');

      expect(publicKeysResponse.status).toBe(200);
      expect(publicKeysResponse.body.success).toBe(true);
      expect(publicKeysResponse.body.data).toMatchObject({
        publicKeys: {
          'user-1': {
            publicKey: 'public-key-1',
            walletAddress: '0x1111111111111111111111111111111111111111',
            lastUpdated: expect.any(String)
          },
          'user-2': {
            publicKey: 'public-key-2',
            walletAddress: '0x2222222222222222222222222222222222222222',
            lastUpdated: expect.any(String)
          },
          [testUser.id]: {
            publicKey: testUser.public_key,
            walletAddress: testUser.wallet_address,
            lastUpdated: expect.any(String)
          }
        },
        otmPublicKey: 'otm-public-key',
        version: '1.0.0'
      });

      // Test Case 2: Handle empty user database
      mockUserDAO.findActiveUsers.mockResolvedValue([]);

      const emptyPublicKeysResponse = await request(app)
        .get('/api/v1/tokens/public-keys');

      expect(emptyPublicKeysResponse.status).toBe(200);
      expect(emptyPublicKeysResponse.body.success).toBe(true);
      expect(emptyPublicKeysResponse.body.data.publicKeys).toEqual({});
      expect(emptyPublicKeysResponse.body.data.otmPublicKey).toBe('otm-public-key');

      // Test Case 3: Verify public key database doesn't require authentication
      const unauthenticatedResponse = await request(app)
        .get('/api/v1/tokens/public-keys');

      expect(unauthenticatedResponse.status).toBe(200);
      expect(unauthenticatedResponse.body.success).toBe(true);
    });
  });

  describe('Token Error Handling and Recovery', () => {
    it('should handle token operation failures gracefully', async () => {
      // Test Case 1: Token purchase failure due to OTM service error
      mockOfflineTokenManager.issueTokens.mockRejectedValue(new Error('OTM service unavailable'));

      const purchaseFailureResponse = await request(app)
        .post('/api/v1/wallet/tokens/purchase')
        .set('Authorization', `Bearer ${userAuthToken}`)
        .send({ amount: 100 });

      expect(purchaseFailureResponse.status).toBe(500);
      expect(purchaseFailureResponse.body.success).toBe(false);

      // Test Case 2: Token validation failure due to database error
      mockOfflineTokenDAO.findById.mockRejectedValue(new Error('Database connection failed'));

      const validationFailureResponse = await request(app)
        .post('/api/v1/tokens/validate')
        .set('Authorization', `Bearer ${userAuthToken}`)
        .send({ tokenId: 'test-token-123' });

      expect(validationFailureResponse.status).toBe(500);
      expect(validationFailureResponse.body.success).toBe(false);

      // Test Case 3: Token division failure due to payment token creation error
      const divisionToken = {
        id: 'division-fail-token',
        user_id: testUser.id,
        amount: '100.00',
        signature: 'division-signature',
        issued_at: new Date(),
        expires_at: new Date(Date.now() + 86400000),
        status: 'active',
        created_at: new Date(),
        metadata: {}
      };

      mockOfflineTokenDAO.findById.mockResolvedValue(divisionToken as any);
      mockOfflineTokenManager.issueTokens.mockResolvedValue([]); // No tokens created

      const divisionFailureResponse = await request(app)
        .post('/api/v1/tokens/divide')
        .set('Authorization', `Bearer ${userAuthToken}`)
        .send({ tokenId: 'division-fail-token', paymentAmount: 50 });

      expect(divisionFailureResponse.status).toBe(500);
      expect(divisionFailureResponse.body.success).toBe(false);

      // Test Case 4: Token redemption failure due to blockchain service error
      mockOfflineTokenManager.redeemTokens.mockRejectedValue(new Error('Blockchain service unavailable'));

      const redemptionFailureResponse = await request(app)
        .post('/api/v1/wallet/tokens/redeem')
        .set('Authorization', `Bearer ${userAuthToken}`)
        .send({ 
          tokens: [
            { id: 'redeem-token-1', signature: 'redeem-signature-1' }
          ]
        });

      expect(redemptionFailureResponse.status).toBe(500);
      expect(redemptionFailureResponse.body.success).toBe(false);

      // Test Case 5: Recovery after service restoration
      // Reset mocks to working state
      mockOfflineTokenManager.issueTokens.mockResolvedValue([
        {
          id: 'recovery-token-1',
          userId: testUser.id,
          amount: 100,
          signature: 'recovery-signature',
          issuedAt: new Date(),
          expiresAt: new Date(Date.now() + 86400000),
          isSpent: false
        }
      ] as any);

      mockOfflineTokenDAO.create.mockResolvedValue({
        id: 'recovery-record-1',
        user_id: testUser.id,
        amount: '100.00',
        signature: 'recovery-signature',
        issued_at: new Date(),
        expires_at: new Date(Date.now() + 86400000)
      } as any);

      mockTransactionDAO.create.mockResolvedValue({
        id: 'recovery-tx-1',
        sender_id: testUser.id,
        amount: '100.00',
        type: 'token_purchase',
        status: 'completed'
      } as any);

      const recoveryResponse = await request(app)
        .post('/api/v1/wallet/tokens/purchase')
        .set('Authorization', `Bearer ${userAuthToken}`)
        .send({ amount: 100 });

      expect(recoveryResponse.status).toBe(200);
      expect(recoveryResponse.body.success).toBe(true);
      expect(recoveryResponse.body.data.tokens).toHaveLength(1);
    });
  });

  describe('Token Security and Validation', () => {
    it('should enforce security measures for token operations', async () => {
      // Test Case 1: Reject token operations without authentication
      const unauthenticatedEndpoints = [
        { method: 'post', path: '/api/v1/tokens/validate', body: { tokenId: 'test' } },
        { method: 'post', path: '/api/v1/tokens/divide', body: { tokenId: 'test', paymentAmount: 50 } },
        { method: 'post', path: '/api/v1/wallet/tokens/purchase', body: { amount: 100 } },
        { method: 'post', path: '/api/v1/wallet/tokens/redeem', body: { tokens: [] } }
      ];

      for (const endpoint of unauthenticatedEndpoints) {
        const response = await request(app)[endpoint.method as 'post'](endpoint.path)
          .send(endpoint.body);

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
      }

      // Test Case 2: Validate input sanitization
      const maliciousInputs = [
        { tokenId: '<script>alert("xss")</script>' },
        { tokenId: '"; DROP TABLE tokens; --' },
        { tokenId: '../../../etc/passwd' }
      ];

      const validToken = {
        id: 'safe-token-123',
        user_id: testUser.id,
        amount: '100.00',
        signature: 'safe-signature',
        issued_at: new Date(),
        expires_at: new Date(Date.now() + 86400000),
        status: 'active',
        created_at: new Date()
      };

      mockOfflineTokenDAO.findById.mockResolvedValue(null); // Token not found for malicious inputs

      for (const maliciousInput of maliciousInputs) {
        const response = await request(app)
          .post('/api/v1/tokens/validate')
          .set('Authorization', `Bearer ${userAuthToken}`)
          .send(maliciousInput);

        // Should handle gracefully without exposing system details
        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
      }

      // Test Case 3: Rate limiting on token operations
      mockOfflineTokenDAO.findById.mockResolvedValue(validToken as any);
      mockOfflineTokenManager.validateToken.mockResolvedValue({ isValid: true, error: null });

      const rapidRequests = Array(10).fill(null).map(() =>
        request(app)
          .post('/api/v1/tokens/validate')
          .set('Authorization', `Bearer ${userAuthToken}`)
          .send({ tokenId: 'safe-token-123' })
      );

      const responses = await Promise.all(rapidRequests);
      
      // At least some requests should succeed
      const successfulRequests = responses.filter(r => r.status === 200);
      expect(successfulRequests.length).toBeGreaterThan(0);
    });
  });
});