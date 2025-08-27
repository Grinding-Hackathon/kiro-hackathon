import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { validateToken, divideToken, getPublicKeyDatabase } from '../../controllers/tokenController';
import { OfflineTokenDAO } from '../../database/dao/OfflineTokenDAO';
import { UserDAO } from '../../database/dao/UserDAO';
import { offlineTokenManager } from '../../services/offlineTokenManager';
import { ResponseBuilder } from '../../utils/responseBuilder';
import { CustomError } from '../../middleware/errorHandler';

// Mock dependencies
jest.mock('../../database/dao/OfflineTokenDAO');
jest.mock('../../database/dao/UserDAO');
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
  })
}));

describe('TokenController - Fixed Unit Tests', () => {
  let mockOfflineTokenDAO: jest.Mocked<OfflineTokenDAO>;
  let mockUserDAO: jest.Mocked<UserDAO>;
  let mockOfflineTokenManager: jest.Mocked<typeof offlineTokenManager>;
  let mockResponseBuilder: jest.Mocked<typeof ResponseBuilder>;
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mocked instances
    mockOfflineTokenDAO = new OfflineTokenDAO() as jest.Mocked<OfflineTokenDAO>;
    mockUserDAO = new UserDAO() as jest.Mocked<UserDAO>;
    mockOfflineTokenManager = offlineTokenManager as jest.Mocked<typeof offlineTokenManager>;
    mockResponseBuilder = ResponseBuilder as jest.Mocked<typeof ResponseBuilder>;

    // Mock DAO methods
    mockOfflineTokenDAO.findById = jest.fn();
    mockOfflineTokenDAO.create = jest.fn();
    mockOfflineTokenDAO.update = jest.fn();
    mockUserDAO.findActiveUsers = jest.fn();

    // Mock offline token manager
    mockOfflineTokenManager.validateToken = jest.fn();
    mockOfflineTokenManager.issueTokens = jest.fn();
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
    (UserDAO as jest.MockedClass<typeof UserDAO>).mockImplementation(() => mockUserDAO);
  });

  describe('validateToken', () => {
    it('should successfully validate a valid token', async () => {
      const mockTokenRecord = {
        id: 'token_123',
        user_id: 'user_123',
        amount: '50.00',
        signature: 'valid_signature',
        issued_at: new Date(),
        expires_at: new Date(Date.now() + 86400000), // 1 day from now
        status: 'active',
        created_at: new Date()
      };

      const mockValidationResult = {
        isValid: true,
        error: ''
      };

      mockRequest.body = { tokenId: 'token_123' };
      mockOfflineTokenDAO.findById.mockResolvedValue(mockTokenRecord as any);
      mockOfflineTokenManager.validateToken.mockResolvedValue(mockValidationResult as any);

      await validateToken(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockOfflineTokenDAO.findById).toHaveBeenCalledWith('token_123');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });

    it('should handle non-existent token', async () => {
      mockRequest.body = { tokenId: 'token_nonexistent' };
      mockOfflineTokenDAO.findById.mockResolvedValue(null);

      await validateToken(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(CustomError));
    });

    it('should handle unauthenticated request', async () => {
      (mockRequest as any).user = undefined;

      await validateToken(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(CustomError));
    });
  });

  describe('divideToken', () => {
    it('should successfully divide a token with change', async () => {
      const mockOriginalToken = {
        id: 'token_123',
        user_id: 'user_123',
        amount: '100.00',
        signature: 'original_signature',
        issued_at: new Date(),
        expires_at: new Date(Date.now() + 86400000),
        status: 'active',
        created_at: new Date(),
        metadata: {}
      };

      const mockPaymentToken = {
        id: 'payment_token_id',
        userId: 'user_123',
        amount: 60,
        signature: 'payment_signature',
        issuedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
        isSpent: false
      };

      const mockPaymentTokenRecord = {
        id: 'payment_token_record_id',
        user_id: 'user_123',
        amount: '60.00',
        signature: 'payment_signature',
        issued_at: new Date(),
        expires_at: new Date(Date.now() + 86400000)
      };

      mockRequest.body = { tokenId: 'token_123', paymentAmount: 60 };
      mockOfflineTokenDAO.findById.mockResolvedValue(mockOriginalToken as any);
      mockOfflineTokenManager.issueTokens.mockResolvedValue([mockPaymentToken] as any);
      mockOfflineTokenDAO.create.mockResolvedValue(mockPaymentTokenRecord as any);
      mockOfflineTokenDAO.update.mockResolvedValue(null as any);

      await divideToken(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockOfflineTokenDAO.findById).toHaveBeenCalledWith('token_123');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });

    it('should reject division of non-existent token', async () => {
      mockRequest.body = { tokenId: 'token_nonexistent', paymentAmount: 50 };
      mockOfflineTokenDAO.findById.mockResolvedValue(null);

      await divideToken(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(CustomError));
    });
  });

  describe('getPublicKeyDatabase', () => {
    it('should successfully return public key database', async () => {
      const mockUserRecords = [
        {
          id: 'user_1',
          public_key: 'public_key_1',
          wallet_address: '0x1111111111111111111111111111111111111111',
          updated_at: new Date()
        }
      ];

      mockUserDAO.findActiveUsers.mockResolvedValue(mockUserRecords as any);

      await getPublicKeyDatabase(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockUserDAO.findActiveUsers).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });

    it('should handle empty user database', async () => {
      mockUserDAO.findActiveUsers.mockResolvedValue([]);

      await getPublicKeyDatabase(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });
  });
});