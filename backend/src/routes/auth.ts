import { Router } from 'express';
import { login, getNonce, validateLogin, logout } from '../controllers/authController';
import { authMiddleware } from '../middleware/auth';

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

export default router;