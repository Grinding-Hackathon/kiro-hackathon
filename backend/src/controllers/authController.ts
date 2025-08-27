import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { ethers } from 'ethers';
import crypto from 'crypto';
import { UserDAO } from '../database/dao/UserDAO';
import { generateToken, generateRefreshToken } from '../middleware/auth';
import { CustomError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { ApiResponse } from '../types';
import { config } from '../config/config';
import { sessionService } from '../services/sessionService';

const userDAO = new UserDAO();

export interface LoginRequest {
  walletAddress: string;
  signature: string;
  message: string;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    walletAddress: string;
    publicKey: string;
  };
}

/**
 * @swagger
 * components:
 *   schemas:
 *     LoginRequest:
 *       type: object
 *       required:
 *         - walletAddress
 *         - signature
 *         - message
 *       properties:
 *         walletAddress:
 *           type: string
 *           description: User's Ethereum wallet address
 *           example: "0x742d35Cc6634C0532925a3b8D4C0C8b3C2e1e1e1"
 *         signature:
 *           type: string
 *           description: Signed message for authentication
 *           example: "0x1234567890abcdef..."
 *         message:
 *           type: string
 *           description: Original message that was signed
 *           example: "Login to Offline Wallet - Nonce: 123456"
 *     LoginResponse:
 *       type: object
 *       properties:
 *         token:
 *           type: string
 *           description: JWT authentication token
 *         refreshToken:
 *           type: string
 *           description: JWT refresh token
 *         expiresIn:
 *           type: number
 *           description: Access token expiration time in seconds
 *         user:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *             walletAddress:
 *               type: string
 *             publicKey:
 *               type: string
 */

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Authenticate user with wallet signature
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Authentication successful
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/LoginResponse'
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Authentication failed
 *       500:
 *         description: Internal server error
 */
export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new CustomError('Validation failed', 400, errors.array());
    }

    const { walletAddress, signature, message }: LoginRequest = req.body;

    // Validate nonce message format and expiration
    const nonceValidation = validateNonceMessage(message, walletAddress);
    if (!nonceValidation.valid) {
      throw new CustomError('Invalid or expired nonce message', 400);
    }

    // Verify the signature
    const recoveredAddress = ethers.verifyMessage(message, signature);
    
    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      throw new CustomError('Invalid signature', 401);
    }

    // Find or create user
    let user = await userDAO.findByWalletAddress(walletAddress);
    
    if (!user) {
      // Create new user
      const publicKey = ethers.SigningKey.recoverPublicKey(
        ethers.hashMessage(message),
        signature
      );

      user = await userDAO.create({
        wallet_address: walletAddress,
        public_key: publicKey,
      });

      logger.info('New user created', { 
        userId: user.id, 
        walletAddress: user.wallet_address 
      });
    } else {
      // Update last activity
      await userDAO.updateLastActivity(user.id);
    }

    // Generate JWT tokens
    const token = generateToken({
      id: user.id,
      walletAddress: user.wallet_address,
      publicKey: user.public_key,
    });

    const refreshToken = generateRefreshToken({
      id: user.id,
      walletAddress: user.wallet_address,
      publicKey: user.public_key,
    });

    // Calculate expiration time
    const expiresIn = parseExpirationTime(config.jwt.expiresIn);

    const response: ApiResponse<LoginResponse> = {
      success: true,
      data: {
        token,
        refreshToken,
        expiresIn,
        user: {
          id: user.id,
          walletAddress: user.wallet_address,
          publicKey: user.public_key,
        },
      },
      message: 'Authentication successful',
      timestamp: new Date().toISOString(),
    };

    logger.info('User authenticated successfully', { 
      userId: user.id, 
      walletAddress: user.wallet_address 
    });

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/auth/nonce:
 *   get:
 *     summary: Get authentication nonce for wallet signing
 *     tags: [Authentication]
 *     parameters:
 *       - in: query
 *         name: walletAddress
 *         required: true
 *         schema:
 *           type: string
 *         description: User's wallet address
 *     responses:
 *       200:
 *         description: Nonce generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         nonce:
 *                           type: string
 *                           description: Cryptographically secure random nonce
 *                         message:
 *                           type: string
 *                           description: Formatted message to be signed by wallet
 *                         timestamp:
 *                           type: number
 *                           description: Unix timestamp when nonce was generated
 *                         expiresAt:
 *                           type: string
 *                           format: date-time
 *                           description: When the nonce expires (5 minutes)
 *       400:
 *         description: Invalid wallet address
 */
export const getNonce = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { walletAddress } = req.query;

    if (!walletAddress || typeof walletAddress !== 'string') {
      throw new CustomError('Wallet address is required', 400);
    }

    if (!ethers.isAddress(walletAddress)) {
      throw new CustomError('Invalid wallet address', 400);
    }

    // Generate a cryptographically secure random nonce
    const nonce = generateSecureNonce();
    const timestamp = Date.now();
    const message = `Login to Offline Wallet\nWallet: ${walletAddress}\nNonce: ${nonce}\nTimestamp: ${timestamp}`;

    const response: ApiResponse = {
      success: true,
      data: {
        nonce,
        message,
        timestamp,
        expiresAt: new Date(timestamp + 5 * 60 * 1000).toISOString(), // 5 minutes expiry
      },
      timestamp: new Date().toISOString(),
    };

    logger.debug('Nonce generated', {
      walletAddress,
      nonce: nonce.substring(0, 8) + '...', // Log only first 8 chars for security
      timestamp,
    });

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

