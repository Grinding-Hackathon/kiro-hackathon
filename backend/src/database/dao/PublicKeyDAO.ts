import { BaseDAO } from './BaseDAO';
import { PublicKey, CreatePublicKeyData, UpdatePublicKeyData } from '../../models/PublicKey';

export class PublicKeyDAO extends BaseDAO<PublicKey, CreatePublicKeyData, UpdatePublicKeyData> {
  constructor() {
    super('public_keys');
  }

  async findByTypeAndIdentifier(keyType: string, identifier: string): Promise<PublicKey | null> {
    try {
      const result = await this.knex(this.tableName)
        .where({ 
          key_type: keyType,
          identifier: identifier 
        })
        .first();
      return result || null;
    } catch (error) {
      throw new Error(`Error finding public key by type and identifier: ${error}`);
    }
  }

  async findByType(keyType: string): Promise<PublicKey[]> {
    try {
      return await this.knex(this.tableName)
        .where({ key_type: keyType })
        .orderBy('created_at', 'desc');
    } catch (error) {
      throw new Error(`Error finding public keys by type: ${error}`);
    }
  }

  async findActiveKeys(): Promise<PublicKey[]> {
    try {
      return await this.knex(this.tableName)
        .where({ is_active: true })
        .where(function() {
          this.whereNull('expires_at')
            .orWhere('expires_at', '>', new Date());
        })
        .orderBy('created_at', 'desc');
    } catch (error) {
      throw new Error(`Error finding active public keys: ${error}`);
    }
  }

  async findExpiredKeys(): Promise<PublicKey[]> {
    try {
      return await this.knex(this.tableName)
        .where({ is_active: true })
        .where('expires_at', '<=', new Date());
    } catch (error) {
      throw new Error(`Error finding expired public keys: ${error}`);
    }
  }

  async deactivateKey(id: string): Promise<PublicKey | null> {
    try {
      return await this.update(id, { is_active: false });
    } catch (error) {
      throw new Error(`Error deactivating public key: ${error}`);
    }
  }

  async rotateKey(keyType: string, identifier: string, newPublicKey: string): Promise<PublicKey> {
    try {
      // Deactivate old key
      await this.knex(this.tableName)
        .where({ 
          key_type: keyType,
          identifier: identifier 
        })
        .update({ is_active: false });

      // Create new key
      return await this.create({
        key_type: keyType as 'user' | 'otm' | 'system',
        identifier,
        public_key: newPublicKey,
      });
    } catch (error) {
      throw new Error(`Error rotating public key: ${error}`);
    }
  }

  async getOTMPublicKey(): Promise<PublicKey | null> {
    try {
      const result = await this.knex(this.tableName)
        .where({ 
          key_type: 'otm',
          is_active: true 
        })
        .first();
      return result || null;
    } catch (error) {
      throw new Error(`Error getting OTM public key: ${error}`);
    }
  }
}