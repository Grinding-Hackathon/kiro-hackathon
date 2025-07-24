#!/usr/bin/env swift

import Foundation
import CryptoKit

// Simplified version of CryptographyService for standalone testing
class SimpleCryptographyService {
    func generateKeyPair() throws -> (privateKey: String, publicKey: String) {
        let privateKey = P256.Signing.PrivateKey()
        let publicKey = privateKey.publicKey
        
        let privateKeyData = privateKey.rawRepresentation
        let publicKeyData = publicKey.rawRepresentation
        
        return (
            privateKey: privateKeyData.base64EncodedString(),
            publicKey: publicKeyData.base64EncodedString()
        )
    }
    
    func signData(_ data: Data, with privateKey: String) throws -> String {
        guard let privateKeyData = Data(base64Encoded: privateKey) else {
            throw NSError(domain: "CryptoError", code: 1, userInfo: [NSLocalizedDescriptionKey: "Invalid private key"])
        }
        
        let key = try P256.Signing.PrivateKey(rawRepresentation: privateKeyData)
        let signature = try key.signature(for: data)
        
        return signature.rawRepresentation.base64EncodedString()
    }
    
    func verifySignature(_ signature: String, for data: Data, with publicKey: String) throws -> Bool {
        guard let signatureData = Data(base64Encoded: signature),
              let publicKeyData = Data(base64Encoded: publicKey) else {
            throw NSError(domain: "CryptoError", code: 2, userInfo: [NSLocalizedDescriptionKey: "Invalid signature or public key"])
        }
        
        let key = try P256.Signing.PublicKey(rawRepresentation: publicKeyData)
        let sig = try P256.Signing.ECDSASignature(rawRepresentation: signatureData)
        
        return key.isValidSignature(sig, for: data)
    }
    
    func hashData(_ data: Data) -> String {
        let digest = SHA256.hash(data: data)
        return Data(digest).base64EncodedString()
    }
}

// Test the cryptographic service
func runCryptographyTests() {
    let service = SimpleCryptographyService()
    
    print("🔐 Testing Cryptography Service...")
    
    do {
        // Test 1: Key Generation
        print("✅ Test 1: Key Generation")
        let keyPair = try service.generateKeyPair()
        assert(!keyPair.privateKey.isEmpty, "Private key should not be empty")
        assert(!keyPair.publicKey.isEmpty, "Public key should not be empty")
        assert(keyPair.privateKey != keyPair.publicKey, "Private and public keys should be different")
        print("   ✓ Generated key pair successfully")
        
        // Test 2: Digital Signatures
        print("✅ Test 2: Digital Signatures")
        let testData = "Hello, Blockchain Wallet!".data(using: .utf8)!
        let signature = try service.signData(testData, with: keyPair.privateKey)
        assert(!signature.isEmpty, "Signature should not be empty")
        print("   ✓ Signed data successfully")
        
        let isValid = try service.verifySignature(signature, for: testData, with: keyPair.publicKey)
        assert(isValid, "Signature should be valid")
        print("   ✓ Verified signature successfully")
        
        // Test 3: Invalid signature verification
        let differentData = "Different data".data(using: .utf8)!
        let isInvalid = try service.verifySignature(signature, for: differentData, with: keyPair.publicKey)
        assert(!isInvalid, "Signature should be invalid for different data")
        print("   ✓ Correctly rejected invalid signature")
        
        // Test 4: Hash Functions
        print("✅ Test 3: Hash Functions")
        let hash1 = service.hashData(testData)
        let hash2 = service.hashData(testData)
        assert(hash1 == hash2, "Same data should produce same hash")
        assert(!hash1.isEmpty, "Hash should not be empty")
        
        let differentHash = service.hashData(differentData)
        assert(hash1 != differentHash, "Different data should produce different hash")
        print("   ✓ Hash functions working correctly")
        
        // Test 5: Multiple key pairs
        print("✅ Test 4: Multiple Key Pairs")
        let keyPair2 = try service.generateKeyPair()
        assert(keyPair.privateKey != keyPair2.privateKey, "Different key pairs should have different private keys")
        assert(keyPair.publicKey != keyPair2.publicKey, "Different key pairs should have different public keys")
        
        // Cross-verification should fail
        let isInvalidKey = try service.verifySignature(signature, for: testData, with: keyPair2.publicKey)
        assert(!isInvalidKey, "Signature should be invalid with wrong public key")
        print("   ✓ Multiple key pairs working correctly")
        
        print("\n🎉 All cryptography tests passed!")
        print("✅ Key pair generation: Working")
        print("✅ Digital signatures: Working")
        print("✅ Signature verification: Working")
        print("✅ Hash functions: Working")
        print("✅ Security validation: Working")
        
    } catch {
        print("❌ Test failed with error: \(error)")
        exit(1)
    }
}

// Run the tests
runCryptographyTests()