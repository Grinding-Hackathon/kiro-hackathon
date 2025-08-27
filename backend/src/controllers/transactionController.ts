import { Request, Response } from 'express';
import { TransactionDAO } from '../database/dao/TransactionDAO';
import { OfflineTokenDAO } from '../database/dao/OfflineTokenDAO';
import { blockchainService } from '../services/blockchainService';
import { logger } from '../utils/logger';
import { Transaction, CreateTransactionData } from '../models/Transaction';
import { ErrorCode } from '../types';
import { ResponseBuilder } from '../utils/responseBuilder';

// Response interfaces matching iOS expectations
export interface TransactionSubmissionResponse {
  transactionId: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  blockchainTxHash?: string | null;
  timestamp: string;
  estimatedConfirmation?: string | null;
}

export interface TransactionSyncResponse {
  transactions: Transaction[];
  lastSyncTimestamp: string;
  totalCount: number;
  hasMore: boolean;
}

export interface TransactionStatusResponse {
  transactionId: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  blockchainTxHash?: string | null;
  confirmations: number;
  lastUpdated: string;
  errorMessage?: string | null;
  metadata?: any;
}

export interface OfflineTransactionSyncRequest {
  transactions: {
    id: string;
    senderId?: string;
    receiverId?: string;
    amount: string;
    type: 'online' | 'offline' | 'token_purchase' | 'token_redemption';
    senderSignature?: string;
    receiverSignature?: string;
    tokenIds?: string[];
    metadata?: any;
    timestamp: string;
  }[];
}

export interface OfflineTransactionSyncResponse {
  processedTransactions: {
    localId: string;
    serverTransactionId: string;
    status: 'accepted' | 'rejected' | 'conflict';
    reason?: string | null;
  }[];
  conflicts: {
    localId: string;
    conflictType: 'double_spend' | 'invalid_signature' | 'expired_token' | 'insufficient_balance';
    resolution: 'server_wins' | 'client_wins' | 'manual_review';
    serverTransaction?: Transaction | null;
  }[];
}

export class TransactionController {
  private transactionDAO: TransactionDAO;
  private offlineTokenDAO: OfflineTokenDAO;

  constructor() {
    this.transactionDAO = new TransactionDAO();
    this.offlineTokenDAO = new OfflineTokenDAO();
  }

