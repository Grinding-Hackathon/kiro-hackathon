import { Router } from 'express';
import { 
  login, 
  getNonce, 
  validateLogin, 
  logout, 
  refreshToken, 
  validateSession, 
  validateRefreshToken,
  getActiveSessions
} from '../controllers/authController';
import { authMiddleware, validateRefreshToken as validateRefreshTokenMiddleware } from '../middleware/auth';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User authentication endpoints
 */

// Get authentication nonce
router.get('/nonce', getNonce);

// User login with wallet signature
router.post('/login', validateLogin, login);

// User logout
router.post('/logout', authMiddleware, logout);

// Refresh authentication token
router.post('/refresh', validateRefreshToken, validateRefreshTokenMiddleware, refreshToken);

// Validate current session
router.get('/validate-session', authMiddleware, validateSession);

// Get active sessions
router.get('/sessions', authMiddleware, getActiveSessions);

export default router;