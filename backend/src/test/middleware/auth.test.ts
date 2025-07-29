import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest } from '../../middleware/auth';

// Mock dependencies
jest.mock('jsonwebtoken');
jest.mock('../../config/config');
jest.mock('../../utils/logger');

const mockJwt = jwt as jest.Mocked<typeof jwt>;

// Import the real auth middleware functions, not the mocked ones
const authModule = jest.requireActual('../../middleware/auth');
const { authMiddleware, optionalAuthMiddleware, generateToken } = authModule;

describe('Auth Middleware', () => {
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockRequest = {
      headers: {},
      ip: '192.168.1.1',
      get: jest.fn().mockReturnValue('test-user-agent'),
      url: '/api/test',
      method: 'GET',
    };
    
    mockResponse = {};
    mockNext = jest.fn();

    // Mock config
    const config = require('../../config/config');
    config.config = {
      jwt: {
        secret: 'test-secret',
        expiresIn: '24h',
      },
    };
  });

  describe('authMiddleware', () => {
    it('should authenticate valid token successfully', () => {
      const mockPayload = {
        id: 'user-123',
        walletAddress: '0x742d35Cc6634C0532925a3b8D4C0C8b3C2e1e1e1',
        publicKey: '0x04' + 'a'.repeat(128),
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400,
      };

      mockRequest.headers = {
        authorization: 'Bearer valid-token',
      };

      mockJwt.verify.mockReturnValue(mockPayload as any);

      authMiddleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockRequest.user).toEqual({
        id: mockPayload.id,
        walletAddress: mockPayload.walletAddress,
        publicKey: mockPayload.publicKey,
      });
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should reject request without authorization header', () => {
      authMiddleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Authorization header is required',
          statusCode: 401,
        })
      );
    });

    it('should reject request without token', () => {
      mockRequest.headers = {
        authorization: 'Bearer',
      };

      authMiddleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Token is required',
          statusCode: 401,
        })
      );
    });

    it('should reject invalid token', () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid-token',
      };

      mockJwt.verify.mockImplementation(() => {
        throw new jwt.JsonWebTokenError('Invalid token');
      });

      authMiddleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Invalid token',
          statusCode: 401,
        })
      );
    });

    it('should reject expired token', () => {
      mockRequest.headers = {
        authorization: 'Bearer expired-token',
      };

      mockJwt.verify.mockImplementation(() => {
        throw new jwt.TokenExpiredError('Token expired', new Date());
      });

      authMiddleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Token expired',
          statusCode: 401,
        })
      );
    });
  });

  describe('optionalAuthMiddleware', () => {
    it('should authenticate valid token when provided', () => {
      const mockPayload = {
        id: 'user-123',
        walletAddress: '0x742d35Cc6634C0532925a3b8D4C0C8b3C2e1e1e1',
        publicKey: '0x04' + 'a'.repeat(128),
      };

      mockRequest.headers = {
        authorization: 'Bearer valid-token',
      };

      mockJwt.verify.mockReturnValue(mockPayload as any);

      optionalAuthMiddleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockRequest.user).toEqual({
        id: mockPayload.id,
        walletAddress: mockPayload.walletAddress,
        publicKey: mockPayload.publicKey,
      });
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should continue without user when no authorization header', () => {
      optionalAuthMiddleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should continue without user when token is invalid', () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid-token',
      };

      mockJwt.verify.mockImplementation(() => {
        throw new jwt.JsonWebTokenError('Invalid token');
      });

      optionalAuthMiddleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('generateToken', () => {
    it('should generate valid JWT token', () => {
      const payload = {
        id: 'user-123',
        walletAddress: '0x742d35Cc6634C0532925a3b8D4C0C8b3C2e1e1e1',
        publicKey: '0x04' + 'a'.repeat(128),
      };

      mockJwt.sign.mockReturnValue('generated-token' as any);

      const token = generateToken(payload);

      expect(token).toBe('generated-token');
      expect(mockJwt.sign).toHaveBeenCalledWith(
        payload,
        'test-secret',
        { expiresIn: '24h' }
      );
    });

    it('should handle token generation errors', () => {
      const payload = {
        id: 'user-123',
        walletAddress: '0x742d35Cc6634C0532925a3b8D4C0C8b3C2e1e1e1',
        publicKey: '0x04' + 'a'.repeat(128),
      };

      mockJwt.sign.mockImplementation(() => {
        throw new Error('Token generation failed');
      });

      expect(() => generateToken(payload)).toThrow('Token generation failed');
    });
  });
});