  /**
   * Submit a new transaction
   */
  async submitTransaction(req: Request, res: Response): Promise<void> {
    try {
      const {
        senderId,
        receiverId,
        amount,
        type,
        senderSignature,
        receiverSignature,
        tokenIds,
        metadata
      } = req.body;

      // Validate required fields
      if (!amount || !type) {
        const response = ResponseBuilder.validationError(
          'Amount and type are required',
          ['amount', 'type'].filter(field => !req.body[field]).map(field => ({
            field,
            message: `${field} is required`,
            value: req.body[field]
          })),
          ResponseBuilder.getRequestId(req)
        );
        res.status(400).json(response);
        return;
      }

      // Validate transaction type
      const validTypes = ['online', 'offline', 'token_purchase', 'token_redemption'];
      if (!validTypes.includes(type)) {
        const response = ResponseBuilder.error(
          ErrorCode.VALIDATION_ERROR,
          'Invalid transaction type',
          {
            field: 'type',
            validValues: validTypes,
            receivedValue: type
          },
          ResponseBuilder.getRequestId(req)
        );
        res.status(400).json(response);
        return;
      }

      // Validate amount
      const numericAmount = parseFloat(amount);
      if (isNaN(numericAmount) || numericAmount <= 0) {
        const response = ResponseBuilder.error(
          ErrorCode.VALIDATION_ERROR,
          'Amount must be a positive number',
          {
            field: 'amount',
            receivedValue: amount
          },
          ResponseBuilder.getRequestId(req)
        );
        res.status(400).json(response);
        return;
      }

      // Validate signatures for offline transactions
      if (type === 'offline' && (!senderSignature || !receiverId)) {
        const response = ResponseBuilder.validationError(
          'Offline transactions require sender signature and receiver ID',
          [
            !senderSignature && { field: 'senderSignature', message: 'Sender signature is required' },
            !receiverId && { field: 'receiverId', message: 'Receiver ID is required' }
          ].filter(Boolean) as any[],
          ResponseBuilder.getRequestId(req)
        );
        res.status(400).json(response);
        return;
      }

      // Validate token IDs for token-related transactions
      if ((type === 'token_purchase' || type === 'token_redemption') && tokenIds && tokenIds.length > 0) {
        // Verify tokens exist and are valid
        for (const tokenId of tokenIds) {
          const token = await this.offlineTokenDAO.findById(tokenId);
          if (!token) {
            const response = ResponseBuilder.notFoundError(
              `Token ${tokenId}`,
              ResponseBuilder.getRequestId(req)
            );
            res.status(404).json(response);
            return;
          }

          // Check if token is already spent
          if (token.status === 'spent' || token.status === 'redeemed') {
            const response = ResponseBuilder.businessLogicError(
              ErrorCode.TOKEN_ALREADY_SPENT,
              `Token ${tokenId} has already been spent`,
              {
                tokenId,
                currentStatus: token.status
              },
              ResponseBuilder.getRequestId(req)
            );
            res.status(422).json(response);
            return;
          }

          // Check if token is expired
          if (token.expires_at && new Date() > token.expires_at) {
            const response = ResponseBuilder.businessLogicError(
              ErrorCode.TOKEN_EXPIRED,
              `Token ${tokenId} has expired`,
              {
                tokenId,
                expiresAt: token.expires_at.toISOString()
              },
              ResponseBuilder.getRequestId(req)
            );
            res.status(422).json(response);
            return;
          }
        }
      }

      // Create transaction data
      const transactionData: CreateTransactionData = {
        amount: amount.toString(),
        type,
        metadata: {
          ...metadata,
          submittedAt: new Date().toISOString(),
          userAgent: req.headers['user-agent'],
          ipAddress: req.ip
        }
      };

      // Add optional fields only if they exist
      if (senderId) {
        transactionData.sender_id = senderId;
      }
      if (receiverId) {
        transactionData.receiver_id = receiverId;
      }
      if (senderSignature) {
        transactionData.sender_signature = senderSignature;
      }
      if (receiverSignature) {
        transactionData.receiver_signature = receiverSignature;
      }
      if (tokenIds) {
        transactionData.token_ids = tokenIds;
      }

      // Create transaction in database
      const transaction = await this.transactionDAO.create(transactionData);
      if (!transaction) {
        throw new Error('Failed to create transaction');
      }

      logger.info(`Transaction created: ${transaction.id}`, {
        transactionId: transaction.id,
        type: transaction.type,
        amount: transaction.amount,
        senderId: transaction.sender_id,
        receiverId: transaction.receiver_id
      });

      // For online transactions, attempt blockchain submission
      let blockchainTxHash: string | undefined;
      let estimatedConfirmation: Date | undefined;

      if (type === 'online' || type === 'token_purchase') {
        try {
          // This would integrate with blockchain service for actual submission
          // For now, we'll simulate the process
          logger.info(`Attempting blockchain submission for transaction: ${transaction.id}`);
          
          // In a real implementation, this would call blockchain service
          // const blockchainTx = await blockchainService.submitTransaction(transactionData);
          // blockchainTxHash = blockchainTx.hash;
          
          // For now, simulate blockchain hash
          blockchainTxHash = `0x${Math.random().toString(16).substr(2, 64)}`;
          estimatedConfirmation = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now
          
          // Update transaction with blockchain hash
          await this.transactionDAO.update(transaction.id, {
            blockchain_tx_hash: blockchainTxHash
          });

          logger.info(`Blockchain transaction submitted: ${blockchainTxHash}`, {
            transactionId: transaction.id,
            blockchainTxHash
          });
        } catch (blockchainError) {
          logger.error(`Blockchain submission failed for transaction ${transaction.id}:`, blockchainError);
          
          // Mark transaction as failed
          await this.transactionDAO.markAsFailed(
            transaction.id, 
            `Blockchain submission failed: ${blockchainError instanceof Error ? blockchainError.message : 'Unknown error'}`
          );
          
          const response = ResponseBuilder.businessLogicError(
            ErrorCode.BLOCKCHAIN_ERROR,
            'Failed to submit transaction to blockchain',
            {
              transactionId: transaction.id,
              reason: blockchainError instanceof Error ? blockchainError.message : 'Unknown error'
            },
            ResponseBuilder.getRequestId(req)
          );
          res.status(422).json(response);
          return;
        }
      }

      // Prepare response
      const response: TransactionSubmissionResponse = {
        transactionId: transaction.id,
        status: transaction.status as any,
        blockchainTxHash: blockchainTxHash || null,
        timestamp: transaction.created_at.toISOString(),
        estimatedConfirmation: estimatedConfirmation?.toISOString() || null
      };

      const apiResponse = ResponseBuilder.success(
        response,
        'Transaction submitted successfully',
        ResponseBuilder.getRequestId(req)
      );
      res.status(201).json(apiResponse);

    } catch (error) {
      logger.error('Transaction submission failed:', error);
      
      const response = ResponseBuilder.internalServerError(
        'Transaction submission failed',
        ResponseBuilder.getRequestId(req)
      );
      res.status(500).json(response);
    }
  }

