import { Request, Response } from 'express';
import { TransactionController } from '../../controllers/transactionController';
import { TransactionDAO } from '../../database/dao/TransactionDAO';
import { OfflineTokenDAO } from '../../database/dao/OfflineTokenDAO';
import { blockchainService } from '../../services/blockchainService';
import { ResponseBuilder } from '../../utils/responseBuilder';

// Mock dependencies
jest.mock('../../database/dao/TransactionDAO');
jest.mock('../../database/dao/OfflineTokenDAO');
jest.mock('../../services/blockchainService');
jest.mock('../../utils/responseBuilder');

describe('TransactionController - Fixed Unit Tests', () => {
  let transactionController: TransactionController;
  let mockTransactionDAO: jest.Mocked<TransactionDAO>;
  let mockOfflineTokenDAO: jest.Mocked<OfflineTokenDAO>;
  let mockBlockchainService: jest.Mocked<typeof blockchainService>;
  let mockResponseBuilder: jest.Mocked<typeof ResponseBuilder>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

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
    it('should successfully submit a valid transaction', async () => {
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
    });

    it('should reject transaction with invalid type', async () => {
      mockRequest.body = {
        amount: '100.00',
        type: 'invalid_type'
      };

      await transactionController.submitTransaction(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });
  });

  describe('syncTransactions', () => {
    beforeEach(() => {
      (mockRequest as any).user = { id: 'user_123' };
    });

    it('should successfully sync transactions', async () => {
      const mockTransactions: any[] = [
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
      expect(mockResponse.json).toHaveBeenCalled();
    });

    it('should require authentication', async () => {
      (mockRequest as any).user = undefined;

      await transactionController.syncTransactions(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
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
      expect(mockResponse.json).toHaveBeenCalled();
    });

    it('should return 404 for non-existent transaction', async () => {
      mockRequest.params = { transactionId: 'tx_nonexistent' };
      mockTransactionDAO.findById.mockResolvedValue(null);

      await transactionController.getTransactionStatus(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });
  });
});