// Mock ethers before importing anything else
const mockProvider = {
  getNetwork: jest.fn(),
  getBlockNumber: jest.fn(),
  getBalance: jest.fn(),
  getCode: jest.fn(),
  getTransaction: jest.fn(),
  getTransactionReceipt: jest.fn(),
  broadcastTransaction: jest.fn(),
  estimateGas: jest.fn(),
  removeAllListeners: jest.fn(),
  on: jest.fn(),
};

const mockWallet = {
  address: '0x742d35Cc6634C0532925a3b8D0C9C0C8b3C8C8C8',
};

const mockContract = {
  removeAllListeners: jest.fn(),
  on: jest.fn(),
  balanceOf: jest.fn(),
  getContractInfo: jest.fn(),
  estimateGas: jest.fn(),
  queryFilter: jest.fn(),
  filters: {
    TransferToClient: jest.fn(),
    TransferToOTM: jest.fn(),
    TokensMinted: jest.fn(),
    TokensBurned: jest.fn(),
  },
};

const mockContractFactory = {
  deploy: jest.fn(),
  interface: {
    encodeDeploy: jest.fn(),
  },
  bytecode: '0x608060405234801561001057600080fd5b50',
};

// Mock ethers module
jest.mock('ethers', () => ({
  ethers: {
    JsonRpcProvider: jest.fn(() => mockProvider),
    Wallet: jest.fn(() => mockWallet),
    Contract: jest.fn(() => mockContract),
    ContractFactory: jest.fn(() => mockContractFactory),
    isAddress: jest.fn((address: string) => address.startsWith('0x') && address.length === 42),
    parseEther: jest.fn((value: string) => BigInt(parseFloat(value) * 1e18)),
    formatEther: jest.fn((value: bigint) => (Number(value) / 1e18).toString()),
  },
  JsonRpcProvider: jest.fn(() => mockProvider),
  Wallet: jest.fn(() => mockWallet),
  Contract: jest.fn(() => mockContract),
  ContractFactory: jest.fn(() => mockContractFactory),
  isAddress: jest.fn((address: string) => address.startsWith('0x') && address.length === 42),
  parseEther: jest.fn((value: string) => BigInt(parseFloat(value) * 1e18)),
  formatEther: jest.fn((value: bigint) => (Number(value) / 1e18).toString()),
}));

// Mock the config for testing
jest.mock('../config/config', () => ({
  config: {
    blockchain: {
      rpcUrl: 'http://localhost:8545',
      privateKey: '0x' + '1'.repeat(64), // Valid test private key
      contractAddress: undefined,
    },
  },
}));

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

import { BlockchainService } from '../services/blockchainService';
import { ethers } from 'ethers';

