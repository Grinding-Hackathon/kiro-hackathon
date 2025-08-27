import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '@/config/config';

import { ErrorResponseBuilder } from '@/utils/errorResponseBuilder';
import { ErrorCode } from '@/types';
import { logger } from '@/utils/logger';
import { tokenBlacklistService } from '../services/tokenBlacklistService';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    walletAddress: string;
    publicKey: string;
  };
}

export interface JWTPayload {
  id: string;
  walletAddress: string;
  publicKey: string;
  iat?: number;
  exp?: number;
}

export const authMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      const { response, statusCode } = ErrorResponseBuilder.buildAuthenticationErrorResponse(
        ErrorCode.AUTHENTICATION_REQUIRED,
        'Authorization header is required. Please provide a valid Bearer token.',
        req
      );
      res.status(statusCode).json(response);
      return;
    }

    // Check for proper Bearer format
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      const { response, statusCode } = ErrorResponseBuilder.buildAuthenticationErrorResponse(
        ErrorCode.TOKEN_MALFORMED,
        'Authorization header must be in format: Bearer <token>',
        req
      );
      res.status(statusCode).json(response);
      return;
    }

    const token = parts[1];
    
    if (!token || token.trim() === '') {
      const { response, statusCode } = ErrorResponseBuilder.buildAuthenticationErrorResponse(
        ErrorCode.INVALID_TOKEN,
        'Token cannot be empty',
        req
      );
      res.status(statusCode).json(response);
      return;
    }

    // Check if token is blacklisted
    if (tokenBlacklistService.isTokenBlacklisted(token)) {
      const { response, statusCode } = ErrorResponseBuilder.buildAuthenticationErrorResponse(
        ErrorCode.TOKEN_EXPIRED,
        'Token has been invalidated. Please login again.',
        req
      );
      res.status(statusCode).json(response);
      return;
    }

    // Verify JWT token
    const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;
    
    // Validate required fields in token payload
    if (!decoded.id || !decoded.walletAddress || !decoded.publicKey) {
      const { response, statusCode } = ErrorResponseBuilder.buildAuthenticationErrorResponse(
        ErrorCode.TOKEN_MALFORMED,
        'Token payload is missing required fields',
        req
      );
      res.status(statusCode).json(response);
      return;
    }
    
    // Attach user info to request
    req.user = {
      id: decoded.id,
      walletAddress: decoded.walletAddress,
      publicKey: decoded.publicKey,
    };

    logger.debug(`User authenticated: ${decoded.walletAddress}`, {
      userId: decoded.id,
      walletAddress: decoded.walletAddress,
      url: req.url,
      method: req.method,
    });

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      logger.warn('Invalid JWT token', {
        error: error.message,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        url: req.url,
      });
      
      const { response, statusCode } = ErrorResponseBuilder.buildAuthenticationErrorResponse(
        ErrorCode.TOKEN_MALFORMED,
        'Invalid token format or signature',
        req
      );
      res.status(statusCode).json(response);
      return;
    } else if (error instanceof jwt.TokenExpiredError) {
      logger.warn('Expired JWT token', {
        error: error.message,
        expiredAt: error.expiredAt,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        url: req.url,
      });
      
      const { response, statusCode } = ErrorResponseBuilder.buildAuthenticationErrorResponse(
        ErrorCode.TOKEN_EXPIRED,
        'Token has expired. Please refresh your token or login again.',
        req
      );
      res.status(statusCode).json(response);
      return;
    } else if (error instanceof jwt.NotBeforeError) {
      logger.warn('JWT token used before valid', {
        error: error.message,
        date: error.date,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        url: req.url,
      });
      
      const { response, statusCode } = ErrorResponseBuilder.buildAuthenticationErrorResponse(
        ErrorCode.INVALID_TOKEN,
        'Token is not yet valid',
        req
      );
      res.status(statusCode).json(response);
      return;
    } else {
      // Unexpected error during authentication
      logger.error('Unexpected error during authentication', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        url: req.url,
      });
      
      const { response, statusCode } = ErrorResponseBuilder.buildInternalServerErrorResponse(
        'Authentication service temporarily unavailable',
        req,
        error instanceof Error ? error : undefined
      );
      res.status(statusCode).json(response);
      return;
    }
  }
};

export const optionalAuthMiddleware = (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): void => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return next();
    }

    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return next();
    }

    // Verify JWT token
    const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;
    
    // Attach user info to request
    req.user = {
      id: decoded.id,
      walletAddress: decoded.walletAddress,
      publicKey: decoded.publicKey,
    };

    next();
  } catch (error) {
    // For optional auth, we don't throw errors, just continue without user
    logger.debug('Optional auth failed, continuing without user', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: req.ip,
    });
    next();
  }
};

export const generateToken = (payload: Omit<JWTPayload, 'iat' | 'exp'>): string => {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  } as jwt.SignOptions);
};

export const generateRefreshToken = (payload: Omit<JWTPayload, 'iat' | 'exp'>): string => {
  return jwt.sign(payload, config.jwt.refreshSecret || config.jwt.secret, {
    expiresIn: config.jwt.refreshExpiresIn || '7d',
  } as jwt.SignOptions);
};

/**
 * Middleware to validate refresh tokens
 */
