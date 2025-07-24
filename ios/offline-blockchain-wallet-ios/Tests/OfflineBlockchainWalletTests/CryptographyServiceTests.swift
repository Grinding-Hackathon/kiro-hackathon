//
//  CryptographyServiceTests.swift
//  OfflineBlockchainWalletTests
//
//  Created by Kiro on 7/21/25.
//

import XCTest
@testable import OfflineBlockchainWallet

final class CryptographyServiceTests: XCTestCase {
    var cryptographyService: CryptographyService!
    
    override func setUpWithError() throws {
        cryptographyService = CryptographyService()
        
        // Clean up any test keys from previous runs
        let testIdentifiers = ["test-key-1", "test-key-2", "test-signing-key", "test-encryption-key"]
        for identifier in testIdentifiers {
            try? cryptographyService.deletePrivateKey(for: identifier)
        }
    }
    
    override func tearDownWithError() throws {
        // Clean up test keys
        let testIdentifiers = ["test-key-1", "test-key-2", "test-signing-key", "test-encryption-key"]
        for identifier in testIdentifiers {
            try? cryptographyService.deletePrivateKey(for: identifier)
        }
        
        cryptographyService = nil
    }
    
    // MARK: - Key Generation Tests
    
    func testKeyPairGeneration() throws {
        // Test default key pair generation
        let keyPair = try cryptographyService.generateKeyPair()
        
        XCTAssertFalse(keyPair.privateKey.isEmpty)
        XCTAssertFalse(keyPair.publicKey.isEmpty)
        XCTAssertNotEqual(keyPair.privateKey, keyPair.publicKey)
        
        // Test that generated keys are valid base64
        XCTAssertNotNil(Data(base64Encoded: keyPair.privateKey))
        XCTAssertNotNil(Data(base64Encoded: keyPair.publicKey))
        
        // Test key validation
        XCTAssertTrue(cryptographyService.validatePrivateKey(keyPair.privateKey))
        XCTAssertTrue(cryptographyService.validatePublicKey(keyPair.publicKey))
        XCTAssertTrue(cryptographyService.validateKeyPair(privateKey: keyPair.privateKey, publicKey: keyPair.publicKey))
    }
    
    func testSigningKeyPairGeneration() throws {
        let keyPair = try cryptographyService.generateKeyPairForSigning()
        
        XCTAssertFalse(keyPair.privateKey.isEmpty)
        XCTAssertFalse(keyPair.publicKey.isEmpty)
        XCTAssertNotEqual(keyPair.privateKey, keyPair.publicKey)
        
        // Test that keys can be used for signing
        let testData = "test message".data(using: .utf8)!
        let signature = try cryptographyService.signData(testData, with: keyPair.privateKey)
        let isValid = try cryptographyService.verifySignature(signature, for: testData, with: keyPair.publicKey)
        XCTAssertTrue(isValid)
    }
    
    func testEncryptionKeyPairGeneration() throws {
        let keyPair = try cryptographyService.generateKeyPairForEncryption()
        
        XCTAssertFalse(keyPair.privateKey.isEmpty)
        XCTAssertFalse(keyPair.publicKey.isEmpty)
        XCTAssertNotEqual(keyPair.privateKey, keyPair.publicKey)
        
        // Test that keys can be used for encryption
        let testData = "test message".data(using: .utf8)!
        let encryptedData = try cryptographyService.encryptData(testData, with: keyPair.publicKey)
        let decryptedData = try cryptographyService.decryptData(encryptedData, with: keyPair.privateKey)
        XCTAssertEqual(testData, decryptedData)
    }
    
    // MARK: - Digital Signature Tests
    
