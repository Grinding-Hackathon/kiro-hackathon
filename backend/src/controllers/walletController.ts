import { Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { AuthenticatedRequest } from '../middleware/auth';
import { CustomError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { blockchainService } from '../services/blockchainService';
import { offlineTokenManager } from '../services/offlineTokenManager';
import { OfflineTokenDAO } from '../database/dao/OfflineTokenDAO';
import { TransactionDAO } from '../database/dao/TransactionDAO';
import { ApiResponse, TokenPurchaseRequest, TokenRedemptionRequest } from '../types';

const offlineTokenDAO = new OfflineTokenDAO();
const transactionDAO = new TransactionDAO();

export interface BalanceResponse {
  blockchainBalance: string;
  offlineTokenBalance: string;
  totalBalance: string;
}

export interface TokenPurchaseResponse {
  tokens: Array<{
    id: string;
    amount: number;
    signature: string;
    expiresAt: string;
  }>;
  transactionHash: string;
}

export interface TokenRedemptionResponse {
  transactionHash: string;
  totalAmount: number;
  redeemedTokens: number;
}

/**
 * @swagger
 * components:
 *   schemas:
 *     BalanceResponse:
 *       type: object
 *       properties:
 *         blockchainBalance:
 *           type: string
 *           description: Balance on blockchain
 *         offlineTokenBalance:
 *           type: string
 *           description: Balance in offline tokens
 *         totalBalance:
 *           type: string
 *           description: Total available balance
 *     TokenPurchaseRequest:
 *       type: object
 *       required:
 *         - amount
 *       properties:
 *         amount:
 *           type: number
 *           minimum: 0.01
 *           maximum: 1000000
 *           description: Amount of tokens to purchase
 *     TokenRedemptionRequest:
 *       type: object
 *       required:
 *         - tokens
 *       properties:
 *         tokens:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *               signature:
 *                 type: string
 */

/**
 * @swagger
 * /api/v1/wallet/balance:
 *   get:
 *     summary: Get user's wallet balance
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Balance retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/BalanceResponse'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
export const getBalance = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw new CustomError('User not authenticated', 401);
    }

    const { walletAddress, id: userId } = req.user;

    // Get blockchain balance
    const blockchainBalance = await blockchainService.getTokenBalance(walletAddress);
    
    // Get offline token balance
    const offlineTokenBalance = await offlineTokenDAO.getUserTokenBalance(userId);
    
    // Calculate total balance
    const totalBalance = (parseFloat(blockchainBalance) + parseFloat(offlineTokenBalance)).toString();

    const response: ApiResponse<BalanceResponse> = {
      success: true,
      data: {
        blockchainBalance,
        offlineTokenBalance,
        totalBalance,
      },
      timestamp: new Date().toISOString(),
    };

    logger.debug('Balance retrieved', { 
      userId, 
      walletAddress, 
      blockchainBalance, 
      offlineTokenBalance 
    });

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/wallet/tokens/purchase:
 *   post:
 *     summary: Purchase offline tokens
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TokenPurchaseRequest'
 *     responses:
 *       200:
 *         description: Tokens purchased successfully
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
 *                         tokens:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                               amount:
 *                                 type: number
 *                               signature:
 *                                 type: string
 *                               expiresAt:
 *                                 type: string
 *                         transactionHash:
 *                           type: string
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
export const purchaseTokens = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new CustomError('Validation failed', 400, errors.array());
    }

    if (!req.user) {
      throw new CustomError('User not authenticated', 401);
    }

    const { amount }: TokenPurchaseRequest = req.body;
    const { walletAddress, id: userId } = req.user;

    logger.info('Token purchase initiated', { userId, walletAddress, amount });

    // Issue tokens through OTM
    const tokens = await offlineTokenManager.issueTokens({
      userId,
      walletAddress,
      amount,
    });

    // Store tokens in database
    const tokenRecords = await Promise.all(
      tokens.map(token => 
        offlineTokenDAO.create({
          user_id: token.userId,
          amount: token.amount.toString(),
          signature: token.signature,
          issuer_public_key: offlineTokenManager.getPublicKey(),
          expires_at: token.expiresAt,
        })
      )
    );

    // Create transaction record
    const transaction = await transactionDAO.create({
      sender_id: userId,
      amount: amount.toString(),
      type: 'token_purchase',
    });

    const response: ApiResponse<TokenPurchaseResponse> = {
      success: true,
      data: {
        tokens: tokenRecords.map(token => ({
          id: token.id,
          amount: parseFloat(token.amount),
          signature: token.signature,
          expiresAt: token.expires_at.toISOString(),
        })),
        transactionHash: transaction.blockchain_tx_hash || '',
      },
      message: 'Tokens purchased successfully',
      timestamp: new Date().toISOString(),
    };

    logger.info('Token purchase completed', { 
      userId, 
      walletAddress, 
      amount, 
      tokenCount: tokens.length 
    });

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/wallet/tokens/redeem:
 *   post:
 *     summary: Redeem offline tokens for blockchain tokens
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TokenRedemptionRequest'
 *     responses:
 *       200:
 *         description: Tokens redeemed successfully
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
 *                         transactionHash:
 *                           type: string
 *                         totalAmount:
 *                           type: number
 *                         redeemedTokens:
 *                           type: number
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
export const redeemTokens = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new CustomError('Validation failed', 400, errors.array());
    }

    if (!req.user) {
      throw new CustomError('User not authenticated', 401);
    }

    const { tokens }: TokenRedemptionRequest = req.body;
    const { walletAddress, id: userId } = req.user;

    logger.info('Token redemption initiated', { 
      userId, 
      walletAddress, 
      tokenCount: tokens.length 
    });

    // Redeem tokens through OTM
    const transaction = await offlineTokenManager.redeemTokens(
      { tokens },
      walletAddress
    );

    // Mark tokens as redeemed in database
    const tokenIds = tokens.map(t => t.id);
    await Promise.all(
      tokenIds.map(tokenId => offlineTokenDAO.markAsRedeemed(tokenId))
    );

    // Create transaction record
    await transactionDAO.create({
      receiver_id: userId,
      amount: transaction.amount.toString(),
      type: 'token_redemption',
      ...(transaction.blockchainTxHash && { blockchain_tx_hash: transaction.blockchainTxHash }),
    });

    const response: ApiResponse<TokenRedemptionResponse> = {
      success: true,
      data: {
        transactionHash: transaction.blockchainTxHash || '',
        totalAmount: transaction.amount,
        redeemedTokens: tokens.length,
      },
      message: 'Tokens redeemed successfully',
      timestamp: new Date().toISOString(),
    };

    logger.info('Token redemption completed', { 
      userId, 
      walletAddress, 
      totalAmount: transaction.amount,
      transactionHash: transaction.blockchainTxHash 
    });

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/wallet/keys/public:
 *   get:
 *     summary: Get OTM public key for token validation
 *     tags: [Wallet]
 *     responses:
 *       200:
 *         description: Public key retrieved successfully
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
 *                         publicKey:
 *                           type: string
 *                         walletAddress:
 *                           type: string
 *       500:
 *         description: Internal server error
 */
export const getPublicKey = async (_req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const publicKey = offlineTokenManager.getPublicKey();
    const walletAddress = offlineTokenManager.getWalletAddress();

    const response: ApiResponse = {
      success: true,
      data: {
        publicKey,
        walletAddress,
      },
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

// Validation middleware
export const validateTokenPurchase = [
  body('amount')
    .isNumeric()
    .isFloat({ min: 0.01, max: 1000000 })
    .withMessage('Amount must be between 0.01 and 1,000,000'),
];

export const validateTokenRedemption = [
  body('tokens')
    .isArray({ min: 1 })
    .withMessage('At least one token is required'),
  
  body('tokens.*.id')
    .isString()
    .notEmpty()
    .withMessage('Token ID is required'),
  
  body('tokens.*.signature')
    .isString()
    .notEmpty()
    .withMessage('Token signature is required'),
];