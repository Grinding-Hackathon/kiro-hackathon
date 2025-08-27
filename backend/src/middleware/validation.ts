import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult, ValidationChain } from 'express-validator';
import { ResponseBuilder } from '../utils/responseBuilder';
import { logger } from '../utils/logger';

/**
 * Custom validation middleware that handles express-validator results
 */
export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const requestId = ResponseBuilder.getRequestId(req);
    
    // Format validation errors for consistent response
    const validationErrors = errors.array().map(error => ({
      field: error.type === 'field' ? (error as any).path : 'unknown',
      message: error.msg,
      value: error.type === 'field' ? (error as any).value : undefined,
    }));

    // Log validation errors
    logger.warn('Validation errors occurred', {
      url: req.url,
      method: req.method,
      ip: req.ip,
      validationErrors,
      requestId,
    });

    const response = ResponseBuilder.validationError(
      'Validation failed',
      validationErrors,
      requestId
    );

    res.status(400).json(response);
    return;
  }

  next();
};

/**
 * Custom validators for blockchain-specific data
 */
export const customValidators = {
  /**
   * Validate Ethereum address format
   */
  isEthereumAddress: (value: string): boolean => {
    const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
    return ethAddressRegex.test(value);
  },

  /**
   * Validate blockchain signature format
   */
  isValidSignature: (value: string): boolean => {
    // Basic signature format validation (hex string of appropriate length)
    const signatureRegex = /^0x[a-fA-F0-9]{130}$/; // 65 bytes = 130 hex chars
    return signatureRegex.test(value);
  },

  /**
   * Validate transaction hash format
   */
  isTransactionHash: (value: string): boolean => {
    const txHashRegex = /^0x[a-fA-F0-9]{64}$/;
    return txHashRegex.test(value);
  },

  /**
   * Validate UUID format
   */
  isUUID: (value: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
  },

  /**
   * Validate positive amount
   */
  isPositiveAmount: (value: number): boolean => {
    return typeof value === 'number' && value > 0 && Number.isFinite(value);
  },

  /**
   * Validate token amount (must be positive and within reasonable bounds)
   */
  isValidTokenAmount: (value: number): boolean => {
    return customValidators.isPositiveAmount(value) && value <= 1000000; // Max 1M tokens
  },

  /**
   * Validate timestamp (Unix timestamp in seconds)
   */
  isValidTimestamp: (value: number): boolean => {
    return Number.isInteger(value) && value > 0 && value <= Date.now() / 1000 + 86400; // Allow up to 24h in future
  },

  /**
   * Validate pagination parameters
   */
  isValidPaginationPage: (value: any): boolean => {
    const num = typeof value === 'string' ? parseInt(value, 10) : value;
    return Number.isInteger(num) && num >= 1 && num <= 10000;
  },

  isValidPaginationLimit: (value: any): boolean => {
    const num = typeof value === 'string' ? parseInt(value, 10) : value;
    return Number.isInteger(num) && num >= 1 && num <= 1000;
  },
};

/**
 * Validation schemas for different endpoints
 */