    func testSignAndVerifyData() throws {
        // Generate key pair
        let keyPair = try cryptographyService.generateKeyPair()
        
        // Test data
        let testData = "Hello, World!".data(using: .utf8)!
        
        // Sign data
        let signature = try cryptographyService.signData(testData, with: keyPair.privateKey)
        
        // Verify signature with correct public key
        let isValid = try cryptographyService.verifySignature(signature, for: testData, with: keyPair.publicKey)
        XCTAssertTrue(isValid)
        
        // Test with different data should fail
        let differentData = "Different data".data(using: .utf8)!
        let isInvalid = try cryptographyService.verifySignature(signature, for: differentData, with: keyPair.publicKey)
        XCTAssertFalse(isInvalid)
        
        // Test with different public key should fail
        let anotherKeyPair = try cryptographyService.generateKeyPair()
        let isInvalidKey = try cryptographyService.verifySignature(signature, for: testData, with: anotherKeyPair.publicKey)
        XCTAssertFalse(isInvalidKey)
    }
    
    func testSignAndVerifyMessage() throws {
        let keyPair = try cryptographyService.generateKeyPair()
        let testMessage = "This is a test message for signing"
        
        // Sign message
        let signature = try cryptographyService.signMessage(testMessage, with: keyPair.privateKey)
        
        // Verify signature
        let isValid = try cryptographyService.verifyMessageSignature(signature, for: testMessage, with: keyPair.publicKey)
        XCTAssertTrue(isValid)
        
        // Test with different message should fail
        let differentMessage = "Different message"
        let isInvalid = try cryptographyService.verifyMessageSignature(signature, for: differentMessage, with: keyPair.publicKey)
        XCTAssertFalse(isInvalid)
    }
    
    func testSignatureConsistency() throws {
        let keyPair = try cryptographyService.generateKeyPair()
        let testMessage = "Consistency test message"
        
        // Sign the same message multiple times
        let signature1 = try cryptographyService.signMessage(testMessage, with: keyPair.privateKey)
        let signature2 = try cryptographyService.signMessage(testMessage, with: keyPair.privateKey)
        
        // Both signatures should be valid (but may be different due to randomness in ECDSA)
        XCTAssertTrue(try cryptographyService.verifyMessageSignature(signature1, for: testMessage, with: keyPair.publicKey))
        XCTAssertTrue(try cryptographyService.verifyMessageSignature(signature2, for: testMessage, with: keyPair.publicKey))
    }
    
    // MARK: - Encryption and Decryption Tests
    
    func testEncryptAndDecryptData() throws {
        // Generate key pair for encryption
        let keyPair = try cryptographyService.generateKeyPairForEncryption()
        
        // Test data
        let testData = "Sensitive information".data(using: .utf8)!
        
        // Encrypt data
        let encryptedData = try cryptographyService.encryptData(testData, with: keyPair.publicKey)
        
        // Verify encrypted data is different from original
        XCTAssertNotEqual(testData, encryptedData)
        
        // Decrypt data
        let decryptedData = try cryptographyService.decryptData(encryptedData, with: keyPair.privateKey)
        
        // Verify decrypted data matches original
        XCTAssertEqual(testData, decryptedData)
    }
    
    func testEncryptAndDecryptMessage() throws {
        let keyPair = try cryptographyService.generateKeyPairForEncryption()
        let testMessage = "This is a secret message that needs encryption"
        
        // Encrypt message
        let encryptedMessage = try cryptographyService.encryptMessage(testMessage, with: keyPair.publicKey)
        
        // Verify encrypted message is different from original
        XCTAssertNotEqual(testMessage, encryptedMessage)
        
        // Decrypt message
        let decryptedMessage = try cryptographyService.decryptMessage(encryptedMessage, with: keyPair.privateKey)
        
        // Verify decrypted message matches original
        XCTAssertEqual(testMessage, decryptedMessage)
    }
    
    func testEncryptionWithDifferentKeys() throws {
        let keyPair1 = try cryptographyService.generateKeyPairForEncryption()
        let keyPair2 = try cryptographyService.generateKeyPairForEncryption()
        let testData = "Test data".data(using: .utf8)!
        
        // Encrypt with first key pair
        let encryptedData = try cryptographyService.encryptData(testData, with: keyPair1.publicKey)
        
        // Try to decrypt with wrong private key should fail
        XCTAssertThrowsError(try cryptographyService.decryptData(encryptedData, with: keyPair2.privateKey))
        
        // Decrypt with correct private key should succeed
        let decryptedData = try cryptographyService.decryptData(encryptedData, with: keyPair1.privateKey)
        XCTAssertEqual(testData, decryptedData)
    }
    
