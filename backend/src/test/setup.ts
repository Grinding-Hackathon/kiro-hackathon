import { ethers } from 'ethers';

// Mock environment variables for testing
process.env['NODE_ENV'] = 'test';
process.env['PORT'] = '0'; // Use random available port for tests
process.env['JWT_SECRET'] = 'test-jwt-secret-key-for-testing-purposes-only';
process.env['DB_PASSWORD'] = 'test-password';
process.env['ETHEREUM_RPC_URL'] = 'http://localhost:8545';
process.env['HEALTH_CHECK_INTERVAL'] = '999999999'; // Disable health monitoring in tests
process.env['RATE_LIMIT_WINDOW_MS'] = '999999999'; // Disable rate limiting in tests
process.env['RATE_LIMIT_MAX_REQUESTS'] = '999999'; // Disable rate limiting in tests

// Generate valid test keys
const testWallet = ethers.Wallet.createRandom();
process.env['OTM_PRIVATE_KEY'] = testWallet.privateKey;
process.env['OTM_PUBLIC_KEY'] = testWallet.signingKey.publicKey;

// Mock database initialization
jest.mock('../database/init', () => ({
  initializeDatabase: jest.fn().mockResolvedValue(undefined),
  closeDatabase: jest.fn().mockResolvedValue(undefined),
}));

// Mock database connection
jest.mock('../database/connection', () => ({
  db: {
    raw: jest.fn().mockResolvedValue([]),
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    insert: jest.fn().mockResolvedValue([{ id: 1 }]),
    update: jest.fn().mockResolvedValue(1),
    delete: jest.fn().mockResolvedValue(1),
    first: jest.fn().mockResolvedValue(null),
    migrate: {
      latest: jest.fn().mockResolvedValue([]),
    },
    client: {
      pool: {
        numUsed: jest.fn().mockReturnValue(0),
        numFree: jest.fn().mockReturnValue(10),
        numPendingAcquires: jest.fn().mockReturnValue(0),
      },
    },
  },
}));

// Mock auth middleware to be conditional in tests
jest.mock('../middleware/auth', () => ({
  authMiddleware: jest.fn((req: any, res: any, next: any) => {
    const authHeader = req.get('Authorization');
    
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authorization header is required. Please provide a valid Bearer token.',
          details: {
            method: req.method,
            path: req.path,
            correlationId: 'test-correlation-id',
            timestamp: new Date().toISOString(),
            category: 'AUTHENTICATION',
            severity: 'MEDIUM'
          }
        },
        timestamp: new Date().toISOString(),
        requestId: 'test-request-id'
      });
    }

    // Check for proper Bearer format
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_MALFORMED',
          message: 'Authorization header must be in format: Bearer <token>',
          details: {
            method: req.method,
            path: req.path,
            correlationId: 'test-correlation-id',
            timestamp: new Date().toISOString(),
            category: 'AUTHENTICATION',
            severity: 'MEDIUM'
          }
        },
        timestamp: new Date().toISOString(),
        requestId: 'test-request-id'
      });
    }

    const token = parts[1];
    
    if (!token || token.trim() === '') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Token cannot be empty',
          details: {
            method: req.method,
            path: req.path,
            correlationId: 'test-correlation-id',
            timestamp: new Date().toISOString(),
            category: 'AUTHENTICATION',
            severity: 'MEDIUM'
          }
        },
        timestamp: new Date().toISOString(),
        requestId: 'test-request-id'
      });
    }
      
    // Reject obviously invalid tokens
    if (token === 'invalid-token' || 
        token === 'invalid.jwt.token' || 
        token.includes('tampered') ||
        token.includes('invalid')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_MALFORMED',
          message: 'Invalid token format or signature',
          details: {
            method: req.method,
            path: req.path,
            correlationId: 'test-correlation-id',
            timestamp: new Date().toISOString(),
            category: 'AUTHENTICATION',
            severity: 'MEDIUM'
          }
        },
        timestamp: new Date().toISOString(),
        requestId: 'test-request-id'
      });
    }
    
    // Try to decode JWT to check expiration
    try {
      const jwt = require('jsonwebtoken');
      jwt.verify(token, process.env['JWT_SECRET'] || 'test-secret');
      req.user = { id: 'user-123', walletAddress: '0x' + '3'.repeat(40), publicKey: '0x04' + '2'.repeat(128) };
      next();
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: {
            code: 'TOKEN_EXPIRED',
            message: 'Token has expired. Please refresh your token or login again.',
            details: {
              method: req.method,
              path: req.path,
              correlationId: 'test-correlation-id',
              timestamp: new Date().toISOString(),
              category: 'AUTHENTICATION',
              severity: 'MEDIUM'
            }
          },
          timestamp: new Date().toISOString(),
          requestId: 'test-request-id'
        });
      }
      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_MALFORMED',
          message: 'Invalid token format or signature',
          details: {
            method: req.method,
            path: req.path,
            correlationId: 'test-correlation-id',
            timestamp: new Date().toISOString(),
            category: 'AUTHENTICATION',
            severity: 'MEDIUM'
          }
        },
        timestamp: new Date().toISOString(),
        requestId: 'test-request-id'
      });
    }
  }),
  optionalAuthMiddleware: jest.fn((req: any, _res: any, next: any) => {
    const authHeader = req.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      // Only set user for valid tokens
      if (token !== 'invalid-token' && 
          token !== 'invalid.jwt.token' && 
          !token.includes('expired') && 
          !token.includes('tampered') &&
          !token.includes('invalid')) {
        req.user = { id: 'user-123', walletAddress: '0x' + '3'.repeat(40), publicKey: '0x04' + '2'.repeat(128) };
      }
    }
    next();
  }),
  generateToken: jest.fn().mockReturnValue('valid-test-token'),
}));

