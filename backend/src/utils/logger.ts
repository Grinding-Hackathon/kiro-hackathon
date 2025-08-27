import winston from 'winston';
import { config } from '@/config/config';
import { AuditLogDAO } from '@/database/dao/AuditLogDAO';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Tell winston that you want to link the colors
winston.addColors(colors);

// Define format for logs
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info['timestamp']} ${info.level}: ${info.message}`,
  ),
);

// Define which transports the logger must use
const transports = [
  // Console transport
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple(),
    ),
  }),
  
  // File transport for errors
  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json(),
    ),
  }),
  
  // File transport for all logs
  new winston.transports.File({
    filename: config.logging.file,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json(),
    ),
  }),
];

// Create the logger
export const logger = winston.createLogger({
  level: config.logging.level,
  levels,
  format,
  transports,
});

// Create a stream object for Morgan HTTP logging
export const morganStream = {
  write: (message: string): void => {
    logger.http(message.substring(0, message.lastIndexOf('\n')));
  },
};

// Enhanced audit logger for security events
export class AuditLogger {
  private auditLogDAO: AuditLogDAO;

  constructor() {
    this.auditLogDAO = new AuditLogDAO();
  }

  /**
   * Log authentication events
   */
  async logAuth(event: {
    userId?: string;
    action: 'LOGIN_SUCCESS' | 'LOGIN_FAILED' | 'LOGOUT' | 'TOKEN_REFRESH' | 'PASSWORD_CHANGE';
    ip: string;
    userAgent: string;
    details?: any;
  }): Promise<void> {
    try {
      await this.auditLogDAO.create({
        user_id: event.userId,
        action: event.action,
        resource_type: 'authentication',
        resource_id: event.userId,
        ip_address: event.ip,
        user_agent: event.userAgent,
        request_data: event.details,
        response_data: undefined,
        status_code: event.action.includes('FAILED') ? 401 : 200,
        created_at: new Date(),
      });

      logger.info(`AUTH: ${event.action}`, {
        userId: event.userId,
        ip: event.ip,
        userAgent: event.userAgent,
        details: event.details,
      });
    } catch (error) {
      logger.error('Failed to log auth event', { error, event });
    }
  }

  /**
   * Log transaction events
   */
  async logTransaction(event: {
    userId: string;
    action: 'TOKEN_PURCHASE' | 'TOKEN_REDEMPTION' | 'TRANSFER_SENT' | 'TRANSFER_RECEIVED';
    transactionId: string;
    amount: number;
    recipientId?: string;
    ip: string;
    userAgent: string;
    details?: any;
  }): Promise<void> {
    try {
      await this.auditLogDAO.create({
        user_id: event.userId,
        action: event.action,
        resource_type: 'transaction',
        resource_id: event.transactionId,
        ip_address: event.ip,
        user_agent: event.userAgent,
        request_data: {
          amount: event.amount,
          recipientId: event.recipientId,
          ...event.details,
        },
        response_data: undefined,
        status_code: 200,
        created_at: new Date(),
      });

      logger.info(`TRANSACTION: ${event.action}`, {
        userId: event.userId,
        transactionId: event.transactionId,
        amount: event.amount,
        recipientId: event.recipientId,
        ip: event.ip,
      });
    } catch (error) {
      logger.error('Failed to log transaction event', { error, event });
    }
  }

  /**
   * Log security events
   */
  async logSecurity(event: {
    userId?: string;
    action: 'RATE_LIMIT_EXCEEDED' | 'SUSPICIOUS_ACTIVITY' | 'FRAUD_DETECTED' | 'UNAUTHORIZED_ACCESS' | 'DATA_BREACH_ATTEMPT' | 'SYSTEM_HEALTH_ALERT' | 'SECURITY_SCAN_TRIGGERED' | string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    ip?: string | undefined;
    userAgent?: string | undefined;
    details: any;
  }): Promise<void> {
    try {
      await this.auditLogDAO.create({
        user_id: event.userId,
        action: event.action,
        resource_type: 'security',
        resource_id: undefined,
        ip_address: event.ip || 'unknown',
        user_agent: event.userAgent,
        request_data: event.details,
        response_data: { severity: event.severity },
        status_code: undefined,
        created_at: new Date(),
      });

      const logLevel = event.severity === 'CRITICAL' || event.severity === 'HIGH' ? 'error' : 'warn';
      logger[logLevel](`SECURITY [${event.severity}]: ${event.action}`, {
        userId: event.userId,
        ip: event.ip,
        userAgent: event.userAgent,
        details: event.details,
      });
    } catch (error) {
      logger.error('Failed to log security event', { error, event });
    }
  }

  /**
   * Log system events
   */
  async logSystem(event: {
    action: 'SYSTEM_START' | 'SYSTEM_SHUTDOWN' | 'DATABASE_CONNECTION' | 'BLOCKCHAIN_CONNECTION' | 'BACKUP_CREATED' | 'BACKUP_RESTORED' | 'MANUAL_BACKUP_CREATED' | 'DISASTER_RECOVERY_PLAN_CREATED' | 'RECOVERY_PROCEDURES_TESTED' | string;
    details?: any;
  }): Promise<void> {
    try {
      await this.auditLogDAO.create({
        user_id: undefined,
        action: event.action,
        resource_type: 'system',
        resource_id: undefined,
        ip_address: undefined,
        user_agent: undefined,
        request_data: event.details,
        response_data: undefined,
        status_code: undefined,
        created_at: new Date(),
      });

      logger.info(`SYSTEM: ${event.action}`, event.details);
    } catch (error) {
      logger.error('Failed to log system event', { error, event });
    }
  }

  /**
   * Get audit logs with filtering
   */
  async getAuditLogs(filters: {
    userId?: string;
    action?: string;
    resourceType?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<any[]> {
    try {
      // This would need to be implemented in AuditLogDAO
      // For now, return empty array
      return [];
    } catch (error) {
      logger.error('Failed to get audit logs', { error, filters });
      return [];
    }
  }
}

// Export singleton instance
export const auditLogger = new AuditLogger();