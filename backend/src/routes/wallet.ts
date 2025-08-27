import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { 
  getBalance, 
  getWalletBalanceById,
  getWalletHistory,
  purchaseTokens, 
  redeemTokens, 
  getPublicKey,
  validateTokenPurchase,
  validateTokenRedemption,
  validateWalletId
} from '../controllers/walletController';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Wallet
 *   description: Wallet operations and token management
 */

// Get wallet balance (requires authentication)
router.get('/balance', authMiddleware, getBalance);

// Get wallet transaction history (requires authentication)
router.get('/history', authMiddleware, getWalletHistory);

// Get wallet balance by wallet ID (requires authentication)
router.get('/:walletId/balance', authMiddleware, validateWalletId, getWalletBalanceById);

// Purchase offline tokens (requires authentication)
router.post('/tokens/purchase', authMiddleware, validateTokenPurchase, purchaseTokens);

// Redeem offline tokens (requires authentication)
router.post('/tokens/redeem', authMiddleware, validateTokenRedemption, redeemTokens);

// Get OTM public key (public endpoint)
router.get('/keys/public', getPublicKey);

export default router;