    // MARK: - Keychain Storage Tests
    
    func testKeychainStorage() throws {
        let testKey = "test-key-1"
        let testPrivateKey = "test-private-key-data"
        
        // Initially key should not exist
        XCTAssertFalse(cryptographyService.keyExists(for: testKey))
        
        // Store key
        try cryptographyService.storePrivateKey(testPrivateKey, for: testKey)
        
        // Key should now exist
        XCTAssertTrue(cryptographyService.keyExists(for: testKey))
        
        // Retrieve key
        let retrievedKey = try cryptographyService.retrievePrivateKey(for: testKey)
        XCTAssertEqual(testPrivateKey, retrievedKey)
        
        // Delete key
        try cryptographyService.deletePrivateKey(for: testKey)
        
        // Key should no longer exist
        XCTAssertFalse(cryptographyService.keyExists(for: testKey))
        
        // Verify deletion
        let deletedKey = try cryptographyService.retrievePrivateKey(for: testKey)
        XCTAssertNil(deletedKey)
    }
    
    func testKeychainStorageWithRealKeys() throws {
        let keyPair = try cryptographyService.generateKeyPair()
        let testIdentifier = "test-signing-key"
        
        // Store real private key
        try cryptographyService.storePrivateKey(keyPair.privateKey, for: testIdentifier)
        
        // Retrieve and verify
        let retrievedKey = try cryptographyService.retrievePrivateKey(for: testIdentifier)
        XCTAssertEqual(keyPair.privateKey, retrievedKey)
        
        // Test that retrieved key still works
        let testMessage = "Test message for stored key"
        let signature = try cryptographyService.signMessage(testMessage, with: retrievedKey!)
        let isValid = try cryptographyService.verifyMessageSignature(signature, for: testMessage, with: keyPair.publicKey)
        XCTAssertTrue(isValid)
        
        // Clean up
        try cryptographyService.deletePrivateKey(for: testIdentifier)
    }
    
    func testKeychainOverwrite() throws {
        let testIdentifier = "test-key-2"
        let firstKey = "first-key-data"
        let secondKey = "second-key-data"
        
        // Store first key
        try cryptographyService.storePrivateKey(firstKey, for: testIdentifier)
        XCTAssertEqual(firstKey, try cryptographyService.retrievePrivateKey(for: testIdentifier))
        
        // Overwrite with second key
        try cryptographyService.storePrivateKey(secondKey, for: testIdentifier)
        XCTAssertEqual(secondKey, try cryptographyService.retrievePrivateKey(for: testIdentifier))
        
        // Clean up
        try cryptographyService.deletePrivateKey(for: testIdentifier)
    }
    
    // MARK: - Hash Function Tests
    
    func testHashData() {
        let testData = "Hello, World!".data(using: .utf8)!
        let hash1 = cryptographyService.hashData(testData)
        let hash2 = cryptographyService.hashData(testData)
        
        // Same data should produce same hash
        XCTAssertEqual(hash1, hash2)
        XCTAssertFalse(hash1.isEmpty)
        
        // Different data should produce different hash
        let differentData = "Different data".data(using: .utf8)!
        let differentHash = cryptographyService.hashData(differentData)
        XCTAssertNotEqual(hash1, differentHash)
    }
    
    func testHashMessage() {
        let testMessage = "This is a test message"
        let hash1 = cryptographyService.hashMessage(testMessage)
        let hash2 = cryptographyService.hashMessage(testMessage)
        
        // Same message should produce same hash
        XCTAssertEqual(hash1, hash2)
        XCTAssertFalse(hash1.isEmpty)
        
        // Different message should produce different hash
        let differentMessage = "Different message"
        let differentHash = cryptographyService.hashMessage(differentMessage)
        XCTAssertNotEqual(hash1, differentHash)
    }
    
