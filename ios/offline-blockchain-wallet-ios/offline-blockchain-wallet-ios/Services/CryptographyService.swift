//
//  CryptographyService.swift
//  offline-blockchain-wallet-ios
//
//  Created by Kiro on 7/21/25.
//

import Foundation
import CryptoKit
import CryptoSwift
import KeychainAccess

protocol CryptographyServiceProtocol {
    // Key pair generation and management
    func generateKeyPair() throws -> (privateKey: String, publicKey: String)
    func generateKeyPairForSigning() throws -> (privateKey: String, publicKey: String)
    func generateKeyPairForEncryption() throws -> (privateKey: String, publicKey: String)
    
    // Digital signatures
    func signData(_ data: Data, with privateKey: String) throws -> String
    func verifySignature(_ signature: String, for data: Data, with publicKey: String) throws -> Bool
    func signMessage(_ message: String, with privateKey: String) throws -> String
    func verifyMessageSignature(_ signature: String, for message: String, with publicKey: String) throws -> Bool
    
    // Encryption and decryption
    func encryptData(_ data: Data, with publicKey: String) throws -> Data
    func decryptData(_ encryptedData: Data, with privateKey: String) throws -> Data
    func encryptMessage(_ message: String, with publicKey: String) throws -> String
    func decryptMessage(_ encryptedMessage: String, with privateKey: String) throws -> String
    
    // Keychain storage
    func storePrivateKey(_ privateKey: String, for identifier: String) throws
    func retrievePrivateKey(for identifier: String) throws -> String?
    func deletePrivateKey(for identifier: String) throws
    func keyExists(for identifier: String) -> Bool
    
    // Hash functions
    func hashData(_ data: Data) -> String
    func hashMessage(_ message: String) -> String
    
    // Key validation
    func validatePrivateKey(_ privateKey: String) -> Bool
    func validatePublicKey(_ publicKey: String) -> Bool
    func validateKeyPair(privateKey: String, publicKey: String) -> Bool
}

class CryptographyService: CryptographyServiceProtocol {
    private let keychain = Keychain(service: "com.offlineblockchainwallet.keys")
        .synchronizable(false)
        .accessibility(.whenUnlockedThisDeviceOnly)
    
    // MARK: - Key Generation
    
    func generateKeyPair() throws -> (privateKey: String, publicKey: String) {
        return try generateKeyPairForSigning()
    }
    
    func generateKeyPairForSigning() throws -> (privateKey: String, publicKey: String) {
        let privateKey = P256.Signing.PrivateKey()
        let publicKey = privateKey.publicKey
        
        let privateKeyData = privateKey.rawRepresentation
        let publicKeyData = publicKey.rawRepresentation
        
        return (
            privateKey: privateKeyData.base64EncodedString(),
            publicKey: publicKeyData.base64EncodedString()
        )
    }
    
    func generateKeyPairForEncryption() throws -> (privateKey: String, publicKey: String) {
        let privateKey = P256.KeyAgreement.PrivateKey()
        let publicKey = privateKey.publicKey
        
        let privateKeyData = privateKey.rawRepresentation
        let publicKeyData = publicKey.rawRepresentation
        
        return (
            privateKey: privateKeyData.base64EncodedString(),
            publicKey: publicKeyData.base64EncodedString()
        )
    }
    
    // MARK: - Digital Signatures
    
    func signData(_ data: Data, with privateKey: String) throws -> String {
        guard let privateKeyData = Data(base64Encoded: privateKey) else {
            throw CryptographyError.invalidPrivateKey
        }
        
        let key = try P256.Signing.PrivateKey(rawRepresentation: privateKeyData)
        let signature = try key.signature(for: data)
        
        return signature.rawRepresentation.base64EncodedString()
    }
    
    func verifySignature(_ signature: String, for data: Data, with publicKey: String) throws -> Bool {
        guard let signatureData = Data(base64Encoded: signature),
              let publicKeyData = Data(base64Encoded: publicKey) else {
            throw CryptographyError.invalidSignature
        }
        
        let key = try P256.Signing.PublicKey(rawRepresentation: publicKeyData)
        let sig = try P256.Signing.ECDSASignature(rawRepresentation: signatureData)
        
        return key.isValidSignature(sig, for: data)
    }
    
    func signMessage(_ message: String, with privateKey: String) throws -> String {
        guard let messageData = message.data(using: .utf8) else {
            throw CryptographyError.invalidData
        }
        return try signData(messageData, with: privateKey)
    }
    
    func verifyMessageSignature(_ signature: String, for message: String, with publicKey: String) throws -> Bool {
        guard let messageData = message.data(using: .utf8) else {
            throw CryptographyError.invalidData
        }
        return try verifySignature(signature, for: messageData, with: publicKey)
    }
    
    // MARK: - Encryption and Decryption
    
    func encryptData(_ data: Data, with publicKey: String) throws -> Data {
        guard let publicKeyData = Data(base64Encoded: publicKey) else {
            throw CryptographyError.invalidPublicKey
        }
        
        let key = try P256.KeyAgreement.PublicKey(rawRepresentation: publicKeyData)
        let ephemeralKey = P256.KeyAgreement.PrivateKey()
        let sharedSecret = try ephemeralKey.sharedSecretFromKeyAgreement(with: key)
        
        let symmetricKey = sharedSecret.hkdfDerivedSymmetricKey(
            using: SHA256.self,
            salt: Data(),
            sharedInfo: Data(),
            outputByteCount: 32
        )
        
        let sealedBox = try AES.GCM.seal(data, using: symmetricKey)
        
        var result = Data()
        result.append(ephemeralKey.publicKey.rawRepresentation)
        result.append(sealedBox.combined!)
        
        return result
    }
    
