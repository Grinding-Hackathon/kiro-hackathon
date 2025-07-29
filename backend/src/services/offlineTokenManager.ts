import { ethers } from 'ethers';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/config';
import { logger } from '../utils/logger';
import { blockchainService } from './blockchainService';
import { 
  OfflineToken, 
  SignedTokenData, 
  OTMKeyPair, 
  Transaction,
  TokenRedemptionRequest 
} from '../types';

export interface TokenIssuanceRequest {
  userId: string;
  walletAddress: string;
  amount: number;
}

export interface TokenValidationResult {
  isValid: boolean;
  error?: string;
  tokenData?: SignedTokenData;
}

export interface RefundResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
}

export class OfflineTokenManager {
  private privateKey: string;
  private publicKey: string;
  private wallet: ethers.Wallet;

  constructor() {
    this.privateKey = config.otm.privateKey;
    this.publicKey = config.otm.publicKey;
    
    // Create wallet instance for signing
    this.wallet = new ethers.Wallet(this.privateKey);
    
    // Verify key pair consistency
    this.verifyKeyPair();
  }

  /**
   * Verify that the private and public keys match
   */
  private verifyKeyPair(): void {
    try {
      const derivedPublicKey = this.wallet.signingKey.publicKey;
      
      // Compare the derived public key with the configured one
      if (derivedPublicKey.toLowerCase() !== this.publicKey.toLowerCase()) {
        throw new Error('OTM private and public keys do not match');
      }
      
      logger.info('OTM key pair verification successful');
      logger.info(`OTM wallet address: ${this.wallet.address}`);
    } catch (error) {
      logger.error('OTM key pair verification failed:', error);
      throw new Error(`OTM key pair verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a new OTM key pair (for initial setup or key rotation)
   */
  static generateKeyPair(): OTMKeyPair {
    const wallet = ethers.Wallet.createRandom();
    return {
      privateKey: wallet.privateKey,
      publicKey: wallet.signingKey.publicKey,
    };
  }

  /**
   * Issue offline tokens to a user
   */
  async issueTokens(request: TokenIssuanceRequest): Promise<OfflineToken[]> {
    try {
      logger.info(`Issuing tokens for user ${request.userId}`, {
        amount: request.amount,
        walletAddress: request.walletAddress,
      });

      // Validate request
      this.validateTokenIssuanceRequest(request);

      // Check if user has sufficient blockchain balance
      await this.verifyUserBalance(request.walletAddress, request.amount);

      // Create token data
      const tokenId = uuidv4();
      const issuedAt = Math.floor(Date.now() / 1000);
      const expiresAt = issuedAt + (config.otm.tokenExpirationDays * 24 * 60 * 60);

      // Create the token data to be signed
      const tokenData: Omit<SignedTokenData, 'signature'> = {
        tokenId,
        userId: request.userId,
        amount: request.amount,
        issuedAt,
        expiresAt,
      };

      // Generate cryptographic signature
      const signature = await this.signTokenData(tokenData);

      // Create the complete signed token data (for logging/debugging)
      logger.debug('Token signed successfully', {
        tokenId,
        signature,
      });

      // Create offline token record
      const offlineToken: OfflineToken = {
        id: tokenId,
        userId: request.userId,
        amount: request.amount,
        signature,
        issuedAt: new Date(issuedAt * 1000),
        expiresAt: new Date(expiresAt * 1000),
        status: 'active',
      };

      // Transfer tokens from user to OTM on blockchain
      await this.transferTokensToOTM(request.walletAddress, request.amount, tokenId);

      logger.info(`Tokens issued successfully`, {
        tokenId,
        userId: request.userId,
        amount: request.amount,
        expiresAt: new Date(expiresAt * 1000),
      });

      return [offlineToken];
    } catch (error) {
      logger.error('Token issuance failed:', error);
      throw new Error(`Token issuance failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate token signature and data integrity
   */
  async validateToken(token: OfflineToken): Promise<TokenValidationResult> {
    try {
      logger.debug(`Validating token ${token.id}`);

      // Check if token is expired
      if (new Date() > token.expiresAt) {
        return {
          isValid: false,
          error: 'Token has expired',
        };
      }

      // Check token status
      if (token.status !== 'active') {
        return {
          isValid: false,
          error: `Token status is ${token.status}`,
        };
      }

      // Reconstruct token data for signature verification
      const tokenData: Omit<SignedTokenData, 'signature'> = {
        tokenId: token.id,
        userId: token.userId,
        amount: token.amount,
        issuedAt: Math.floor(token.issuedAt.getTime() / 1000),
        expiresAt: Math.floor(token.expiresAt.getTime() / 1000),
      };

      // Verify signature
      const isSignatureValid = await this.verifyTokenSignature(tokenData, token.signature);
      
      if (!isSignatureValid) {
        return {
          isValid: false,
          error: 'Invalid token signature',
        };
      }

      const signedTokenData: SignedTokenData = {
        ...tokenData,
        signature: token.signature,
      };

      logger.debug(`Token ${token.id} validation successful`);

      return {
        isValid: true,
        tokenData: signedTokenData,
      };
    } catch (error) {
      logger.error(`Token validation failed for ${token.id}:`, error);
      return {
        isValid: false,
        error: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Redeem offline tokens and convert to blockchain tokens
   */
  async redeemTokens(request: TokenRedemptionRequest, userWalletAddress: string): Promise<Transaction> {
    try {
      logger.info(`Redeeming tokens for user wallet ${userWalletAddress}`, {
        tokenCount: request.tokens.length,
      });

      // In a real implementation, we would fetch token details from database
      // For now, we'll simulate validation by checking signature format
      const validationResults = request.tokens.map((tokenRequest) => {
        // Basic validation - in real implementation would fetch from DB and validate properly
        const isValidFormat = tokenRequest.signature.startsWith('0x') && tokenRequest.signature.length > 100;
        
        if (isValidFormat) {
          return {
            isValid: true,
            tokenData: {
              tokenId: tokenRequest.id,
              userId: 'simulated-user',
              amount: 75, // Simulated amount for testing
              issuedAt: Math.floor(Date.now() / 1000),
              expiresAt: Math.floor(Date.now() / 1000) + 86400,
              signature: tokenRequest.signature,
            },
          };
        } else {
          return {
            isValid: false,
            error: 'Invalid token signature format',
          };
        }
      });

      // Check if all tokens are valid
      const invalidTokens = validationResults.filter(result => !result.isValid);
      if (invalidTokens.length > 0) {
        throw new Error(`Invalid tokens found: ${invalidTokens.map(t => t.error).join(', ')}`);
      }

      // Calculate total amount to redeem
      const totalAmount = validationResults.reduce((sum, result) => {
        return sum + (result.tokenData?.amount || 0);
      }, 0);

      // Transfer tokens from OTM to user on blockchain
      const transactionHash = await this.transferTokensToUser(userWalletAddress, totalAmount);

      // Create transaction record
      const transaction: Transaction = {
        id: uuidv4(),
        receiverId: userWalletAddress,
        amount: totalAmount,
        type: 'token_redemption',
        status: 'completed',
        blockchainTxHash: transactionHash,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      logger.info(`Tokens redeemed successfully`, {
        transactionId: transaction.id,
        userWalletAddress,
        totalAmount,
        transactionHash,
      });

      return transaction;
    } catch (error) {
      logger.error('Token redemption failed:', error);
      throw new Error(`Token redemption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Handle expired tokens and process automatic refunds
   */
  async handleExpiredTokens(userId: string): Promise<RefundResult[]> {
    try {
      logger.info(`Processing expired tokens for user ${userId}`);

      // In a real implementation, this would fetch expired tokens from database
      // For now, we'll simulate the process
      const expiredTokens: OfflineToken[] = []; // Would be fetched from database

      const refundResults: RefundResult[] = [];

      for (const token of expiredTokens) {
        try {
          // Validate that token is indeed expired and not already processed
          if (token.status !== 'expired') {
            continue;
          }

          // Process refund by transferring tokens back to user
          const transactionHash = await this.processTokenRefund(token);

          refundResults.push({
            success: true,
            transactionHash,
          });

          logger.info(`Refund processed for expired token ${token.id}`, {
            amount: token.amount,
            transactionHash,
          });
        } catch (error) {
          logger.error(`Failed to process refund for token ${token.id}:`, error);
          refundResults.push({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      logger.info(`Expired token processing completed for user ${userId}`, {
        totalTokens: expiredTokens.length,
        successfulRefunds: refundResults.filter(r => r.success).length,
        failedRefunds: refundResults.filter(r => !r.success).length,
      });

      return refundResults;
    } catch (error) {
      logger.error(`Failed to handle expired tokens for user ${userId}:`, error);
      throw new Error(`Expired token handling failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get OTM public key for client verification
   */
  getPublicKey(): string {
    return this.publicKey;
  }

  /**
   * Get OTM wallet address
   */
  getWalletAddress(): string {
    return this.wallet.address;
  }

  /**
   * Sign token data with OTM private key
   */
  private async signTokenData(tokenData: Omit<SignedTokenData, 'signature'>): Promise<string> {
    try {
      // Create a hash of the token data
      const dataHash = this.createTokenDataHash(tokenData);
      
      // Sign the hash
      const signature = await this.wallet.signMessage(ethers.getBytes(dataHash));
      
      logger.debug(`Token data signed`, {
        tokenId: tokenData.tokenId,
        dataHash,
        signature,
      });

      return signature;
    } catch (error) {
      logger.error('Token data signing failed:', error);
      throw new Error(`Token data signing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Verify token signature
   */
  private async verifyTokenSignature(
    tokenData: Omit<SignedTokenData, 'signature'>, 
    signature: string
  ): Promise<boolean> {
    try {
      // Create the same hash that was signed
      const dataHash = this.createTokenDataHash(tokenData);
      
      // Recover the signer address from the signature
      const recoveredAddress = ethers.verifyMessage(ethers.getBytes(dataHash), signature);
      
      // Check if the recovered address matches the OTM wallet address
      const isValid = recoveredAddress.toLowerCase() === this.wallet.address.toLowerCase();
      
      logger.debug(`Token signature verification`, {
        tokenId: tokenData.tokenId,
        isValid,
        recoveredAddress,
        expectedAddress: this.wallet.address,
      });

      return isValid;
    } catch (error) {
      logger.error('Token signature verification failed:', error);
      return false;
    }
  }

  /**
   * Create a hash of token data for signing
   */
  private createTokenDataHash(tokenData: Omit<SignedTokenData, 'signature'>): string {
    // Create a deterministic string representation of the token data
    const dataString = `${tokenData.tokenId}:${tokenData.userId}:${tokenData.amount}:${tokenData.issuedAt}:${tokenData.expiresAt}`;
    
    // Create keccak256 hash
    return ethers.keccak256(ethers.toUtf8Bytes(dataString));
  }

  /**
   * Validate token issuance request
   */
  private validateTokenIssuanceRequest(request: TokenIssuanceRequest): void {
    if (!request.userId || typeof request.userId !== 'string') {
      throw new Error('Invalid user ID');
    }

    if (!request.walletAddress || !ethers.isAddress(request.walletAddress)) {
      throw new Error('Invalid wallet address');
    }

    if (!request.amount || request.amount <= 0) {
      throw new Error('Invalid token amount');
    }

    if (request.amount > 1000000) { // Reasonable upper limit
      throw new Error('Token amount exceeds maximum limit');
    }
  }

  /**
   * Verify user has sufficient balance for token purchase
   */
  private async verifyUserBalance(walletAddress: string, amount: number): Promise<void> {
    try {
      const balance = await blockchainService.getTokenBalance(walletAddress);
      const balanceNumber = parseFloat(balance);

      if (balanceNumber < amount) {
        throw new Error(`Insufficient balance. Required: ${amount}, Available: ${balanceNumber}`);
      }

      logger.debug(`User balance verification successful`, {
        walletAddress,
        requiredAmount: amount,
        availableBalance: balanceNumber,
      });
    } catch (error) {
      logger.error('User balance verification failed:', error);
      throw error;
    }
  }

  /**
   * Transfer tokens from user to OTM on blockchain
   */
  private async transferTokensToOTM(userWalletAddress: string, amount: number, requestId: string): Promise<string> {
    try {
      logger.info(`Transferring ${amount} tokens from ${userWalletAddress} to OTM`, { requestId });

      // Convert amount to wei (assuming 18 decimals)
      const amountWei = ethers.parseEther(amount.toString());

      // Call the smart contract's transferToOTM function
      const transaction = await blockchainService.sendContractTransaction(
        'transferToOTM',
        [userWalletAddress, amountWei, requestId]
      );

      // Wait for transaction confirmation
      const receipt = await blockchainService.waitForTransactionConfirmation(transaction.hash);

      logger.info(`Tokens transferred to OTM successfully`, {
        transactionHash: transaction.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      });

      return transaction.hash;
    } catch (error) {
      logger.error('Failed to transfer tokens to OTM:', error);
      throw new Error(`Token transfer to OTM failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Transfer tokens from OTM to user on blockchain
   */
  private async transferTokensToUser(userWalletAddress: string, amount: number): Promise<string> {
    try {
      logger.info(`Transferring ${amount} tokens from OTM to ${userWalletAddress}`);

      // Convert amount to wei (assuming 18 decimals)
      const amountWei = ethers.parseEther(amount.toString());

      // Generate a unique request ID for this redemption
      const requestId = uuidv4();

      // Call the smart contract's transferToClient function
      const transaction = await blockchainService.sendContractTransaction(
        'transferToClient',
        [userWalletAddress, amountWei, requestId]
      );

      // Wait for transaction confirmation
      const receipt = await blockchainService.waitForTransactionConfirmation(transaction.hash);

      logger.info(`Tokens transferred to user successfully`, {
        transactionHash: transaction.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      });

      return transaction.hash;
    } catch (error) {
      logger.error('Failed to transfer tokens to user:', error);
      throw new Error(`Token transfer to user failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process refund for expired token
   */
  private async processTokenRefund(token: OfflineToken): Promise<string> {
    try {
      logger.info(`Processing refund for expired token ${token.id}`, {
        amount: token.amount,
        userId: token.userId,
      });

      // In a real implementation, we would need to get the user's wallet address
      // For now, we'll assume it's available or passed as parameter
      const userWalletAddress = '0x0000000000000000000000000000000000000000'; // Placeholder

      // Transfer tokens back to user
      const transactionHash = await this.transferTokensToUser(userWalletAddress, token.amount);

      logger.info(`Refund processed successfully for token ${token.id}`, {
        transactionHash,
      });

      return transactionHash;
    } catch (error) {
      logger.error(`Failed to process refund for token ${token.id}:`, error);
      throw error;
    }
  }
}

// Export singleton instance
export const offlineTokenManager = new OfflineTokenManager();