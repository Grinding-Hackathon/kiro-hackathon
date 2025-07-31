# API Reference Documentation

## 🎯 Overview

The Offline Blockchain Wallet API provides RESTful endpoints for wallet management, token operations, and blockchain integration. All endpoints use JSON for request/response data and require proper authentication.

**Base URL**: `https://api.wallet.com/api/v1`

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
  \"success\": true,
  \"data\": {
    \"walletAddress\": \"0x742d35Cc6634C0532925a3b8D404d3aAB451e9c\",
    \"balances\": {
      \"blockchain\": {
        \"amount\": 1250.75,
        \"currency\": \"ETH\",
        \"lastUpdated\": \"2024-01-15T10:30:00Z\"
      },
      \"offline\": {
        \"amount\": 125.50,
        \"tokenCount\": 5,
        \"lastUpdated\": \"2024-01-15T09:45:00Z\"
      },
      \"pending\": {
        \"amount\": 25.00,
        \"transactionCount\": 2
      }
    },
    \"totalBalance\": 1401.25
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
- `INTERNAL_SERVER_ERROR`: Unexpected server error

---

*For complete API documentation, visit `/api-docs` when the server is running.*
"