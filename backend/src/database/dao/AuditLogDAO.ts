import { BaseDAO } from './BaseDAO';
import { AuditLog, CreateAuditLogData } from '../../models/AuditLog';

export class AuditLogDAO extends BaseDAO<AuditLog, CreateAuditLogData, never> {
  constructor() {
    super('audit_logs');
  }

  // Override update method to prevent updates to audit logs
  override async update(): Promise<never> {
    throw new Error('Audit logs cannot be updated');
  }

  // Override delete method to prevent deletion of audit logs
  override async delete(): Promise<never> {
    throw new Error('Audit logs cannot be deleted');
  }

  async findByUserId(userId: string, limit?: number, offset?: number): Promise<AuditLog[]> {
    try {
      let query = this.knex(this.tableName)
        .where({ user_id: userId })
        .orderBy('created_at', 'desc');
      
      if (limit) {
        query = query.limit(limit);
      }
      
      if (offset) {
        query = query.offset(offset);
      }
      
      return await query;
    } catch (error) {
      throw new Error(`Error finding audit logs by user ID: ${error}`);
    }
  }

  async findByAction(action: string): Promise<AuditLog[]> {
    try {
      return await this.knex(this.tableName)
        .where({ action })
        .orderBy('created_at', 'desc');
    } catch (error) {
      throw new Error(`Error finding audit logs by action: ${error}`);
    }
  }

  async findByResourceType(resourceType: string): Promise<AuditLog[]> {
    try {
      return await this.knex(this.tableName)
        .where({ resource_type: resourceType })
        .orderBy('created_at', 'desc');
    } catch (error) {
      throw new Error(`Error finding audit logs by resource type: ${error}`);
    }
  }

  async findByResourceId(resourceType: string, resourceId: string): Promise<AuditLog[]> {
    try {
      return await this.knex(this.tableName)
        .where({ 
          resource_type: resourceType,
          resource_id: resourceId 
        })
        .orderBy('created_at', 'desc');
    } catch (error) {
      throw new Error(`Error finding audit logs by resource ID: ${error}`);
    }
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<AuditLog[]> {
    try {
      return await this.knex(this.tableName)
        .whereBetween('created_at', [startDate, endDate])
        .orderBy('created_at', 'desc');
    } catch (error) {
      throw new Error(`Error finding audit logs by date range: ${error}`);
    }
  }

  async logAction(data: CreateAuditLogData): Promise<AuditLog> {
    try {
      return await this.create(data);
    } catch (error) {
      throw new Error(`Error logging audit action: ${error}`);
    }
  }
}