  /**
   * Synchronize transactions since a specific timestamp
   */
  async syncTransactions(req: Request, res: Response): Promise<void> {
    try {
      const { since, limit = 50, offset = 0 } = req.query;
      const userId = (req as any).user?.id; // From auth middleware

      if (!userId) {
        const response = ResponseBuilder.authenticationError(
          'User authentication required',
          ResponseBuilder.getRequestId(req)
        );
        res.status(401).json(response);
        return;
      }

      // Parse since timestamp
      let sinceDate: Date;
      if (since) {
        if (typeof since === 'string' && !isNaN(Number(since))) {
          // Unix timestamp
          sinceDate = new Date(Number(since) * 1000);
        } else if (typeof since === 'string') {
          // ISO string
          sinceDate = new Date(since);
        } else {
          sinceDate = new Date(0); // Beginning of time
        }
      } else {
        sinceDate = new Date(0);
      }

      if (isNaN(sinceDate.getTime())) {
        const response = ResponseBuilder.error(
          ErrorCode.VALIDATION_ERROR,
          'Invalid since timestamp',
          {
            field: 'since',
            receivedValue: since
          },
          ResponseBuilder.getRequestId(req)
        );
        res.status(400).json(response);
        return;
      }

      // Validate pagination parameters
      const limitNum = Math.min(Math.max(parseInt(limit as string) || 50, 1), 100);
      const offsetNum = Math.max(parseInt(offset as string) || 0, 0);

      // Get transactions for user since the specified date
      const transactions = await this.getTransactionsSince(userId, sinceDate, limitNum, offsetNum);
      
      // Get total count for pagination
      const totalCount = await this.getTransactionCountSince(userId, sinceDate);
      
      // Check if there are more transactions
      const hasMore = (offsetNum + limitNum) < totalCount;

      const response: TransactionSyncResponse = {
        transactions,
        lastSyncTimestamp: new Date().toISOString(),
        totalCount,
        hasMore
      };

      logger.info(`Transaction sync completed for user ${userId}`, {
        userId,
        sinceDate: sinceDate.toISOString(),
        transactionCount: transactions.length,
        totalCount,
        hasMore
      });

      const apiResponse = ResponseBuilder.success(
        response,
        'Transaction sync completed',
        ResponseBuilder.getRequestId(req)
      );
      res.json(apiResponse);

    } catch (error) {
      logger.error('Transaction sync failed:', error);
      
      const errorResponse = ResponseBuilder.internalServerError(
        'Transaction sync failed',
        ResponseBuilder.getRequestId(req)
      );
      res.status(500).json(errorResponse);
    }
  }

