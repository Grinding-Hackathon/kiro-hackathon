import { Request, Response, NextFunction } from 'express';
import { logger, auditLogger } from '@/utils/logger';
import { fraudDetectionService } from '@/services/fraudDetectionService';
import { ResponseBuilder } from '../utils/responseBuilder';
import { ErrorResponseBuilder } from '../utils/errorResponseBuilder';
import { ErrorCode } from '../types';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export class CustomError extends Error implements AppError {
  public statusCode: number;
  public isOperational: boolean;
  public details?: any;

  constructor(message: string, statusCode: number = 500, details?: any, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

export const createError = (message: string, statusCode: number = 500): CustomError => {
  return new CustomError(message, statusCode);
};

export const errorHandler = (
  error: AppError & { details?: any },
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const { statusCode = 500, message, stack, details } = error;
  
  // Map HTTP status codes to error codes with more granular detection
  let errorCode: ErrorCode;
  switch (statusCode) {
    case 400:
      // Determine specific validation error type
      if (message.toLowerCase().includes('ethereum') || message.toLowerCase().includes('address')) {
        errorCode = ErrorCode.INVALID_ETHEREUM_ADDRESS;
      } else if (message.toLowerCase().includes('signature')) {
        errorCode = ErrorCode.INVALID_SIGNATURE_FORMAT;
      } else if (message.toLowerCase().includes('token') && message.toLowerCase().includes('id')) {
        errorCode = ErrorCode.INVALID_TOKEN_ID;
      } else if (message.toLowerCase().includes('amount')) {
        errorCode = ErrorCode.INVALID_AMOUNT;
      } else if (message.toLowerCase().includes('timestamp')) {
        errorCode = ErrorCode.INVALID_TIMESTAMP;
      } else if (message.toLowerCase().includes('pagination')) {
        errorCode = ErrorCode.INVALID_PAGINATION_PARAMS;
      } else if (message.toLowerCase().includes('required')) {
        errorCode = ErrorCode.MISSING_REQUIRED_FIELD;
      } else {
        errorCode = ErrorCode.VALIDATION_ERROR;
      }
      break;
    case 401:
      // Determine specific authentication error type
      if (message.toLowerCase().includes('expired')) {
        errorCode = ErrorCode.TOKEN_EXPIRED;
      } else if (message.toLowerCase().includes('malformed') || message.toLowerCase().includes('invalid')) {
        errorCode = ErrorCode.TOKEN_MALFORMED;
      } else if (message.toLowerCase().includes('credentials')) {
        errorCode = ErrorCode.INVALID_CREDENTIALS;
      } else if (message.toLowerCase().includes('session')) {
        errorCode = ErrorCode.SESSION_EXPIRED;
      } else if (message.toLowerCase().includes('refresh')) {
        errorCode = ErrorCode.REFRESH_TOKEN_INVALID;
      } else {
        errorCode = ErrorCode.AUTHENTICATION_REQUIRED;
      }
      break;
    case 403:
      // Determine specific authorization error type
      if (message.toLowerCase().includes('fraud')) {
        errorCode = ErrorCode.FRAUD_DETECTED;
      } else if (message.toLowerCase().includes('suspended')) {
        errorCode = ErrorCode.ACCOUNT_SUSPENDED;
      } else if (message.toLowerCase().includes('security')) {
        errorCode = ErrorCode.SECURITY_VIOLATION;
      } else if (message.toLowerCase().includes('permission')) {
        errorCode = ErrorCode.INSUFFICIENT_PERMISSIONS;
      } else {
        errorCode = ErrorCode.AUTHORIZATION_FAILED;
      }
      break;
    case 404:
      // Determine specific resource not found error type
      if (message.toLowerCase().includes('user')) {
        errorCode = ErrorCode.USER_NOT_FOUND;
      } else if (message.toLowerCase().includes('wallet')) {
        errorCode = ErrorCode.WALLET_NOT_FOUND;
      } else if (message.toLowerCase().includes('transaction')) {
        errorCode = ErrorCode.TRANSACTION_NOT_FOUND;
      } else if (message.toLowerCase().includes('token')) {
        errorCode = ErrorCode.TOKEN_NOT_FOUND;
      } else if (message.toLowerCase().includes('endpoint') || message.toLowerCase().includes('route')) {
        errorCode = ErrorCode.ENDPOINT_NOT_FOUND;
      } else {
        errorCode = ErrorCode.RESOURCE_NOT_FOUND;
      }
      break;
    case 409:
      // Determine specific conflict error type
      if (message.toLowerCase().includes('duplicate')) {
        errorCode = ErrorCode.DUPLICATE_TRANSACTION;
      } else if (message.toLowerCase().includes('concurrent') || message.toLowerCase().includes('modification')) {
        errorCode = ErrorCode.CONCURRENT_MODIFICATION;
      } else {
        errorCode = ErrorCode.RESOURCE_CONFLICT;
      }
      break;
    case 422:
      // Business logic errors - determine specific code from message or details
      if (message.toLowerCase().includes('token') && message.toLowerCase().includes('expired')) {
        errorCode = ErrorCode.TOKEN_ALREADY_EXPIRED;
      } else if (message.toLowerCase().includes('token') && message.toLowerCase().includes('spent')) {
        errorCode = ErrorCode.TOKEN_ALREADY_SPENT;
      } else if (message.toLowerCase().includes('balance')) {
        errorCode = ErrorCode.INSUFFICIENT_BALANCE;
      } else if (message.toLowerCase().includes('signature') && message.toLowerCase().includes('verification')) {
        errorCode = ErrorCode.SIGNATURE_VERIFICATION_FAILED;
      } else if (message.toLowerCase().includes('signature')) {
        errorCode = ErrorCode.INVALID_SIGNATURE;
      } else if (message.toLowerCase().includes('double')) {
        errorCode = ErrorCode.DOUBLE_SPENDING_DETECTED;
      } else if (message.toLowerCase().includes('token') && message.toLowerCase().includes('state')) {
        errorCode = ErrorCode.INVALID_TOKEN_STATE;
      } else if (message.toLowerCase().includes('transaction') && message.toLowerCase().includes('processed')) {
        errorCode = ErrorCode.TRANSACTION_ALREADY_PROCESSED;
      } else if (message.toLowerCase().includes('transaction') && message.toLowerCase().includes('state')) {
        errorCode = ErrorCode.INVALID_TRANSACTION_STATE;
      } else if (message.toLowerCase().includes('division')) {
        errorCode = ErrorCode.TOKEN_DIVISION_ERROR;
      } else if (message.toLowerCase().includes('amount') && message.toLowerCase().includes('mismatch')) {
        errorCode = ErrorCode.AMOUNT_MISMATCH;
      } else {
        errorCode = ErrorCode.BUSINESS_RULE_VIOLATION;
      }
      break;
    case 429:
      // Determine specific rate limiting error type
      if (message.toLowerCase().includes('quota')) {
        errorCode = ErrorCode.QUOTA_EXCEEDED;
      } else if (message.toLowerCase().includes('many')) {
        errorCode = ErrorCode.TOO_MANY_REQUESTS;
      } else {
        errorCode = ErrorCode.RATE_LIMIT_EXCEEDED;
      }
      break;
    case 502:
      // External service errors
      if (message.toLowerCase().includes('blockchain')) {
        errorCode = ErrorCode.BLOCKCHAIN_ERROR;
      } else if (message.toLowerCase().includes('database')) {
        errorCode = ErrorCode.DATABASE_ERROR;
      } else if (message.toLowerCase().includes('network')) {
        errorCode = ErrorCode.NETWORK_ERROR;
      } else {
        errorCode = ErrorCode.EXTERNAL_SERVICE_ERROR;
      }
      break;
    case 503:
      // Service unavailable errors
      if (message.toLowerCase().includes('blockchain')) {
        errorCode = ErrorCode.BLOCKCHAIN_UNAVAILABLE;
      } else if (message.toLowerCase().includes('database')) {
        errorCode = ErrorCode.DATABASE_UNAVAILABLE;
      } else if (message.toLowerCase().includes('maintenance')) {
        errorCode = ErrorCode.MAINTENANCE_MODE;
      } else {
        errorCode = ErrorCode.SERVICE_UNAVAILABLE;
      }
      break;
    case 504:
      // Timeout errors
      if (message.toLowerCase().includes('blockchain')) {
        errorCode = ErrorCode.BLOCKCHAIN_TIMEOUT;
      } else {
        errorCode = ErrorCode.NETWORK_ERROR;
      }
      break;
    default:
      // Server errors
      if (message.toLowerCase().includes('configuration')) {
        errorCode = ErrorCode.CONFIGURATION_ERROR;
      } else if (message.toLowerCase().includes('unexpected')) {
        errorCode = ErrorCode.UNEXPECTED_ERROR;
      } else {
        errorCode = ErrorCode.INTERNAL_SERVER_ERROR;
      }
  }

  // Use enhanced error response builder
  const { response, statusCode: finalStatusCode } = ErrorResponseBuilder.buildErrorResponse(
    errorCode,
    message,
    req,
    details,
    stack
  );

  res.status(finalStatusCode).json(response);
};

export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Middleware to integrate fraud detection with transactions
export const fraudDetectionMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Only apply to transaction-related endpoints
    const transactionEndpoints = ['/api/tokens/purchase', '/api/tokens/redeem', '/api/wallet/transfer'];
    
    if (!transactionEndpoints.some(endpoint => req.path.includes(endpoint))) {
      return next();
    }

    // Extract transaction details from request
    const userId = (req as any).user?.id;
    const amount = req.body?.amount;
    const recipientId = req.body?.recipientId;
    const ip = req.ip;
    
    if (userId && amount) {
      // Analyze transaction for fraud
      const alerts = await fraudDetectionService.analyzeTransaction({
        userId,
        amount: parseFloat(amount),
        recipientId,
        type: req.path.includes('purchase') ? 'token_purchase' : 
              req.path.includes('redeem') ? 'token_redemption' : 'transfer',
        ip,
      });

      // If critical alerts are found, block the transaction
      const criticalAlerts = alerts.filter(alert => alert.severity === 'CRITICAL');
      if (criticalAlerts.length > 0) {
        await auditLogger.logSecurity({
          userId,
          action: 'FRAUD_DETECTED',
          severity: 'CRITICAL',
          ip: ip || 'unknown',
          userAgent: req.get('User-Agent'),
          details: {
            alerts: criticalAlerts,
            transactionDetails: { amount, recipientId },
          },
        });

        const response = ResponseBuilder.authorizationError(
          'Your transaction has been blocked for security reasons. Please contact support.',
          ResponseBuilder.getRequestId(req)
        );
        res.status(403).json(response);
        return;
      }

      // Log high severity alerts but allow transaction
      const highAlerts = alerts.filter(alert => alert.severity === 'HIGH');
      if (highAlerts.length > 0) {
        logger.warn('High severity fraud alerts detected but transaction allowed', {
          userId,
          alerts: highAlerts,
          transactionDetails: { amount, recipientId },
        });
      }
    }

    next();
  } catch (error) {
    logger.error('Error in fraud detection middleware', { error });
    // Don't block transaction on fraud detection errors
    next();
  }
};

export const notFoundHandler = (req: Request, res: Response, _next: NextFunction): void => {
  const { response, statusCode } = ErrorResponseBuilder.buildErrorResponse(
    ErrorCode.RESOURCE_NOT_FOUND,
    `Route ${req.originalUrl} not found`,
    req
  );
  res.status(statusCode).json(response);
};