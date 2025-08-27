import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { tokenRateLimiter } from '../middleware/rateLimiter';
import { 
  validateToken, 
  divideToken, 
  getPublicKeyDatabase,
  validateTokenValidation,
  validateTokenDivision 
} from '../controllers/tokenController';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Tokens
 *   description: Token validation, division, and management operations
 */

// Token validation endpoint (requires authentication)
router.post('/validate', 
  authMiddleware, 
  tokenRateLimiter, // Token-specific rate limiting
  validateTokenValidation, 
  validateToken
);

// Token division endpoint (requires authentication)
router.post('/divide', 
  authMiddleware, 
  tokenRateLimiter, // Token-specific rate limiting
  validateTokenDivision, 
  divideToken
);

// Public key database endpoint (public endpoint with rate limiting)
router.get('/public-keys', 
  tokenRateLimiter, // Token-specific rate limiting
  getPublicKeyDatabase
);

export default router;