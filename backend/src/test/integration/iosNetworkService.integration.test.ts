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

describe('iOS NetworkService Integration Tests', () => {
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
        userId: 'ios-user-123',
        walletAddress: '0x1234567890123456789012345678901234567890',
        publicKey: 'ios-public-key'
      },
      process.env['JWT_SECRET'] || 'test-secret',
      { expiresIn: '1h' }
    );

    // Setup default mocks
    mockBlockchainService.getTokenBalance.mockResolvedValue('150.75');
    mockOfflineTokenDAO.getUserTokenBalance.mockResolvedValue('75.25');
    mockOfflineTokenDAO.getUserTokenCount.mockResolvedValue(8);
    mockTransactionDAO.getUserPendingTransactions.mockResolvedValue([]);
    mockOfflineTokenManager.getPublicKey.mockReturnValue('otm-public-key-for-ios');
    mockOfflineTokenManager.getWalletAddress.mockReturnValue('0x9876543210987654321098765432109876543210');
  });

  describe('iOS NetworkService Communication Patterns', () => {
    describe('Authentication Flow', () => {
      it('should handle iOS authentication headers correctly', async () => {
        const response = await request(app)
          .get('/api/v1/wallet/balance')
          .set('Authorization', `Bearer ${authToken}`)
          .set('User-Agent', 'OfflineWallet/1.0 (iOS 15.0; iPhone13,2)')
          .set('X-iOS-Version', '15.0')
          .set('X-App-Version', '1.0.0');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.walletId).toBe('ios-user-123');
      });

      it('should handle iOS token refresh pattern', async () => {
        // Simulate expired token
        const expiredToken = jwt.sign(
          { 
            userId: 'ios-user-123',
            walletAddress: '0x1234567890123456789012345678901234567890'
          },
          process.env['JWT_SECRET'] || 'test-secret',
          { expiresIn: '-1h' } // Expired
        );

        const response = await request(app)
          .get('/api/v1/wallet/balance')
          .set('Authorization', `Bearer ${expiredToken}`)
          .set('User-Agent', 'OfflineWallet/1.0 (iOS 15.0; iPhone13,2)');

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
      });
    });

    describe('Transaction Submission Patterns', () => {
      it('should handle iOS transaction submission with device metadata', async () => {
        const mockTransaction = {
          id: 'ios-tx-123',
          sender_id: 'ios-user-123',
          receiver_id: 'user-456',
          amount: '50.00',
          type: 'offline',
          status: 'pending',
          created_at: new Date(),
          updated_at: new Date()
        };

        mockTransactionDAO.create.mockResolvedValue(mockTransaction as any);

        const response = await request(app)
          .post('/api/v1/transactions/submit')
          .set('Authorization', `Bearer ${authToken}`)
          .set('User-Agent', 'OfflineWallet/1.0 (iOS 15.0; iPhone13,2)')
          .set('X-Device-ID', 'iPhone13,2')
          .set('X-Connection-Type', 'bluetooth')
          .send({
            senderId: 'ios-user-123',
            receiverId: 'user-456',
            amount: '50.00',
            type: 'offline',
            senderSignature: 'ios-signature-123',
            metadata: {
              deviceType: 'iPhone',
              osVersion: '15.0',
              appVersion: '1.0.0',
              connectionType: 'bluetooth',
              timestamp: new Date().toISOString()
            }
          });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.transactionId).toBe('ios-tx-123');
        expect(response.body.data.status).toBe('pending');
        
        // Verify metadata was captured
        expect(mockTransactionDAO.create).toHaveBeenCalledWith(
          expect.objectContaining({
            metadata: expect.objectContaining({
              deviceType: 'iPhone',
              osVersion: '15.0',
              appVersion: '1.0.0',
              connectionType: 'bluetooth'
            })
          })
        );
      });

      it('should handle iOS offline transaction queue sync', async () => {
        const mockOfflineTransactions = [
          {
            id: 'ios-local-tx-1',
            senderId: 'ios-user-123',
            receiverId: 'user-456',
            amount: '25.00',
            type: 'offline',
            senderSignature: 'ios-signature-1',
            timestamp: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
            metadata: {
              deviceType: 'iPhone',
              queuedAt: new Date(Date.now() - 3600000).toISOString(),
              connectionType: 'bluetooth'
            }
          },
          {
            id: 'ios-local-tx-2',
            senderId: 'ios-user-123',
            receiverId: 'user-789',
            amount: '30.00',
            type: 'offline',
            senderSignature: 'ios-signature-2',
            timestamp: new Date(Date.now() - 1800000).toISOString(), // 30 minutes ago
            metadata: {
              deviceType: 'iPhone',
              queuedAt: new Date(Date.now() - 1800000).toISOString(),
              connectionType: 'qr_code'
            }
          }
        ];

        const mockCreatedTransactions = [
          {
            id: 'server-tx-1',
            sender_id: 'ios-user-123',
            receiver_id: 'user-456',
            amount: '25.00',
            type: 'offline',
            status: 'pending',
            created_at: new Date(),
            updated_at: new Date()
          },
          {
            id: 'server-tx-2',
            sender_id: 'ios-user-123',
            receiver_id: 'user-789',
            amount: '30.00',
            type: 'offline',
            status: 'pending',
            created_at: new Date(),
            updated_at: new Date()
          }
        ];

        mockTransactionDAO.create
          .mockResolvedValueOnce(mockCreatedTransactions[0] as any)
          .mockResolvedValueOnce(mockCreatedTransactions[1] as any);
        mockTransactionDAO.findByStatus.mockResolvedValue([]);

        const response = await request(app)
          .post('/api/v1/transactions/sync-offline')
          .set('Authorization', `Bearer ${authToken}`)
          .set('User-Agent', 'OfflineWallet/1.0 (iOS 15.0; iPhone13,2)')
          .set('X-Sync-Reason', 'connectivity_restored')
          .send({ 
            transactions: mockOfflineTransactions,
            syncMetadata: {
              lastOnlineAt: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
              queueSize: 2,
              syncReason: 'connectivity_restored'
            }
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.processedTransactions).toHaveLength(2);
        expect(response.body.data.processedTransactions).toEqual([
          expect.objectContaining({
            localId: 'ios-local-tx-1',
            serverTransactionId: 'server-tx-1',
            status: 'accepted'
          }),
          expect.objectContaining({
            localId: 'ios-local-tx-2',
            serverTransactionId: 'server-tx-2',
            status: 'accepted'
          })
        ]);
        expect(response.body.data.conflicts).toHaveLength(0);
      });
    });

    describe('Token Management Patterns', () => {
      it('should handle iOS token validation with biometric context', async () => {
        const mockTokenRecord = {
          id: 'ios-token-123',
          user_id: 'ios-user-123',
          amount: '100.00',
          signature: 'ios-token-signature',
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
          .set('User-Agent', 'OfflineWallet/1.0 (iOS 15.0; iPhone13,2)')
          .set('X-Biometric-Auth', 'face_id')
          .send({ 
            tokenId: 'ios-token-123',
            validationContext: {
              biometricAuth: 'face_id',
              deviceSecure: true,
              jailbroken: false
            }
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.valid).toBe(true);
        expect(response.body.data.token.id).toBe('ios-token-123');
        expect(response.body.data.validationDetails.signatureValid).toBe(true);
        expect(response.body.data.validationDetails.ownershipValid).toBe(true);
      });

      it('should handle iOS token division for payment scenarios', async () => {
        const mockOriginalToken = {
          id: 'ios-token-456',
          user_id: 'ios-user-123',
          amount: '200.00',
          signature: 'original-ios-signature',
          issued_at: new Date(),
          expires_at: new Date(Date.now() + 86400000),
          status: 'active',
          created_at: new Date(),
          metadata: {}
        };

        const mockPaymentToken = {
          id: 'payment-token-id',
          userId: 'ios-user-123',
          amount: 75,
          signature: 'payment-signature',
          issuedAt: new Date(),
          expiresAt: new Date(Date.now() + 86400000),
          isSpent: false
        };

        const mockChangeToken = {
          id: 'change-token-id',
          userId: 'ios-user-123',
          amount: 125,
          signature: 'change-signature',
          issuedAt: new Date(),
          expiresAt: new Date(Date.now() + 86400000),
          isSpent: false
        };

        const mockPaymentTokenRecord = {
          id: 'payment-record-id',
          user_id: 'ios-user-123',
          amount: '75.00',
          signature: 'payment-signature',
          issued_at: new Date(),
          expires_at: new Date(Date.now() + 86400000)
        };

        const mockChangeTokenRecord = {
          id: 'change-record-id',
          user_id: 'ios-user-123',
          amount: '125.00',
          signature: 'change-signature',
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
          .set('User-Agent', 'OfflineWallet/1.0 (iOS 15.0; iPhone13,2)')
          .set('X-Transaction-Context', 'payment')
          .send({ 
            tokenId: 'ios-token-456', 
            paymentAmount: 75,
            divisionContext: {
              purpose: 'payment',
              merchantId: 'merchant-789',
              transactionType: 'purchase'
            }
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.originalToken.status).toBe('spent');
        expect(response.body.data.paymentToken.amount).toBe(75);
        expect(response.body.data.changeToken.amount).toBe(125);
      });
    });

    describe('Wallet Balance and History Patterns', () => {
      it('should handle iOS wallet balance requests with refresh indicators', async () => {
        const mockPendingTransactions = [
          { id: 'pending-1', amount: '15.50' },
          { id: 'pending-2', amount: '8.25' }
        ];

        mockTransactionDAO.getUserPendingTransactions.mockResolvedValue(mockPendingTransactions as any);

        const response = await request(app)
          .get('/api/v1/wallet/balance')
          .set('Authorization', `Bearer ${authToken}`)
          .set('User-Agent', 'OfflineWallet/1.0 (iOS 15.0; iPhone13,2)')
          .set('X-Refresh-Type', 'pull_to_refresh')
          .set('X-Last-Update', new Date(Date.now() - 300000).toISOString()); // 5 minutes ago

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toMatchObject({
          walletId: 'ios-user-123',
          walletAddress: '0x1234567890123456789012345678901234567890',
          balances: {
            blockchain: {
              amount: 150.75,
              currency: 'OWT',
              lastUpdated: expect.any(String)
            },
            offline: {
              amount: 75.25,
              tokenCount: 8,
              lastUpdated: expect.any(String)
            },
            pending: {
              amount: 23.75, // 15.50 + 8.25
              transactionCount: 2
            }
          },
          totalBalance: 249.75 // 150.75 + 75.25 + 23.75
        });
      });

      it('should handle iOS wallet history with infinite scroll pagination', async () => {
        const mockTransactions = Array.from({ length: 20 }, (_, i) => ({
          id: `ios-tx-${i + 1}`,
          type: i % 2 === 0 ? 'token_purchase' : 'token_transfer',
          amount: `${(i + 1) * 10}.00`,
          status: i % 3 === 0 ? 'pending' : 'completed',
          created_at: new Date(Date.now() - (i * 3600000)), // Each transaction 1 hour apart
          blockchain_tx_hash: i % 2 === 0 ? `0xhash${i}` : null,
          sender_id: 'ios-user-123',
          receiver_id: i % 2 === 0 ? null : `user-${i}`,
          metadata: {
            deviceType: 'iPhone',
            appVersion: '1.0.0'
          }
        }));

        mockTransactionDAO.getUserTransactionHistory.mockResolvedValue(mockTransactions as any);
        mockTransactionDAO.getUserTransactionCount.mockResolvedValue(50);

        const response = await request(app)
          .get('/api/v1/wallet/history')
          .set('Authorization', `Bearer ${authToken}`)
          .set('User-Agent', 'OfflineWallet/1.0 (iOS 15.0; iPhone13,2)')
          .set('X-Scroll-Position', '0')
          .query({
            page: '1',
            limit: '20',
            sortBy: 'timestamp',
            sortOrder: 'desc'
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.data).toHaveLength(20);
        expect(response.body.data.pagination).toMatchObject({
          page: 1,
          limit: 20,
          total: 50,
          totalPages: 3,
          hasNext: true,
          hasPrev: false
        });

        // Verify transaction formatting for iOS
        expect(response.body.data.data[0]).toMatchObject({
          id: 'ios-tx-1',
          type: 'token_purchase',
          amount: 10.00,
          status: 'pending',
          timestamp: expect.any(String),
          counterparty: null // No counterparty for token_purchase
        });
      });
    });

    describe('Public Key Database Patterns', () => {
      it('should handle iOS public key database requests for offline validation', async () => {
        const mockUserRecords = [
          {
            id: 'user-1',
            public_key: 'pk-user-1',
            wallet_address: '0x1111111111111111111111111111111111111111',
            updated_at: new Date()
          },
          {
            id: 'user-2',
            public_key: 'pk-user-2',
            wallet_address: '0x2222222222222222222222222222222222222222',
            updated_at: new Date()
          },
          {
            id: 'ios-user-123',
            public_key: 'ios-public-key',
            wallet_address: '0x1234567890123456789012345678901234567890',
            updated_at: new Date()
          }
        ];

        mockUserDAO.findActiveUsers.mockResolvedValue(mockUserRecords as any);

        const response = await request(app)
          .get('/api/v1/tokens/public-keys')
          .set('User-Agent', 'OfflineWallet/1.0 (iOS 15.0; iPhone13,2)')
          .set('X-Cache-Version', '1.0')
          .set('If-Modified-Since', new Date(Date.now() - 86400000).toUTCString()); // 1 day ago

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toMatchObject({
          publicKeys: {
            'user-1': {
              publicKey: 'pk-user-1',
              walletAddress: '0x1111111111111111111111111111111111111111',
              lastUpdated: expect.any(String)
            },
            'user-2': {
              publicKey: 'pk-user-2',
              walletAddress: '0x2222222222222222222222222222222222222222',
              lastUpdated: expect.any(String)
            },
            'ios-user-123': {
              publicKey: 'ios-public-key',
              walletAddress: '0x1234567890123456789012345678901234567890',
              lastUpdated: expect.any(String)
            }
          },
          otmPublicKey: 'otm-public-key-for-ios',
          version: '1.0.0'
        });
      });
    });

    describe('Error Handling Patterns', () => {
      it('should handle iOS-specific error scenarios with proper error codes', async () => {
        // Test network timeout scenario
        mockBlockchainService.getTokenBalance.mockRejectedValue(new Error('Network timeout'));

        const response = await request(app)
          .get('/api/v1/wallet/balance')
          .set('Authorization', `Bearer ${authToken}`)
          .set('User-Agent', 'OfflineWallet/1.0 (iOS 15.0; iPhone13,2)')
          .set('X-Network-Type', 'cellular')
          .set('X-Signal-Strength', 'weak');

        expect(response.status).toBe(500);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('INTERNAL_SERVER_ERROR');
        expect(response.body.timestamp).toBeDefined();
        expect(response.body.requestId).toBeDefined();
      });

      it('should handle iOS token validation failures with detailed error info', async () => {
        const mockTokenRecord = {
          id: 'expired-token-123',
          user_id: 'ios-user-123',
          amount: '50.00',
          signature: 'expired-signature',
          issued_at: new Date(),
          expires_at: new Date(Date.now() - 86400000), // Expired 1 day ago
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
          .set('User-Agent', 'OfflineWallet/1.0 (iOS 15.0; iPhone13,2)')
          .send({ tokenId: 'expired-token-123' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.valid).toBe(false);
        expect(response.body.data.validationDetails.notExpired).toBe(false);
        expect(response.body.data.validationDetails.signatureValid).toBe(true);
        expect(response.body.data.validationDetails.ownershipValid).toBe(true);
      });

      it('should handle iOS offline transaction conflicts with resolution guidance', async () => {
        const mockOfflineTransactions = [
          {
            id: 'ios-conflict-tx-1',
            senderId: 'ios-user-123',
            receiverId: 'user-456',
            amount: '50.00',
            type: 'token_redemption',
            tokenIds: ['conflicted-token-123'],
            timestamp: new Date().toISOString()
          }
        ];

        const mockToken = {
          id: 'conflicted-token-123',
          user_id: 'ios-user-123',
          amount: '50.00',
          status: 'active',
          expires_at: new Date(Date.now() + 86400000)
        };

        const mockExistingTransaction = {
          id: 'existing-conflict-tx',
          sender_id: 'ios-user-123',
          receiver_id: 'user-789',
          amount: '30.00',
          type: 'token_redemption',
          status: 'completed',
          token_ids: ['conflicted-token-123']
        };

        mockOfflineTokenDAO.findById.mockResolvedValue(mockToken as any);
        mockTransactionDAO.findByStatus.mockResolvedValue([mockExistingTransaction] as any);

        const response = await request(app)
          .post('/api/v1/transactions/sync-offline')
          .set('Authorization', `Bearer ${authToken}`)
          .set('User-Agent', 'OfflineWallet/1.0 (iOS 15.0; iPhone13,2)')
          .set('X-Conflict-Resolution', 'server_wins')
          .send({ transactions: mockOfflineTransactions });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.conflicts).toHaveLength(1);
        expect(response.body.data.conflicts[0]).toMatchObject({
          localId: 'ios-conflict-tx-1',
          conflictType: 'double_spend',
          resolution: 'server_wins',
          serverTransaction: expect.objectContaining({
            id: 'existing-conflict-tx'
          })
        });
        expect(response.body.data.processedTransactions[0]).toMatchObject({
          localId: 'ios-conflict-tx-1',
          status: 'conflict',
          reason: 'Conflict detected: double_spend'
        });
      });
    });

    describe('Performance and Caching Patterns', () => {
      it('should handle iOS cache validation headers', async () => {
        const lastModified = new Date(Date.now() - 3600000); // 1 hour ago
        mockUserDAO.findActiveUsers.mockResolvedValue([
          {
            id: 'user-1',
            public_key: 'pk-user-1',
            wallet_address: '0x1111111111111111111111111111111111111111',
            updated_at: lastModified
          }
        ]);

        const response = await request(app)
          .get('/api/v1/tokens/public-keys')
          .set('User-Agent', 'OfflineWallet/1.0 (iOS 15.0; iPhone13,2)')
          .set('If-Modified-Since', lastModified.toUTCString());

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        // In a real implementation, this might return 304 Not Modified
        // For now, we just verify the endpoint responds correctly
      });

      it('should handle iOS batch requests efficiently', async () => {
        // Simulate multiple concurrent requests from iOS
        const requests = [
          request(app)
            .get('/api/v1/wallet/balance')
            .set('Authorization', `Bearer ${authToken}`)
            .set('User-Agent', 'OfflineWallet/1.0 (iOS 15.0; iPhone13,2)'),
          request(app)
            .get('/api/v1/wallet/history?limit=5')
            .set('Authorization', `Bearer ${authToken}`)
            .set('User-Agent', 'OfflineWallet/1.0 (iOS 15.0; iPhone13,2)'),
          request(app)
            .get('/api/v1/tokens/public-keys')
            .set('User-Agent', 'OfflineWallet/1.0 (iOS 15.0; iPhone13,2)')
        ];

        // Setup mocks for history request
        mockTransactionDAO.getUserTransactionHistory.mockResolvedValue([]);
        mockTransactionDAO.getUserTransactionCount.mockResolvedValue(0);
        mockUserDAO.findActiveUsers.mockResolvedValue([]);

        const responses = await Promise.all(requests);

        // All requests should succeed
        responses.forEach(response => {
          expect(response.status).toBe(200);
          expect(response.body.success).toBe(true);
        });

        // Verify balance response
        expect(responses[0].body.data.walletId).toBe('ios-user-123');
        
        // Verify history response
        expect(responses[1].body.data.pagination).toBeDefined();
        
        // Verify public keys response
        expect(responses[2].body.data.otmPublicKey).toBe('otm-public-key-for-ios');
      });
    });
  });
});