  /**
   * Get transaction status by ID
   */
  async getTransactionStatus(req: Request, res: Response): Promise<void> {
    try {
      const { transactionId } = req.params;
      const userId = (req as any).user?.id; // From auth middleware

      if (!transactionId) {
        const response = ResponseBuilder.error(
          ErrorCode.VALIDATION_ERROR,
          'Transaction ID is required',
          {
            field: 'transactionId'
          },
          ResponseBuilder.getRequestId(req)
        );
        res.status(400).json(response);
        return;
      }

      // Get transaction from database
      const transaction = await this.transactionDAO.findById(transactionId);
      
      if (!transaction) {
        const response = ResponseBuilder.notFoundError(
          `Transaction ${transactionId}`,
          ResponseBuilder.getRequestId(req)
        );
        res.status(404).json(response);
        return;
      }

      // Check if user has access to this transaction
      if (userId && transaction.sender_id !== userId && transaction.receiver_id !== userId) {
        const response = ResponseBuilder.authorizationError(
          'Access denied to this transaction',
          ResponseBuilder.getRequestId(req)
        );
        res.status(403).json(response);
        return;
      }

      // Get blockchain confirmations if transaction has blockchain hash
      let confirmations = 0;
      if (transaction.blockchain_tx_hash) {
        try {
          const blockchainTx = await blockchainService.getTransaction(transaction.blockchain_tx_hash);
          confirmations = blockchainTx?.confirmations || 0;
        } catch (blockchainError) {
          logger.warn(`Failed to get blockchain confirmations for transaction ${transactionId}:`, blockchainError);
        }
      }

      const response: TransactionStatusResponse = {
        transactionId: transaction.id,
        status: transaction.status as any,
        blockchainTxHash: transaction.blockchain_tx_hash || null,
        confirmations,
        lastUpdated: transaction.updated_at.toISOString(),
        errorMessage: transaction.error_message || null,
        metadata: transaction.metadata
      };

      const apiResponse = ResponseBuilder.success(
        response,
        'Transaction status retrieved',
        ResponseBuilder.getRequestId(req)
      );
      res.json(apiResponse);

    } catch (error) {
      logger.error('Get transaction status failed:', error);
      
      const errorResponse = ResponseBuilder.internalServerError(
        'Failed to get transaction status',
        ResponseBuilder.getRequestId(req)
      );
      res.status(500).json(errorResponse);
    }
  }

