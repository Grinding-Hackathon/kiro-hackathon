# Backend Testing Suite

This directory contains comprehensive tests for the Offline Blockchain Wallet backend services. The testing suite is designed to ensure reliability, security, and performance of all system components.

## Test Structure

```
src/test/
├── controllers/          # API controller tests
├── database/            # Database and DAO tests
├── e2e/                # End-to-end workflow tests
├── integration/        # Integration tests
├── middleware/         # Middleware component tests
├── performance/        # Load and performance tests
├── services/           # Business logic service tests
├── setup.ts           # Test environment setup
└── README.md          # This file
```

## Test Categories

### 1. Unit Tests
- **Location**: `controllers/`, `services/`, `middleware/`, `database/`
- **Purpose**: Test individual components in isolation
- **Coverage**: All service methods, utilities, and business logic
- **Run Command**: `npm run test:unit`

### 2. Integration Tests
- **Location**: `integration/`
- **Purpose**: Test component interactions and API endpoints
- **Coverage**: Complete token lifecycle, database operations
- **Run Command**: `npm run test:integration`

### 3. End-to-End Tests
- **Location**: `e2e/`
- **Purpose**: Test complete user workflows
- **Coverage**: Full application scenarios from user perspective
- **Run Command**: `npm run test:e2e`

### 4. Performance Tests
- **Location**: `performance/`
- **Purpose**: Test system performance under load
- **Coverage**: High-frequency requests, concurrent operations, memory usage
- **Run Command**: `npm run test:performance`

## Test Coverage

### Services Tested
- ✅ **OfflineTokenManager**: Token issuance, validation, redemption
- ✅ **BlockchainService**: Web3 integration, smart contract interaction
- ✅ **BackupService**: Database backup and restoration
- ✅ **FraudDetectionService**: Transaction analysis and risk scoring
- ✅ **HealthMonitoringService**: System health checks and monitoring

### Middleware Tested
- ✅ **Authentication**: JWT token validation and user authentication
- ✅ **Error Handler**: Error processing and response formatting
- ✅ **Rate Limiter**: Request throttling and abuse prevention

### Controllers Tested
- ✅ **AuthController**: User authentication endpoints
- ✅ **WalletController**: Wallet operations and token management
- ✅ **SecurityController**: Security-related endpoints

### Database Tested
- ✅ **All DAOs**: CRUD operations and data integrity
- ✅ **Migrations**: Database schema management
- ✅ **Connection**: Database connectivity and pooling

## Running Tests

### All Tests
```bash
npm test
```

### Specific Test Categories
```bash
# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# End-to-end tests
npm run test:e2e

# Performance tests
npm run test:performance

# Specific component tests
npm run test:services
npm run test:middleware
npm run test:controllers
npm run test:database
```

### With Coverage
```bash
npm run test:coverage
```

### Watch Mode
```bash
npm run test:watch
```

### CI Mode
```bash
npm run test:ci
```

## Test Configuration

### Jest Configuration
- **Main Config**: `jest.config.js`
- **Integration Config**: `jest.config.integration.js`
- **Setup File**: `src/test/setup.ts`

### Environment Variables
Tests use environment-specific configurations:
- `NODE_ENV=test`
- `DATABASE_URL` for test database
- Mock configurations for external services

### Database Setup
- Tests use a separate test database
- Migrations run before test suites
- Database is cleaned between test runs
- Transactions are rolled back after tests

## Mocking Strategy

### External Services
- **Blockchain Service**: Mocked Web3 interactions
- **Database**: Real database with test data
- **File System**: Mocked for backup operations
- **Network Requests**: Mocked HTTP calls

### Mock Patterns
```typescript
// Service mocking
jest.mock('../../services/blockchainService');
const mockBlockchainService = blockchainService as jest.Mocked<typeof blockchainService>;

// DAO mocking
jest.mock('../../database/dao/UserDAO');
const mockUserDAO = UserDAO as jest.MockedClass<typeof UserDAO>;
```

## Performance Benchmarks

### Response Time Targets
- **Balance Queries**: < 100ms average
- **Token Purchase**: < 500ms average
- **Token Redemption**: < 1000ms average
- **Batch Operations**: < 2000ms for 20 tokens

### Throughput Targets
- **API Requests**: > 100 requests/second
- **Token Operations**: > 10 operations/second
- **Database Queries**: > 1000 queries/second

### Memory Usage
- **Per Request**: < 1MB memory increase
- **Sustained Load**: < 50% memory growth over time
- **Garbage Collection**: Efficient cleanup

## Security Testing