    func decryptData(_ encryptedData: Data, with privateKey: String) throws -> Data {
        guard let privateKeyData = Data(base64Encoded: privateKey) else {
            throw CryptographyError.invalidPrivateKey
        }
        
        let privateKey = try P256.KeyAgreement.PrivateKey(rawRepresentation: privateKeyData)
        
        let ephemeralPublicKeyData = encryptedData.prefix(32)
        let sealedBoxData = encryptedData.dropFirst(32)
        
        let ephemeralPublicKey = try P256.KeyAgreement.PublicKey(rawRepresentation: ephemeralPublicKeyData)
        let sharedSecret = try privateKey.sharedSecretFromKeyAgreement(with: ephemeralPublicKey)
        
        let symmetricKey = sharedSecret.hkdfDerivedSymmetricKey(
            using: SHA256.self,
            salt: Data(),
            sharedInfo: Data(),
            outputByteCount: 32
        )
        
        let sealedBox = try AES.GCM.SealedBox(combined: sealedBoxData)
        return try AES.GCM.open(sealedBox, using: symmetricKey)
    }
    
    func encryptMessage(_ message: String, with publicKey: String) throws -> String {
        guard let messageData = message.data(using: .utf8) else {
            throw CryptographyError.invalidData
        }
        let encryptedData = try encryptData(messageData, with: publicKey)
        return encryptedData.base64EncodedString()
    }
    
    func decryptMessage(_ encryptedMessage: String, with privateKey: String) throws -> String {
        guard let encryptedData = Data(base64Encoded: encryptedMessage) else {
            throw CryptographyError.invalidData
        }
        let decryptedData = try decryptData(encryptedData, with: privateKey)
        guard let message = String(data: decryptedData, encoding: .utf8) else {
            throw CryptographyError.decryptionFailed
        }
        return message
    }
    
    // MARK: - Keychain Storage
    
    func storePrivateKey(_ privateKey: String, for identifier: String) throws {
        do {
            try keychain.set(privateKey, key: identifier)
        } catch {
            throw CryptographyError.keychainError
        }
    }
    
    func retrievePrivateKey(for identifier: String) throws -> String? {
        do {
            return try keychain.get(identifier)
        } catch {
            throw CryptographyError.keychainError
        }
    }
    
    func deletePrivateKey(for identifier: String) throws {
        do {
            try keychain.remove(identifier)
        } catch {
            throw CryptographyError.keychainError
        }
    }
    
    func keyExists(for identifier: String) -> Bool {
        do {
            return try keychain.get(identifier) != nil
        } catch {
            return false
        }
    }
    
    // MARK: - Hash Functions
    
    func hashData(_ data: Data) -> String {
        let digest = SHA256.hash(data: data)
        return Data(digest).base64EncodedString()
    }
    
    func hashMessage(_ message: String) -> String {
        guard let messageData = message.data(using: .utf8) else {
            return ""
        }
        return hashData(messageData)
    }
    
    // MARK: - Key Validation
    
    func validatePrivateKey(_ privateKey: String) -> Bool {
        guard let privateKeyData = Data(base64Encoded: privateKey) else {
            return false
        }
        
        // Try to create a signing key from the data
        do {
            _ = try P256.Signing.PrivateKey(rawRepresentation: privateKeyData)
            return true
        } catch {
            // Try as encryption key
            do {
                _ = try P256.KeyAgreement.PrivateKey(rawRepresentation: privateKeyData)
                return true
            } catch {
                return false
            }
        }
    }
    
    func validatePublicKey(_ publicKey: String) -> Bool {
        guard let publicKeyData = Data(base64Encoded: publicKey) else {
            return false
        }
        
        // Try to create a signing public key from the data
        do {
            _ = try P256.Signing.PublicKey(rawRepresentation: publicKeyData)
            return true
        } catch {
            // Try as encryption public key
            do {
                _ = try P256.KeyAgreement.PublicKey(rawRepresentation: publicKeyData)
                return true
            } catch {
                return false
            }
        }
    }
    
    func validateKeyPair(privateKey: String, publicKey: String) -> Bool {
        guard validatePrivateKey(privateKey) && validatePublicKey(publicKey) else {
            return false
        }
        
        // Test if the keys work together by signing and verifying
        do {
            let testMessage = "test_validation_message"
            let signature = try signMessage(testMessage, with: privateKey)
            return try verifyMessageSignature(signature, for: testMessage, with: publicKey)
        } catch {
            return false
        }
    }
}

enum CryptographyError: Error, LocalizedError {
    case invalidPrivateKey
    case invalidPublicKey
    case invalidSignature
    case invalidData
    case keyGenerationFailed
    case encryptionFailed
    case decryptionFailed
    case keychainError
    case signatureVerificationFailed
    case keyValidationFailed
    
    var errorDescription: String? {
        switch self {
        case .invalidPrivateKey:
            return "Invalid private key format"
        case .invalidPublicKey:
            return "Invalid public key format"
        case .invalidSignature:
            return "Invalid signature format"
        case .invalidData:
            return "Invalid data format"
        case .keyGenerationFailed:
            return "Failed to generate cryptographic keys"
        case .encryptionFailed:
            return "Failed to encrypt data"
        case .decryptionFailed:
            return "Failed to decrypt data"
        case .keychainError:
            return "Keychain operation failed"
        case .signatureVerificationFailed:
            return "Signature verification failed"
        case .keyValidationFailed:
            return "Key validation failed"
        }
    }
}