describe('BlockchainService Unit Tests', () => {
  let blockchainService: BlockchainService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mock implementations
    mockProvider.getNetwork.mockReset();
    mockProvider.getBlockNumber.mockReset();
    mockProvider.getBalance.mockReset();
    mockProvider.getCode.mockReset();
    mockProvider.getTransaction.mockReset();
    mockProvider.getTransactionReceipt.mockReset();
    mockProvider.broadcastTransaction.mockReset();
    mockProvider.estimateGas.mockReset();
    
    mockContract.balanceOf.mockReset();
    mockContract.getContractInfo.mockReset();
    
    mockContractFactory.deploy.mockReset();
    mockContractFactory.interface.encodeDeploy.mockReset();

    blockchainService = new BlockchainService();
  });

  afterEach(async () => {
    if (blockchainService) {
      await blockchainService.cleanup();
    }
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize successfully with valid configuration', async () => {
      mockProvider.getNetwork.mockResolvedValue({
        name: 'hardhat',
        chainId: BigInt(1337),
      });
      
      mockProvider.getBlockNumber.mockResolvedValue(1);
      mockProvider.getBalance.mockResolvedValue(ethers.parseEther('1.0'));

      await blockchainService.initialize();
      
      const status = blockchainService.getConnectionStatus();
      expect(status.isConnected).toBe(true);
      expect(status.reconnectAttempts).toBe(0);
    });

    it('should handle initialization failures', async () => {
      mockProvider.getNetwork.mockRejectedValue(new Error('Connection failed'));

      await expect(blockchainService.initialize()).rejects.toThrow('Blockchain initialization failed');
      
      const status = blockchainService.getConnectionStatus();
      expect(status.isConnected).toBe(false);
    });
  });

  describe('Network Information', () => {
    it('should return correct network information', async () => {
      mockProvider.getNetwork.mockResolvedValue({
        name: 'hardhat',
        chainId: BigInt(1337),
      });
      
      mockProvider.getBlockNumber.mockResolvedValue(100);

      const networkInfo = await blockchainService.getNetworkInfo();
      
      expect(networkInfo).toEqual({
        name: 'hardhat',
        chainId: BigInt(1337),
        blockNumber: 100,
      });
    });
  });

  describe('Contract Deployment', () => {
    beforeEach(async () => {
      mockProvider.getNetwork.mockResolvedValue({
        name: 'hardhat',
        chainId: BigInt(1337),
      });
      
      mockProvider.getBlockNumber.mockResolvedValue(1);
      mockProvider.getBalance.mockResolvedValue(ethers.parseEther('1.0'));

      await blockchainService.initialize();
    });

    it('should deploy contract successfully', async () => {
      const otmAddress = '0x742d35Cc6634C0532925a3b8D0C9C0C8b3C8C8C8';
      const initialSupply = ethers.parseEther('1000000');

      const mockDeploymentTx = {
        hash: '0x123',
        wait: jest.fn().mockResolvedValue({
          blockNumber: 1,
          gasUsed: BigInt(2000000),
        }),
      };

      const mockContract = {
        deploymentTransaction: jest.fn().mockReturnValue(mockDeploymentTx),
        waitForDeployment: jest.fn().mockResolvedValue(undefined),
        getAddress: jest.fn().mockResolvedValue('0xContractAddress'),
      };

      const mockFactory = {
        deploy: jest.fn().mockResolvedValue(mockContract),
        interface: {
          encodeDeploy: jest.fn().mockReturnValue('0xdeploydata'),
        },
        bytecode: '0xbytecode',
      };

      jest.spyOn(ethers, 'ContractFactory').mockImplementation(() => mockFactory as any);
      mockProvider.estimateGas.mockResolvedValue(BigInt(1500000));

      const result = await blockchainService.deployContract(otmAddress, initialSupply);

      expect(result).toEqual({
        contractAddress: '0xContractAddress',
        transactionHash: '0x123',
        blockNumber: 1,
        gasUsed: BigInt(2000000),
      });
    });

    it('should reject deployment with invalid OTM address', async () => {
      const invalidAddress = 'invalid-address';
      const initialSupply = ethers.parseEther('1000000');

      await expect(
        blockchainService.deployContract(invalidAddress, initialSupply)
      ).rejects.toThrow('Invalid OTM address provided');
    });
  });

  describe('Balance Management', () => {
    beforeEach(async () => {
      mockProvider.getNetwork.mockResolvedValue({
        name: 'hardhat',
        chainId: BigInt(1337),
      });
      
      mockProvider.getBlockNumber.mockResolvedValue(1);
      mockProvider.getBalance.mockResolvedValue(ethers.parseEther('1.0'));

      await blockchainService.initialize();
    });

    it('should get wallet balance', async () => {
      const expectedBalance = ethers.parseEther('2.5');
      mockProvider.getBalance.mockResolvedValue(expectedBalance);

      const balance = await blockchainService.getWalletBalance('0xWalletAddress');

      expect(balance).toBe('2.5');
      expect(mockProvider.getBalance).toHaveBeenCalledWith('0xWalletAddress');
    });

    it('should get wallet balance for default address when none provided', async () => {
      const expectedBalance = ethers.parseEther('1.5');
      mockProvider.getBalance.mockResolvedValue(expectedBalance);

      const balance = await blockchainService.getWalletBalance();

      expect(balance).toBe('1.5');
      expect(mockProvider.getBalance).toHaveBeenCalledWith(mockWallet.address);
    });
  });

  describe('Transaction Broadcasting', () => {
    beforeEach(async () => {
      mockProvider.getNetwork.mockResolvedValue({
        name: 'hardhat',
        chainId: BigInt(1337),
      });
      
      mockProvider.getBlockNumber.mockResolvedValue(1);
      mockProvider.getBalance.mockResolvedValue(ethers.parseEther('1.0'));

      await blockchainService.initialize();
    });

    it('should broadcast raw transactions', async () => {
      const signedTx = '0xSignedTransactionData';
      const mockTransaction = {
        hash: '0xBroadcastedHash',
      };

      mockProvider.broadcastTransaction.mockResolvedValue(mockTransaction);

      const result = await blockchainService.broadcastTransaction(signedTx);

      expect(result).toBe(mockTransaction);
      expect(mockProvider.broadcastTransaction).toHaveBeenCalledWith(signedTx);
    });

    it('should get transaction details', async () => {
      const txHash = '0xTransactionHash';
      const mockTransaction = {
        hash: txHash,
        from: '0xFromAddress',
        to: '0xToAddress',
        value: ethers.parseEther('1.0'),
        gasPrice: BigInt(20000000000),
      };
      const mockReceipt = {
        blockNumber: 100,
        gasUsed: BigInt(21000),
      };

      mockProvider.getTransaction.mockResolvedValue(mockTransaction);
      mockProvider.getTransactionReceipt.mockResolvedValue(mockReceipt);
      mockProvider.getBlockNumber.mockResolvedValue(105);

      const result = await blockchainService.getTransaction(txHash);

      expect(result).toEqual({
        hash: txHash,
        from: '0xFromAddress',
        to: '0xToAddress',
        value: ethers.parseEther('1.0').toString(),
        gasUsed: 21000,
        gasPrice: '20000000000',
        blockNumber: 100,
        confirmations: 6,
      });
    });
  });

  describe('Error Handling', () => {
    it('should throw error when contract not initialized for calls', async () => {
      await expect(
        blockchainService.callContract('balanceOf', ['0xAddress'])
      ).rejects.toThrow('Contract not initialized');
    });

    it('should handle provider errors gracefully', async () => {
      mockProvider.getBalance.mockRejectedValue(new Error('Provider error'));

      await expect(
        blockchainService.getWalletBalance('0xAddress')
      ).rejects.toThrow('Failed to get wallet balance');
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources properly', async () => {
      // First initialize without contract
      mockProvider.getNetwork.mockResolvedValue({
        name: 'hardhat',
        chainId: BigInt(1337),
      });
      
      mockProvider.getBlockNumber.mockResolvedValue(1);
      mockProvider.getBalance.mockResolvedValue(ethers.parseEther('1.0'));

      await blockchainService.initialize();

      // Now test cleanup
      await blockchainService.cleanup();

      expect(mockProvider.removeAllListeners).toHaveBeenCalled();
      
      const status = blockchainService.getConnectionStatus();
      expect(status.isConnected).toBe(false);
    });

    it('should cleanup resources with contract properly', async () => {
      // Setup successful initialization
      mockProvider.getNetwork.mockResolvedValue({
        name: 'hardhat',
        chainId: BigInt(1337),
      });
      
      mockProvider.getBlockNumber.mockResolvedValue(1);
      mockProvider.getBalance.mockResolvedValue(ethers.parseEther('1.0'));
      mockProvider.getCode.mockResolvedValue('0x123'); // Contract exists
      
      // Mock contract info method
      mockContract.getContractInfo.mockResolvedValue({
        tokenName: 'OfflineWalletToken',
        tokenSymbol: 'OWT',
      });

      // Temporarily set contract address
      const { config } = require('../config/config');
      const originalAddress = config.blockchain.contractAddress;
      config.blockchain.contractAddress = '0xContractAddress';

      try {
        await blockchainService.initialize();
        await blockchainService.cleanup();

        expect(mockContract.removeAllListeners).toHaveBeenCalled();
        expect(mockProvider.removeAllListeners).toHaveBeenCalled();
        
        const status = blockchainService.getConnectionStatus();
        expect(status.isConnected).toBe(false);
      } finally {
        // Restore original address
        config.blockchain.contractAddress = originalAddress;
      }
    });
  });
});