import { TransactionDAO } from '../database/dao/TransactionDAO';
import { blockchainService } from './blockchainService';
import { logger } from '../utils/logger';
import { Transaction } from '../models/Transaction';

export interface TransactionStatusUpdate {
  transactionId: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  blockchainTxHash?: string | null;
  confirmations?: number;
  errorMessage?: string | null;
}

export class TransactionStatusService {
  private transactionDAO: TransactionDAO;
  private statusUpdateInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.transactionDAO = new TransactionDAO();
  }

  /**
   * Start the status monitoring service
   */
  startStatusMonitoring(): void {
    if (this.statusUpdateInterval) {
      return; // Already running
    }

    logger.info('Starting transaction status monitoring service');
    
    // Check transaction statuses every 30 seconds
    this.statusUpdateInterval = setInterval(async () => {
      try {
        await this.updatePendingTransactionStatuses();
      } catch (error) {
        logger.error('Error updating transaction statuses:', error);
      }
    }, 30000);
  }

  /**
   * Stop the status monitoring service
   */
  stopStatusMonitoring(): void {
    if (this.statusUpdateInterval) {
      clearInterval(this.statusUpdateInterval);
      this.statusUpdateInterval = null;
      logger.info('Transaction status monitoring service stopped');
    }
  }

  /**
   * Update status for a specific transaction
   */
  async updateTransactionStatus(transactionId: string): Promise<TransactionStatusUpdate | null> {
    try {
      const transaction = await this.transactionDAO.findById(transactionId);
      if (!transaction) {
        logger.warn(`Transaction not found: ${transactionId}`);
        return null;
      }

      // Skip if transaction is already completed or failed
      if (transaction.status === 'completed' || transaction.status === 'failed') {
        return {
          transactionId: transaction.id,
          status: transaction.status,
          blockchainTxHash: transaction.blockchain_tx_hash || null,
          confirmations: 0
        };
      }

      // Check blockchain status if transaction has blockchain hash
      if (transaction.blockchain_tx_hash) {
        const blockchainTx = await blockchainService.getTransaction(transaction.blockchain_tx_hash);
        
        if (blockchainTx) {
          const confirmations = blockchainTx.confirmations;
          let newStatus: 'pending' | 'completed' | 'failed' = transaction.status as any;

          // Update status based on confirmations
          if (confirmations >= 6) {
            newStatus = 'completed';
            await this.transactionDAO.markAsCompleted(transaction.id, transaction.blockchain_tx_hash);
          } else if (confirmations > 0) {
            // Transaction is in blockchain but not fully confirmed
            newStatus = 'pending';
          }

          return {
            transactionId: transaction.id,
            status: newStatus,
            blockchainTxHash: transaction.blockchain_tx_hash || null,
            confirmations
          };
        } else {
          // Transaction not found on blockchain - might have failed
          logger.warn(`Blockchain transaction not found: ${transaction.blockchain_tx_hash}`);
          
          // Don't immediately mark as failed - might be a temporary issue
          return {
            transactionId: transaction.id,
            status: 'pending',
            blockchainTxHash: transaction.blockchain_tx_hash || null,
            confirmations: 0
          };
        }
      }

      // For offline transactions, check if they should be marked as completed
      if (transaction.type === 'offline' && transaction.status === 'pending') {
        // Offline transactions can be marked as completed immediately if they have valid signatures
        if (transaction.sender_signature && transaction.receiver_signature) {
          await this.transactionDAO.markAsCompleted(transaction.id);
          
          return {
            transactionId: transaction.id,
            status: 'completed',
            confirmations: 1 // Offline transactions are considered confirmed
          };
        }
      }

      return {
        transactionId: transaction.id,
        status: transaction.status as any,
        blockchainTxHash: transaction.blockchain_tx_hash || null,
        confirmations: 0
      };

    } catch (error) {
      logger.error(`Error updating transaction status for ${transactionId}:`, error);
      return null;
    }
  }

  /**
   * Update statuses for all pending transactions
   */
  private async updatePendingTransactionStatuses(): Promise<void> {
    try {
      const pendingTransactions = await this.transactionDAO.findPendingTransactions();
      
      logger.debug(`Checking status for ${pendingTransactions.length} pending transactions`);

      for (const transaction of pendingTransactions) {
        await this.updateTransactionStatus(transaction.id);
        
        // Add small delay to avoid overwhelming the blockchain service
        await new Promise(resolve => setTimeout(resolve, 100));
      }

    } catch (error) {
      logger.error('Error updating pending transaction statuses:', error);
    }
  }

  /**
   * Get detailed transaction status with blockchain information
   */
  async getDetailedTransactionStatus(transactionId: string): Promise<{
    transaction: Transaction;
    blockchainInfo?: {
      confirmations: number;
      blockNumber: number;
      gasUsed: number;
      gasPrice: string;
    };
    statusHistory?: {
      status: string;
      timestamp: Date;
      reason?: string;
    }[];
  } | null> {
    try {
      const transaction = await this.transactionDAO.findById(transactionId);
      if (!transaction) {
        return null;
      }

      const result: any = { transaction };

      // Get blockchain information if available
      if (transaction.blockchain_tx_hash) {
        try {
          const blockchainTx = await blockchainService.getTransaction(transaction.blockchain_tx_hash);
          if (blockchainTx) {
            result.blockchainInfo = {
              confirmations: blockchainTx.confirmations,
              blockNumber: blockchainTx.blockNumber,
              gasUsed: blockchainTx.gasUsed,
              gasPrice: blockchainTx.gasPrice
            };
          }
        } catch (blockchainError) {
          logger.warn(`Failed to get blockchain info for transaction ${transactionId}:`, blockchainError);
        }
      }

      // Status history could be implemented by storing status changes in a separate table
      // For now, we'll provide basic status information
      result.statusHistory = [
        {
          status: 'pending',
          timestamp: transaction.created_at,
          reason: 'Transaction created'
        }
      ];

      if (transaction.status === 'completed' && transaction.completed_at) {
        result.statusHistory.push({
          status: 'completed',
          timestamp: transaction.completed_at,
          reason: 'Transaction confirmed'
        });
      } else if (transaction.status === 'failed' && transaction.error_message) {
        result.statusHistory.push({
          status: 'failed',
          timestamp: transaction.updated_at,
          reason: transaction.error_message
        });
      }

      return result;

    } catch (error) {
      logger.error(`Error getting detailed transaction status for ${transactionId}:`, error);
      return null;
    }
  }

  /**
   * Force status update for a transaction (useful for manual intervention)
   */
  async forceStatusUpdate(
    transactionId: string, 
    status: 'pending' | 'completed' | 'failed' | 'cancelled',
    reason?: string
  ): Promise<boolean> {
    try {
      const updateData: any = { status };
      
      if (status === 'completed') {
        updateData.completed_at = new Date();
      } else if (status === 'failed' && reason) {
        updateData.error_message = reason;
      }

      const updatedTransaction = await this.transactionDAO.update(transactionId, updateData);
      
      if (updatedTransaction) {
        logger.info(`Transaction ${transactionId} status forcibly updated to ${status}`, {
          transactionId,
          newStatus: status,
          reason
        });
        return true;
      }

      return false;

    } catch (error) {
      logger.error(`Error forcing status update for transaction ${transactionId}:`, error);
      return false;
    }
  }
}

// Export singleton instance
export const transactionStatusService = new TransactionStatusService();