import request from 'supertest';
import express, { Request, Response } from 'express';
import { validationSchemas, createValidationChain, sanitizeInput } from '../../middleware/validation';
import { ErrorCode } from '../../types';

describe('Validation Middleware', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(sanitizeInput);
  });

  describe('Authentication Validation', () => {
    beforeEach(() => {
      app.post('/test-login', 
        createValidationChain(validationSchemas.auth.login),
        (_req: Request, res: Response) => res.json({ success: true })
      );
    });

    it('should validate valid login request', async () => {
      const response = await request(app)
        .post('/test-login')
        .send({
          walletAddress: '0x742d35Cc6634C0532925a3b8D4C2C4e0C8b8E8e8',
          signature: '0x' + 'a'.repeat(130),
          message: 'Please sign this message to authenticate'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject invalid Ethereum address', async () => {
      const response = await request(app)
        .post('/test-login')
        .send({
          walletAddress: 'invalid-address',
          signature: '0x' + 'a'.repeat(130),
          message: 'Please sign this message to authenticate'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(response.body.error.details.validationErrors).toContainEqual(
        expect.objectContaining({
          field: 'walletAddress',
          message: 'Invalid Ethereum address format'
        })
      );
    });

    it('should reject invalid signature format', async () => {
      const response = await request(app)
        .post('/test-login')
        .send({
          walletAddress: '0x742d35Cc6634C0532925a3b8D4C2C4e0C8b8E8e8',
          signature: 'invalid-signature',
          message: 'Please sign this message to authenticate'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.details.validationErrors).toContainEqual(
        expect.objectContaining({
          field: 'signature',
          message: 'Invalid signature format'
        })
      );
    });

    it('should reject missing required fields', async () => {
      const response = await request(app)
        .post('/test-login')
        .send({
          walletAddress: '0x742d35Cc6634C0532925a3b8D4C2C4e0C8b8E8e8'
          // Missing signature and message
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.details.validationErrors.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Transaction Validation', () => {
    beforeEach(() => {
      app.post('/test-transaction', 
        createValidationChain(validationSchemas.transaction.submit),
        (_req: Request, res: Response) => res.json({ success: true })
      );
    });

    it('should validate valid transaction request', async () => {
      const response = await request(app)
        .post('/test-transaction')
        .send({
          receiverId: '550e8400-e29b-41d4-a716-446655440000',
          amount: 100.5,
          tokenIds: ['550e8400-e29b-41d4-a716-446655440001'],
          metadata: { type: 'payment' }
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject invalid UUID format', async () => {
      const response = await request(app)
        .post('/test-transaction')
        .send({
          receiverId: 'invalid-uuid',
          amount: 100.5,
          tokenIds: ['550e8400-e29b-41d4-a716-446655440001']
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.details.validationErrors).toContainEqual(
        expect.objectContaining({
          field: 'receiverId',
          message: 'Invalid receiver ID format'
        })
      );
    });

    it('should reject invalid amount', async () => {
      const response = await request(app)
        .post('/test-transaction')
        .send({
          receiverId: '550e8400-e29b-41d4-a716-446655440000',
          amount: -50, // Negative amount
          tokenIds: ['550e8400-e29b-41d4-a716-446655440001']
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.details.validationErrors).toContainEqual(
        expect.objectContaining({
          field: 'amount',
          message: 'Amount must be positive and within valid range'
        })
      );
    });

    it('should reject empty token IDs array', async () => {
      const response = await request(app)
        .post('/test-transaction')
        .send({
          receiverId: '550e8400-e29b-41d4-a716-446655440000',
          amount: 100.5,
          tokenIds: [] // Empty array
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.details.validationErrors).toContainEqual(
        expect.objectContaining({
          field: 'tokenIds',
          message: 'At least one token ID is required'
        })
      );
    });
  });

  describe('Token Validation', () => {
    beforeEach(() => {
      app.post('/test-token-validate', 
        createValidationChain(validationSchemas.token.validate),
        (_req: Request, res: Response) => res.json({ success: true })
      );

      app.post('/test-token-divide', 
        createValidationChain(validationSchemas.token.divide),
        (_req: Request, res: Response) => res.json({ success: true })
      );
    });

    it('should validate token validation request', async () => {
      const response = await request(app)
        .post('/test-token-validate')
        .send({
          tokenId: '550e8400-e29b-41d4-a716-446655440000',
          signature: '0x' + 'a'.repeat(130)
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should validate token division request', async () => {
      const response = await request(app)
        .post('/test-token-divide')
        .send({
          tokenId: '550e8400-e29b-41d4-a716-446655440000',
          paymentAmount: 50.5,
          changeAmount: 49.5,
          signature: '0x' + 'a'.repeat(130)
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject invalid token division amounts', async () => {
      const response = await request(app)
        .post('/test-token-divide')
        .send({
          tokenId: '550e8400-e29b-41d4-a716-446655440000',
          paymentAmount: -10, // Negative amount
          signature: '0x' + 'a'.repeat(130)
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.details.validationErrors).toContainEqual(
        expect.objectContaining({
          field: 'paymentAmount',
          message: 'Payment amount must be positive'
        })
      );
    });
  });

  describe('Pagination Validation', () => {
    beforeEach(() => {
      app.get('/test-pagination', 
        createValidationChain(validationSchemas.common.pagination),
        (_req: Request, res: Response) => res.json({ success: true })
      );
    });

    it('should validate valid pagination parameters', async () => {
      const response = await request(app)
        .get('/test-pagination')
        .query({
          page: '1',
          limit: '10',
          sortBy: 'createdAt',
          sortOrder: 'desc'
        });

      if (response.status !== 200) {
        console.log('Validation error response:', JSON.stringify(response.body, null, 2));
      }
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject invalid pagination parameters', async () => {
      const response = await request(app)
        .get('/test-pagination')
        .query({
          page: '0', // Invalid page
          limit: '2000', // Exceeds max limit
          sortOrder: 'invalid' // Invalid sort order
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.details.validationErrors.length).toBeGreaterThan(0);
    });
  });

  describe('Input Sanitization', () => {
    beforeEach(() => {
      app.post('/test-sanitization', (req: Request, res: Response) => {
        res.json({ body: req.body });
      });
    });

    it('should sanitize XSS attempts', async () => {
      const response = await request(app)
        .post('/test-sanitization')
        .send({
          message: '<script>alert("xss")</script>Hello World',
          nested: {
            content: 'javascript:alert("xss")'
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.body.message).toBe('Hello World');
      expect(response.body.body.nested.content).toBe('alert("xss")');
    });

    it('should handle arrays and nested objects', async () => {
      const response = await request(app)
        .post('/test-sanitization')
        .send({
          items: [
            '<script>alert("xss")</script>Item 1',
            { name: 'javascript:void(0)Item 2' }
          ]
        });

      expect(response.status).toBe(200);
      expect(response.body.body.items[0]).toBe('Item 1');
      expect(response.body.body.items[1].name).toBe('void(0)Item 2');
    });
  });

  describe('Custom Validators', () => {
    it('should validate Ethereum addresses correctly', async () => {
      app.post('/test-eth-address', 
        createValidationChain(validationSchemas.auth.login),
        (_req: Request, res: Response) => res.json({ success: true })
      );

      // Valid address
      let response = await request(app)
        .post('/test-eth-address')
        .send({
          walletAddress: '0x742d35Cc6634C0532925a3b8D4C2C4e0C8b8E8e8',
          signature: '0x' + 'a'.repeat(130),
          message: 'test'
        });
      expect(response.status).toBe(200);

      // Invalid address - wrong length
      response = await request(app)
        .post('/test-eth-address')
        .send({
          walletAddress: '0x742d35Cc6634C0532925a3b8D4C2C4e0C8b8E8',
          signature: '0x' + 'a'.repeat(130),
          message: 'test'
        });
      expect(response.status).toBe(400);

      // Invalid address - no 0x prefix
      response = await request(app)
        .post('/test-eth-address')
        .send({
          walletAddress: '742d35Cc6634C0532925a3b8D4C2C4e0C8b8E8e8',
          signature: '0x' + 'a'.repeat(130),
          message: 'test'
        });
      expect(response.status).toBe(400);
    });
  });
});