// Mock all DAO classes
jest.mock('../database/dao/UserDAO', () => ({
  UserDAO: jest.fn().mockImplementation(() => ({
    create: jest.fn().mockResolvedValue({ id: 'user-123', wallet_address: '0x' + '3'.repeat(40), public_key: '0x04' + '2'.repeat(128), created_at: new Date() }),
    findByWalletAddress: jest.fn().mockResolvedValue(null),
    findByEmail: jest.fn().mockResolvedValue(null),
    updateLastActivity: jest.fn().mockResolvedValue(1),
    deactivateUser: jest.fn().mockResolvedValue(1),
  })),
}));

jest.mock('../database/dao/AuditLogDAO', () => ({
  AuditLogDAO: jest.fn().mockImplementation(() => ({
    create: jest.fn().mockResolvedValue({ id: 'audit-123' }),
    findAll: jest.fn().mockResolvedValue([]),
  })),
}));

jest.mock('../database/dao/TransactionDAO', () => ({
  TransactionDAO: jest.fn().mockImplementation(() => ({
    create: jest.fn().mockResolvedValue({ id: 'tx-123' }),
    findByUserId: jest.fn().mockResolvedValue([]),
    findAll: jest.fn().mockResolvedValue([]),
  })),
}));

jest.mock('../database/dao/OfflineTokenDAO', () => ({
  OfflineTokenDAO: jest.fn().mockImplementation(() => ({
    create: jest.fn().mockResolvedValue({ id: 'token-123' }),
    findByUserId: jest.fn().mockResolvedValue([]),
    findAll: jest.fn().mockResolvedValue([]),
    getUserTokenBalance: jest.fn().mockResolvedValue('0'),
    markAsRedeemed: jest.fn().mockResolvedValue(null),
    findByTokenIds: jest.fn().mockResolvedValue([]),
  })),
}));

jest.mock('../database/dao/PublicKeyDAO', () => ({
  PublicKeyDAO: jest.fn().mockImplementation(() => ({
    create: jest.fn().mockResolvedValue({ id: 'key-123' }),
    findByUserId: jest.fn().mockResolvedValue(null),
  })),
}));