### Input Validation
- SQL injection prevention
- XSS attack prevention
- Parameter tampering protection
- Rate limiting enforcement

### Authentication Testing
- JWT token validation
- Authorization checks
- Session management
- Token expiration handling

### Data Protection
- Sensitive data encryption
- Secure key storage
- Audit trail integrity
- Privacy compliance

## Continuous Integration

### GitHub Actions Workflow
- **File**: `.github/workflows/ci.yml`
- **Triggers**: Push to main/develop, Pull requests
- **Stages**: Test → Security → Deploy

### Test Pipeline
1. **Setup**: Install dependencies, setup database
2. **Lint**: Code quality checks
3. **Unit Tests**: Component testing
4. **Integration Tests**: API testing
5. **E2E Tests**: Workflow testing
6. **Performance Tests**: Load testing
7. **Security Audit**: Vulnerability scanning
8. **Coverage Report**: Test coverage analysis

### Quality Gates
- **Test Coverage**: > 80%
- **Performance**: All benchmarks met
- **Security**: No high/critical vulnerabilities
- **Linting**: No errors or warnings

## Test Data Management

### Test Users
```typescript
const testUsers = [
  {
    id: 'alice-123',
    walletAddress: '0x742d35Cc6634C0532925a3b8D4C0C8b3C2e1e1e1',
    publicKey: '0x04' + 'a'.repeat(128),
  },
  {
    id: 'bob-456',
    walletAddress: '0x853e46Dd7645D1542936a4b8E5D1C9C9D3f2f2f2',
    publicKey: '0x04' + 'b'.repeat(128),
  },
];
```

### Mock Data Patterns
- **Deterministic**: Consistent test results
- **Realistic**: Representative of production data
- **Isolated**: No cross-test contamination
- **Cleanup**: Automatic data cleanup

## Debugging Tests

### Common Issues
1. **Database Connection**: Ensure test database is running
2. **Async Operations**: Use proper async/await patterns
3. **Mock Cleanup**: Clear mocks between tests
4. **Memory Leaks**: Check for unclosed connections

### Debug Commands
```bash
# Run specific test file
npm test -- src/test/services/offlineTokenManager.test.ts

# Run with verbose output
npm test -- --verbose

# Run with debug logging
DEBUG=* npm test

# Run single test
npm test -- --testNamePattern="should issue tokens successfully"
```

### Test Utilities
- **Database Helpers**: Setup and cleanup utilities
- **Mock Factories**: Consistent mock data generation
- **Assertion Helpers**: Custom matchers for complex objects
- **Time Helpers**: Date/time manipulation for tests

## Contributing to Tests

### Writing New Tests
1. Follow existing test structure and naming conventions
2. Include both positive and negative test cases
3. Mock external dependencies appropriately
4. Add performance assertions for critical paths
5. Document complex test scenarios

### Test Naming Convention
```typescript
describe('ServiceName', () => {
  describe('methodName', () => {
    it('should perform expected behavior when condition', () => {
      // Test implementation
    });
    
    it('should handle error when invalid input', () => {
      // Error handling test
    });
  });
});
```

### Best Practices
- **Isolation**: Each test should be independent
- **Clarity**: Test names should describe expected behavior
- **Coverage**: Test both success and failure scenarios
- **Performance**: Include timing assertions for critical operations
- **Maintenance**: Keep tests simple and maintainable

## Monitoring and Reporting

### Coverage Reports
- **HTML Report**: `coverage/index.html`
- **LCOV Report**: `coverage/lcov.info`
- **Console Output**: Summary during test runs

### Performance Reports
- **Response Times**: Average, min, max for each endpoint
- **Throughput**: Requests per second under load
- **Memory Usage**: Heap usage patterns
- **Database Performance**: Query execution times

### CI/CD Integration
- **Codecov**: Automated coverage reporting
- **GitHub Actions**: Automated test execution
- **Quality Gates**: Prevent deployment of failing tests
- **Notifications**: Alert on test failures

## Troubleshooting

### Common Test Failures
1. **Database Connection**: Check PostgreSQL service
2. **Port Conflicts**: Ensure test ports are available
3. **Memory Issues**: Increase Node.js memory limit
4. **Timeout Issues**: Adjust test timeout values

### Performance Issues
1. **Slow Tests**: Profile and optimize database queries
2. **Memory Leaks**: Check for unclosed connections
3. **Flaky Tests**: Add proper wait conditions
4. **Resource Cleanup**: Ensure proper test teardown

### Getting Help
- Check existing test patterns for similar scenarios
- Review error logs for specific failure details
- Consult team documentation for project-specific guidelines
- Use debugging tools to trace test execution