// Validation middleware
export const validateLogin = [
  body('walletAddress')
    .isString()
    .notEmpty()
    .custom((value) => {
      if (!ethers.isAddress(value)) {
        throw new Error('Invalid Ethereum address');
      }
      return true;
    })
    .withMessage('Valid wallet address is required'),
  
  body('signature')
    .isString()
    .notEmpty()
    .isLength({ min: 130, max: 132 })
    .withMessage('Valid signature is required'),
  
  body('message')
    .isString()
    .notEmpty()
    .withMessage('Message is required'),
];

export const validateRefreshToken = [
  body('refreshToken')
    .isString()
    .notEmpty()
    .withMessage('Refresh token is required'),
];

/**
 * @swagger
 * components:
 *   schemas:
 *     RefreshTokenRequest:
 *       type: object
 *       required:
 *         - refreshToken
 *       properties:
 *         refreshToken:
 *           type: string
 *           description: Valid refresh token
 *           example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *     RefreshTokenResponse:
 *       type: object
 *       properties:
 *         accessToken:
 *           type: string
 *           description: New JWT access token
 *         refreshToken:
 *           type: string
 *           description: New refresh token (rotated for security)
 *         expiresIn:
 *           type: number
 *           description: Access token expiration time in seconds
 *         user:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *             walletAddress:
 *               type: string
 *             publicKey:
 *               type: string
 *     SessionValidationResponse:
 *       type: object
 *       properties:
 *         valid:
 *           type: boolean
 *           description: Whether the session is valid
 *         user:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *             walletAddress:
 *               type: string
 *             publicKey:
 *               type: string
 *         expiresAt:
 *           type: string
 *           format: date-time
 *           description: When the session expires
 */

/**
 * @swagger
 * /api/v1/auth/refresh:
 *   post:
 *     summary: Refresh access token using refresh token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RefreshTokenRequest'
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/RefreshTokenResponse'
 *       400:
 *         description: Invalid refresh token
 *       401:
 *         description: Refresh token expired or invalid
 *       500:
 *         description: Internal server error
 */
export const refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { refreshToken: oldRefreshToken } = req.body;

    if (!oldRefreshToken) {
      throw new CustomError('Refresh token is required', 400);
    }

    // Verify refresh token using the middleware (already attached user to req)
    const user = (req as any).user;
    
    if (!user) {
      throw new CustomError('Invalid refresh token', 401);
    }

    // Verify user still exists and is active
    const existingUser = await userDAO.findById(user.id);
    if (!existingUser) {
      throw new CustomError('User not found', 401);
    }

    // Generate new access token
    const newAccessToken = generateToken({
      id: existingUser.id,
      walletAddress: existingUser.wallet_address,
      publicKey: existingUser.public_key,
    });

    // Generate new refresh token (token rotation for security)
    const newRefreshToken = generateRefreshToken({
      id: existingUser.id,
      walletAddress: existingUser.wallet_address,
      publicKey: existingUser.public_key,
    });

    // Update user's last activity
    await userDAO.updateLastActivity(existingUser.id);

    // Calculate expiration time
    const expiresIn = parseExpirationTime(config.jwt.expiresIn);

    const response: ApiResponse = {
      success: true,
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn,
        user: {
          id: existingUser.id,
          walletAddress: existingUser.wallet_address,
          publicKey: existingUser.public_key,
        },
      },
      message: 'Token refreshed successfully',
      timestamp: new Date().toISOString(),
    };

    logger.info('Token refreshed successfully', {
      userId: existingUser.id,
      walletAddress: existingUser.wallet_address,
    });

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/auth/validate-session:
 *   get:
 *     summary: Validate current session
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Session validation result
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/SessionValidationResponse'
 *       401:
 *         description: Invalid or expired session
 *       500:
 *         description: Internal server error
 */
