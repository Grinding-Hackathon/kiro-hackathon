import { BaseDAO } from './BaseDAO';
import { OfflineToken, CreateOfflineTokenData, UpdateOfflineTokenData } from '../../models/OfflineToken';

export class OfflineTokenDAO extends BaseDAO<OfflineToken, CreateOfflineTokenData, UpdateOfflineTokenData> {
  constructor() {
    super('offline_tokens');
  }

  async findByUserId(userId: string, status?: string): Promise<OfflineToken[]> {
    try {
      let query = this.knex(this.tableName)
        .where({ user_id: userId });
      
      if (status) {
        query = query.where({ status });
      }
      
      return await query.orderBy('created_at', 'desc');
    } catch (error) {
      throw new Error(`Error finding tokens by user ID: ${error}`);
    }
  }

  async findActiveTokensByUserId(userId: string): Promise<OfflineToken[]> {
    try {
      return await this.knex(this.tableName)
        .where({ 
          user_id: userId, 
          status: 'active' 
        })
        .where('expires_at', '>', new Date())
        .orderBy('expires_at', 'asc');
    } catch (error) {
      throw new Error(`Error finding active tokens by user ID: ${error}`);
    }
  }

  async findExpiredTokens(): Promise<OfflineToken[]> {
    try {
      return await this.knex(this.tableName)
        .where({ status: 'active' })
        .where('expires_at', '<=', new Date());
    } catch (error) {
      throw new Error(`Error finding expired tokens: ${error}`);
    }
  }

  async markAsSpent(id: string): Promise<OfflineToken | null> {
    try {
      return await this.update(id, {
        status: 'spent',
        spent_at: new Date(),
      });
    } catch (error) {
      throw new Error(`Error marking token as spent: ${error}`);
    }
  }

  async markAsRedeemed(id: string): Promise<OfflineToken | null> {
    try {
      return await this.update(id, {
        status: 'redeemed',
        redeemed_at: new Date(),
      });
    } catch (error) {
      throw new Error(`Error marking token as redeemed: ${error}`);
    }
  }

  async markAsExpired(id: string): Promise<OfflineToken | null> {
    try {
      return await this.update(id, {
        status: 'expired',
      });
    } catch (error) {
      throw new Error(`Error marking token as expired: ${error}`);
    }
  }

  async getUserTokenBalance(userId: string): Promise<string> {
    try {
      const result = await this.knex(this.tableName)
        .where({ 
          user_id: userId, 
          status: 'active' 
        })
        .where('expires_at', '>', new Date())
        .sum('amount as total')
        .first();
      
      return result?.['total'] || '0';
    } catch (error) {
      throw new Error(`Error calculating user token balance: ${error}`);
    }
  }

  async getTokensByIds(tokenIds: string[]): Promise<OfflineToken[]> {
    try {
      return await this.knex(this.tableName)
        .whereIn('id', tokenIds);
    } catch (error) {
      throw new Error(`Error finding tokens by IDs: ${error}`);
    }
  }
}