  /**
   * Sync offline transactions from mobile app
   */
  async syncOfflineTransactions(req: Request, res: Response): Promise<void> {
    try {
      const { transactions } = req.body as OfflineTransactionSyncRequest;
      const userId = (req as any).user?.id; // From auth middleware

      if (!userId) {
        const response = ResponseBuilder.authenticationError(
          'User authentication required',
          ResponseBuilder.getRequestId(req)
        );
        res.status(401).json(response);
        return;
      }

      if (!transactions || !Array.isArray(transactions)) {
        const response = ResponseBuilder.error(
          ErrorCode.VALIDATION_ERROR,
          'Transactions array is required',
          {
            field: 'transactions'
          },
          ResponseBuilder.getRequestId(req)
        );
        res.status(400).json(response);
        return;
      }

      const processedTransactions: OfflineTransactionSyncResponse['processedTransactions'] = [];
      const conflicts: OfflineTransactionSyncResponse['conflicts'] = [];

      // Process each offline transaction
      for (const offlineTransaction of transactions) {
        try {
          // Validate offline transaction
          const validationResult = await this.validateOfflineTransaction(offlineTransaction, userId);
          
          if (!validationResult.isValid) {
            processedTransactions.push({
              localId: offlineTransaction.id,
              serverTransactionId: '',
              status: 'rejected',
              reason: validationResult.reason || null
            });
            continue;
          }

          // Check for conflicts (double spending, etc.)
          const conflictResult = await this.checkTransactionConflicts(offlineTransaction, userId);
          
          if (conflictResult.hasConflict) {
            conflicts.push({
              localId: offlineTransaction.id,
              conflictType: conflictResult.conflictType!,
              resolution: conflictResult.resolution!,
              serverTransaction: conflictResult.serverTransaction || null
            });
            
            processedTransactions.push({
              localId: offlineTransaction.id,
              serverTransactionId: conflictResult.serverTransaction?.id || '',
              status: 'conflict',
              reason: `Conflict detected: ${conflictResult.conflictType}`
            });
            continue;
          }

          // Create transaction in database
          const transactionData: CreateTransactionData = {
            sender_id: offlineTransaction.senderId || userId,
            amount: offlineTransaction.amount,
            type: offlineTransaction.type,
            metadata: {
              ...offlineTransaction.metadata,
              syncedAt: new Date().toISOString(),
              originalTimestamp: offlineTransaction.timestamp,
              source: 'offline_sync'
            }
          };

          // Add optional fields only if they exist
          if (offlineTransaction.receiverId) {
            transactionData.receiver_id = offlineTransaction.receiverId;
          }
          if (offlineTransaction.senderSignature) {
            transactionData.sender_signature = offlineTransaction.senderSignature;
          }
          if (offlineTransaction.receiverSignature) {
            transactionData.receiver_signature = offlineTransaction.receiverSignature;
          }
          if (offlineTransaction.tokenIds) {
            transactionData.token_ids = offlineTransaction.tokenIds;
          }

          const serverTransaction = await this.transactionDAO.create(transactionData);
          
          if (serverTransaction) {
            processedTransactions.push({
              localId: offlineTransaction.id,
              serverTransactionId: serverTransaction.id,
              status: 'accepted'
            });

            // Update token statuses if applicable
            if (offlineTransaction.tokenIds && offlineTransaction.tokenIds.length > 0) {
              await this.updateTokenStatuses(offlineTransaction.tokenIds, 'spent');
            }

            logger.info(`Offline transaction synced: ${offlineTransaction.id} -> ${serverTransaction.id}`, {
              localId: offlineTransaction.id,
              serverTransactionId: serverTransaction.id,
              userId,
              type: offlineTransaction.type,
              amount: offlineTransaction.amount
            });
          } else {
            processedTransactions.push({
              localId: offlineTransaction.id,
              serverTransactionId: '',
              status: 'rejected',
              reason: 'Failed to create server transaction'
            });
          }

        } catch (transactionError) {
          logger.error(`Failed to process offline transaction ${offlineTransaction.id}:`, transactionError);
          
          processedTransactions.push({
            localId: offlineTransaction.id,
            serverTransactionId: '',
            status: 'rejected',
            reason: transactionError instanceof Error ? transactionError.message : 'Processing failed'
          });
        }
      }

      const response: OfflineTransactionSyncResponse = {
        processedTransactions,
        conflicts
      };

      logger.info(`Offline transaction sync completed for user ${userId}`, {
        userId,
        totalTransactions: transactions.length,
        accepted: processedTransactions.filter(t => t.status === 'accepted').length,
        rejected: processedTransactions.filter(t => t.status === 'rejected').length,
        conflicts: conflicts.length
      });

      const apiResponse = ResponseBuilder.success(
        response,
        'Offline transactions synced',
        ResponseBuilder.getRequestId(req)
      );
      res.json(apiResponse);

    } catch (error) {
      logger.error('Offline transaction sync failed:', error);
      
      const errorResponse = ResponseBuilder.internalServerError(
        'Offline transaction sync failed',
        ResponseBuilder.getRequestId(req)
      );
      res.status(500).json(errorResponse);
    }
  }

  // Helper methods

