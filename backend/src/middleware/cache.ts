import { Request, Response, NextFunction } from 'express';
import { cacheService } from '../services/cacheService';
import { logger } from '../utils/logger';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  keyGenerator?: (req: Request) => string;
  condition?: (_req: Request, res: Response) => boolean;
  skipCache?: (req: Request) => boolean;
}

export const cache = (options: CacheOptions = {}) => {
  const {
    ttl = 300, // 5 minutes default
    keyGenerator = (req: Request) => `cache:${req.method}:${req.originalUrl}`,
    condition = (_req: Request, res: Response) => res.statusCode === 200,
    skipCache = () => false
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip caching if condition is met
    if (skipCache(req)) {
      return next();
    }

    const cacheKey = keyGenerator(req);

    try {
      // Try to get from cache
      const cachedData = await cacheService.get(cacheKey);
      
      if (cachedData) {
        logger.debug(`Cache hit for key: ${cacheKey}`);
        return res.json(cachedData);
      }

      logger.debug(`Cache miss for key: ${cacheKey}`);

      // Store original json method
      const originalJson = res.json.bind(res);

      // Override json method to cache response
      res.json = function(data: any) {
        // Only cache if condition is met
        if (condition(req, res)) {
          cacheService.set(cacheKey, data, ttl).catch(error => {
            logger.error(`Failed to cache data for key ${cacheKey}:`, error);
          });
        }

        return originalJson(data);
      };

      next();
    } catch (error) {
      logger.error(`Cache middleware error for key ${cacheKey}:`, error);
      next();
    }
  };
};

// Specific cache middleware for public keys
export const publicKeyCache = cache({
  ttl: 3600, // 1 hour
  keyGenerator: (req: Request) => `public_keys:${req.params['userId'] || 'all'}`,
  condition: (_req: Request, res: Response) => res.statusCode === 200
});

// Cache middleware for wallet balances
export const walletBalanceCache = cache({
  ttl: 60, // 1 minute for balance data
  keyGenerator: (req: Request) => `wallet_balance:${req.params['walletId'] || (req as any).user?.id}`,
  condition: (_req: Request, res: Response) => res.statusCode === 200,
  skipCache: (req: Request) => req.query['skipCache'] === 'true'
});

// Cache middleware for transaction history
export const transactionHistoryCache = cache({
  ttl: 300, // 5 minutes
  keyGenerator: (req: Request) => {
    const { page = 1, limit = 10, type, status } = req.query;
    return `transaction_history:${(req as any).user?.id}:${page}:${limit}:${type || 'all'}:${status || 'all'}`;
  },
  condition: (_req: Request, res: Response) => res.statusCode === 200
});

// Cache invalidation helpers
export class CacheInvalidator {
  static async invalidateUserCache(userId: string): Promise<void> {
    try {
      await cacheService.deletePattern(`*:${userId}:*`);
      await cacheService.deletePattern(`public_keys:${userId}`);
      await cacheService.deletePattern(`wallet_balance:${userId}`);
      logger.info(`Invalidated cache for user: ${userId}`);
    } catch (error) {
      logger.error(`Failed to invalidate cache for user ${userId}:`, error);
    }
  }

  static async invalidatePublicKeyCache(): Promise<void> {
    try {
      await cacheService.deletePattern('public_keys:*');
      logger.info('Invalidated public key cache');
    } catch (error) {
      logger.error('Failed to invalidate public key cache:', error);
    }
  }

  static async invalidateWalletCache(walletId: string): Promise<void> {
    try {
      await cacheService.deletePattern(`wallet_balance:${walletId}`);
      await cacheService.deletePattern(`transaction_history:${walletId}:*`);
      logger.info(`Invalidated wallet cache for: ${walletId}`);
    } catch (error) {
      logger.error(`Failed to invalidate wallet cache for ${walletId}:`, error);
    }
  }

  static async invalidateTransactionCache(userId: string): Promise<void> {
    try {
      await cacheService.deletePattern(`transaction_history:${userId}:*`);
      logger.info(`Invalidated transaction cache for user: ${userId}`);
    } catch (error) {
      logger.error(`Failed to invalidate transaction cache for user ${userId}:`, error);
    }
  }
}

// Cache warming functions
export class CacheWarmer {
  static async warmPublicKeyCache(): Promise<void> {
    try {
      // This would typically fetch and cache frequently accessed public keys
      logger.info('Starting public key cache warming');
      // Implementation would depend on your specific public key fetching logic
    } catch (error) {
      logger.error('Failed to warm public key cache:', error);
    }
  }

  static async warmUserBalanceCache(userId: string): Promise<void> {
    try {
      logger.info(`Warming balance cache for user: ${userId}`);
      // Implementation would fetch and cache user balance
    } catch (error) {
      logger.error(`Failed to warm balance cache for user ${userId}:`, error);
    }
  }
}