export const validateRefreshToken = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      const { response, statusCode } = ErrorResponseBuilder.buildAuthenticationErrorResponse(
        ErrorCode.REFRESH_TOKEN_INVALID,
        'Refresh token is required',
        req
      );
      res.status(statusCode).json(response);
      return;
    }

    // Verify refresh token
    const decoded = jwt.verify(
      refreshToken, 
      config.jwt.refreshSecret || config.jwt.secret
    ) as JWTPayload;
    
    // Validate required fields
    if (!decoded.id || !decoded.walletAddress || !decoded.publicKey) {
      const { response, statusCode } = ErrorResponseBuilder.buildAuthenticationErrorResponse(
        ErrorCode.REFRESH_TOKEN_INVALID,
        'Refresh token payload is invalid',
        req
      );
      res.status(statusCode).json(response);
      return;
    }
    
    // Attach user info to request for token refresh
    (req as AuthenticatedRequest).user = {
      id: decoded.id,
      walletAddress: decoded.walletAddress,
      publicKey: decoded.publicKey,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      const { response, statusCode } = ErrorResponseBuilder.buildAuthenticationErrorResponse(
        ErrorCode.REFRESH_TOKEN_EXPIRED,
        'Refresh token has expired. Please login again.',
        req
      );
      res.status(statusCode).json(response);
      return;
    } else if (error instanceof jwt.JsonWebTokenError) {
      const { response, statusCode } = ErrorResponseBuilder.buildAuthenticationErrorResponse(
        ErrorCode.REFRESH_TOKEN_INVALID,
        'Invalid refresh token',
        req
      );
      res.status(statusCode).json(response);
      return;
    } else {
      logger.error('Unexpected error during refresh token validation', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });
      
      const { response, statusCode } = ErrorResponseBuilder.buildInternalServerErrorResponse(
        'Token refresh service temporarily unavailable',
        req,
        error instanceof Error ? error : undefined
      );
      res.status(statusCode).json(response);
      return;
    }
  }
};

/**
 * Middleware to check if user has specific permissions
 */
export const requirePermission = (permission: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      const { response, statusCode } = ErrorResponseBuilder.buildAuthenticationErrorResponse(
        ErrorCode.AUTHENTICATION_REQUIRED,
        'Authentication required to access this resource',
        req
      );
      res.status(statusCode).json(response);
      return;
    }

    // For now, we'll implement basic permission checking
    // In a real system, you'd check user roles/permissions from database
    const userPermissions = getUserPermissions(req.user.id);
    
    if (!userPermissions.includes(permission)) {
      const { response, statusCode } = ErrorResponseBuilder.buildAuthorizationErrorResponse(
        ErrorCode.INSUFFICIENT_PERMISSIONS,
        `Access denied. Required permission: ${permission}`,
        req
      );
      res.status(statusCode).json(response);
      return;
    }

    next();
  };
};

/**
 * Middleware to check if user owns the resource
 */
export const requireResourceOwnership = (resourceIdParam: string = 'id') => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      const { response, statusCode } = ErrorResponseBuilder.buildAuthenticationErrorResponse(
        ErrorCode.AUTHENTICATION_REQUIRED,
        'Authentication required to access this resource',
        req
      );
      res.status(statusCode).json(response);
      return;
    }

    const resourceId = req.params[resourceIdParam];
    const userId = req.user.id;

    // Check if user owns the resource (simplified check)
    if (resourceId !== userId) {
      const { response, statusCode } = ErrorResponseBuilder.buildAuthorizationErrorResponse(
        ErrorCode.ACCESS_DENIED,
        'You can only access your own resources',
        req
      );
      res.status(statusCode).json(response);
      return;
    }

    next();
  };
};

/**
 * Middleware to validate session (check if user account is still active)
 */
export const validateSession = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user) {
      const { response, statusCode } = ErrorResponseBuilder.buildAuthenticationErrorResponse(
        ErrorCode.AUTHENTICATION_REQUIRED,
        'Authentication required',
        req
      );
      res.status(statusCode).json(response);
      return;
    }

    // Check if user account is still active (simplified check)
    const isUserActive = await checkUserAccountStatus(req.user.id);
    
    if (!isUserActive) {
      const { response, statusCode } = ErrorResponseBuilder.buildAuthorizationErrorResponse(
        ErrorCode.ACCOUNT_SUSPENDED,
        'Your account has been suspended. Please contact support.',
        req
      );
      res.status(statusCode).json(response);
      return;
    }

    next();
  } catch (error) {
    logger.error('Error validating user session', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      ip: req.ip,
    });
    
    const { response, statusCode } = ErrorResponseBuilder.buildInternalServerErrorResponse(
      'Session validation service temporarily unavailable',
      req,
      error instanceof Error ? error : undefined
    );
    res.status(statusCode).json(response);
    return;
  }
};

/**
 * Helper function to get user permissions (placeholder implementation)
 */
function getUserPermissions(_userId: string): string[] {
  // In a real implementation, this would query the database
  // For now, return basic permissions
  return ['read', 'write', 'transaction'];
}

/**
 * Helper function to check user account status (placeholder implementation)
 */
async function checkUserAccountStatus(_userId: string): Promise<boolean> {
  // In a real implementation, this would query the database
  // For now, assume all users are active
  return true;
}