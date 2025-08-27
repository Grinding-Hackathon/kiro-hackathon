import { ErrorMonitoringService } from '../../services/errorMonitoringService';
import { ErrorCode } from '../../types';
import { ErrorSeverity, ErrorCategory } from '../../utils/errorResponseBuilder';

// Mock dependencies
jest.mock('../../utils/logger');

describe('ErrorMonitoringService', () => {
  let service: ErrorMonitoringService;

  beforeEach(() => {
    service = new ErrorMonitoringService();
    service.resetStatistics();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('trackError', () => {
    it('should track error occurrence', async () => {
      await service.trackError(
        ErrorCode.VALIDATION_ERROR,
        ErrorSeverity.LOW,
        ErrorCategory.VALIDATION,
        {
          userId: 'user123',
          ip: '127.0.0.1',
          correlationId: 'test-correlation-id',
        }
      );

      const stats = service.getErrorStatistics();
      expect(stats.totalErrors).toBe(1);
      expect(stats.errorsByCategory['VALIDATION']).toBe(1);
      expect(stats.errorsByCode['VALIDATION_ERROR']).toBe(1);
    });

    it('should track multiple errors', async () => {
      await service.trackError(
        ErrorCode.VALIDATION_ERROR,
        ErrorSeverity.LOW,
        ErrorCategory.VALIDATION,
        { userId: 'user123' }
      );

      await service.trackError(
        ErrorCode.AUTHENTICATION_REQUIRED,
        ErrorSeverity.MEDIUM,
        ErrorCategory.AUTHENTICATION,
        { userId: 'user456' }
      );

      await service.trackError(
        ErrorCode.VALIDATION_ERROR,
        ErrorSeverity.LOW,
        ErrorCategory.VALIDATION,
        { userId: 'user789' }
      );

      const stats = service.getErrorStatistics();
      expect(stats.totalErrors).toBe(3);
      expect(stats.errorsByCategory['VALIDATION']).toBe(2);
      expect(stats.errorsByCategory['AUTHENTICATION']).toBe(1);
      expect(stats.errorsByCode['VALIDATION_ERROR']).toBe(2);
      expect(stats.errorsByCode['AUTHENTICATION_REQUIRED']).toBe(1);
    });

    it('should track recent error rate', async () => {
      // Track some errors
      for (let i = 0; i < 5; i++) {
        await service.trackError(
          ErrorCode.VALIDATION_ERROR,
          ErrorSeverity.LOW,
          ErrorCategory.VALIDATION,
          { userId: `user${i}` }
        );
      }

      const stats = service.getErrorStatistics();
      expect(stats.recentErrorRate).toBe(5);
    });
  });

  describe('getErrorStatistics', () => {
    it('should return empty statistics initially', () => {
      const stats = service.getErrorStatistics();
      expect(stats.totalErrors).toBe(0);
      expect(stats.errorsByCategory).toEqual({});
      expect(stats.errorsByCode).toEqual({});
      expect(stats.recentErrorRate).toBe(0);
      expect(stats.topErrors).toEqual([]);
    });

    it('should return top errors sorted by count', async () => {
      // Track different errors with different frequencies
      for (let i = 0; i < 5; i++) {
        await service.trackError(
          ErrorCode.VALIDATION_ERROR,
          ErrorSeverity.LOW,
          ErrorCategory.VALIDATION,
          {}
        );
      }

      for (let i = 0; i < 3; i++) {
        await service.trackError(
          ErrorCode.AUTHENTICATION_REQUIRED,
          ErrorSeverity.MEDIUM,
          ErrorCategory.AUTHENTICATION,
          {}
        );
      }

      for (let i = 0; i < 1; i++) {
        await service.trackError(
          ErrorCode.INTERNAL_SERVER_ERROR,
          ErrorSeverity.CRITICAL,
          ErrorCategory.SYSTEM,
          {}
        );
      }

      const stats = service.getErrorStatistics();
      expect(stats.topErrors).toHaveLength(3);
      expect(stats.topErrors[0]).toEqual({
        errorKey: 'VALIDATION:VALIDATION_ERROR',
        count: 5,
      });
      expect(stats.topErrors[1]).toEqual({
        errorKey: 'AUTHENTICATION:AUTHENTICATION_REQUIRED',
        count: 3,
      });
      expect(stats.topErrors[2]).toEqual({
        errorKey: 'SYSTEM:INTERNAL_SERVER_ERROR',
        count: 1,
      });
    });
  });

  describe('alert thresholds', () => {
    it('should update alert thresholds', () => {
      const newThresholds = {
        errorRate: {
          window: 10 * 60 * 1000, // 10 minutes
          threshold: 100,
        },
      };

      service.updateAlertThresholds(newThresholds);

      // We can't directly test the private thresholds, but we can verify
      // the method doesn't throw and the service continues to work
      expect(() => service.getErrorStatistics()).not.toThrow();
    });
  });

  describe('resetStatistics', () => {
    it('should reset all statistics', async () => {
      // Track some errors first
      await service.trackError(
        ErrorCode.VALIDATION_ERROR,
        ErrorSeverity.LOW,
        ErrorCategory.VALIDATION,
        {}
      );

      let stats = service.getErrorStatistics();
      expect(stats.totalErrors).toBe(1);

      // Reset statistics
      service.resetStatistics();

      stats = service.getErrorStatistics();
      expect(stats.totalErrors).toBe(0);
      expect(stats.errorsByCategory).toEqual({});
      expect(stats.errorsByCode).toEqual({});
      expect(stats.recentErrorRate).toBe(0);
      expect(stats.topErrors).toEqual([]);
    });
  });

  describe('error rate tracking', () => {
    it('should track errors within time windows', async () => {
      // Track errors
      for (let i = 0; i < 3; i++) {
        await service.trackError(
          ErrorCode.VALIDATION_ERROR,
          ErrorSeverity.LOW,
          ErrorCategory.VALIDATION,
          {}
        );
      }

      const stats = service.getErrorStatistics();
      expect(stats.recentErrorRate).toBe(3);
    });

    it('should handle different error categories', async () => {
      await service.trackError(
        ErrorCode.VALIDATION_ERROR,
        ErrorSeverity.LOW,
        ErrorCategory.VALIDATION,
        {}
      );

      await service.trackError(
        ErrorCode.AUTHENTICATION_REQUIRED,
        ErrorSeverity.MEDIUM,
        ErrorCategory.AUTHENTICATION,
        {}
      );

      await service.trackError(
        ErrorCode.AUTHORIZATION_FAILED,
        ErrorSeverity.MEDIUM,
        ErrorCategory.AUTHORIZATION,
        {}
      );

      await service.trackError(
        ErrorCode.INTERNAL_SERVER_ERROR,
        ErrorSeverity.CRITICAL,
        ErrorCategory.SYSTEM,
        {}
      );

      const stats = service.getErrorStatistics();
      expect(stats.errorsByCategory['VALIDATION']).toBe(1);
      expect(stats.errorsByCategory['AUTHENTICATION']).toBe(1);
      expect(stats.errorsByCategory['AUTHORIZATION']).toBe(1);
      expect(stats.errorsByCategory['SYSTEM']).toBe(1);
    });
  });

  describe('metadata tracking', () => {
    it('should track errors with metadata', async () => {
      const metadata = {
        userId: 'user123',
        ip: '192.168.1.1',
        userAgent: 'test-agent',
        path: '/api/test',
        method: 'POST',
        correlationId: 'test-correlation-id',
        customField: 'custom-value',
      };

      await service.trackError(
        ErrorCode.VALIDATION_ERROR,
        ErrorSeverity.LOW,
        ErrorCategory.VALIDATION,
        metadata
      );

      const stats = service.getErrorStatistics();
      expect(stats.totalErrors).toBe(1);
      // Metadata is tracked internally but not exposed in statistics
      // This test verifies the method accepts and processes metadata without errors
    });

    it('should handle missing metadata gracefully', async () => {
      await service.trackError(
        ErrorCode.VALIDATION_ERROR,
        ErrorSeverity.LOW,
        ErrorCategory.VALIDATION,
        {}
      );

      const stats = service.getErrorStatistics();
      expect(stats.totalErrors).toBe(1);
    });
  });
});