export const validationSchemas = {
  // Authentication validation
  auth: {
    login: [
      body('walletAddress')
        .notEmpty()
        .withMessage('Wallet address is required')
        .custom(customValidators.isEthereumAddress)
        .withMessage('Invalid Ethereum address format'),
      body('signature')
        .notEmpty()
        .withMessage('Signature is required')
        .custom(customValidators.isValidSignature)
        .withMessage('Invalid signature format'),
      body('message')
        .notEmpty()
        .withMessage('Message is required')
        .isLength({ min: 1, max: 1000 })
        .withMessage('Message must be between 1 and 1000 characters'),
    ],
    refreshToken: [
      body('refreshToken')
        .notEmpty()
        .withMessage('Refresh token is required')
        .isJWT()
        .withMessage('Invalid refresh token format'),
    ],
  },

  // Transaction validation
  transaction: {
    submit: [
      body('senderId')
        .optional()
        .custom(customValidators.isUUID)
        .withMessage('Invalid sender ID format'),
      body('receiverId')
        .notEmpty()
        .withMessage('Receiver ID is required')
        .custom(customValidators.isUUID)
        .withMessage('Invalid receiver ID format'),
      body('amount')
        .notEmpty()
        .withMessage('Amount is required')
        .isNumeric()
        .withMessage('Amount must be numeric')
        .custom(customValidators.isValidTokenAmount)
        .withMessage('Amount must be positive and within valid range'),
      body('tokenIds')
        .isArray({ min: 1 })
        .withMessage('At least one token ID is required')
        .custom((tokenIds: string[]) => {
          return tokenIds.every(id => customValidators.isUUID(id));
        })
        .withMessage('All token IDs must be valid UUIDs'),
      body('senderSignature')
        .optional()
        .custom(customValidators.isValidSignature)
        .withMessage('Invalid sender signature format'),
      body('receiverSignature')
        .optional()
        .custom(customValidators.isValidSignature)
        .withMessage('Invalid receiver signature format'),
      body('metadata')
        .optional()
        .isObject()
        .withMessage('Metadata must be an object'),
    ],
    sync: [
      query('lastSyncTimestamp')
        .optional()
        .isNumeric()
        .withMessage('Last sync timestamp must be numeric')
        .custom(customValidators.isValidTimestamp)
        .withMessage('Invalid timestamp format'),
      query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer')
        .custom(customValidators.isValidPaginationPage)
        .withMessage('Page number out of valid range'),
      query('limit')
        .optional()
        .isInt({ min: 1, max: 1000 })
        .withMessage('Limit must be between 1 and 1000')
        .custom(customValidators.isValidPaginationLimit)
        .withMessage('Limit out of valid range'),
    ],
    status: [
      param('transactionId')
        .notEmpty()
        .withMessage('Transaction ID is required')
        .custom(customValidators.isUUID)
        .withMessage('Invalid transaction ID format'),
    ],
  },

  // Token validation
  token: {
    validate: [
      body('tokenId')
        .notEmpty()
        .withMessage('Token ID is required')
        .custom(customValidators.isUUID)
        .withMessage('Invalid token ID format'),
      body('signature')
        .notEmpty()
        .withMessage('Token signature is required')
        .custom(customValidators.isValidSignature)
        .withMessage('Invalid signature format'),
    ],
    divide: [
      body('tokenId')
        .notEmpty()
        .withMessage('Token ID is required')
        .custom(customValidators.isUUID)
        .withMessage('Invalid token ID format'),
      body('paymentAmount')
        .notEmpty()
        .withMessage('Payment amount is required')
        .isNumeric()
        .withMessage('Payment amount must be numeric')
        .custom(customValidators.isPositiveAmount)
        .withMessage('Payment amount must be positive'),
      body('changeAmount')
        .optional()
        .isNumeric()
        .withMessage('Change amount must be numeric')
        .custom(customValidators.isPositiveAmount)
        .withMessage('Change amount must be positive'),
      body('signature')
        .notEmpty()
        .withMessage('Token signature is required')
        .custom(customValidators.isValidSignature)
        .withMessage('Invalid signature format'),
    ],
    purchase: [
      body('amount')
        .notEmpty()
        .withMessage('Amount is required')
        .isNumeric()
        .withMessage('Amount must be numeric')
        .custom(customValidators.isValidTokenAmount)
        .withMessage('Amount must be positive and within valid range'),
      body('walletAddress')
        .notEmpty()
        .withMessage('Wallet address is required')
        .custom(customValidators.isEthereumAddress)
        .withMessage('Invalid Ethereum address format'),
    ],
    redeem: [
      body('tokens')
        .isArray({ min: 1 })
        .withMessage('At least one token is required for redemption'),
      body('tokens.*.id')
        .notEmpty()
        .withMessage('Token ID is required')
        .custom(customValidators.isUUID)
        .withMessage('Invalid token ID format'),
      body('tokens.*.signature')
        .notEmpty()
        .withMessage('Token signature is required')
        .custom(customValidators.isValidSignature)
        .withMessage('Invalid signature format'),
    ],
  },

  // Wallet validation
  wallet: {
    balance: [
      param('walletId')
        .optional()
        .custom(customValidators.isUUID)
        .withMessage('Invalid wallet ID format'),
    ],
    history: [
      query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer')
        .custom(customValidators.isValidPaginationPage)
        .withMessage('Page number out of valid range'),
      query('limit')
        .optional()
        .isInt({ min: 1, max: 1000 })
        .withMessage('Limit must be between 1 and 1000')
        .custom(customValidators.isValidPaginationLimit)
        .withMessage('Limit out of valid range'),
      query('type')
        .optional()
        .isIn(['token_purchase', 'token_redemption', 'token_transfer', 'refund'])
        .withMessage('Invalid transaction type'),
      query('status')
        .optional()
        .isIn(['pending', 'completed', 'failed'])
        .withMessage('Invalid transaction status'),
      query('startDate')
        .optional()
        .isISO8601()
        .withMessage('Start date must be in ISO 8601 format'),
      query('endDate')
        .optional()
        .isISO8601()
        .withMessage('End date must be in ISO 8601 format'),
    ],
  },

  // Security validation
  security: {
    reportEvent: [
      body('eventType')
        .notEmpty()
        .withMessage('Event type is required')
        .isIn(['suspicious_activity', 'fraud_attempt', 'security_breach', 'unauthorized_access'])
        .withMessage('Invalid event type'),
      body('severity')
        .notEmpty()
        .withMessage('Severity is required')
        .isIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
        .withMessage('Invalid severity level'),
      body('description')
        .notEmpty()
        .withMessage('Description is required')
        .isLength({ min: 10, max: 1000 })
        .withMessage('Description must be between 10 and 1000 characters'),
      body('metadata')
        .optional()
        .isObject()
        .withMessage('Metadata must be an object'),
    ],
  },

  // Common validation
  common: {
    pagination: [
      query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer')
        .custom(customValidators.isValidPaginationPage)
        .withMessage('Page number out of valid range'),
      query('limit')
        .optional()
        .isInt({ min: 1, max: 1000 })
        .withMessage('Limit must be between 1 and 1000')
        .custom(customValidators.isValidPaginationLimit)
        .withMessage('Limit out of valid range'),
      query('sortBy')
        .optional()
        .matches(/^[a-zA-Z_][a-zA-Z0-9_]*$/)
        .withMessage('Sort field must be a valid field name'),
      query('sortOrder')
        .optional()
        .isIn(['asc', 'desc'])
        .withMessage('Sort order must be either "asc" or "desc"'),
    ],
  },
};

/**
 * Helper function to create validation middleware chain
 */
export const createValidationChain = (validations: ValidationChain[]): ValidationChain[] => {
  return [...validations, handleValidationErrors as any];
};

/**
 * Sanitization middleware for common security issues
 */
export const sanitizeInput = (req: Request, _res: Response, next: NextFunction): void => {
  // Recursively sanitize all string values in request body
  const sanitizeObject = (obj: any): any => {
    if (typeof obj === 'string') {
      // Basic XSS prevention - remove script tags and javascript: protocols
      return obj
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .trim();
    }
    
    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }
    
    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitizeObject(value);
      }
      return sanitized;
    }
    
    return obj;
  };

  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  next();
};