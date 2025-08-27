import { TransactionStatusService } from '../../services/transactionStatusService';
import { TransactionDAO } from '../../database/dao/TransactionDAO';
import { blockchainService } from '../../services/blockchainService';

// Mock dependencies
jest.mock('../../database/dao/TransactionDAO');
jest.mock('../../services/blockchainService');
jest.mock('../../utils/logger');

describe('TransactionStatusService', () => {
  let transactionStatusService: TransactionStatusService;
  let mockTransactionDAO: jest.Mocked<TransactionDAO>;
  let mockBlockchainService: jest.Mocked<typeof blockchainService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockTransactionDAO = new TransactionDAO() as jest.Mocked<TransactionDAO>;
    mockBlockchainService = blockchainService as jest.Mocked<typeof blockchainService>;
    
    // Mock DAO methods
    mockTransactionDAO.findById = jest.fn();
    mockTransactionDAO.findPendingTransactions = jest.fn();
    mockTransactionDAO.markAsCompleted = jest.fn();
    mockTransactionDAO.update = jest.fn();
    
    transactionStatusService = new TransactionStatusService();
    (transactionStatusService as any).transactionDAO = mockTransactionDAO;
  });

  describe('updateTransactionStatus', () => {
    it('should update status for blockchain transaction with confirmations', async () => {
      const mockTransaction = {
        id: 'tx_123',
        status: 'pending',
        blockchain_tx_hash: '0xabc123',
        type: 'online',
        created_at: new Date(),
        updated_at: new Date()
      };

      const mockBlockchainTx = {
        hash: '0xabc123',
        confirmations: 6,
        blockNumber: 12345,
        gasUsed: 21000,
        gasPrice: '20000000000'
      };

      mockTransactionDAO.findById.mockResolvedValue(mockTransaction as any);
      mockBlockchainService.getTransaction.mockResolvedValue(mockBlockchainTx as any);
      mockTransactionDAO.markAsCompleted.mockResolvedValue(mockTransaction as any);

      const result = await transactionStatusService.updateTransactionStatus('tx_123');

      expect(mockTransactionDAO.findById).toHaveBeenCalledWith('tx_123');
      expect(mockBlockchainService.getTransaction).toHaveBeenCalledWith('0xabc123');
      expect(mockTransactionDAO.markAsCompleted).toHaveBeenCalledWith('tx_123', '0xabc123');
      
      expect(result).toEqual({
        transactionId: 'tx_123',
        status: 'completed',
        blockchainTxHash: '0xabc123',
        confirmations: 6
      });
    });

    it('should handle offline transaction completion', async () => {
      const mockTransaction = {
        id: 'tx_456',
        status: 'pending',
        type: 'offline',
        sender_signature: 'sig1',
        receiver_signature: 'sig2',
        created_at: new Date(),
        updated_at: new Date()
      };

      mockTransactionDAO.findById.mockResolvedValue(mockTransaction as any);
      mockTransactionDAO.markAsCompleted.mockResolvedValue(mockTransaction as any);

      const result = await transactionStatusService.updateTransactionStatus('tx_456');

      expect(mockTransactionDAO.markAsCompleted).toHaveBeenCalledWith('tx_456');
      
      expect(result).toEqual({
        transactionId: 'tx_456',
        status: 'completed',
        confirmations: 1
      });
    });

    it('should return null for non-existent transaction', async () => {
      mockTransactionDAO.findById.mockResolvedValue(null);

      const result = await transactionStatusService.updateTransactionStatus('tx_nonexistent');

      expect(result).toBeNull();
    });

    it('should handle blockchain service errors gracefully', async () => {
      const mockTransaction = {
        id: 'tx_789',
        status: 'pending',
        blockchain_tx_hash: '0xdef456',
        type: 'online',
        created_at: new Date(),
        updated_at: new Date()
      };

      mockTransactionDAO.findById.mockResolvedValue(mockTransaction as any);
      mockBlockchainService.getTransaction.mockRejectedValue(new Error('Blockchain error'));

      const result = await transactionStatusService.updateTransactionStatus('tx_789');

      expect(result).toBeNull();
    });
  });

  describe('getDetailedTransactionStatus', () => {
    it('should return detailed status with blockchain info', async () => {
      const mockTransaction = {
        id: 'tx_123',
        status: 'completed',
        blockchain_tx_hash: '0xabc123',
        type: 'online',
        created_at: new Date(),
        updated_at: new Date(),
        completed_at: new Date()
      };

      const mockBlockchainTx = {
        hash: '0xabc123',
        confirmations: 10,
        blockNumber: 12345,
        gasUsed: 21000,
        gasPrice: '20000000000'
      };

      mockTransactionDAO.findById.mockResolvedValue(mockTransaction as any);
      mockBlockchainService.getTransaction.mockResolvedValue(mockBlockchainTx as any);

      const result = await transactionStatusService.getDetailedTransactionStatus('tx_123');

      expect(result).toEqual({
        transaction: mockTransaction,
        blockchainInfo: {
          confirmations: 10,
          blockNumber: 12345,
          gasUsed: 21000,
          gasPrice: '20000000000'
        },
        statusHistory: [
          {
            status: 'pending',
            timestamp: mockTransaction.created_at,
            reason: 'Transaction created'
          },
          {
            status: 'completed',
            timestamp: mockTransaction.completed_at,
            reason: 'Transaction confirmed'
          }
        ]
      });
    });
  });

  describe('forceStatusUpdate', () => {
    it('should force update transaction status', async () => {
      const mockUpdatedTransaction = {
        id: 'tx_123',
        status: 'failed',
        error_message: 'Manual intervention'
      };

      mockTransactionDAO.update.mockResolvedValue(mockUpdatedTransaction as any);

      const result = await transactionStatusService.forceStatusUpdate('tx_123', 'failed', 'Manual intervention');

      expect(mockTransactionDAO.update).toHaveBeenCalledWith('tx_123', {
        status: 'failed',
        error_message: 'Manual intervention'
      });
      
      expect(result).toBe(true);
    });
  });
});