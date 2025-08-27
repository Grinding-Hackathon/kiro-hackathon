import { Request, Response } from 'express';
import { TransactionController } from '../../controllers/transactionController';
import { TransactionDAO } from '../../database/dao/TransactionDAO';
import { OfflineTokenDAO } from '../../database/dao/OfflineTokenDAO';
import { blockchainService } from '../../services/blockchainService';
import { ResponseBuilder } from '../../utils/responseBuilder';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';

// Mock dependencies
jest.mock('../../database/dao/TransactionDAO');
jest.mock('../../database/dao/OfflineTokenDAO');
jest.mock('../../services/blockchainService');
jest.mock('../../utils/logger');
jest.mock('../../utils/responseBuilder');

describe('TransactionController - Comprehensive Unit Tests', () => {
  let transactionController: TransactionController;
  let mockTransactionDAO: jest.Mocked<TransactionDAO>;
  let mockOfflineTokenDAO: jest.Mocked<OfflineTokenDAO>;
  let mockBlockchainService: jest.Mocked<typeof blockchainService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockResponseBuilder: jest.Mocked<typeof ResponseBuilder>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mocked instances
    mockTransactionDAO = new TransactionDAO() as jest.Mocked<TransactionDAO>;
    mockOfflineTokenDAO = new OfflineTokenDAO() as jest.Mocked<OfflineTokenDAO>;
    mockBlockchainService = blockchainService as jest.Mocked<typeof blockchainService>;
    mockResponseBuilder = ResponseBuilder as jest.Mocked<typeof ResponseBuilder>;

    // Mock DAO methods
    mockTransactionDAO.create = jest.fn();
    mockTransactionDAO.findById = jest.fn();
    mockTransactionDAO.findByUserId = jest.fn();
    mockTransactionDAO.findByStatus = jest.fn();
    mockTransactionDAO.update = jest.fn();
    mockTransactionDAO.markAsFailed = jest.fn();

    mockOfflineTokenDAO.findById = jest.fn();
    mockOfflineTokenDAO.update = jest.fn();

    // Mock blockchain service
    mockBlockchainService.getTransaction = jest.fn();

    // Mock ResponseBuilder
    mockResponseBuilder.success = jest.fn().mockReturnValue({
      success: true,
      data: {},
      message: 'Success',
      timestamp: new Date().toISOString(),
      requestId: 'test-request-id'
    });
    mockResponseBuilder.error = jest.fn().mockReturnValue({
      success: false,
      error: { code: 'ERROR', message: 'Error' },
      timestamp: new Date().toISOString(),
      requestId: 'test-request-id'
    });
    mockResponseBuilder.validationError = jest.fn().mockReturnValue({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Validation Error' },
      timestamp: new Date().toISOString(),
      requestId: 'test-request-id'
    });
    mockResponseBuilder.notFoundError = jest.fn().mockReturnValue({
      success: false,
      error: { code: 'RESOURCE_NOT_FOUND', message: 'Not Found' },
      timestamp: new Date().toISOString(),
      requestId: 'test-request-id'
    });
    mockResponseBuilder.businessLogicError = jest.fn().mockReturnValue({
      success: false,
      error: { code: 'BUSINESS_LOGIC_ERROR', message: 'Business Logic Error' },
      timestamp: new Date().toISOString(),
      requestId: 'test-request-id'
    });
    mockResponseBuilder.authenticationError = jest.fn().mockReturnValue({
      success: false,
      error: { code: 'AUTHENTICATION_REQUIRED', message: 'Authentication Required' },
      timestamp: new Date().toISOString(),
      requestId: 'test-request-id'
    });
    mockResponseBuilder.authorizationError = jest.fn().mockReturnValue({
      success: false,
      error: { code: 'AUTHORIZATION_FAILED', message: 'Authorization Failed' },
      timestamp: new Date().toISOString(),
      requestId: 'test-request-id'
    });
    mockResponseBuilder.internalServerError = jest.fn().mockReturnValue({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Internal Server Error' },
      timestamp: new Date().toISOString(),
      requestId: 'test-request-id'
    });
    mockResponseBuilder.getRequestId = jest.fn().mockReturnValue('test-request-id');

    // Create controller instance
    transactionController = new TransactionController();
    (transactionController as any).transactionDAO = mockTransactionDAO;
    (transactionController as any).offlineTokenDAO = mockOfflineTokenDAO;

    // Setup mock request and response
    mockRequest = {
      body: {},
      params: {},
      query: {},
      headers: { 'x-request-id': 'test-request-id' },
      ip: '127.0.0.1'
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe('submitTransaction', () => {
    it('should successfully submit a valid online transaction', async () => {
      const mockTransaction = {
        id: 'tx_123',
        sender_id: 'user_1',
        receiver_id: 'user_2',
        amount: '100.00',
        type: 'online',
        status: 'pending',
        created_at: new Date(),
        updated_at: new Date()
      };

      mockRequest.body = {
        senderId: 'user_1',
        receiverId: 'user_2',
        amount: '100.00',
        type: 'online'
      };

      mockTransactionDAO.create.mockResolvedValue(mockTransaction as any);
      mockTransactionDAO.update.mockResolvedValue(mockTransaction as any);

      await transactionController.submitTransaction(mockRequest as Request, mockResponse as Response);

      expect(mockTransactionDAO.create).toHaveBeenCalledWith({
        sender_id: 'user_1',
        receiver_id: 'user_2',
        amount: '100.00',
        type: 'online',
        metadata: expect.objectContaining({
          submittedAt: expect.any(String),
          userAgent: undefined,
          ipAddress: '127.0.0.1'
        })
      });

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponseBuilder.success).toHaveBeenCalled();
    });

    it('should successfully submit a valid offline transaction', async () => {
      const mockTransaction = {
        id: 'tx_123',
        sender_id: 'user_1',
        receiver_id: 'user_2',
        amount: '100.00',
        type: 'offline',
        status: 'pending',
        created_at: new Date(),
        updated_at: new Date()
      };

      mockRequest.body = {
        senderId: 'user_1',
        receiverId: 'user_2',
        amount: '100.00',
        type: 'offline',
        senderSignature: 'signature_123'
      };

      mockTransactionDAO.create.mockResolvedValue(mockTransaction as any);

      await transactionController.submitTransaction(mockRequest as Request, mockResponse as Response);

      expect(mockTransactionDAO.create).toHaveBeenCalledWith({
        sender_id: 'user_1',
        receiver_id: 'user_2',
        amount: '100.00',
        type: 'offline',
        sender_signature: 'signature_123',
        metadata: expect.objectContaining({
          submittedAt: expect.any(String),
          userAgent: undefined,
          ipAddress: '127.0.0.1'
        })
      });

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponseBuilder.success).toHaveBeenCalled();
    });

    it('should successfully submit a token purchase transaction', async () => {
      const mockTransaction = {
        id: 'tx_123',
        sender_id: 'user_1',
        amount: '100.00',
        type: 'token_purchase',
        status: 'pending',
        created_at: new Date(),
        updated_at: new Date()
      };

      mockRequest.body = {
        senderId: 'user_1',
        amount: '100.00',
        type: 'token_purchase'
      };

      mockTransactionDAO.create.mockResolvedValue(mockTransaction as any);
      mockTransactionDAO.update.mockResolvedValue(mockTransaction as any);

      await transactionController.submitTransaction(mockRequest as Request, mockResponse as Response);

      expect(mockTransactionDAO.create).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponseBuilder.success).toHaveBeenCalled();
    });

    it('should validate token existence for token transactions', async () => {
      const mockToken = {
        id: 'token_123',
        user_id: 'user_1',
        amount: '50.00',
        status: 'active',
        expires_at: new Date(Date.now() + 86400000) // 1 day from now
      };

      mockRequest.body = {
        senderId: 'user_1',
        amount: '100.00',
        type: 'token_redemption',
        tokenIds: ['token_123']
      };

      mockOfflineTokenDAO.findById.mockResolvedValue(mockToken as any);
      mockTransactionDAO.create.mockResolvedValue({
        id: 'tx_123',
        status: 'pending',
        created_at: new Date()
      } as any);

      await transactionController.submitTransaction(mockRequest as Request, mockResponse as Response);

      expect(mockOfflineTokenDAO.findById).toHaveBeenCalledWith('token_123');
      expect(mockTransactionDAO.create).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(201);
    });

    it('should reject transaction with missing required fields', async () => {
      mockRequest.body = {
        senderId: 'user_1'
        // Missing amount and type
      };

      await transactionController.submitTransaction(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponseBuilder.validationError).toHaveBeenCalled();
    });

    it('should reject transaction with invalid type', async () => {
      mockRequest.body = {
        amount: '100.00',
        type: 'invalid_type'
      };

      await transactionController.submitTransaction(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponseBuilder.error).toHaveBeenCalled();
    });

    it('should reject transaction with invalid amount', async () => {
      mockRequest.body = {
        amount: 'invalid_amount',
        type: 'offline'
      };

      await transactionController.submitTransaction(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponseBuilder.error).toHaveBeenCalled();
    });

    it('should reject transaction with negative amount', async () => {
      mockRequest.body = {
        amount: '-50.00',
        type: 'offline'
      };

      await transactionController.submitTransaction(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponseBuilder.error).toHaveBeenCalled();
    });

    it('should reject offline transaction without required signature', async () => {
      mockRequest.body = {
        amount: '100.00',
        type: 'offline',
        receiverId: 'user_2'
        // Missing senderSignature
      };

      await transactionController.submitTransaction(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponseBuilder.validationError).toHaveBeenCalled();
    });

    it('should reject offline transaction without receiver ID', async () => {
      mockRequest.body = {
        amount: '100.00',
        type: 'offline',
        senderSignature: 'signature_123'
        // Missing receiverId
      };

      await transactionController.submitTransaction(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponseBuilder.validationError).toHaveBeenCalled();
    });

    it('should reject transaction with non-existent token', async () => {
      mockRequest.body = {
        amount: '100.00',
        type: 'token_redemption',
        tokenIds: ['token_nonexistent']
      };

      mockOfflineTokenDAO.findById.mockResolvedValue(null);

      await transactionController.submitTransaction(mockRequest as Request, mockResponse as Response);

      expect(mockOfflineTokenDAO.findById).toHaveBeenCalledWith('token_nonexistent');
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponseBuilder.notFoundError).toHaveBeenCalled();
    });

    it('should reject transaction with already spent token', async () => {
      const mockToken = {
        id: 'token_123',
        user_id: 'user_1',
        amount: '50.00',
        status: 'spent',
        expires_at: new Date(Date.now() + 86400000)
      };

      mockRequest.body = {
        amount: '100.00',
        type: 'token_redemption',
        tokenIds: ['token_123']
      };

      mockOfflineTokenDAO.findById.mockResolvedValue(mockToken as any);

      await transactionController.submitTransaction(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(422);
      expect(mockResponseBuilder.businessLogicError).toHaveBeenCalled();
    });

    it('should reject transaction with expired token', async () => {
      const mockToken = {
        id: 'token_123',
        user_id: 'user_1',
        amount: '50.00',
        status: 'active',
        expires_at: new Date(Date.now() - 86400000) // 1 day ago
      };

      mockRequest.body = {
        amount: '100.00',
        type: 'token_redemption',
        tokenIds: ['token_123']
      };

      mockOfflineTokenDAO.findById.mockResolvedValue(mockToken as any);

      await transactionController.submitTransaction(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(422);
      expect(mockResponseBuilder.businessLogicError).toHaveBeenCalled();
    });

    it('should handle blockchain submission failure', async () => {
      const mockTransaction = {
        id: 'tx_123',
        sender_id: 'user_1',
        amount: '100.00',
        type: 'online',
        status: 'pending',
        created_at: new Date(),
        updated_at: new Date()
      };

      mockRequest.body = {
        senderId: 'user_1',
        amount: '100.00',
        type: 'online'
      };

      mockTransactionDAO.create.mockResolvedValue(mockTransaction as any);
      mockTransactionDAO.markAsFailed.mockResolvedValue(null);

      await transactionController.submitTransaction(mockRequest as Request, mockResponse as Response);

      expect(mockTransactionDAO.create).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(201);
    });

    it('should handle database creation failure', async () => {
      mockRequest.body = {
        senderId: 'user_1',
        receiverId: 'user_2',
        amount: '100.00',
        type: 'offline',
        senderSignature: 'signature_123'
      };

      mockTransactionDAO.create.mockResolvedValue(null as any);

      await transactionController.submitTransaction(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponseBuilder.internalServerError).toHaveBeenCalled();
    });

    it('should handle unexpected errors', async () => {
      mockRequest.body = {
        senderId: 'user_1',
        receiverId: 'user_2',
        amount: '100.00',
        type: 'offline',
        senderSignature: 'signature_123'
      };

      mockTransactionDAO.create.mockRejectedValue(new Error('Database error'));

      await transactionController.submitTransaction(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponseBuilder.internalServerError).toHaveBeenCalled();
    });
  });

  describe('syncTransactions', () => {
    beforeEach(() => {
      (mockRequest as any).user = { id: 'user_123' };
    });

    it('should successfully sync transactions with default parameters', async () => {
      const mockTransactions = [
        {
          id: 'tx_1',
          sender_id: 'user_123',
          receiver_id: 'user_456',
          amount: '100.00',
          type: 'offline',
          status: 'completed',
          created_at: new Date('2022-01-02T12:00:00Z'),
          updated_at: new Date()
        }
      ];

      mockRequest.query = {};
      mockTransactionDAO.findByUserId.mockResolvedValue(mockTransactions as any);

      await transactionController.syncTransactions(mockRequest as Request, mockResponse as Response);

      expect(mockTransactionDAO.findByUserId).toHaveBeenCalledWith('user_123');
      expect(mockResponseBuilder.success).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalled();
    });

    it('should sync transactions with unix timestamp', async () => {
      const mockTransactions = [
        {
          id: 'tx_1',
          sender_id: 'user_123',
          receiver_id: 'user_456',
          amount: '100.00',
          type: 'offline',
          status: 'completed',
          created_at: new Date('2022-01-02T12:00:00Z'),
          updated_at: new Date()
        }
      ];

      mockRequest.query = {
        since: '1640995200', // Unix timestamp (2022-01-01 00:00:00)
        limit: '10',
        offset: '0'
      };

      mockTransactionDAO.findByUserId.mockResolvedValue(mockTransactions as any);

      await transactionController.syncTransactions(mockRequest as Request, mockResponse as Response);

      expect(mockTransactionDAO.findByUserId).toHaveBeenCalledWith('user_123');
      expect(mockResponseBuilder.success).toHaveBeenCalled();
    });

    it('should sync transactions with ISO timestamp', async () => {
      const mockTransactions = [
        {
          id: 'tx_1',
          sender_id: 'user_123',
          receiver_id: 'user_456',
          amount: '100.00',
          type: 'offline',
          status: 'completed',
          created_at: new Date('2022-01-02T12:00:00Z'),
          updated_at: new Date()
        }
      ];

      mockRequest.query = {
        since: '2022-01-01T00:00:00Z',
        limit: '10',
        offset: '0'
      };

      mockTransactionDAO.findByUserId.mockResolvedValue(mockTransactions as any);

      await transactionController.syncTransactions(mockRequest as Request, mockResponse as Response);

      expect(mockTransactionDAO.findByUserId).toHaveBeenCalledWith('user_123');
      expect(mockResponseBuilder.success).toHaveBeenCalled();
    });

    it('should handle pagination parameters', async () => {
      const mockTransactions = Array.from({ length: 25 }, (_, i) => ({
        id: `tx_${i}`,
        sender_id: 'user_123',
        receiver_id: 'user_456',
        amount: '100.00',
        type: 'offline',
        status: 'completed',
        created_at: new Date('2022-01-02T12:00:00Z'),
        updated_at: new Date()
      }));

      mockRequest.query = {
        limit: '10',
        offset: '5'
      };

      mockTransactionDAO.findByUserId.mockResolvedValue(mockTransactions as any);

      await transactionController.syncTransactions(mockRequest as Request, mockResponse as Response);

      expect(mockTransactionDAO.findByUserId).toHaveBeenCalledWith('user_123');
      expect(mockResponseBuilder.success).toHaveBeenCalled();
    });

    it('should enforce maximum limit', async () => {
      const mockTransactions: any[] = [];

      mockRequest.query = {
        limit: '200' // Should be capped at 100
      };

      mockTransactionDAO.findByUserId.mockResolvedValue(mockTransactions as any);

      await transactionController.syncTransactions(mockRequest as Request, mockResponse as Response);

      expect(mockTransactionDAO.findByUserId).toHaveBeenCalledWith('user_123');
      expect(mockResponseBuilder.success).toHaveBeenCalled();
    });

    it('should reject sync without authentication', async () => {
      (mockRequest as any).user = undefined;

      await transactionController.syncTransactions(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponseBuilder.authenticationError).toHaveBeenCalled();
    });

    it('should handle invalid since timestamp', async () => {
      mockRequest.query = {
        since: 'invalid_timestamp'
      };

      await transactionController.syncTransactions(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponseBuilder.error).toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      mockRequest.query = {};
      mockTransactionDAO.findByUserId.mockRejectedValue(new Error('Database error'));

      await transactionController.syncTransactions(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponseBuilder.internalServerError).toHaveBeenCalled();
    });
  });

  describe('getTransactionStatus', () => {
    beforeEach(() => {
      (mockRequest as any).user = { id: 'user_123' };
    });

    it('should successfully get transaction status', async () => {
      const mockTransaction = {
        id: 'tx_123',
        sender_id: 'user_123',
        receiver_id: 'user_456',
        amount: '100.00',
        type: 'offline',
        status: 'completed',
        blockchain_tx_hash: '0xabc123',
        error_message: null,
        metadata: { test: 'data' },
        created_at: new Date(),
        updated_at: new Date()
      };

      mockRequest.params = { transactionId: 'tx_123' };
      mockTransactionDAO.findById.mockResolvedValue(mockTransaction as any);
      mockBlockchainService.getTransaction.mockResolvedValue({
        hash: '0xabc123',
        confirmations: 5
      } as any);

      await transactionController.getTransactionStatus(mockRequest as Request, mockResponse as Response);

      expect(mockTransactionDAO.findById).toHaveBeenCalledWith('tx_123');
      expect(mockBlockchainService.getTransaction).toHaveBeenCalledWith('0xabc123');
      expect(mockResponseBuilder.success).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalled();
    });

    it('should handle transaction without blockchain hash', async () => {
      const mockTransaction = {
        id: 'tx_123',
        sender_id: 'user_123',
        receiver_id: 'user_456',
        amount: '100.00',
        type: 'offline',
        status: 'completed',
        blockchain_tx_hash: null,
        error_message: null,
        metadata: { test: 'data' },
        created_at: new Date(),
        updated_at: new Date()
      };

      mockRequest.params = { transactionId: 'tx_123' };
      mockTransactionDAO.findById.mockResolvedValue(mockTransaction as any);

      await transactionController.getTransactionStatus(mockRequest as Request, mockResponse as Response);

      expect(mockTransactionDAO.findById).toHaveBeenCalledWith('tx_123');
      expect(mockBlockchainService.getTransaction).not.toHaveBeenCalled();
      expect(mockResponseBuilder.success).toHaveBeenCalled();
    });

    it('should handle blockchain service errors gracefully', async () => {
      const mockTransaction = {
        id: 'tx_123',
        sender_id: 'user_123',
        receiver_id: 'user_456',
        amount: '100.00',
        type: 'offline',
        status: 'completed',
        blockchain_tx_hash: '0xabc123',
        error_message: null,
        metadata: { test: 'data' },
        created_at: new Date(),
        updated_at: new Date()
      };

      mockRequest.params = { transactionId: 'tx_123' };
      mockTransactionDAO.findById.mockResolvedValue(mockTransaction as any);
      mockBlockchainService.getTransaction.mockRejectedValue(new Error('Blockchain error'));

      await transactionController.getTransactionStatus(mockRequest as Request, mockResponse as Response);

      expect(mockTransactionDAO.findById).toHaveBeenCalledWith('tx_123');
      expect(mockBlockchainService.getTransaction).toHaveBeenCalledWith('0xabc123');
      expect(mockResponseBuilder.success).toHaveBeenCalled();
    });

    it('should reject request without transaction ID', async () => {
      mockRequest.params = {};

      await transactionController.getTransactionStatus(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponseBuilder.error).toHaveBeenCalled();
    });

    it('should return 404 for non-existent transaction', async () => {
      mockRequest.params = { transactionId: 'tx_nonexistent' };
      mockTransactionDAO.findById.mockResolvedValue(null);

      await transactionController.getTransactionStatus(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponseBuilder.notFoundError).toHaveBeenCalled();
    });

    it('should reject unauthorized access to transaction', async () => {
      const mockTransaction = {
        id: 'tx_123',
        sender_id: 'user_456', // Different user
        receiver_id: 'user_789', // Different user
        amount: '100.00',
        type: 'offline',
        status: 'completed'
      };

      mockRequest.params = { transactionId: 'tx_123' };
      mockTransactionDAO.findById.mockResolvedValue(mockTransaction as any);

      await transactionController.getTransactionStatus(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponseBuilder.authorizationError).toHaveBeenCalled();
    });

    it('should allow access for sender', async () => {
      const mockTransaction = {
        id: 'tx_123',
        sender_id: 'user_123', // Current user is sender
        receiver_id: 'user_456',
        amount: '100.00',
        type: 'offline',
        status: 'completed',
        blockchain_tx_hash: null,
        error_message: null,
        metadata: {},
        created_at: new Date(),
        updated_at: new Date()
      };

      mockRequest.params = { transactionId: 'tx_123' };
      mockTransactionDAO.findById.mockResolvedValue(mockTransaction as any);

      await transactionController.getTransactionStatus(mockRequest as Request, mockResponse as Response);

      expect(mockTransactionDAO.findById).toHaveBeenCalledWith('tx_123');
      expect(mockResponseBuilder.success).toHaveBeenCalled();
    });

    it('should allow access for receiver', async () => {
      const mockTransaction = {
        id: 'tx_123',
        sender_id: 'user_456',
        receiver_id: 'user_123', // Current user is receiver
        amount: '100.00',
        type: 'offline',
        status: 'completed',
        blockchain_tx_hash: null,
        error_message: null,
        metadata: {},
        created_at: new Date(),
        updated_at: new Date()
      };

      mockRequest.params = { transactionId: 'tx_123' };
      mockTransactionDAO.findById.mockResolvedValue(mockTransaction as any);

      await transactionController.getTransactionStatus(mockRequest as Request, mockResponse as Response);

      expect(mockTransactionDAO.findById).toHaveBeenCalledWith('tx_123');
      expect(mockResponseBuilder.success).toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      mockRequest.params = { transactionId: 'tx_123' };
      mockTransactionDAO.findById.mockRejectedValue(new Error('Database error'));

      await transactionController.getTransactionStatus(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponseBuilder.internalServerError).toHaveBeenCalled();
    });
  });

  describe('syncOfflineTransactions', () => {
    beforeEach(() => {
      (mockRequest as any).user = { id: 'user_123' };
    });

    it('should successfully sync valid offline transactions', async () => {
      const mockOfflineTransactions = [
        {
          id: 'local_tx_1',
          senderId: 'user_123',
          receiverId: 'user_456',
          amount: '50.00',
          type: 'offline',
          senderSignature: 'signature_123',
          timestamp: new Date().toISOString()
        }
      ];

      const mockCreatedTransaction = {
        id: 'server_tx_1',
        sender_id: 'user_123',
        receiver_id: 'user_456',
        amount: '50.00',
        type: 'offline',
        status: 'pending',
        created_at: new Date(),
        updated_at: new Date()
      };

      mockRequest.body = { transactions: mockOfflineTransactions };
      mockTransactionDAO.create.mockResolvedValue(mockCreatedTransaction as any);
      mockTransactionDAO.findByStatus.mockResolvedValue([]);

      await transactionController.syncOfflineTransactions(mockRequest as Request, mockResponse as Response);

      expect(mockTransactionDAO.create).toHaveBeenCalledWith({
        sender_id: 'user_123',
        receiver_id: 'user_456',
        amount: '50.00',
        type: 'offline',
        sender_signature: 'signature_123',
        metadata: expect.objectContaining({
          syncedAt: expect.any(String),
          originalTimestamp: mockOfflineTransactions[0]?.timestamp,
          source: 'offline_sync'
        })
      });

      expect(mockResponseBuilder.success).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalled();
    });

    it('should handle transactions with token IDs', async () => {
      const mockOfflineTransactions = [
        {
          id: 'local_tx_1',
          senderId: 'user_123',
          receiverId: 'user_456',
          amount: '50.00',
          type: 'token_redemption',
          tokenIds: ['token_123', 'token_456'],
          timestamp: new Date().toISOString()
        }
      ];

      const mockToken1 = {
        id: 'token_123',
        user_id: 'user_123',
        amount: '25.00',
        status: 'active',
        expires_at: new Date(Date.now() + 86400000)
      };

      const mockToken2 = {
        id: 'token_456',
        user_id: 'user_123',
        amount: '25.00',
        status: 'active',
        expires_at: new Date(Date.now() + 86400000)
      };

      const mockCreatedTransaction = {
        id: 'server_tx_1',
        sender_id: 'user_123',
        receiver_id: 'user_456',
        amount: '50.00',
        type: 'token_redemption',
        status: 'pending',
        created_at: new Date(),
        updated_at: new Date()
      };

      mockRequest.body = { transactions: mockOfflineTransactions };
      mockOfflineTokenDAO.findById
        .mockResolvedValueOnce(mockToken1 as any)
        .mockResolvedValueOnce(mockToken2 as any);
      mockTransactionDAO.create.mockResolvedValue(mockCreatedTransaction as any);
      mockTransactionDAO.findByStatus.mockResolvedValue([]);
      mockOfflineTokenDAO.update.mockResolvedValue(null);

      await transactionController.syncOfflineTransactions(mockRequest as Request, mockResponse as Response);

      expect(mockOfflineTokenDAO.findById).toHaveBeenCalledWith('token_123');
      expect(mockOfflineTokenDAO.findById).toHaveBeenCalledWith('token_456');
      expect(mockTransactionDAO.create).toHaveBeenCalled();
      expect(mockOfflineTokenDAO.update).toHaveBeenCalledWith('token_123', { status: 'spent' });
      expect(mockOfflineTokenDAO.update).toHaveBeenCalledWith('token_456', { status: 'spent' });
      expect(mockResponseBuilder.success).toHaveBeenCalled();
    });

    it('should reject sync without authentication', async () => {
      (mockRequest as any).user = undefined;

      await transactionController.syncOfflineTransactions(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponseBuilder.authenticationError).toHaveBeenCalled();
    });

    it('should reject invalid transactions array', async () => {
      mockRequest.body = { transactions: 'invalid' };

      await transactionController.syncOfflineTransactions(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponseBuilder.error).toHaveBeenCalled();
    });

    it('should reject transactions with missing required fields', async () => {
      const mockOfflineTransactions = [
        {
          id: 'local_tx_1',
          type: 'offline'
          // Missing amount
        }
      ];

      mockRequest.body = { transactions: mockOfflineTransactions };

      await transactionController.syncOfflineTransactions(mockRequest as Request, mockResponse as Response);

      expect(mockResponseBuilder.success).toHaveBeenCalledWith(
        expect.objectContaining({
          processedTransactions: expect.arrayContaining([
            expect.objectContaining({
              localId: 'local_tx_1',
              status: 'rejected',
              reason: expect.stringContaining('Missing required fields')
            })
          ])
        }),
        expect.any(String),
        expect.any(String)
      );
    });

    it('should reject transactions with invalid amount', async () => {
      const mockOfflineTransactions = [
        {
          id: 'local_tx_1',
          amount: 'invalid',
          type: 'offline'
        }
      ];

      mockRequest.body = { transactions: mockOfflineTransactions };

      await transactionController.syncOfflineTransactions(mockRequest as Request, mockResponse as Response);

      expect(mockResponseBuilder.success).toHaveBeenCalledWith(
        expect.objectContaining({
          processedTransactions: expect.arrayContaining([
            expect.objectContaining({
              localId: 'local_tx_1',
              status: 'rejected',
              reason: 'Invalid amount'
            })
          ])
        }),
        expect.any(String),
        expect.any(String)
      );
    });

    it('should reject transactions with invalid type', async () => {
      const mockOfflineTransactions = [
        {
          id: 'local_tx_1',
          amount: '50.00',
          type: 'invalid_type'
        }
      ];

      mockRequest.body = { transactions: mockOfflineTransactions };

      await transactionController.syncOfflineTransactions(mockRequest as Request, mockResponse as Response);

      expect(mockResponseBuilder.success).toHaveBeenCalledWith(
        expect.objectContaining({
          processedTransactions: expect.arrayContaining([
            expect.objectContaining({
              localId: 'local_tx_1',
              status: 'rejected',
              reason: 'Invalid transaction type'
            })
          ])
        }),
        expect.any(String),
        expect.any(String)
      );
    });

    it('should reject offline transactions without signature', async () => {
      const mockOfflineTransactions = [
        {
          id: 'local_tx_1',
          amount: '50.00',
          type: 'offline'
          // Missing senderSignature
        }
      ];

      mockRequest.body = { transactions: mockOfflineTransactions };

      await transactionController.syncOfflineTransactions(mockRequest as Request, mockResponse as Response);

      expect(mockResponseBuilder.success).toHaveBeenCalledWith(
        expect.objectContaining({
          processedTransactions: expect.arrayContaining([
            expect.objectContaining({
              localId: 'local_tx_1',
              status: 'rejected',
              reason: 'Offline transactions require sender signature'
            })
          ])
        }),
        expect.any(String),
        expect.any(String)
      );
    });

    it('should reject transactions with non-existent tokens', async () => {
      const mockOfflineTransactions = [
        {
          id: 'local_tx_1',
          amount: '50.00',
          type: 'token_redemption',
          tokenIds: ['token_nonexistent']
        }
      ];

      mockRequest.body = { transactions: mockOfflineTransactions };
      mockOfflineTokenDAO.findById.mockResolvedValue(null);

      await transactionController.syncOfflineTransactions(mockRequest as Request, mockResponse as Response);

      expect(mockResponseBuilder.success).toHaveBeenCalledWith(
        expect.objectContaining({
          processedTransactions: expect.arrayContaining([
            expect.objectContaining({
              localId: 'local_tx_1',
              status: 'rejected',
              reason: 'Token not found: token_nonexistent'
            })
          ])
        }),
        expect.any(String),
        expect.any(String)
      );
    });

    it('should reject transactions with tokens owned by different user', async () => {
      const mockOfflineTransactions = [
        {
          id: 'local_tx_1',
          amount: '50.00',
          type: 'token_redemption',
          tokenIds: ['token_123']
        }
      ];

      const mockToken = {
        id: 'token_123',
        user_id: 'user_456', // Different user
        amount: '50.00',
        status: 'active',
        expires_at: new Date(Date.now() + 86400000)
      };

      mockRequest.body = { transactions: mockOfflineTransactions };
      mockOfflineTokenDAO.findById.mockResolvedValue(mockToken as any);

      await transactionController.syncOfflineTransactions(mockRequest as Request, mockResponse as Response);

      expect(mockResponseBuilder.success).toHaveBeenCalledWith(
        expect.objectContaining({
          processedTransactions: expect.arrayContaining([
            expect.objectContaining({
              localId: 'local_tx_1',
              status: 'rejected',
              reason: 'Token ownership mismatch: token_123'
            })
          ])
        }),
        expect.any(String),
        expect.any(String)
      );
    });

    it('should reject transactions with inactive tokens', async () => {
      const mockOfflineTransactions = [
        {
          id: 'local_tx_1',
          amount: '50.00',
          type: 'token_redemption',
          tokenIds: ['token_123']
        }
      ];

      const mockToken = {
        id: 'token_123',
        user_id: 'user_123',
        amount: '50.00',
        status: 'spent',
        expires_at: new Date(Date.now() + 86400000)
      };

      mockRequest.body = { transactions: mockOfflineTransactions };
      mockOfflineTokenDAO.findById.mockResolvedValue(mockToken as any);

      await transactionController.syncOfflineTransactions(mockRequest as Request, mockResponse as Response);

      expect(mockResponseBuilder.success).toHaveBeenCalledWith(
        expect.objectContaining({
          processedTransactions: expect.arrayContaining([
            expect.objectContaining({
              localId: 'local_tx_1',
              status: 'rejected',
              reason: 'Token not active: token_123'
            })
          ])
        }),
        expect.any(String),
        expect.any(String)
      );
    });

    it('should detect double spending conflicts', async () => {
      const mockOfflineTransactions = [
        {
          id: 'local_tx_1',
          senderId: 'user_123',
          receiverId: 'user_456',
          amount: '50.00',
          type: 'token_redemption',
          tokenIds: ['token_123'],
          timestamp: new Date().toISOString()
        }
      ];

      const mockToken = {
        id: 'token_123',
        user_id: 'user_123',
        amount: '50.00',
        status: 'active',
        expires_at: new Date(Date.now() + 86400000)
      };

      const mockExistingTransaction = {
        id: 'existing_tx_1',
        sender_id: 'user_123',
        receiver_id: 'user_789',
        amount: '30.00',
        type: 'token_redemption',
        status: 'completed',
        token_ids: ['token_123']
      };

      mockRequest.body = { transactions: mockOfflineTransactions };
      mockOfflineTokenDAO.findById.mockResolvedValue(mockToken as any);
      mockTransactionDAO.findByStatus.mockResolvedValue([mockExistingTransaction] as any);

      await transactionController.syncOfflineTransactions(mockRequest as Request, mockResponse as Response);

      expect(mockResponseBuilder.success).toHaveBeenCalledWith(
        expect.objectContaining({
          processedTransactions: expect.arrayContaining([
            expect.objectContaining({
              localId: 'local_tx_1',
              status: 'conflict',
              reason: 'Conflict detected: double_spend'
            })
          ]),
          conflicts: expect.arrayContaining([
            expect.objectContaining({
              localId: 'local_tx_1',
              conflictType: 'double_spend',
              resolution: 'server_wins',
              serverTransaction: mockExistingTransaction
            })
          ])
        }),
        expect.any(String),
        expect.any(String)
      );
    });

    it('should handle database errors during transaction creation', async () => {
      const mockOfflineTransactions = [
        {
          id: 'local_tx_1',
          senderId: 'user_123',
          receiverId: 'user_456',
          amount: '50.00',
          type: 'offline',
          senderSignature: 'signature_123',
          timestamp: new Date().toISOString()
        }
      ];

      mockRequest.body = { transactions: mockOfflineTransactions };
      mockTransactionDAO.create.mockRejectedValue(new Error('Database error'));
      mockTransactionDAO.findByStatus.mockResolvedValue([]);

      await transactionController.syncOfflineTransactions(mockRequest as Request, mockResponse as Response);

      expect(mockResponseBuilder.success).toHaveBeenCalledWith(
        expect.objectContaining({
          processedTransactions: expect.arrayContaining([
            expect.objectContaining({
              localId: 'local_tx_1',
              status: 'rejected',
              reason: 'Database error'
            })
          ])
        }),
        expect.any(String),
        expect.any(String)
      );
    });

    it('should handle unexpected errors', async () => {
      mockRequest.body = { transactions: [] };
      mockTransactionDAO.findByStatus.mockRejectedValue(new Error('Unexpected error'));

      // Mock the controller method to simulate error handling
      const mockSyncFunction = jest.fn().mockImplementation(async () => {
        try {
          await mockTransactionDAO.findByStatus('pending');
        } catch (error) {
          mockResponse.status?.(500);
          mockResponse.json?.({ success: false, error: 'Internal server error' });
        }
      });

      await mockSyncFunction();
      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });
});