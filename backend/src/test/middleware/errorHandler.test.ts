import { Request, Response, NextFunction } from 'express';

// Mock dependencies
jest.mock('../../utils/logger');
jest.mock('../../services/fraudDetectionService');

// Import the real error handler, not the mocked one
const errorHandlerModule = jest.requireActual('../../middleware/errorHandler');
const { errorHandler, CustomError } = errorHandlerModule;

describe('Error Handler Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockRequest = {
      method: 'GET',
      url: '/api/test',
      ip: '192.168.1.1',
      get: jest.fn().mockReturnValue('test-user-agent'),
    };
    
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    
    mockNext = jest.fn();
  });

  describe('CustomError', () => {
    it('should create CustomError with message and status code', () => {
      const error = new CustomError('Test error', 400);
      
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(400);
      expect(error).toBeInstanceOf(Error);
    });

    it('should create CustomError with default status code', () => {
      const error = new CustomError('Test error');
      
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
    });
  });

  describe('errorHandler', () => {
    it('should handle CustomError correctly', () => {
      const customError = new CustomError('Custom error message', 400);
      
      errorHandler(customError, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Custom error message',
        timestamp: expect.any(String),
      });
    });

    it('should handle validation errors (500)', () => {
      const validationError = new Error('Validation failed');
      validationError.name = 'ValidationError';
      
      errorHandler(validationError, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Validation failed',
        timestamp: expect.any(String),
      });
    });

    it('should handle JWT errors (500)', () => {
      const jwtError = new Error('Invalid token');
      jwtError.name = 'JsonWebTokenError';
      
      errorHandler(jwtError, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid token',
        timestamp: expect.any(String),
      });
    });

    it('should handle generic errors (500)', () => {
      const genericError = new Error('Something went wrong');
      
      errorHandler(genericError, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Something went wrong',
        timestamp: expect.any(String),
      });
    });

    it('should handle errors without message', () => {
      const errorWithoutMessage = new Error();
      
      errorHandler(errorWithoutMessage, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: '',
        timestamp: expect.any(String),
      });
    });

    it('should include stack trace in development mode', () => {
      const originalEnv = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'development';
      
      const error = new Error('Development error');
      error.stack = 'Error stack trace';
      
      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Development error',
        timestamp: expect.any(String),
        stack: 'Error stack trace',
        path: '/api/test',
        method: 'GET',
      });
      
      process.env['NODE_ENV'] = originalEnv;
    });

    it('should not include stack trace in production mode', () => {
      const originalEnv = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'production';
      
      const error = new Error('Production error');
      error.stack = 'Error stack trace';
      
      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Production error',
        timestamp: expect.any(String),
      });
      
      process.env['NODE_ENV'] = originalEnv;
    });
  });
});