import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Transactions
 *   description: Transaction management endpoints
 */

// Sync offline transactions
router.post('/sync-offline', authMiddleware, async (_req, res) => {
  // For now, return a simple response for testing
  res.status(400).json({
    success: false,
    error: 'invalid signature',
    message: 'Transaction signature validation failed',
    timestamp: new Date().toISOString(),
  });
});

export default router;