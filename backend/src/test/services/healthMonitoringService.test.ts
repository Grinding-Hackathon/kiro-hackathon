import { blockchainService } from '../../services/blockchainService';

// Mock dependencies
jest.mock('../../utils/logger');
jest.mock('../../services/blockchainService');
jest.mock('../../database/connection');

const mockBlockchainService = blockchainService as jest.Mocked<typeof blockchainService>;

// Import the real service, not the mocked one
const healthMonitoringModule = jest.requireActual('../../services/healthMonitoringService');
const { healthMonitoringService } = healthMonitoringModule;

describe('HealthMonitoringService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('System Health Check', () => {
    it('should perform health check', async () => {
      mockBlockchainService.getCurrentBlockNumber.mockResolvedValue(100);

      const health = await healthMonitoringService.performHealthCheck();

      expect(health).toHaveProperty('overall');
      expect(health).toHaveProperty('checks');
      expect(health).toHaveProperty('uptime');
      expect(health).toHaveProperty('timestamp');
      expect(Array.isArray(health.checks)).toBe(true);
    });

    it('should get current health', () => {
      const health = healthMonitoringService.getCurrentHealth();
      // Can be null if no health check has been performed yet
      expect(health === null || typeof health === 'object').toBe(true);
    });

    it('should force health check', async () => {
      mockBlockchainService.getCurrentBlockNumber.mockResolvedValue(100);

      const health = await healthMonitoringService.forceHealthCheck();

      expect(health).toHaveProperty('overall');
      expect(health).toHaveProperty('checks');
      expect(Array.isArray(health.checks)).toBe(true);
    });
  });

  describe('Alert Management', () => {
    it('should get active alerts', () => {
      const alerts = healthMonitoringService.getActiveAlerts();
      expect(Array.isArray(alerts)).toBe(true);
    });

    it('should get all alerts', () => {
      const alerts = healthMonitoringService.getAllAlerts();
      expect(Array.isArray(alerts)).toBe(true);
    });
  });

  describe('Monitoring Control', () => {
    it('should start monitoring', () => {
      expect(() => {
        healthMonitoringService.startMonitoring();
      }).not.toThrow();
    });

    it('should stop monitoring', () => {
      expect(() => {
        healthMonitoringService.stopMonitoring();
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle blockchain service errors', async () => {
      mockBlockchainService.getCurrentBlockNumber.mockRejectedValue(new Error('Connection failed'));

      const health = await healthMonitoringService.performHealthCheck();

      expect(health).toHaveProperty('overall');
      expect(health).toHaveProperty('checks');
      
      // Should have blockchain check with unhealthy status
      const blockchainCheck = health.checks.find((check: any) => check.service === 'blockchain');
      expect(blockchainCheck).toBeDefined();
      expect(blockchainCheck?.status).toBe('unhealthy');
    });
  });
});