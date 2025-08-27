import { Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { AuthenticatedRequest } from '../middleware/auth';
import { CustomError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { offlineTokenManager } from '../services/offlineTokenManager';
import { OfflineTokenDAO } from '../database/dao/OfflineTokenDAO';
import { UserDAO } from '../database/dao/UserDAO';

import { ResponseBuilder } from '../utils/responseBuilder';

const offlineTokenDAO = new OfflineTokenDAO();
const userDAO = new UserDAO();

// Response interfaces matching iOS expectations
export interface TokenValidationResponse {
  valid: boolean;
  token: {
    id: string;
    amount: number;
    ownerId: string;
    signature: string;
    isSpent: boolean;
    expiresAt: Date;
    createdAt: Date;
  };
  validationDetails: {
    signatureValid: boolean;
    notExpired: boolean;
    notSpent: boolean;
    ownershipValid: boolean;
  };
}

export interface TokenDivisionResponse {
  originalToken: {
    id: string;
    amount: number;
    status: string;
  };
  paymentToken: {
    id: string;
    amount: number;
    signature: string;
    issuer: string;
    issuedAt: Date;
    expirationDate: Date;
    isSpent: boolean;
    ownerId: string;
  };
  changeToken?: {
    id: string;
    amount: number;
    signature: string;
    issuer: string;
    issuedAt: Date;
    expirationDate: Date;
    isSpent: boolean;
    ownerId: string;
  };
}

export interface PublicKeyDatabase {
  publicKeys: {
    [userId: string]: {
      publicKey: string;
      walletAddress: string;
      lastUpdated: Date;
    };
  };
  otmPublicKey: string;
  version: string;
}

/**
 * @swagger
 * components:
 *   schemas:
 *     TokenValidationRequest:
 *       type: object
 *       required:
 *         - tokenId
 *       properties:
 *         tokenId:
 *           type: string
 *           description: ID of the token to validate
 *     TokenDivisionRequest:
 *       type: object
 *       required:
 *         - tokenId
 *         - paymentAmount
 *       properties:
 *         tokenId:
 *           type: string
 *           description: ID of the token to divide
 *         paymentAmount:
 *           type: number
 *           minimum: 0.01
 *           description: Amount for the payment token
 */

/**
 * @swagger
 * /api/v1/tokens/validate:
 *   post:
 *     summary: Validate an offline token
 *     tags: [Tokens]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TokenValidationRequest'
 *     responses:
 *       200:
 *         description: Token validation result
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
 *                         valid:
 *                           type: boolean
 *                         token:
 *                           type: object
 *                         validationDetails:
 *                           type: object
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Token not found
 *       500:
 *         description: Internal server error
 */
export const validateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new CustomError('Validation failed', 400, errors.array());
    }

    if (!req.user) {
      throw new CustomError('User not authenticated', 401);
    }

    const { tokenId } = req.body;
    const { id: userId } = req.user;

    logger.info('Token validation initiated', { tokenId, userId });

    // Fetch token from database
    const tokenRecord = await offlineTokenDAO.findById(tokenId);
    if (!tokenRecord) {
      throw new CustomError('Token not found', 404);
    }

    // Convert database record to OfflineToken format for validation
    const token = {
      id: tokenRecord.id,
      userId: tokenRecord.user_id,
      amount: parseFloat(tokenRecord.amount),
      signature: tokenRecord.signature,
      issuedAt: tokenRecord.issued_at,
      expiresAt: tokenRecord.expires_at,
      status: tokenRecord.status as 'active' | 'spent' | 'expired' | 'redeemed',
    };

    // Perform comprehensive validation
    const tokenValidationResult = await offlineTokenManager.validateToken(token);

    // Check ownership
    const ownershipValid = tokenRecord.user_id === userId;

    // Check if token is spent
    const notSpent = tokenRecord.status === 'active';

    // Check expiration
    const notExpired = new Date() <= tokenRecord.expires_at;

    const responseData: TokenValidationResponse = {
      valid: tokenValidationResult.isValid && ownershipValid && notSpent && notExpired,
      token: {
        id: tokenRecord.id,
        amount: parseFloat(tokenRecord.amount),
        ownerId: tokenRecord.user_id,
        signature: tokenRecord.signature,
        isSpent: tokenRecord.status !== 'active',
        expiresAt: tokenRecord.expires_at,
        createdAt: tokenRecord.created_at,
      },
      validationDetails: {
        signatureValid: tokenValidationResult.isValid,
        notExpired,
        notSpent,
        ownershipValid,
      },
    };

    const response = ResponseBuilder.success(
      responseData,
      tokenValidationResult.isValid ? 'Token validation successful' : `Token validation failed: ${tokenValidationResult.error}`,
      ResponseBuilder.getRequestId(req)
    );

    logger.info('Token validation completed', { 
      tokenId, 
      userId, 
      valid: response.data?.valid,
      validationDetails: response.data?.validationDetails 
    });

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/tokens/divide:
 *   post:
 *     summary: Divide a token for payment and change
 *     tags: [Tokens]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TokenDivisionRequest'
 *     responses:
 *       200:
 *         description: Token division successful
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
 *                         originalToken:
 *                           type: object
 *                         paymentToken:
 *                           type: object
 *                         changeToken:
 *                           type: object
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Token not found
 *       422:
 *         description: Business logic error
 *       500:
 *         description: Internal server error
 */
export const divideToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new CustomError('Validation failed', 400, errors.array());
    }

    if (!req.user) {
      throw new CustomError('User not authenticated', 401);
    }

    const { tokenId, paymentAmount } = req.body;
    const { id: userId } = req.user;

    logger.info('Token division initiated', { tokenId, paymentAmount, userId });

    // Fetch and validate original token
    const originalTokenRecord = await offlineTokenDAO.findById(tokenId);
    if (!originalTokenRecord) {
      throw new CustomError('Token not found', 404);
    }

    // Check ownership
    if (originalTokenRecord.user_id !== userId) {
      throw new CustomError('Token does not belong to user', 403);
    }

    // Check token status
    if (originalTokenRecord.status !== 'active') {
      throw new CustomError('Token is not active and cannot be divided', 422);
    }

    const originalAmount = parseFloat(originalTokenRecord.amount);

    // Validate payment amount
    if (paymentAmount <= 0 || paymentAmount > originalAmount) {
      throw new CustomError('Invalid payment amount', 422);
    }

    const changeAmount = originalAmount - paymentAmount;

    // Create payment token
    const paymentTokenData = {
      userId,
      walletAddress: req.user.walletAddress,
      amount: paymentAmount,
    };

    const paymentTokens = await offlineTokenManager.issueTokens(paymentTokenData);
    const paymentToken = paymentTokens[0];

    if (!paymentToken) {
      throw new CustomError('Failed to create payment token', 500);
    }

    // Store payment token in database
    const paymentTokenRecord = await offlineTokenDAO.create({
      user_id: userId,
      amount: paymentAmount.toString(),
      signature: paymentToken.signature,
      issuer_public_key: offlineTokenManager.getPublicKey(),
      expires_at: paymentToken.expiresAt,
      metadata: { parentTokenId: tokenId, type: 'payment' },
    });

    let changeTokenRecord = null;
    let changeToken = null;

    // Create change token if needed
    if (changeAmount > 0) {
      const changeTokenData = {
        userId,
        walletAddress: req.user.walletAddress,
        amount: changeAmount,
      };

      const changeTokens = await offlineTokenManager.issueTokens(changeTokenData);
      changeToken = changeTokens[0];

      if (!changeToken) {
        throw new CustomError('Failed to create change token', 500);
      }

      changeTokenRecord = await offlineTokenDAO.create({
        user_id: userId,
        amount: changeAmount.toString(),
        signature: changeToken.signature,
        issuer_public_key: offlineTokenManager.getPublicKey(),
        expires_at: changeToken.expiresAt,
        metadata: { parentTokenId: tokenId, type: 'change' },
      });
    }

    // Mark original token as spent
    await offlineTokenDAO.update(tokenId, {
      status: 'spent',
      spent_at: new Date(),
      metadata: { 
        ...originalTokenRecord.metadata,
        dividedInto: {
          paymentTokenId: paymentTokenRecord.id,
          changeTokenId: changeTokenRecord?.id,
        }
      },
    });

    const responseData: TokenDivisionResponse = {
      originalToken: {
        id: originalTokenRecord.id,
        amount: originalAmount,
        status: 'spent',
      },
      paymentToken: {
        id: paymentTokenRecord.id,
        amount: paymentAmount,
        signature: paymentTokenRecord.signature,
        issuer: offlineTokenManager.getWalletAddress(),
        issuedAt: paymentTokenRecord.issued_at,
        expirationDate: paymentTokenRecord.expires_at,
        isSpent: false,
        ownerId: userId,
      },
      ...(changeTokenRecord && {
        changeToken: {
          id: changeTokenRecord.id,
          amount: changeAmount,
          signature: changeTokenRecord.signature,
          issuer: offlineTokenManager.getWalletAddress(),
          issuedAt: changeTokenRecord.issued_at,
          expirationDate: changeTokenRecord.expires_at,
          isSpent: false,
          ownerId: userId,
        },
      }),
    };

    const response = ResponseBuilder.success(
      responseData,
      'Token division completed successfully',
      ResponseBuilder.getRequestId(req)
    );

    logger.info('Token division completed', { 
      tokenId, 
      userId, 
      paymentAmount, 
      changeAmount,
      paymentTokenId: paymentTokenRecord.id,
      changeTokenId: changeTokenRecord?.id 
    });

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/tokens/public-keys:
 *   get:
 *     summary: Get public key database in iOS-compatible format
 *     tags: [Tokens]
 *     responses:
 *       200:
 *         description: Public key database retrieved successfully
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
 *                         publicKeys:
 *                           type: object
 *                         otmPublicKey:
 *                           type: string
 *                         version:
 *                           type: string
 *       500:
 *         description: Internal server error
 */
