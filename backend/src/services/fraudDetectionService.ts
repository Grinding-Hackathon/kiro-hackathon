import { logger } from '@/utils/logger';
import { AuditLogDAO } from '@/database/dao/AuditLogDAO';
import { TransactionDAO } from '@/database/dao/TransactionDAO';
import { OfflineTokenDAO } from '@/database/dao/OfflineTokenDAO';

export interface FraudAlert {
  id: string;
  type: 'SUSPICIOUS_TRANSACTION' | 'RAPID_REQUESTS' | 'UNUSUAL_PATTERN' | 'TOKEN_ABUSE';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  userId?: string;
  ip?: string | undefined;
  description: string;
  metadata: any;
  timestamp: Date;
}

export interface TransactionPattern {
  userId: string;
  transactionCount: number;
  totalAmount: number;
  averageAmount: number;
  timeWindow: number; // in minutes
  distinctRecipients: number;
}

export class FraudDetectionService {
  private auditLogDAO: AuditLogDAO;
  private transactionDAO: TransactionDAO;
  private offlineTokenDAO: OfflineTokenDAO;
  private alerts: FraudAlert[] = [];
  // private userPatterns: Map<string, TransactionPattern[]> = new Map();

  constructor() {
    this.auditLogDAO = new AuditLogDAO();
    this.transactionDAO = new TransactionDAO();
    this.offlineTokenDAO = new OfflineTokenDAO();
  }

  /**
   * Analyze transaction for suspicious patterns
   */
  async analyzeTransaction(transaction: {
    userId: string;
    amount: number;
    recipientId?: string;
    type: string;
    ip?: string | undefined;
  }): Promise<FraudAlert[]> {
    const alerts: FraudAlert[] = [];
    const { userId, amount, recipientId, type, ip } = transaction;

    try {
      // Check for unusually large amounts
      const largeAmountAlert = await this.checkLargeAmount(userId, amount);
      if (largeAmountAlert) alerts.push(largeAmountAlert);

      // Check for rapid successive transactions
      const rapidTransactionAlert = await this.checkRapidTransactions(userId, ip);
      if (rapidTransactionAlert) alerts.push(rapidTransactionAlert);

      // Check for unusual transaction patterns
      const patternAlert = await this.checkUnusualPatterns(userId, amount, recipientId);
      if (patternAlert) alerts.push(patternAlert);

      // Check for token abuse patterns
      if (type === 'token_purchase' || type === 'token_redemption') {
        const tokenAbuseAlert = await this.checkTokenAbuse(userId, amount, type);
        if (tokenAbuseAlert) alerts.push(tokenAbuseAlert);
      }

      // Store alerts
      for (const alert of alerts) {
        await this.storeAlert(alert);
      }

      return alerts;
    } catch (error) {
      logger.error('Error in fraud detection analysis', { error, transaction });
      return [];
    }
  }

  /**
   * Check for unusually large transaction amounts
   */
  private async checkLargeAmount(userId: string, amount: number): Promise<FraudAlert | null> {
    try {
      // Get user's transaction history for the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const recentTransactions = await this.transactionDAO.findByUserId(userId);
      const recentAmounts = recentTransactions
        .filter(tx => new Date(tx.created_at) > thirtyDaysAgo)
        .map(tx => parseFloat(tx.amount.toString()));

      if (recentAmounts.length === 0) return null;

      const averageAmount = recentAmounts.reduce((sum, amt) => sum + amt, 0) / recentAmounts.length;
      const maxAmount = Math.max(...recentAmounts);

      // Alert if current transaction is 5x the average or 2x the previous maximum
      if (amount > averageAmount * 5 || amount > maxAmount * 2) {
        return {
          id: `large_amount_${Date.now()}`,
          type: 'SUSPICIOUS_TRANSACTION',
          severity: amount > averageAmount * 10 ? 'HIGH' : 'MEDIUM',
          userId,
          description: `Unusually large transaction amount: ${amount} (avg: ${averageAmount.toFixed(2)}, max: ${maxAmount})`,
          metadata: { amount, averageAmount, maxAmount, transactionCount: recentAmounts.length },
          timestamp: new Date(),
        };
      }

      return null;
    } catch (error) {
      logger.error('Error checking large amount', { error, userId, amount });
      return null;
    }
  }

