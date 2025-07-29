import { Request, Response, NextFunction } from 'express';
import { logger, auditLogger } from '@/utils/logger';
import { fraudDetectionService } from '@/services/fraudDetectionService';

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
  
  // Log error details
  logger.error(`Error ${statusCode}: ${message}`, {
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    stack: stack,
    details,
  });

  // Format API response
  const response = {
    success: false,
    error: message,
    ...(details && { details }),
    timestamp: new Date().toISOString(),
    ...(process.env['NODE_ENV'] === 'development' && { 
      stack,
      path: req.url,
      method: req.method,
    }),
  };

  res.status(statusCode).json(response);
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

        res.status(403).json({
          success: false,
          error: 'Transaction blocked due to suspicious activity',
          message: 'Your transaction has been blocked for security reasons. Please contact support.',
        });
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

export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  const error = new CustomError(`Route ${req.originalUrl} not found`, 404);
  next(error);
};