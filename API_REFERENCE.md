# API Reference Documentation

## 🎯 Overview

The Offline Blockchain Wallet API provides RESTful endpoints for wallet management, token operations, transaction processing, and blockchain integration. All endpoints use JSON for request/response data and require proper authentication.

**Base URL**: `https://api.wallet.com/api/v1`

## 🆕 Recent Updates

This documentation has been updated to include all new endpoints from the API Integration Fixes implementation:

- **Transaction Management**: Complete transaction submission, synchronization, and status tracking
- **Enhanced Token Operations**: Token validation, division, and lifecycle management
- **Wallet Enhancements**: Parameterized balance queries and transaction history
- **Security Integration**: Mobile security status, event reporting, and recommendations
- **Performance Monitoring**: Response caching, query optimization, and metrics collection

## 🔐 Authentication

### JWT Token Authentication

All protected endpoints require a valid JWT token in the Authorization header:

```http
Authorization: Bearer <jwt-token>
```

### Token Lifecycle

1. **Login**: Obtain access and refresh tokens
2. **Access**: Use access token for API calls
3. **Refresh**: Use refresh token to get new access token
4. **Logout**: Invalidate tokens

## 📚 Endpoints

### Authentication

#### POST /auth/refresh

Refresh access token using refresh token.

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": "24h"
  }
}
```

#### POST /auth/logout

Invalidate user tokens and end session.

**Headers:**
```http
Authorization: Bearer <access-token>
```

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Successfully logged out"
}
```

#### POST /auth/validate-session

Validate current session status.

**Headers:**
```http
Authorization: Bearer <access-token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "expiresAt": "2024-01-16T10:30:00Z",
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "username": "john_doe"
    }
  }
}
```

#### POST /auth/register

Register a new user account.

**Request:**
```json
{
  \"username\": \"john_doe\",
  \"email\": \"john@example.com\",
  \"password\": \"SecurePass123!\",
  \"confirmPassword\": \"SecurePass123!\"
}
```

**Response (201):**
```json
{
  \"success\": true,
  \"data\": {
    \"user\": {
      \"id\": \"550e8400-e29b-41d4-a716-446655440000\",
      \"username\": \"john_doe\",
      \"email\": \"john@example.com\",
      \"walletAddress\": \"0x742d35Cc6634C0532925a3b8D404d3aAB451e9c\",
      \"createdAt\": \"2024-01-15T10:30:00Z\"
    },
    \"tokens\": {
      \"accessToken\": \"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...\",
      \"refreshToken\": \"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...\",
      \"expiresIn\": \"24h\"
    }
  }
}
```

#### POST /auth/login

Authenticate user and receive tokens.

**Request:**
```json
{
  \"email\": \"john@example.com\",
  \"password\": \"SecurePass123!\"
}
```

**Response (200):**
```json
{
  \"success\": true,
  \"data\": {
    \"user\": {
      \"id\": \"550e8400-e29b-41d4-a716-446655440000\",
      \"username\": \"john_doe\",
      \"email\": \"john@example.com\",
      \"walletAddress\": \"0x742d35Cc6634C0532925a3b8D404d3aAB451e9c\"
    },
    \"tokens\": {
      \"accessToken\": \"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...\",
      \"refreshToken\": \"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...\",
      \"expiresIn\": \"24h\"
    }
  }
}
```

### Wallet Management

#### GET /wallet/balance

Get current wallet balance.

**Headers:**
```http
Authorization: Bearer <access-token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "walletId": "550e8400-e29b-41d4-a716-446655440000",
    "walletAddress": "0x742d35Cc6634C0532925a3b8D404d3aAB451e9c",
    "balances": {
      "blockchain": {
        "amount": 1250.75,
        "currency": "ETH",
        "lastUpdated": "2024-01-15T10:30:00Z"
      },
      "offline": {
        "amount": 125.50,
        "tokenCount": 5,
        "lastUpdated": "2024-01-15T09:45:00Z"
      },
      "pending": {
        "amount": 25.00,
        "transactionCount": 2
      }
    },
    "totalBalance": 1401.25
  }
}
```

#### GET /wallet/:walletId/balance

Get balance for a specific wallet ID.

**Headers:**
```http
Authorization: Bearer <access-token>
```

**Parameters:**
- `walletId` (path): Wallet identifier

