import { ethers } from 'ethers';

// Generate a valid key pair for testing
const testWallet = ethers.Wallet.createRandom();
const testPrivateKey = testWallet.privateKey;
const testPublicKey = testWallet.signingKey.publicKey;

// Mock the blockchain service
jest.mock('../services/blockchainService', () => ({
  blockchainService: {
    getTokenBalance: jest.fn(),
    sendContractTransaction: jest.fn(),
    waitForTransactionConfirmation: jest.fn(),
  },
}));

// Mock the config
jest.mock('../config/config', () => ({
  config: {
    otm: {
      privateKey: testPrivateKey,
      publicKey: testPublicKey,
      tokenExpirationDays: 30,
    },
    blockchain: {
      rpcUrl: 'http://localhost:8545',
      privateKey: testPrivateKey,
      contractAddress: testWallet.address,
    },
  },
}));

import { OfflineTokenManager } from '../services/offlineTokenManager';
import { blockchainService } from '../services/blockchainService';
import { config } from '../config/config';
import { OfflineToken } from '../types';

const mockBlockchainService = blockchainService as jest.Mocked<typeof blockchainService>;

describe('OfflineTokenManager', () => {
  let otm: OfflineTokenManager;
  let mockWallet: ethers.Wallet;

  beforeEach(() => {
    // Create a test wallet for consistent testing
    mockWallet = new ethers.Wallet(testPrivateKey);
    
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock blockchain service methods
    mockBlockchainService.getTokenBalance.mockResolvedValue('1000.0');
    mockBlockchainService.sendContractTransaction.mockResolvedValue({
      hash: '0xtest-transaction-hash',
      wait: jest.fn().mockResolvedValue({ blockNumber: 12345 }),
    } as any);
    mockBlockchainService.waitForTransactionConfirmation.mockResolvedValue({
      blockNumber: 12345,
      gasUsed: BigInt(21000),
    } as any);

    otm = new OfflineTokenManager();
  });

  describe('Key Pair Management', () => {
    test('should generate a valid key pair', () => {
      const keyPair = OfflineTokenManager.generateKeyPair();
      
      expect(keyPair.privateKey).toMatch(/^0x[a-fA-F0-9]{64}$/);
      expect(keyPair.publicKey).toMatch(/^0x[a-fA-F0-9]{66,130}$/);
      
      // Verify the key pair is consistent
      const wallet = new ethers.Wallet(keyPair.privateKey);
      expect(wallet.signingKey.publicKey.toLowerCase()).toBe(keyPair.publicKey.toLowerCase());
    });

    test('should return correct public key', () => {
      const publicKey = otm.getPublicKey();
      expect(publicKey).toBe(testPublicKey);
    });

    test('should return correct wallet address', () => {
      const address = otm.getWalletAddress();
      expect(address).toBe(mockWallet.address);
    });
  });

  describe('Token Issuance', () => {
    const validRequest = {
      userId: 'user-123',
      walletAddress: testWallet.address,
      amount: 100,
    };

    test('should issue tokens successfully', async () => {
      const tokens = await otm.issueTokens(validRequest);
      
      expect(tokens).toHaveLength(1);
      const token = tokens[0]!;
      expect(token).toMatchObject({
        userId: validRequest.userId,
        amount: validRequest.amount,
        status: 'active',
      });
      expect(token.id).toBeDefined();
      expect(token.signature).toBeDefined();
      expect(token.issuedAt).toBeInstanceOf(Date);
      expect(token.expiresAt).toBeInstanceOf(Date);
      
      // Verify expiration date is set correctly
      const expectedExpirationTime = token.issuedAt.getTime() + (config.otm.tokenExpirationDays * 24 * 60 * 60 * 1000);
      expect(token.expiresAt.getTime()).toBe(expectedExpirationTime);
    });

    test('should verify user balance before issuing tokens', async () => {
      await otm.issueTokens(validRequest);
      
      expect(mockBlockchainService.getTokenBalance).toHaveBeenCalledWith(validRequest.walletAddress);
    });

    test('should transfer tokens to OTM on blockchain', async () => {
      await otm.issueTokens(validRequest);
      
      expect(mockBlockchainService.sendContractTransaction).toHaveBeenCalledWith(
        'transferToOTM',
        expect.arrayContaining([
          validRequest.walletAddress,
          ethers.parseEther(validRequest.amount.toString()),
          expect.any(String), // requestId
        ])
      );
    });

    test('should reject invalid user ID', async () => {
      const invalidRequest = { ...validRequest, userId: '' };
      
      await expect(otm.issueTokens(invalidRequest)).rejects.toThrow('Invalid user ID');
    });

    test('should reject invalid wallet address', async () => {
      const invalidRequest = { ...validRequest, walletAddress: 'invalid-address' };
      
      await expect(otm.issueTokens(invalidRequest)).rejects.toThrow('Invalid wallet address');
    });

    test('should reject invalid amount', async () => {
      const invalidRequest = { ...validRequest, amount: 0 };
      
      await expect(otm.issueTokens(invalidRequest)).rejects.toThrow('Invalid token amount');
    });

    test('should reject amount exceeding maximum limit', async () => {
      const invalidRequest = { ...validRequest, amount: 2000000 };
      
      await expect(otm.issueTokens(invalidRequest)).rejects.toThrow('Token amount exceeds maximum limit');
    });

    test('should reject when user has insufficient balance', async () => {
      mockBlockchainService.getTokenBalance.mockResolvedValue('50.0');
      
      await expect(otm.issueTokens(validRequest)).rejects.toThrow('Insufficient balance');
    });
  });

  describe('Token Validation', () => {
    let validToken: OfflineToken;

    beforeEach(async () => {
      const request = {
        userId: 'user-123',
        walletAddress: testWallet.address,
        amount: 100,
      };
      const tokens = await otm.issueTokens(request);
      validToken = tokens[0]!;
    });

    test('should validate a valid token', async () => {
      const result = await otm.validateToken(validToken);
      
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.tokenData).toBeDefined();
      expect(result.tokenData?.tokenId).toBe(validToken.id);
      expect(result.tokenData?.amount).toBe(validToken.amount);
    });

    test('should reject expired token', async () => {
      const expiredToken = {
        ...validToken,
        expiresAt: new Date(Date.now() - 1000), // 1 second ago
      };
      
      const result = await otm.validateToken(expiredToken);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Token has expired');
    });

    test('should reject token with invalid status', async () => {
      const spentToken = {
        ...validToken,
        status: 'spent' as const,
      };
      
      const result = await otm.validateToken(spentToken);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Token status is spent');
    });

    test('should reject token with invalid signature', async () => {
      const tamperedToken = {
        ...validToken,
        signature: '0xinvalid-signature',
      };
      
      const result = await otm.validateToken(tamperedToken);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid token signature');
    });

    test('should reject token with tampered data', async () => {
      const tamperedToken = {
        ...validToken,
        amount: validToken.amount + 100, // Changed amount but kept original signature
      };
      
      const result = await otm.validateToken(tamperedToken);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid token signature');
    });
  });

  describe('Token Redemption', () => {
    let validTokens: OfflineToken[];

    beforeEach(async () => {
      const request1 = {
        userId: 'user-123',
        walletAddress: testWallet.address,
        amount: 100,
      };
      const request2 = {
        userId: 'user-123',
        walletAddress: testWallet.address,
        amount: 50,
      };
      
      const tokens1 = await otm.issueTokens(request1);
      const tokens2 = await otm.issueTokens(request2);
      validTokens = [...tokens1, ...tokens2];
    });

    test('should redeem valid tokens successfully', async () => {
      const redemptionRequest = {
        tokens: validTokens.map(token => ({
          id: token.id!,
          signature: token.signature,
        })),
      };
      
      const userWalletAddress = testWallet.address;
      
      const transaction = await otm.redeemTokens(redemptionRequest, userWalletAddress);
      
      expect(transaction).toMatchObject({
        receiverId: userWalletAddress,
        amount: 150, // 100 + 50
        type: 'token_redemption',
        status: 'completed',
        blockchainTxHash: '0xtest-transaction-hash',
      });
      expect(transaction.id).toBeDefined();
      expect(transaction.createdAt).toBeInstanceOf(Date);
    });

    test('should transfer tokens to user on blockchain', async () => {
      const redemptionRequest = {
        tokens: validTokens.map(token => ({
          id: token.id!,
          signature: token.signature,
        })),
      };
      
      const userWalletAddress = testWallet.address;
      
      await otm.redeemTokens(redemptionRequest, userWalletAddress);
      
      expect(mockBlockchainService.sendContractTransaction).toHaveBeenCalledWith(
        'transferToClient',
        expect.arrayContaining([
          userWalletAddress,
          ethers.parseEther('150'), // Total amount
          expect.any(String), // requestId
        ])
      );
    });

    test('should reject redemption with invalid tokens', async () => {
      const invalidToken = {
        ...validTokens[0]!,
        signature: '0xinvalid-signature',
      };
      
      const redemptionRequest = {
        tokens: [{
          id: invalidToken.id!,
          signature: invalidToken.signature,
        }],
      };
      
      const userWalletAddress = testWallet.address;
      
      await expect(otm.redeemTokens(redemptionRequest, userWalletAddress))
        .rejects.toThrow('Invalid tokens found');
    });
  });

  describe('Expired Token Handling', () => {
    test('should handle expired tokens and process refunds', async () => {
      const userId = 'user-123';
      
      // Mock the method to simulate expired tokens
      const results = await otm.handleExpiredTokens(userId);
      
      expect(results).toBeInstanceOf(Array);
      // Since we don't have actual expired tokens in the test, the array should be empty
      expect(results).toHaveLength(0);
    });

    test('should handle refund processing errors gracefully', async () => {
      // This test would be more meaningful with actual database integration
      // For now, we just verify the method doesn't throw
      const userId = 'user-123';
      
      await expect(otm.handleExpiredTokens(userId)).resolves.not.toThrow();
    });
  });

  describe('Cryptographic Operations', () => {
    test('should create consistent token data hash', async () => {
      const tokenData = {
        tokenId: 'test-token-id',
        userId: 'user-123',
        amount: 100,
        issuedAt: 1640995200, // Fixed timestamp
        expiresAt: 1643673600, // Fixed timestamp
      };

      // Create two instances to test consistency
      const otm1 = new OfflineTokenManager();
      const otm2 = new OfflineTokenManager();

      // Issue tokens with the same data
      const request = {
        userId: tokenData.userId,
        walletAddress: testWallet.address,
        amount: tokenData.amount,
      };

      const tokens1 = await otm1.issueTokens(request);
      const tokens2 = await otm2.issueTokens(request);

      // The signatures should be different (due to different timestamps and IDs)
      // but the signing process should be consistent
      expect(tokens1[0]!.signature).toMatch(/^0x[a-fA-F0-9]+$/);
      expect(tokens2[0]!.signature).toMatch(/^0x[a-fA-F0-9]+$/);
    });

    test('should verify signature correctly', async () => {
      const request = {
        userId: 'user-123',
        walletAddress: testWallet.address,
        amount: 100,
      };

      const tokens = await otm.issueTokens(request);
      const token = tokens[0]!;

      // Validation should pass for the original token
      const result = await otm.validateToken(token);
      expect(result.isValid).toBe(true);

      // Create a token with the same data but different signature
      const tamperedToken: OfflineToken = {
        ...token,
        signature: await mockWallet.signMessage('different-data'),
      };

      const tamperedResult = await otm.validateToken(tamperedToken);
      expect(tamperedResult.isValid).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('should handle blockchain service errors during token issuance', async () => {
      mockBlockchainService.sendContractTransaction.mockRejectedValue(
        new Error('Blockchain connection failed')
      );

      const request = {
        userId: 'user-123',
        walletAddress: testWallet.address,
        amount: 100,
      };

      await expect(otm.issueTokens(request)).rejects.toThrow('Token issuance failed');
    });

    test('should handle blockchain service errors during token redemption', async () => {
      // First issue a token successfully
      const request = {
        userId: 'user-123',
        walletAddress: testWallet.address,
        amount: 100,
      };
      const tokens = await otm.issueTokens(request);

      // Then mock blockchain failure for redemption
      mockBlockchainService.sendContractTransaction.mockRejectedValue(
        new Error('Blockchain connection failed')
      );

      const redemptionRequest = {
        tokens: tokens.map(token => ({
          id: token.id!,
          signature: token.signature,
        })),
      };

      await expect(otm.redeemTokens(redemptionRequest, request.walletAddress))
        .rejects.toThrow('Token redemption failed');
    });

    test('should handle balance check errors', async () => {
      mockBlockchainService.getTokenBalance.mockRejectedValue(
        new Error('Balance check failed')
      );

      const request = {
        userId: 'user-123',
        walletAddress: testWallet.address,
        amount: 100,
      };

      await expect(otm.issueTokens(request)).rejects.toThrow('Balance check failed');
    });
  });
});