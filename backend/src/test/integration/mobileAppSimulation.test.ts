import crypto from 'crypto';

// Mock mobile app components
class MockMobileWallet {
  private privateKey: string;
  private walletAddress: string;
  private offlineTokens: any[] = [];
  private transactions: any[] = [];
  private isOnline: boolean = true;

  constructor(walletAddress: string) {
    this.walletAddress = walletAddress;
    this.privateKey = crypto.randomBytes(32).toString('hex');
  }

  // Simulate mobile app going offline/online
  setOnlineStatus(online: boolean) {
    this.isOnline = online;
  }

  // Simulate token purchase from mobile app
  async purchaseTokens(amount: number): Promise<any[]> {
    if (!this.isOnline) {
      throw new Error('Cannot purchase tokens while offline');
    }

    // Simulate API call to backend
    const tokens = [
      {
        id: `token-${Date.now()}`,
        amount: amount,
        signature: this.generateMockSignature(`token-${Date.now()}-${amount}`),
        expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isSpent: false
      }
    ];

    this.offlineTokens.push(...tokens);
    return tokens;
  }

  // Simulate offline token validation
  validateToken(token: any): boolean {
    // Check if token is expired
    if (new Date() > new Date(token.expirationDate)) {
      return false;
    }

    // Check if token is already spent
    if (token.isSpent) {
      return false;
    }

    // Simulate signature validation - reject 'corrupted' signatures
    return token.signature && 
           token.signature.length > 0 && 
           token.signature !== 'corrupted';
  }

  // Simulate token division for exact payments
  divideToken(token: any, amount: number): { payment: any, change: any } {
    if (token.amount < amount) {
      throw new Error('Insufficient token amount');
    }

    const payment = {
      id: `${token.id}-payment`,
      amount: amount,
      signature: this.generateMockSignature(`${token.id}-payment-${amount}`),
      expirationDate: token.expirationDate,
      isSpent: false,
      parentTokenId: token.id
    };

    const change = token.amount > amount ? {
      id: `${token.id}-change`,
      amount: token.amount - amount,
      signature: this.generateMockSignature(`${token.id}-change-${token.amount - amount}`),
      expirationDate: token.expirationDate,
      isSpent: false,
      parentTokenId: token.id
    } : null;

    // Mark original token as spent
    token.isSpent = true;

    // Add new tokens to wallet (only change, payment is used immediately)
    if (change) {
      this.offlineTokens.push(change);
    }

    return { payment, change };
  }

  // Simulate offline transaction creation
  createOfflineTransaction(receiverWalletAddress: string, amount: number): any {
    const availableTokens = this.offlineTokens.filter(t => !t.isSpent && this.validateToken(t));
    let totalAvailable = availableTokens.reduce((sum, token) => sum + token.amount, 0);

    if (totalAvailable < amount) {
      throw new Error('Insufficient offline token balance');
    }

    // Select tokens for payment
    let remainingAmount = amount;
    const tokensToUse = [];
    
    for (const token of availableTokens) {
      if (remainingAmount <= 0) break;
      
      if (token.amount <= remainingAmount) {
        tokensToUse.push(token);
        remainingAmount -= token.amount;
        token.isSpent = true;
      } else {
        // Need to divide token
        const { payment } = this.divideToken(token, remainingAmount);
        tokensToUse.push(payment);
        // Change is already added to wallet in divideToken method
        remainingAmount = 0;
      }
    }

    const transaction = {
      id: `tx-${Date.now()}`,
      senderId: this.walletAddress,
      receiverId: receiverWalletAddress,
      amount: amount,
      tokenIds: tokensToUse.map(t => t.id),
      timestamp: new Date().toISOString(),
      status: 'pending_sync',
      senderSignature: this.signTransaction({
        senderId: this.walletAddress,
        receiverId: receiverWalletAddress,
        amount: amount,
        timestamp: new Date().toISOString()
      })
    };

    this.transactions.push(transaction);
    return transaction;
  }

