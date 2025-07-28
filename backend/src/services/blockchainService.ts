import { ethers, Contract, JsonRpcProvider, Wallet, TransactionResponse, TransactionReceipt } from 'ethers';
import { config } from '../config/config';
import { logger } from '../utils/logger';
import { BlockchainTransaction, SmartContractEvent } from '../types';

// Import contract ABI (will be generated after compilation)
import OfflineWalletTokenABI from '../../artifacts/contracts/OfflineWalletToken.sol/OfflineWalletToken.json';

export interface ContractDeploymentResult {
  contractAddress: string;
  transactionHash: string;
  blockNumber: number;
  gasUsed: bigint;
}

export interface TransactionOptions {
  gasLimit?: bigint;
  gasPrice?: bigint;
  value?: bigint;
  nonce?: number;
}

export interface ContractCallResult<T = any> {
  result: T;
  gasUsed?: bigint;
  blockNumber?: number;
}

export interface TransactionConfirmationOptions {
  confirmations?: number;
  timeout?: number;
}

export class BlockchainService {
  private provider: JsonRpcProvider;
  private wallet: Wallet;
  private contract: Contract | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private readonly maxReconnectAttempts: number = 5;
  private readonly reconnectDelay: number = 5000; // 5 seconds

  constructor() {
    this.provider = new JsonRpcProvider(config.blockchain.rpcUrl);
    this.wallet = new Wallet(config.blockchain.privateKey, this.provider);
    
    // Set up event listeners for connection monitoring
    this.setupConnectionMonitoring();
  }

  /**
   * Initialize blockchain connection and contract instance
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing blockchain service...');
      
      // Test connection
      await this.testConnection();
      
      // Initialize contract if address is provided
      if (config.blockchain.contractAddress) {
        await this.initializeContract(config.blockchain.contractAddress);
      }
      
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      logger.info('Blockchain service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize blockchain service:', error);
      throw new Error(`Blockchain initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Test blockchain connection
   */
  private async testConnection(): Promise<void> {
    try {
      const network = await this.provider.getNetwork();
      const blockNumber = await this.provider.getBlockNumber();
      const balance = await this.provider.getBalance(this.wallet.address);
      
      logger.info(`Connected to network: ${network.name} (Chain ID: ${network.chainId})`);
      logger.info(`Current block number: ${blockNumber}`);
      logger.info(`Wallet address: ${this.wallet.address}`);
      logger.info(`Wallet balance: ${ethers.formatEther(balance)} ETH`);
      
      // Verify minimum balance for gas fees
      const minBalance = ethers.parseEther('0.01'); // 0.01 ETH minimum
      if (balance < minBalance) {
        logger.warn(`Low wallet balance: ${ethers.formatEther(balance)} ETH. Minimum recommended: 0.01 ETH`);
      }
    } catch (error) {
      logger.error('Connection test failed:', error);
      throw error;
    }
  }

  /**
   * Initialize contract instance
   */
  private async initializeContract(contractAddress: string): Promise<void> {
    try {
      this.contract = new Contract(contractAddress, OfflineWalletTokenABI.abi, this.wallet);
      
      // Verify contract is deployed and accessible
      const contractCode = await this.provider.getCode(contractAddress);
      if (contractCode === '0x') {
        throw new Error(`No contract found at address: ${contractAddress}`);
      }
      
      // Test contract call
      if (this.contract) {
        const contractInfo = await (this.contract as any)['getContractInfo']();
        logger.info(`Contract initialized: ${contractInfo.tokenName} (${contractInfo.tokenSymbol})`);
        logger.info(`Contract address: ${contractAddress}`);
      }
      
    } catch (error) {
      logger.error('Contract initialization failed:', error);
      throw error;
    }
  }

