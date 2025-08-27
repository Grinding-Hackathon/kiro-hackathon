import { db } from '../database/connection';
import { logger } from '../utils/logger';

export interface QueryMetrics {
  queryCount: number;
  totalExecutionTime: number;
  averageExecutionTime: number;
  slowQueries: SlowQuery[];
}

export interface SlowQuery {
  query: string;
  executionTime: number;
  timestamp: Date;
  parameters?: any[];
}

export interface PaginationOptions {
  page: number;
  limit: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export class QueryOptimizationService {
  private metrics: QueryMetrics = {
    queryCount: 0,
    totalExecutionTime: 0,
    averageExecutionTime: 0,
    slowQueries: []
  };

  private slowQueryThreshold = 1000; // 1 second

  constructor() {
    this.setupQueryLogging();
  }

  private setupQueryLogging(): void {
    // Add query event listeners for performance monitoring
    db.on('query', () => {
      this.metrics.queryCount++;
    });

    db.on('query-response', (_response: any, queryData: any) => {
      const executionTime = Date.now() - queryData.startTime;
      this.metrics.totalExecutionTime += executionTime;
      this.metrics.averageExecutionTime = this.metrics.totalExecutionTime / this.metrics.queryCount;

      if (executionTime > this.slowQueryThreshold) {
        this.metrics.slowQueries.push({
          query: queryData.sql,
          executionTime,
          timestamp: new Date(),
          parameters: queryData.bindings
        });

        // Keep only last 100 slow queries
        if (this.metrics.slowQueries.length > 100) {
          this.metrics.slowQueries = this.metrics.slowQueries.slice(-100);
        }

        logger.warn(`Slow query detected (${executionTime}ms):`, {
          sql: queryData.sql,
          bindings: queryData.bindings
        });
      }
    });
  }

  // Optimized balance calculation for users
  async getUserBalance(userId: string): Promise<{ blockchain: number; offline: number; pending: number }> {
    const startTime = Date.now();

    try {
      // Use optimized queries with proper indexes
      const [blockchainResult, offlineResult, pendingResult] = await Promise.all([
        // Blockchain balance from completed transactions
        db('transactions')
          .select(
            db.raw(`
              COALESCE(
                SUM(CASE WHEN receiver_id = ? THEN amount ELSE 0 END) - 
                SUM(CASE WHEN sender_id = ? THEN amount ELSE 0 END), 
                0
              ) as balance
            `, [userId, userId])
          )
          .where('status', 'completed')
          .where('type', 'online')
          .first(),

        // Offline token balance
        db('offline_tokens')
          .sum('amount as balance')
          .where('user_id', userId)
          .where('status', 'active')
          .where('expires_at', '>', new Date())
          .first(),

        // Pending transaction balance
        db('transactions')
          .select(
            db.raw(`
              COALESCE(
                SUM(CASE WHEN receiver_id = ? THEN amount ELSE 0 END) - 
                SUM(CASE WHEN sender_id = ? THEN amount ELSE 0 END), 
                0
              ) as balance
            `, [userId, userId])
          )
          .where('status', 'pending')
          .first()
      ]);

      const result = {
        blockchain: parseFloat(blockchainResult?.balance || '0'),
        offline: parseFloat(offlineResult?.['balance'] || '0'),
        pending: parseFloat(pendingResult?.balance || '0')
      };

      logger.debug(`Balance calculation completed in ${Date.now() - startTime}ms for user ${userId}`);
      return result;
    } catch (error) {
      logger.error(`Balance calculation failed for user ${userId}:`, error);
      throw error;
    }
  }

  // Optimized transaction history with efficient pagination
  async getTransactionHistory(
    userId: string,
    options: PaginationOptions & {
      type?: string;
      status?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<PaginatedResult<any>> {
    const {
      page = 1,
      limit = 10,
      orderBy = 'created_at',
      orderDirection = 'desc',
      type,
      status,
      startDate,
      endDate
    } = options;

    const offset = (page - 1) * limit;

    try {
      // Build optimized query with proper indexes
      let query = db('transactions')
        .select([
          'id',
          'sender_id',
          'receiver_id',
          'amount',
          'type',
          'status',
          'blockchain_tx_hash',
          'created_at',
          'completed_at'
        ])
        .where(function() {
          this.where('sender_id', userId).orWhere('receiver_id', userId);
        });

      // Add filters
      if (type) {
        query = query.where('type', type);
      }
      if (status) {
        query = query.where('status', status);
      }
      if (startDate) {
        query = query.where('created_at', '>=', startDate);
      }
      if (endDate) {
        query = query.where('created_at', '<=', endDate);
      }

      // Get total count for pagination
      const countQuery = query.clone().clearSelect().count('* as total');
      const countResult = await countQuery;
      const totalCount = parseInt(countResult[0]?.['total'] as string || '0');

      // Get paginated data
      const data = await query
        .orderBy(orderBy, orderDirection)
        .limit(limit)
        .offset(offset);

      const totalPages = Math.ceil(totalCount / limit);

      return {
        data,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      logger.error(`Transaction history query failed for user ${userId}:`, error);
      throw error;
    }
  }

  // Optimized token queries
  async getActiveTokens(userId: string, limit?: number): Promise<any[]> {
    try {
      let query = db('offline_tokens')
        .select(['id', 'amount', 'signature', 'issued_at', 'expires_at'])
        .where('user_id', userId)
        .where('status', 'active')
        .where('expires_at', '>', new Date())
        .orderBy('issued_at', 'desc');

      if (limit) {
        query = query.limit(limit);
      }

      return await query;
    } catch (error) {
      logger.error(`Active tokens query failed for user ${userId}:`, error);
      throw error;
    }
  }

  // Batch operations for better performance
  async batchUpdateTokenStatus(tokenIds: string[], status: string): Promise<number> {
    try {
      const result = await db('offline_tokens')
        .whereIn('id', tokenIds)
        .update({
          status,
          updated_at: new Date()
        });

      logger.info(`Batch updated ${result} tokens to status: ${status}`);
      return result;
    } catch (error) {
      logger.error(`Batch token update failed:`, error);
      throw error;
    }
  }

  // Connection pool optimization
  async optimizeConnectionPool(): Promise<void> {
    try {
      // Get current pool status
      const pool = (db as any).client.pool;
      
      logger.info('Connection pool status:', {
        size: pool.size,
        available: pool.available,
        borrowed: pool.borrowed,
        pending: pool.pending
      });

      // Adjust pool settings based on load
      const currentLoad = pool.borrowed / pool.size;
      if (currentLoad > 0.8) {
        logger.warn('High connection pool utilization detected:', currentLoad);
      }
    } catch (error) {
      logger.error('Failed to check connection pool status:', error);
    }
  }

  // Query analysis and optimization suggestions
  async analyzeQueryPerformance(): Promise<{
    totalQueries: number;
    averageTime: number;
    slowQueries: number;
    recommendations: string[];
  }> {
    const recommendations: string[] = [];

    if (this.metrics.averageExecutionTime > 500) {
      recommendations.push('Consider adding more database indexes for frequently queried columns');
    }

    if (this.metrics.slowQueries.length > 10) {
      recommendations.push('Multiple slow queries detected - review query optimization');
    }

    const slowQueryRate = this.metrics.slowQueries.length / this.metrics.queryCount;
    if (slowQueryRate > 0.1) {
      recommendations.push('High slow query rate - consider query refactoring');
    }

    return {
      totalQueries: this.metrics.queryCount,
      averageTime: this.metrics.averageExecutionTime,
      slowQueries: this.metrics.slowQueries.length,
      recommendations
    };
  }

  // Database maintenance operations
  async performMaintenance(): Promise<void> {
    try {
      logger.info('Starting database maintenance operations');

      // Update table statistics
      await db.raw('ANALYZE');

      // Clean up expired tokens
      const expiredTokens = await db('offline_tokens')
        .where('status', 'active')
        .where('expires_at', '<', new Date())
        .update({ status: 'expired', updated_at: new Date() });

      logger.info(`Marked ${expiredTokens} tokens as expired`);

      // Vacuum analyze for PostgreSQL
      if (db.client.config.client === 'postgresql') {
        await db.raw('VACUUM ANALYZE');
      }

      logger.info('Database maintenance completed');
    } catch (error) {
      logger.error('Database maintenance failed:', error);
      throw error;
    }
  }

  getMetrics(): QueryMetrics {
    return { ...this.metrics };
  }

  resetMetrics(): void {
    this.metrics = {
      queryCount: 0,
      totalExecutionTime: 0,
      averageExecutionTime: 0,
      slowQueries: []
    };
  }

  setSlowQueryThreshold(milliseconds: number): void {
    this.slowQueryThreshold = milliseconds;
  }
}

// Singleton instance
export const queryOptimizationService = new QueryOptimizationService();