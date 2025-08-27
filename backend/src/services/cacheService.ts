import { createClient, RedisClientType } from 'redis';
import { logger } from '../utils/logger';
import { config } from '../config/config';

export interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
}

export class CacheService {
  private client: RedisClientType;
  private isConnected: boolean = false;
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0
  };

  constructor() {
    this.client = createClient({
      url: `redis://:${config.redis.password}@${config.redis.host}:${config.redis.port}`,
      socket: {
        connectTimeout: 5000
      }
    });

    this.client.on('error', (err) => {
      logger.error('Redis Client Error:', err);
      this.metrics.errors++;
      this.isConnected = false;
    });

    this.client.on('connect', () => {
      logger.info('Redis Client Connected');
      this.isConnected = true;
    });

    this.client.on('disconnect', () => {
      logger.warn('Redis Client Disconnected');
      this.isConnected = false;
    });
  }

  async connect(): Promise<void> {
    try {
      if (!this.isConnected) {
        await this.client.connect();
      }
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      this.metrics.errors++;
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.isConnected) {
        await this.client.disconnect();
      }
    } catch (error) {
      logger.error('Failed to disconnect from Redis:', error);
      this.metrics.errors++;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      const value = await this.client.get(key);
      if (value) {
        this.metrics.hits++;
        return JSON.parse(value) as T;
      } else {
        this.metrics.misses++;
        return null;
      }
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error);
      this.metrics.errors++;
      this.metrics.misses++;
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      const serializedValue = JSON.stringify(value);
      
      if (ttlSeconds) {
        await this.client.setEx(key, ttlSeconds, serializedValue);
      } else {
        await this.client.set(key, serializedValue);
      }

      this.metrics.sets++;
      return true;
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error);
      this.metrics.errors++;
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      const result = await this.client.del(key);
      this.metrics.deletes++;
      return result > 0;
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error);
      this.metrics.errors++;
      return false;
    }
  }

  async deletePattern(pattern: string): Promise<number> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        const result = await this.client.del(keys);
        this.metrics.deletes += keys.length;
        return result;
      }
      return 0;
    } catch (error) {
      logger.error(`Cache delete pattern error for pattern ${pattern}:`, error);
      this.metrics.errors++;
      return 0;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`Cache exists error for key ${key}:`, error);
      this.metrics.errors++;
      return false;
    }
  }

  async setTTL(key: string, ttlSeconds: number): Promise<boolean> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      const result = await this.client.expire(key, ttlSeconds);
      return result === 1;
    } catch (error) {
      logger.error(`Cache setTTL error for key ${key}:`, error);
      this.metrics.errors++;
      return false;
    }
  }

  async getTTL(key: string): Promise<number> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      return await this.client.ttl(key);
    } catch (error) {
      logger.error(`Cache getTTL error for key ${key}:`, error);
      this.metrics.errors++;
      return -1;
    }
  }

  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  resetMetrics(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0
    };
  }

  getHitRate(): number {
    const total = this.metrics.hits + this.metrics.misses;
    return total > 0 ? this.metrics.hits / total : 0;
  }

  isHealthy(): boolean {
    return this.isConnected;
  }
}

// Singleton instance
export const cacheService = new CacheService();