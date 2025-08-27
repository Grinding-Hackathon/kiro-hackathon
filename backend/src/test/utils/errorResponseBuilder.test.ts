import { Request } from 'express';
import { ErrorResponseBuilder, ErrorSeverity, ErrorCategory } from '../../utils/errorResponseBuilder';
import { ErrorCode } from '../../types';

describe('ErrorResponseBuilder', () => {
  let mockRequest: Partial<Request>;

  beforeEach(() => {
    mockRequest = {
      path: '/api/v1/test',
      method: 'POST',
      ip: '127.0.0.1',
      get: jest.fn((header: string) => {
        if (header === 'User-Agent') return 'test-agent';
        if (header === 'set-cookie') return undefined;
        return undefined;
      }) as any,
      connection: { remoteAddress: '127.0.0.1' } as any,
    };
  });

  describe('Error Code Mapping', () => {
    it('should map validation errors to 400 status code', () => {
      const statusCode = ErrorResponseBuilder.getStatusCode(ErrorCode.VALIDATION_ERROR);
      expect(statusCode).toBe(400);
      
      const category = ErrorResponseBuilder.getCategory(ErrorCode.VALIDATION_ERROR);
      expect(category).toBe(ErrorCategory.VALIDATION);
      
      const severity = ErrorResponseBuilder.getSeverity(ErrorCode.VALIDATION_ERROR);
      expect(severity).toBe(ErrorSeverity.LOW);
    });

    it('should map authentication errors to 401 status code', () => {
      const statusCode = ErrorResponseBuilder.getStatusCode(ErrorCode.TOKEN_EXPIRED);
      expect(statusCode).toBe(401);
      
      const category = ErrorResponseBuilder.getCategory(ErrorCode.TOKEN_EXPIRED);
      expect(category).toBe(ErrorCategory.AUTHENTICATION);
      
      const severity = ErrorResponseBuilder.getSeverity(ErrorCode.TOKEN_EXPIRED);
      expect(severity).toBe(ErrorSeverity.MEDIUM);
    });

    it('should map authorization errors to 403 status code', () => {
      const statusCode = ErrorResponseBuilder.getStatusCode(ErrorCode.FRAUD_DETECTED);
      expect(statusCode).toBe(403);
      
      const category = ErrorResponseBuilder.getCategory(ErrorCode.FRAUD_DETECTED);
      expect(category).toBe(ErrorCategory.AUTHORIZATION);
      
      const severity = ErrorResponseBuilder.getSeverity(ErrorCode.FRAUD_DETECTED);
      expect(severity).toBe(ErrorSeverity.HIGH);
    });

    it('should map business logic errors to 422 status code', () => {
      const statusCode = ErrorResponseBuilder.getStatusCode(ErrorCode.INSUFFICIENT_BALANCE);
      expect(statusCode).toBe(422);
      
      const category = ErrorResponseBuilder.getCategory(ErrorCode.INSUFFICIENT_BALANCE);
      expect(category).toBe(ErrorCategory.BUSINESS_LOGIC);
      
      const severity = ErrorResponseBuilder.getSeverity(ErrorCode.INSUFFICIENT_BALANCE);
      expect(severity).toBe(ErrorSeverity.MEDIUM);
    });

    it('should map server errors to 500 status code', () => {
      const statusCode = ErrorResponseBuilder.getStatusCode(ErrorCode.INTERNAL_SERVER_ERROR);
      expect(statusCode).toBe(500);
      
      const category = ErrorResponseBuilder.getCategory(ErrorCode.INTERNAL_SERVER_ERROR);
      expect(category).toBe(ErrorCategory.SYSTEM);
      
      const severity = ErrorResponseBuilder.getSeverity(ErrorCode.INTERNAL_SERVER_ERROR);
      expect(severity).toBe(ErrorSeverity.CRITICAL);
    });
  });

  describe('Error Response Building', () => {
    it('should build basic error response', () => {
      const { response, statusCode } = ErrorResponseBuilder.buildErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Test validation error',
        mockRequest as Request
      );

      expect(statusCode).toBe(400);
      expect(response.success).toBe(false);
      expect(response.error?.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(response.error?.message).toBe('Test validation error');
      expect(response.error?.details?.['path']).toBe('/api/v1/test');
      expect(response.error?.details?.['method']).toBe('POST');
      expect(response.error?.details?.['ip']).toBe('127.0.0.1');
      expect(response.error?.details?.['category']).toBe(ErrorCategory.VALIDATION);
      expect(response.error?.details?.['severity']).toBe(ErrorSeverity.LOW);
      expect(response.timestamp).toBeDefined();
      expect(response.requestId).toBeDefined();
    });

    it('should build error response with metadata', () => {
      const metadata = {
        field: 'email',
        reason: 'Invalid format',
        customData: 'test'
      };

      const { response, statusCode } = ErrorResponseBuilder.buildErrorResponse(
        ErrorCode.INVALID_FIELD_VALUE,
        'Invalid field value',
        mockRequest as Request,
        metadata
      );

      expect(statusCode).toBe(400);
      expect(response.error?.details?.field).toBe('email');
      expect(response.error?.details?.reason).toBe('Invalid format');
      expect(response.error?.details?.['customData']).toBe('test');
    });

    it('should build validation error response', () => {
      const validationErrors = [
        { field: 'email', message: 'Email is required', value: '' },
        { field: 'password', message: 'Password too short', value: '123' }
      ];

      const { response, statusCode } = ErrorResponseBuilder.buildValidationErrorResponse(
        'Validation failed',
        validationErrors,
        mockRequest as Request
      );

      expect(statusCode).toBe(400);
      expect(response.error?.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(response.error?.details?.validationErrors).toEqual(validationErrors);
    });

    it('should build authentication error response', () => {
      const { response, statusCode } = ErrorResponseBuilder.buildAuthenticationErrorResponse(
        ErrorCode.TOKEN_EXPIRED,
        'Token has expired',
        mockRequest as Request
      );

      expect(statusCode).toBe(401);
      expect(response.error?.code).toBe(ErrorCode.TOKEN_EXPIRED);
      expect(response.error?.message).toBe('Token has expired');
    });

    it('should build authorization error response', () => {
      const metadata = { requiredPermission: 'admin' };

      const { response, statusCode } = ErrorResponseBuilder.buildAuthorizationErrorResponse(
        ErrorCode.INSUFFICIENT_PERMISSIONS,
        'Access denied',
        mockRequest as Request,
        metadata
      );

      expect(statusCode).toBe(403);
      expect(response.error?.code).toBe(ErrorCode.INSUFFICIENT_PERMISSIONS);
      expect(response.error?.details?.['requiredPermission']).toBe('admin');
    });

    it('should build business logic error response', () => {
      const metadata = { currentBalance: 50, requestedAmount: 100 };

      const { response, statusCode } = ErrorResponseBuilder.buildBusinessLogicErrorResponse(
        ErrorCode.INSUFFICIENT_BALANCE,
        'Insufficient balance',
        mockRequest as Request,
        metadata
      );

      expect(statusCode).toBe(422);
      expect(response.error?.code).toBe(ErrorCode.INSUFFICIENT_BALANCE);
      expect(response.error?.details?.['currentBalance']).toBe(50);
      expect(response.error?.details?.['requestedAmount']).toBe(100);
    });

    it('should build external service error response', () => {
      const metadata = { service: 'blockchain', timeout: 5000 };

      const { response, statusCode } = ErrorResponseBuilder.buildExternalServiceErrorResponse(
        ErrorCode.BLOCKCHAIN_TIMEOUT,
        'Blockchain service timeout',
        mockRequest as Request,
        metadata
      );

      expect(statusCode).toBe(504);
      expect(response.error?.code).toBe(ErrorCode.BLOCKCHAIN_TIMEOUT);
      expect(response.error?.details?.['service']).toBe('blockchain');
      expect(response.error?.details?.['timeout']).toBe(5000);
    });

    it('should build internal server error response', () => {
      const error = new Error('Database connection failed');
      error.stack = 'Error: Database connection failed\n    at test';

      const { response, statusCode } = ErrorResponseBuilder.buildInternalServerErrorResponse(
        'Internal server error',
        mockRequest as Request,
        error
      );

      expect(statusCode).toBe(500);
      expect(response.error?.code).toBe(ErrorCode.INTERNAL_SERVER_ERROR);
      expect(response.error?.message).toBe('Internal server error');
      
      // Stack trace should only be included in development
      if (process.env['NODE_ENV'] === 'development') {
        expect(response.error?.details?.['stack']).toBeDefined();
      }
    });
  });

  describe('Request Metadata Extraction', () => {
    it('should extract request metadata correctly', () => {
      const requestWithUser = {
        ...mockRequest,
        user: { id: 'user123', walletAddress: '0x123', publicKey: 'pub123' }
      } as any;

      const { response } = ErrorResponseBuilder.buildErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Test error',
        requestWithUser
      );

      expect(response.error?.details?.['userId']).toBe('user123');
      expect(response.error?.details?.['path']).toBe('/api/v1/test');
      expect(response.error?.details?.['method']).toBe('POST');
      expect(response.error?.details?.['userAgent']).toBe('test-agent');
      expect(response.error?.details?.['ip']).toBe('127.0.0.1');
    });

    it('should handle missing request gracefully', () => {
      const { response, statusCode } = ErrorResponseBuilder.buildErrorResponse(
        ErrorCode.INTERNAL_SERVER_ERROR,
        'Test error without request'
      );

      expect(statusCode).toBe(500);
      expect(response.success).toBe(false);
      expect(response.error?.code).toBe(ErrorCode.INTERNAL_SERVER_ERROR);
      expect(response.error?.details?.['correlationId']).toBeDefined();
      expect(response.error?.details?.['timestamp']).toBeDefined();
    });
  });

  describe('Correlation ID Generation', () => {
    it('should generate unique correlation IDs', () => {
      const { response: response1 } = ErrorResponseBuilder.buildErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Error 1'
      );

      const { response: response2 } = ErrorResponseBuilder.buildErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Error 2'
      );

      expect(response1.requestId).toBeDefined();
      expect(response2.requestId).toBeDefined();
      expect(response1.requestId).not.toBe(response2.requestId);
      expect(response1.error?.details?.['correlationId']).toBe(response1.requestId);
      expect(response2.error?.details?.['correlationId']).toBe(response2.requestId);
    });

    it('should use provided correlation ID', () => {
      const customCorrelationId = 'custom-correlation-123';
      const metadata = { correlationId: customCorrelationId };

      const { response } = ErrorResponseBuilder.buildErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Test error',
        undefined,
        metadata
      );

      expect(response.requestId).toBe(customCorrelationId);
      expect(response.error?.details?.['correlationId']).toBe(customCorrelationId);
    });
  });
});