export const getPublicKeyDatabase = async (_req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    logger.info('Public key database request initiated');

    // Fetch all active users from database
    const userRecords = await userDAO.findActiveUsers();

    // Transform to iOS-compatible format
    const publicKeys: { [userId: string]: { publicKey: string; walletAddress: string; lastUpdated: Date } } = {};
    
    userRecords.forEach(record => {
      publicKeys[record.id] = {
        publicKey: record.public_key,
        walletAddress: record.wallet_address,
        lastUpdated: record.updated_at,
      };
    });

    const responseData: PublicKeyDatabase = {
      publicKeys,
      otmPublicKey: offlineTokenManager.getPublicKey(),
      version: '1.0.0', // Version for cache invalidation
    };

    const response = ResponseBuilder.success(
      responseData,
      undefined,
      ResponseBuilder.getRequestId(_req)
    );

    logger.info('Public key database retrieved successfully', { 
      userCount: userRecords.length,
      otmPublicKey: offlineTokenManager.getPublicKey().substring(0, 10) + '...' 
    });

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

// Validation middleware
export const validateTokenValidation = [
  body('tokenId')
    .isString()
    .notEmpty()
    .withMessage('Token ID is required'),
];

export const validateTokenDivision = [
  body('tokenId')
    .isString()
    .notEmpty()
    .withMessage('Token ID is required'),
  
  body('paymentAmount')
    .isNumeric()
    .isFloat({ min: 0.01 })
    .withMessage('Payment amount must be greater than 0.01'),
];