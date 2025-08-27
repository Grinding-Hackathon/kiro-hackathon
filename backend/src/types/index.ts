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
  error?: ErrorResponse;
  message?: string;
  timestamp: string;
  requestId?: string;
}

export interface ErrorResponse {
  code: ErrorCode;
  message: string;
  details?: {
    field?: string;
    reason?: string;
    validationErrors?: ValidationError[];
    [key: string]: any;
  };
}

export enum ErrorCode {
  // Validation Errors (400)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_REQUEST_FORMAT = 'INVALID_REQUEST_FORMAT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FIELD_VALUE = 'INVALID_FIELD_VALUE',
  INVALID_ETHEREUM_ADDRESS = 'INVALID_ETHEREUM_ADDRESS',
  INVALID_SIGNATURE_FORMAT = 'INVALID_SIGNATURE_FORMAT',
  INVALID_TOKEN_ID = 'INVALID_TOKEN_ID',
  INVALID_AMOUNT = 'INVALID_AMOUNT',
  INVALID_TIMESTAMP = 'INVALID_TIMESTAMP',
  INVALID_PAGINATION_PARAMS = 'INVALID_PAGINATION_PARAMS',

  // Authentication Errors (401)
  AUTHENTICATION_REQUIRED = 'AUTHENTICATION_REQUIRED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_MALFORMED = 'TOKEN_MALFORMED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  REFRESH_TOKEN_INVALID = 'REFRESH_TOKEN_INVALID',
  REFRESH_TOKEN_EXPIRED = 'REFRESH_TOKEN_EXPIRED',

  // Authorization Errors (403)
  AUTHORIZATION_FAILED = 'AUTHORIZATION_FAILED',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  ACCESS_DENIED = 'ACCESS_DENIED',
  ACCOUNT_SUSPENDED = 'ACCOUNT_SUSPENDED',
  FRAUD_DETECTED = 'FRAUD_DETECTED',
  SECURITY_VIOLATION = 'SECURITY_VIOLATION',

  // Resource Errors (404)
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  WALLET_NOT_FOUND = 'WALLET_NOT_FOUND',
  TRANSACTION_NOT_FOUND = 'TRANSACTION_NOT_FOUND',
  TOKEN_NOT_FOUND = 'TOKEN_NOT_FOUND',
  ENDPOINT_NOT_FOUND = 'ENDPOINT_NOT_FOUND',

  // Conflict Errors (409)
  RESOURCE_CONFLICT = 'RESOURCE_CONFLICT',
  DUPLICATE_TRANSACTION = 'DUPLICATE_TRANSACTION',
  CONCURRENT_MODIFICATION = 'CONCURRENT_MODIFICATION',

  // Business Logic Errors (422)
  BUSINESS_RULE_VIOLATION = 'BUSINESS_RULE_VIOLATION',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  TOKEN_ALREADY_SPENT = 'TOKEN_ALREADY_SPENT',
  TOKEN_ALREADY_EXPIRED = 'TOKEN_ALREADY_EXPIRED',
  DOUBLE_SPENDING_DETECTED = 'DOUBLE_SPENDING_DETECTED',
  INVALID_SIGNATURE = 'INVALID_SIGNATURE',
  SIGNATURE_VERIFICATION_FAILED = 'SIGNATURE_VERIFICATION_FAILED',
  INVALID_TOKEN_STATE = 'INVALID_TOKEN_STATE',
  TRANSACTION_ALREADY_PROCESSED = 'TRANSACTION_ALREADY_PROCESSED',
  INVALID_TRANSACTION_STATE = 'INVALID_TRANSACTION_STATE',
  TOKEN_DIVISION_ERROR = 'TOKEN_DIVISION_ERROR',
  AMOUNT_MISMATCH = 'AMOUNT_MISMATCH',

  // Rate Limiting (429)
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',

  // External Service Errors (502, 503, 504)
  BLOCKCHAIN_ERROR = 'BLOCKCHAIN_ERROR',
  BLOCKCHAIN_UNAVAILABLE = 'BLOCKCHAIN_UNAVAILABLE',
  BLOCKCHAIN_TIMEOUT = 'BLOCKCHAIN_TIMEOUT',
  NETWORK_ERROR = 'NETWORK_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  DATABASE_UNAVAILABLE = 'DATABASE_UNAVAILABLE',

  // Server Errors (500)
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  UNEXPECTED_ERROR = 'UNEXPECTED_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  MAINTENANCE_MODE = 'MAINTENANCE_MODE',
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

// Blockchain service types
export interface ContractDeploymentResult {
  contractAddress: string;
  transactionHash: string;
  blockNumber: number;
  gasUsed: bigint;
}

export interface TransactionOptions {
  gasLimit?: bigint;
  gasPrice?: bigint;
  value?: bigint;
  nonce?: number;
}

export interface ContractCallResult<T = any> {
  result: T;
  gasUsed?: bigint;
  blockNumber?: number;
}

export interface TransactionConfirmationOptions {
  confirmations?: number;
  timeout?: number;
}

export interface NetworkInfo {
  name: string;
  chainId: bigint;
  blockNumber: number;
}

export interface ConnectionStatus {
  isConnected: boolean;
  reconnectAttempts: number;
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