import { Response, NextFunction } from 'express';
import { body, validationResult, param } from 'express-validator';
import { AuthenticatedRequest } from '../middleware/auth';
import { CustomError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { blockchainService } from '../services/blockchainService';
import { offlineTokenManager } from '../services/offlineTokenManager';
import { OfflineTokenDAO } from '../database/dao/OfflineTokenDAO';
import { TransactionDAO } from '../database/dao/TransactionDAO';
import { ResponseBuilder } from '../utils/responseBuilder';

import { TokenPurchaseRequest, TokenRedemptionRequest, PaginatedResponse } from '../types';

const offlineTokenDAO = new OfflineTokenDAO();
const transactionDAO = new TransactionDAO();

export interface BalanceResponse {
  blockchainBalance: string;
  offlineTokenBalance: string;
  totalBalance: string;
}

export interface WalletBalanceResponse {
  walletId: string;
  walletAddress: string;
  balances: {
    blockchain: {
      amount: number;
      currency: string;
      lastUpdated: Date;
    };
    offline: {
      amount: number;
      tokenCount: number;
      lastUpdated: Date;
    };
    pending: {
      amount: number;
      transactionCount: number;
    };
  };
  totalBalance: number;
}

export interface TransactionHistoryItem {
  id: string;
  type: string;
  amount: number;
  status: string;
  timestamp: Date;
  blockchainTxHash?: string | undefined;
  counterparty?: string | undefined;
  metadata?: any;
}

export interface TransactionHistoryResponse extends PaginatedResponse<TransactionHistoryItem> {
  filters: {
    type?: string;
    status?: string;
    dateFrom?: Date;
    dateTo?: Date;
  };
}

export interface TokenPurchaseResponse {
  tokens: Array<{
    id: string;
    amount: number;
    signature: string;
    issuer: string;
    issuedAt: string;
    expirationDate: string;
    isSpent: boolean;
    spentAt?: string | undefined;
    divisions: any[];
  }>;
  transactionId: string;
}

export interface TokenRedemptionResponse {
  transactionHash: string;
  blockchainBalance: number;
}

/**
 * @swagger
 * components:
 *   schemas:
 *     WalletBalanceResponse:
 *       type: object
 *       properties:
 *         walletId:
 *           type: string
 *           description: Wallet identifier
 *         walletAddress:
 *           type: string
 *           description: Blockchain wallet address
 *         balances:
 *           type: object
 *           properties:
 *             blockchain:
 *               type: object
 *               properties:
 *                 amount:
 *                   type: number
 *                   description: Balance on blockchain
 *                 currency:
 *                   type: string
 *                   description: Currency type
 *                 lastUpdated:
 *                   type: string
 *                   format: date-time
 *                   description: Last update timestamp
 *             offline:
 *               type: object
 *               properties:
 *                 amount:
 *                   type: number
 *                   description: Balance in offline tokens
 *                 tokenCount:
 *                   type: number
 *                   description: Number of offline tokens
 *                 lastUpdated:
 *                   type: string
 *                   format: date-time
 *                   description: Last update timestamp
 *             pending:
 *               type: object
 *               properties:
 *                 amount:
 *                   type: number
 *                   description: Pending transaction amount
 *                 transactionCount:
 *                   type: number
 *                   description: Number of pending transactions
 *         totalBalance:
 *           type: number
 *           description: Total available balance
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
 *                       $ref: '#/components/schemas/WalletBalanceResponse'
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

    const responseData: WalletBalanceResponse = {
      walletId: userId,
      walletAddress,
      balances: {
        blockchain: {
          amount: parseFloat(blockchainBalance),
          currency: 'OWT',
          lastUpdated: new Date(),
        },
        offline: {
          amount: parseFloat(offlineTokenBalance),
          tokenCount: await offlineTokenDAO.getUserTokenCount(userId),
          lastUpdated: new Date(),
        },
        pending: {
          amount: await getPendingTransactionAmount(userId),
          transactionCount: await getPendingTransactionCount(userId),
        },
      },
      totalBalance: parseFloat(totalBalance),
    };

    const response = ResponseBuilder.success(
      responseData,
      undefined,
      ResponseBuilder.getRequestId(req)
    );

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
 * /api/v1/wallet/{walletId}/balance:
 *   get:
 *     summary: Get balance for specific wallet ID
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: walletId
 *         required: true
 *         schema:
 *           type: string
 *         description: Wallet ID to get balance for
 *     responses:
 *       200:
 *         description: Wallet balance retrieved successfully
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
 *                         walletId:
 *                           type: string
 *                         walletAddress:
 *                           type: string
 *                         balances:
 *                           type: object
 *                           properties:
 *                             blockchain:
 *                               type: object
 *                               properties:
 *                                 amount:
 *                                   type: number
 *                                 currency:
 *                                   type: string
 *                                 lastUpdated:
 *                                   type: string
 *                                   format: date-time
 *                             offline:
 *                               type: object
 *                               properties:
 *                                 amount:
 *                                   type: number
 *                                 tokenCount:
 *                                   type: number
 *                                 lastUpdated:
 *                                   type: string
 *                                   format: date-time
 *                             pending:
 *                               type: object
 *                               properties:
 *                                 amount:
 *                                   type: number
 *                                 transactionCount:
 *                                   type: number
 *                         totalBalance:
 *                           type: number
 *       400:
 *         description: Invalid wallet ID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied to wallet
 *       404:
 *         description: Wallet not found
 *       500:
 *         description: Internal server error
 */
export const getWalletBalanceById = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new CustomError('Validation failed', 400, errors.array());
    }

    if (!req.user) {
      throw new CustomError('User not authenticated', 401);
    }

    const { walletId } = req.params;
    const currentUserId = req.user.id;

    // Validate wallet ID format
    if (!walletId || walletId.trim() === '') {
      throw new CustomError('Invalid wallet ID', 400);
    }

    // Check if the wallet belongs to the current user or if user has access
    let targetUser;
    if (walletId === currentUserId) {
      targetUser = req.user;
    } else {
      // For security, only allow users to access their own wallet
      // In future, this could be extended for shared wallets or admin access
      throw new CustomError('Access denied to wallet', 403);
    }

    // Get blockchain balance
    const blockchainBalance = await blockchainService.getTokenBalance(targetUser.walletAddress);
    
    // Get offline token balance and count
    const offlineTokenBalance = await offlineTokenDAO.getUserTokenBalance(walletId);
    const offlineTokenCount = await offlineTokenDAO.getUserTokenCount(walletId);
    
    // Get pending transaction amounts
    const pendingAmount = await getPendingTransactionAmount(walletId);
    const pendingCount = await getPendingTransactionCount(walletId);
    
    // Calculate total balance
    const totalBalance = parseFloat(blockchainBalance) + parseFloat(offlineTokenBalance) + pendingAmount;

    const responseData: WalletBalanceResponse = {
      walletId,
      walletAddress: targetUser.walletAddress,
      balances: {
        blockchain: {
          amount: parseFloat(blockchainBalance),
          currency: 'OWT',
          lastUpdated: new Date(),
        },
        offline: {
          amount: parseFloat(offlineTokenBalance),
          tokenCount: offlineTokenCount,
          lastUpdated: new Date(),
        },
        pending: {
          amount: pendingAmount,
          transactionCount: pendingCount,
        },
      },
      totalBalance,
    };

    const response = ResponseBuilder.success(
      responseData,
      undefined,
      ResponseBuilder.getRequestId(req)
    );

    logger.debug('Wallet balance retrieved', { 
      walletId, 
      walletAddress: targetUser.walletAddress, 
      totalBalance,
      requestedBy: currentUserId
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

    const responseData: TokenPurchaseResponse = {
      tokens: tokenRecords.map(token => ({
        id: token.id,
        amount: parseFloat(token.amount),
        signature: token.signature,
        issuer: offlineTokenManager.getWalletAddress(),
        issuedAt: token.issued_at.toISOString(),
        expirationDate: token.expires_at.toISOString(),
        isSpent: false,

        divisions: [],
      })),
      transactionId: transaction.id,
    };

    const response = ResponseBuilder.success(
      responseData,
      'Tokens purchased successfully',
      ResponseBuilder.getRequestId(req)
    );

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

    // Get updated blockchain balance after redemption
    const updatedBlockchainBalance = await blockchainService.getTokenBalance(walletAddress);

    const responseData: TokenRedemptionResponse = {
      transactionHash: transaction.blockchainTxHash || '',
      blockchainBalance: parseFloat(updatedBlockchainBalance),
    };

    const response = ResponseBuilder.success(
      responseData,
      'Tokens redeemed successfully',
      ResponseBuilder.getRequestId(req)
    );

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
 *     summary: Get OTM public key for token validation (deprecated - use /api/v1/tokens/public-keys)
 *     tags: [Wallet]
 *     deprecated: true
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

    const responseData = {
      publicKey,
      walletAddress,
    };

    const response = ResponseBuilder.success(
      responseData,
      undefined,
      ResponseBuilder.getRequestId(_req)
    );

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/wallet/history:
 *   get:
 *     summary: Get wallet transaction history with pagination and filtering
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of items per page
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [token_purchase, token_redemption, token_transfer, refund]
 *         description: Filter by transaction type
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, completed, failed]
 *         description: Filter by transaction status
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter transactions from this date
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter transactions to this date
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [timestamp, amount, type, status]
 *           default: timestamp
 *         description: Sort by field
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Transaction history retrieved successfully
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
 *                         data:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                               type:
 *                                 type: string
 *                               amount:
 *                                 type: number
 *                               status:
 *                                 type: string
 *                               timestamp:
 *                                 type: string
 *                                 format: date-time
 *                               blockchainTxHash:
 *                                 type: string
 *                               counterparty:
 *                                 type: string
 *                         pagination:
 *                           type: object
 *                           properties:
 *                             page:
 *                               type: number
 *                             limit:
 *                               type: number
 *                             total:
 *                               type: number
 *                             totalPages:
 *                               type: number
 *                             hasNext:
 *                               type: boolean
 *                             hasPrev:
 *                               type: boolean
 *                         filters:
 *                           type: object
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
export const getWalletHistory = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw new CustomError('User not authenticated', 401);
    }

    const { id: userId } = req.user;
    
    // Parse query parameters
    const page = parseInt(req.query['page'] as string) || 1;
    const limit = Math.min(parseInt(req.query['limit'] as string) || 20, 100);
    const type = req.query['type'] as string;
    const status = req.query['status'] as string;
    const dateFrom = req.query['dateFrom'] ? new Date(req.query['dateFrom'] as string) : undefined;
    const dateTo = req.query['dateTo'] ? new Date(req.query['dateTo'] as string) : undefined;
    const sortBy = (req.query['sortBy'] as string) || 'timestamp';
    const sortOrder = (req.query['sortOrder'] as 'asc' | 'desc') || 'desc';

    // Validate date range
    if (dateFrom && dateTo && dateFrom > dateTo) {
      throw new CustomError('Invalid date range: dateFrom must be before dateTo', 400);
    }

    // Build filters
    const filters: any = {};
    if (type) filters.type = type;
    if (status) filters.status = status;
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;

    // Get paginated transaction history
    const transactions = await transactionDAO.getUserTransactionHistory(
      userId,
      { page, limit, sortBy, sortOrder },
      filters
    );

    // Get total count for pagination
    const totalCount = await transactionDAO.getUserTransactionCount(userId, filters);
    const totalPages = Math.ceil(totalCount / limit);

    // Format transactions for response
    const formattedTransactions: TransactionHistoryItem[] = transactions.map(tx => ({
      id: tx.id,
      type: tx.type,
      amount: parseFloat(tx.amount),
      status: tx.status,
      timestamp: tx.created_at,
      blockchainTxHash: tx.blockchain_tx_hash || undefined,
      counterparty: tx.sender_id === userId ? tx.receiver_id : tx.sender_id,
      metadata: tx.metadata,
    }));

    const responseData: TransactionHistoryResponse = {
      data: formattedTransactions,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      filters,
    };

    const response = ResponseBuilder.success(
      responseData,
      undefined,
      ResponseBuilder.getRequestId(req)
    );

    logger.debug('Wallet history retrieved', { 
      userId, 
      page, 
      limit, 
      totalCount,
      filters 
    });

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

// Helper functions
async function getPendingTransactionAmount(userId: string): Promise<number> {
  try {
    const pendingTransactions = await transactionDAO.getUserPendingTransactions(userId);
    return pendingTransactions.reduce((total, tx) => total + parseFloat(tx.amount), 0);
  } catch (error) {
    logger.error('Error getting pending transaction amount', { userId, error });
    return 0;
  }
}

async function getPendingTransactionCount(userId: string): Promise<number> {
  try {
    const pendingTransactions = await transactionDAO.getUserPendingTransactions(userId);
    return pendingTransactions.length;
  } catch (error) {
    logger.error('Error getting pending transaction count', { userId, error });
    return 0;
  }
}

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

export const validateWalletId = [
  param('walletId')
    .isString()
    .notEmpty()
    .withMessage('Wallet ID is required'),
];