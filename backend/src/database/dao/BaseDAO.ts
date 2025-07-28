import { Knex } from 'knex';
import { db } from '../connection';

export abstract class BaseDAO<T, CreateData, UpdateData> {
  protected tableName: string;
  protected knex: Knex;

  constructor(tableName: string) {
    this.tableName = tableName;
    this.knex = db;
  }

  async findById(id: string): Promise<T | null> {
    try {
      const result = await this.knex(this.tableName)
        .where({ id })
        .first();
      return result || null;
    } catch (error) {
      throw new Error(`Error finding ${this.tableName} by id: ${error}`);
    }
  }

  async findAll(limit?: number, offset?: number): Promise<T[]> {
    try {
      let query = this.knex(this.tableName);
      
      if (limit) {
        query = query.limit(limit);
      }
      
      if (offset) {
        query = query.offset(offset);
      }
      
      return await query;
    } catch (error) {
      throw new Error(`Error finding all ${this.tableName}: ${error}`);
    }
  }

  async create(data: CreateData): Promise<T> {
    try {
      const [result] = await this.knex(this.tableName)
        .insert({
          ...data,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning('*');
      return result;
    } catch (error) {
      throw new Error(`Error creating ${this.tableName}: ${error}`);
    }
  }

  async update(id: string, data: UpdateData): Promise<T | null> {
    try {
      const [result] = await this.knex(this.tableName)
        .where({ id })
        .update({
          ...data,
          updated_at: new Date(),
        })
        .returning('*');
      return result || null;
    } catch (error) {
      throw new Error(`Error updating ${this.tableName}: ${error}`);
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const deletedRows = await this.knex(this.tableName)
        .where({ id })
        .del();
      return deletedRows > 0;
    } catch (error) {
      throw new Error(`Error deleting ${this.tableName}: ${error}`);
    }
  }

  async count(): Promise<number> {
    try {
      const result = await this.knex(this.tableName)
        .count('* as count')
        .first();
      return parseInt(result?.['count'] as string) || 0;
    } catch (error) {
      throw new Error(`Error counting ${this.tableName}: ${error}`);
    }
  }
}