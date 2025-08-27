import { logger } from '../utils/logger';
import { UserDAO } from '../database/dao/UserDAO';
import { AuditLogDAO } from '../database/dao/AuditLogDAO';
import { config } from '../config/config';
import jwt from 'jsonwebtoken';
import { tokenBlacklistService } from './tokenBlacklistService';

export interface SessionInfo {
  userId: string;
  walletAddress: string;
  publicKey: string;
  issuedAt: Date;
  expiresAt: Date;
  lastActivity: Date;
  deviceInfo?: string;
  ipAddress: string;
}

export interface SessionValidationResult {
  valid: boolean;
  session?: SessionInfo;
  reason?: string;
}

export class SessionService {
  private userDAO: UserDAO;
  private auditLogDAO: AuditLogDAO;
  private activeSessions: Map<string, SessionInfo> = new Map();

  constructor() {
    this.userDAO = new UserDAO();
    this.auditLogDAO = new AuditLogDAO();
  }

  /**
   * Validate a session token and return session information
   */
  async validateSession(token: string, ipAddress?: string): Promise<SessionValidationResult> {
    try {
      // Check if token is blacklisted
      if (tokenBlacklistService.isTokenBlacklisted(token)) {
        return {
          valid: false,
          reason: 'Token has been invalidated',
        };
      }

      // Verify JWT token
      const decoded = jwt.verify(token, config.jwt.secret) as any;
      
      if (!decoded.id || !decoded.walletAddress || !decoded.publicKey) {
        return {
          valid: false,
          reason: 'Invalid token payload',
        };
      }

      // Check if user still exists and is active
      const user = await this.userDAO.findById(decoded.id);
      if (!user) {
        return {
          valid: false,
          reason: 'User not found',
        };
      }

      // Check for concurrent session limits (simplified implementation)
      const sessionKey = `${decoded.id}:${token.substring(0, 10)}`;

      const sessionInfo: SessionInfo = {
        userId: decoded.id,
        walletAddress: decoded.walletAddress,
        publicKey: decoded.publicKey,
        issuedAt: new Date(decoded.iat * 1000),
        expiresAt: new Date(decoded.exp * 1000),
        lastActivity: new Date(),
        ipAddress: ipAddress || '',
      };

      // Update session activity
      this.activeSessions.set(sessionKey, sessionInfo);

      // Update user's last activity
      await this.userDAO.updateLastActivity(decoded.id);

      logger.debug('Session validated successfully', {
        userId: decoded.id,
        walletAddress: decoded.walletAddress,
        ipAddress,
      });

      return {
        valid: true,
        session: sessionInfo,
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return {
          valid: false,
          reason: 'Token has expired',
        };
      } else if (error instanceof jwt.JsonWebTokenError) {
        return {
          valid: false,
          reason: 'Invalid token format',
        };
      } else {
        logger.error('Session validation error', {
          error: error instanceof Error ? error.message : 'Unknown error',
          ipAddress,
        });
        return {
          valid: false,
          reason: 'Session validation failed',
        };
      }
    }
  }

  /**
   * Invalidate a specific session token
   */
  async invalidateSession(
    token: string, 
    userId: string, 
    reason: string = 'User logout',
    ipAddress: string = '',
    userAgent: string = ''
  ): Promise<void> {
    try {
      // Add token to blacklist
      await tokenBlacklistService.blacklistToken(token, userId, reason, ipAddress, userAgent);

      // Remove from active sessions
      const sessionKey = `${userId}:${token.substring(0, 10)}`;
      this.activeSessions.delete(sessionKey);

      // Log the session invalidation
      await this.auditLogDAO.create({
        user_id: userId,
        action: 'session_invalidated',
        resource_type: 'session',
        request_data: { reason },
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      logger.info('Session invalidated', {
        userId,
        reason,
        tokenPrefix: token.substring(0, 10),
      });
    } catch (error) {
      logger.error('Error invalidating session', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      throw error;
    }
  }

  /**
   * Invalidate all sessions for a user
   */
  async invalidateAllUserSessions(
    userId: string, 
    reason: string = 'Logout from all devices',
    ipAddress: string = '',
    userAgent: string = ''
  ): Promise<void> {
    try {
      // Find all active sessions for the user
      const userSessions = Array.from(this.activeSessions.entries())
        .filter(([key]) => key.startsWith(`${userId}:`));

      // Invalidate each session
      for (const [sessionKey] of userSessions) {
        this.activeSessions.delete(sessionKey);
      }

      // Blacklist all user tokens
      await tokenBlacklistService.blacklistAllUserTokens(userId, reason, ipAddress, userAgent);

      // Log the mass session invalidation
      await this.auditLogDAO.create({
        user_id: userId,
        action: 'all_sessions_invalidated',
        resource_type: 'session',
        request_data: { 
          reason,
          sessionCount: userSessions.length,
        },
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      logger.info('All user sessions invalidated', {
        userId,
        reason,
        sessionCount: userSessions.length,
      });
    } catch (error) {
      logger.error('Error invalidating all user sessions', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      throw error;
    }
  }

  /**
   * Check for suspicious session activity
   */
  async checkSessionSecurity(userId: string, ipAddress: string, userAgent: string): Promise<boolean> {
    try {
      // Get user's recent sessions
      const userSessions = Array.from(this.activeSessions.values())
        .filter(session => session.userId === userId);

      // Check for multiple concurrent sessions from different IPs
      const uniqueIPs = new Set(userSessions.map(s => s.ipAddress).filter(Boolean));
      
      if (uniqueIPs.size > 3) {
        logger.warn('Suspicious session activity detected', {
          userId,
          uniqueIPCount: uniqueIPs.size,
          currentIP: ipAddress,
        });

        // Log security event
        await this.auditLogDAO.create({
          user_id: userId,
          action: 'suspicious_session_activity',
          resource_type: 'session',
          request_data: {
            uniqueIPCount: uniqueIPs.size,
            currentIP: ipAddress,
            userAgent,
          },
          ip_address: ipAddress,
          user_agent: userAgent,
        });

        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error checking session security', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        ipAddress,
      });
      return true; // Default to allowing session if check fails
    }
  }

  /**
   * Get active sessions for a user
   */
  getActiveSessions(userId: string): SessionInfo[] {
    return Array.from(this.activeSessions.values())
      .filter(session => session.userId === userId);
  }

  /**
   * Clean up expired sessions (should be called periodically)
   */
  cleanupExpiredSessions(): void {
    const now = new Date();
    const expiredSessions: string[] = [];

    for (const [key, session] of this.activeSessions.entries()) {
      if (session.expiresAt < now) {
        expiredSessions.push(key);
      }
    }

    for (const key of expiredSessions) {
      this.activeSessions.delete(key);
    }

    if (expiredSessions.length > 0) {
      logger.debug('Cleaned up expired sessions', {
        count: expiredSessions.length,
      });
    }
  }

  /**
   * Get session statistics
   */
  getSessionStats(): {
    totalActiveSessions: number;
    uniqueUsers: number;
    blacklistedTokens: number;
  } {
    const uniqueUsers = new Set(
      Array.from(this.activeSessions.values()).map(s => s.userId)
    ).size;

    const blacklistStats = tokenBlacklistService.getBlacklistStats();

    return {
      totalActiveSessions: this.activeSessions.size,
      uniqueUsers,
      blacklistedTokens: blacklistStats.totalBlacklistedTokens,
    };
  }
}

// Export singleton instance
export const sessionService = new SessionService();

// Set up periodic cleanup
setInterval(() => {
  sessionService.cleanupExpiredSessions();
}, 5 * 60 * 1000); // Clean up every 5 minutes