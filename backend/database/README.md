# Database Schema and Data Access Layer

This directory contains the database schema, migrations, seeds, and data access layer for the Offline Blockchain Wallet backend.

## Overview

The database layer is built using:
- **PostgreSQL** as the primary database
- **Knex.js** for query building and migrations
- **TypeScript** for type safety
- **DAO Pattern** for data access abstraction

## Database Schema

### Tables

#### 1. users
Stores user account information and wallet addresses.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| wallet_address | VARCHAR(42) | Ethereum wallet address (unique) |
| public_key | TEXT | User's public key for cryptographic operations |
| email | VARCHAR | Optional email address |
| password_hash | VARCHAR | Optional password hash for additional auth |
| is_active | BOOLEAN | Account status |
| created_at | TIMESTAMP | Account creation time |
| updated_at | TIMESTAMP | Last update time |

#### 2. offline_tokens
Stores offline tokens issued by the OTM (Offline Token Manager).

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Foreign key to users table |
| amount | DECIMAL(18,8) | Token amount with high precision |
| signature | TEXT | Cryptographic signature from OTM |
| issuer_public_key | VARCHAR | Public key of the issuer (OTM) |
| issued_at | TIMESTAMP | Token issuance time |
| expires_at | TIMESTAMP | Token expiration time |
| redeemed_at | TIMESTAMP | Token redemption time (nullable) |
| spent_at | TIMESTAMP | Token spending time (nullable) |
| status | ENUM | Token status: active, spent, redeemed, expired |
| metadata | JSON | Additional token metadata |
| created_at | TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | Last update time |

#### 3. transactions
Stores all transaction records (online and offline).

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| sender_id | UUID | Foreign key to users table (nullable) |
| receiver_id | UUID | Foreign key to users table (nullable) |
| amount | DECIMAL(18,8) | Transaction amount |
| type | ENUM | Transaction type: online, offline, token_purchase, token_redemption |
| status | ENUM | Transaction status: pending, completed, failed, cancelled |
| blockchain_tx_hash | VARCHAR(66) | Ethereum transaction hash (nullable) |
| sender_signature | TEXT | Sender's cryptographic signature |
| receiver_signature | TEXT | Receiver's cryptographic signature |
| token_ids | JSON | Array of token IDs used in transaction |
| metadata | JSON | Additional transaction metadata |
| error_message | TEXT | Error message for failed transactions |
| created_at | TIMESTAMP | Transaction creation time |
| updated_at | TIMESTAMP | Last update time |
| completed_at | TIMESTAMP | Transaction completion time |

#### 4. audit_logs
Stores audit trail for all system operations.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Foreign key to users table (nullable) |
| action | VARCHAR | Action performed |
| resource_type | VARCHAR | Type of resource affected |
| resource_id | VARCHAR | ID of the affected resource |
| old_values | JSON | Previous values before change |
| new_values | JSON | New values after change |
| ip_address | VARCHAR | Client IP address |
| user_agent | VARCHAR | Client user agent |
| created_at | TIMESTAMP | Log entry creation time |

#### 5. public_keys
Stores public keys for cryptographic verification.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| key_type | VARCHAR | Key type: user, otm, system |
| identifier | VARCHAR | Unique identifier for the key |
| public_key | TEXT | The actual public key |
| is_active | BOOLEAN | Key status |
| created_at | TIMESTAMP | Key creation time |
| updated_at | TIMESTAMP | Last update time |
| expires_at | TIMESTAMP | Key expiration time (nullable) |

## Data Access Objects (DAOs)

### BaseDAO
Abstract base class providing common CRUD operations:
- `findById(id)` - Find record by ID
- `findAll(limit?, offset?)` - Find all records with pagination
- `create(data)` - Create new record
- `update(id, data)` - Update existing record
- `delete(id)` - Delete record
- `count()` - Count total records

### UserDAO
Extends BaseDAO with user-specific operations:
- `findByWalletAddress(address)` - Find user by wallet address
- `findByEmail(email)` - Find user by email
- `findActiveUsers()` - Find all active users
- `updateLastActivity(id)` - Update user's last activity
- `deactivateUser(id)` - Deactivate user account

