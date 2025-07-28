import { ethers } from 'ethers';

// Mock environment variables for testing
process.env['NODE_ENV'] = 'test';
process.env['PORT'] = '0'; // Use random available port for tests
process.env['JWT_SECRET'] = 'test-jwt-secret-key-for-testing-purposes-only';
process.env['DB_PASSWORD'] = 'test-password';
process.env['ETHEREUM_RPC_URL'] = 'http://localhost:8545';

// Generate valid test keys
const testWallet = ethers.Wallet.createRandom();
process.env['OTM_PRIVATE_KEY'] = testWallet.privateKey;
process.env['OTM_PUBLIC_KEY'] = testWallet.signingKey.publicKey;

// Mock database initialization
jest.mock('../database/init', () => ({
  initializeDatabase: jest.fn().mockResolvedValue(undefined),
  closeDatabase: jest.fn().mockResolvedValue(undefined),
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

  const actualEthers = jest.requireActual('ethers');

  return {
    ...actualEthers,
    ethers: {
      ...actualEthers.ethers,
      isAddress: jest.fn().mockImplementation((address: string) => {
        // Mock implementation that returns false for 'invalid-address'
        return address !== 'invalid-address' && address.startsWith('0x') && address.length === 42;
      }),
      verifyMessage: jest.fn().mockReturnValue('0x742d35Cc6634C0532925a3b8D4C0C8b3C2e1e1e1'),
      SigningKey: {
        recoverPublicKey: jest.fn().mockReturnValue('0x04' + '2'.repeat(128)),
      },
      Wallet: {
        createRandom: jest.fn().mockReturnValue(mockWallet),
      },
      JsonRpcProvider: jest.fn().mockImplementation(() => mockProvider),
    },
    isAddress: jest.fn().mockImplementation((address: string) => {
      // Mock implementation that returns false for 'invalid-address'
      return address !== 'invalid-address' && address.startsWith('0x') && address.length === 42;
    }),
    verifyMessage: jest.fn().mockReturnValue('0x742d35Cc6634C0532925a3b8D4C0C8b3C2e1e1e1'),
    SigningKey: {
      recoverPublicKey: jest.fn().mockReturnValue('0x04' + '2'.repeat(128)),
    },
    Wallet: {
      createRandom: jest.fn().mockReturnValue(mockWallet),
    },
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