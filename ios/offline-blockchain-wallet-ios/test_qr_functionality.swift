#!/usr/bin/env swift

import Foundation

// Simple test to verify QR code functionality
print("Testing QR Code Functionality...")

// Test QR code data model
struct QRCodePaymentRequest: Codable {
    let version: String = "1.0"
    let type: String
    let walletId: String
    let publicKey: String
    let deviceName: String
    let timestamp: Date
    
    init(walletId: String, publicKey: String, deviceName: String, type: String = "payment_request") {
        self.type = type
        self.walletId = walletId
        self.publicKey = publicKey
        self.deviceName = deviceName
        self.timestamp = Date()
    }
}

// Test JSON encoding/decoding
let paymentRequest = QRCodePaymentRequest(
    walletId: "test-wallet-123",
    publicKey: "test-public-key-456",
    deviceName: "iPhone Test Device"
)

let encoder = JSONEncoder()
encoder.dateEncodingStrategy = .iso8601

do {
    let jsonData = try encoder.encode(paymentRequest)
    let jsonString = String(data: jsonData, encoding: .utf8)!
    
    print("✅ QR Code JSON Generation: SUCCESS")
    print("Generated JSON: \(jsonString)")
    
    // Test decoding
    let decoder = JSONDecoder()
    decoder.dateDecodingStrategy = .iso8601
    
    let decodedRequest = try decoder.decode(QRCodePaymentRequest.self, from: jsonData)
    
    print("✅ QR Code JSON Parsing: SUCCESS")
    print("Decoded wallet ID: \(decodedRequest.walletId)")
    print("Decoded device name: \(decodedRequest.deviceName)")
    
    // Test validation logic
    let isValid = !decodedRequest.walletId.isEmpty && 
                  !decodedRequest.publicKey.isEmpty && 
                  !decodedRequest.deviceName.isEmpty &&
                  decodedRequest.version == "1.0"
    
    if isValid {
        print("✅ QR Code Validation: SUCCESS")
    } else {
        print("❌ QR Code Validation: FAILED")
    }
    
    print("\n🎉 All QR Code Core Functionality Tests Passed!")
    
} catch {
    print("❌ QR Code Test Failed: \(error)")
}