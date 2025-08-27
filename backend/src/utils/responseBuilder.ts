import { Request } from 'express';
import { ApiResponse, ErrorResponse, ErrorCode } from '../types';

/**
 * Utility class for building consistent API responses
 */
export class ResponseBuilder {
  /**
   * Build a successful response
   */
  static success<T>(data: T, message?: string, requestId?: string): ApiResponse<T> {
    const response: ApiResponse<T> = {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };

    if (message) {
      response.message = message;
    }

    if (requestId) {
      response.requestId = requestId;
    }

    return response;
  }

  /**
   * Build an error response
   */
  static error(
    code: ErrorCode,
    message: string,
    details?: ErrorResponse['details'],
    requestId?: string
  ): ApiResponse {
    const errorResponse: ErrorResponse = {
      code,
      message,
    };

    if (details) {
      errorResponse.details = details;
    }

    const response: ApiResponse = {
      success: false,
      error: errorResponse,
      timestamp: new Date().toISOString(),
    };

    if (requestId) {
      response.requestId = requestId;
    }

    return response;
  }

  /**
   * Build a validation error response
   */
  static validationError(
    message: string,
    validationErrors: Array<{ field: string; message: string; value?: any }>,
    requestId?: string
  ): ApiResponse {
    const response: ApiResponse = {
      success: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message,
        details: {
          validationErrors,
        },
      },
      timestamp: new Date().toISOString(),
    };

    if (requestId) {
      response.requestId = requestId;
    }

    return response;
  }

  /**
   * Build an authentication error response
   */
  static authenticationError(message: string = 'Authentication required', requestId?: string): ApiResponse {
    const response: ApiResponse = {
      success: false,
      error: {
        code: ErrorCode.AUTHENTICATION_REQUIRED,
        message,
      },
      timestamp: new Date().toISOString(),
    };

    if (requestId) {
      response.requestId = requestId;
    }

    return response;
  }

  /**
   * Build an authorization error response
   */
  static authorizationError(message: string = 'Access denied', requestId?: string): ApiResponse {
    const response: ApiResponse = {
      success: false,
      error: {
        code: ErrorCode.AUTHORIZATION_FAILED,
        message,
      },
      timestamp: new Date().toISOString(),
    };

    if (requestId) {
      response.requestId = requestId;
    }

    return response;
  }

  /**
   * Build a not found error response
   */
  static notFoundError(resource: string, requestId?: string): ApiResponse {
    const response: ApiResponse = {
      success: false,
      error: {
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: `${resource} not found`,
        details: {
          resource,
        },
      },
      timestamp: new Date().toISOString(),
    };

    if (requestId) {
      response.requestId = requestId;
    }

    return response;
  }

  /**
   * Build a business logic error response
   */
  static businessLogicError(
    code: ErrorCode,
    message: string,
    details?: ErrorResponse['details'],
    requestId?: string
  ): ApiResponse {
    const errorResponse: ErrorResponse = {
      code,
      message,
    };

    if (details) {
      errorResponse.details = details;
    }

    const response: ApiResponse = {
      success: false,
      error: errorResponse,
      timestamp: new Date().toISOString(),
    };

    if (requestId) {
      response.requestId = requestId;
    }

    return response;
  }

  /**
   * Build an internal server error response
   */
  static internalServerError(message: string = 'Internal server error', requestId?: string): ApiResponse {
    const response: ApiResponse = {
      success: false,
      error: {
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        message,
      },
      timestamp: new Date().toISOString(),
    };

    if (requestId) {
      response.requestId = requestId;
    }

    return response;
  }

  /**
   * Extract request ID from request headers
   */
  static getRequestId(req: Request): string {
    return (req?.headers?.['x-request-id'] as string) || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Middleware to add request ID to all requests
 */
export const addRequestId = (req: Request, _res: any, next: any) => {
  if (!req.headers['x-request-id']) {
    req.headers['x-request-id'] = ResponseBuilder.getRequestId(req);
  }
  next();
};