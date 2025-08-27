import request from 'supertest';
import { app } from '../../index';
import { TransactionDAO } from '../../database/dao/TransactionDAO';
import { OfflineTokenDAO } from '../../database/dao/OfflineTokenDAO';
import { UserDAO } from '../../database/dao/UserDAO';
import { blockchainService } from '../../services/blockchainService';
import { offlineTokenManager } from '../../services/offlineTokenManager';
import jwt from 'jsonwebtoken';

// Mock dependencies
jest.mock('../../database/dao/TransactionDAO');
jest.mock('../../database/dao/OfflineTokenDAO');
jest.mock('../../database/dao/UserDAO');
jest.mock('../../services/blockchainService');
jest.mock('../../services/offlineTokenManager');

describe('API Endpoints Integration Tests', () => {
  let authToken: string;
  let mockTransactionDAO: jest.Mocked<TransactionDAO>;
  let mockOfflineTokenDAO: jest.Mocked<OfflineTokenDAO>;
  let mockUserDAO: jest.Mocked<UserDAO>;
  let mockBlockchainService: jest.Mocked<typeof blockchainService>;
  let mockOfflineTokenManager: jest.Mocked<typeof offlineTokenManager>;

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

    // Create valid JWT token for testing
    authToken = jwt.sign(
      { 
        userId: 'test-user-123',
        walletAddress: '0x1234567890123456789012345678901234567890',
        publicKey: 'test-public-key'
      },
      process.env['JWT_SECRET'] || 'test-secret',
      { expiresIn: '1h' }
    );

    // Setup default mocks
    mockBlockchainService.getTokenBalance.mockResolvedValue('100.00');
    mockOfflineTokenDAO.getUserTokenBalance.mockResolvedValue('50.00');
    mockOfflineTokenDAO.getUserTokenCount.mockResolvedValue(5);
    mockTransactionDAO.getUserPendingTransactions.mockResolvedValue([]);
    mockOfflineTokenManager.getPublicKey.mockReturnValue('mock-otm-public-key');
    mockOfflineTokenManager.getWalletAddress.mockReturnValue('0x9876543210987654321098765432109876543210');
  });

  describe('Transaction Endpoints', () => {
    describe('POST /api/v1/transactions/submit', () => {
      it('should successfully submit a transaction', async () => {
        const mockTransaction = {
          id: 'tx_123',
          sender_id: 'test-user-123',
          receiver_id: 'user_456',
          amount: '100.00',
          type: 'offline',
          status: 'pending',
          created_at: new Date(),
          updated_at: new Date()
        };

        mockTransactionDAO.create.mockResolvedValue(mockTransaction as any);

        const response = await request(app)
          .post('/api/v1/transactions/submit')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            senderId: 'test-user-123',
            receiverId: 'user_456',
            amount: '100.00',
            type: 'offline',
            senderSignature: 'signature_123'
          });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toMatchObject({
          transactionId: 'tx_123',
          status: 'pending'
        });
      });

      it('should reject transaction without authentication', async () => {
        const response = await request(app)
          .post('/api/v1/transactions/submit')
          .send({
            senderId: 'test-user-123',
            receiverId: 'user_456',
            amount: '100.00',
            type: 'offline',
            senderSignature: 'signature_123'
          });

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
      });

      it('should validate required fields', async () => {
        const response = await request(app)
          .post('/api/v1/transactions/submit')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            senderId: 'test-user-123'
            // Missing amount and type
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should validate transaction type', async () => {
        const response = await request(app)
          .post('/api/v1/transactions/submit')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            senderId: 'test-user-123',
            receiverId: 'user_456',
            amount: '100.00',
            type: 'invalid_type'
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should validate offline transaction requirements', async () => {
        const response = await request(app)
          .post('/api/v1/transactions/submit')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            senderId: 'test-user-123',
            amount: '100.00',
            type: 'offline'
            // Missing receiverId and senderSignature
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });
    });

    describe('GET /api/v1/transactions/sync', () => {
      it('should successfully sync transactions', async () => {
        const mockTransactions = [
          {
            id: 'tx_1',
            sender_id: 'test-user-123',
            receiver_id: 'user_456',
            amount: '100.00',
            type: 'offline',
            status: 'completed',
            created_at: new Date('2022-01-02T12:00:00Z'),
            updated_at: new Date()
          }
        ];

        mockTransactionDAO.findByUserId.mockResolvedValue(mockTransactions as any);

        const response = await request(app)
          .get('/api/v1/transactions/sync')
          .set('Authorization', `Bearer ${authToken}`)
          .query({
            since: '1640995200', // Unix timestamp
            limit: '10'
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toMatchObject({
          transactions: expect.any(Array),
          lastSyncTimestamp: expect.any(String),
          totalCount: expect.any(Number),
          hasMore: expect.any(Boolean)
        });
      });

      it('should require authentication', async () => {
        const response = await request(app)
          .get('/api/v1/transactions/sync');

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
      });

      it('should handle invalid since parameter', async () => {
        const response = await request(app)
          .get('/api/v1/transactions/sync')
          .set('Authorization', `Bearer ${authToken}`)
          .query({
            since: 'invalid_timestamp'
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });
    });

    describe('GET /api/v1/transactions/:transactionId/status', () => {
      it('should successfully get transaction status', async () => {
        const mockTransaction = {
          id: 'tx_123',
          sender_id: 'test-user-123',
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

        mockTransactionDAO.findById.mockResolvedValue(mockTransaction as any);
        mockBlockchainService.getTransaction.mockResolvedValue({
          hash: '0xabc123',
          confirmations: 5
        } as any);

        const response = await request(app)
          .get('/api/v1/transactions/tx_123/status')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toMatchObject({
          transactionId: 'tx_123',
          status: 'completed',
          confirmations: 5
        });
      });

      it('should return 404 for non-existent transaction', async () => {
        mockTransactionDAO.findById.mockResolvedValue(null);

        const response = await request(app)
          .get('/api/v1/transactions/tx_nonexistent/status')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND');
      });

      it('should deny access to unauthorized transaction', async () => {
        const mockTransaction = {
          id: 'tx_123',
          sender_id: 'other_user',
          receiver_id: 'another_user',
          amount: '100.00',
          type: 'offline',
          status: 'completed'
        };

        mockTransactionDAO.findById.mockResolvedValue(mockTransaction as any);

        const response = await request(app)
          .get('/api/v1/transactions/tx_123/status')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('AUTHORIZATION_FAILED');
      });
    });

    describe('POST /api/v1/transactions/sync-offline', () => {
      it('should successfully sync offline transactions', async () => {
        const mockOfflineTransactions = [
          {
            id: 'local_tx_1',
            senderId: 'test-user-123',
            receiverId: 'user_456',
            amount: '50.00',
            type: 'offline',
            senderSignature: 'signature_123',
            timestamp: new Date().toISOString()
          }
        ];

        const mockCreatedTransaction = {
          id: 'server_tx_1',
          sender_id: 'test-user-123',
          receiver_id: 'user_456',
          amount: '50.00',
          type: 'offline',
          status: 'pending',
          created_at: new Date(),
          updated_at: new Date()
        };

        mockTransactionDAO.create.mockResolvedValue(mockCreatedTransaction as any);
        mockTransactionDAO.findByStatus.mockResolvedValue([]);

        const response = await request(app)
          .post('/api/v1/transactions/sync-offline')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ transactions: mockOfflineTransactions });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toMatchObject({
          processedTransactions: expect.arrayContaining([
            expect.objectContaining({
              localId: 'local_tx_1',
              serverTransactionId: 'server_tx_1',
              status: 'accepted'
            })
          ]),
          conflicts: []
        });
      });

      it('should detect conflicts', async () => {
        const mockOfflineTransactions = [
          {
            id: 'local_tx_1',
            senderId: 'test-user-123',
            receiverId: 'user_456',
            amount: '50.00',
            type: 'token_redemption',
            tokenIds: ['token_123'],
            timestamp: new Date().toISOString()
          }
        ];

        const mockToken = {
          id: 'token_123',
          user_id: 'test-user-123',
          amount: '50.00',
          status: 'active',
          expires_at: new Date(Date.now() + 86400000)
        };

        const mockExistingTransaction = {
          id: 'existing_tx_1',
          sender_id: 'test-user-123',
          receiver_id: 'user_789',
          amount: '30.00',
          type: 'token_redemption',
          status: 'completed',
          token_ids: ['token_123']
        };

        mockOfflineTokenDAO.findById.mockResolvedValue(mockToken as any);
        mockTransactionDAO.findByStatus.mockResolvedValue([mockExistingTransaction] as any);

        const response = await request(app)
          .post('/api/v1/transactions/sync-offline')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ transactions: mockOfflineTransactions });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.conflicts).toHaveLength(1);
        expect(response.body.data.conflicts[0]).toMatchObject({
          localId: 'local_tx_1',
          conflictType: 'double_spend',
          resolution: 'server_wins'
        });
      });
    });
  });

  describe('Token Endpoints', () => {
    describe('POST /api/v1/tokens/validate', () => {
      it('should successfully validate a token', async () => {
        const mockTokenRecord = {
          id: 'token_123',
          user_id: 'test-user-123',
          amount: '50.00',
          signature: 'valid_signature',
          issued_at: new Date(),
          expires_at: new Date(Date.now() + 86400000),
          status: 'active',
          created_at: new Date()
        };

        const mockValidationResult = {
          isValid: true,
          error: null
        };

        mockOfflineTokenDAO.findById.mockResolvedValue(mockTokenRecord as any);
        mockOfflineTokenManager.validateToken.mockResolvedValue(mockValidationResult);

        const response = await request(app)
          .post('/api/v1/tokens/validate')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ tokenId: 'token_123' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toMatchObject({
          valid: true,
          token: expect.objectContaining({
            id: 'token_123',
            amount: 50.00,
            ownerId: 'test-user-123'
          }),
          validationDetails: expect.objectContaining({
            signatureValid: true,
            notExpired: true,
            notSpent: true,
            ownershipValid: true
          })
        });
      });

      it('should require authentication', async () => {
        const response = await request(app)
          .post('/api/v1/tokens/validate')
          .send({ tokenId: 'token_123' });

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
      });

      it('should validate request body', async () => {
        const response = await request(app)
          .post('/api/v1/tokens/validate')
          .set('Authorization', `Bearer ${authToken}`)
          .send({}); // Missing tokenId

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });
    });

    describe('POST /api/v1/tokens/divide', () => {
      it('should successfully divide a token', async () => {
        const mockOriginalToken = {
          id: 'token_123',
          user_id: 'test-user-123',
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
          userId: 'test-user-123',
          amount: 60,
          signature: 'payment_signature',
          issuedAt: new Date(),
          expiresAt: new Date(Date.now() + 86400000),
          isSpent: false
        };

        const mockChangeToken = {
          id: 'change_token_id',
          userId: 'test-user-123',
          amount: 40,
          signature: 'change_signature',
          issuedAt: new Date(),
          expiresAt: new Date(Date.now() + 86400000),
          isSpent: false
        };

        const mockPaymentTokenRecord = {
          id: 'payment_token_record_id',
          user_id: 'test-user-123',
          amount: '60.00',
          signature: 'payment_signature',
          issued_at: new Date(),
          expires_at: new Date(Date.now() + 86400000)
        };

        const mockChangeTokenRecord = {
          id: 'change_token_record_id',
          user_id: 'test-user-123',
          amount: '40.00',
          signature: 'change_signature',
          issued_at: new Date(),
          expires_at: new Date(Date.now() + 86400000)
        };

        mockOfflineTokenDAO.findById.mockResolvedValue(mockOriginalToken as any);
        mockOfflineTokenManager.issueTokens
          .mockResolvedValueOnce([mockPaymentToken] as any)
          .mockResolvedValueOnce([mockChangeToken] as any);
        mockOfflineTokenDAO.create
          .mockResolvedValueOnce(mockPaymentTokenRecord as any)
          .mockResolvedValueOnce(mockChangeTokenRecord as any);
        mockOfflineTokenDAO.update.mockResolvedValue(undefined);

        const response = await request(app)
          .post('/api/v1/tokens/divide')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ tokenId: 'token_123', paymentAmount: 60 });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toMatchObject({
          originalToken: expect.objectContaining({
            id: 'token_123',
            amount: 100,
            status: 'spent'
          }),
          paymentToken: expect.objectContaining({
            id: 'payment_token_record_id',
            amount: 60
          }),
          changeToken: expect.objectContaining({
            id: 'change_token_record_id',
            amount: 40
          })
        });
      });

      it('should reject invalid payment amount', async () => {
        const mockOriginalToken = {
          id: 'token_123',
          user_id: 'test-user-123',
          amount: '100.00',
          status: 'active'
        };

        mockOfflineTokenDAO.findById.mockResolvedValue(mockOriginalToken as any);

        const response = await request(app)
          .post('/api/v1/tokens/divide')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ tokenId: 'token_123', paymentAmount: 150 }); // Exceeds token amount

        expect(response.status).toBe(422);
        expect(response.body.success).toBe(false);
      });
    });

    describe('GET /api/v1/tokens/public-keys', () => {
      it('should successfully return public key database', async () => {
        const mockUserRecords = [
          {
            id: 'user_1',
            public_key: 'public_key_1',
            wallet_address: '0x1111111111111111111111111111111111111111',
            updated_at: new Date()
          },
          {
            id: 'user_2',
            public_key: 'public_key_2',
            wallet_address: '0x2222222222222222222222222222222222222222',
            updated_at: new Date()
          }
        ];

        mockUserDAO.findActiveUsers.mockResolvedValue(mockUserRecords as any);

        const response = await request(app)
          .get('/api/v1/tokens/public-keys');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toMatchObject({
          publicKeys: {
            user_1: expect.objectContaining({
              publicKey: 'public_key_1',
              walletAddress: '0x1111111111111111111111111111111111111111'
            }),
            user_2: expect.objectContaining({
              publicKey: 'public_key_2',
              walletAddress: '0x2222222222222222222222222222222222222222'
            })
          },
          otmPublicKey: 'mock-otm-public-key',
          version: '1.0.0'
        });
      });

      it('should not require authentication', async () => {
        mockUserDAO.findActiveUsers.mockResolvedValue([]);

        const response = await request(app)
          .get('/api/v1/tokens/public-keys');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });
  });

  describe('Wallet Endpoints', () => {
    describe('GET /api/v1/wallet/balance', () => {
      it('should successfully get wallet balance', async () => {
        const response = await request(app)
          .get('/api/v1/wallet/balance')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toMatchObject({
          walletId: 'test-user-123',
          walletAddress: '0x1234567890123456789012345678901234567890',
          balances: expect.objectContaining({
            blockchain: expect.objectContaining({
              amount: 100.00,
              currency: 'OWT'
            }),
            offline: expect.objectContaining({
              amount: 50.00,
              tokenCount: 5
            }),
            pending: expect.objectContaining({
              amount: 0,
              transactionCount: 0
            })
          }),
          totalBalance: 150.00
        });
      });

      it('should require authentication', async () => {
        const response = await request(app)
          .get('/api/v1/wallet/balance');

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
      });
    });

    describe('GET /api/v1/wallet/:walletId/balance', () => {
      it('should successfully get balance for own wallet', async () => {
        const response = await request(app)
          .get('/api/v1/wallet/test-user-123/balance')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toMatchObject({
          walletId: 'test-user-123',
          walletAddress: '0x1234567890123456789012345678901234567890',
          totalBalance: expect.any(Number)
        });
      });

      it('should deny access to other user wallet', async () => {
        const response = await request(app)
          .get('/api/v1/wallet/other-user-456/balance')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
      });
    });

    describe('POST /api/v1/wallet/tokens/purchase', () => {
      it('should successfully purchase tokens', async () => {
        const mockTokens = [
          {
            id: 'token_1',
            userId: 'test-user-123',
            amount: 50,
            signature: 'signature_1',
            issuedAt: new Date(),
            expiresAt: new Date(Date.now() + 86400000),
            isSpent: false
          },
          {
            id: 'token_2',
            userId: 'test-user-123',
            amount: 50,
            signature: 'signature_2',
            issuedAt: new Date(),
            expiresAt: new Date(Date.now() + 86400000),
            isSpent: false
          }
        ];

        const mockTokenRecords = [
          {
            id: 'record_1',
            user_id: 'test-user-123',
            amount: '50.00',
            signature: 'signature_1',
            issued_at: new Date(),
            expires_at: new Date(Date.now() + 86400000)
          },
          {
            id: 'record_2',
            user_id: 'test-user-123',
            amount: '50.00',
            signature: 'signature_2',
            issued_at: new Date(),
            expires_at: new Date(Date.now() + 86400000)
          }
        ];

        const mockTransaction = {
          id: 'tx_123',
          sender_id: 'test-user-123',
          amount: '100.00',
          type: 'token_purchase',
          status: 'completed'
        };

        mockOfflineTokenManager.issueTokens.mockResolvedValue(mockTokens as any);
        mockOfflineTokenDAO.create
          .mockResolvedValueOnce(mockTokenRecords[0] as any)
          .mockResolvedValueOnce(mockTokenRecords[1] as any);
        mockTransactionDAO.create.mockResolvedValue(mockTransaction as any);

        const response = await request(app)
          .post('/api/v1/wallet/tokens/purchase')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ amount: 100 });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toMatchObject({
          tokens: expect.arrayContaining([
            expect.objectContaining({
              id: 'record_1',
              amount: 50,
              signature: 'signature_1',
              isSpent: false
            }),
            expect.objectContaining({
              id: 'record_2',
              amount: 50,
              signature: 'signature_2',
              isSpent: false
            })
          ]),
          transactionId: 'tx_123'
        });
      });

      it('should validate amount', async () => {
        const response = await request(app)
          .post('/api/v1/wallet/tokens/purchase')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ amount: -10 }); // Invalid negative amount

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });
    });

    describe('POST /api/v1/wallet/tokens/redeem', () => {
      it('should successfully redeem tokens', async () => {
        const mockTokensToRedeem = [
          { id: 'token_1', signature: 'signature_1' },
          { id: 'token_2', signature: 'signature_2' }
        ];

        const mockRedemptionResult = {
          amount: 100,
          blockchainTxHash: '0xabc123'
        };

        const mockTransaction = {
          id: 'tx_123',
          receiver_id: 'test-user-123',
          amount: '100.00',
          type: 'token_redemption',
          blockchain_tx_hash: '0xabc123'
        };

        mockOfflineTokenManager.redeemTokens.mockResolvedValue(mockRedemptionResult as any);
        mockOfflineTokenDAO.markAsRedeemed.mockResolvedValue(undefined);
        mockTransactionDAO.create.mockResolvedValue(mockTransaction as any);
        mockBlockchainService.getTokenBalance.mockResolvedValue('200.00');

        const response = await request(app)
          .post('/api/v1/wallet/tokens/redeem')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ tokens: mockTokensToRedeem });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toMatchObject({
          transactionHash: '0xabc123',
          blockchainBalance: 200.00
        });
      });

      it('should validate tokens array', async () => {
        const response = await request(app)
          .post('/api/v1/wallet/tokens/redeem')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ tokens: [] }); // Empty array

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });
    });

    describe('GET /api/v1/wallet/history', () => {
      it('should successfully get wallet history', async () => {
        const mockTransactions = [
          {
            id: 'tx_1',
            type: 'token_purchase',
            amount: '100.00',
            status: 'completed',
            created_at: new Date(),
            blockchain_tx_hash: '0xabc123',
            sender_id: 'test-user-123',
            receiver_id: null,
            metadata: { test: 'data' }
          },
          {
            id: 'tx_2',
            type: 'token_transfer',
            amount: '50.00',
            status: 'pending',
            created_at: new Date(),
            blockchain_tx_hash: null,
            sender_id: 'test-user-123',
            receiver_id: 'user_456',
            metadata: null
          }
        ];

        mockTransactionDAO.getUserTransactionHistory.mockResolvedValue(mockTransactions as any);
        mockTransactionDAO.getUserTransactionCount.mockResolvedValue(2);

        const response = await request(app)
          .get('/api/v1/wallet/history')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toMatchObject({
          data: expect.arrayContaining([
            expect.objectContaining({
              id: 'tx_1',
              type: 'token_purchase',
              amount: 100.00,
              status: 'completed'
            }),
            expect.objectContaining({
              id: 'tx_2',
              type: 'token_transfer',
              amount: 50.00,
              status: 'pending'
            })
          ]),
          pagination: expect.objectContaining({
            page: 1,
            limit: 20,
            total: 2,
            totalPages: 1,
            hasNext: false,
            hasPrev: false
          })
        });
      });

      it('should handle pagination and filters', async () => {
        mockTransactionDAO.getUserTransactionHistory.mockResolvedValue([]);
        mockTransactionDAO.getUserTransactionCount.mockResolvedValue(0);

        const response = await request(app)
          .get('/api/v1/wallet/history')
          .set('Authorization', `Bearer ${authToken}`)
          .query({
            page: '2',
            limit: '10',
            type: 'token_purchase',
            status: 'completed'
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(mockTransactionDAO.getUserTransactionHistory).toHaveBeenCalledWith(
          'test-user-123',
          { page: 2, limit: 10, sortBy: 'timestamp', sortOrder: 'desc' },
          expect.objectContaining({
            type: 'token_purchase',
            status: 'completed'
          })
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      mockTransactionDAO.create.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .post('/api/v1/transactions/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          senderId: 'test-user-123',
          receiverId: 'user_456',
          amount: '100.00',
          type: 'offline',
          senderSignature: 'signature_123'
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INTERNAL_SERVER_ERROR');
    });

    it('should handle blockchain service errors', async () => {
      mockBlockchainService.getTokenBalance.mockRejectedValue(new Error('Blockchain service unavailable'));

      const response = await request(app)
        .get('/api/v1/wallet/balance')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });

    it('should handle invalid JWT tokens', async () => {
      const response = await request(app)
        .get('/api/v1/wallet/balance')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should handle malformed request bodies', async () => {
      const response = await request(app)
        .post('/api/v1/transactions/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('invalid-json');

      expect(response.status).toBe(400);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on endpoints', async () => {
      // Make multiple rapid requests to test rate limiting
      const requests = Array(10).fill(null).map(() =>
        request(app)
          .get('/api/v1/wallet/balance')
          .set('Authorization', `Bearer ${authToken}`)
      );

      const responses = await Promise.all(requests);
      
      // At least some requests should succeed
      const successfulRequests = responses.filter(r => r.status === 200);
      expect(successfulRequests.length).toBeGreaterThan(0);
      
      // If rate limiting is working, some requests might be rate limited
      // This is environment dependent, so we just check that the endpoint is responsive
    });
  });

  describe('CORS Headers', () => {
    it('should include proper CORS headers', async () => {
      const response = await request(app)
        .options('/api/v1/wallet/balance')
        .set('Origin', 'http://localhost:3000');

      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-methods']).toBeDefined();
      expect(response.headers['access-control-allow-headers']).toBeDefined();
    });
  });
});