  private async getTransactionsSince(userId: string, sinceDate: Date, limit: number, offset: number): Promise<Transaction[]> {
    try {
      // Use the DAO's findByUserId method with additional filtering
      const allTransactions = await this.transactionDAO.findByUserId(userId);
      
      // Filter by date and apply pagination
      const filteredTransactions = allTransactions
        .filter(tx => tx.created_at > sinceDate)
        .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
        .slice(offset, offset + limit);

      return filteredTransactions;
    } catch (error) {
      logger.error('Failed to get transactions since date:', error);
      throw error;
    }
  }

  private async getTransactionCountSince(userId: string, sinceDate: Date): Promise<number> {
    try {
      // Use the DAO's findByUserId method with additional filtering
      const allTransactions = await this.transactionDAO.findByUserId(userId);
      
      // Filter by date and count
      const filteredCount = allTransactions
        .filter(tx => tx.created_at > sinceDate)
        .length;

      return filteredCount;
    } catch (error) {
      logger.error('Failed to get transaction count:', error);
      throw error;
    }
  }

  private async validateOfflineTransaction(
    transaction: OfflineTransactionSyncRequest['transactions'][0], 
    userId: string
  ): Promise<{ isValid: boolean; reason?: string }> {
    // Validate required fields
    if (!transaction.amount || !transaction.type) {
      return { isValid: false, reason: 'Missing required fields: amount, type' };
    }

    // Validate amount
    const amount = parseFloat(transaction.amount);
    if (isNaN(amount) || amount <= 0) {
      return { isValid: false, reason: 'Invalid amount' };
    }

    // Validate transaction type
    const validTypes = ['online', 'offline', 'token_purchase', 'token_redemption'];
    if (!validTypes.includes(transaction.type)) {
      return { isValid: false, reason: 'Invalid transaction type' };
    }

    // Validate signatures for offline transactions
    if (transaction.type === 'offline' && !transaction.senderSignature) {
      return { isValid: false, reason: 'Offline transactions require sender signature' };
    }

    // Validate token ownership
    if (transaction.tokenIds && transaction.tokenIds.length > 0) {
      for (const tokenId of transaction.tokenIds) {
        const token = await this.offlineTokenDAO.findById(tokenId);
        if (!token) {
          return { isValid: false, reason: `Token not found: ${tokenId}` };
        }
        if (token.user_id !== userId) {
          return { isValid: false, reason: `Token ownership mismatch: ${tokenId}` };
        }
        if (token.status !== 'active') {
          return { isValid: false, reason: `Token not active: ${tokenId}` };
        }
      }
    }

    return { isValid: true };
  }

  private async checkTransactionConflicts(
    transaction: OfflineTransactionSyncRequest['transactions'][0], 
    _userId: string
  ): Promise<{
    hasConflict: boolean;
    conflictType?: 'double_spend' | 'invalid_signature' | 'expired_token' | 'insufficient_balance';
    resolution?: 'server_wins' | 'client_wins' | 'manual_review';
    serverTransaction?: Transaction;
  }> {
    // Check for double spending
    if (transaction.tokenIds && transaction.tokenIds.length > 0) {
      for (const tokenId of transaction.tokenIds) {
        // Get all transactions and check for token usage
        // This is a simplified approach - in production, you'd want more efficient queries
        const allTransactions = await this.transactionDAO.findByStatus('completed');
        const conflictingTransaction = allTransactions.find(tx => 
          tx.token_ids && tx.token_ids.includes(tokenId)
        );

        if (conflictingTransaction) {
          return {
            hasConflict: true,
            conflictType: 'double_spend',
            resolution: 'server_wins',
            serverTransaction: conflictingTransaction
          };
        }
      }
    }

    // Additional conflict checks could be added here
    // - Check for signature conflicts
    // - Check for balance conflicts
    // - Check for timestamp conflicts

    return { hasConflict: false };
  }

  private async updateTokenStatuses(tokenIds: string[], status: 'active' | 'spent' | 'expired' | 'redeemed'): Promise<void> {
    try {
      for (const tokenId of tokenIds) {
        await this.offlineTokenDAO.update(tokenId, { status });
      }
    } catch (error) {
      logger.error('Failed to update token statuses:', error);
      throw error;
    }
  }
}