  /**
   * Deploy new contract instance
   */
  async deployContract(otmAddress: string, initialSupply: bigint, options?: TransactionOptions): Promise<ContractDeploymentResult> {
    try {
      logger.info('Deploying OfflineWalletToken contract...');
      
      if (!ethers.isAddress(otmAddress)) {
        throw new Error('Invalid OTM address provided');
      }

      const contractFactory = new ethers.ContractFactory(
        OfflineWalletTokenABI.abi,
        OfflineWalletTokenABI.bytecode,
        this.wallet
      );

      // Estimate gas for deployment
      const deploymentData = contractFactory.interface.encodeDeploy([otmAddress, initialSupply]);
      const estimatedGas = await this.provider.estimateGas({
        data: contractFactory.bytecode + deploymentData.slice(2),
      });

      const deployOptions = {
        gasLimit: options?.gasLimit || estimatedGas * BigInt(120) / BigInt(100), // 20% buffer
        gasPrice: options?.gasPrice,
      };

      const contract = await contractFactory.deploy(otmAddress, initialSupply, deployOptions);
      const deploymentTx = contract.deploymentTransaction();
      
      if (!deploymentTx) {
        throw new Error('Deployment transaction not found');
      }

      logger.info(`Contract deployment transaction: ${deploymentTx.hash}`);
      
      // Wait for deployment confirmation
      await contract.waitForDeployment();
      const contractAddress = await contract.getAddress();
      
      // Get transaction receipt for gas information
      const txReceipt = await deploymentTx.wait();
      if (!txReceipt) {
        throw new Error('Transaction receipt not found');
      }

      this.contract = contract as Contract;
      
      const result: ContractDeploymentResult = {
        contractAddress,
        transactionHash: deploymentTx.hash,
        blockNumber: txReceipt.blockNumber,
        gasUsed: txReceipt.gasUsed,
      };

      logger.info(`Contract deployed successfully at: ${contractAddress}`);
      logger.info(`Gas used: ${result.gasUsed.toString()}`);
      
      return result;
    } catch (error) {
      logger.error('Contract deployment failed:', error);
      throw new Error(`Contract deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Call contract method (read-only)
   */
  async callContract<T = any>(methodName: string, params: any[] = []): Promise<ContractCallResult<T>> {
    try {
      this.ensureContractInitialized();
      
      logger.debug(`Calling contract method: ${methodName}`, { params });
      
      const contract = this.contract! as any;
      const result = await contract[methodName](...params);
      const blockNumber = await this.provider.getBlockNumber();
      
      return {
        result,
        blockNumber,
      };
    } catch (error) {
      logger.error(`Contract call failed for method ${methodName}:`, error);
      throw new Error(`Contract call failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Send contract transaction (state-changing)
   */
  async sendContractTransaction(
    methodName: string, 
    params: any[] = [], 
    options?: TransactionOptions
  ): Promise<TransactionResponse> {
    try {
      this.ensureContractInitialized();
      
      logger.info(`Sending contract transaction: ${methodName}`, { params });
      
      // Estimate gas if not provided
      let gasLimit = options?.gasLimit;
      if (!gasLimit) {
        try {
          const contract = this.contract! as any;
          const estimatedGas = await contract[methodName].estimateGas(...params, {
            value: options?.value || 0,
          });
          gasLimit = estimatedGas * BigInt(120) / BigInt(100); // 20% buffer
        } catch (gasError) {
          logger.warn('Gas estimation failed, using default limit:', gasError);
          gasLimit = BigInt(500000); // Default gas limit
        }
      }

      const txOptions = {
        gasLimit,
        gasPrice: options?.gasPrice,
        value: options?.value || 0,
        nonce: options?.nonce,
      };

      const contract = this.contract! as any;
      const transaction = await contract[methodName](...params, txOptions);
      
      logger.info(`Transaction sent: ${transaction.hash}`);
      logger.debug('Transaction details:', {
        hash: transaction.hash,
        gasLimit: gasLimit.toString(),
        gasPrice: transaction.gasPrice?.toString(),
        nonce: transaction.nonce,
      });
      
      return transaction;
    } catch (error) {
      logger.error(`Contract transaction failed for method ${methodName}:`, error);
      throw new Error(`Contract transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Wait for transaction confirmation
   */
  async waitForTransactionConfirmation(
    txHash: string, 
    options: TransactionConfirmationOptions = {}
  ): Promise<TransactionReceipt> {
    try {
      const { confirmations = 1, timeout = 300000 } = options; // 5 minutes default timeout
      
      logger.info(`Waiting for transaction confirmation: ${txHash}`);
      logger.debug(`Confirmations required: ${confirmations}, Timeout: ${timeout}ms`);
      
      const transaction = await this.provider.getTransaction(txHash);
      if (!transaction) {
        throw new Error(`Transaction not found: ${txHash}`);
      }

      // Set up timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Transaction confirmation timeout')), timeout);
      });

      // Wait for confirmation with timeout
      const receipt = await Promise.race([
        transaction.wait(confirmations),
        timeoutPromise,
      ]);

      if (!receipt) {
        throw new Error('Transaction receipt not found');
      }

      logger.info(`Transaction confirmed: ${txHash}`);
      logger.debug('Transaction receipt:', {
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        status: receipt.status,
        confirmations: await receipt.confirmations(),
      });
      
      return receipt;
    } catch (error) {
      logger.error(`Transaction confirmation failed for ${txHash}:`, error);
      throw new Error(`Transaction confirmation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Broadcast raw transaction
   */
  async broadcastTransaction(signedTransaction: string): Promise<TransactionResponse> {
    try {
      logger.info('Broadcasting raw transaction...');
      
      const transaction = await this.provider.broadcastTransaction(signedTransaction);
      
      logger.info(`Transaction broadcasted: ${transaction.hash}`);
      
      return transaction;
    } catch (error) {
      logger.error('Transaction broadcast failed:', error);
      throw new Error(`Transaction broadcast failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get transaction details
   */
  async getTransaction(txHash: string): Promise<BlockchainTransaction | null> {
    try {
      const [transaction, receipt] = await Promise.all([
        this.provider.getTransaction(txHash),
        this.provider.getTransactionReceipt(txHash),
      ]);

      if (!transaction) {
        return null;
      }

      const currentBlock = await this.provider.getBlockNumber();
      const confirmations = receipt ? currentBlock - receipt.blockNumber + 1 : 0;

      return {
        hash: transaction.hash,
        from: transaction.from,
        to: transaction.to || '',
        value: transaction.value.toString(),
        gasUsed: receipt ? Number(receipt.gasUsed) : 0,
        gasPrice: transaction.gasPrice?.toString() || '0',
        blockNumber: receipt ? receipt.blockNumber : 0,
        confirmations,
      };
    } catch (error) {
      logger.error(`Failed to get transaction ${txHash}:`, error);
      throw new Error(`Failed to get transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get wallet balance
   */
  async getWalletBalance(address?: string): Promise<string> {
    try {
      const walletAddress = address || this.wallet.address;
      const balance = await this.provider.getBalance(walletAddress);
      return ethers.formatEther(balance);
    } catch (error) {
      logger.error('Failed to get wallet balance:', error);
      throw new Error(`Failed to get wallet balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get token balance from contract
   */
  async getTokenBalance(address: string): Promise<string> {
    try {
      this.ensureContractInitialized();
      
      const contract = this.contract! as any;
      const balance = await contract['balanceOf'](address);
      return ethers.formatEther(balance);
    } catch (error) {
      logger.error('Failed to get token balance:', error);
      throw new Error(`Failed to get token balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Listen for contract events
   */
  setupEventListeners(): void {
    if (!this.contract) {
      logger.warn('Contract not initialized, cannot set up event listeners');
      return;
    }

    logger.info('Setting up contract event listeners...');

    // Listen for TransferToClient events
    this.contract.on('TransferToClient', (client: string, amount: bigint, requestId: string, event: any) => {
      logger.info('TransferToClient event received:', {
        client,
        amount: ethers.formatEther(amount),
        requestId,
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber,
      });
    });

    // Listen for TransferToOTM events
    this.contract.on('TransferToOTM', (client: string, amount: bigint, requestId: string, event: any) => {
      logger.info('TransferToOTM event received:', {
        client,
        amount: ethers.formatEther(amount),
        requestId,
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber,
      });
    });

    // Listen for other important events
    this.contract.on('TokensMinted', (to: string, amount: bigint, event: any) => {
      logger.info('TokensMinted event received:', {
        to,
        amount: ethers.formatEther(amount),
        transactionHash: event.transactionHash,
      });
    });

    this.contract.on('TokensBurned', (from: string, amount: bigint, event: any) => {
      logger.info('TokensBurned event received:', {
        from,
        amount: ethers.formatEther(amount),
        transactionHash: event.transactionHash,
      });
    });
  }

  /**
   * Get contract events
   */
  async getContractEvents(
    eventName: string, 
    fromBlock: number = 0, 
    toBlock: number | 'latest' = 'latest'
  ): Promise<SmartContractEvent[]> {
    try {
      this.ensureContractInitialized();
      
      const contract = this.contract! as any;
      const filter = contract.filters[eventName]();
      const events = await contract.queryFilter(filter, fromBlock, toBlock);
      
      return events.map((event: any) => {
        const eventLog = event as ethers.EventLog;
        return {
          event: eventLog.eventName || eventName,
          returnValues: eventLog.args ? Object.fromEntries(
            Object.entries(eventLog.args).filter(([key]) => isNaN(Number(key)))
          ) : {},
          transactionHash: event.transactionHash,
          blockNumber: event.blockNumber,
        };
      });
    } catch (error) {
      logger.error(`Failed to get contract events for ${eventName}:`, error);
      throw new Error(`Failed to get contract events: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Setup connection monitoring and auto-reconnection
   */
  private setupConnectionMonitoring(): void {
    // Monitor provider connection
    this.provider.on('error', (error) => {
      logger.error('Provider error:', error);
      this.isConnected = false;
      this.handleConnectionLoss();
    });

    // Set up periodic health check only in non-test environments
    if (process.env['NODE_ENV'] !== 'test') {
      const healthCheckInterval = setInterval(async () => {
        if (this.isConnected) {
          try {
            await this.provider.getBlockNumber();
          } catch (error) {
            logger.warn('Health check failed:', error);
            this.isConnected = false;
            this.handleConnectionLoss();
          }
        }
      }, 30000); // Check every 30 seconds

      // Store interval reference for cleanup
      (this as any).healthCheckInterval = healthCheckInterval;
    }
  }

  /**
   * Handle connection loss and attempt reconnection
   */
  private async handleConnectionLoss(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached. Manual intervention required.');
      return;
    }

    this.reconnectAttempts++;
    logger.info(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    const reconnectTimeout = setTimeout(async () => {
      try {
        if (this.isConnected === false) { // Only reconnect if still disconnected
          await this.initialize();
          logger.info('Reconnection successful');
        }
      } catch (error) {
        logger.error('Reconnection failed:', error);
        if (this.isConnected === false) { // Only continue if still disconnected
          this.handleConnectionLoss();
        }
      }
    }, this.reconnectDelay * this.reconnectAttempts);

    // Store timeout reference for cleanup
    (this as any).reconnectTimeout = reconnectTimeout;
  }

  /**
   * Ensure contract is initialized
   */
  private ensureContractInitialized(): void {
    if (!this.contract) {
      throw new Error('Contract not initialized. Call initialize() first or deploy a new contract.');
    }
    if (!this.isConnected) {
      throw new Error('Blockchain connection lost. Attempting to reconnect...');
    }
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): { isConnected: boolean; reconnectAttempts: number } {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  /**
   * Get current network information
   */
  async getNetworkInfo(): Promise<{ name: string; chainId: bigint; blockNumber: number }> {
    try {
      const [network, blockNumber] = await Promise.all([
        this.provider.getNetwork(),
        this.provider.getBlockNumber(),
      ]);

      return {
        name: network.name,
        chainId: network.chainId,
        blockNumber,
      };
    } catch (error) {
      logger.error('Failed to get network info:', error);
      throw new Error(`Failed to get network info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      // Set disconnected state first to prevent further operations
      this.isConnected = false;
      
      // Clear any pending timeouts and intervals
      if ((this as any).healthCheckInterval) {
        clearInterval((this as any).healthCheckInterval);
        (this as any).healthCheckInterval = null;
      }
      
      if ((this as any).reconnectTimeout) {
        clearTimeout((this as any).reconnectTimeout);
        (this as any).reconnectTimeout = null;
      }
      
      // Remove event listeners
      if (this.contract) {
        this.contract.removeAllListeners();
        this.contract = null;
      }
      
      if (this.provider) {
        this.provider.removeAllListeners();
      }
      
      // Reset reconnection attempts
      this.reconnectAttempts = 0;
      
      logger.info('Blockchain service cleanup completed');
    } catch (error) {
      logger.error('Error during cleanup:', error);
    }
  }
}

// Export singleton instance
export const blockchainService = new BlockchainService();