**Response (200):**
```json
{
  "success": true,
  "data": {
    "walletId": "550e8400-e29b-41d4-a716-446655440001",
    "walletAddress": "0x987fcdeb51234567890abcdef123456789abcdef1",
    "balances": {
      "blockchain": {
        "amount": 850.25,
        "currency": "ETH",
        "lastUpdated": "2024-01-15T10:30:00Z"
      },
      "offline": {
        "amount": 75.00,
        "tokenCount": 3,
        "lastUpdated": "2024-01-15T09:45:00Z"
      },
      "pending": {
        "amount": 15.00,
        "transactionCount": 1
      }
    },
    "totalBalance": 940.25
  }
}
```

#### GET /wallet/history

Get wallet transaction history with pagination and filtering.

**Headers:**
```http
Authorization: Bearer <access-token>
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)
- `type` (optional): Transaction type filter
- `status` (optional): Transaction status filter
- `startDate` (optional): Start date filter (ISO 8601)
- `endDate` (optional): End date filter (ISO 8601)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440003",
        "type": "token_purchase",
        "amount": 100.00,
        "status": "completed",
        "blockchainHash": "0x1234567890abcdef...",
        "createdAt": "2024-01-15T10:30:00Z",
        "completedAt": "2024-01-15T10:32:00Z",
        "metadata": {
          "tokenCount": 4,
          "gasUsed": "21000"
        }
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalItems": 95,
      "itemsPerPage": 20
    }
  }
}
```

#### POST /wallet/purchase

Purchase tokens for offline use.

**Headers:**
```http
Authorization: Bearer <access-token>
```

**Request:**
```json
{
  \"amount\": 100.00,
  \"paymentMethod\": \"ethereum\",
  \"transactionHash\": \"0x1234567890abcdef...\",
  \"gasPrice\": \"20000000000\",
  \"gasLimit\": \"21000\"
}
```

**Response (201):**
```json
{
  \"success\": true,
  \"data\": {
    \"transactionId\": \"550e8400-e29b-41d4-a716-446655440001\",
    \"tokens\": [
      {
        \"id\": \"token-uuid-1\",
        \"amount\": 25.00,
        \"signature\": \"0x3045022100...\",
        \"expiresAt\": \"2024-02-15T10:30:00Z\",
        \"createdAt\": \"2024-01-15T10:30:00Z\"
      }
    ],
    \"totalAmount\": 100.00,
    \"blockchainTransaction\": {
      \"hash\": \"0x1234567890abcdef...\",
      \"blockNumber\": 18500000,
      \"gasUsed\": \"21000\",
      \"status\": \"confirmed\"
    }
  }
}
```

### Token Operations

#### POST /tokens/validate

Validate an offline token.

**Headers:**
```http
Authorization: Bearer <access-token>
```

**Request:**
```json
{
  \"tokenId\": \"token-uuid-1\",
  \"signature\": \"0x3045022100...\",
  \"amount\": 25.00
}
```

**Response (200):**
```json
{
  \"success\": true,
  \"data\": {
    \"valid\": true,
    \"token\": {
      \"id\": \"token-uuid-1\",
      \"amount\": 25.00,
      \"ownerId\": \"550e8400-e29b-41d4-a716-446655440000\",
      \"signature\": \"0x3045022100...\",
      \"isSpent\": false,
      \"expiresAt\": \"2024-02-15T10:30:00Z\",
      \"createdAt\": \"2024-01-15T10:30:00Z\"
    },
    \"validationDetails\": {
      \"signatureValid\": true,
      \"notExpired\": true,
      \"notSpent\": true,
      \"ownershipValid\": true
    }
  }
}
```

#### POST /tokens/divide

Divide a token for making change.

**Headers:**
```http
Authorization: Bearer <access-token>
```

**Request:**
```json
{
  \"tokenId\": \"token-uuid-1\",
  \"paymentAmount\": 15.00,
  \"signature\": \"0x3045022100...\"
}
```

**Response (200):**
```json
{
  \"success\": true,
  \"data\": {
    \"originalToken\": {
      \"id\": \"token-uuid-1\",
      \"amount\": 25.00,
      \"status\": \"divided\"
    },
    \"paymentToken\": {
      \"id\": \"payment-token-uuid\",
      \"amount\": 15.00,
      \"signature\": \"0x3045022100...\",
      \"expiresAt\": \"2024-02-15T10:30:00Z\",
      \"createdAt\": \"2024-01-15T11:00:00Z\"
    },
    \"changeToken\": {
      \"id\": \"change-token-uuid\",
      \"amount\": 10.00,
      \"signature\": \"0x3045022100...\",
      \"expiresAt\": \"2024-02-15T10:30:00Z\",
      \"createdAt\": \"2024-01-15T11:00:00Z\"
    }
  }
}
```

