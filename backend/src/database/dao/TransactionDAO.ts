import { BaseDAO } from './BaseDAO';
import { Transaction, CreateTransactionData, UpdateTransactionData } from '../../models/Transaction';

export class TransactionDAO extends BaseDAO<Transaction, CreateTransactionData, UpdateTransactionData> {
  constructor() {
    super('transactions');
  }

  async findByUserId(userId: string, limit?: number, offset?: number): Promise<Transaction[]> {
    try {
      let query = this.knex(this.tableName)
        .where('sender_id', userId)
        .orWhere('receiver_id', userId)
        .orderBy('created_at', 'desc');
      
      if (limit) {
        query = query.limit(limit);
      }
      
      if (offset) {
        query = query.offset(offset);
      }
      
      return await query;
    } catch (error) {
      throw new Error(`Error finding transactions by user ID: ${error}`);
    }
  }

  async findBySenderId(senderId: string): Promise<Transaction[]> {
    try {
      return await this.knex(this.tableName)
        .where({ sender_id: senderId })
        .orderBy('created_at', 'desc');
    } catch (error) {
      throw new Error(`Error finding transactions by sender ID: ${error}`);
    }
  }

  async findByReceiverId(receiverId: string): Promise<Transaction[]> {
    try {
      return await this.knex(this.tableName)
        .where({ receiver_id: receiverId })
        .orderBy('created_at', 'desc');
    } catch (error) {
      throw new Error(`Error finding transactions by receiver ID: ${error}`);
    }
  }

  async findByType(type: string): Promise<Transaction[]> {
    try {
      return await this.knex(this.tableName)
        .where({ type })
        .orderBy('created_at', 'desc');
    } catch (error) {
      throw new Error(`Error finding transactions by type: ${error}`);
    }
  }

  async findByStatus(status: string): Promise<Transaction[]> {
    try {
      return await this.knex(this.tableName)
        .where({ status })
        .orderBy('created_at', 'desc');
    } catch (error) {
      throw new Error(`Error finding transactions by status: ${error}`);
    }
  }

  async findByBlockchainTxHash(txHash: string): Promise<Transaction | null> {
    try {
      const result = await this.knex(this.tableName)
        .where({ blockchain_tx_hash: txHash })
        .first();
      return result || null;
    } catch (error) {
      throw new Error(`Error finding transaction by blockchain hash: ${error}`);
    }
  }

  async findPendingTransactions(): Promise<Transaction[]> {
    try {
      return await this.knex(this.tableName)
        .where({ status: 'pending' })
        .orderBy('created_at', 'asc');
    } catch (error) {
      throw new Error(`Error finding pending transactions: ${error}`);
    }
  }

  async markAsCompleted(id: string, blockchainTxHash?: string): Promise<Transaction | null> {
    try {
      const updateData: UpdateTransactionData = {
        status: 'completed',
        completed_at: new Date(),
      };
      
      if (blockchainTxHash) {
        updateData.blockchain_tx_hash = blockchainTxHash;
      }
      
      return await this.update(id, updateData);
    } catch (error) {
      throw new Error(`Error marking transaction as completed: ${error}`);
    }
  }

  async markAsFailed(id: string, errorMessage: string): Promise<Transaction | null> {
    try {
      return await this.update(id, {
        status: 'failed',
        error_message: errorMessage,
      });
    } catch (error) {
      throw new Error(`Error marking transaction as failed: ${error}`);
    }
  }

  async getTransactionStats(userId?: string): Promise<any> {
    try {
      let query = this.knex(this.tableName);
      
      if (userId) {
        query = query.where('sender_id', userId).orWhere('receiver_id', userId);
      }
      
      const stats = await query
        .select('status')
        .count('* as count')
        .sum('amount as total_amount')
        .groupBy('status');
      
      return stats;
    } catch (error) {
      throw new Error(`Error getting transaction stats: ${error}`);
    }
  }
}