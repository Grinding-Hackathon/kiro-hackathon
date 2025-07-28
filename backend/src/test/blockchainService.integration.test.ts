import { ethers } from 'ethers';
import { BlockchainService } from '../services/blockchainService';
import { config } from '../config/config';

// Mock the logger
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock the contract ABI
jest.mock('../../artifacts/contracts/OfflineWalletToken.sol/OfflineWalletToken.json', () => ({
  abi: [
    {
      "inputs": [{"name": "account", "type": "address"}],
      "name": "balanceOf",
      "outputs": [{"name": "", "type": "uint256"}],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "getContractInfo",
      "outputs": [
        {"name": "tokenName", "type": "string"},
        {"name": "tokenSymbol", "type": "string"}
      ],
      "stateMutability": "view",
      "type": "function"
    }
  ],
  bytecode: "0x608060405234801561001057600080fd5b50"
}));

describe('BlockchainService Integration Tests', () => {
  let blockchainService: BlockchainService;
  const testRpcUrl = process.env['TEST_RPC_URL'];
  const testPrivateKey = process.env['TEST_PRIVATE_KEY'];

  beforeAll(async () => {
    // Skip integration tests if no test RPC URL is provided
    if (!testRpcUrl) {
      console.log('Skipping integration tests - TEST_RPC_URL not provided');
      return;
    }

    // Set up test environment
    process.env['NODE_ENV'] = 'test';
  });

  beforeEach(() => {
    if (!testRpcUrl) {
      return;
    }
    
    blockchainService = new BlockchainService();
  });

  afterEach(async () => {
    if (blockchainService) {
      await blockchainService.cleanup();
    }
  });

  describe('Web3 Connection Management', () => {
    it('should establish connection to test network', async () => {
      if (!testRpcUrl) {
        pending('TEST_RPC_URL not provided');
        return;
      }

      // Mock the config for this test
      const originalConfig = { ...config.blockchain };
      config.blockchain.rpcUrl = testRpcUrl;
      config.blockchain.privateKey = testPrivateKey || '0x' + '1'.repeat(64);

      try {
        await blockchainService.initialize();
        
        const status = blockchainService.getConnectionStatus();
        expect(status.isConnected).toBe(true);
        
        const networkInfo = await blockchainService.getNetworkInfo();
        expect(networkInfo.chainId).toBeDefined();
        expect(networkInfo.blockNumber).toBeGreaterThan(0);
      } finally {
        // Restore original config
        Object.assign(config.blockchain, originalConfig);
      }
    });

    it('should handle connection failures gracefully', async () => {
      if (!testRpcUrl) {
        pending('TEST_RPC_URL not provided');
        return;
      }

      // Mock the config with invalid RPC URL
      const originalConfig = { ...config.blockchain };
      config.blockchain.rpcUrl = 'http://invalid-url:8545';
      config.blockchain.privateKey = '0x' + '1'.repeat(64);

      try {
        await expect(blockchainService.initialize()).rejects.toThrow('Blockchain initialization failed');
        
        const status = blockchainService.getConnectionStatus();
        expect(status.isConnected).toBe(false);
      } finally {
        // Restore original config
        Object.assign(config.blockchain, originalConfig);
      }
    });

    it('should report correct connection status', async () => {
      if (!testRpcUrl) {
        pending('TEST_RPC_URL not provided');
        return;
      }

      const initialStatus = blockchainService.getConnectionStatus();
      expect(initialStatus.isConnected).toBe(false);
      expect(initialStatus.reconnectAttempts).toBe(0);

      config.blockchain.rpcUrl = testRpcUrl;
      config.blockchain.privateKey = testPrivateKey || '0x' + '1'.repeat(64);
      
      await blockchainService.initialize();

      const connectedStatus = blockchainService.getConnectionStatus();
      expect(connectedStatus.isConnected).toBe(true);
    });
  });

  describe('Contract Deployment', () => {
    beforeEach(async () => {
      if (!testRpcUrl) {
        return;
      }

      // Mock the config for contract tests
      config.blockchain.rpcUrl = testRpcUrl;
      config.blockchain.privateKey = testPrivateKey || '0x' + '1'.repeat(64);
      
      await blockchainService.initialize();
    });

    it('should validate contract addresses', async () => {
      if (!testRpcUrl) {
        pending('TEST_RPC_URL not provided');
        return;
      }

      const invalidAddress = 'invalid-address';
      const initialSupply = ethers.parseEther('1000000');

      await expect(
        blockchainService.deployContract(invalidAddress, initialSupply)
      ).rejects.toThrow('Invalid OTM address provided');
    });
  });

  describe('Transaction Broadcasting', () => {
    beforeEach(async () => {
      if (!testRpcUrl) {
        return;
      }

      config.blockchain.rpcUrl = testRpcUrl;
      config.blockchain.privateKey = testPrivateKey || '0x' + '1'.repeat(64);
      
      await blockchainService.initialize();
    });

    it('should get wallet balance', async () => {
      if (!testRpcUrl) {
        pending('TEST_RPC_URL not provided');
        return;
      }

      const balance = await blockchainService.getWalletBalance();
      expect(typeof balance).toBe('string');
      expect(parseFloat(balance)).toBeGreaterThanOrEqual(0);
    });

    it('should get transaction details for non-existent transaction', async () => {
      if (!testRpcUrl) {
        pending('TEST_RPC_URL not provided');
        return;
      }

      // Test with a non-existent transaction
      const nonExistentTxHash = '0x' + '0'.repeat(64);
      
      const result = await blockchainService.getTransaction(nonExistentTxHash);
      expect(result).toBeNull();
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle network timeouts', async () => {
      if (!testRpcUrl) {
        pending('TEST_RPC_URL not provided');
        return;
      }

      // Test timeout handling by using a very short timeout
      const shortTimeoutService = new BlockchainService();
      
      try {
        // This should timeout quickly if the network is slow
        await expect(
          shortTimeoutService.waitForTransactionConfirmation('0x' + '1'.repeat(64), { timeout: 1 })
        ).rejects.toThrow();
      } finally {
        await shortTimeoutService.cleanup();
      }
    });

    it('should validate transaction hashes', async () => {
      if (!testRpcUrl) {
        pending('TEST_RPC_URL not provided');
        return;
      }

      config.blockchain.rpcUrl = testRpcUrl;
      config.blockchain.privateKey = testPrivateKey || '0x' + '1'.repeat(64);
      
      await blockchainService.initialize();

      // Test with invalid transaction hash
      await expect(
        blockchainService.waitForTransactionConfirmation('invalid-hash')
      ).rejects.toThrow();
    });
  });

  describe('Event Monitoring', () => {
    beforeEach(async () => {
      if (!testRpcUrl) {
        return;
      }

      config.blockchain.rpcUrl = testRpcUrl;
      config.blockchain.privateKey = testPrivateKey || '0x' + '1'.repeat(64);
      
      await blockchainService.initialize();
    });

    it('should setup event listeners without errors', async () => {
      if (!testRpcUrl) {
        pending('TEST_RPC_URL not provided');
        return;
      }

      // This test verifies that event listener setup doesn't throw errors
      // Even without a deployed contract, the setup should not fail
      expect(() => {
        blockchainService.setupEventListeners();
      }).not.toThrow();
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources properly', async () => {
      if (!testRpcUrl) {
        pending('TEST_RPC_URL not provided');
        return;
      }

      config.blockchain.rpcUrl = testRpcUrl;
      config.blockchain.privateKey = testPrivateKey || '0x' + '1'.repeat(64);
      
      await blockchainService.initialize();
      
      const statusBeforeCleanup = blockchainService.getConnectionStatus();
      expect(statusBeforeCleanup.isConnected).toBe(true);

      await blockchainService.cleanup();

      const statusAfterCleanup = blockchainService.getConnectionStatus();
      expect(statusAfterCleanup.isConnected).toBe(false);
    });
  });
});