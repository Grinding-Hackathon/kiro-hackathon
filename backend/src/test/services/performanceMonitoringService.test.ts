import { PerformanceMonitoringService } from '../../services/performanceMonitoringService';
import { cacheService } from '../../services/cacheService';
import { queryOptimizationService } from '../../services/queryOptimizationService';

// Mock dependencies
jest.mock('../../services/cacheService');
jest.mock('../../services/queryOptimizationService');
jest.mock('os');

describe('PerformanceMonitoringService', () => {
  let service: PerformanceMonitoringService;
  let mockCacheService: jest.Mocked<typeof cacheService>;
  let mockQueryService: jest.Mocked<typeof queryOptimizationService>;

  beforeEach(() => {
    mockCacheService = cacheService as jest.Mocked<typeof cacheService>;
    mockQueryService = queryOptimizationService as jest.Mocked<typeof queryOptimizationService>;

    // Mock cache service
    mockCacheService.getMetrics.mockReturnValue({
      hits: 80,
      misses: 20,
      sets: 50,
      deletes: 5,
      errors: 0
    });

    // Mock query service
    mockQueryService.getMetrics.mockReturnValue({
      queryCount: 100,
      totalExecutionTime: 50000,
      averageExecutionTime: 500,
      slowQueries: []
    });

    service = new PerformanceMonitoringService();
  });

  afterEach(() => {
    service.stopMonitoring();
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default metrics', () => {
      const metrics = service.getMetrics();
      
      expect(metrics.responseTime.average).toBe(0);
      expect(metrics.throughput.requestsPerSecond).toBe(0);
      expect(metrics.errorRate.rate).toBe(0);
    });

    it('should start monitoring on initialization', () => {
      expect(service['monitoringInterval']).toBeTruthy();
    });
  });

  describe('recordResponseTime', () => {
    it('should record response times', () => {
      service.recordResponseTime(100);
      service.recordResponseTime(200);
      service.recordResponseTime(300);

      expect(service['responseTimeBuffer']).toEqual([100, 200, 300]);
      expect(service['requestCount']).toBe(3);
    });

    it('should limit buffer size', () => {
      // Add more than 1000 entries
      for (let i = 0; i < 1200; i++) {
        service.recordResponseTime(i);
      }

      expect(service['responseTimeBuffer'].length).toBeLessThanOrEqual(500);
    });
  });

  describe('recordError', () => {
    it('should increment error count', () => {
      service.recordError();
      service.recordError();

      expect(service['errorCount']).toBe(2);
    });
  });

  describe('metrics collection', () => {
    it('should calculate response time metrics correctly', async () => {
      service.recordResponseTime(100);
      service.recordResponseTime(200);
      service.recordResponseTime(300);
      service.recordResponseTime(400);
      service.recordResponseTime(500);

      await service['collectMetrics']();
      const metrics = service.getMetrics();

      expect(metrics.responseTime.average).toBe(300);
      expect(metrics.responseTime.p95).toBeGreaterThan(0);
      expect(metrics.responseTime.p99).toBeGreaterThan(0);
    });

    it('should calculate error rate correctly', async () => {
      service.recordResponseTime(100);
      service.recordResponseTime(200);
      service.recordError();

      await service['collectMetrics']();
      const metrics = service.getMetrics();

      expect(metrics.errorRate.rate).toBe(50); // 1 error out of 2 requests = 50%
      expect(metrics.errorRate.count).toBe(1);
    });

    it('should collect cache metrics', async () => {
      await service['collectCacheMetrics']();
      const metrics = service.getMetrics();

      expect(metrics.cache.hitRate).toBe(80); // 80 hits out of 100 total
      expect(metrics.cache.missRate).toBe(20); // 20 misses out of 100 total
    });

    it('should collect database metrics', async () => {
      await service['collectDatabaseMetrics']();
      const metrics = service.getMetrics();

      expect(metrics.database.averageQueryTime).toBe(500);
      expect(metrics.database.slowQueries).toBe(0);
    });
  });

  describe('alert system', () => {
    it('should create alerts when thresholds are exceeded', () => {
      const alertSpy = jest.fn();
      service.on('alert', alertSpy);

      // Set high response time to trigger alert
      service.recordResponseTime(3000);
      service['metrics'].responseTime.average = 3000;

      service['checkAlerts']();

      expect(alertSpy).toHaveBeenCalled();
      const alerts = service.getActiveAlerts();
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0]?.type).toBe('response_time');
    });

    it('should resolve alerts', () => {
      const alert = service['createAlert'](
        'response_time',
        'high',
        'Test alert',
        2000,
        1000
      );
      service['alerts'].push(alert);

      const resolved = service.resolveAlert(alert.id);

      expect(resolved).toBe(true);
      expect(alert.resolved).toBe(true);
      expect(alert.resolvedAt).toBeDefined();
    });

    it('should not resolve non-existent alerts', () => {
      const resolved = service.resolveAlert('non-existent-id');
      expect(resolved).toBe(false);
    });
  });

  describe('threshold management', () => {
    it('should update thresholds', () => {
      const newThresholds = {
        responseTimeMs: 3000,
        errorRatePercent: 10
      };

      service.updateThresholds(newThresholds);
      const thresholds = service.getThresholds();

      expect(thresholds.responseTimeMs).toBe(3000);
      expect(thresholds.errorRatePercent).toBe(10);
    });

    it('should return current thresholds', () => {
      const thresholds = service.getThresholds();

      expect(thresholds).toHaveProperty('responseTimeMs');
      expect(thresholds).toHaveProperty('errorRatePercent');
      expect(thresholds).toHaveProperty('cpuUsagePercent');
    });
  });

  describe('monitoring control', () => {
    it('should start monitoring with custom interval', () => {
      service.stopMonitoring();
      service.startMonitoring(5000);

      expect(service['monitoringInterval']).toBeTruthy();
    });

    it('should stop monitoring', () => {
      service.stopMonitoring();

      expect(service['monitoringInterval']).toBeNull();
    });
  });

  describe('metrics reset', () => {
    it('should reset all metrics', () => {
      service.recordResponseTime(100);
      service.recordError();

      service.resetMetrics();

      expect(service['responseTimeBuffer']).toHaveLength(0);
      expect(service['requestCount']).toBe(0);
      expect(service['errorCount']).toBe(0);
    });
  });

  describe('report generation', () => {
    it('should generate performance report', () => {
      service.recordResponseTime(100);
      service.recordResponseTime(200);

      const report = service.generateReport();

      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('metrics');
      expect(report).toHaveProperty('alerts');
      expect(report).toHaveProperty('recommendations');
      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    it('should include recommendations based on metrics', () => {
      // Set metrics that should trigger recommendations
      service['metrics'].responseTime.average = 1500;
      service['metrics'].cache.hitRate = 60;
      service['metrics'].systemResources.memoryUsage.percentage = 75;
      service['metrics'].database.slowQueries = 10;

      const report = service.generateReport();

      expect(report.recommendations.length).toBeGreaterThan(0);
      expect(report.recommendations.some(r => r.includes('caching'))).toBe(true);
      expect(report.recommendations.some(r => r.includes('memory'))).toBe(true);
      expect(report.recommendations.some(r => r.includes('database'))).toBe(true);
    });
  });

  describe('alert filtering', () => {
    it('should return only active alerts by default', () => {
      const activeAlert = service['createAlert'](
        'response_time',
        'high',
        'Active alert',
        2000,
        1000
      );
      const resolvedAlert = service['createAlert'](
        'memory_usage',
        'medium',
        'Resolved alert',
        90,
        80
      );
      resolvedAlert.resolved = true;

      service['alerts'].push(activeAlert, resolvedAlert);

      const activeAlerts = service.getActiveAlerts();
      const allAlerts = service.getAlerts(true);

      expect(activeAlerts).toHaveLength(1);
      expect(allAlerts).toHaveLength(2);
    });
  });
});