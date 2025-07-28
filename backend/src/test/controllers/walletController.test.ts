import request from 'supertest';
import { app } from '../../index';
import { generateToken } from '../../middleware/auth';
import { OfflineTokenDAO } from '../../database/dao/OfflineTokenDAO';
import { TransactionDAO } from '../../database/dao/TransactionDAO';
import { blockchainService } from '../../services/blockchainService';
import { offlineTokenManager } from '../../services/offlineTokenManager';

// Mock dependencies
jest.mock('../../database/dao/OfflineTokenDAO');
jest.mock('../../database/dao/TransactionDAO');
jest.mock('../../services/blockchainService');
jest.mock('../../services/offlineTokenManager');

const mockOfflineTokenDAO = OfflineTokenDAO as jest.MockedClass<typeof OfflineTokenDAO>;
const mockTransactionDAO = TransactionDAO as jest.MockedClass<typeof TransactionDAO>;
const mockBlockchainService = blockchainService as jest.Mocked<typeof blockchainService>;
const mockOfflineTokenManager = offlineTokenManager as jest.Mocked<typeof offlineTokenManager>;

describe('Wallet Controller', () => {
  let offlineTokenDAOInstance: jest.Mocked<OfflineTokenDAO>;
  let transactionDAOInstance: jest.Mocked<TransactionDAO>;
  let authToken: string;

  const mockUser = {
    id: 'user-123',
    walletAddress: '0x742d35Cc6634C0532925a3b8D4C0C8b3C2e1e1e1',
    publicKey: '0x04' + 'b'.repeat(128),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    offlineTokenDAOInstance = new mockOfflineTokenDAO() as jest.Mocked<OfflineTokenDAO>;
    transactionDAOInstance = new mockTransactionDAO() as jest.Mocked<TransactionDAO>;
    
    (mockOfflineTokenDAO as any).mockImplementation(() => offlineTokenDAOInstance);
    (mockTransactionDAO as any).mockImplementation(() => transactionDAOInstance);

    // Generate auth token for tests
    authToken = generateToken(mockUser);
  });

  describe('GET /api/v1/wallet/balance', () => {
    it('should return user balance successfully', async () => {
      mockBlockchainService.getTokenBalance.mockResolvedValue('100.5');
      offlineTokenDAOInstance.getUserTokenBalance.mockResolvedValue('50.25');

      const response = await request(app)
        .get('/api/v1/wallet/balance')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.blockchainBalance).toBe('100.5');
      expect(response.body.data.offlineTokenBalance).toBe('50.25');
      expect(response.body.data.totalBalance).toBe('150.75');
    });

    it('should return error when not authenticated', async () => {
      const response = await request(app)
        .get('/api/v1/wallet/balance');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Authorization header is required');
    });
  });

  describe('POST /api/v1/wallet/tokens/purchase', () => {
    const purchaseData = {
      amount: 100,
    };

    it('should purchase tokens successfully', async () => {
      const mockToken = {
        id: 'token-123',
        userId: mockUser.id,
        amount: 100,
        signature: '0x' + 'c'.repeat(130),
        issuedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'active' as const,
      };

      mockOfflineTokenManager.issueTokens.mockResolvedValue([mockToken]);
      
      offlineTokenDAOInstance.create.mockResolvedValue({
        id: mockToken.id,
        user_id: mockToken.userId,
        amount: mockToken.amount.toString(),
        signature: mockToken.signature,
        issuer_public_key: '0x04' + 'd'.repeat(128),
        issued_at: mockToken.issuedAt,
        expires_at: mockToken.expiresAt,
        status: mockToken.status,
        created_at: new Date(),
        updated_at: new Date(),
      });

      transactionDAOInstance.create.mockResolvedValue({
        id: 'tx-123',
        sender_id: mockUser.id,
        amount: purchaseData.amount.toString(),
        type: 'token_purchase',
        status: 'completed',
        created_at: new Date(),
        updated_at: new Date(),
      });

      const response = await request(app)
        .post('/api/v1/wallet/tokens/purchase')
        .set('Authorization', `Bearer ${authToken}`)
        .send(purchaseData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.tokens).toHaveLength(1);
      expect(response.body.data.tokens[0].amount).toBe(100);
    });

    it('should return validation error for invalid amount', async () => {
      const response = await request(app)
        .post('/api/v1/wallet/tokens/purchase')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: -10 });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('POST /api/v1/wallet/tokens/redeem', () => {
    const redeemData = {
      tokens: [
        { id: 'token-123', signature: '0x' + 'c'.repeat(130) },
        { id: 'token-456', signature: '0x' + 'd'.repeat(130) },
      ],
    };

    it('should redeem tokens successfully', async () => {
      const mockTransaction = {
        id: 'tx-123',
        receiverId: mockUser.walletAddress,
        amount: 150,
        type: 'token_redemption' as const,
        status: 'completed' as const,
        blockchainTxHash: '0x' + 'e'.repeat(64),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockOfflineTokenManager.redeemTokens.mockResolvedValue(mockTransaction);
      offlineTokenDAOInstance.markAsRedeemed.mockResolvedValue(null);
      transactionDAOInstance.create.mockResolvedValue({
        id: 'tx-123',
        receiver_id: mockUser.id,
        amount: mockTransaction.amount.toString(),
        type: 'token_redemption',
        status: 'completed',
        blockchain_tx_hash: mockTransaction.blockchainTxHash,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const response = await request(app)
        .post('/api/v1/wallet/tokens/redeem')
        .set('Authorization', `Bearer ${authToken}`)
        .send(redeemData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.totalAmount).toBe(150);
      expect(response.body.data.redeemedTokens).toBe(2);
    });

    it('should return validation error for empty tokens array', async () => {
      const response = await request(app)
        .post('/api/v1/wallet/tokens/redeem')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ tokens: [] });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('GET /api/v1/wallet/keys/public', () => {
    it('should return OTM public key', async () => {
      mockOfflineTokenManager.getPublicKey.mockReturnValue('0x04' + 'f'.repeat(128));
      mockOfflineTokenManager.getWalletAddress.mockReturnValue('0x' + 'a'.repeat(40));

      const response = await request(app)
        .get('/api/v1/wallet/keys/public');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.publicKey).toBe('0x04' + 'f'.repeat(128));
      expect(response.body.data.walletAddress).toBe('0x' + 'a'.repeat(40));
    });
  });
});