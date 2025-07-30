import { Router } from 'express';
import authRoutes from './auth';
import walletRoutes from './wallet';
import securityRoutes from './security';
import transactionRoutes from './transactions';

const router = Router();

// Mount route modules
router.use('/auth', authRoutes);
router.use('/wallet', walletRoutes);
router.use('/security', securityRoutes);
router.use('/transactions', transactionRoutes);

export default router;