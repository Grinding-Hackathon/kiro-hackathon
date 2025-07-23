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
    func generateKeyPair() throws -> (privateKey: String, publicKey: String)
    func signData(_ data: Data, with privateKey: String) throws -> String
    func verifySignature(_ signature: String, for data: Data, with publicKey: String) throws -> Bool
    func encryptData(_ data: Data, with publicKey: String) throws -> Data
    func decryptData(_ encryptedData: Data, with privateKey: String) throws -> Data
    func storePrivateKey(_ privateKey: String, for identifier: String) throws
    func retrievePrivateKey(for identifier: String) throws -> String?
    func deletePrivateKey(for identifier: String) throws
}

class CryptographyService: CryptographyServiceProtocol {
    private let keychain = Keychain(service: "com.offlineblockchainwallet.keys")
    
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
    
    func storePrivateKey(_ privateKey: String, for identifier: String) throws {
        try keychain.set(privateKey, key: identifier)
    }
    
    func retrievePrivateKey(for identifier: String) throws -> String? {
        return try keychain.get(identifier)
    }
    
    func deletePrivateKey(for identifier: String) throws {
        try keychain.remove(identifier)
    }
}

enum CryptographyError: Error {
    case invalidPrivateKey
    case invalidPublicKey
    case invalidSignature
    case keyGenerationFailed
    case encryptionFailed
    case decryptionFailed
    case keychainError
}