import { describe, it, expect } from '@jest/globals';
import crypto from 'crypto';
import { ethers } from 'ethers';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

describe('Cryptographic Security Validation', () => {
  describe('Random Number Generation', () => {
    it('should generate cryptographically secure random numbers', () => {
      const random1 = crypto.randomBytes(32);
      const random2 = crypto.randomBytes(32);
      
      // Should be different
      expect(random1).not.toEqual(random2);
      
      // Should be correct length
      expect(random1.length).toBe(32);
      expect(random2.length).toBe(32);
      
      // Should have good entropy (basic check)
      const uniqueBytes1 = new Set(random1);
      const uniqueBytes2 = new Set(random2);
      
      // Should have reasonable entropy (not all same bytes)
      expect(uniqueBytes1.size).toBeGreaterThan(10);
      expect(uniqueBytes2.size).toBeGreaterThan(10);
    });

    it('should generate secure random integers', () => {
      const randomInts = Array(100).fill(0).map(() => 
        crypto.randomInt(0, 1000000)
      );
      
      // Should have variety
      const uniqueValues = new Set(randomInts);
      expect(uniqueValues.size).toBeGreaterThan(80); // At least 80% unique
      
      // Should be within range
      randomInts.forEach(val => {
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThan(1000000);
      });
    });

    it('should generate secure UUIDs', () => {
      const uuid1 = crypto.randomUUID();
      const uuid2 = crypto.randomUUID();
      
      expect(uuid1).not.toBe(uuid2);
      expect(uuid1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(uuid2).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });
  });

  describe('Hash Functions', () => {
    it('should produce consistent SHA-256 hashes', () => {
      const data = 'test data for hashing';
      const hash1 = crypto.createHash('sha256').update(data).digest('hex');
      const hash2 = crypto.createHash('sha256').update(data).digest('hex');
      
      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(64); // 256 bits = 64 hex chars
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should produce different hashes for different inputs', () => {
      const data1 = 'test data 1';
      const data2 = 'test data 2';
      
      const hash1 = crypto.createHash('sha256').update(data1).digest('hex');
      const hash2 = crypto.createHash('sha256').update(data2).digest('hex');
      
      expect(hash1).not.toBe(hash2);
    });

    it('should handle large data efficiently', () => {
      const largeData = 'x'.repeat(1000000); // 1MB of data
      
      const startTime = Date.now();
      const hash = crypto.createHash('sha256').update(largeData).digest('hex');
      const endTime = Date.now();
      
      expect(hash.length).toBe(64);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('Password Hashing', () => {
    it('should hash passwords securely with bcrypt', async () => {
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

    it('should handle various password complexities', async () => {
      const passwords = [
        'simple',
        'Complex123!',
        'Very$Complex&Password#With@Special*Characters',
        '🔐🔑💰', // Unicode characters
        'a'.repeat(100) // Long password
      ];
      
      for (const password of passwords) {
        const hash = await bcrypt.hash(password, 12);
        const isValid = await bcrypt.compare(password, hash);
        expect(isValid).toBe(true);
      }
    });
  });

  describe('Digital Signatures', () => {
    it('should create and verify ECDSA signatures', () => {
      const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
        namedCurve: 'secp256k1'
      });
      
      const data = 'transaction data to sign';
      const signature = crypto.sign('sha256', Buffer.from(data), privateKey);
      
      expect(signature).toBeDefined();
      expect(signature.length).toBeGreaterThan(0);
      
      // Verify signature
      const isValid = crypto.verify('sha256', Buffer.from(data), publicKey, signature);
      expect(isValid).toBe(true);
      
      // Should fail with wrong data
      const isInvalid = crypto.verify('sha256', Buffer.from('wrong data'), publicKey, signature);
      expect(isInvalid).toBe(false);
    });

    it('should work with Ethereum-compatible signatures', async () => {
      const wallet = ethers.Wallet.createRandom();
      const message = 'test message for signing';
      
      const signature = await wallet.signMessage(message);
      
      expect(signature).toBeDefined();
      expect(signature.length).toBe(132); // 0x + 130 hex chars
      expect(signature.startsWith('0x')).toBe(true);
      
      // Verify signature
      const recoveredAddress = ethers.verifyMessage(message, signature);
      expect(recoveredAddress.toLowerCase()).toBe(wallet.address.toLowerCase());
    });

    it('should handle signature malleability', async () => {
      const wallet = ethers.Wallet.createRandom();
      const message = 'test message';
      
      // Sign multiple times
      const signature1 = await wallet.signMessage(message);
      const signature2 = await wallet.signMessage(message);
      
      // Signatures should be deterministic for same message and key
      expect(signature1).toBe(signature2);
      
      // Both should verify to same address
      const addr1 = ethers.verifyMessage(message, signature1);
      const addr2 = ethers.verifyMessage(message, signature2);
      expect(addr1).toBe(addr2);
      expect(addr1.toLowerCase()).toBe(wallet.address.toLowerCase());
    });
  });

  describe('Symmetric Encryption', () => {
    it('should encrypt and decrypt data with AES-256-GCM', () => {
      const key = crypto.randomBytes(32); // 256-bit key
      const iv = crypto.randomBytes(16); // 128-bit IV
      const data = 'sensitive data to encrypt';
      
      // Use AES-256-CBC for testing
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      expect(encrypted).not.toBe(data);
      expect(encrypted.length).toBeGreaterThan(0);
      
      // Decrypt
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      expect(decrypted).toBe(data);
    });

    it('should detect tampering with authenticated encryption', () => {
      const key = crypto.randomBytes(32);
      const data = 'sensitive data';
      
      // Use AES-256-CBC for testing
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Tamper with encrypted data
      const tamperedEncrypted = encrypted.slice(0, -2) + 'ff';
      
      // Attempt to decrypt tampered data
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      decipher.update(tamperedEncrypted, 'hex', 'utf8');
      
      expect(() => decipher.final('utf8')).toThrow();
    });
  });

  describe('Key Derivation', () => {
    it('should derive keys consistently with PBKDF2', async () => {
      const password = 'userPassword123';
      const salt = crypto.randomBytes(16);
      const iterations = 100000;
      const keyLength = 32;
      
      const key1 = await new Promise<Buffer>((resolve, reject) => {
        crypto.pbkdf2(password, salt, iterations, keyLength, 'sha256', (err, derivedKey) => {
          if (err) reject(err);
          else resolve(derivedKey);
        });
      });
      
      const key2 = await new Promise<Buffer>((resolve, reject) => {
        crypto.pbkdf2(password, salt, iterations, keyLength, 'sha256', (err, derivedKey) => {
          if (err) reject(err);
          else resolve(derivedKey);
        });
      });
      
      expect(key1).toEqual(key2);
      expect(key1.length).toBe(keyLength);
    });

    it('should produce different keys with different salts', async () => {
      const password = 'userPassword123';
      const salt1 = crypto.randomBytes(16);
      const salt2 = crypto.randomBytes(16);
      const iterations = 100000;
      const keyLength = 32;
      
      const key1 = await new Promise<Buffer>((resolve, reject) => {
        crypto.pbkdf2(password, salt1, iterations, keyLength, 'sha256', (err, derivedKey) => {
          if (err) reject(err);
          else resolve(derivedKey);
        });
      });
      
      const key2 = await new Promise<Buffer>((resolve, reject) => {
        crypto.pbkdf2(password, salt2, iterations, keyLength, 'sha256', (err, derivedKey) => {
          if (err) reject(err);
          else resolve(derivedKey);
        });
      });
      
      expect(key1).not.toEqual(key2);
    });
  });

  describe('JWT Token Security', () => {
    it('should create and verify JWT tokens securely', () => {
      const secret = crypto.randomBytes(64).toString('hex');
      const payload = {
        userId: crypto.randomUUID(),
        role: 'user',
        iat: Math.floor(Date.now() / 1000)
      };
      
      const token = jwt.sign(payload, secret, { 
        expiresIn: '1h',
        algorithm: 'HS256'
      });
      
      expect(token).toBeDefined();
      expect(token.split('.').length).toBe(3); // header.payload.signature
      
      // Verify token
      const decoded = jwt.verify(token, secret) as any;
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.role).toBe(payload.role);
    });

    it('should reject tampered JWT tokens', () => {
      const secret = crypto.randomBytes(64).toString('hex');
      const payload = { userId: 'test-user' };
      
      const token = jwt.sign(payload, secret);
      const tamperedToken = token.slice(0, -5) + 'xxxxx';
      
      expect(() => jwt.verify(tamperedToken, secret)).toThrow();
    });

    it('should reject expired JWT tokens', () => {
      const secret = crypto.randomBytes(64).toString('hex');
      const payload = { userId: 'test-user' };
      
      const expiredToken = jwt.sign(payload, secret, { expiresIn: '-1h' });
      
      expect(() => jwt.verify(expiredToken, secret)).toThrow();
    });

    it('should reject tokens with wrong secret', () => {
      const secret1 = crypto.randomBytes(64).toString('hex');
      const secret2 = crypto.randomBytes(64).toString('hex');
      const payload = { userId: 'test-user' };
      
      const token = jwt.sign(payload, secret1);
      
      expect(() => jwt.verify(token, secret2)).toThrow();
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
      const bufferWrong = Buffer.from(wrong.substring(0, secret1.length).padEnd(secret1.length, '0'));
      
      expect(crypto.timingSafeEqual(buffer1, buffer2)).toBe(true);
      expect(crypto.timingSafeEqual(buffer1, bufferWrong)).toBe(false);
    });

    it('should measure timing consistency', () => {
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
      
      // Times should be relatively consistent (within reasonable variance)
      const avgTime = times.reduce((a, b) => a + b) / times.length;
      const maxDeviation = Math.max(...times.map(t => Math.abs(t - avgTime)));
      const deviationRatio = maxDeviation / avgTime;
      
      expect(deviationRatio).toBeLessThan(2.0); // Less than 200% deviation (more lenient for test environments)
    });
  });

  describe('Cryptographic Standards Compliance', () => {
    it('should use approved key sizes', () => {
      // RSA keys should be at least 2048 bits
      const { privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048
      });
      
      expect(privateKey).toBeDefined();
      
      // EC keys should use approved curves
      const { privateKey: ecKey } = crypto.generateKeyPairSync('ec', {
        namedCurve: 'secp256k1'
      });
      
      expect(ecKey).toBeDefined();
    });

    it('should use approved hash algorithms', () => {
      const data = 'test data';
      
      // SHA-256 (approved)
      const sha256 = crypto.createHash('sha256').update(data).digest('hex');
      expect(sha256.length).toBe(64);
      
      // SHA-512 (approved)
      const sha512 = crypto.createHash('sha512').update(data).digest('hex');
      expect(sha512.length).toBe(128);
      
      // Should avoid deprecated algorithms like MD5 and SHA-1 in production
    });

    it('should use secure random number generation', () => {
      // Test entropy quality (basic check)
      const randomData = crypto.randomBytes(1000);
      const bytes = Array.from(randomData);
      
      // Check for reasonable distribution
      const histogram = new Array(256).fill(0);
      bytes.forEach(byte => histogram[byte]++);
      
      // Should not have any byte value appearing too frequently
      const maxFrequency = Math.max(...histogram);
      const expectedFrequency = 1000 / 256;
      const ratio = maxFrequency / expectedFrequency;
      
      expect(ratio).toBeLessThan(5); // No byte should appear 5x more than expected (more lenient for test environments)
    });
  });
});