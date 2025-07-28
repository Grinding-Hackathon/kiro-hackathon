import request from 'supertest';
import { app } from '../../index';
import { UserDAO } from '../../database/dao/UserDAO';

// Mock the UserDAO
jest.mock('../../database/dao/UserDAO');
const mockUserDAO = UserDAO as jest.MockedClass<typeof UserDAO>;

// Mock ethers for signature verification
const mockEthers = {
  verifyMessage: jest.fn(),
  SigningKey: {
    recoverPublicKey: jest.fn(),
  },
  isAddress: jest.fn(),
};

jest.mock('ethers', () => mockEthers);

describe('Auth Controller', () => {
  let userDAOInstance: jest.Mocked<UserDAO>;

  beforeEach(() => {
    jest.clearAllMocks();
    userDAOInstance = new mockUserDAO() as jest.Mocked<UserDAO>;
    (mockUserDAO as any).mockImplementation(() => userDAOInstance);
  });

  describe('GET /api/v1/auth/nonce', () => {
    it('should return nonce for valid wallet address', async () => {
      mockEthers.isAddress.mockReturnValue(true);

      const response = await request(app)
        .get('/api/v1/auth/nonce')
        .query({ walletAddress: '0x742d35Cc6634C0532925a3b8D4C0C8b3C2e1e1e1' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('nonce');
      expect(response.body.data).toHaveProperty('message');
      expect(response.body.data.message).toContain('Login to Offline Wallet');
    });

    it('should return error for invalid wallet address', async () => {
      mockEthers.isAddress.mockReturnValue(false);

      const response = await request(app)
        .get('/api/v1/auth/nonce')
        .query({ walletAddress: 'invalid-address' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid wallet address');
    });

    it('should return error when wallet address is missing', async () => {
      const response = await request(app)
        .get('/api/v1/auth/nonce');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Wallet address is required');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    const validLoginData = {
      walletAddress: '0x742d35Cc6634C0532925a3b8D4C0C8b3C2e1e1e1',
      signature: '0x' + 'a'.repeat(130),
      message: 'Login to Offline Wallet - Nonce: 123456',
    };

    it('should login successfully for new user', async () => {
      mockEthers.isAddress.mockReturnValue(true);
      mockEthers.verifyMessage.mockReturnValue(validLoginData.walletAddress);
      mockEthers.SigningKey.recoverPublicKey.mockReturnValue('0x04' + 'b'.repeat(128));

      userDAOInstance.findByWalletAddress.mockResolvedValue(null);
      userDAOInstance.create.mockResolvedValue({
        id: 'user-123',
        wallet_address: validLoginData.walletAddress,
        public_key: '0x04' + 'b'.repeat(128),
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send(validLoginData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user.walletAddress).toBe(validLoginData.walletAddress);
    });

    it('should login successfully for existing user', async () => {
      mockEthers.isAddress.mockReturnValue(true);
      mockEthers.verifyMessage.mockReturnValue(validLoginData.walletAddress);

      const existingUser = {
        id: 'user-123',
        wallet_address: validLoginData.walletAddress,
        public_key: '0x04' + 'b'.repeat(128),
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      userDAOInstance.findByWalletAddress.mockResolvedValue(existingUser);
      userDAOInstance.updateLastActivity.mockResolvedValue();

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send(validLoginData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('token');
      expect(userDAOInstance.updateLastActivity).toHaveBeenCalledWith('user-123');
    });

    it('should return error for invalid signature', async () => {
      mockEthers.isAddress.mockReturnValue(true);
      mockEthers.verifyMessage.mockReturnValue('0xDifferentAddress');

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send(validLoginData);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid signature');
    });

    it('should return validation error for missing fields', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          walletAddress: validLoginData.walletAddress,
          // missing signature and message
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toBeDefined();
    });
  });
});