    // MARK: - Key Validation Tests
    
    func testValidatePrivateKey() throws {
        let keyPair = try cryptographyService.generateKeyPair()
        
        // Valid private key should pass validation
        XCTAssertTrue(cryptographyService.validatePrivateKey(keyPair.privateKey))
        
        // Invalid private keys should fail validation
        XCTAssertFalse(cryptographyService.validatePrivateKey("invalid-key"))
        XCTAssertFalse(cryptographyService.validatePrivateKey(""))
        XCTAssertFalse(cryptographyService.validatePrivateKey("not-base64!@#"))
    }
    
    func testValidatePublicKey() throws {
        let keyPair = try cryptographyService.generateKeyPair()
        
        // Valid public key should pass validation
        XCTAssertTrue(cryptographyService.validatePublicKey(keyPair.publicKey))
        
        // Invalid public keys should fail validation
        XCTAssertFalse(cryptographyService.validatePublicKey("invalid-key"))
        XCTAssertFalse(cryptographyService.validatePublicKey(""))
        XCTAssertFalse(cryptographyService.validatePublicKey("not-base64!@#"))
    }
    
    func testValidateKeyPair() throws {
        let keyPair = try cryptographyService.generateKeyPair()
        let anotherKeyPair = try cryptographyService.generateKeyPair()
        
        // Valid key pair should pass validation
        XCTAssertTrue(cryptographyService.validateKeyPair(privateKey: keyPair.privateKey, publicKey: keyPair.publicKey))
        
        // Mismatched key pair should fail validation
        XCTAssertFalse(cryptographyService.validateKeyPair(privateKey: keyPair.privateKey, publicKey: anotherKeyPair.publicKey))
        
        // Invalid keys should fail validation
        XCTAssertFalse(cryptographyService.validateKeyPair(privateKey: "invalid", publicKey: keyPair.publicKey))
        XCTAssertFalse(cryptographyService.validateKeyPair(privateKey: keyPair.privateKey, publicKey: "invalid"))
    }
    
    // MARK: - Error Handling Tests
    
    func testInvalidPrivateKey() {
        let invalidPrivateKey = "invalid-key"
        let testData = "test".data(using: .utf8)!
        
        XCTAssertThrowsError(try cryptographyService.signData(testData, with: invalidPrivateKey)) { error in
            XCTAssertTrue(error is CryptographyError)
            if case CryptographyError.invalidPrivateKey = error {
                // Expected error
            } else {
                XCTFail("Expected invalidPrivateKey error")
            }
        }
    }
    
    func testInvalidSignature() throws {
        let keyPair = try cryptographyService.generateKeyPair()
        let testData = "test".data(using: .utf8)!
        let invalidSignature = "invalid-signature"
        
        XCTAssertThrowsError(try cryptographyService.verifySignature(invalidSignature, for: testData, with: keyPair.publicKey)) { error in
            XCTAssertTrue(error is CryptographyError)
            if case CryptographyError.invalidSignature = error {
                // Expected error
            } else {
                XCTFail("Expected invalidSignature error")
            }
        }
    }
    
    func testInvalidPublicKeyForEncryption() {
        let testData = "test".data(using: .utf8)!
        let invalidPublicKey = "invalid-public-key"
        
        XCTAssertThrowsError(try cryptographyService.encryptData(testData, with: invalidPublicKey)) { error in
            XCTAssertTrue(error is CryptographyError)
            if case CryptographyError.invalidPublicKey = error {
                // Expected error
            } else {
                XCTFail("Expected invalidPublicKey error")
            }
        }
    }
    
    func testInvalidEncryptedData() throws {
        let keyPair = try cryptographyService.generateKeyPairForEncryption()
        let invalidEncryptedData = "invalid-encrypted-data".data(using: .utf8)!
        
        XCTAssertThrowsError(try cryptographyService.decryptData(invalidEncryptedData, with: keyPair.privateKey))
    }
    
