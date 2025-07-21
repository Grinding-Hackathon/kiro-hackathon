import { config } from '@/config/config';

// Set test environment
process.env.NODE_ENV = 'test';

// Mock logger to prevent console output during tests
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    http: jest.fn(),
  },
  morganStream: {
    write: jest.fn(),
  },
}));

// Global test setup
beforeAll(async () => {
  // Setup test database or other global test configuration
});

afterAll(async () => {
  // Cleanup after all tests
});

beforeEach(() => {
  // Reset mocks before each test
  jest.clearAllMocks();
});

afterEach(() => {
  // Cleanup after each test
});