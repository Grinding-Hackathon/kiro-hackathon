import { Request } from 'express';
import { ApiResponse, ErrorResponse, ErrorCode, ValidationError } from '../types';
import { logger } from './logger';
import { errorMonitoringService } from '../services/errorMonitoringService';

/**
 * Error metadata interface for additional error context
 */
export interface ErrorMetadata {
  field?: string;
  reason?: string;
  validationErrors?: ValidationError[];
  correlationId?: string;
  timestamp?: string;
  path?: string;
  method?: string;
  userAgent?: string | undefined;
  ip?: string | undefined;
  userId?: string;
  stack?: string;
  [key: string]: any;
}

/**
 * Error severity levels for logging and monitoring
 */
export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

/**
 * Error category for better error organization
 */
export enum ErrorCategory {
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  BUSINESS_LOGIC = 'BUSINESS_LOGIC',
  EXTERNAL_SERVICE = 'EXTERNAL_SERVICE',
  SYSTEM = 'SYSTEM',
}

/**
 * Enhanced error response builder with detailed error handling
 */
export class ErrorResponseBuilder {
  /**
   * Map error codes to HTTP status codes
   */
  private static readonly ERROR_CODE_TO_STATUS: Record<ErrorCode, number> = {
    // Validation Errors (400)
    [ErrorCode.VALIDATION_ERROR]: 400,
    [ErrorCode.INVALID_REQUEST_FORMAT]: 400,
    [ErrorCode.MISSING_REQUIRED_FIELD]: 400,
    [ErrorCode.INVALID_FIELD_VALUE]: 400,
    [ErrorCode.INVALID_ETHEREUM_ADDRESS]: 400,
    [ErrorCode.INVALID_SIGNATURE_FORMAT]: 400,
    [ErrorCode.INVALID_TOKEN_ID]: 400,
    [ErrorCode.INVALID_AMOUNT]: 400,
    [ErrorCode.INVALID_TIMESTAMP]: 400,
    [ErrorCode.INVALID_PAGINATION_PARAMS]: 400,

    // Authentication Errors (401)
    [ErrorCode.AUTHENTICATION_REQUIRED]: 401,
    [ErrorCode.INVALID_TOKEN]: 401,
    [ErrorCode.TOKEN_EXPIRED]: 401,
    [ErrorCode.TOKEN_MALFORMED]: 401,
    [ErrorCode.INVALID_CREDENTIALS]: 401,
    [ErrorCode.SESSION_EXPIRED]: 401,
    [ErrorCode.REFRESH_TOKEN_INVALID]: 401,
    [ErrorCode.REFRESH_TOKEN_EXPIRED]: 401,

    // Authorization Errors (403)
    [ErrorCode.AUTHORIZATION_FAILED]: 403,
    [ErrorCode.INSUFFICIENT_PERMISSIONS]: 403,
    [ErrorCode.ACCESS_DENIED]: 403,
    [ErrorCode.ACCOUNT_SUSPENDED]: 403,
    [ErrorCode.FRAUD_DETECTED]: 403,
    [ErrorCode.SECURITY_VIOLATION]: 403,

    // Resource Errors (404)
    [ErrorCode.RESOURCE_NOT_FOUND]: 404,
    [ErrorCode.USER_NOT_FOUND]: 404,
    [ErrorCode.WALLET_NOT_FOUND]: 404,
    [ErrorCode.TRANSACTION_NOT_FOUND]: 404,
    [ErrorCode.TOKEN_NOT_FOUND]: 404,
    [ErrorCode.ENDPOINT_NOT_FOUND]: 404,

    // Conflict Errors (409)
    [ErrorCode.RESOURCE_CONFLICT]: 409,
    [ErrorCode.DUPLICATE_TRANSACTION]: 409,
    [ErrorCode.CONCURRENT_MODIFICATION]: 409,

    // Business Logic Errors (422)
    [ErrorCode.BUSINESS_RULE_VIOLATION]: 422,
    [ErrorCode.INSUFFICIENT_BALANCE]: 422,
    [ErrorCode.TOKEN_ALREADY_SPENT]: 422,
    [ErrorCode.TOKEN_ALREADY_EXPIRED]: 422,
    [ErrorCode.DOUBLE_SPENDING_DETECTED]: 422,
    [ErrorCode.INVALID_SIGNATURE]: 422,
    [ErrorCode.SIGNATURE_VERIFICATION_FAILED]: 422,
    [ErrorCode.INVALID_TOKEN_STATE]: 422,
    [ErrorCode.TRANSACTION_ALREADY_PROCESSED]: 422,
    [ErrorCode.INVALID_TRANSACTION_STATE]: 422,
    [ErrorCode.TOKEN_DIVISION_ERROR]: 422,
    [ErrorCode.AMOUNT_MISMATCH]: 422,

    // Rate Limiting (429)
    [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,
    [ErrorCode.TOO_MANY_REQUESTS]: 429,
    [ErrorCode.QUOTA_EXCEEDED]: 429,

    // External Service Errors (502, 503, 504)
    [ErrorCode.BLOCKCHAIN_ERROR]: 502,
    [ErrorCode.BLOCKCHAIN_UNAVAILABLE]: 503,
    [ErrorCode.BLOCKCHAIN_TIMEOUT]: 504,
    [ErrorCode.NETWORK_ERROR]: 502,
    [ErrorCode.EXTERNAL_SERVICE_ERROR]: 502,
    [ErrorCode.DATABASE_ERROR]: 502,
    [ErrorCode.DATABASE_UNAVAILABLE]: 503,

    // Server Errors (500)
    [ErrorCode.INTERNAL_SERVER_ERROR]: 500,
    [ErrorCode.CONFIGURATION_ERROR]: 500,
    [ErrorCode.UNEXPECTED_ERROR]: 500,
    [ErrorCode.SERVICE_UNAVAILABLE]: 503,
    [ErrorCode.MAINTENANCE_MODE]: 503,
  };

  /**
   * Map error codes to categories
   */
  private static readonly ERROR_CODE_TO_CATEGORY: Record<ErrorCode, ErrorCategory> = {
    // Validation
    [ErrorCode.VALIDATION_ERROR]: ErrorCategory.VALIDATION,
    [ErrorCode.INVALID_REQUEST_FORMAT]: ErrorCategory.VALIDATION,
    [ErrorCode.MISSING_REQUIRED_FIELD]: ErrorCategory.VALIDATION,
    [ErrorCode.INVALID_FIELD_VALUE]: ErrorCategory.VALIDATION,
    [ErrorCode.INVALID_ETHEREUM_ADDRESS]: ErrorCategory.VALIDATION,
    [ErrorCode.INVALID_SIGNATURE_FORMAT]: ErrorCategory.VALIDATION,
    [ErrorCode.INVALID_TOKEN_ID]: ErrorCategory.VALIDATION,
    [ErrorCode.INVALID_AMOUNT]: ErrorCategory.VALIDATION,
    [ErrorCode.INVALID_TIMESTAMP]: ErrorCategory.VALIDATION,
    [ErrorCode.INVALID_PAGINATION_PARAMS]: ErrorCategory.VALIDATION,

    // Authentication
    [ErrorCode.AUTHENTICATION_REQUIRED]: ErrorCategory.AUTHENTICATION,
    [ErrorCode.INVALID_TOKEN]: ErrorCategory.AUTHENTICATION,
    [ErrorCode.TOKEN_EXPIRED]: ErrorCategory.AUTHENTICATION,
    [ErrorCode.TOKEN_MALFORMED]: ErrorCategory.AUTHENTICATION,
    [ErrorCode.INVALID_CREDENTIALS]: ErrorCategory.AUTHENTICATION,
    [ErrorCode.SESSION_EXPIRED]: ErrorCategory.AUTHENTICATION,
    [ErrorCode.REFRESH_TOKEN_INVALID]: ErrorCategory.AUTHENTICATION,
    [ErrorCode.REFRESH_TOKEN_EXPIRED]: ErrorCategory.AUTHENTICATION,

    // Authorization
    [ErrorCode.AUTHORIZATION_FAILED]: ErrorCategory.AUTHORIZATION,
    [ErrorCode.INSUFFICIENT_PERMISSIONS]: ErrorCategory.AUTHORIZATION,
    [ErrorCode.ACCESS_DENIED]: ErrorCategory.AUTHORIZATION,
    [ErrorCode.ACCOUNT_SUSPENDED]: ErrorCategory.AUTHORIZATION,
    [ErrorCode.FRAUD_DETECTED]: ErrorCategory.AUTHORIZATION,
    [ErrorCode.SECURITY_VIOLATION]: ErrorCategory.AUTHORIZATION,

    // Business Logic
    [ErrorCode.RESOURCE_NOT_FOUND]: ErrorCategory.BUSINESS_LOGIC,
    [ErrorCode.USER_NOT_FOUND]: ErrorCategory.BUSINESS_LOGIC,
    [ErrorCode.WALLET_NOT_FOUND]: ErrorCategory.BUSINESS_LOGIC,
    [ErrorCode.TRANSACTION_NOT_FOUND]: ErrorCategory.BUSINESS_LOGIC,
    [ErrorCode.TOKEN_NOT_FOUND]: ErrorCategory.BUSINESS_LOGIC,
    [ErrorCode.ENDPOINT_NOT_FOUND]: ErrorCategory.BUSINESS_LOGIC,
    [ErrorCode.RESOURCE_CONFLICT]: ErrorCategory.BUSINESS_LOGIC,
    [ErrorCode.DUPLICATE_TRANSACTION]: ErrorCategory.BUSINESS_LOGIC,
    [ErrorCode.CONCURRENT_MODIFICATION]: ErrorCategory.BUSINESS_LOGIC,
    [ErrorCode.BUSINESS_RULE_VIOLATION]: ErrorCategory.BUSINESS_LOGIC,
    [ErrorCode.INSUFFICIENT_BALANCE]: ErrorCategory.BUSINESS_LOGIC,
    [ErrorCode.TOKEN_ALREADY_SPENT]: ErrorCategory.BUSINESS_LOGIC,
    [ErrorCode.TOKEN_ALREADY_EXPIRED]: ErrorCategory.BUSINESS_LOGIC,
    [ErrorCode.DOUBLE_SPENDING_DETECTED]: ErrorCategory.BUSINESS_LOGIC,
    [ErrorCode.INVALID_SIGNATURE]: ErrorCategory.BUSINESS_LOGIC,
    [ErrorCode.SIGNATURE_VERIFICATION_FAILED]: ErrorCategory.BUSINESS_LOGIC,
    [ErrorCode.INVALID_TOKEN_STATE]: ErrorCategory.BUSINESS_LOGIC,
    [ErrorCode.TRANSACTION_ALREADY_PROCESSED]: ErrorCategory.BUSINESS_LOGIC,
    [ErrorCode.INVALID_TRANSACTION_STATE]: ErrorCategory.BUSINESS_LOGIC,
    [ErrorCode.TOKEN_DIVISION_ERROR]: ErrorCategory.BUSINESS_LOGIC,
    [ErrorCode.AMOUNT_MISMATCH]: ErrorCategory.BUSINESS_LOGIC,
    [ErrorCode.RATE_LIMIT_EXCEEDED]: ErrorCategory.BUSINESS_LOGIC,
    [ErrorCode.TOO_MANY_REQUESTS]: ErrorCategory.BUSINESS_LOGIC,
    [ErrorCode.QUOTA_EXCEEDED]: ErrorCategory.BUSINESS_LOGIC,

    // External Service
    [ErrorCode.BLOCKCHAIN_ERROR]: ErrorCategory.EXTERNAL_SERVICE,
    [ErrorCode.BLOCKCHAIN_UNAVAILABLE]: ErrorCategory.EXTERNAL_SERVICE,
    [ErrorCode.BLOCKCHAIN_TIMEOUT]: ErrorCategory.EXTERNAL_SERVICE,
    [ErrorCode.NETWORK_ERROR]: ErrorCategory.EXTERNAL_SERVICE,
    [ErrorCode.EXTERNAL_SERVICE_ERROR]: ErrorCategory.EXTERNAL_SERVICE,
    [ErrorCode.DATABASE_ERROR]: ErrorCategory.EXTERNAL_SERVICE,
    [ErrorCode.DATABASE_UNAVAILABLE]: ErrorCategory.EXTERNAL_SERVICE,

    // System
    [ErrorCode.INTERNAL_SERVER_ERROR]: ErrorCategory.SYSTEM,
    [ErrorCode.CONFIGURATION_ERROR]: ErrorCategory.SYSTEM,
    [ErrorCode.UNEXPECTED_ERROR]: ErrorCategory.SYSTEM,
    [ErrorCode.SERVICE_UNAVAILABLE]: ErrorCategory.SYSTEM,
    [ErrorCode.MAINTENANCE_MODE]: ErrorCategory.SYSTEM,
  };

  /**
   * Map error codes to severity levels
   */
  private static readonly ERROR_CODE_TO_SEVERITY: Record<ErrorCode, ErrorSeverity> = {
    // Low severity
    [ErrorCode.VALIDATION_ERROR]: ErrorSeverity.LOW,
    [ErrorCode.INVALID_REQUEST_FORMAT]: ErrorSeverity.LOW,
    [ErrorCode.MISSING_REQUIRED_FIELD]: ErrorSeverity.LOW,
    [ErrorCode.INVALID_FIELD_VALUE]: ErrorSeverity.LOW,
    [ErrorCode.INVALID_ETHEREUM_ADDRESS]: ErrorSeverity.LOW,
    [ErrorCode.INVALID_SIGNATURE_FORMAT]: ErrorSeverity.LOW,
    [ErrorCode.INVALID_TOKEN_ID]: ErrorSeverity.LOW,
    [ErrorCode.INVALID_AMOUNT]: ErrorSeverity.LOW,
    [ErrorCode.INVALID_TIMESTAMP]: ErrorSeverity.LOW,
    [ErrorCode.INVALID_PAGINATION_PARAMS]: ErrorSeverity.LOW,
    [ErrorCode.RESOURCE_NOT_FOUND]: ErrorSeverity.LOW,
    [ErrorCode.USER_NOT_FOUND]: ErrorSeverity.LOW,
    [ErrorCode.WALLET_NOT_FOUND]: ErrorSeverity.LOW,
    [ErrorCode.TRANSACTION_NOT_FOUND]: ErrorSeverity.LOW,
    [ErrorCode.TOKEN_NOT_FOUND]: ErrorSeverity.LOW,
    [ErrorCode.ENDPOINT_NOT_FOUND]: ErrorSeverity.LOW,

    // Medium severity
    [ErrorCode.AUTHENTICATION_REQUIRED]: ErrorSeverity.MEDIUM,
    [ErrorCode.INVALID_TOKEN]: ErrorSeverity.MEDIUM,
    [ErrorCode.TOKEN_EXPIRED]: ErrorSeverity.MEDIUM,
    [ErrorCode.TOKEN_MALFORMED]: ErrorSeverity.MEDIUM,
    [ErrorCode.INVALID_CREDENTIALS]: ErrorSeverity.MEDIUM,
    [ErrorCode.SESSION_EXPIRED]: ErrorSeverity.MEDIUM,
    [ErrorCode.REFRESH_TOKEN_INVALID]: ErrorSeverity.MEDIUM,
    [ErrorCode.REFRESH_TOKEN_EXPIRED]: ErrorSeverity.MEDIUM,
    [ErrorCode.AUTHORIZATION_FAILED]: ErrorSeverity.MEDIUM,
    [ErrorCode.INSUFFICIENT_PERMISSIONS]: ErrorSeverity.MEDIUM,
    [ErrorCode.ACCESS_DENIED]: ErrorSeverity.MEDIUM,
    [ErrorCode.RESOURCE_CONFLICT]: ErrorSeverity.MEDIUM,
    [ErrorCode.DUPLICATE_TRANSACTION]: ErrorSeverity.MEDIUM,
    [ErrorCode.CONCURRENT_MODIFICATION]: ErrorSeverity.MEDIUM,
    [ErrorCode.BUSINESS_RULE_VIOLATION]: ErrorSeverity.MEDIUM,
    [ErrorCode.INSUFFICIENT_BALANCE]: ErrorSeverity.MEDIUM,
    [ErrorCode.TOKEN_ALREADY_SPENT]: ErrorSeverity.MEDIUM,
    [ErrorCode.TOKEN_ALREADY_EXPIRED]: ErrorSeverity.MEDIUM,
    [ErrorCode.INVALID_SIGNATURE]: ErrorSeverity.MEDIUM,
    [ErrorCode.SIGNATURE_VERIFICATION_FAILED]: ErrorSeverity.MEDIUM,
    [ErrorCode.INVALID_TOKEN_STATE]: ErrorSeverity.MEDIUM,
    [ErrorCode.TRANSACTION_ALREADY_PROCESSED]: ErrorSeverity.MEDIUM,
    [ErrorCode.INVALID_TRANSACTION_STATE]: ErrorSeverity.MEDIUM,
    [ErrorCode.TOKEN_DIVISION_ERROR]: ErrorSeverity.MEDIUM,
    [ErrorCode.AMOUNT_MISMATCH]: ErrorSeverity.MEDIUM,
    [ErrorCode.RATE_LIMIT_EXCEEDED]: ErrorSeverity.MEDIUM,
    [ErrorCode.TOO_MANY_REQUESTS]: ErrorSeverity.MEDIUM,
    [ErrorCode.QUOTA_EXCEEDED]: ErrorSeverity.MEDIUM,

    // High severity
    [ErrorCode.ACCOUNT_SUSPENDED]: ErrorSeverity.HIGH,
    [ErrorCode.FRAUD_DETECTED]: ErrorSeverity.HIGH,
    [ErrorCode.SECURITY_VIOLATION]: ErrorSeverity.HIGH,
    [ErrorCode.DOUBLE_SPENDING_DETECTED]: ErrorSeverity.HIGH,
    [ErrorCode.BLOCKCHAIN_ERROR]: ErrorSeverity.HIGH,
    [ErrorCode.BLOCKCHAIN_UNAVAILABLE]: ErrorSeverity.HIGH,
    [ErrorCode.BLOCKCHAIN_TIMEOUT]: ErrorSeverity.HIGH,
    [ErrorCode.NETWORK_ERROR]: ErrorSeverity.HIGH,
    [ErrorCode.EXTERNAL_SERVICE_ERROR]: ErrorSeverity.HIGH,
    [ErrorCode.DATABASE_ERROR]: ErrorSeverity.HIGH,
    [ErrorCode.DATABASE_UNAVAILABLE]: ErrorSeverity.HIGH,

    // Critical severity
    [ErrorCode.INTERNAL_SERVER_ERROR]: ErrorSeverity.CRITICAL,
    [ErrorCode.CONFIGURATION_ERROR]: ErrorSeverity.CRITICAL,
    [ErrorCode.UNEXPECTED_ERROR]: ErrorSeverity.CRITICAL,
    [ErrorCode.SERVICE_UNAVAILABLE]: ErrorSeverity.CRITICAL,
    [ErrorCode.MAINTENANCE_MODE]: ErrorSeverity.CRITICAL,
  };

  /**
   * Generate a correlation ID for error tracking
   */
  private static generateCorrelationId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Extract request metadata for error context
   */
  private static extractRequestMetadata(req: Request): Partial<ErrorMetadata> {
    return {
      path: req.path,
      method: req.method,
      userAgent: req.get('User-Agent') || undefined,
      ip: req.ip || req.connection.remoteAddress || undefined,
      userId: (req as any).user?.id,
    };
  }

  /**
   * Get HTTP status code for error code
   */
  static getStatusCode(errorCode: ErrorCode): number {
    return this.ERROR_CODE_TO_STATUS[errorCode] || 500;
  }

  /**
   * Get error category for error code
   */
  static getCategory(errorCode: ErrorCode): ErrorCategory {
    return this.ERROR_CODE_TO_CATEGORY[errorCode] || ErrorCategory.SYSTEM;
  }

  /**
   * Get error severity for error code
   */
  static getSeverity(errorCode: ErrorCode): ErrorSeverity {
    return this.ERROR_CODE_TO_SEVERITY[errorCode] || ErrorSeverity.MEDIUM;
  }

  /**
   * Build a detailed error response
   */
  static buildErrorResponse(
    errorCode: ErrorCode,
    message: string,
    req?: Request,
    metadata?: ErrorMetadata,
    stack?: string
  ): { response: ApiResponse; statusCode: number } {
    const correlationId = metadata?.correlationId || this.generateCorrelationId();
    const timestamp = new Date().toISOString();
    const statusCode = this.getStatusCode(errorCode);
    const category = this.getCategory(errorCode);
    const severity = this.getSeverity(errorCode);

    // Extract request metadata if request is provided
    const requestMetadata = req ? this.extractRequestMetadata(req) : {};

    // Build error details
    const errorDetails: ErrorMetadata = {
      ...requestMetadata,
      ...metadata,
      correlationId,
      timestamp,
      category,
      severity,
    };

    // Add stack trace in development mode
    if (process.env['NODE_ENV'] === 'development' && stack) {
      errorDetails.stack = stack;
    }

    // Build error response
    const errorResponse: ErrorResponse = {
      code: errorCode,
      message,
      details: errorDetails,
    };

    const response: ApiResponse = {
      success: false,
      error: errorResponse,
      timestamp,
      requestId: correlationId,
    };

    // Log error based on severity
    const logData = {
      errorCode,
      message,
      statusCode,
      category,
      severity,
      correlationId,
      ...requestMetadata,
      ...(metadata && { metadata }),
    };

    switch (severity) {
      case ErrorSeverity.CRITICAL:
        logger.error('Critical error occurred', logData);
        break;
      case ErrorSeverity.HIGH:
        logger.error('High severity error occurred', logData);
        break;
      case ErrorSeverity.MEDIUM:
        logger.warn('Medium severity error occurred', logData);
        break;
      case ErrorSeverity.LOW:
      default:
        logger.info('Low severity error occurred', logData);
        break;
    }

    // Track error for monitoring and alerting
    const trackingMetadata = {
      correlationId,
      ...requestMetadata,
      ...metadata,
    };
    
    errorMonitoringService.trackError(errorCode, severity, category, trackingMetadata).catch(error => {
      logger.error('Failed to track error for monitoring', { error, errorCode });
    });

    return { response, statusCode };
  }

  /**
   * Build validation error response
   */
  static buildValidationErrorResponse(
    message: string,
    validationErrors: ValidationError[],
    req?: Request
  ): { response: ApiResponse; statusCode: number } {
    return this.buildErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      message,
      req,
      { validationErrors }
    );
  }

