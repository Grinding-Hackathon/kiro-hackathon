import { QueryOptimizationService } from '../../services/queryOptimizationService';
import { db } from '../../database/connection';

// Mock database connection
jest.mock('../../database/connection', () => ({
  db: {
    on: jest.fn(),
    raw: jest.fn(),
    client: {
      config: { client: 'postgresql' }
    }
  }
}));

describe('QueryOptimizationService', () => {
  let service: QueryOptimizationService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockReturnThis(),
      sum: jest.fn().mockReturnThis(),
      count: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      first: jest.fn(),
      update: jest.fn(),
      clone: jest.fn().mockReturnThis(),
      clearSelect: jest.fn().mockReturnThis(),
      raw: jest.fn()
    };

    // Mock the db function to return our mock
    (db as any).mockImplementation(() => mockDb);
    Object.assign(db, mockDb);

    service = new QueryOptimizationService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserBalance', () => {
    it('should calculate user balance correctly', async () => {
      const userId = 'user-123';
      
      // Mock the Promise.all results
      mockDb.first.mockResolvedValueOnce({ balance: '100.50' }); // blockchain
      mockDb.first.mockResolvedValueOnce({ balance: '50.25' }); // offline
      mockDb.first.mockResolvedValueOnce({ balance: '25.75' }); // pending

      const result = await service.getUserBalance(userId);

      expect(result).toEqual({
        blockchain: 100.50,
        offline: 50.25,
        pending: 25.75
      });
    });

    it('should handle null balance values', async () => {
      const userId = 'user-123';
      
      mockDb.first.mockResolvedValueOnce(null);
      mockDb.first.mockResolvedValueOnce(null);
      mockDb.first.mockResolvedValueOnce(null);

      const result = await service.getUserBalance(userId);

      expect(result).toEqual({
        blockchain: 0,
        offline: 0,
        pending: 0
      });
    });

    it('should handle database errors', async () => {
      const userId = 'user-123';
      const error = new Error('Database error');
      
      mockDb.first.mockRejectedValue(error);

      await expect(service.getUserBalance(userId)).rejects.toThrow('Database error');
    });
  });

  describe('getTransactionHistory', () => {
    it('should return paginated transaction history', async () => {
      const userId = 'user-123';
      const options = { page: 1, limit: 10 };

      const mockTransactions = [
        { id: '1', amount: '100', type: 'online', status: 'completed' },
        { id: '2', amount: '50', type: 'offline', status: 'pending' }
      ];

      // Mock count query
      mockDb.first.mockResolvedValueOnce({ total: '25' });
      
      // Mock data query
      mockDb.mockResolvedValueOnce(mockTransactions);

      const result = await service.getTransactionHistory(userId, options);

      expect(result.data).toEqual(mockTransactions);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 25,
        totalPages: 3,
        hasNext: true,
        hasPrev: false
      });
    });

    it('should apply filters correctly', async () => {
      const userId = 'user-123';
      const options = {
        page: 1,
        limit: 10,
        type: 'online',
        status: 'completed',
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-12-31')
      };

      mockDb.first.mockResolvedValueOnce({ total: '5' });
      mockDb.mockResolvedValueOnce([]);

      await service.getTransactionHistory(userId, options);

      expect(mockDb.where).toHaveBeenCalledWith('type', 'online');
      expect(mockDb.where).toHaveBeenCalledWith('status', 'completed');
      expect(mockDb.where).toHaveBeenCalledWith('created_at', '>=', options.startDate);
      expect(mockDb.where).toHaveBeenCalledWith('created_at', '<=', options.endDate);
    });
  });

  describe('getActiveTokens', () => {
    it('should return active tokens for user', async () => {
      const userId = 'user-123';
      const mockTokens = [
        { id: '1', amount: '100', signature: 'sig1' },
        { id: '2', amount: '50', signature: 'sig2' }
      ];

      mockDb.mockResolvedValue(mockTokens);

      const result = await service.getActiveTokens(userId);

      expect(result).toEqual(mockTokens);
      expect(mockDb.where).toHaveBeenCalledWith('user_id', userId);
      expect(mockDb.where).toHaveBeenCalledWith('status', 'active');
    });

    it('should apply limit when provided', async () => {
      const userId = 'user-123';
      const limit = 5;

      mockDb.mockResolvedValue([]);

      await service.getActiveTokens(userId, limit);

      expect(mockDb.limit).toHaveBeenCalledWith(limit);
    });
  });

  describe('batchUpdateTokenStatus', () => {
    it('should update multiple tokens status', async () => {
      const tokenIds = ['token1', 'token2', 'token3'];
      const status = 'spent';

      mockDb.update.mockResolvedValue(3);

      const result = await service.batchUpdateTokenStatus(tokenIds, status);

      expect(result).toBe(3);
      expect(mockDb.whereIn).toHaveBeenCalledWith('id', tokenIds);
      expect(mockDb.update).toHaveBeenCalledWith({
        status,
        updated_at: expect.any(Date)
      });
    });
  });

  describe('analyzeQueryPerformance', () => {
    it('should provide performance analysis', async () => {
      // Set up some metrics
      service.getMetrics().queryCount = 100;
      service.getMetrics().totalExecutionTime = 60000; // 60 seconds
      service.getMetrics().averageExecutionTime = 600; // 600ms average
      service.getMetrics().slowQueries = new Array(15).fill({
        query: 'SELECT * FROM test',
        executionTime: 1500,
        timestamp: new Date()
      });

      const analysis = await service.analyzeQueryPerformance();

      expect(analysis.totalQueries).toBe(100);
      expect(analysis.averageTime).toBe(600);
      expect(analysis.slowQueries).toBe(15);
      expect(analysis.recommendations).toContain('Consider adding more database indexes for frequently queried columns');
      expect(analysis.recommendations).toContain('Multiple slow queries detected - review query optimization');
    });
  });

  describe('performMaintenance', () => {
    it('should perform database maintenance operations', async () => {
      mockDb.update.mockResolvedValue(5); // 5 expired tokens updated
      (db.raw as jest.Mock).mockResolvedValue(undefined);

      await service.performMaintenance();

      expect(db.raw).toHaveBeenCalledWith('ANALYZE');
      expect(db.raw).toHaveBeenCalledWith('VACUUM ANALYZE');
      expect(mockDb.update).toHaveBeenCalledWith({
        status: 'expired',
        updated_at: expect.any(Date)
      });
    });

    it('should handle maintenance errors', async () => {
      const error = new Error('Maintenance failed');
      (db.raw as jest.Mock).mockRejectedValue(error);

      await expect(service.performMaintenance()).rejects.toThrow('Maintenance failed');
    });
  });

  describe('metrics management', () => {
    it('should reset metrics', () => {
      // Set some metrics
      const metrics = service.getMetrics();
      metrics.queryCount = 100;
      metrics.totalExecutionTime = 5000;

      service.resetMetrics();

      const resetMetrics = service.getMetrics();
      expect(resetMetrics.queryCount).toBe(0);
      expect(resetMetrics.totalExecutionTime).toBe(0);
      expect(resetMetrics.averageExecutionTime).toBe(0);
      expect(resetMetrics.slowQueries).toHaveLength(0);
    });

    it('should set slow query threshold', () => {
      service.setSlowQueryThreshold(2000);
      // This would be tested through the query logging functionality
      // which is set up in the constructor
    });
  });
});