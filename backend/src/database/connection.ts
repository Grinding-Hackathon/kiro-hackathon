import knex, { Knex } from 'knex';
import { config } from '../config/config';
import knexConfig from '../knexfile';

class DatabaseConnection {
  private static instance: DatabaseConnection;
  private _knex: Knex;

  private constructor() {
    const environment = config.env || 'development';
    const dbConfig = knexConfig[environment];
    if (!dbConfig) {
      throw new Error(`Database configuration not found for environment: ${environment}`);
    }
    this._knex = knex(dbConfig);
  }

  public static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  public get knex(): Knex {
    return this._knex;
  }

  public async testConnection(): Promise<boolean> {
    try {
      await this._knex.raw('SELECT 1');
      return true;
    } catch (error) {
      console.error('Database connection failed:', error);
      return false;
    }
  }

  public async close(): Promise<void> {
    await this._knex.destroy();
  }
}

export const db = DatabaseConnection.getInstance().knex;
export default DatabaseConnection;