//
//  QRCodeData.swift
//  offline-blockchain-wallet-ios
//
//  Created by Kiro on 7/21/25.
//

import Foundation

// MARK: - QR Code Data Models

/// Main QR code data structure for payment requests
struct QRCodePaymentRequest: Codable {
    let version: String = "1.0"
    let type: QRCodeType
    let walletId: String
    let publicKey: String
    let deviceName: String
    let bluetoothInfo: BluetoothConnectionInfo
    let paymentInfo: PaymentRequestInfo?
    let timestamp: Date
    let signature: String?
    
    init(walletId: String, 
         publicKey: String, 
         deviceName: String, 
         bluetoothInfo: BluetoothConnectionInfo, 
         paymentInfo: PaymentRequestInfo? = nil,
         signature: String? = nil) {
        self.type = paymentInfo != nil ? .paymentRequest : .connectionRequest
        self.walletId = walletId
        self.publicKey = publicKey
        self.deviceName = deviceName
        self.bluetoothInfo = bluetoothInfo
        self.paymentInfo = paymentInfo
        self.timestamp = Date()
        self.signature = signature
    }
}

/// QR code types supported by the wallet
enum QRCodeType: String, Codable, CaseIterable {
    case paymentRequest = "payment_request"
    case connectionRequest = "connection_request"
    case tokenTransfer = "token_transfer"
}

/// Bluetooth connection information for QR codes
struct BluetoothConnectionInfo: Codable {
    let serviceUUID: String
    let characteristicUUID: String
    let deviceIdentifier: String?
    let connectionTimeout: TimeInterval
    
    init(serviceUUID: String = "12345678-1234-1234-1234-123456789ABC",
         characteristicUUID: String = "87654321-4321-4321-4321-CBA987654321",
         deviceIdentifier: String? = nil,
         connectionTimeout: TimeInterval = 30.0) {
        self.serviceUUID = serviceUUID
        self.characteristicUUID = characteristicUUID
        self.deviceIdentifier = deviceIdentifier
        self.connectionTimeout = connectionTimeout
    }
}

/// Payment request information embedded in QR codes
struct PaymentRequestInfo: Codable {
    let requestedAmount: Double?
    let currency: String
    let description: String?
    let expirationTime: Date?
    let requiresExactAmount: Bool
    
    init(requestedAmount: Double? = nil,
         currency: String = "OT",
         description: String? = nil,
         expirationTime: Date? = nil,
         requiresExactAmount: Bool = false) {
        self.requestedAmount = requestedAmount
        self.currency = currency
        self.description = description
        self.expirationTime = expirationTime
        self.requiresExactAmount = requiresExactAmount
    }
}

// MARK: - QR Code Validation Result

struct QRCodeValidationResult {
    let isValid: Bool
    let paymentRequest: QRCodePaymentRequest?
    let error: QRCodeValidationError?
    
    init(isValid: Bool, paymentRequest: QRCodePaymentRequest? = nil, error: QRCodeValidationError? = nil) {
        self.isValid = isValid
        self.paymentRequest = paymentRequest
        self.error = error
    }
}

enum QRCodeValidationError: Error, LocalizedError {
    case invalidFormat
    case unsupportedVersion
    case expiredRequest
    case invalidSignature
    case missingRequiredFields
    case corruptedData
    case unsupportedType
    
    var errorDescription: String? {
        switch self {
        case .invalidFormat:
            return "QR code format is invalid"
        case .unsupportedVersion:
            return "QR code version is not supported"
        case .expiredRequest:
            return "Payment request has expired"
        case .invalidSignature:
            return "QR code signature is invalid"
        case .missingRequiredFields:
            return "Required fields are missing from QR code"
        case .corruptedData:
            return "QR code data is corrupted"
        case .unsupportedType:
            return "QR code type is not supported"
        }
    }
}

// MARK: - QR Code Generation Options

struct QRCodeGenerationOptions {
    let size: CGSize
    let correctionLevel: QRCodeCorrectionLevel
    let backgroundColor: String
    let foregroundColor: String
    let includeMargin: Bool
    
    init(size: CGSize = CGSize(width: 200, height: 200),
         correctionLevel: QRCodeCorrectionLevel = .medium,
         backgroundColor: String = "#FFFFFF",
         foregroundColor: String = "#000000",
         includeMargin: Bool = true) {
        self.size = size
        self.correctionLevel = correctionLevel
        self.backgroundColor = backgroundColor
        self.foregroundColor = foregroundColor
        self.includeMargin = includeMargin
    }
}

enum QRCodeCorrectionLevel: String, CaseIterable {
    case low = "L"
    case medium = "M"
    case quartile = "Q"
    case high = "H"
}