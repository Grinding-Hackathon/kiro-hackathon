export interface User {
  id: string;
  wallet_address: string;
  public_key: string;
  email?: string;
  password_hash?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserData {
  wallet_address: string;
  public_key: string;
  email?: string;
  password_hash?: string;
}

export interface UpdateUserData {
  email?: string;
  password_hash?: string;
  is_active?: boolean;
  public_key?: string;
}