  /**
   * Check for rapid successive transactions
   */
  private async checkRapidTransactions(userId: string, ip?: string): Promise<FraudAlert | null> {
    try {
      const fiveMinutesAgo = new Date();
      fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);

      // Check transactions in the last 5 minutes
      const recentTransactions = await this.transactionDAO.findByUserId(userId);
      const rapidTransactions = recentTransactions.filter(
        tx => new Date(tx.created_at) > fiveMinutesAgo
      );

      // Alert if more than 10 transactions in 5 minutes
      if (rapidTransactions.length > 10) {
        return {
          id: `rapid_transactions_${Date.now()}`,
          type: 'RAPID_REQUESTS',
          severity: rapidTransactions.length > 20 ? 'HIGH' : 'MEDIUM',
          userId,
          ip,
          description: `Rapid transaction pattern detected: ${rapidTransactions.length} transactions in 5 minutes`,
          metadata: { transactionCount: rapidTransactions.length, timeWindow: 5 },
          timestamp: new Date(),
        };
      }

      return null;
    } catch (error) {
      logger.error('Error checking rapid transactions', { error, userId });
      return null;
    }
  }

  /**
   * Check for unusual transaction patterns
   */
  private async checkUnusualPatterns(userId: string, _amount: number, recipientId?: string): Promise<FraudAlert | null> {
    try {
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      const recentTransactions = await this.transactionDAO.findByUserId(userId);
      const dayTransactions = recentTransactions.filter(
        tx => new Date(tx.created_at) > oneDayAgo
      );

      // Check for round number abuse (many transactions with round amounts)
      const roundAmounts = dayTransactions.filter(tx => {
        const amt = parseFloat(tx.amount.toString());
        return amt % 1 === 0 && amt >= 100; // Round numbers >= 100
      });

      if (roundAmounts.length > 5) {
        return {
          id: `unusual_pattern_${Date.now()}`,
          type: 'UNUSUAL_PATTERN',
          severity: 'MEDIUM',
          userId,
          description: `Unusual pattern: ${roundAmounts.length} round-number transactions in 24 hours`,
          metadata: { roundAmountCount: roundAmounts.length, totalTransactions: dayTransactions.length },
          timestamp: new Date(),
        };
      }

      // Check for same recipient abuse
      if (recipientId) {
        const sameRecipientTxs = dayTransactions.filter(tx => tx.receiver_id === recipientId);
        if (sameRecipientTxs.length > 20) {
          return {
            id: `same_recipient_${Date.now()}`,
            type: 'UNUSUAL_PATTERN',
            severity: 'HIGH',
            userId,
            description: `Excessive transactions to same recipient: ${sameRecipientTxs.length} transactions in 24 hours`,
            metadata: { recipientId, transactionCount: sameRecipientTxs.length },
            timestamp: new Date(),
          };
        }
      }

      return null;
    } catch (error) {
      logger.error('Error checking unusual patterns', { error, userId });
      return null;
    }
  }

  /**
   * Check for token abuse patterns
   */
  private async checkTokenAbuse(userId: string, _amount: number, type: string): Promise<FraudAlert | null> {
    try {
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);

      // Get recent token operations
      const recentTokens = await this.offlineTokenDAO.findByUserId(userId);
      const recentTokenOps = recentTokens.filter(
        token => new Date(token.issued_at) > oneHourAgo
      );

      // Check for excessive token purchases
      if (type === 'token_purchase') {
        const purchases = recentTokenOps.filter(token => !token.redeemed_at);
        const totalPurchased = purchases.reduce((sum, token) => sum + parseFloat(token.amount.toString()), 0);

        if (purchases.length > 50 || totalPurchased > 10000) {
          return {
            id: `token_abuse_${Date.now()}`,
            type: 'TOKEN_ABUSE',
            severity: totalPurchased > 50000 ? 'CRITICAL' : 'HIGH',
            userId,
            description: `Excessive token purchases: ${purchases.length} purchases, total: ${totalPurchased}`,
            metadata: { purchaseCount: purchases.length, totalAmount: totalPurchased, timeWindow: 1 },
            timestamp: new Date(),
          };
        }
      }

      // Check for rapid redemption patterns
      if (type === 'token_redemption') {
        const redemptions = recentTokenOps.filter(token => token.redeemed_at);
        if (redemptions.length > 100) {
          return {
            id: `rapid_redemption_${Date.now()}`,
            type: 'TOKEN_ABUSE',
            severity: 'HIGH',
            userId,
            description: `Rapid token redemptions: ${redemptions.length} redemptions in 1 hour`,
            metadata: { redemptionCount: redemptions.length, timeWindow: 1 },
            timestamp: new Date(),
          };
        }
      }

      return null;
    } catch (error) {
      logger.error('Error checking token abuse', { error, userId, type });
      return null;
    }
  }

  /**
   * Analyze user behavior patterns for anomalies
   */
  async analyzeUserBehavior(userId: string): Promise<FraudAlert[]> {
    const alerts: FraudAlert[] = [];
    
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const recentTransactions = await this.transactionDAO.findByUserId(userId);
      const weekTransactions = recentTransactions.filter(
        tx => new Date(tx.created_at) > sevenDaysAgo
      );
      
      // Check for unusual time patterns
      const hourCounts = new Array(24).fill(0);
      weekTransactions.forEach(tx => {
        const hour = new Date(tx.created_at).getHours();
        hourCounts[hour]++;
      });
      
      // Alert if more than 80% of transactions happen in unusual hours (2-6 AM)
      const unusualHourTxs = hourCounts.slice(2, 6).reduce((sum, count) => sum + count, 0);
      const totalTxs = weekTransactions.length;
      
      if (totalTxs > 10 && (unusualHourTxs / totalTxs) > 0.8) {
        alerts.push({
          id: `unusual_hours_${Date.now()}`,
          type: 'UNUSUAL_PATTERN',
          severity: 'MEDIUM',
          userId,
          description: `Unusual transaction timing: ${((unusualHourTxs / totalTxs) * 100).toFixed(1)}% of transactions during 2-6 AM`,
          metadata: { unusualHourPercentage: (unusualHourTxs / totalTxs) * 100, totalTransactions: totalTxs },
          timestamp: new Date(),
        });
      }
      
      // Check for velocity changes
      const firstHalf = weekTransactions.slice(0, Math.floor(weekTransactions.length / 2));
      const secondHalf = weekTransactions.slice(Math.floor(weekTransactions.length / 2));
      
      if (firstHalf.length > 0 && secondHalf.length > 0) {
        const firstHalfAvg = firstHalf.reduce((sum, tx) => sum + parseFloat(tx.amount.toString()), 0) / firstHalf.length;
        const secondHalfAvg = secondHalf.reduce((sum, tx) => sum + parseFloat(tx.amount.toString()), 0) / secondHalf.length;
        
        // Alert if transaction amounts increased by more than 500%
        if (secondHalfAvg > firstHalfAvg * 5) {
          alerts.push({
            id: `velocity_increase_${Date.now()}`,
            type: 'UNUSUAL_PATTERN',
            severity: 'HIGH',
            userId,
            description: `Dramatic increase in transaction amounts: ${firstHalfAvg.toFixed(2)} -> ${secondHalfAvg.toFixed(2)}`,
            metadata: { 
              firstHalfAverage: firstHalfAvg, 
              secondHalfAverage: secondHalfAvg,
              increaseMultiplier: secondHalfAvg / firstHalfAvg
            },
            timestamp: new Date(),
          });
        }
      }
      
      return alerts;
    } catch (error) {
      logger.error('Error analyzing user behavior', { error, userId });
      return [];
    }
  }

  /**
   * Check for coordinated attack patterns across multiple users
   */
  async detectCoordinatedAttacks(): Promise<FraudAlert[]> {
    const alerts: FraudAlert[] = [];
    
    try {
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);
      
      // Get all recent transactions
      const recentTransactions = await this.transactionDAO.findAll();
      const hourlyTransactions = recentTransactions.filter(
        tx => new Date(tx.created_at) > oneHourAgo
      );
      
      // Group by similar amounts (potential coordinated attack)
      const amountGroups = new Map<string, any[]>();
      hourlyTransactions.forEach(tx => {
        const roundedAmount = Math.round(parseFloat(tx.amount.toString()));
        const key = roundedAmount.toString();
        if (!amountGroups.has(key)) {
          amountGroups.set(key, []);
        }
        amountGroups.get(key)!.push(tx);
      });
      
      // Check for suspicious patterns
      for (const [amount, transactions] of amountGroups.entries()) {
        if (transactions.length > 20) { // More than 20 transactions of same amount
          const uniqueUsers = new Set(transactions.map(tx => tx.sender_id)).size;
          
          if (uniqueUsers > 10) { // From more than 10 different users
            alerts.push({
              id: `coordinated_attack_${Date.now()}`,
              type: 'UNUSUAL_PATTERN',
              severity: 'CRITICAL',
              description: `Potential coordinated attack: ${transactions.length} transactions of ${amount} from ${uniqueUsers} users in 1 hour`,
              metadata: {
                amount: parseFloat(amount),
                transactionCount: transactions.length,
                uniqueUsers,
                timeWindow: 1,
              },
              timestamp: new Date(),
            });
          }
        }
      }
      
      return alerts;
    } catch (error) {
      logger.error('Error detecting coordinated attacks', { error });
      return [];
    }
  }

  /**
   * Store fraud alert in audit log
   */
  private async storeAlert(alert: FraudAlert): Promise<void> {
    try {
      await this.auditLogDAO.create({
        user_id: alert.userId,
        action: `FRAUD_ALERT_${alert.type}`,
        resource_type: 'fraud_detection',
        resource_id: alert.id,
        ip_address: alert.ip,
        user_agent: undefined,
        request_data: alert.metadata,
        response_data: { severity: alert.severity, description: alert.description },
        status_code: undefined,
        created_at: alert.timestamp,
      });

      this.alerts.push(alert);
      
      // Log critical alerts immediately
      if (alert.severity === 'CRITICAL' || alert.severity === 'HIGH') {
        logger.error(`FRAUD ALERT [${alert.severity}]: ${alert.description}`, {
          alertId: alert.id,
          type: alert.type,
          userId: alert.userId,
          ip: alert.ip,
          metadata: alert.metadata,
        });
      } else {
        logger.warn(`FRAUD ALERT [${alert.severity}]: ${alert.description}`, {
          alertId: alert.id,
          type: alert.type,
          userId: alert.userId,
          metadata: alert.metadata,
        });
      }
    } catch (error) {
      logger.error('Error storing fraud alert', { error, alert });
    }
  }

  /**
   * Get recent fraud alerts
   */
  getRecentAlerts(limit: number = 100): FraudAlert[] {
    return this.alerts
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get alerts by severity
   */
  getAlertsBySeverity(severity: FraudAlert['severity']): FraudAlert[] {
    return this.alerts.filter(alert => alert.severity === severity);
  }

  /**
   * Clear old alerts (older than 7 days)
   */
  clearOldAlerts(): void {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    this.alerts = this.alerts.filter(alert => alert.timestamp > sevenDaysAgo);
  }

  /**
   * Run comprehensive fraud detection scan
   */
  async runComprehensiveScan(): Promise<FraudAlert[]> {
    const allAlerts: FraudAlert[] = [];
    
    try {
      logger.info('Starting comprehensive fraud detection scan');
      
      // Check for coordinated attacks
      const coordinatedAttacks = await this.detectCoordinatedAttacks();
      allAlerts.push(...coordinatedAttacks);
      
      // Analyze behavior for active users (users with transactions in last 24 hours)
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      
      const recentTransactions = await this.transactionDAO.findAll();
      const activeUsers = new Set(
        recentTransactions
          .filter(tx => new Date(tx.created_at) > oneDayAgo)
          .map(tx => tx.sender_id)
      );
      
      // Analyze each active user's behavior
      for (const userId of activeUsers) {
        if (userId) {
          const userAlerts = await this.analyzeUserBehavior(userId);
          allAlerts.push(...userAlerts);
        }
      }
      
      // Store all new alerts
      for (const alert of allAlerts) {
        await this.storeAlert(alert);
      }
      
      logger.info(`Comprehensive fraud scan completed: ${allAlerts.length} alerts generated`);
      return allAlerts;
    } catch (error) {
      logger.error('Error during comprehensive fraud scan', { error });
      return [];
    }
  }

  /**
   * Start periodic fraud detection scans
   */
  startPeriodicScans(): void {
    // Run comprehensive scan every 30 minutes
    setInterval(async () => {
      try {
        await this.runComprehensiveScan();
      } catch (error) {
        logger.error('Error in periodic fraud scan', { error });
      }
    }, 30 * 60 * 1000); // 30 minutes
    
    // Clean old alerts every 6 hours
    setInterval(() => {
      this.clearOldAlerts();
    }, 6 * 60 * 60 * 1000); // 6 hours
    
    logger.info('Periodic fraud detection scans started');
  }
}

// Export singleton instance
export const fraudDetectionService = new FraudDetectionService();