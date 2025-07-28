import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '@/config/config';
import { CustomError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';

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
  _res: Response,
  next: NextFunction,
): void => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      throw new CustomError('Authorization header is required', 401);
    }

    const token = authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
      throw new CustomError('Token is required', 401);
    }

    // Verify JWT token
    const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;
    
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
      });
      next(new CustomError('Invalid token', 401));
    } else if (error instanceof jwt.TokenExpiredError) {
      logger.warn('Expired JWT token', {
        error: error.message,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });
      next(new CustomError('Token expired', 401));
    } else {
      next(error);
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