  /**
   * Build authentication error response
   */
  static buildAuthenticationErrorResponse(
    errorCode: ErrorCode = ErrorCode.AUTHENTICATION_REQUIRED,
    message: string = 'Authentication required',
    req?: Request
  ): { response: ApiResponse; statusCode: number } {
    return this.buildErrorResponse(errorCode, message, req);
  }

  /**
   * Build authorization error response
   */
  static buildAuthorizationErrorResponse(
    errorCode: ErrorCode = ErrorCode.AUTHORIZATION_FAILED,
    message: string = 'Access denied',
    req?: Request,
    metadata?: ErrorMetadata
  ): { response: ApiResponse; statusCode: number } {
    return this.buildErrorResponse(errorCode, message, req, metadata);
  }

  /**
   * Build business logic error response
   */
  static buildBusinessLogicErrorResponse(
    errorCode: ErrorCode,
    message: string,
    req?: Request,
    metadata?: ErrorMetadata
  ): { response: ApiResponse; statusCode: number } {
    return this.buildErrorResponse(errorCode, message, req, metadata);
  }

  /**
   * Build external service error response
   */
  static buildExternalServiceErrorResponse(
    errorCode: ErrorCode,
    message: string,
    req?: Request,
    metadata?: ErrorMetadata
  ): { response: ApiResponse; statusCode: number } {
    return this.buildErrorResponse(errorCode, message, req, metadata);
  }

  /**
   * Build internal server error response
   */
  static buildInternalServerErrorResponse(
    message: string = 'Internal server error',
    req?: Request,
    error?: Error
  ): { response: ApiResponse; statusCode: number } {
    return this.buildErrorResponse(
      ErrorCode.INTERNAL_SERVER_ERROR,
      message,
      req,
      undefined,
      error?.stack
    );
  }
}