// Mock blockchain service initialization
jest.mock('../services/blockchainService', () => {
  const mockBlockchainService = {
    initialize: jest.fn().mockResolvedValue(undefined),
    getTokenBalance: jest.fn().mockResolvedValue('0'),
    sendContractTransaction: jest.fn().mockResolvedValue({ hash: '0x123' }),
    waitForTransactionConfirmation: jest.fn().mockResolvedValue({ blockNumber: 1, gasUsed: BigInt(21000) }),
    cleanup: jest.fn().mockResolvedValue(undefined),
    getConnectionStatus: jest.fn().mockReturnValue({ isConnected: true, reconnectAttempts: 0 }),
    getCurrentBlockNumber: jest.fn().mockResolvedValue(100),
    getNetworkInfo: jest.fn().mockResolvedValue({ name: 'test', chainId: BigInt(1), blockNumber: 100 }),
    deployContract: jest.fn().mockResolvedValue({ contractAddress: '0xContract', transactionHash: '0x123', blockNumber: 1, gasUsed: BigInt(21000) }),
    getWalletBalance: jest.fn().mockResolvedValue('1.0'),
    broadcastTransaction: jest.fn().mockResolvedValue({ hash: '0x123' }),
    getTransaction: jest.fn().mockResolvedValue({ hash: '0x123', blockNumber: 1, gasUsed: BigInt(21000) }),
    callContract: jest.fn().mockResolvedValue({ result: 'test' }),
  };
  
  return {
    blockchainService: mockBlockchainService,
    BlockchainService: jest.fn().mockImplementation(() => mockBlockchainService),
  };
});

// Mock offline token manager
jest.mock('../services/offlineTokenManager', () => ({
  offlineTokenManager: {
    issueTokens: jest.fn(),
    redeemTokens: jest.fn(),
    getPublicKey: jest.fn().mockReturnValue('0x04' + 'f'.repeat(128)),
    getWalletAddress: jest.fn().mockReturnValue('0x' + 'a'.repeat(40)),
  },
}));

// Mock security services
jest.mock('../services/healthMonitoringService', () => ({
  healthMonitoringService: {
    startMonitoring: jest.fn(),
    stopMonitoring: jest.fn(),
    forceHealthCheck: jest.fn().mockResolvedValue({ overall: 'healthy', checks: [], uptime: 0, timestamp: new Date() }),
    getCurrentHealth: jest.fn().mockReturnValue({ overall: 'healthy', checks: [], uptime: 0, timestamp: new Date() }),
    getActiveAlerts: jest.fn().mockReturnValue([]),
  },
}));

jest.mock('../services/fraudDetectionService', () => ({
  fraudDetectionService: {
    analyzeTransaction: jest.fn().mockResolvedValue([]),
    startPeriodicScans: jest.fn(),
    runComprehensiveScan: jest.fn().mockResolvedValue([]),
    getRecentAlerts: jest.fn().mockReturnValue([]),
    getAlertsBySeverity: jest.fn().mockReturnValue([]),
    clearOldAlerts: jest.fn(),
  },
}));

jest.mock('../services/backupService', () => ({
  backupService: {
    scheduleAutomaticBackups: jest.fn(),
    createFullBackup: jest.fn().mockResolvedValue({ id: 'backup-1', type: 'full', filename: 'backup.sql', size: 1000, checksum: 'abc123', timestamp: new Date(), status: 'completed' }),
    createIncrementalBackup: jest.fn().mockResolvedValue({ id: 'backup-2', type: 'incremental', filename: 'backup.json', size: 500, checksum: 'def456', timestamp: new Date(), status: 'completed' }),
    createLogsBackup: jest.fn().mockResolvedValue({ id: 'backup-3', type: 'logs', filename: 'logs.tar.gz', size: 200, checksum: 'ghi789', timestamp: new Date(), status: 'completed' }),
    getBackupHistory: jest.fn().mockReturnValue([]),
    getBackup: jest.fn().mockReturnValue(null),
    verifyBackup: jest.fn().mockResolvedValue(true),
    getDisasterRecoveryStatus: jest.fn().mockReturnValue({ status: 'READY', recommendations: [] }),
    testRecoveryProcedures: jest.fn().mockResolvedValue({ testId: 'test-1', tests: [], summary: { totalTests: 0, passedTests: 0, failedTests: 0, successRate: '100%' } }),
    createDisasterRecoveryPlan: jest.fn().mockResolvedValue({ id: 'plan-1', createdAt: new Date() }),
  },
}));

