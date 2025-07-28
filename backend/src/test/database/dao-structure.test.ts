import { UserDAO } from '../../database/dao/UserDAO';
import { OfflineTokenDAO } from '../../database/dao/OfflineTokenDAO';
import { TransactionDAO } from '../../database/dao/TransactionDAO';
import { AuditLogDAO } from '../../database/dao/AuditLogDAO';
import { PublicKeyDAO } from '../../database/dao/PublicKeyDAO';

describe('DAO Structure Tests', () => {
  describe('UserDAO', () => {
    it('should be instantiable', () => {
      const userDAO = new UserDAO();
      expect(userDAO).toBeInstanceOf(UserDAO);
      expect(userDAO.findByWalletAddress).toBeDefined();
      expect(userDAO.findByEmail).toBeDefined();
      expect(userDAO.findActiveUsers).toBeDefined();
      expect(userDAO.updateLastActivity).toBeDefined();
      expect(userDAO.deactivateUser).toBeDefined();
    });
  });

  describe('OfflineTokenDAO', () => {
    it('should be instantiable', () => {
      const tokenDAO = new OfflineTokenDAO();
      expect(tokenDAO).toBeInstanceOf(OfflineTokenDAO);
      expect(tokenDAO.findByUserId).toBeDefined();
      expect(tokenDAO.findActiveTokensByUserId).toBeDefined();
      expect(tokenDAO.findExpiredTokens).toBeDefined();
      expect(tokenDAO.markAsSpent).toBeDefined();
      expect(tokenDAO.markAsRedeemed).toBeDefined();
      expect(tokenDAO.getUserTokenBalance).toBeDefined();
    });
  });

  describe('TransactionDAO', () => {
    it('should be instantiable', () => {
      const transactionDAO = new TransactionDAO();
      expect(transactionDAO).toBeInstanceOf(TransactionDAO);
      expect(transactionDAO.findByUserId).toBeDefined();
      expect(transactionDAO.findBySenderId).toBeDefined();
      expect(transactionDAO.findByReceiverId).toBeDefined();
      expect(transactionDAO.findByType).toBeDefined();
      expect(transactionDAO.findByStatus).toBeDefined();
      expect(transactionDAO.markAsCompleted).toBeDefined();
      expect(transactionDAO.markAsFailed).toBeDefined();
    });
  });

  describe('AuditLogDAO', () => {
    it('should be instantiable', () => {
      const auditLogDAO = new AuditLogDAO();
      expect(auditLogDAO).toBeInstanceOf(AuditLogDAO);
      expect(auditLogDAO.findByUserId).toBeDefined();
      expect(auditLogDAO.findByAction).toBeDefined();
      expect(auditLogDAO.findByResourceType).toBeDefined();
      expect(auditLogDAO.logAction).toBeDefined();
    });

    it('should prevent updates and deletes', async () => {
      const auditLogDAO = new AuditLogDAO();
      await expect(auditLogDAO.update()).rejects.toThrow('Audit logs cannot be updated');
      await expect(auditLogDAO.delete()).rejects.toThrow('Audit logs cannot be deleted');
    });
  });

  describe('PublicKeyDAO', () => {
    it('should be instantiable', () => {
      const publicKeyDAO = new PublicKeyDAO();
      expect(publicKeyDAO).toBeInstanceOf(PublicKeyDAO);
      expect(publicKeyDAO.findByTypeAndIdentifier).toBeDefined();
      expect(publicKeyDAO.findByType).toBeDefined();
      expect(publicKeyDAO.findActiveKeys).toBeDefined();
      expect(publicKeyDAO.deactivateKey).toBeDefined();
      expect(publicKeyDAO.rotateKey).toBeDefined();
      expect(publicKeyDAO.getOTMPublicKey).toBeDefined();
    });
  });
});