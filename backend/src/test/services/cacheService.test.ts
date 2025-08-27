import { CacheService } from '../../services/cacheService';

// Mock Redis client
const mockRedisClient = {
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  get: jest.fn(),
  set: jest.fn().mockResolvedValue('OK'),
  setEx: jest.fn().mockResolvedValue('OK'),
  del: jest.fn(),
  keys: jest.fn(),
  exists: jest.fn(),
  expire: jest.fn(),
  ttl: jest.fn(),
  on: jest.fn()
};

jest.mock('redis', () => ({
  createClient: jest.fn(() => mockRedisClient)
}));

describe('CacheService', () => {
  let cacheService: CacheService;

  beforeEach(() => {
    jest.clearAllMocks();
    cacheService = new CacheService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('connect', () => {
    it('should connect to Redis successfully', async () => {
      await cacheService.connect();
      expect(mockRedisClient.connect).toHaveBeenCalled();
    });

    it('should handle connection errors', async () => {
      const error = new Error('Connection failed');
      mockRedisClient.connect.mockRejectedValue(error);

      await expect(cacheService.connect()).rejects.toThrow('Connection failed');
      expect(cacheService.getMetrics().errors).toBe(1);
    });
  });

  describe('get', () => {
    it('should return cached data when key exists', async () => {
      const testData = { id: 1, name: 'test' };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(testData));

      const result = await cacheService.get('test-key');

      expect(result).toEqual(testData);
      expect(mockRedisClient.get).toHaveBeenCalledWith('test-key');
      expect(cacheService.getMetrics().hits).toBe(1);
    });

    it('should return null when key does not exist', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await cacheService.get('non-existent-key');

      expect(result).toBeNull();
      expect(cacheService.getMetrics().misses).toBe(1);
    });

    it('should handle get errors gracefully', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Redis error'));

      const result = await cacheService.get('error-key');

      expect(result).toBeNull();
      expect(cacheService.getMetrics().errors).toBe(1);
      expect(cacheService.getMetrics().misses).toBe(1);
    });
  });

  describe('set', () => {
    it('should set data without TTL', async () => {
      const testData = { id: 1, name: 'test' };

      const result = await cacheService.set('test-key', testData);

      expect(result).toBe(true);
      expect(mockRedisClient.set).toHaveBeenCalledWith('test-key', JSON.stringify(testData));
      expect(cacheService.getMetrics().sets).toBe(1);
    });

    it('should set data with TTL', async () => {
      const testData = { id: 1, name: 'test' };
      const ttl = 300;

      const result = await cacheService.set('test-key', testData, ttl);

      expect(result).toBe(true);
      expect(mockRedisClient.setEx).toHaveBeenCalledWith('test-key', ttl, JSON.stringify(testData));
      expect(cacheService.getMetrics().sets).toBe(1);
    });

    it('should handle set errors gracefully', async () => {
      mockRedisClient.set.mockRejectedValue(new Error('Redis error'));

      const result = await cacheService.set('error-key', { test: 'data' });

      expect(result).toBe(false);
      expect(cacheService.getMetrics().errors).toBe(1);
    });
  });

  describe('delete', () => {
    it('should delete existing key', async () => {
      mockRedisClient.del.mockResolvedValue(1);

      const result = await cacheService.delete('test-key');

      expect(result).toBe(true);
      expect(mockRedisClient.del).toHaveBeenCalledWith('test-key');
      expect(cacheService.getMetrics().deletes).toBe(1);
    });

    it('should return false for non-existent key', async () => {
      mockRedisClient.del.mockResolvedValue(0);

      const result = await cacheService.delete('non-existent-key');

      expect(result).toBe(false);
      expect(cacheService.getMetrics().deletes).toBe(1);
    });
  });

  describe('deletePattern', () => {
    it('should delete keys matching pattern', async () => {
      const keys = ['user:1:balance', 'user:1:transactions'];
      mockRedisClient.keys.mockResolvedValue(keys);
      mockRedisClient.del.mockResolvedValue(2);

      const result = await cacheService.deletePattern('user:1:*');

      expect(result).toBe(2);
      expect(mockRedisClient.keys).toHaveBeenCalledWith('user:1:*');
      expect(mockRedisClient.del).toHaveBeenCalledWith(keys);
      expect(cacheService.getMetrics().deletes).toBe(2);
    });

    it('should handle no matching keys', async () => {
      mockRedisClient.keys.mockResolvedValue([]);

      const result = await cacheService.deletePattern('user:999:*');

      expect(result).toBe(0);
      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });
  });

  describe('exists', () => {
    it('should return true for existing key', async () => {
      mockRedisClient.exists.mockResolvedValue(1);

      const result = await cacheService.exists('test-key');

      expect(result).toBe(true);
      expect(mockRedisClient.exists).toHaveBeenCalledWith('test-key');
    });

    it('should return false for non-existent key', async () => {
      mockRedisClient.exists.mockResolvedValue(0);

      const result = await cacheService.exists('non-existent-key');

      expect(result).toBe(false);
    });
  });

  describe('TTL operations', () => {
    it('should set TTL for existing key', async () => {
      mockRedisClient.expire.mockResolvedValue(true);

      const result = await cacheService.setTTL('test-key', 300);

      expect(result).toBe(true);
      expect(mockRedisClient.expire).toHaveBeenCalledWith('test-key', 300);
    });

    it('should get TTL for key', async () => {
      mockRedisClient.ttl.mockResolvedValue(250);

      const result = await cacheService.getTTL('test-key');

      expect(result).toBe(250);
      expect(mockRedisClient.ttl).toHaveBeenCalledWith('test-key');
    });
  });

  describe('metrics', () => {
    it('should track cache metrics correctly', async () => {
      // Simulate cache operations
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify({ data: 'hit' }));
      mockRedisClient.get.mockResolvedValueOnce(null);
      mockRedisClient.set.mockResolvedValue('OK');
      mockRedisClient.del.mockResolvedValue(1);

      await cacheService.get('hit-key');
      await cacheService.get('miss-key');
      await cacheService.set('new-key', { data: 'test' });
      await cacheService.delete('old-key');

      const metrics = cacheService.getMetrics();
      expect(metrics.hits).toBe(1);
      expect(metrics.misses).toBe(1);
      expect(metrics.sets).toBe(1);
      expect(metrics.deletes).toBe(1);
    });

    it('should calculate hit rate correctly', async () => {
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify({ data: 'hit' }));
      mockRedisClient.get.mockResolvedValueOnce(null);

      await cacheService.get('hit-key');
      await cacheService.get('miss-key');

      expect(cacheService.getHitRate()).toBe(0.5);
    });

    it('should reset metrics', () => {
      // Set some metrics
      cacheService.getMetrics().hits = 5;
      cacheService.getMetrics().misses = 3;

      cacheService.resetMetrics();

      const metrics = cacheService.getMetrics();
      expect(metrics.hits).toBe(0);
      expect(metrics.misses).toBe(0);
      expect(metrics.sets).toBe(0);
      expect(metrics.deletes).toBe(0);
      expect(metrics.errors).toBe(0);
    });
  });

  describe('health check', () => {
    it('should return health status', () => {
      expect(cacheService.isHealthy()).toBe(false); // Not connected initially
    });
  });
});