#### GET /tokens/public-keys

Get public key database for token validation.

**Headers:**
```http
Authorization: Bearer <access-token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "publicKeys": {
      "550e8400-e29b-41d4-a716-446655440000": {
        "publicKey": "0x04a34b99f22c790c4e36b2b3c2c35a36db06226e41c692fc82b8b56ac1c540c5bd5b8dec5235a0fa8722476c7709c02559e3aa73aa03918ba2d492eea75abea235",
        "walletAddress": "0x742d35Cc6634C0532925a3b8D404d3aAB451e9c",
        "lastUpdated": "2024-01-15T10:30:00Z"
      }
    },
    "otmPublicKey": "0x04b45c99f33d891d5e47c3c4d3d46b47ec17337f52d793fd93c9c67bd2d651d6ce6c9ded6346b1fb9833587d8819d13669f4bb84bb14929cb3e593ffb86bfb346",
    "version": "1.0.0"
  }
}
```

### Transaction Management

#### POST /transactions/submit

Submit a new transaction for processing.

**Headers:**
```http
Authorization: Bearer <access-token>
```

**Request:**
```json
{
  "type": "offline_transfer",
  "senderId": "550e8400-e29b-41d4-a716-446655440000",
  "receiverId": "550e8400-e29b-41d4-a716-446655440005",
  "amount": 25.00,
  "tokenIds": ["token-uuid-1"],
  "senderSignature": "0x3045022100...",
  "metadata": {
    "connectionType": "bluetooth",
    "deviceInfo": "iPhone 12"
  }
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "transactionId": "550e8400-e29b-41d4-a716-446655440010",
    "status": "pending",
    "blockchainTxHash": null,
    "timestamp": "2024-01-15T11:00:00Z",
    "estimatedConfirmation": "2024-01-15T11:05:00Z"
  }
}
```

#### GET /transactions/sync

Synchronize transactions since last sync timestamp.

**Headers:**
```http
Authorization: Bearer <access-token>
```

