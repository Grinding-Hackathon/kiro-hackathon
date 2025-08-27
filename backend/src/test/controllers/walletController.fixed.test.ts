import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { 
  getBalance, 
  purchaseTokens, 
  redeemTokens, 
  getPublicKey,
  getWalletHistory 
} from '../../controllers/walletController';
import { OfflineTokenDAO } from '../../database/dao/OfflineTokenDAO';
import { TransactionDAO } from '../../database/dao/TransactionDAO';
import { blockchainService } from '../../services/blockchainService';
import { offlineTokenManager } from '../../services/offlineTokenManager';
import { ResponseBuilder } from '../../utils/responseBuilder';
import { CustomError } from '../../middleware/errorHandler';

// Mock dependencies
jest.mock('../../database/dao/OfflineTokenDAO');
jest.mock('../../database/dao/TransactionDAO');
jest.mock('../../services/blockchainService');
jest.mock('../../services/offlineTokenManager');
jest.mock('../../utils/responseBuilder');
jest.mock('../../middleware/errorHandler');
jest.mock('express-validator', () => ({
  validationResult: jest.fn().mockReturnValue({
    isEmpty: jest.fn().mockReturnValue(true),
    array: jest.fn().mockReturnValue([])
  }),
  body: jest.fn().mockReturnValue({
    isString: jest.fn().mockReturnThis(),
    notEmpty: jest.fn().mockReturnThis(),
    withMessage: jest.fn().mockReturnThis(),
    isNumeric: jest.fn().mockReturnThis(),
    isFloat: jest.fn().mockReturnThis(),
    isArray: jest.fn().mockReturnThis()
  }),
  param: jest.fn().mockReturnValue({
    isString: jest.fn().mockReturnThis(),
    notEmpty: jest.fn().mockReturnThis(),
    withMessage: jest.fn().mockReturnThis()
  })
}));

