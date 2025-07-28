import { UserDAO } from '../../database/dao/UserDAO';
import { CreateUserData } from '../../models/User';
import DatabaseConnection from '../../database/connection';

describe('UserDAO', () => {
  let userDAO: UserDAO;
  let testUserId: string;

  beforeAll(async () => {
    userDAO = new UserDAO();
    // Run migrations for test database
    const dbConnection = DatabaseConnection.getInstance();
    await dbConnection.knex.migrate.latest();
  });

  afterAll(async () => {
    // Clean up test data
    if (testUserId) {
      await userDAO.delete(testUserId);
    }
    const dbConnection = DatabaseConnection.getInstance();
    await dbConnection.close();
  });

  describe('create', () => {
    it('should create a new user', async () => {
      const userData: CreateUserData = {
        wallet_address: '0x1234567890123456789012345678901234567890',
        public_key: 'test_public_key_123',
        email: 'test@example.com',
      };

      const user = await userDAO.create(userData);
      testUserId = user.id;

      expect(user).toBeDefined();
      expect(user.wallet_address).toBe(userData.wallet_address);
      expect(user.public_key).toBe(userData.public_key);
      expect(user.email).toBe(userData.email);
      expect(user.is_active).toBe(true);
    });
  });

  describe('findByWalletAddress', () => {
    it('should find user by wallet address', async () => {
      const user = await userDAO.findByWalletAddress('0x1234567890123456789012345678901234567890');
      
      expect(user).toBeDefined();
      expect(user?.wallet_address).toBe('0x1234567890123456789012345678901234567890');
    });

    it('should return null for non-existent wallet address', async () => {
      const user = await userDAO.findByWalletAddress('0x0000000000000000000000000000000000000000');
      
      expect(user).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should find user by email', async () => {
      const user = await userDAO.findByEmail('test@example.com');
      
      expect(user).toBeDefined();
      expect(user?.email).toBe('test@example.com');
    });
  });

  describe('updateLastActivity', () => {
    it('should update user last activity', async () => {
      const originalUser = await userDAO.findById(testUserId);
      const originalUpdatedAt = originalUser?.updated_at;

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 100));

      await userDAO.updateLastActivity(testUserId);
      
      const updatedUser = await userDAO.findById(testUserId);
      expect(updatedUser?.updated_at).not.toEqual(originalUpdatedAt);
    });
  });

  describe('deactivateUser', () => {
    it('should deactivate user', async () => {
      const deactivatedUser = await userDAO.deactivateUser(testUserId);
      
      expect(deactivatedUser).toBeDefined();
      expect(deactivatedUser?.is_active).toBe(false);
    });
  });
});