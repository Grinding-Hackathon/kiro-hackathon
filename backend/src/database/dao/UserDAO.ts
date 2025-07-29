import { BaseDAO } from './BaseDAO';
import { User, CreateUserData, UpdateUserData } from '../../models/User';

export class UserDAO extends BaseDAO<User, CreateUserData, UpdateUserData> {
  constructor() {
    super('users');
  }

  async findByWalletAddress(walletAddress: string): Promise<User | null> {
    try {
      const result = await this.knex(this.tableName)
        .where({ wallet_address: walletAddress })
        .first();
      return result || null;
    } catch (error) {
      throw new Error(`Error finding user by wallet address: ${error}`);
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    try {
      const result = await this.knex(this.tableName)
        .where({ email })
        .first();
      return result || null;
    } catch (error) {
      throw new Error(`Error finding user by email: ${error}`);
    }
  }

  async findActiveUsers(): Promise<User[]> {
    try {
      return await this.knex(this.tableName)
        .where({ is_active: true })
        .orderBy('created_at', 'desc');
    } catch (error) {
      throw new Error(`Error finding active users: ${error}`);
    }
  }

  async updateLastActivity(id: string): Promise<void> {
    try {
      await this.knex(this.tableName)
        .where({ id })
        .update({ updated_at: new Date() });
    } catch (error) {
      throw new Error(`Error updating user last activity: ${error}`);
    }
  }

  async deactivateUser(id: string): Promise<User | null> {
    try {
      return await this.update(id, { is_active: false });
    } catch (error) {
      throw new Error(`Error deactivating user: ${error}`);
    }
  }
}