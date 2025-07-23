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
    }
    
    override func tearDownWithError() throws {
        cryptographyService = nil
    }
    
    func testKeyPairGeneration() throws {
        // Test key pair generation
        let keyPair = try cryptographyService.generateKeyPair()
        
        XCTAssertFalse(keyPair.privateKey.isEmpty)
        XCTAssertFalse(keyPair.publicKey.isEmpty)
        XCTAssertNotEqual(keyPair.privateKey, keyPair.publicKey)
        
        // Test that generated keys are valid base64
        XCTAssertNotNil(Data(base64Encoded: keyPair.privateKey))
        XCTAssertNotNil(Data(base64Encoded: keyPair.publicKey))
    }
    
    func testSignAndVerify() throws {
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
    
    func testEncryptAndDecrypt() throws {
        // Generate key pair
        let keyPair = try cryptographyService.generateKeyPair()
        
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
    
    func testKeychainStorage() throws {
        let testKey = "test-key-\(UUID().uuidString)"
        let testPrivateKey = "test-private-key-data"
        
        // Store key
        try cryptographyService.storePrivateKey(testPrivateKey, for: testKey)
        
        // Retrieve key
        let retrievedKey = try cryptographyService.retrievePrivateKey(for: testKey)
        XCTAssertEqual(testPrivateKey, retrievedKey)
        
        // Delete key
        try cryptographyService.deletePrivateKey(for: testKey)
        
        // Verify deletion
        let deletedKey = try cryptographyService.retrievePrivateKey(for: testKey)
        XCTAssertNil(deletedKey)
    }
    
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
}