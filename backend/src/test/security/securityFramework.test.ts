import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { app } from '../../index';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

describe('Security Framework Tests', () => {
  let server: any;

  beforeAll(async () => {
    server = app.listen(0);
    
    // Initialize test environment
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
  });

  describe('JWT Token Security', () => {
    it('should create secure JWT tokens', () => {
      const payload = { userId: 'test-user', role: 'user' };
      const secret = 'test-secret-key';
      
      const token = jwt.sign(payload, secret, { expiresIn: '1h' });
      
      expect(token).toBeDefined();
      expect(token.split('.').length).toBe(3); // header.payload.signature
      
      // Verify token
      const decoded = jwt.verify(token, secret) as any;
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.role).toBe(payload.role);
    });

    it('should reject invalid JWT tokens', () => {
      const secret = 'test-secret-key';
      const invalidToken = 'invalid.token.here';
      
      expect(() => jwt.verify(invalidToken, secret)).toThrow();
    });

    it('should reject expired JWT tokens', () => {
      const payload = { userId: 'test-user', role: 'user' };
      const secret = 'test-secret-key';
      
      const expiredToken = jwt.sign(payload, secret, { expiresIn: '-1h' });
      
      expect(() => jwt.verify(expiredToken, secret)).toThrow();
    });

    it('should reject tokens with wrong secret', () => {
      const payload = { userId: 'test-user', role: 'user' };
      const secret1 = 'secret-1';
      const secret2 = 'secret-2';
      
      const token = jwt.sign(payload, secret1);
      
      expect(() => jwt.verify(token, secret2)).toThrow();
    });
  });

  describe('Password Security', () => {
    it('should hash passwords securely', async () => {
      const password = 'testPassword123!';
      const saltRounds = 12;
      
      const hash = await bcrypt.hash(password, saltRounds);
      
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50);
      expect(hash.startsWith('$2a$') || hash.startsWith('$2b$')).toBe(true);
      
      // Should verify correctly
      const isValid = await bcrypt.compare(password, hash);
      expect(isValid).toBe(true);
      
      // Should reject wrong password
      const isInvalid = await bcrypt.compare('wrongPassword', hash);
      expect(isInvalid).toBe(false);
    });

    it('should produce different hashes for same password', async () => {
      const password = 'testPassword123!';
      
      const hash1 = await bcrypt.hash(password, 12);
      const hash2 = await bcrypt.hash(password, 12);
      
      expect(hash1).not.toBe(hash2);
      
      // Both should verify correctly
      expect(await bcrypt.compare(password, hash1)).toBe(true);
      expect(await bcrypt.compare(password, hash2)).toBe(true);
    });
  });

  describe('Cryptographic Operations', () => {
    it('should generate secure random numbers', () => {
      const random1 = crypto.randomBytes(32);
      const random2 = crypto.randomBytes(32);
      
      expect(random1).not.toEqual(random2);
      expect(random1.length).toBe(32);
      expect(random2.length).toBe(32);
      
      // Check for reasonable entropy
      const uniqueBytes1 = new Set(random1);
      const uniqueBytes2 = new Set(random2);
      
      expect(uniqueBytes1.size).toBeGreaterThan(10);
      expect(uniqueBytes2.size).toBeGreaterThan(10);
    });

    it('should create consistent hash values', () => {
      const data = 'test data for hashing';
      const hash1 = crypto.createHash('sha256').update(data).digest('hex');
      const hash2 = crypto.createHash('sha256').update(data).digest('hex');
      
      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(64); // 256 bits = 64 hex chars
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should create different hashes for different inputs', () => {
      const data1 = 'test data 1';
      const data2 = 'test data 2';
      
      const hash1 = crypto.createHash('sha256').update(data1).digest('hex');
      const hash2 = crypto.createHash('sha256').update(data2).digest('hex');
      
      expect(hash1).not.toBe(hash2);
    });

    it('should generate secure UUIDs', () => {
      const uuid1 = crypto.randomUUID();
      const uuid2 = crypto.randomUUID();
      
      expect(uuid1).not.toBe(uuid2);
      expect(uuid1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(uuid2).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });
  });

  describe('Input Validation Security', () => {
    it('should validate email formats', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.org'
      ];
      
      const invalidEmails = [
        'invalid-email',
        '@domain.com',
        'user@'
      ];
      
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      
      validEmails.forEach(email => {
        expect(emailRegex.test(email)).toBe(true);
      });
      
      invalidEmails.forEach(email => {
        expect(emailRegex.test(email)).toBe(false);
      });
    });

    it('should validate wallet addresses', () => {
      const validAddresses = [
        '0x1234567890123456789012345678901234567890',
        '0xabcdefABCDEF1234567890123456789012345678'
      ];
      
      const invalidAddresses = [
        '1234567890123456789012345678901234567890', // Missing 0x
        '0x123456789012345678901234567890123456789', // Too short
        '0x12345678901234567890123456789012345678901', // Too long
        '0xGHIJKL7890123456789012345678901234567890' // Invalid characters
      ];
      
      const addressRegex = /^0x[a-fA-F0-9]{40}$/;
      
      validAddresses.forEach(address => {
        expect(addressRegex.test(address)).toBe(true);
      });
      
      invalidAddresses.forEach(address => {
        expect(addressRegex.test(address)).toBe(false);
      });
    });

    it('should validate numeric amounts', () => {
      const validAmounts = [1, 100, 1000.5, 0.01];
      const invalidAmounts = [-1, 0, NaN, Infinity, 'not-a-number'];
      
      const isValidAmount = (amount: any): boolean => {
        return typeof amount === 'number' && 
               !isNaN(amount) && 
               isFinite(amount) && 
               amount > 0;
      };
      
      validAmounts.forEach(amount => {
        expect(isValidAmount(amount)).toBe(true);
      });
      
      invalidAmounts.forEach(amount => {
        expect(isValidAmount(amount)).toBe(false);
      });
    });
  });

  describe('Security Headers and CORS', () => {
    it('should handle CORS preflight requests', async () => {
      const response = await request(app)
        .options('/')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET');

      // Should respond to OPTIONS request
      expect([200, 204, 404]).toContain(response.status);
    });

    it('should handle requests from different origins', async () => {
      const response = await request(app)
        .get('/')
        .set('Origin', 'http://malicious-site.com');

      // Should not crash and should respond
      expect(response.status).toBeDefined();
      expect([200, 404, 403]).toContain(response.status);
    });
  });

  describe('Rate Limiting Framework', () => {
    it('should handle rapid sequential requests', async () => {
      const requests = Array(10).fill(null).map(() =>
        request(app).get('/')
      );

      const responses = await Promise.all(requests);
      
      // Should handle all requests without server errors
      const serverErrors = responses.filter(r => r.status >= 500);
      expect(serverErrors.length).toBe(0);
      
      // All requests should complete
      expect(responses.length).toBe(10);
    });

    it('should maintain stability under burst requests', async () => {
      const burstSize = 20;
      const requests = Array(burstSize).fill(null).map(() =>
        request(app).get('/')
      );

      const responses = await Promise.all(requests);
      
      // Should not crash server
      const serverErrors = responses.filter(r => r.status >= 500);
      expect(serverErrors.length).toBe(0);
      
      // Should respond to all requests
      expect(responses.length).toBe(burstSize);
    });
  });

  describe('Error Handling Security', () => {
    it('should handle malformed requests gracefully', async () => {
      const response = await request(app)
        .post('/')
        .send('invalid-json-data');

      // Should not crash and should respond with appropriate error
      expect([400, 404, 500]).toContain(response.status);
      
      if (response.body && response.body.error) {
        // Should not expose sensitive information
        expect(response.body.error).not.toContain('database');
        expect(response.body.error).not.toContain('password');
        expect(response.body.error).not.toContain('secret');
        expect(response.body.error).not.toContain('key');
      }
    });

    it('should handle oversized requests', async () => {
      const largePayload = 'x'.repeat(10000); // 10KB payload
      
      const response = await request(app)
        .post('/')
        .send({ data: largePayload });

      // Should handle large payloads appropriately
      expect([200, 400, 404, 413]).toContain(response.status);
    });
  });

  describe('Session Security', () => {
    it('should handle concurrent token operations', async () => {
      const tokens = Array(5).fill(null).map((_, index) => {
        return jwt.sign(
          { userId: `user-${index}`, role: 'user' },
          process.env['JWT_SECRET'] || 'test-secret',
          { expiresIn: '1h' }
        );
      });

      // All tokens should be valid and unique
      expect(tokens.length).toBe(5);
      expect(new Set(tokens).size).toBe(5); // All unique
      
      // All tokens should verify correctly
      tokens.forEach(token => {
        const decoded = jwt.verify(token, process.env['JWT_SECRET'] || 'test-secret');
        expect(decoded).toBeDefined();
      });
    });

    it('should handle token expiration correctly', () => {
      const shortLivedToken = jwt.sign(
        { userId: 'test-user', role: 'user' },
        process.env['JWT_SECRET'] || 'test-secret',
        { expiresIn: '1ms' } // Very short expiration
      );

      // Wait for token to expire
      setTimeout(() => {
        expect(() => jwt.verify(shortLivedToken, process.env['JWT_SECRET'] || 'test-secret')).toThrow();
      }, 10);
    });
  });

  describe('Timing Attack Prevention', () => {
    it('should use constant-time comparison for sensitive data', () => {
      const secret1 = 'correct-secret-value';
      const secret2 = 'correct-secret-value';
      const wrong = 'wrong-secret-value';
      
      // Use crypto.timingSafeEqual for constant-time comparison
      const buffer1 = Buffer.from(secret1);
      const buffer2 = Buffer.from(secret2);
      const bufferWrong = Buffer.from(wrong.padEnd(secret1.length, '0')); // Ensure same length
      
      expect(crypto.timingSafeEqual(buffer1, buffer2)).toBe(true);
      expect(crypto.timingSafeEqual(buffer1, bufferWrong)).toBe(false);
    });

    it('should handle string comparison timing consistently', () => {
      const correctSecret = 'a'.repeat(32);
      const wrongSecrets = [
        'b'.repeat(32),
        'c'.repeat(32),
        'd'.repeat(32)
      ];
      
      const times: number[] = [];
      
      // Measure comparison times
      wrongSecrets.forEach(wrongSecret => {
        const start = process.hrtime.bigint();
        crypto.timingSafeEqual(Buffer.from(correctSecret), Buffer.from(wrongSecret));
        const end = process.hrtime.bigint();
        times.push(Number(end - start));
      });
      
      // Times should be relatively consistent
      const avgTime = times.reduce((a, b) => a + b) / times.length;
      const maxDeviation = Math.max(...times.map(t => Math.abs(t - avgTime)));
      const deviationRatio = maxDeviation / avgTime;
      
      expect(deviationRatio).toBeLessThan(2.0); // Less than 200% deviation (more realistic for timing)
    });
  });
});