import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { TransactionController } from '../controllers/transactionController';

const router = Router();
const transactionController = new TransactionController();

/**
 * @swagger
 * tags:
 *   name: Transactions
 *   description: Transaction management endpoints
 */

/**
 * @swagger
 * /api/v1/transactions/submit:
 *   post:
 *     summary: Submit a new transaction
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - type
 *             properties:
 *               senderId:
 *                 type: string
 *                 description: ID of the sender
 *               receiverId:
 *                 type: string
 *                 description: ID of the receiver
 *               amount:
 *                 type: string
 *                 description: Transaction amount
 *               type:
 *                 type: string
 *                 enum: [online, offline, token_purchase, token_redemption]
 *                 description: Type of transaction
 *               senderSignature:
 *                 type: string
 *                 description: Sender's signature (required for offline transactions)
 *               receiverSignature:
 *                 type: string
 *                 description: Receiver's signature
 *               tokenIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of token IDs involved in the transaction
 *               metadata:
 *                 type: object
 *                 description: Additional transaction metadata
 *     responses:
 *       201:
 *         description: Transaction submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     transactionId:
 *                       type: string
 *                     status:
 *                       type: string
 *                     blockchainTxHash:
 *                       type: string
 *                     timestamp:
 *                       type: string
 *                     estimatedConfirmation:
 *                       type: string
 *       400:
 *         description: Validation error
 *       422:
 *         description: Business logic error (e.g., token already spent)
 *       500:
 *         description: Internal server error
 */
router.post('/submit', authMiddleware, transactionController.submitTransaction.bind(transactionController));

/**
 * @swagger
 * /api/v1/transactions/sync:
 *   get:
 *     summary: Synchronize transactions since a specific timestamp
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: since
 *         schema:
 *           type: string
 *         description: Unix timestamp or ISO string to sync transactions since
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Maximum number of transactions to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of transactions to skip
 *     responses:
 *       200:
 *         description: Transaction sync completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     transactions:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Transaction'
 *                     lastSyncTimestamp:
 *                       type: string
 *                     totalCount:
 *                       type: integer
 *                     hasMore:
 *                       type: boolean
 *       400:
 *         description: Invalid parameters
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Internal server error
 */
router.get('/sync', authMiddleware, transactionController.syncTransactions.bind(transactionController));

/**
 * @swagger
 * /api/v1/transactions/{transactionId}/status:
 *   get:
 *     summary: Get transaction status by ID
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Transaction ID
 *     responses:
 *       200:
 *         description: Transaction status retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     transactionId:
 *                       type: string
 *                     status:
 *                       type: string
 *                     blockchainTxHash:
 *                       type: string
 *                     confirmations:
 *                       type: integer
 *                     lastUpdated:
 *                       type: string
 *                     errorMessage:
 *                       type: string
 *                     metadata:
 *                       type: object
 *       400:
 *         description: Transaction ID required
 *       403:
 *         description: Access denied
 *       404:
 *         description: Transaction not found
 *       500:
 *         description: Internal server error
 */
router.get('/:transactionId/status', authMiddleware, transactionController.getTransactionStatus.bind(transactionController));

/**
 * @swagger
 * /api/v1/transactions/sync-offline:
 *   post:
 *     summary: Sync offline transactions from mobile app
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - transactions
 *             properties:
 *               transactions:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - id
 *                     - amount
 *                     - type
 *                     - timestamp
 *                   properties:
 *                     id:
 *                       type: string
 *                       description: Local transaction ID from mobile app
 *                     senderId:
 *                       type: string
 *                     receiverId:
 *                       type: string
 *                     amount:
 *                       type: string
 *                     type:
 *                       type: string
 *                       enum: [online, offline, token_purchase, token_redemption]
 *                     senderSignature:
 *                       type: string
 *                     receiverSignature:
 *                       type: string
 *                     tokenIds:
 *                       type: array
 *                       items:
 *                         type: string
 *                     metadata:
 *                       type: object
 *                     timestamp:
 *                       type: string
 *     responses:
 *       200:
 *         description: Offline transactions synced
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     processedTransactions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           localId:
 *                             type: string
 *                           serverTransactionId:
 *                             type: string
 *                           status:
 *                             type: string
 *                             enum: [accepted, rejected, conflict]
 *                           reason:
 *                             type: string
 *                     conflicts:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           localId:
 *                             type: string
 *                           conflictType:
 *                             type: string
 *                             enum: [double_spend, invalid_signature, expired_token, insufficient_balance]
 *                           resolution:
 *                             type: string
 *                             enum: [server_wins, client_wins, manual_review]
 *                           serverTransaction:
 *                             $ref: '#/components/schemas/Transaction'
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Internal server error
 */
router.post('/sync-offline', authMiddleware, transactionController.syncOfflineTransactions.bind(transactionController));

export default router;