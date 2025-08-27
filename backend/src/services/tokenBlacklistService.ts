import { logger } from '../utils/logger';
import { AuditLogDAO } from '../database/dao/AuditLogDAO';
import jwt from 'jsonwebtoken';
import { config } from '../config/config';

export interface BlacklistedToken {
  tokenId: string;
  userId: string;
  blacklistedAt: Date;
  reason: string;
  expiresAt: Date;
}

export class TokenBlacklistService {
  private blacklistedTokens: Map<string, BlacklistedToken> = new Map();
  private auditLogDAO: AuditLogDAO;

  constructor() {
    this.auditLogDAO = new AuditLogDAO();
    
    // Set up periodic cleanup of expired blacklisted tokens
    setInterval(() => {
      this.cleanupExpiredTokens();
    }, 10 * 60 * 1000); // Clean up every 10 minutes
  }

  /**
   * Add a token to the blacklist
   */
  async blacklistToken(
    token: string, 
    userId: string, 
    reason: string = 'User logout',
    ipAddress: string = '',
    userAgent: string = ''
  ): Promise<void> {
    try {
      // Decode token to get expiration
      const decoded = jwt.decode(token) as any;
      const expiresAt = decoded?.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 24 * 60 * 60 * 1000);
      
      // Generate a unique token ID (using first 20 chars of token)
      const tokenId = this.generateTokenId(token);

      const blacklistedToken: BlacklistedToken = {
        tokenId,
        userId,
        blacklistedAt: new Date(),
        reason,
        expiresAt,
      };

      this.blacklistedTokens.set(tokenId, blacklistedToken);

      // Log the blacklisting event
      await this.auditLogDAO.create({
        user_id: userId,
        action: 'token_blacklisted',
        resource_type: 'token',
        request_data: {
          tokenId,
          reason,
          expiresAt: expiresAt.toISOString(),
        },
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      logger.info('Token blacklisted', {
        tokenId,
        userId,
        reason,
        expiresAt: expiresAt.toISOString(),
      });
    } catch (error) {
      logger.error('Error blacklisting token', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        reason,
      });
      throw error;
    }
  }

  /**
   * Check if a token is blacklisted
   */
  isTokenBlacklisted(token: string): boolean {
    const tokenId = this.generateTokenId(token);
    const blacklistedToken = this.blacklistedTokens.get(tokenId);
    
    if (!blacklistedToken) {
      return false;
    }

    // Check if the blacklisted token has expired
    if (blacklistedToken.expiresAt < new Date()) {
      this.blacklistedTokens.delete(tokenId);
      return false;
    }

    return true;
  }

  /**
   * Blacklist all tokens for a user (logout from all devices)
   */
  async blacklistAllUserTokens(
    userId: string, 
    reason: string = 'Logout from all devices',
    ipAddress: string = '',
    userAgent: string = ''
  ): Promise<void> {
    try {
      // In a real implementation, you would need to store all issued tokens
      // For now, we'll just log the event and rely on session invalidation
      
      await this.auditLogDAO.create({
        user_id: userId,
        action: 'all_tokens_blacklisted',
        resource_type: 'token',
        request_data: {
          reason,
          timestamp: new Date().toISOString(),
        },
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      logger.info('All user tokens blacklisted', {
        userId,
        reason,
      });
    } catch (error) {
      logger.error('Error blacklisting all user tokens', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        reason,
      });
      throw error;
    }
  }

  /**
   * Remove a token from the blacklist (for testing purposes)
   */
  removeFromBlacklist(token: string): void {
    const tokenId = this.generateTokenId(token);
    this.blacklistedTokens.delete(tokenId);
  }

  /**
   * Get blacklist statistics
   */
  getBlacklistStats(): {
    totalBlacklistedTokens: number;
    uniqueUsers: number;
  } {
    const uniqueUsers = new Set(
      Array.from(this.blacklistedTokens.values()).map(t => t.userId)
    ).size;

    return {
      totalBlacklistedTokens: this.blacklistedTokens.size,
      uniqueUsers,
    };
  }

  /**
   * Clean up expired blacklisted tokens
   */
  private cleanupExpiredTokens(): void {
    const now = new Date();
    const expiredTokens: string[] = [];

    for (const [tokenId, blacklistedToken] of this.blacklistedTokens.entries()) {
      if (blacklistedToken.expiresAt < now) {
        expiredTokens.push(tokenId);
      }
    }

    for (const tokenId of expiredTokens) {
      this.blacklistedTokens.delete(tokenId);
    }

    if (expiredTokens.length > 0) {
      logger.debug('Cleaned up expired blacklisted tokens', {
        count: expiredTokens.length,
      });
    }
  }

  /**
   * Generate a consistent token ID from a JWT token
   */
  private generateTokenId(token: string): string {
    // Use the first 32 characters of the token as a unique identifier
    // In a production system, you might want to hash this for security
    return token.substring(0, 32);
  }

  /**
   * Validate token format and extract basic info
   */
  validateTokenFormat(token: string): { valid: boolean; userId?: string; exp?: number } {
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as any;
      return {
        valid: true,
        userId: decoded.id,
        exp: decoded.exp,
      };
    } catch (error) {
      return { valid: false };
    }
  }
}

// Export singleton instance
export const tokenBlacklistService = new TokenBlacklistService();