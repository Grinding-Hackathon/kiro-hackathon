export interface PublicKey {
  id: string;
  key_type: 'user' | 'otm' | 'system';
  identifier: string;
  public_key: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  expires_at?: Date;
}

export interface CreatePublicKeyData {
  key_type: 'user' | 'otm' | 'system';
  identifier: string;
  public_key: string;
  expires_at?: Date;
}

export interface UpdatePublicKeyData {
  public_key?: string;
  is_active?: boolean;
  expires_at?: Date;
}