// Mock rate limiter middleware to be pass-through in tests
jest.mock('../middleware/rateLimiter', () => ({
  rateLimiter: jest.fn((_req: any, _res: any, next: any) => next()),
  authRateLimiter: jest.fn((_req: any, _res: any, next: any) => next()),
  tokenRateLimiter: jest.fn((_req: any, _res: any, next: any) => next()),
  progressiveDelay: jest.fn((_req: any, _res: any, next: any) => next()),
  trackSuspiciousActivity: jest.fn((_req: any, _res: any, next: any) => next()),
  ddosProtection: jest.fn((_req: any, _res: any, next: any) => next()),
  getSecurityMetrics: jest.fn().mockReturnValue({ blockedIPs: [], suspiciousIPs: [], ddosPatterns: { rapidRequests: [], largePayloads: [], repeatedPaths: [] } }),
}));

// Mock error handler middleware to be pass-through in tests
jest.mock('../middleware/errorHandler', () => ({
  errorHandler: jest.fn((err: any, _req: any, res: any, _next: any) => {
    res.status(err.statusCode || 500).json({ success: false, error: err.message });
  }),
  asyncHandler: jest.fn((fn: any) => fn),
  fraudDetectionMiddleware: jest.fn((_req: any, _res: any, next: any) => next()),
  notFoundHandler: jest.fn((_req: any, _res: any, next: any) => next()),
  CustomError: class CustomError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number = 500) {
      super(message);
      this.statusCode = statusCode;
    }
  },
  createError: jest.fn((message: string, _statusCode: number = 500) => new Error(message)),
}));

// Mock ethers globally
jest.mock('ethers', () => {
  const mockWallet = {
    privateKey: '0x' + '1'.repeat(64),
    signingKey: {
      publicKey: '0x04' + '2'.repeat(128),
    },
    address: '0x' + '3'.repeat(40),
    signMessage: jest.fn().mockResolvedValue('0x' + '4'.repeat(130)),
  };

  const mockProvider = {
    getNetwork: jest.fn().mockResolvedValue({ name: 'test', chainId: BigInt(1) }),
    getBlockNumber: jest.fn().mockResolvedValue(1),
    getBalance: jest.fn().mockResolvedValue(BigInt('1000000000000000000')),
    getCode: jest.fn().mockResolvedValue('0x123'),
    removeAllListeners: jest.fn(),
  };

  const MockWalletConstructor = jest.fn().mockImplementation((privateKey?: string) => ({
    ...mockWallet,
    privateKey: privateKey || mockWallet.privateKey,
  }));
  (MockWalletConstructor as any).createRandom = jest.fn().mockReturnValue(mockWallet);

  const actualEthers = jest.requireActual('ethers');

  return {
    ...actualEthers,
    ethers: {
      ...actualEthers.ethers,
      isAddress: jest.fn().mockImplementation((address: string) => {
        // Mock implementation that returns false for 'invalid-address'
        return address !== 'invalid-address' && address.startsWith('0x') && address.length === 42;
      }),
      verifyMessage: jest.fn().mockReturnValue('0x' + '3'.repeat(40)),
      SigningKey: {
        recoverPublicKey: jest.fn().mockReturnValue('0x04' + '2'.repeat(128)),
      },
      Wallet: MockWalletConstructor,
      JsonRpcProvider: jest.fn().mockImplementation(() => mockProvider),
    },
    isAddress: jest.fn().mockImplementation((address: string) => {
      // Mock implementation that returns false for 'invalid-address'
      return address !== 'invalid-address' && address.startsWith('0x') && address.length === 42;
    }),
    verifyMessage: jest.fn().mockReturnValue('0x' + '3'.repeat(40)),
    SigningKey: {
      recoverPublicKey: jest.fn().mockReturnValue('0x04' + '2'.repeat(128)),
    },
    Wallet: MockWalletConstructor,
    JsonRpcProvider: jest.fn().mockImplementation(() => mockProvider),
  };
});

// Suppress console logs during tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Global test setup
beforeEach(() => {
  jest.clearAllMocks();
});