export const validateSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];
    const ipAddress = req.ip || '';
    const userAgent = req.get('User-Agent') || '';

    if (!token) {
      throw new CustomError('Authentication token required', 401);
    }

    // Use session service for comprehensive validation
    const validationResult = await sessionService.validateSession(token, ipAddress);

    if (!validationResult.valid) {
      throw new CustomError(validationResult.reason || 'Session validation failed', 401);
    }

    const session = validationResult.session!;

    // Check for suspicious activity
    const isSecure = await sessionService.checkSessionSecurity(
      session.userId,
      ipAddress,
      userAgent
    );

    if (!isSecure) {
      // Invalidate session due to suspicious activity
      await sessionService.invalidateSession(
        token,
        session.userId,
        'Suspicious activity detected'
      );
      throw new CustomError('Session invalidated due to suspicious activity', 401);
    }

    // Verify user still exists and is active
    const existingUser = await userDAO.findById(session.userId);
    if (!existingUser) {
      await sessionService.invalidateSession(token, session.userId, 'User not found');
      throw new CustomError('User not found', 401);
    }

    const response: ApiResponse = {
      success: true,
      data: {
        valid: true,
        user: {
          id: existingUser.id,
          walletAddress: existingUser.wallet_address,
          publicKey: existingUser.public_key,
        },
        expiresAt: session.expiresAt.toISOString(),
        lastActivity: session.lastActivity.toISOString(),
        sessionInfo: {
          issuedAt: session.issuedAt.toISOString(),
          ipAddress: session.ipAddress,
        },
      },
      message: 'Session is valid',
      timestamp: new Date().toISOString(),
    };

    logger.debug('Session validated successfully', {
      userId: existingUser.id,
      walletAddress: existingUser.wallet_address,
      ipAddress,
    });

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/auth/sessions:
 *   get:
 *     summary: Get active sessions for current user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Active sessions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         sessions:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               issuedAt:
 *                                 type: string
 *                                 format: date-time
 *                               expiresAt:
 *                                 type: string
 *                                 format: date-time
 *                               lastActivity:
 *                                 type: string
 *                                 format: date-time
 *                               ipAddress:
 *                                 type: string
 *                         totalSessions:
 *                           type: number
 *       401:
 *         description: Unauthorized
 */
export const getActiveSessions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = (req as any).user;
    
    if (!user) {
      throw new CustomError('Authentication required', 401);
    }

    const sessions = sessionService.getActiveSessions(user.id);

    const response: ApiResponse = {
      success: true,
      data: {
        sessions: sessions.map(session => ({
          issuedAt: session.issuedAt.toISOString(),
          expiresAt: session.expiresAt.toISOString(),
          lastActivity: session.lastActivity.toISOString(),
          ipAddress: session.ipAddress,
        })),
        totalSessions: sessions.length,
      },
      message: 'Active sessions retrieved successfully',
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     summary: Logout user (invalidate token)
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               allDevices:
 *                 type: boolean
 *                 description: Whether to logout from all devices
 *                 default: false
 *     responses:
 *       200:
 *         description: Logout successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       401:
 *         description: Unauthorized
 */
export const logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = (req as any).user;
    const { allDevices = false } = req.body;
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];
    const ipAddress = req.ip || '';
    const userAgent = req.get('User-Agent') || '';

    if (!user || !token) {
      throw new CustomError('Authentication required', 401);
    }

    if (allDevices) {
      // Invalidate all sessions for the user
      await sessionService.invalidateAllUserSessions(
        user.id,
        'User logout from all devices',
        ipAddress,
        userAgent
      );
      
      logger.info('User logged out from all devices', {
        userId: user.id,
        walletAddress: user.walletAddress,
        ipAddress,
      });
    } else {
      // Invalidate only the current session
      await sessionService.invalidateSession(
        token,
        user.id,
        'User logout',
        ipAddress,
        userAgent
      );
      
      logger.info('User logged out', {
        userId: user.id,
        walletAddress: user.walletAddress,
        ipAddress,
      });
    }

    const response: ApiResponse = {
      success: true,
      message: allDevices ? 'Logged out from all devices successfully' : 'Logout successful',
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

// Helper function to generate cryptographically secure nonce
function generateSecureNonce(): string {
  // Generate 32 bytes of random data and convert to hex
  const randomBytes = crypto.randomBytes(32);
  return randomBytes.toString('hex');
}

// Helper function to validate nonce and message format
function validateNonceMessage(message: string, walletAddress: string): { valid: boolean; nonce?: string; timestamp?: number } {
  try {
    // Expected format: "Login to Offline Wallet\nWallet: {address}\nNonce: {nonce}\nTimestamp: {timestamp}"
    const lines = message.split('\n');
    
    if (lines.length !== 4) {
      return { valid: false };
    }

    if (lines[0] !== 'Login to Offline Wallet') {
      return { valid: false };
    }

    const walletMatch = lines[1]?.match(/^Wallet: (.+)$/);
    if (!walletMatch || !walletMatch[1] || walletMatch[1].toLowerCase() !== walletAddress.toLowerCase()) {
      return { valid: false };
    }

    const nonceMatch = lines[2]?.match(/^Nonce: (.+)$/);
    if (!nonceMatch || !nonceMatch[1]) {
      return { valid: false };
    }

    const timestampMatch = lines[3]?.match(/^Timestamp: (\d+)$/);
    if (!timestampMatch || !timestampMatch[1]) {
      return { valid: false };
    }

    const timestamp = parseInt(timestampMatch[1], 10);
    const now = Date.now();
    
    // Check if nonce is not expired (5 minutes)
    if (now - timestamp > 5 * 60 * 1000) {
      return { valid: false };
    }

    return {
      valid: true,
      nonce: nonceMatch[1],
      timestamp,
    };
  } catch (error) {
    return { valid: false };
  }
}

// Helper function to parse expiration time string to seconds
function parseExpirationTime(expiresIn: string): number {
  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (!match || !match[1]) {
    return 3600; // Default 1 hour
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 3600;
    case 'd':
      return value * 86400;
    default:
      return 3600;
  }
}