**Query Parameters:**
- `lastSyncTimestamp` (optional): ISO timestamp of last sync
- `limit` (optional): Maximum transactions to return (default: 50)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440010",
        "type": "offline_transfer",
        "senderId": "550e8400-e29b-41d4-a716-446655440000",
        "receiverId": "550e8400-e29b-41d4-a716-446655440005",
        "amount": 25.00,
        "status": "completed",
        "blockchainTxHash": "0xabc123def456...",
        "timestamp": "2024-01-15T11:00:00Z",
        "completedAt": "2024-01-15T11:02:00Z"
      }
    ],
    "lastSyncTimestamp": "2024-01-15T11:02:00Z",
    "totalCount": 1,
    "hasMore": false
  }
}
```

#### GET /transactions/:id/status

Get detailed status of a specific transaction.

**Headers:**
```http
Authorization: Bearer <access-token>
```

**Parameters:**
- `id` (path): Transaction identifier

**Response (200):**
```json
{
  "success": true,
  "data": {
    "transactionId": "550e8400-e29b-41d4-a716-446655440010",
    "status": "completed",
    "blockchainTxHash": "0xabc123def456...",
    "confirmations": 12,
    "estimatedConfirmation": "2024-01-15T11:05:00Z",
    "actualConfirmation": "2024-01-15T11:02:00Z",
    "gasUsed": "21000",
    "gasPrice": "20000000000"
  }
}
```

#### POST /transactions/sync-offline

Process offline transactions and sync to blockchain.

**Headers:**
```http
Authorization: Bearer <access-token>
```

**Request:**
```json
{
  "transactions": [
    {
      "id": "offline-tx-1",
      "senderId": "550e8400-e29b-41d4-a716-446655440000",
      "receiverId": "550e8400-e29b-41d4-a716-446655440005",
      "amount": 15.00,
      "tokenIds": ["payment-token-uuid"],
      "senderSignature": "0x3045022100...",
      "timestamp": "2024-01-15T11:00:00Z",
      "metadata": {
        "connectionType": "bluetooth",
        "deviceName": "iPhone 12"
      }
    }
  ]
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "processedTransactions": [
      {
        "offlineId": "offline-tx-1",
        "blockchainId": "550e8400-e29b-41d4-a716-446655440011",
        "status": "synced",
        "blockchainTxHash": "0xdef456abc123..."
      }
    ],
    "failedTransactions": [],
    "summary": {
      "totalTransactions": 1,
      "successfulSyncs": 1,
      "failedSyncs": 0
    }
  }
}
```

### Security Operations

#### GET /security/mobile/status

Get security status information for mobile app.

**Headers:**
```http
Authorization: Bearer <access-token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "overallStatus": "healthy",
    "securityScore": 85,
    "alerts": [
      {
        "id": "alert-1",
        "type": "info",
        "message": "Regular security scan completed successfully",
        "timestamp": "2024-01-15T10:00:00Z"
      }
    ],
    "recommendations": [
      {
        "id": "rec-1",
        "priority": "medium",
        "title": "Enable two-factor authentication",
        "description": "Add an extra layer of security to your account"
      }
    ],
    "lastSecurityScan": "2024-01-15T10:00:00Z"
  }
}
```

#### POST /security/events

Report security events from mobile app.

**Headers:**
```http
Authorization: Bearer <access-token>
```

**Request:**
```json
{
  "eventType": "suspicious_activity",
  "severity": "medium",
  "description": "Multiple failed authentication attempts",
  "metadata": {
    "deviceInfo": "iPhone 12",
    "location": "New York, NY",
    "attemptCount": 3
  }
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "eventId": "550e8400-e29b-41d4-a716-446655440020",
    "status": "recorded",
    "timestamp": "2024-01-15T11:30:00Z",
    "actionTaken": "account_monitoring_increased"
  }
}
```

#### GET /security/recommendations

Get personalized security recommendations.

**Headers:**
```http
Authorization: Bearer <access-token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "recommendations": [
      {
        "id": "rec-1",
        "priority": "high",
        "category": "authentication",
        "title": "Enable biometric authentication",
        "description": "Use Face ID or Touch ID for faster and more secure access",
        "actionUrl": "/settings/biometric",
        "estimatedTime": "2 minutes"
      },
      {
        "id": "rec-2",
        "priority": "medium",
        "category": "backup",
        "title": "Create wallet backup",
        "description": "Secure your wallet with an encrypted backup",
        "actionUrl": "/settings/backup",
        "estimatedTime": "5 minutes"
      }
    ],
    "securityScore": 85,
    "maxScore": 100
  }
}
```

## 🔒 Security

### Rate Limiting

- **Default**: 100 requests per 15 minutes per IP
- **Authentication**: 5 requests per 15 minutes per IP
- **Token operations**: 50 requests per 15 minutes per user

### Error Responses

```json
{
  \"success\": false,
  \"error\": {
    \"code\": \"VALIDATION_ERROR\",
    \"message\": \"Invalid input data\",
    \"details\": {
      \"field\": \"amount\",
      \"reason\": \"Amount must be positive\"
    },
    \"timestamp\": \"2024-01-15T10:30:00Z\",
    \"requestId\": \"req-uuid-here\"
  }
}
```

### Common Error Codes

- `AUTHENTICATION_REQUIRED`: Missing or invalid authentication
- `AUTHORIZATION_FAILED`: Insufficient permissions
- `VALIDATION_ERROR`: Invalid input data
- `RESOURCE_NOT_FOUND`: Requested resource doesn't exist
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `BLOCKCHAIN_ERROR`: Blockchain operation failed
- `INSUFFICIENT_BALANCE`: Not enough funds
- `TOKEN_EXPIRED`: Token has expired
- `TOKEN_ALREADY_SPENT`: Token has already been used
- `DOUBLE_SPENDING_DETECTED`: Attempt to spend the same token twice
- `INVALID_SIGNATURE`: Cryptographic signature validation failed
- `NETWORK_ERROR`: Network connectivity or communication error
- `TRANSACTION_FAILED`: Transaction processing failed
- `SYNC_ERROR`: Synchronization operation failed
- `SECURITY_VIOLATION`: Security policy violation detected
- `INTERNAL_SERVER_ERROR`: Unexpected server error

---

*For complete API documentation, visit `/api-docs` when the server is running.*
"