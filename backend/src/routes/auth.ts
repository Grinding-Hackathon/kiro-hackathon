import { Router } from 'express';
import { login, getNonce, validateLogin } from '../controllers/authController';

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

export default router;