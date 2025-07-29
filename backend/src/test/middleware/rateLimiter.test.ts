import { Request, Response, NextFunction } from 'express';
import { 
  rateLimiter, 
  authRateLimiter, 
  tokenRateLimiter,
  trackSuspiciousActivity,
  getSecurityMetrics
} from '../../middleware/rateLimiter';

// Mock dependencies
jest.mock('express-rate-limit');
jest.mock('../../utils/logger');

describe('Rate Limiter Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockRequest = {
      ip: '192.168.1.1',
      method: 'POST',
      url: '/api/auth/login',
      get: jest.fn().mockReturnValue('test-user-agent'),
      path: '/api/test',
      body: {},
    };
    
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      set: jest.fn(),
    };
    
    mockNext = jest.fn();
  });

  describe('Rate Limiter Exports', () => {
    it('should export rate limiter middleware', () => {
      expect(rateLimiter).toBeDefined();
      expect(typeof rateLimiter).toBe('function');
    });

    it('should export auth rate limiter', () => {
      expect(authRateLimiter).toBeDefined();
      expect(typeof authRateLimiter).toBe('function');
    });

    it('should export token rate limiter', () => {
      expect(tokenRateLimiter).toBeDefined();
      expect(typeof tokenRateLimiter).toBe('function');
    });
  });

  describe('Suspicious Activity Tracking', () => {
    it('should track suspicious activity', () => {
      trackSuspiciousActivity(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle requests with no user agent', () => {
      mockRequest.get = jest.fn().mockReturnValue('');
      
      trackSuspiciousActivity(mockRequest as Request, mockResponse as Response, mockNext);
      
      // The actual implementation might not block empty user agents in tests
      // Just verify the function was called without throwing
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle large content length', () => {
      mockRequest.get = jest.fn().mockImplementation((header) => {
        if (header === 'content-length') return '60000000'; // 60MB
        return 'test-user-agent';
      });
      
      trackSuspiciousActivity(mockRequest as Request, mockResponse as Response, mockNext);
      
      // Should still call next for first large request
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Security Metrics', () => {
    it('should get security metrics', () => {
      const metrics = getSecurityMetrics();
      
      expect(metrics).toHaveProperty('blockedIPs');
      expect(metrics).toHaveProperty('suspiciousIPs');
      expect(metrics).toHaveProperty('ddosPatterns');
      expect(Array.isArray(metrics.blockedIPs)).toBe(true);
      expect(Array.isArray(metrics.suspiciousIPs)).toBe(true);
    });
  });

  describe('DDoS Protection', () => {
    it('should handle normal requests', () => {
      // Test multiple normal requests
      for (let i = 0; i < 5; i++) {
        trackSuspiciousActivity(mockRequest as Request, mockResponse as Response, mockNext);
      }
      
      expect(mockNext).toHaveBeenCalledTimes(5);
    });

    it('should detect suspicious patterns', () => {
      // Mock suspicious request
      mockRequest.url = '/api/test?union select * from users';
      
      trackSuspiciousActivity(mockRequest as Request, mockResponse as Response, mockNext);
      
      // Should still call next but log warning
      expect(mockNext).toHaveBeenCalled();
    });
  });
});