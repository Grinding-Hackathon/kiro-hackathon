import { ResponseBuilder } from '../../utils/responseBuilder';
import { ErrorCode } from '../../types';

describe('Response Format Standardization', () => {
  describe('ResponseBuilder', () => {
    it('should create success response with correct format', () => {
      const data = { test: 'data' };
      const message = 'Success message';
      const requestId = 'test-request-id';

      const response = ResponseBuilder.success(data, message, requestId);

      expect(response).toEqual({
        success: true,
        data,
        message,
        timestamp: expect.any(String),
        requestId,
      });
    });

    it('should create error response with correct format', () => {
      const code = ErrorCode.VALIDATION_ERROR;
      const message = 'Validation failed';
      const details = { field: 'amount' };
      const requestId = 'test-request-id';

      const response = ResponseBuilder.error(code, message, details, requestId);

      expect(response).toEqual({
        success: false,
        error: {
          code,
          message,
          details,
        },
        timestamp: expect.any(String),
        requestId,
      });
    });

    it('should create validation error response', () => {
      const message = 'Validation failed';
      const validationErrors = [
        { field: 'amount', message: 'Amount is required' },
        { field: 'type', message: 'Type is invalid' },
      ];
      const requestId = 'test-request-id';

      const response = ResponseBuilder.validationError(message, validationErrors, requestId);

      expect(response).toEqual({
        success: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message,
          details: {
            validationErrors,
          },
        },
        timestamp: expect.any(String),
        requestId,
      });
    });

    it('should create authentication error response', () => {
      const message = 'Authentication required';
      const requestId = 'test-request-id';

      const response = ResponseBuilder.authenticationError(message, requestId);

      expect(response).toEqual({
        success: false,
        error: {
          code: ErrorCode.AUTHENTICATION_REQUIRED,
          message,
        },
        timestamp: expect.any(String),
        requestId,
      });
    });

    it('should create authorization error response', () => {
      const message = 'Access denied';
      const requestId = 'test-request-id';

      const response = ResponseBuilder.authorizationError(message, requestId);

      expect(response).toEqual({
        success: false,
        error: {
          code: ErrorCode.AUTHORIZATION_FAILED,
          message,
        },
        timestamp: expect.any(String),
        requestId,
      });
    });

    it('should create not found error response', () => {
      const resource = 'User';
      const requestId = 'test-request-id';

      const response = ResponseBuilder.notFoundError(resource, requestId);

      expect(response).toEqual({
        success: false,
        error: {
          code: ErrorCode.RESOURCE_NOT_FOUND,
          message: `${resource} not found`,
          details: {
            resource,
          },
        },
        timestamp: expect.any(String),
        requestId,
      });
    });

    it('should create business logic error response', () => {
      const code = ErrorCode.TOKEN_EXPIRED;
      const message = 'Token has expired';
      const details = { tokenId: 'token-123' };
      const requestId = 'test-request-id';

      const response = ResponseBuilder.businessLogicError(code, message, details, requestId);

      expect(response).toEqual({
        success: false,
        error: {
          code,
          message,
          details,
        },
        timestamp: expect.any(String),
        requestId,
      });
    });

    it('should create internal server error response', () => {
      const message = 'Internal server error';
      const requestId = 'test-request-id';

      const response = ResponseBuilder.internalServerError(message, requestId);

      expect(response).toEqual({
        success: false,
        error: {
          code: ErrorCode.INTERNAL_SERVER_ERROR,
          message,
        },
        timestamp: expect.any(String),
        requestId,
      });
    });

    it('should generate request ID from request', () => {
      const mockReq = {
        headers: {},
      } as any;

      const requestId = ResponseBuilder.getRequestId(mockReq);

      expect(requestId).toMatch(/^req_\d+_[a-z0-9]+$/);
    });

    it('should use existing request ID from headers', () => {
      const existingRequestId = 'existing-request-id';
      const mockReq = {
        headers: {
          'x-request-id': existingRequestId,
        },
      } as any;

      const requestId = ResponseBuilder.getRequestId(mockReq);

      expect(requestId).toBe(existingRequestId);
    });
  });

  describe('Error Code Enum', () => {
    it('should have all required error codes', () => {
      expect(ErrorCode.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
      expect(ErrorCode.AUTHENTICATION_REQUIRED).toBe('AUTHENTICATION_REQUIRED');
      expect(ErrorCode.AUTHORIZATION_FAILED).toBe('AUTHORIZATION_FAILED');
      expect(ErrorCode.RESOURCE_NOT_FOUND).toBe('RESOURCE_NOT_FOUND');
      expect(ErrorCode.RATE_LIMIT_EXCEEDED).toBe('RATE_LIMIT_EXCEEDED');
      expect(ErrorCode.BLOCKCHAIN_ERROR).toBe('BLOCKCHAIN_ERROR');
      expect(ErrorCode.INSUFFICIENT_BALANCE).toBe('INSUFFICIENT_BALANCE');
      expect(ErrorCode.TOKEN_EXPIRED).toBe('TOKEN_EXPIRED');
      expect(ErrorCode.TOKEN_ALREADY_SPENT).toBe('TOKEN_ALREADY_SPENT');
      expect(ErrorCode.DOUBLE_SPENDING_DETECTED).toBe('DOUBLE_SPENDING_DETECTED');
      expect(ErrorCode.INVALID_SIGNATURE).toBe('INVALID_SIGNATURE');
      expect(ErrorCode.NETWORK_ERROR).toBe('NETWORK_ERROR');
      expect(ErrorCode.INTERNAL_SERVER_ERROR).toBe('INTERNAL_SERVER_ERROR');
    });
  });

  describe('Response Format Consistency', () => {
    it('should ensure all success responses have consistent format', () => {
      const successResponse = ResponseBuilder.success({ data: 'test' }, 'Success');
      
      expect(successResponse).toHaveProperty('success', true);
      expect(successResponse).toHaveProperty('data');
      expect(successResponse).toHaveProperty('timestamp');
      expect(successResponse.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should ensure all error responses have consistent format', () => {
      const errorResponse = ResponseBuilder.error(ErrorCode.VALIDATION_ERROR, 'Error message');
      
      expect(errorResponse).toHaveProperty('success', false);
      expect(errorResponse).toHaveProperty('error');
      expect(errorResponse.error).toHaveProperty('code');
      expect(errorResponse.error).toHaveProperty('message');
      expect(errorResponse).toHaveProperty('timestamp');
      expect(errorResponse.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should include request ID when provided', () => {
      const requestId = 'test-request-123';
      const response = ResponseBuilder.success({ data: 'test' }, 'Success', requestId);
      
      expect(response).toHaveProperty('requestId', requestId);
    });

    it('should not include request ID when not provided', () => {
      const response = ResponseBuilder.success({ data: 'test' }, 'Success');
      
      expect(response.requestId).toBeUndefined();
    });
  });
});