### OfflineTokenDAO
Extends BaseDAO with token-specific operations:
- `findByUserId(userId, status?)` - Find tokens by user
- `findActiveTokensByUserId(userId)` - Find active tokens for user
- `findExpiredTokens()` - Find all expired tokens
- `markAsSpent(id)` - Mark token as spent
- `markAsRedeemed(id)` - Mark token as redeemed
- `markAsExpired(id)` - Mark token as expired
- `getUserTokenBalance(userId)` - Calculate user's token balance
- `getTokensByIds(tokenIds)` - Find tokens by IDs

### TransactionDAO
Extends BaseDAO with transaction-specific operations:
- `findByUserId(userId)` - Find transactions for user
- `findBySenderId(senderId)` - Find transactions by sender
- `findByReceiverId(receiverId)` - Find transactions by receiver
- `findByType(type)` - Find transactions by type
- `findByStatus(status)` - Find transactions by status
- `findByBlockchainTxHash(hash)` - Find transaction by blockchain hash
- `findPendingTransactions()` - Find all pending transactions
- `markAsCompleted(id, hash?)` - Mark transaction as completed
- `markAsFailed(id, error)` - Mark transaction as failed
- `getTransactionStats(userId?)` - Get transaction statistics

### AuditLogDAO
Extends BaseDAO with audit-specific operations (read-only):
- `findByUserId(userId)` - Find audit logs by user
- `findByAction(action)` - Find audit logs by action
- `findByResourceType(type)` - Find audit logs by resource type
- `findByResourceId(type, id)` - Find audit logs by resource
- `findByDateRange(start, end)` - Find audit logs by date range
- `logAction(data)` - Create new audit log entry

### PublicKeyDAO
Extends BaseDAO with public key operations:
- `findByTypeAndIdentifier(type, id)` - Find key by type and identifier
- `findByType(type)` - Find keys by type
- `findActiveKeys()` - Find all active keys
- `findExpiredKeys()` - Find expired keys
- `deactivateKey(id)` - Deactivate key
- `rotateKey(type, id, newKey)` - Rotate key
- `getOTMPublicKey()` - Get OTM public key

## Database Operations

### Migrations
Run database migrations:
```bash
npm run migrate
```

Rollback migrations:
```bash
npm run migrate:rollback
```

### Seeds
Run database seeds:
```bash
npm run seed
```

### Development Setup

1. Start PostgreSQL database:
```bash
docker compose up -d postgres
```

2. Run migrations:
```bash
npm run migrate
```

3. Run seeds (optional):
```bash
npm run seed
```

## Performance Optimizations

### Indexes
The schema includes strategic indexes for:
- Primary keys (automatic)
- Foreign keys
- Frequently queried columns
- Composite indexes for common query patterns

### Connection Pooling
Database connections are managed through Knex.js connection pooling:
- Development: 2-10 connections
- Test: 1-5 connections  
- Production: 5-20 connections

### Query Optimization
- Use of prepared statements through Knex.js
- Proper use of indexes for WHERE clauses
- Pagination support for large result sets
- Efficient JOIN operations where needed

## Security Considerations

### Data Protection
- Sensitive data encrypted at rest
- Connection strings secured through environment variables
- SSL connections in production
- Audit logging for all data modifications

### Access Control
- Database user with minimal required permissions
- Connection pooling to prevent connection exhaustion
- Input validation through TypeScript types
- SQL injection prevention through parameterized queries

## Testing

Run database structure tests:
```bash
npm run test -- --testPathPattern=dao-structure
```

Run full database tests (requires running PostgreSQL):
```bash
npm run test -- --testPathPattern=database
```

## Environment Configuration

Required environment variables:
- `DB_HOST` - Database host
- `DB_PORT` - Database port
- `DB_NAME` - Database name
- `DB_USER` - Database user
- `DB_PASSWORD` - Database password
- `DB_SSL` - Enable SSL connections

## Troubleshooting

### Common Issues

1. **Connection refused**: Ensure PostgreSQL is running
2. **Migration errors**: Check database permissions
3. **Type errors**: Ensure TypeScript types match database schema
4. **Performance issues**: Check query execution plans and indexes