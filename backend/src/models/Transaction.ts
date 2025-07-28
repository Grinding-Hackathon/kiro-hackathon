export interface Transaction {
  id: string;
  sender_id?: string;
  receiver_id?: string;
  amount: string; // Using string for decimal precision
  type: 'online' | 'offline' | 'token_purchase' | 'token_redemption';
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  blockchain_tx_hash?: string;
  sender_signature?: string;
  receiver_signature?: string;
  token_ids?: string[]; // Array of token IDs
  metadata?: any;
  error_message?: string;
  created_at: Date;
  updated_at: Date;
  completed_at?: Date;
}

export interface CreateTransactionData {
  sender_id?: string;
  receiver_id?: string;
  amount: string;
  type: 'online' | 'offline' | 'token_purchase' | 'token_redemption';
  blockchain_tx_hash?: string;
  sender_signature?: string;
  receiver_signature?: string;
  token_ids?: string[];
  metadata?: any;
}

export interface UpdateTransactionData {
  status?: 'pending' | 'completed' | 'failed' | 'cancelled';
  blockchain_tx_hash?: string;
  sender_signature?: string;
  receiver_signature?: string;
  error_message?: string;
  completed_at?: Date;
  metadata?: any;
}