describe('WalletController - Fixed Unit Tests', () => {
  let mockOfflineTokenDAO: jest.Mocked<OfflineTokenDAO>;
  let mockTransactionDAO: jest.Mocked<TransactionDAO>;
  let mockBlockchainService: jest.Mocked<typeof blockchainService>;
  let mockOfflineTokenManager: jest.Mocked<typeof offlineTokenManager>;
  let mockResponseBuilder: jest.Mocked<typeof ResponseBuilder>;
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mocked instances
    mockOfflineTokenDAO = new OfflineTokenDAO() as jest.Mocked<OfflineTokenDAO>;
    mockTransactionDAO = new TransactionDAO() as jest.Mocked<TransactionDAO>;
    mockBlockchainService = blockchainService as jest.Mocked<typeof blockchainService>;
    mockOfflineTokenManager = offlineTokenManager as jest.Mocked<typeof offlineTokenManager>;
    mockResponseBuilder = ResponseBuilder as jest.Mocked<typeof ResponseBuilder>;

    // Mock DAO methods
    mockOfflineTokenDAO.getUserTokenBalance = jest.fn();
    mockOfflineTokenDAO.getUserTokenCount = jest.fn();
    mockOfflineTokenDAO.create = jest.fn();
    mockOfflineTokenDAO.markAsRedeemed = jest.fn();
    
    mockTransactionDAO.create = jest.fn();
    mockTransactionDAO.getUserTransactionHistory = jest.fn();
    mockTransactionDAO.getUserTransactionCount = jest.fn();
    mockTransactionDAO.getUserPendingTransactions = jest.fn();

    // Mock blockchain service
    mockBlockchainService.getTokenBalance = jest.fn();

    // Mock offline token manager
    mockOfflineTokenManager.issueTokens = jest.fn();
    mockOfflineTokenManager.redeemTokens = jest.fn();
    mockOfflineTokenManager.getPublicKey = jest.fn().mockReturnValue('mock_public_key');
    mockOfflineTokenManager.getWalletAddress = jest.fn().mockReturnValue('0x1234567890123456789012345678901234567890');

    // Mock ResponseBuilder
    mockResponseBuilder.success = jest.fn().mockReturnValue({
      success: true,
      data: {},
      message: 'Success',
      timestamp: new Date().toISOString(),
      requestId: 'test-request-id'
    });
    mockResponseBuilder.getRequestId = jest.fn().mockReturnValue('test-request-id');

    // Setup mock request and response
    mockRequest = {
      user: {
        id: 'user_123',
        walletAddress: '0x1234567890123456789012345678901234567890',
        publicKey: 'user_public_key'
      },
      body: {},
      params: {},
      query: {},
      headers: { 'x-request-id': 'test-request-id' }
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();

    // Mock the DAO instances in the module
    (OfflineTokenDAO as jest.MockedClass<typeof OfflineTokenDAO>).mockImplementation(() => mockOfflineTokenDAO);
    (TransactionDAO as jest.MockedClass<typeof TransactionDAO>).mockImplementation(() => mockTransactionDAO);
  });

  describe('getBalance', () => {
    it('should successfully get wallet balance', async () => {
      mockBlockchainService.getTokenBalance.mockResolvedValue('100.50');
      mockOfflineTokenDAO.getUserTokenBalance.mockResolvedValue('50.25');
      mockOfflineTokenDAO.getUserTokenCount.mockResolvedValue(5);
      mockTransactionDAO.getUserPendingTransactions.mockResolvedValue([]);

      await getBalance(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockBlockchainService.getTokenBalance).toHaveBeenCalledWith('0x1234567890123456789012345678901234567890');
      expect(mockOfflineTokenDAO.getUserTokenBalance).toHaveBeenCalledWith('user_123');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });

    it('should handle unauthenticated request', async () => {
      (mockRequest as any).user = undefined;

      await getBalance(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(CustomError));
    });
  });

  describe('purchaseTokens', () => {
    it('should successfully purchase tokens', async () => {
      const mockTokens = [
        {
          id: 'token_1',
          userId: 'user_123',
          amount: 50,
          signature: 'signature_1',
          issuedAt: new Date(),
          expiresAt: new Date(Date.now() + 86400000),
          isSpent: false
        }
      ];

      const mockTokenRecord = {
        id: 'record_1',
        user_id: 'user_123',
        amount: '50.00',
        signature: 'signature_1',
        issued_at: new Date(),
        expires_at: new Date(Date.now() + 86400000)
      };

      const mockTransaction = {
        id: 'tx_123',
        sender_id: 'user_123',
        amount: '100.00',
        type: 'token_purchase',
        status: 'completed'
      };

      mockRequest.body = { amount: 100 };
      mockOfflineTokenManager.issueTokens.mockResolvedValue(mockTokens as any);
      mockOfflineTokenDAO.create.mockResolvedValue(mockTokenRecord as any);
      mockTransactionDAO.create.mockResolvedValue(mockTransaction as any);

      await purchaseTokens(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockOfflineTokenManager.issueTokens).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });

    it('should handle unauthenticated request', async () => {
      (mockRequest as any).user = undefined;
      mockRequest.body = { amount: 100 };

      await purchaseTokens(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(CustomError));
    });
  });

  describe('redeemTokens', () => {
    it('should successfully redeem tokens', async () => {
      const mockTokensToRedeem = [
        { id: 'token_1', signature: 'signature_1' }
      ];

      const mockRedemptionResult = {
        amount: 100,
        blockchainTxHash: '0xabc123'
      };

      const mockTransaction = {
        id: 'tx_123',
        receiver_id: 'user_123',
        amount: '100.00',
        type: 'token_redemption',
        blockchain_tx_hash: '0xabc123'
      };

      mockRequest.body = { tokens: mockTokensToRedeem };
      mockOfflineTokenManager.redeemTokens.mockResolvedValue(mockRedemptionResult as any);
      mockOfflineTokenDAO.markAsRedeemed.mockResolvedValue(null as any);
      mockTransactionDAO.create.mockResolvedValue(mockTransaction as any);
      mockBlockchainService.getTokenBalance.mockResolvedValue('200.00');

      await redeemTokens(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockOfflineTokenManager.redeemTokens).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });

    it('should handle unauthenticated request', async () => {
      (mockRequest as any).user = undefined;
      mockRequest.body = { tokens: [{ id: 'token_1', signature: 'signature_1' }] };

      await redeemTokens(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(CustomError));
    });
  });

  describe('getPublicKey', () => {
    it('should successfully return public key', async () => {
      await getPublicKey(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockOfflineTokenManager.getPublicKey).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getWalletHistory', () => {
    it('should successfully get wallet history', async () => {
      const mockTransactions = [
        {
          id: 'tx_1',
          type: 'token_purchase',
          amount: '100.00',
          status: 'completed',
          created_at: new Date(),
          blockchain_tx_hash: '0xabc123',
          sender_id: 'user_123',
          receiver_id: null,
          metadata: { test: 'data' }
        }
      ];

      mockTransactionDAO.getUserTransactionHistory.mockResolvedValue(mockTransactions as any);
      mockTransactionDAO.getUserTransactionCount.mockResolvedValue(1);

      await getWalletHistory(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockTransactionDAO.getUserTransactionHistory).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });

    it('should handle unauthenticated request', async () => {
      (mockRequest as any).user = undefined;

      await getWalletHistory(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(CustomError));
    });
  });
});