    // MARK: - Integration Tests
    
    func testCompleteWorkflow() throws {
        // Generate keys for signing and encryption
        let signingKeyPair = try cryptographyService.generateKeyPairForSigning()
        let encryptionKeyPair = try cryptographyService.generateKeyPairForEncryption()
        
        // Store keys in keychain
        try cryptographyService.storePrivateKey(signingKeyPair.privateKey, for: "signing-key")
        try cryptographyService.storePrivateKey(encryptionKeyPair.privateKey, for: "encryption-key")
        
        // Retrieve keys from keychain
        let retrievedSigningKey = try cryptographyService.retrievePrivateKey(for: "signing-key")
        let retrievedEncryptionKey = try cryptographyService.retrievePrivateKey(for: "encryption-key")
        
        XCTAssertEqual(signingKeyPair.privateKey, retrievedSigningKey)
        XCTAssertEqual(encryptionKeyPair.privateKey, retrievedEncryptionKey)
        
        // Test signing with retrieved key
        let message = "Test message for complete workflow"
        let signature = try cryptographyService.signMessage(message, with: retrievedSigningKey!)
        let isValidSignature = try cryptographyService.verifyMessageSignature(signature, for: message, with: signingKeyPair.publicKey)
        XCTAssertTrue(isValidSignature)
        
        // Test encryption with retrieved key
        let secretMessage = "Secret message for encryption test"
        let encryptedMessage = try cryptographyService.encryptMessage(secretMessage, with: encryptionKeyPair.publicKey)
        let decryptedMessage = try cryptographyService.decryptMessage(encryptedMessage, with: retrievedEncryptionKey!)
        XCTAssertEqual(secretMessage, decryptedMessage)
        
        // Clean up
        try cryptographyService.deletePrivateKey(for: "signing-key")
        try cryptographyService.deletePrivateKey(for: "encryption-key")
    }
    
    func testConcurrentOperations() throws {
        let keyPair = try cryptographyService.generateKeyPair()
        let testMessage = "Concurrent test message"
        let expectation = XCTestExpectation(description: "Concurrent operations")
        expectation.expectedFulfillmentCount = 10
        
        // Perform multiple signing operations concurrently
        DispatchQueue.concurrentPerform(iterations: 10) { _ in
            do {
                let signature = try self.cryptographyService.signMessage(testMessage, with: keyPair.privateKey)
                let isValid = try self.cryptographyService.verifyMessageSignature(signature, for: testMessage, with: keyPair.publicKey)
                XCTAssertTrue(isValid)
                expectation.fulfill()
            } catch {
                XCTFail("Concurrent operation failed: \(error)")
            }
        }
        
        wait(for: [expectation], timeout: 5.0)
    }
    
    // MARK: - Performance Tests
    
    func testPerformanceKeyGeneration() throws {
        measure {
            do {
                _ = try cryptographyService.generateKeyPair()
            } catch {
                XCTFail("Key generation failed: \(error)")
            }
        }
    }
    
    func testPerformanceSigning() throws {
        let keyPair = try cryptographyService.generateKeyPair()
        let testData = "Performance test data".data(using: .utf8)!
        
        measure {
            do {
                _ = try cryptographyService.signData(testData, with: keyPair.privateKey)
            } catch {
                XCTFail("Signing failed: \(error)")
            }
        }
    }
    
    func testPerformanceEncryption() throws {
        let keyPair = try cryptographyService.generateKeyPairForEncryption()
        let testData = "Performance test data for encryption".data(using: .utf8)!
        
        measure {
            do {
                _ = try cryptographyService.encryptData(testData, with: keyPair.publicKey)
            } catch {
                XCTFail("Encryption failed: \(error)")
            }
        }
    }
    
    func testPerformanceHashing() {
        let testData = "Performance test data for hashing".data(using: .utf8)!
        
        measure {
            _ = cryptographyService.hashData(testData)
        }
    }
}