// Common types used throughout the application

export interface User {
  id: string;
  walletAddress: string;
  publicKey: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OfflineToken {
  id: string;
  userId: string;
  amount: number;
  signature: string;
  issuedAt: Date;
  expiresAt: Date;
  redeemedAt?: Date;
  status: 'active' | 'spent' | 'expired' | 'redeemed';
}

export interface Transaction {
  id: string;
  senderId?: string;
  receiverId?: string;
  amount: number;
  type: 'token_purchase' | 'token_redemption' | 'token_transfer' | 'refund';
  status: 'pending' | 'completed' | 'failed';
  blockchainTxHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TokenPurchaseRequest {
  amount: number;
  walletAddress: string;
}

export interface TokenRedemptionRequest {
  tokens: {
    id: string;
    signature: string;
  }[];
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Blockchain related types
export interface BlockchainTransaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  gasUsed: number;
  gasPrice: string;
  blockNumber: number;
  confirmations: number;
}

export interface SmartContractEvent {
  event: string;
  returnValues: Record<string, any>;
  transactionHash: string;
  blockNumber: number;
}

// OTM (Offline Token Manager) types
export interface OTMKeyPair {
  privateKey: string;
  publicKey: string;
}

export interface SignedTokenData {
  tokenId: string;
  userId: string;
  amount: number;
  issuedAt: number;
  expiresAt: number;
  signature: string;
}

// Error types
export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
  statusCode: number;
}