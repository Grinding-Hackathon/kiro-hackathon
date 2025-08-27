import { Request, Response } from 'express';
import { TransactionController } from '../../controllers/transactionController';
import { TransactionDAO } from '../../database/dao/TransactionDAO';
import { OfflineTokenDAO } from '../../database/dao/OfflineTokenDAO';
import { blockchainService } from '../../services/blockchainService';

// Mock dependencies
jest.mock('../../database/dao/TransactionDAO');
jest.mock('../../database/dao/OfflineTokenDAO');
jest.mock('../../services/blockchainService');
jest.mock('../../utils/logger');

describe('TransactionController', () => {
  let transactionController: TransactionController;
  let mockTransactionDAO: jest.Mocked<TransactionDAO>;
  let mockOfflineTokenDAO: jest.Mocked<OfflineTokenDAO>;
  let mockBlockchainService: jest.Mocked<typeof blockchainService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mocked instances
    mockTransactionDAO = new TransactionDAO() as jest.Mocked<TransactionDAO>;
    mockOfflineTokenDAO = new OfflineTokenDAO() as jest.Mocked<OfflineTokenDAO>;
    mockBlockchainService = blockchainService as jest.Mocked<typeof blockchainService>;

    // Mock DAO methods
    mockTransactionDAO.create = jest.fn();
    mockTransactionDAO.findById = jest.fn();
    mockTransactionDAO.findByUserId = jest.fn();
    mockTransactionDAO.findByStatus = jest.fn();
    mockTransactionDAO.update = jest.fn();
    mockTransactionDAO.markAsFailed = jest.fn();
    (mockTransactionDAO as any).tableName = 'transactions';
    (mockTransactionDAO as any).knex = jest.fn().mockReturnValue({
      where: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      count: jest.fn().mockReturnThis(),
      first: jest.fn(),
      whereRaw: jest.fn().mockReturnThis(),
    });

    mockOfflineTokenDAO.findById = jest.fn();
    mockOfflineTokenDAO.update = jest.fn();

    // Mock blockchain service
    mockBlockchainService.getTransaction = jest.fn();

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

      expect(mockTransactionDAO.create).toHaveBeenCalledWith({
        sender_id: 'user_1',
        receiver_id: 'user_2',
        amount: '100.00',
        type: 'offline',
        sender_signature: 'signature_123',
        receiver_signature: undefined,
        token_ids: undefined,
        metadata: expect.objectContaining({
          submittedAt: expect.any(String),
          userAgent: undefined,
          ipAddress: '127.0.0.1'
        })
      });

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          transactionId: 'tx_123',
          status: 'pending',
          blockchainTxHash: null,
          timestamp: mockTransaction.created_at.toISOString(),
          estimatedConfirmation: null
        },
        message: 'Transaction submitted successfully',
        timestamp: expect.any(String),
        requestId: 'test-request-id'
      });
    });

    it('should reject transaction with missing required fields', async () => {
      mockRequest.body = {
        senderId: 'user_1'
        // Missing amount and type
      };

      await transactionController.submitTransaction(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Amount and type are required',
          details: {
            validationErrors: [
              { field: 'amount', message: 'amount is required', value: undefined },
              { field: 'type', message: 'type is required', value: undefined }
            ]
          }
        },
        timestamp: expect.any(String),
        requestId: 'test-request-id'
      });
    });

    it('should reject transaction with invalid type', async () => {
      mockRequest.body = {
        amount: '100.00',
        type: 'invalid_type'
      };

      await transactionController.submitTransaction(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid transaction type',
          details: {
            field: 'type',
            validValues: ['online', 'offline', 'token_purchase', 'token_redemption'],
            receivedValue: 'invalid_type'
          }
        },
        timestamp: expect.any(String),
        requestId: 'test-request-id'
      });
    });

    it('should reject transaction with invalid amount', async () => {
      mockRequest.body = {
        amount: 'invalid_amount',
        type: 'offline'
      };

      await transactionController.submitTransaction(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Amount must be a positive number',
          details: {
            field: 'amount',
            receivedValue: 'invalid_amount'
          }
        },
        timestamp: expect.any(String),
        requestId: 'test-request-id'
      });
    });

    it('should reject offline transaction without required fields', async () => {
      mockRequest.body = {
        amount: '100.00',
        type: 'offline'
        // Missing senderSignature and receiverId
      };

      await transactionController.submitTransaction(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Offline transactions require sender signature and receiver ID',
          details: {
            validationErrors: [
              { field: 'senderSignature', message: 'Sender signature is required' },
              { field: 'receiverId', message: 'Receiver ID is required' }
            ]
          }
        },
        timestamp: expect.any(String),
        requestId: 'test-request-id'
      });
    });

    it('should reject transaction with non-existent token', async () => {
      mockRequest.body = {
        amount: '100.00',
        type: 'token_redemption',
        tokenIds: ['token_123']
      };

      mockOfflineTokenDAO.findById.mockResolvedValue(null);

      await transactionController.submitTransaction(mockRequest as Request, mockResponse as Response);

      expect(mockOfflineTokenDAO.findById).toHaveBeenCalledWith('token_123');
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'RESOURCE_NOT_FOUND',
          message: 'Token token_123 not found',
          details: {
            resource: 'Token token_123'
          }
        },
        timestamp: expect.any(String),
        requestId: 'test-request-id'
      });
    });

    it('should reject transaction with already spent token', async () => {
      const mockToken = {
        id: 'token_123',
        userId: 'user_1',
        amount: 50,
        status: 'spent',
        expiresAt: new Date(Date.now() + 86400000) // 1 day from now
      };

      mockRequest.body = {
        amount: '100.00',
        type: 'token_redemption',
        tokenIds: ['token_123']
      };

      mockOfflineTokenDAO.findById.mockResolvedValue(mockToken as any);

      await transactionController.submitTransaction(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(422);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'TOKEN_ALREADY_SPENT',
          message: 'Token token_123 has already been spent',
          details: {
            tokenId: 'token_123',
            currentStatus: 'spent'
          }
        },
        timestamp: expect.any(String),
        requestId: 'test-request-id'
      });
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
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Token token_123 has expired',
          details: {
            tokenId: 'token_123',
            expiresAt: mockToken.expires_at.toISOString()
          }
        },
        timestamp: expect.any(String),
        requestId: 'test-request-id'
      });
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
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Transaction submission failed'
        },
        timestamp: expect.any(String),
        requestId: 'test-request-id'
      });
    });
  });

  describe('syncTransactions', () => {
    beforeEach(() => {
      (mockRequest as any).user = { id: 'user_123' };
    });

    it('should successfully sync transactions', async () => {
      const mockTransactions = [
        {
          id: 'tx_1',
          sender_id: 'user_123',
          receiver_id: 'user_456',
          amount: '100.00',
          type: 'offline',
          status: 'completed',
          created_at: new Date('2022-01-01T12:00:00Z'), // After the since date
          updated_at: new Date()
        }
      ];

      mockRequest.query = {
        since: '1640995200', // Unix timestamp (2022-01-01 00:00:00)
        limit: '10',
        offset: '0'
      };

      // Mock the findByUserId method to return transactions
      mockTransactionDAO.findByUserId.mockResolvedValue(mockTransactions as any);

      await transactionController.syncTransactions(mockRequest as Request, mockResponse as Response);

      expect(mockTransactionDAO.findByUserId).toHaveBeenCalledWith('user_123');
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          transactions: mockTransactions,
          lastSyncTimestamp: expect.any(String),
          totalCount: 1,
          hasMore: false
        },
        message: 'Transaction sync completed',
        timestamp: expect.any(String),
        requestId: 'test-request-id'
      });
    });

    it('should reject sync without authentication', async () => {
      (mockRequest as any).user = undefined;

      await transactionController.syncTransactions(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'User authentication required'
        },
        timestamp: expect.any(String),
        requestId: 'test-request-id'
      });
    });

    it('should handle invalid since timestamp', async () => {
      mockRequest.query = {
        since: 'invalid_timestamp'
      };

      await transactionController.syncTransactions(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid since timestamp',
          details: {
            field: 'since',
            receivedValue: 'invalid_timestamp'
          }
        },
        timestamp: expect.any(String),
        requestId: 'test-request-id'
      });
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
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          transactionId: 'tx_123',
          status: 'completed',
          blockchainTxHash: '0xabc123',
          confirmations: 5,
          lastUpdated: mockTransaction.updated_at.toISOString(),
          errorMessage: null,
          metadata: { test: 'data' }
        },
        message: 'Transaction status retrieved',
        timestamp: expect.any(String),
        requestId: 'test-request-id'
      });
    });

    it('should reject request without transaction ID', async () => {
      mockRequest.params = {};

      await transactionController.getTransactionStatus(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Transaction ID is required',
          details: {
            field: 'transactionId'
          }
        },
        timestamp: expect.any(String),
        requestId: 'test-request-id'
      });
    });

    it('should return 404 for non-existent transaction', async () => {
      mockRequest.params = { transactionId: 'tx_nonexistent' };
      mockTransactionDAO.findById.mockResolvedValue(null);

      await transactionController.getTransactionStatus(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'RESOURCE_NOT_FOUND',
          message: 'Transaction tx_nonexistent not found',
          details: {
            resource: 'Transaction tx_nonexistent'
          }
        },
        timestamp: expect.any(String),
        requestId: 'test-request-id'
      });
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
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTHORIZATION_FAILED',
          message: 'Access denied to this transaction'
        },
        timestamp: expect.any(String),
        requestId: 'test-request-id'
      });
    });
  });

  describe('syncOfflineTransactions', () => {
    beforeEach(() => {
      (mockRequest as any).user = { id: 'user_123' };
    });

    it('should successfully sync offline transactions', async () => {
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

      // Mock conflict check
      const mockKnexChain = {
        whereRaw: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(null) // No conflicts
      };
      (mockTransactionDAO as any).knex.mockReturnValue(mockKnexChain as any);

      await transactionController.syncOfflineTransactions(mockRequest as Request, mockResponse as Response);

      expect(mockTransactionDAO.create).toHaveBeenCalledWith({
        sender_id: 'user_123',
        receiver_id: 'user_456',
        amount: '50.00',
        type: 'offline',
        sender_signature: 'signature_123',
        receiver_signature: undefined,
        token_ids: undefined,
        metadata: expect.objectContaining({
          syncedAt: expect.any(String),
          originalTimestamp: mockOfflineTransactions[0]?.timestamp,
          source: 'offline_sync'
        })
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          processedTransactions: [
            {
              localId: 'local_tx_1',
              serverTransactionId: 'server_tx_1',
              status: 'accepted'
            }
          ],
          conflicts: []
        },
        message: 'Offline transactions synced',
        timestamp: expect.any(String),
        requestId: 'test-request-id'
      });
    });

    it('should reject sync without authentication', async () => {
      (mockRequest as any).user = undefined;

      await transactionController.syncOfflineTransactions(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'User authentication required'
        },
        timestamp: expect.any(String),
        requestId: 'test-request-id'
      });
    });

    it('should reject invalid transactions array', async () => {
      mockRequest.body = { transactions: 'invalid' };

      await transactionController.syncOfflineTransactions(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Transactions array is required',
          details: {
            field: 'transactions'
          }
        },
        timestamp: expect.any(String),
        requestId: 'test-request-id'
      });
    });

    it('should handle validation failures', async () => {
      const mockOfflineTransactions = [
        {
          id: 'local_tx_1',
          // Missing required fields
          type: 'offline'
        }
      ];

      mockRequest.body = { transactions: mockOfflineTransactions };

      await transactionController.syncOfflineTransactions(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          processedTransactions: [
            {
              localId: 'local_tx_1',
              serverTransactionId: '',
              status: 'rejected',
              reason: 'Missing required fields: amount, type'
            }
          ],
          conflicts: []
        },
        message: 'Offline transactions synced',
        timestamp: expect.any(String),
        requestId: 'test-request-id'
      });
    });

    it('should detect and handle double spending conflicts', async () => {
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

      const mockExistingTransaction = {
        id: 'existing_tx_1',
        sender_id: 'user_123',
        receiver_id: 'user_789',
        amount: '30.00',
        type: 'token_redemption',
        status: 'completed',
        token_ids: ['token_123'] // This token is already used
      };

      const mockToken = {
        id: 'token_123',
        user_id: 'user_123',
        amount: '50.00',
        status: 'active',
        expires_at: new Date(Date.now() + 86400000) // 1 day from now
      };

      mockRequest.body = { transactions: mockOfflineTransactions };

      // Mock token validation
      mockOfflineTokenDAO.findById.mockResolvedValue(mockToken as any);
      
      // Mock conflict detection - return the existing transaction that uses the same token
      mockTransactionDAO.findByStatus.mockResolvedValue([mockExistingTransaction] as any);

      await transactionController.syncOfflineTransactions(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          processedTransactions: [
            {
              localId: 'local_tx_1',
              serverTransactionId: 'existing_tx_1',
              status: 'conflict',
              reason: 'Conflict detected: double_spend'
            }
          ],
          conflicts: [
            {
              localId: 'local_tx_1',
              conflictType: 'double_spend',
              resolution: 'server_wins',
              serverTransaction: mockExistingTransaction
            }
          ]
        },
        message: 'Offline transactions synced',
        timestamp: expect.any(String),
        requestId: 'test-request-id'
      });
    });
  });
});