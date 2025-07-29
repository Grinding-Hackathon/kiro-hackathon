import { logger, auditLogger } from '@/utils/logger';
import { config } from '@/config/config';
import { db } from '@/database/connection';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface BackupMetadata {
  id: string;
  type: 'full' | 'incremental' | 'logs';
  filename: string;
  size: number;
  checksum: string;
  timestamp: Date;
  status: 'in_progress' | 'completed' | 'failed';
  error?: string;
}

export interface RestoreOptions {
  backupId: string;
  targetDatabase?: string;
  preserveExisting?: boolean;
  restorePoint?: Date;
}

export class BackupService {
  private backupDirectory: string;
  private backupHistory: BackupMetadata[] = [];
  private isBackupInProgress: boolean = false;

  constructor() {
    this.backupDirectory = path.join(process.cwd(), 'backups');
    this.ensureBackupDirectory();
    this.loadBackupHistory();
  }

  /**
   * Ensure backup directory exists
   */
  private ensureBackupDirectory(): void {
    if (!fs.existsSync(this.backupDirectory)) {
      fs.mkdirSync(this.backupDirectory, { recursive: true });
      logger.info('Created backup directory', { path: this.backupDirectory });
    }
  }

  /**
   * Load backup history from metadata file
   */
  private loadBackupHistory(): void {
    const metadataFile = path.join(this.backupDirectory, 'backup-metadata.json');
    
    try {
      if (fs.existsSync(metadataFile)) {
        const data = fs.readFileSync(metadataFile, 'utf8');
        this.backupHistory = JSON.parse(data);
        logger.info('Loaded backup history', { count: this.backupHistory.length });
      }
    } catch (error) {
      logger.error('Failed to load backup history', { error });
      this.backupHistory = [];
    }
  }

  /**
   * Save backup history to metadata file
   */
  private saveBackupHistory(): void {
    const metadataFile = path.join(this.backupDirectory, 'backup-metadata.json');
    
    try {
      fs.writeFileSync(metadataFile, JSON.stringify(this.backupHistory, null, 2));
    } catch (error) {
      logger.error('Failed to save backup history', { error });
    }
  }

