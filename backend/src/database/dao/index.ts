export { BaseDAO } from './BaseDAO';
export { UserDAO } from './UserDAO';
export { OfflineTokenDAO } from './OfflineTokenDAO';
export { TransactionDAO } from './TransactionDAO';
export { AuditLogDAO } from './AuditLogDAO';
export { PublicKeyDAO } from './PublicKeyDAO';

// Create singleton instances
import { UserDAO } from './UserDAO';
import { OfflineTokenDAO } from './OfflineTokenDAO';
import { TransactionDAO } from './TransactionDAO';
import { AuditLogDAO } from './AuditLogDAO';
import { PublicKeyDAO } from './PublicKeyDAO';

export const userDAO = new UserDAO();
export const offlineTokenDAO = new OfflineTokenDAO();
export const transactionDAO = new TransactionDAO();
export const auditLogDAO = new AuditLogDAO();
export const publicKeyDAO = new PublicKeyDAO();