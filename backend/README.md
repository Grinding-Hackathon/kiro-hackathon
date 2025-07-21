# Offline Blockchain Wallet Backend

Backend API server for the offline blockchain wallet system that enables secure cryptocurrency transactions in environments with limited internet connectivity.

## Features

- **RESTful API** for wallet operations
- **Ethereum Smart Contract** integration
- **Offline Token Manager (OTM)** for token issuance and redemption
- **JWT Authentication** with rate limiting
- **PostgreSQL Database** with migration support
- **Comprehensive Logging** and monitoring
- **Docker Support** for containerized deployment
- **TypeScript** for type safety
- **Jest Testing** framework

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL
- **Blockchain**: Ethereum (Web3/Ethers.js)
- **Authentication**: JWT
- **Testing**: Jest
- **Containerization**: Docker

## Project Structure

```
backend/
├── src/
│   ├── config/          # Configuration files
│   ├── controllers/     # Route controllers
│   ├── services/        # Business logic services
│   ├── models/          # Data models
│   ├── middleware/      # Express middleware
│   ├── utils/           # Utility functions
│   ├── types/           # TypeScript type definitions
│   └── test/            # Test setup and utilities
├── database/            # Database migrations and seeds
├── logs/                # Application logs
├── docker-compose.yml   # Docker composition
├── Dockerfile          # Docker image definition
└── package.json        # Dependencies and scripts
```

## Getting Started

### Prerequisites

- Node.js 18 or higher
- PostgreSQL 12 or higher
- Docker (optional)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Set up database**
   ```bash
   # Create database
   createdb offline_wallet_db
   
   # Run migrations
   npm run migrate
   ```

### Development

1. **Start development server**
   ```bash
   npm run dev
   ```

2. **Run tests**
   ```bash
   npm test
   npm run test:watch
   npm run test:coverage
   ```

3. **Lint code**
   ```bash
   npm run lint
   npm run lint:fix
   ```

### Docker Deployment

1. **Using Docker Compose**
   ```bash
   docker-compose up -d
   ```

2. **Build and run manually**
   ```bash
   docker build -t offline-wallet-backend .
   docker run -p 3000:3000 offline-wallet-backend
   ```

## API Endpoints

### Health Check
- `GET /health` - Server health status

### Authentication
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/register` - User registration

### Wallet Operations
- `GET /api/v1/wallet/balance` - Get wallet balance
- `POST /api/v1/tokens/purchase` - Purchase offline tokens
- `POST /api/v1/tokens/redeem` - Redeem offline tokens

### Public Keys
- `GET /api/v1/keys/public` - Get OTM public key

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment (development/production) | development |
| `PORT` | Server port | 3000 |
| `DB_HOST` | Database host | localhost |
| `DB_PORT` | Database port | 5432 |
| `DB_NAME` | Database name | offline_wallet_db |
| `DB_USER` | Database user | postgres |
| `DB_PASSWORD` | Database password | - |
| `ETHEREUM_RPC_URL` | Ethereum RPC endpoint | - |
| `JWT_SECRET` | JWT signing secret | - |
| `OTM_PRIVATE_KEY` | OTM private key | - |
| `OTM_PUBLIC_KEY` | OTM public key | - |

## Testing

The project uses Jest for testing with the following test types:

- **Unit Tests**: Individual function and service testing
- **Integration Tests**: API endpoint testing
- **Security Tests**: Authentication and authorization testing

Run tests with:
```bash
npm test                 # Run all tests
npm run test:watch      # Watch mode
npm run test:coverage   # Coverage report
```

## Security

- **Rate Limiting**: Prevents abuse and DoS attacks
- **JWT Authentication**: Secure token-based authentication
- **Input Validation**: Request validation and sanitization
- **CORS Protection**: Cross-origin request security
- **Helmet**: Security headers middleware
- **Audit Logging**: Comprehensive security event logging

## Monitoring

- **Winston Logging**: Structured logging with multiple transports
- **Health Checks**: Docker health check endpoint
- **Error Tracking**: Comprehensive error logging and handling

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

## License

MIT License - see LICENSE file for details