  // Simulate receiving offline transaction
  receiveOfflineTransaction(transaction: any): boolean {
    // Validate transaction signature
    if (!this.validateTransactionSignature(transaction)) {
      return false;
    }

    // Add tokens to wallet
    const receivedTokens = transaction.tokenIds.map((tokenId: string) => ({
      id: tokenId,
      amount: transaction.amount / transaction.tokenIds.length,
      signature: this.generateMockSignature(tokenId),
      expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      isSpent: false,
      receivedFrom: transaction.senderId
    }));

    this.offlineTokens.push(...receivedTokens);
    this.transactions.push({
      ...transaction,
      status: 'completed'
    });

    return true;
  }

  // Simulate syncing with backend when back online
  async syncWithBackend(): Promise<{ synced: number, failed: number }> {
    if (!this.isOnline) {
      throw new Error('Cannot sync while offline');
    }

    const pendingTransactions = this.transactions.filter(t => t.status === 'pending_sync');
    let synced = 0;
    let failed = 0;

    for (const transaction of pendingTransactions) {
      try {
        // Simulate API call to sync transaction
        await this.simulateApiCall('/api/transactions/sync-offline', {
          transaction: transaction,
          walletAddress: this.walletAddress
        });
        
        transaction.status = 'synced';
        synced++;
      } catch (error) {
        transaction.status = 'sync_failed';
        failed++;
      }
    }

    return { synced, failed };
  }

  // Simulate token redemption
  async redeemTokens(): Promise<string> {
    if (!this.isOnline) {
      throw new Error('Cannot redeem tokens while offline');
    }

    const redeemableTokens = this.offlineTokens.filter(t => !t.isSpent && this.validateToken(t));
    
    if (redeemableTokens.length === 0) {
      throw new Error('No tokens available for redemption');
    }

    // Simulate API call to redeem tokens
    const transactionHash = await this.simulateApiCall('/api/tokens/redeem', {
      tokens: redeemableTokens,
      walletAddress: this.walletAddress
    });

    // Mark tokens as redeemed
    redeemableTokens.forEach(token => {
      token.isSpent = true;
      token.redeemedAt = new Date().toISOString();
    });

    return transactionHash;
  }

  // Helper methods
  private generateMockSignature(data: string): string {
    return crypto.createHash('sha256').update(data + this.privateKey).digest('hex');
  }

  private signTransaction(transaction: any): string {
    const transactionString = JSON.stringify(transaction);
    return this.generateMockSignature(transactionString);
  }

  private validateTransactionSignature(transaction: any): boolean {
    // Simplified signature validation - reject 'invalid' signatures
    return transaction.senderSignature && 
           transaction.senderSignature.length > 0 && 
           transaction.senderSignature !== 'invalid';
  }

  private async simulateApiCall(endpoint: string, data: any): Promise<any> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
    
    // Simulate occasional network failures
    if (Math.random() < 0.1) {
      throw new Error('Network error');
    }

    // Return mock response based on endpoint
    switch (endpoint) {
      case '/api/transactions/sync-offline':
        return { success: true, transactionId: data.transaction.id };
      case '/api/tokens/redeem':
        return `0x${crypto.randomBytes(32).toString('hex')}`;
      default:
        return { success: true };
    }
  }

  // Getters for testing
  getOfflineBalance(): number {
    return this.offlineTokens
      .filter(t => !t.isSpent && this.validateToken(t))
      .reduce((sum, token) => sum + token.amount, 0);
  }

  getPendingTransactions(): any[] {
    return this.transactions.filter(t => t.status === 'pending_sync');
  }

  getAllTransactions(): any[] {
    return this.transactions;
  }

  getOfflineTokens(): any[] {
    return this.offlineTokens;
  }
}