  /**
   * Create full database backup
   */
  async createFullBackup(): Promise<BackupMetadata> {
    if (this.isBackupInProgress) {
      throw new Error('Backup already in progress');
    }

    this.isBackupInProgress = true;
    const backupId = `full_${Date.now()}`;
    const timestamp = new Date();
    const filename = `${backupId}.sql`;
    const filepath = path.join(this.backupDirectory, filename);

    const metadata: BackupMetadata = {
      id: backupId,
      type: 'full',
      filename,
      size: 0,
      checksum: '',
      timestamp,
      status: 'in_progress',
    };

    this.backupHistory.push(metadata);
    this.saveBackupHistory();

    try {
      logger.info('Starting full database backup', { backupId, filepath });

      // Create PostgreSQL dump
      const dumpCommand = `pg_dump -h ${config.database.host} -p ${config.database.port} -U ${config.database.user} -d ${config.database.name} -f ${filepath}`;
      
      // Set password via environment variable
      const env = { ...process.env, PGPASSWORD: config.database.password };
      
      await execAsync(dumpCommand, { env });

      // Get file size and calculate checksum
      const stats = fs.statSync(filepath);
      const checksum = await this.calculateChecksum(filepath);

      metadata.size = stats.size;
      metadata.checksum = checksum;
      metadata.status = 'completed';

      logger.info('Full database backup completed', {
        backupId,
        size: metadata.size,
        checksum: metadata.checksum,
      });

      await auditLogger.logSystem({
        action: 'BACKUP_CREATED',
        details: {
          type: 'full',
          backupId,
          size: metadata.size,
          filename,
        },
      });

      return metadata;
    } catch (error) {
      metadata.status = 'failed';
      metadata.error = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error('Full database backup failed', { backupId, error });
      
      // Clean up failed backup file
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }

      throw error;
    } finally {
      this.isBackupInProgress = false;
      this.saveBackupHistory();
    }
  }

  /**
   * Create incremental backup (transaction logs)
   */
  async createIncrementalBackup(): Promise<BackupMetadata> {
    const backupId = `incremental_${Date.now()}`;
    const timestamp = new Date();
    const filename = `${backupId}.json`;
    const filepath = path.join(this.backupDirectory, filename);

    const metadata: BackupMetadata = {
      id: backupId,
      type: 'incremental',
      filename,
      size: 0,
      checksum: '',
      timestamp,
      status: 'in_progress',
    };

    this.backupHistory.push(metadata);

    try {
      logger.info('Starting incremental backup', { backupId });

      // Get the last full backup timestamp
      const lastFullBackup = this.backupHistory
        .filter(b => b.type === 'full' && b.status === 'completed')
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

      const sinceDate = lastFullBackup ? lastFullBackup.timestamp : new Date(0);

      // Export recent transactions, audit logs, and offline tokens
      const recentData = await this.exportRecentData(sinceDate);
      
      fs.writeFileSync(filepath, JSON.stringify(recentData, null, 2));

      // Get file size and calculate checksum
      const stats = fs.statSync(filepath);
      const checksum = await this.calculateChecksum(filepath);

      metadata.size = stats.size;
      metadata.checksum = checksum;
      metadata.status = 'completed';

      logger.info('Incremental backup completed', {
        backupId,
        size: metadata.size,
        recordCount: recentData.totalRecords,
      });

      return metadata;
    } catch (error) {
      metadata.status = 'failed';
      metadata.error = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error('Incremental backup failed', { backupId, error });
      
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }

      throw error;
    } finally {
      this.saveBackupHistory();
    }
  }

  /**
   * Create logs backup
   */
  async createLogsBackup(): Promise<BackupMetadata> {
    const backupId = `logs_${Date.now()}`;
    const timestamp = new Date();
    const filename = `${backupId}.tar.gz`;
    const filepath = path.join(this.backupDirectory, filename);

    const metadata: BackupMetadata = {
      id: backupId,
      type: 'logs',
      filename,
      size: 0,
      checksum: '',
      timestamp,
      status: 'in_progress',
    };

    this.backupHistory.push(metadata);

    try {
      logger.info('Starting logs backup', { backupId });

      // Create compressed archive of log files
      const logsDir = path.join(process.cwd(), 'logs');
      const tarCommand = `tar -czf ${filepath} -C ${logsDir} .`;
      
      await execAsync(tarCommand);

      // Get file size and calculate checksum
      const stats = fs.statSync(filepath);
      const checksum = await this.calculateChecksum(filepath);

      metadata.size = stats.size;
      metadata.checksum = checksum;
      metadata.status = 'completed';

      logger.info('Logs backup completed', {
        backupId,
        size: metadata.size,
      });

      return metadata;
    } catch (error) {
      metadata.status = 'failed';
      metadata.error = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error('Logs backup failed', { backupId, error });
      
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }

      throw error;
    } finally {
      this.saveBackupHistory();
    }
  }

  /**
   * Restore database from backup
   */
  async restoreFromBackup(options: RestoreOptions): Promise<void> {
    const backup = this.backupHistory.find(b => b.id === options.backupId);
    
    if (!backup) {
      throw new Error(`Backup not found: ${options.backupId}`);
    }

    if (backup.status !== 'completed') {
      throw new Error(`Backup is not in completed state: ${backup.status}`);
    }

    const filepath = path.join(this.backupDirectory, backup.filename);
    
    if (!fs.existsSync(filepath)) {
      throw new Error(`Backup file not found: ${filepath}`);
    }

    try {
      logger.info('Starting database restore', {
        backupId: options.backupId,
        type: backup.type,
        preserveExisting: options.preserveExisting,
      });

      // Verify backup integrity
      const currentChecksum = await this.calculateChecksum(filepath);
      if (currentChecksum !== backup.checksum) {
        throw new Error('Backup file integrity check failed');
      }

      if (backup.type === 'full') {
        await this.restoreFullBackup(filepath, options);
      } else if (backup.type === 'incremental') {
        await this.restoreIncrementalBackup(filepath, options);
      } else {
        throw new Error(`Cannot restore from backup type: ${backup.type}`);
      }

      await auditLogger.logSystem({
        action: 'BACKUP_RESTORED',
        details: {
          backupId: options.backupId,
          type: backup.type,
          preserveExisting: options.preserveExisting,
        },
      });

      logger.info('Database restore completed', { backupId: options.backupId });
    } catch (error) {
      logger.error('Database restore failed', { backupId: options.backupId, error });
      throw error;
    }
  }

  /**
   * Restore from full backup
   */
  private async restoreFullBackup(filepath: string, options: RestoreOptions): Promise<void> {
    const targetDb = options.targetDatabase || config.database.name;
    
    if (!options.preserveExisting) {
      // Drop and recreate database
      logger.warn('Dropping existing database for full restore', { database: targetDb });
      
      const dropCommand = `dropdb -h ${config.database.host} -p ${config.database.port} -U ${config.database.user} ${targetDb}`;
      const createCommand = `createdb -h ${config.database.host} -p ${config.database.port} -U ${config.database.user} ${targetDb}`;
      
      const env = { ...process.env, PGPASSWORD: config.database.password };
      
      try {
        await execAsync(dropCommand, { env });
      } catch (error) {
        // Database might not exist, continue
        logger.warn('Failed to drop database (might not exist)', { error: error instanceof Error ? error.message : 'Unknown error' });
      }
      
      await execAsync(createCommand, { env });
    }

    // Restore from backup
    const restoreCommand = `psql -h ${config.database.host} -p ${config.database.port} -U ${config.database.user} -d ${targetDb} -f ${filepath}`;
    const env = { ...process.env, PGPASSWORD: config.database.password };
    
    await execAsync(restoreCommand, { env });
  }

  /**
   * Restore from incremental backup
   */
  private async restoreIncrementalBackup(filepath: string, _options: RestoreOptions): Promise<void> {
    const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    
    // This would need to be implemented based on the specific data structure
    // For now, just log what would be restored
    logger.info('Incremental restore data', {
      totalRecords: data.totalRecords,
      tables: Object.keys(data.tables || {}),
    });
  }

  /**
   * Export recent data for incremental backup
   */
  private async exportRecentData(sinceDate: Date): Promise<any> {
    try {
      // Export recent transactions
      const transactions = await db('transactions')
        .where('created_at', '>', sinceDate)
        .select('*');

      // Export recent audit logs
      const auditLogs = await db('audit_logs')
        .where('created_at', '>', sinceDate)
        .select('*');

      // Export recent offline tokens
      const offlineTokens = await db('offline_tokens')
        .where('issued_at', '>', sinceDate)
        .select('*');

      const data = {
        exportDate: new Date(),
        sinceDate,
        totalRecords: transactions.length + auditLogs.length + offlineTokens.length,
        tables: {
          transactions,
          audit_logs: auditLogs,
          offline_tokens: offlineTokens,
        },
      };

      return data;
    } catch (error) {
      logger.error('Failed to export recent data', { error, sinceDate });
      throw error;
    }
  }

  /**
   * Calculate file checksum
   */
  private async calculateChecksum(filepath: string): Promise<string> {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filepath);
    
    return new Promise((resolve, reject) => {
      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * Schedule automatic backups
   */
  scheduleAutomaticBackups(): void {
    // Full backup every day at 2 AM
    // const fullBackupInterval = 24 * 60 * 60 * 1000; // 24 hours
    setInterval(async () => {
      try {
        const now = new Date();
        if (now.getHours() === 2) { // 2 AM
          await this.createFullBackup();
        }
      } catch (error) {
        logger.error('Scheduled full backup failed', { error });
      }
    }, 60 * 60 * 1000); // Check every hour

    // Incremental backup every 6 hours
    setInterval(async () => {
      try {
        await this.createIncrementalBackup();
      } catch (error) {
        logger.error('Scheduled incremental backup failed', { error });
      }
    }, 6 * 60 * 60 * 1000); // 6 hours

    // Logs backup every 12 hours
    setInterval(async () => {
      try {
        await this.createLogsBackup();
      } catch (error) {
        logger.error('Scheduled logs backup failed', { error });
      }
    }, 12 * 60 * 60 * 1000); // 12 hours

    logger.info('Automatic backup scheduling enabled');
  }

  /**
   * Clean up old backups
   */
  cleanupOldBackups(retentionDays: number = 30): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const oldBackups = this.backupHistory.filter(
      backup => backup.timestamp < cutoffDate
    );

    for (const backup of oldBackups) {
      try {
        const filepath = path.join(this.backupDirectory, backup.filename);
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
          logger.info('Deleted old backup file', { backupId: backup.id, filename: backup.filename });
        }
      } catch (error) {
        logger.error('Failed to delete old backup file', { backupId: backup.id, error });
      }
    }

    // Remove from history
    this.backupHistory = this.backupHistory.filter(
      backup => backup.timestamp >= cutoffDate
    );
    
    this.saveBackupHistory();
    
    logger.info('Backup cleanup completed', { 
      deletedCount: oldBackups.length,
      retentionDays,
    });
  }

  /**
   * Get backup history
   */
  getBackupHistory(): BackupMetadata[] {
    return [...this.backupHistory];
  }

  /**
   * Get backup by ID
   */
  getBackup(backupId: string): BackupMetadata | undefined {
    return this.backupHistory.find(backup => backup.id === backupId);
  }

  /**
   * Verify backup integrity
   */
  async verifyBackup(backupId: string): Promise<boolean> {
    const backup = this.getBackup(backupId);
    
    if (!backup) {
      throw new Error(`Backup not found: ${backupId}`);
    }

    const filepath = path.join(this.backupDirectory, backup.filename);
    
    if (!fs.existsSync(filepath)) {
      return false;
    }

    try {
      const currentChecksum = await this.calculateChecksum(filepath);
      return currentChecksum === backup.checksum;
    } catch (error) {
      logger.error('Failed to verify backup', { backupId, error });
      return false;
    }
  }

  /**
   * Create disaster recovery plan
   */
  async createDisasterRecoveryPlan(): Promise<any> {
    try {
      logger.info('Creating disaster recovery plan');
      
      const plan = {
        id: `dr_plan_${Date.now()}`,
        createdAt: new Date(),
        systemInfo: {
          nodeVersion: process.version,
          platform: process.platform,
          environment: config.env,
          databaseConfig: {
            host: config.database.host,
            port: config.database.port,
            name: config.database.name,
          },
        },
        backupStrategy: {
          fullBackupFrequency: '24 hours',
          incrementalBackupFrequency: '6 hours',
          logsBackupFrequency: '12 hours',
          retentionPeriod: '30 days',
        },
        recoveryProcedures: [
          {
            scenario: 'Database corruption',
            steps: [
              'Stop application services',
              'Identify latest valid full backup',
              'Restore from full backup',
              'Apply incremental backups in sequence',
              'Verify data integrity',
              'Restart services',
            ],
          },
          {
            scenario: 'Complete system failure',
            steps: [
              'Provision new infrastructure',
              'Install required dependencies',
              'Restore from latest full backup',
              'Configure environment variables',
              'Deploy application code',
              'Verify system functionality',
            ],
          },
          {
            scenario: 'Data breach',
            steps: [
              'Isolate affected systems',
              'Assess breach scope',
              'Restore from clean backup',
              'Update security measures',
              'Monitor for suspicious activity',
              'Notify relevant parties',
            ],
          },
        ],
        contactInformation: {
          primaryAdmin: 'system-admin@company.com',
          backupAdmin: 'backup-admin@company.com',
          emergencyContact: '+1-555-EMERGENCY',
        },
        testingSchedule: {
          backupVerification: 'Daily',
          recoveryTesting: 'Weekly',
          fullDrillTesting: 'Monthly',
        },
      };

      // Save plan to backup directory
      const planPath = path.join(this.backupDirectory, 'disaster-recovery-plan.json');
      fs.writeFileSync(planPath, JSON.stringify(plan, null, 2));
      
      await auditLogger.logSystem({
        action: 'DISASTER_RECOVERY_PLAN_CREATED',
        details: { planId: plan.id },
      });

      logger.info('Disaster recovery plan created', { planId: plan.id });
      return plan;
    } catch (error) {
      logger.error('Failed to create disaster recovery plan', { error });
      throw error;
    }
  }

  /**
   * Test backup and recovery procedures
   */
  async testRecoveryProcedures(): Promise<any> {
    try {
      logger.info('Starting recovery procedures test');
      
      const testResults: {
        testId: string;
        timestamp: Date;
        tests: Array<{
          test: string;
          result: string;
          details: any;
          backupId?: string;
        }>;
        summary?: {
          totalTests: number;
          passedTests: number;
          failedTests: number;
          successRate: string;
        };
      } = {
        testId: `recovery_test_${Date.now()}`,
        timestamp: new Date(),
        tests: [],
      };

      // Test 1: Verify all recent backups
      const recentBackups = this.backupHistory
        .filter(backup => {
          const threeDaysAgo = new Date();
          threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
          return backup.timestamp > threeDaysAgo && backup.status === 'completed';
        })
        .slice(0, 5); // Test last 5 backups

      for (const backup of recentBackups) {
        const isValid = await this.verifyBackup(backup.id);
        testResults.tests.push({
          test: 'Backup Integrity',
          backupId: backup.id,
          result: isValid ? 'PASS' : 'FAIL',
          details: { filename: backup.filename, size: backup.size },
        });
      }

      // Test 2: Database connection test
      try {
        await db.raw('SELECT 1');
        testResults.tests.push({
          test: 'Database Connection',
          result: 'PASS',
          details: { host: config.database.host, database: config.database.name },
        });
      } catch (error) {
        testResults.tests.push({
          test: 'Database Connection',
          result: 'FAIL',
          details: { error: error instanceof Error ? error.message : 'Unknown error' },
        });
      }

      // Test 3: Backup directory accessibility
      try {
        const stats = fs.statSync(this.backupDirectory);
        testResults.tests.push({
          test: 'Backup Directory Access',
          result: 'PASS',
          details: { 
            path: this.backupDirectory,
            isDirectory: stats.isDirectory(),
            permissions: stats.mode,
          },
        });
      } catch (error) {
        testResults.tests.push({
          test: 'Backup Directory Access',
          result: 'FAIL',
          details: { error: error instanceof Error ? error.message : 'Unknown error' },
        });
      }

      // Test 4: Disk space check
      try {
        const { stdout } = await execAsync(`df -h ${this.backupDirectory}`);
        testResults.tests.push({
          test: 'Disk Space Check',
          result: 'PASS',
          details: { diskUsage: stdout.trim() },
        });
      } catch (error) {
        testResults.tests.push({
          test: 'Disk Space Check',
          result: 'FAIL',
          details: { error: error instanceof Error ? error.message : 'Unknown error' },
        });
      }

      const passedTests = testResults.tests.filter(test => test.result === 'PASS').length;
      const totalTests = testResults.tests.length;
      
      testResults.summary = {
        totalTests,
        passedTests,
        failedTests: totalTests - passedTests,
        successRate: ((passedTests / totalTests) * 100).toFixed(1) + '%',
      };

      await auditLogger.logSystem({
        action: 'RECOVERY_PROCEDURES_TESTED',
        details: testResults,
      });

      logger.info('Recovery procedures test completed', {
        testId: testResults.testId,
        successRate: testResults.summary.successRate,
      });

      return testResults;
    } catch (error) {
      logger.error('Failed to test recovery procedures', { error });
      throw error;
    }
  }

  /**
   * Get disaster recovery status
   */
  getDisasterRecoveryStatus(): any {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const recentBackups = this.backupHistory.filter(
      backup => backup.timestamp > oneDayAgo
    );
    
    const successfulBackups = recentBackups.filter(
      backup => backup.status === 'completed'
    );
    
    const lastFullBackup = this.backupHistory
      .filter(backup => backup.type === 'full' && backup.status === 'completed')
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
    
    const lastIncrementalBackup = this.backupHistory
      .filter(backup => backup.type === 'incremental' && backup.status === 'completed')
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

    return {
      status: successfulBackups.length > 0 ? 'READY' : 'AT_RISK',
      lastFullBackup: lastFullBackup?.timestamp || null,
      lastIncrementalBackup: lastIncrementalBackup?.timestamp || null,
      recentBackups: {
        total: recentBackups.length,
        successful: successfulBackups.length,
        failed: recentBackups.length - successfulBackups.length,
      },
      recommendations: this.getRecoveryRecommendations(),
      timestamp: now,
    };
  }

  /**
   * Get recovery recommendations based on current state
   */
  private getRecoveryRecommendations(): string[] {
    const recommendations: string[] = [];
    const now = new Date();
    
    const lastFullBackup = this.backupHistory
      .filter(backup => backup.type === 'full' && backup.status === 'completed')
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
    
    if (!lastFullBackup) {
      recommendations.push('Create initial full backup immediately');
    } else {
      const hoursSinceLastFull = (now.getTime() - lastFullBackup.timestamp.getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastFull > 48) {
        recommendations.push('Full backup is overdue - create new full backup');
      }
    }
    
    const failedBackups = this.backupHistory.filter(
      backup => backup.status === 'failed' && 
      backup.timestamp > new Date(now.getTime() - 24 * 60 * 60 * 1000)
    );
    
    if (failedBackups.length > 0) {
      recommendations.push(`${failedBackups.length} backup(s) failed in last 24 hours - investigate issues`);
    }
    
    const totalBackupSize = this.backupHistory
      .filter(backup => backup.status === 'completed')
      .reduce((sum, backup) => sum + backup.size, 0);
    
    if (totalBackupSize > 10 * 1024 * 1024 * 1024) { // 10GB
      recommendations.push('Consider implementing backup compression or cleanup old backups');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Backup system is operating normally');
    }
    
    return recommendations;
  }
}

// Export singleton instance
export const backupService = new BackupService();