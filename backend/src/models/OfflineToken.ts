export interface OfflineToken {
  id: string;
  user_id: string;
  amount: string; // Using string for decimal precision
  signature: string;
  issuer_public_key: string;
  issued_at: Date;
  expires_at: Date;
  redeemed_at?: Date;
  spent_at?: Date;
  status: 'active' | 'spent' | 'redeemed' | 'expired';
  metadata?: any;
  created_at: Date;
  updated_at: Date;
}

export interface CreateOfflineTokenData {
  user_id: string;
  amount: string;
  signature: string;
  issuer_public_key: string;
  expires_at: Date;
  metadata?: any;
}

export interface UpdateOfflineTokenData {
  redeemed_at?: Date;
  spent_at?: Date;
  status?: 'active' | 'spent' | 'redeemed' | 'expired';
  metadata?: any;
}