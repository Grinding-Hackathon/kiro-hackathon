import request from 'supertest';
import { app } from '../../index';
import { OfflineTokenDAO } from '../../database/dao/OfflineTokenDAO';
import { TransactionDAO } from '../../database/dao/TransactionDAO';
import { blockchainService } from '../../services/blockchainService';
import jwt from 'jsonwebtoken';

// Mock dependencies
jest.mock('../../database/dao/OfflineTokenDAO');
jest.mock('../../database/dao/TransactionDAO');
jest.mock('../../services/blockchainService');

describe('Wallet Operations E2E Tests', () => {
  let userAuthToken: string;
  let mockOfflineTokenDAO: jest.Mocked<OfflineTokenDAO>;
  let mockTransactionDAO: jest.Mocked<TransactionDAO>;
  let mockBlockchainService: jest.Mocked<typeof blockchainService>;

  const testUser = {
    id: 'wallet-user-123',
    wallet_address: '0x1234567890123456789012345678901234567890',
    public_key: 'wallet-user-public-key',
    is_active: true
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mocked instances
    mockOfflineTokenDAO = new OfflineTokenDAO() as jest.Mocked<OfflineTokenDAO>;
    mockTransactionDAO = new TransactionDAO() as jest.Mocked<TransactionDAO>;
    mockBlockchainService = blockchainService as jest.Mocked<typeof blockchainService>;

    // Mock DAO instances
    (OfflineTokenDAO as jest.MockedClass<typeof OfflineTokenDAO>).mockImplementation(() => mockOfflineTokenDAO);
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
    mockBlockchainService.getTokenBalance.mockResolvedValue('500.00');
    mockOfflineTokenDAO.getUserTokenBalance.mockResolvedValue('250.00');
    mockOfflineTokenDAO.getUserTokenCount.mockResolvedValue(5);
    mockTransactionDAO.getUserPendingTransactions.mockResolvedValue([]);
  });

  describe('Complete Wallet Balance Workflow', () => {
    it('should provide comprehensive wallet balance information', async () => {
      // Setup complex balance scenario
      const mockPendingTransactions = [
        { id: 'pending-1', amount: '25.50' },
        { id: 'pending-2', amount: '15.75' }
      ];

      mockTransactionDAO.getUserPendingTransactions.mockResolvedValue(mockPendingTransactions as any);

      const balanceResponse = await request(app)
        .get('/api/v1/wallet/balance')
        .set('Authorization', `Bearer ${userAuthToken}`);

      expect(balanceResponse.status).toBe(200);
      expect(balanceResponse.body.success).toBe(true);
      expect(balanceResponse.body.data).toMatchObject({
        walletId: testUser.id,
        walletAddress: testUser.wallet_address,
        balances: {
          blockchain: {
            amount: 500.00,
            currency: 'OWT',
            lastUpdated: expect.any(String)
          },
          offline: {
            amount: 250.00,
            tokenCount: 5,
            lastUpdated: expect.any(String)
          },
          pending: {
            amount: 41.25, // 25.50 + 15.75
            transactionCount: 2
          }
        },
        totalBalance: 791.25 // 500 + 250 + 41.25
      });
    });
  });
});