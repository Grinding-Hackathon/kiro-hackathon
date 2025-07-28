import DatabaseConnection from './connection';
import { logger } from '../utils/logger';

export async function initializeDatabase(): Promise<void> {
  try {
    const dbConnection = DatabaseConnection.getInstance();
    
    // Test database connection
    const isConnected = await dbConnection.testConnection();
    if (!isConnected) {
      throw new Error('Failed to connect to database');
    }
    
    logger.info('Database connection established successfully');
    
    // Run migrations
    await dbConnection.knex.migrate.latest();
    logger.info('Database migrations completed successfully');
    
  } catch (error) {
    logger.error('Database initialization failed:', error);
    throw error;
  }
}

export async function closeDatabase(): Promise<void> {
  try {
    const dbConnection = DatabaseConnection.getInstance();
    await dbConnection.close();
    logger.info('Database connection closed');
  } catch (error) {
    logger.error('Error closing database connection:', error);
    throw error;
  }
}