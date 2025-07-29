// Mock dependencies
jest.mock('../../utils/logger');
jest.mock('../../database/connection');
jest.mock('child_process');
jest.mock('fs');

// Import the real service, not the mocked one
const backupServiceModule = jest.requireActual('../../services/backupService');
const { backupService } = backupServiceModule;

describe('BackupService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Backup History', () => {
    it('should get backup history', () => {
      const history = backupService.getBackupHistory();
      expect(Array.isArray(history)).toBe(true);
    });

    it('should get backup by ID', () => {
      const backup = backupService.getBackup('non-existent');
      expect(backup).toBeUndefined();
    });

    it('should get disaster recovery status', () => {
      const status = backupService.getDisasterRecoveryStatus();
      expect(status).toHaveProperty('status');
      expect(status).toHaveProperty('recommendations');
      expect(Array.isArray(status.recommendations)).toBe(true);
    });
  });

  describe('Backup Operations', () => {
    it('should handle cleanup old backups', () => {
      // Test cleanup without throwing errors
      expect(() => {
        backupService.cleanupOldBackups(30);
      }).not.toThrow();
    });

    it('should schedule automatic backups', () => {
      // Mock setInterval to avoid creating real timers
      const originalSetInterval = global.setInterval;
      global.setInterval = jest.fn();
      
      expect(() => {
        backupService.scheduleAutomaticBackups();
      }).not.toThrow();
      
      // Restore original setInterval
      global.setInterval = originalSetInterval;
    });
  });

  describe('Disaster Recovery', () => {
    it('should create disaster recovery plan', async () => {
      const plan = await backupService.createDisasterRecoveryPlan();
      
      expect(plan).toHaveProperty('id');
      expect(plan).toHaveProperty('createdAt');
      expect(plan).toHaveProperty('systemInfo');
      expect(plan).toHaveProperty('backupStrategy');
      expect(plan).toHaveProperty('recoveryProcedures');
      expect(Array.isArray(plan.recoveryProcedures)).toBe(true);
    });

    it('should have test recovery procedures method', () => {
      // Just test that the method exists and is callable
      expect(typeof backupService.testRecoveryProcedures).toBe('function');
    });
  });
});