describe('Mobile App Integration Simulation', () => {
  let wallet1: MockMobileWallet;
  let wallet2: MockMobileWallet;
  let wallet3: MockMobileWallet;

  beforeEach(() => {
    wallet1 = new MockMobileWallet('0x1111111111111111111111111111111111111111');
    wallet2 = new MockMobileWallet('0x2222222222222222222222222222222222222222');
    wallet3 = new MockMobileWallet('0x3333333333333333333333333333333333333333');
  });

  describe('Token Purchase and Management', () => {
    it('should purchase tokens when online', async () => {
      const tokens = await wallet1.purchaseTokens(100);
      
      expect(tokens).toHaveLength(1);
      expect(tokens[0].amount).toBe(100);
      expect(tokens[0].signature).toBeDefined();
      expect(wallet1.getOfflineBalance()).toBe(100);
    });

    it('should fail to purchase tokens when offline', async () => {
      wallet1.setOnlineStatus(false);
      
      await expect(wallet1.purchaseTokens(100)).rejects.toThrow('Cannot purchase tokens while offline');
    });

    it('should validate tokens correctly', async () => {
      const tokens = await wallet1.purchaseTokens(50);
      const token = tokens[0];
      
      expect(wallet1.validateToken(token)).toBe(true);
      
      // Mark token as spent
      token.isSpent = true;
      expect(wallet1.validateToken(token)).toBe(false);
      
      // Test expired token
      token.isSpent = false;
      token.expirationDate = new Date(Date.now() - 1000); // Expired
      expect(wallet1.validateToken(token)).toBe(false);
    });

    it('should divide tokens for exact payments', async () => {
      const tokens = await wallet1.purchaseTokens(100);
      const token = tokens[0];
      
      const { payment, change } = wallet1.divideToken(token, 30);
      
      expect(payment.amount).toBe(30);
      expect(change?.amount).toBe(70);
      expect(token.isSpent).toBe(true);
      expect(wallet1.getOfflineBalance()).toBe(70); // Only change remains
    });
  });

  describe('Offline Transaction Processing', () => {
    it('should create offline transactions between wallets', async () => {
      // Wallet1 purchases tokens
      await wallet1.purchaseTokens(100);
      
      // Create offline transaction to wallet2
      const transaction = wallet1.createOfflineTransaction(
        '0x2222222222222222222222222222222222222222',
        25
      );
      
      expect(transaction.amount).toBe(25);
      expect(transaction.senderId).toBe('0x1111111111111111111111111111111111111111');
      expect(transaction.receiverId).toBe('0x2222222222222222222222222222222222222222');
      expect(transaction.status).toBe('pending_sync');
      expect(wallet1.getOfflineBalance()).toBe(75); // 100 - 25
    });

    it('should receive and validate offline transactions', async () => {
      // Wallet1 purchases tokens and creates transaction
      await wallet1.purchaseTokens(100);
      const transaction = wallet1.createOfflineTransaction(
        '0x2222222222222222222222222222222222222222',
        40
      );
      
      // Wallet2 receives the transaction
      const received = wallet2.receiveOfflineTransaction(transaction);
      
      expect(received).toBe(true);
      expect(wallet2.getOfflineBalance()).toBe(40);
      expect(wallet2.getAllTransactions()).toHaveLength(1);
    });

    it('should handle insufficient balance scenarios', async () => {
      await wallet1.purchaseTokens(50);
      
      expect(() => {
        wallet1.createOfflineTransaction(
          '0x2222222222222222222222222222222222222222',
          75
        );
      }).toThrow('Insufficient offline token balance');
    });

    it('should handle complex multi-token transactions', async () => {
      // Purchase multiple smaller tokens
      await wallet1.purchaseTokens(30);
      await wallet1.purchaseTokens(25);
      await wallet1.purchaseTokens(20);
      
      expect(wallet1.getOfflineBalance()).toBe(75);
      
      // Create transaction that requires multiple tokens
      const transaction = wallet1.createOfflineTransaction(
        '0x2222222222222222222222222222222222222222',
        60
      );
      
      expect(transaction.amount).toBe(60);
      expect(wallet1.getOfflineBalance()).toBe(15); // 75 - 60
    });
  });

  describe('Online Synchronization', () => {
    it('should sync pending transactions when back online', async () => {
      // Create offline transactions
      await wallet1.purchaseTokens(100);
      wallet1.createOfflineTransaction('0x2222222222222222222222222222222222222222', 25);
      wallet1.createOfflineTransaction('0x3333333333333333333333333333333333333333', 30);
      
      expect(wallet1.getPendingTransactions()).toHaveLength(2);
      
      // Sync with backend
      const result = await wallet1.syncWithBackend();
      
      expect(result.synced).toBeGreaterThan(0);
      expect(result.synced + result.failed).toBe(2);
    });

    it('should handle sync failures gracefully', async () => {
      await wallet1.purchaseTokens(50);
      wallet1.createOfflineTransaction('0x2222222222222222222222222222222222222222', 20);
      
      // Simulate multiple sync attempts (some may fail due to random network errors)
      let totalSynced = 0;
      let attempts = 0;
      
      while (totalSynced === 0 && attempts < 5) {
        const result = await wallet1.syncWithBackend();
        totalSynced += result.synced;
        attempts++;
      }
      
      expect(attempts).toBeGreaterThan(0);
    });

    it('should redeem tokens when online', async () => {
      await wallet1.purchaseTokens(100);
      
      const transactionHash = await wallet1.redeemTokens();
      
      expect(transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
      expect(wallet1.getOfflineBalance()).toBe(0); // All tokens redeemed
    });

    it('should fail to redeem when offline', async () => {
      await wallet1.purchaseTokens(50);
      wallet1.setOnlineStatus(false);
      
      await expect(wallet1.redeemTokens()).rejects.toThrow('Cannot redeem tokens while offline');
    });
  });

  describe('End-to-End Scenarios', () => {
    it('should handle complete offline transaction chain', async () => {
      // Setup: All wallets purchase tokens
      await wallet1.purchaseTokens(100);
      await wallet2.purchaseTokens(80);
      await wallet3.purchaseTokens(60);
      
      // Go offline
      wallet1.setOnlineStatus(false);
      wallet2.setOnlineStatus(false);
      wallet3.setOnlineStatus(false);
      
      // Chain of offline transactions
      const tx1 = wallet1.createOfflineTransaction('0x2222222222222222222222222222222222222222', 30);
      wallet2.receiveOfflineTransaction(tx1);
      
      const tx2 = wallet2.createOfflineTransaction('0x3333333333333333333333333333333333333333', 25);
      wallet3.receiveOfflineTransaction(tx2);
      
      const tx3 = wallet3.createOfflineTransaction('0x1111111111111111111111111111111111111111', 15);
      wallet1.receiveOfflineTransaction(tx3);
      
      // Verify balances
      expect(wallet1.getOfflineBalance()).toBe(85); // 100 - 30 + 15
      expect(wallet2.getOfflineBalance()).toBe(85); // 80 + 30 - 25
      expect(wallet3.getOfflineBalance()).toBe(70); // 60 + 25 - 15
      
      // Come back online and sync
      wallet1.setOnlineStatus(true);
      wallet2.setOnlineStatus(true);
      wallet3.setOnlineStatus(true);
      
      const sync1 = await wallet1.syncWithBackend();
      const sync2 = await wallet2.syncWithBackend();
      const sync3 = await wallet3.syncWithBackend();
      
      expect(sync1.synced + sync1.failed).toBeGreaterThan(0);
      expect(sync2.synced + sync2.failed).toBeGreaterThan(0);
      expect(sync3.synced + sync3.failed).toBeGreaterThan(0);
    });

    it('should handle automatic token management scenario', async () => {
      // Initial purchase
      await wallet1.purchaseTokens(100);
      
      // Simulate spending tokens until balance is low
      wallet1.createOfflineTransaction('0x2222222222222222222222222222222222222222', 40);
      wallet1.createOfflineTransaction('0x3333333333333333333333333333333333333333', 35);
      
      expect(wallet1.getOfflineBalance()).toBe(25);
      
      // Simulate auto-purchase trigger (balance below threshold of 30)
      if (wallet1.getOfflineBalance() < 30) {
        await wallet1.purchaseTokens(100); // Auto-purchase
      }
      
      expect(wallet1.getOfflineBalance()).toBe(125);
    });

    it('should handle token expiration and cleanup', async () => {
      // Purchase tokens
      await wallet1.purchaseTokens(50);
      const tokens = wallet1.getOfflineTokens();
      
      // Simulate token expiration
      tokens.forEach(token => {
        if (!token.isSpent) {
          token.expirationDate = new Date(Date.now() - 1000); // Expired
        }
      });
      
      // Check that expired tokens are not counted in balance
      expect(wallet1.getOfflineBalance()).toBe(0);
      
      // Simulate cleanup of expired tokens
      const expiredTokens = wallet1.getOfflineTokens().filter(t => 
        new Date() > new Date(t.expirationDate) && !t.isSpent
      );
      
      expect(expiredTokens.length).toBeGreaterThan(0);
    });

    it('should handle network interruption during sync', async () => {
      await wallet1.purchaseTokens(100);
      
      // Create multiple transactions
      for (let i = 0; i < 5; i++) {
        wallet1.createOfflineTransaction('0x2222222222222222222222222222222222222222', 10);
      }
      
      expect(wallet1.getPendingTransactions()).toHaveLength(5);
      
      // Attempt sync multiple times (simulating network interruptions)
      let totalSynced = 0;
      let attempts = 0;
      
      while (totalSynced < 5 && attempts < 10) {
        try {
          const result = await wallet1.syncWithBackend();
          totalSynced += result.synced;
        } catch (error) {
          // Network error, will retry
        }
        attempts++;
      }
      
      expect(attempts).toBeGreaterThanOrEqual(1); // Should require at least one attempt
    });
  });

  describe('Security and Error Handling', () => {
    it('should prevent double spending', async () => {
      await wallet1.purchaseTokens(50);
      const tokens = wallet1.getOfflineTokens();
      const token = tokens[0];
      
      // First transaction uses the entire token
      wallet1.createOfflineTransaction('0x2222222222222222222222222222222222222222', 50);
      
      // Token should be marked as spent
      expect(token.isSpent).toBe(true);
      
      // Attempt to create another transaction should fail (no tokens left)
      expect(() => {
        wallet1.createOfflineTransaction('0x3333333333333333333333333333333333333333', 20);
      }).toThrow('Insufficient offline token balance');
    });

    it('should validate transaction signatures', async () => {
      await wallet1.purchaseTokens(50);
      const transaction = wallet1.createOfflineTransaction('0x2222222222222222222222222222222222222222', 25);
      
      // Valid transaction should be accepted
      expect(wallet2.receiveOfflineTransaction(transaction)).toBe(true);
      
      // Invalid signature should be rejected
      const invalidTransaction = { ...transaction, senderSignature: 'invalid' };
      expect(wallet3.receiveOfflineTransaction(invalidTransaction)).toBe(false);
    });

    it('should handle corrupted token data', async () => {
      await wallet1.purchaseTokens(50);
      const tokens = wallet1.getOfflineTokens();
      const token = tokens[0];
      
      // Corrupt token signature
      token.signature = 'corrupted';
      
      expect(wallet1.validateToken(token)).toBe(false);
      expect(() => {
        wallet1.createOfflineTransaction('0x2222222222222222222222222222222222222222', 25);
      }).toThrow('Insufficient offline token balance');
    });
  });
});