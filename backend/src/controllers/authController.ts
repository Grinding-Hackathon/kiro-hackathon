import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { ethers } from 'ethers';
import { UserDAO } from '../database/dao/UserDAO';
import { generateToken } from '../middleware/auth';
import { CustomError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { ApiResponse } from '../types';

const userDAO = new UserDAO();

export interface LoginRequest {
  walletAddress: string;
  signature: string;
  message: string;
}

export interface LoginResponse {
  token: string;
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

    // Generate JWT token
    const token = generateToken({
      id: user.id,
      walletAddress: user.wallet_address,
      publicKey: user.public_key,
    });

    const response: ApiResponse<LoginResponse> = {
      success: true,
      data: {
        token,
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
 *                         message:
 *                           type: string
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

    // Generate a random nonce
    const nonce = Math.floor(Math.random() * 1000000).toString();
    const message = `Login to Offline Wallet - Nonce: ${nonce}`;

    const response: ApiResponse = {
      success: true,
      data: {
        nonce,
        message,
      },
      timestamp: new Date().toISOString(),
    };

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