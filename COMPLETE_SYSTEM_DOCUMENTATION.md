# Offline Blockchain Wallet - Complete System Documentation

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Backend Documentation](#backend-documentation)
3. [Mobile (iOS) Documentation](#mobile-ios-documentation)
4. [Deployment Guide](#deployment-guide)
5. [API Reference](#api-reference)
6. [Security Guide](#security-guide)
7. [Troubleshooting](#troubleshooting)
8. [Development Workflow](#development-workflow)

---

## 🎯 System Overview

### Architecture

The Offline Blockchain Wallet is a distributed system consisting of:

- **Backend API**: Node.js/TypeScript REST API with PostgreSQL database
- **iOS Mobile App**: SwiftUI-based mobile application
- **Blockchain Integration**: Ethereum smart contracts for token management
- **Offline Capabilities**: Peer-to-peer transactions via Bluetooth and QR codes

### Key Features

- 🔐 **Secure Authentication**: JWT-based authentication with multi-factor support
- 💰 **Token Management**: Purchase, store, and redeem blockchain tokens
- 📱 **Offline Transactions**: Bluetooth and QR code-based peer-to-peer transfers
- 🔄 **Synchronization**: Automatic sync when network connectivity is restored
- 🛡️ **Security**: End-to-end encryption, digital signatures, fraud detection
- 📊 **Monitoring**: Real-time health monitoring and alerting

### Technology Stack

**Backend:**
- Node.js 18+ with TypeScript
- Express.js framework
- PostgreSQL database
- Redis for caching
- Web3.js for blockchain integration
- Jest for testing

**Mobile:**
- iOS 15+ with SwiftUI
- Core Data for local storage
- CryptoKit for cryptography
- Bluetooth LE for peer-to-peer communication
- AVFoundation for QR code scanning

**Infrastructure:**
- Docker containers
- Nginx reverse proxy
- SSL/TLS encryption
- Prometheus monitoring
- Grafana dashboards

---

## 🖥️ Backend Documentation

### Quick Start

```bash
# Clone and setup
cd backend
npm install

# Setup environment
cp .env.example .env
# Edit .env with your configuration

# Setup database
npm run db:migrate
npm run db:seed

# Start development server
npm run dev
```

### Project Structure

```
backend/
├── src/
│   ├── controllers/          # API route handlers
│   ├── services/            # Business logic
│   ├── database/            # Database layer
│   ├── middleware/          # Express middleware
│   ├── routes/              # API routes
│   ├── models/              # Data models
│   ├── utils/               # Utility functions
│   └── config/              # Configuration
├── contracts/               # Smart contracts
├── infrastructure/          # Docker, configs
├── scripts/                 # Deployment scripts
└── test/                    # Test files
```

### Core Services

#### Authentication Service
- JWT token generation and validation
- Multi-factor authentication support
- Session management
- Password security (bcrypt hashing)

#### Wallet Service
- User wallet creation and management
- Balance tracking
- Transaction history
- Multi-signature support

#### Token Service
- Offline token generation
- Token validation and verification
- Token division for change-making
- Expiration handling

#### Blockchain Service
- Smart contract interaction
- Transaction broadcasting
- Balance synchronization
- Gas fee estimation

#### Security Service
- Fraud detection algorithms
- Audit logging
- Rate limiting
- Input validation

### Database Schema

#### Users Table
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    public_key TEXT,
    wallet_address VARCHAR(42),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Offline Tokens Table
```sql
CREATE TABLE offline_tokens (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    amount DECIMAL(18,8) NOT NULL,
    signature TEXT NOT NULL,
    is_spent BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### Transactions Table
```sql
CREATE TABLE transactions (
    id UUID PRIMARY KEY,
    sender_id UUID REFERENCES users(id),
    receiver_id UUID REFERENCES users(id),
    amount DECIMAL(18,8) NOT NULL,
    type VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    blockchain_hash VARCHAR(66),
    created_at TIMESTAMP DEFAULT NOW()
);
```

### API Endpoints

#### Authentication
```
POST /api/auth/register     # User registration
POST /api/auth/login        # User login
POST /api/auth/logout       # User logout
POST /api/auth/refresh      # Refresh JWT token
```

#### Wallet Management
```
GET  /api/wallet/balance    # Get wallet balance
POST /api/wallet/purchase   # Purchase tokens
POST /api/wallet/redeem     # Redeem tokens
GET  /api/wallet/history    # Transaction history
```

#### Offline Tokens
```
POST /api/tokens/generate   # Generate offline tokens
POST /api/tokens/validate   # Validate token
POST /api/tokens/divide     # Divide token for change
POST /api/tokens/sync       # Sync offline transactions
```

### Configuration

#### Environment Variables
```bash
# Server
PORT=3000
NODE_ENV=production

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=wallet_db
DB_USER=wallet_user
DB_PASSWORD=secure_password

# JWT
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=24h

# Blockchain
ETH_RPC_URL=https://mainnet.infura.io/v3/your_key
CONTRACT_ADDRESS=0x...
PRIVATE_KEY=0x...

# Redis
REDIS_URL=redis://localhost:6379

# Security
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100
```

### Testing

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:security

# Run with coverage
npm run test:coverage

# Run load tests
npm run test:load
```

### Monitoring

#### Health Checks
- `/health` - Basic health status
- `/health/detailed` - Detailed system status
- `/metrics` - Prometheus metrics

#### Logging
- Structured JSON logging
- Log levels: error, warn, info, debug
- Audit trail for security events
- Performance metrics

---

## 📱 Mobile (iOS) Documentation

### Quick Start

```bash
# Setup Xcode project
cd ios/offline-blockchain-wallet-ios
./configure_project.sh

# Install dependencies
swift package resolve

# Open in Xcode
open offline-blockchain-wallet-ios.xcodeproj
```

### Project Structure

```
ios/offline-blockchain-wallet-ios/
├── offline-blockchain-wallet-ios/
│   ├── Views/               # SwiftUI views
│   ├── ViewModels/          # MVVM view models
│   ├── Services/            # Business logic services
│   ├── Models/              # Data models
│   ├── Utils/               # Utility classes
│   └── Configuration/       # App configuration
├── Tests/                   # Unit tests
├── Scripts/                 # Build scripts
└── Package.swift            # Dependencies
```

### Core Services

#### Network Service
- API communication with backend
- Request/response handling
- Network connectivity monitoring
- Offline queue management

#### Cryptography Service
- Key pair generation (secp256k1)
- Digital signature creation/verification
- Hash functions (SHA-256)
- Secure random number generation

#### Storage Service
- Core Data integration
- Keychain storage for sensitive data
- Local transaction caching
- Data synchronization

#### Bluetooth Service
- Bluetooth LE advertising
- Device discovery and pairing
- Secure data transmission
- Connection management

#### QR Code Service
- QR code generation
- QR code scanning
- Data encoding/decoding
- Error correction

#### Offline Token Service
- Token validation
- Token division for payments
- Balance calculations
- Expiration handling

### Key Features Implementation

#### Offline Transactions

```swift
// Generate payment QR code
let paymentRequest = QRCodePaymentRequest(
    type: .payment,
    walletId: currentWallet.id,
    amount: paymentAmount,
    timestamp: Date()
)

let qrCode = try qrCodeService.generateQRCode(for: paymentRequest)
```

#### Bluetooth Communication

```swift
// Start advertising wallet
try bluetoothService.startAdvertising(walletInfo: WalletInfo(
    walletId: wallet.id,
    publicKey: wallet.publicKey
))

// Handle incoming connection
func handleIncomingConnection(_ connection: BluetoothConnection) {
    // Verify peer identity
    // Exchange transaction data
    // Process offline payment
}
```

#### Token Management

```swift
// Validate offline token
let isValid = offlineTokenService.validateToken(token)

// Divide token for payment
let divisionResult = try offlineTokenService.divideToken(
    token,
    amount: paymentAmount
)
```

### User Interface

#### Main Wallet View
- Balance display
- Recent transactions
- Quick actions (send, receive, purchase)
- Offline status indicator

#### Transaction View
- Transaction creation
- QR code display/scanning
- Bluetooth device selection
- Transaction confirmation

#### Settings View
- Account management
- Security settings
- Network configuration
- Backup/restore options

### Data Models

#### Wallet Model
```swift
struct Wallet: Codable {
    let id: String
    let publicKey: String
    let address: String
    var balance: Double
    let createdAt: Date
}
```

#### Transaction Model
```swift
struct Transaction: Codable {
    let id: String
    let senderId: String
    let receiverId: String
    let amount: Double
    let type: TransactionType
    var status: TransactionStatus
    let timestamp: Date
}
```

#### Offline Token Model
```swift
struct OfflineToken: Codable {
    let id: String
    let amount: Double
    let signature: String
    let expiresAt: Date
    var isSpent: Bool
}
```

### Security Implementation

#### Key Management
- Secure Enclave integration
- Keychain storage for private keys
- Biometric authentication
- Key rotation support

#### Transaction Security
- Digital signature verification
- Double-spending prevention
- Replay attack protection
- Secure communication channels

### Testing

```bash
# Run unit tests
swift test

# Run specific test
swift test --filter CryptographyServiceTests

# Run standalone tests
swift test_crypto_standalone.swift
swift test_offline_token_service.swift
swift test_transaction_service.swift
```

### Build Configuration

#### Debug Configuration
```swift
// Debug.xcconfig
API_BASE_URL = https://dev-api.wallet.com
LOG_LEVEL = DEBUG
ENABLE_MOCK_SERVICES = YES
```

#### Release Configuration
```swift
// Release.xcconfig
API_BASE_URL = https://api.wallet.com
LOG_LEVEL = ERROR
ENABLE_MOCK_SERVICES = NO
```

---

## 🚀 Deployment Guide

### Prerequisites

- Docker and Docker Compose
- PostgreSQL 13+
- Redis 6+
- SSL certificates
- Domain name
- Ethereum node access

### Backend Deployment

#### 1. Environment Setup

```bash
# Create production environment file
cp backend/.env.example backend/.env.production

# Edit with production values
vim backend/.env.production
```

#### 2. Database Setup

```bash
# Start PostgreSQL
docker-compose -f backend/infrastructure/docker-compose.prod.yml up -d postgres

# Run migrations
cd backend
npm run db:migrate:prod
```

#### 3. SSL Certificate Setup

```bash
# Generate SSL certificates (Let's Encrypt)
cd backend
./scripts/setup-ssl.sh your-domain.com
```

#### 4. Deploy Backend Services

```bash
# Build and deploy
cd backend
./scripts/deploy-production.sh

# Verify deployment
curl https://your-domain.com/health
```

#### 5. Smart Contract Deployment

```bash
# Deploy to mainnet
cd backend
npm run deploy:mainnet

# Verify contract
npm run verify:contract
```

### Mobile App Deployment

#### 1. App Store Preparation

```bash
# Update version and build number
cd ios/offline-blockchain-wallet-ios
./scripts/update-version.sh 1.0.0

# Configure release settings
vim offline-blockchain-wallet-ios/Configuration/Release.xcconfig
```

#### 2. Build for Release

```bash
# Clean and build
./scripts/build.sh --release

# Run tests
swift test

# Archive for App Store
xcodebuild archive -scheme offline-blockchain-wallet-ios \\
  -archivePath build/offline-blockchain-wallet-ios.xcarchive
```

#### 3. App Store Submission

```bash
# Export for App Store
xcodebuild -exportArchive \\
  -archivePath build/offline-blockchain-wallet-ios.xcarchive \\
  -exportPath build/AppStore \\
  -exportOptionsPlist ExportOptions.plist

# Upload to App Store Connect
xcrun altool --upload-app \\
  -f build/AppStore/offline-blockchain-wallet-ios.ipa \\
  -u your-apple-id@example.com
```

### Infrastructure Setup

#### Docker Compose Configuration

```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  app:
    build: .
    ports:
      - \"3000:3000\"
    environment:
      - NODE_ENV=production
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:13
    environment:
      POSTGRES_DB: wallet_db
      POSTGRES_USER: wallet_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:6-alpine
    volumes:
      - redis_data:/data

  nginx:
    image: nginx:alpine
    ports:
      - \"80:80\"
      - \"443:443\"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/ssl
```

#### Nginx Configuration

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/ssl/cert.pem;
    ssl_certificate_key /etc/ssl/key.pem;

    location / {
        proxy_pass http://app:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /health {
        proxy_pass http://app:3000/health;
        access_log off;
    }
}
```

### Monitoring Setup

#### Prometheus Configuration

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'wallet-api'
    static_configs:
      - targets: ['app:3000']
    metrics_path: '/metrics'
```

#### Grafana Dashboard

```json
{
  \"dashboard\": {
    \"title\": \"Wallet API Monitoring\",
    \"panels\": [
      {
        \"title\": \"Request Rate\",
        \"type\": \"graph\",
        \"targets\": [
          {
            \"expr\": \"rate(http_requests_total[5m])\"
          }
        ]
      },
      {
        \"title\": \"Response Time\",
        \"type\": \"graph\",
        \"targets\": [
          {
            \"expr\": \"histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))\"
          }
        ]
      }
    ]
  }
}
```

### Security Hardening

#### 1. Firewall Configuration

```bash
# Allow only necessary ports
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
ufw enable
```

#### 2. Database Security

```bash
# Configure PostgreSQL security
vim /etc/postgresql/13/main/pg_hba.conf

# Restrict connections
host    wallet_db    wallet_user    127.0.0.1/32    md5
```

#### 3. SSL/TLS Configuration

```bash
# Generate strong SSL configuration
openssl dhparam -out /etc/ssl/dhparam.pem 2048

# Configure nginx SSL
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
ssl_prefer_server_ciphers off;
ssl_dhparam /etc/ssl/dhparam.pem;
```

### Backup and Recovery

#### Database Backup

```bash
# Automated backup script
#!/bin/bash
BACKUP_DIR=\"/backups/postgres\"
DATE=$(date +%Y%m%d_%H%M%S)

pg_dump -h localhost -U wallet_user wallet_db > \\
  \"$BACKUP_DIR/wallet_db_$DATE.sql\"

# Compress and encrypt
gzip \"$BACKUP_DIR/wallet_db_$DATE.sql\"
gpg --encrypt --recipient backup@company.com \\
  \"$BACKUP_DIR/wallet_db_$DATE.sql.gz\"
```

#### Recovery Process

```bash
# Restore from backup
gpg --decrypt backup_file.sql.gz.gpg | gunzip | \\
  psql -h localhost -U wallet_user wallet_db
```

### Deployment Checklist

#### Pre-Deployment
- [ ] All tests passing
- [ ] Security audit completed
- [ ] Performance testing done
- [ ] Backup procedures tested
- [ ] SSL certificates valid
- [ ] Environment variables configured
- [ ] Database migrations ready

#### Deployment
- [ ] Deploy backend services
- [ ] Run database migrations
- [ ] Deploy smart contracts
- [ ] Configure monitoring
- [ ] Test all endpoints
- [ ] Verify SSL configuration
- [ ] Check logs for errors

#### Post-Deployment
- [ ] Monitor system metrics
- [ ] Verify backup procedures
- [ ] Test disaster recovery
- [ ] Update documentation
- [ ] Notify stakeholders

---

## 📚 API Reference

### Authentication Endpoints

#### POST /api/auth/register
Register a new user account.

**Request:**
```json
{
  \"username\": \"john_doe\",
  \"email\": \"john@example.com\",
  \"password\": \"secure_password123\"
}
```

**Response:**
```json
{
  \"success\": true,
  \"data\": {
    \"userId\": \"uuid-here\",
    \"token\": \"jwt-token-here\",
    \"expiresIn\": \"24h\"
  }
}
```

#### POST /api/auth/login
Authenticate user and get access token.

**Request:**
```json
{
  \"email\": \"john@example.com\",
  \"password\": \"secure_password123\"
}
```

**Response:**
```json
{
  \"success\": true,
  \"data\": {
    \"token\": \"jwt-token-here\",
    \"refreshToken\": \"refresh-token-here\",
    \"expiresIn\": \"24h\",
    \"user\": {
      \"id\": \"uuid-here\",
      \"username\": \"john_doe\",
      \"email\": \"john@example.com\"
    }
  }
}
```

### Wallet Endpoints

#### GET /api/wallet/balance
Get current wallet balance.

**Headers:**
```
Authorization: Bearer jwt-token-here
```

**Response:**
```json
{
  \"success\": true,
  \"data\": {
    \"balance\": 150.75,
    \"offlineBalance\": 25.50,
    \"pendingBalance\": 10.00,
    \"currency\": \"ETH\"
  }
}
```

#### POST /api/wallet/purchase
Purchase tokens for offline use.

**Request:**
```json
{
  \"amount\": 100.00,
  \"paymentMethod\": \"ethereum\",
  \"transactionHash\": \"0x...\"
}
```

**Response:**
```json
{
  \"success\": true,
  \"data\": {
    \"tokens\": [
      {
        \"id\": \"token-uuid-1\",
        \"amount\": 50.00,
        \"signature\": \"signature-here\",
        \"expiresAt\": \"2024-02-01T00:00:00Z\"
      },
      {
        \"id\": \"token-uuid-2\",
        \"amount\": 50.00,
        \"signature\": \"signature-here\",
        \"expiresAt\": \"2024-02-01T00:00:00Z\"
      }
    ],
    \"transactionId\": \"transaction-uuid\"
  }
}
```

### Token Endpoints

#### POST /api/tokens/validate
Validate an offline token.

**Request:**
```json
{
  \"tokenId\": \"token-uuid\",
  \"signature\": \"signature-here\"
}
```

**Response:**
```json
{
  \"success\": true,
  \"data\": {
    \"valid\": true,
    \"amount\": 50.00,
    \"expiresAt\": \"2024-02-01T00:00:00Z\",
    \"isSpent\": false
  }
}
```

#### POST /api/tokens/divide
Divide a token for making change.

**Request:**
```json
{
  \"tokenId\": \"token-uuid\",
  \"paymentAmount\": 30.00
}
```

**Response:**
```json
{
  \"success\": true,
  \"data\": {
    \"paymentToken\": {
      \"id\": \"payment-token-uuid\",
      \"amount\": 30.00,
      \"signature\": \"payment-signature\"
    },
    \"changeToken\": {
      \"id\": \"change-token-uuid\",
      \"amount\": 20.00,
      \"signature\": \"change-signature\"
    }
  }
}
```

### Error Responses

All endpoints return errors in this format:

```json
{
  \"success\": false,
  \"error\": {
    \"code\": \"INVALID_TOKEN\",
    \"message\": \"The provided token is invalid or expired\",
    \"details\": {
      \"tokenId\": \"token-uuid\",
      \"reason\": \"expired\"
    }
  }
}
```

### Rate Limiting

All endpoints are rate limited:
- **Default**: 100 requests per 15 minutes per IP
- **Authentication**: 5 requests per 15 minutes per IP
- **Token operations**: 50 requests per 15 minutes per user

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

---

## 🔒 Security Guide

### Authentication Security

#### JWT Token Security
- Tokens expire after 24 hours
- Refresh tokens for seamless renewal
- Secure token storage in mobile app
- Token blacklisting on logout

#### Password Security
- bcrypt hashing with salt rounds: 12
- Minimum password requirements
- Password history prevention
- Account lockout after failed attempts

### Cryptographic Security

#### Key Management
- secp256k1 elliptic curve cryptography
- Secure random number generation
- Private key storage in Secure Enclave (iOS)
- Key rotation capabilities

#### Digital Signatures
- ECDSA signatures for all transactions
- Message authentication codes (MAC)
- Timestamp-based replay protection
- Signature verification on all operations

### Network Security

#### HTTPS/TLS
- TLS 1.2+ only
- Perfect Forward Secrecy
- HSTS headers
- Certificate pinning in mobile app

#### API Security
- Input validation and sanitization
- SQL injection prevention
- XSS protection
- CSRF tokens

### Blockchain Security

#### Smart Contract Security
- Reentrancy protection
- Integer overflow/underflow checks
- Access control modifiers
- Emergency pause functionality

#### Transaction Security
- Double-spending prevention
- Transaction replay protection
- Gas limit optimization
- Multi-signature requirements

### Mobile Security

#### Data Protection
- Core Data encryption
- Keychain storage for sensitive data
- App Transport Security (ATS)
- Jailbreak detection

#### Biometric Authentication
- Touch ID / Face ID integration
- Fallback to passcode
- Biometric template protection
- Authentication timeout

### Monitoring and Alerting

#### Security Monitoring
- Failed authentication attempts
- Suspicious transaction patterns
- Rate limit violations
- Unusual API usage

#### Incident Response
- Automated alert notifications
- Security event logging
- Forensic data collection
- Emergency response procedures

---

## 🔧 Troubleshooting

### Common Backend Issues

#### Database Connection Issues
```bash
# Check database status
sudo systemctl status postgresql

# Test connection
psql -h localhost -U wallet_user -d wallet_db

# Check logs
tail -f /var/log/postgresql/postgresql-13-main.log
```

#### JWT Token Issues
```bash
# Verify JWT secret is set
echo $JWT_SECRET

# Check token expiration
node -e \"console.log(require('jsonwebtoken').decode('your-token-here'))\"
```

#### Blockchain Connection Issues
```bash
# Test Ethereum RPC connection
curl -X POST -H \"Content-Type: application/json\" \\
  --data '{\"jsonrpc\":\"2.0\",\"method\":\"eth_blockNumber\",\"params\":[],\"id\":1}' \\
  $ETH_RPC_URL
```

### Common Mobile Issues

#### Build Issues
```bash
# Clean build folder
rm -rf ios/offline-blockchain-wallet-ios/.build

# Reset package dependencies
swift package reset
swift package resolve

# Fix signing issues
./scripts/fix_build_issues.sh
```

#### Bluetooth Issues
```swift
// Check Bluetooth permissions
if CBCentralManager.authorization != .allowedAlways {
    // Request permissions
}

// Reset Bluetooth state
bluetoothService.reset()
```

#### Keychain Issues
```swift
// Clear keychain data
let keychain = Keychain(service: \"com.wallet.app\")
try keychain.removeAll()

// Check keychain accessibility
let accessibility = keychain.accessibility
```

### Performance Issues

#### High Memory Usage
```bash
# Monitor memory usage
top -p $(pgrep node)

# Check for memory leaks
node --inspect app.js
# Open chrome://inspect in Chrome
```

#### Slow Database Queries
```sql
-- Enable query logging
SET log_statement = 'all';
SET log_min_duration_statement = 1000;

-- Analyze slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC;
```

#### High CPU Usage
```bash
# Profile Node.js application
node --prof app.js
node --prof-process isolate-*.log > processed.txt
```

### Network Issues

#### SSL Certificate Problems
```bash
# Check certificate validity
openssl x509 -in cert.pem -text -noout

# Test SSL connection
openssl s_client -connect your-domain.com:443
```

#### DNS Issues
```bash
# Test DNS resolution
nslookup your-domain.com
dig your-domain.com

# Check DNS propagation
dig @8.8.8.8 your-domain.com
```

### Deployment Issues

#### Docker Container Issues
```bash
# Check container logs
docker logs container-name

# Debug container
docker exec -it container-name /bin/bash

# Check resource usage
docker stats
```

#### Load Balancer Issues
```bash
# Check nginx status
sudo systemctl status nginx

# Test upstream servers
curl -H \"Host: your-domain.com\" http://backend-server:3000/health

# Check nginx logs
tail -f /var/log/nginx/error.log
```

---

## 🔄 Development Workflow

### Git Workflow

#### Branch Strategy
```bash
# Main branches
main          # Production-ready code
develop       # Integration branch
feature/*     # Feature development
hotfix/*      # Production fixes
release/*     # Release preparation
```

#### Feature Development
```bash
# Create feature branch
git checkout -b feature/new-payment-method

# Make changes and commit
git add .
git commit -m \"feat: add new payment method support\"

# Push and create PR
git push origin feature/new-payment-method
```

### Code Quality

#### Backend Linting
```bash
# ESLint configuration
npm run lint
npm run lint:fix

# Prettier formatting
npm run format
```

#### Mobile Code Quality
```bash
# SwiftLint
swiftlint
swiftlint --fix

# Swift format
swift-format format --recursive .
```

### Testing Strategy

#### Test Pyramid
1. **Unit Tests** (70%): Individual functions/methods
2. **Integration Tests** (20%): Component interactions
3. **E2E Tests** (10%): Full user workflows

#### Continuous Integration
```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
      - run: npm run test:security
```

### Release Process

#### Backend Release
```bash
# Version bump
npm version patch  # or minor, major

# Build and test
npm run build
npm test

# Deploy to staging
./scripts/deploy-staging.sh

# Deploy to production
./scripts/deploy-production.sh
```

#### Mobile Release
```bash
# Update version
./scripts/update-version.sh 1.0.1

# Build and test
./scripts/build.sh --release
swift test

# Submit to App Store
./scripts/submit-appstore.sh
```

### Documentation

#### API Documentation
- Swagger/OpenAPI specifications
- Postman collections
- Code examples
- Integration guides

#### Code Documentation
- JSDoc for JavaScript/TypeScript
- Swift documentation comments
- README files for each module
- Architecture decision records (ADRs)

---

## 📞 Support and Maintenance

### Monitoring and Alerts

#### System Metrics
- CPU and memory usage
- Database performance
- API response times
- Error rates

#### Business Metrics
- Transaction volume
- User activity
- Token utilization
- Revenue tracking

### Backup and Recovery

#### Automated Backups
- Daily database backups
- Configuration backups
- Log file archival
- Disaster recovery testing

#### Recovery Procedures
- Database restoration
- Service recovery
- Data integrity verification
- Business continuity planning

### Security Maintenance

#### Regular Security Tasks
- Dependency updates
- Security patch management
- Vulnerability scanning
- Penetration testing

#### Incident Response
- Security incident procedures
- Communication protocols
- Forensic analysis
- Post-incident reviews

---

*This documentation is maintained by the development team and updated with each release. For questions or contributions, please contact the development team.*
"