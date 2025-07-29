// Mock dependencies
jest.mock('../../utils/logger');
jest.mock('../../database/dao/TransactionDAO');
jest.mock('../../database/dao/AuditLogDAO');
jest.mock('../../database/dao/OfflineTokenDAO');

// Import the real service, not the mocked one
const fraudDetectionModule = jest.requireActual('../../services/fraudDetectionService');
const { fraudDetectionService } = fraudDetectionModule;

describe('FraudDetectionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Transaction Analysis', () => {
    it('should analyze transaction and return alerts', async () => {
      const transaction = {
        userId: 'user-123',
        amount: 100,
        type: 'token_purchase',
      };

      const alerts = await fraudDetectionService.analyzeTransaction(transaction);

      expect(Array.isArray(alerts)).toBe(true);
      // Since we're mocking the DAOs, this should return empty array or handle gracefully
    });

    it('should analyze user behavior', async () => {
      const userId = 'user-123';
      const alerts = await fraudDetectionService.analyzeUserBehavior(userId);

      expect(Array.isArray(alerts)).toBe(true);
    });

    it('should detect coordinated attacks', async () => {
      const alerts = await fraudDetectionService.detectCoordinatedAttacks();

      expect(Array.isArray(alerts)).toBe(true);
    });

    it('should run comprehensive scan', async () => {
      const alerts = await fraudDetectionService.runComprehensiveScan();

      expect(Array.isArray(alerts)).toBe(true);
    });
  });

  describe('Alert Management', () => {
    it('should get recent alerts', () => {
      const alerts = fraudDetectionService.getRecentAlerts(10);
      expect(Array.isArray(alerts)).toBe(true);
    });

    it('should get alerts by severity', () => {
      const criticalAlerts = fraudDetectionService.getAlertsBySeverity('CRITICAL');
      expect(Array.isArray(criticalAlerts)).toBe(true);
    });

    it('should clear old alerts', () => {
      expect(() => {
        fraudDetectionService.clearOldAlerts();
      }).not.toThrow();
    });

    it('should start periodic scans', () => {
      // Mock setInterval to avoid creating real timers
      const originalSetInterval = global.setInterval;
      global.setInterval = jest.fn();
      
      expect(() => {
        fraudDetectionService.startPeriodicScans();
      }).not.toThrow();
      
      // Restore original setInterval
      global.setInterval = originalSetInterval;
    });
  });

});