//
//  QRCodeService.swift
//  offline-blockchain-wallet-ios
//
//  Created by Kiro on 7/21/25.
//

import Foundation
import SwiftUI
import QRCode

protocol QRCodeServiceProtocol {
    func generatePaymentRequestQR(walletId: String, publicKey: String, deviceName: String, paymentInfo: PaymentRequestInfo?, options: QRCodeGenerationOptions) throws -> Data
    func generateConnectionRequestQR(walletId: String, publicKey: String, deviceName: String, options: QRCodeGenerationOptions) throws -> Data
    func validateQRCode(_ qrString: String) -> QRCodeValidationResult
    func parseQRCodeData(_ qrString: String) throws -> QRCodePaymentRequest
}

class QRCodeService: QRCodeServiceProtocol {
    private let cryptographyService: CryptographyServiceProtocol
    private let logger: LoggerProtocol
    
    init(cryptographyService: CryptographyServiceProtocol, logger: LoggerProtocol) {
        self.cryptographyService = cryptographyService
        self.logger = logger
    }
    
    // MARK: - QR Code Generation
    
    func generatePaymentRequestQR(walletId: String, 
                                publicKey: String, 
                                deviceName: String, 
                                paymentInfo: PaymentRequestInfo?, 
                                options: QRCodeGenerationOptions) throws -> Data {
        
        let bluetoothInfo = BluetoothConnectionInfo()
        let paymentRequest = QRCodePaymentRequest(
            walletId: walletId,
            publicKey: publicKey,
            deviceName: deviceName,
            bluetoothInfo: bluetoothInfo,
            paymentInfo: paymentInfo
        )
        
        return try generateQRImage(for: paymentRequest, options: options)
    }
    
    func generateConnectionRequestQR(walletId: String, 
                                   publicKey: String, 
                                   deviceName: String, 
                                   options: QRCodeGenerationOptions) throws -> Data {
        
        let bluetoothInfo = BluetoothConnectionInfo()
        let connectionRequest = QRCodePaymentRequest(
            walletId: walletId,
            publicKey: publicKey,
            deviceName: deviceName,
            bluetoothInfo: bluetoothInfo,
            paymentInfo: nil
        )
        
        return try generateQRImage(for: connectionRequest, options: options)
    }
    
    private func generateQRImage(for paymentRequest: QRCodePaymentRequest, options: QRCodeGenerationOptions) throws -> Data {
        // Encode the payment request to JSON
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        
        let jsonData = try encoder.encode(paymentRequest)
        guard let jsonString = String(data: jsonData, encoding: .utf8) else {
            throw QRCodeServiceError.encodingFailed
        }
        
        logger.log("Generating QR code with data: \(jsonString)", level: .debug)
        
        // Create QR code
        let qrCode = QRCode.Document(utf8String: jsonString)
        qrCode.errorCorrection = mapCorrectionLevel(options.correctionLevel)
        
        // Configure design
        qrCode.design.backgroundColor(CGColor.from(hex: options.backgroundColor))
        qrCode.design.foregroundColor(CGColor.from(hex: options.foregroundColor))
        
        // Generate PNG data
        guard let pngData = qrCode.pngData(dimension: Int(options.size.width)) else {
            throw QRCodeServiceError.generationFailed
        }
        
        return pngData
    }
    
    // MARK: - QR Code Validation and Parsing
    
    func validateQRCode(_ qrString: String) -> QRCodeValidationResult {
        do {
            let paymentRequest = try parseQRCodeData(qrString)
            
            // Validate version
            guard paymentRequest.version == "1.0" else {
                return QRCodeValidationResult(isValid: false, error: .unsupportedVersion)
            }
            
            // Validate required fields
            guard !paymentRequest.walletId.isEmpty,
                  !paymentRequest.publicKey.isEmpty,
                  !paymentRequest.deviceName.isEmpty else {
                return QRCodeValidationResult(isValid: false, error: .missingRequiredFields)
            }
            
            // Validate expiration if payment info exists
            if let paymentInfo = paymentRequest.paymentInfo,
               let expirationTime = paymentInfo.expirationTime,
               Date() > expirationTime {
                return QRCodeValidationResult(isValid: false, error: .expiredRequest)
            }
            
            // Validate signature if present
            if let signature = paymentRequest.signature {
                let isValidSignature = validateSignature(for: paymentRequest, signature: signature)
                if !isValidSignature {
                    return QRCodeValidationResult(isValid: false, error: .invalidSignature)
                }
            }
            
            logger.log("QR code validation successful for wallet: \(paymentRequest.walletId)", level: .info)
            return QRCodeValidationResult(isValid: true, paymentRequest: paymentRequest)
            
        } catch {
            logger.log("QR code validation failed: \(error.localizedDescription)", level: .error)
            
            if error is DecodingError {
                return QRCodeValidationResult(isValid: false, error: .invalidFormat)
            } else if let qrError = error as? QRCodeValidationError {
                return QRCodeValidationResult(isValid: false, error: qrError)
            } else {
                return QRCodeValidationResult(isValid: false, error: .corruptedData)
            }
        }
    }
    
    func parseQRCodeData(_ qrString: String) throws -> QRCodePaymentRequest {
        guard let jsonData = qrString.data(using: .utf8) else {
            throw QRCodeValidationError.invalidFormat
        }
        
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        
        do {
            let paymentRequest = try decoder.decode(QRCodePaymentRequest.self, from: jsonData)
            return paymentRequest
        } catch {
            logger.log("Failed to parse QR code data: \(error.localizedDescription)", level: .error)
            throw QRCodeValidationError.invalidFormat
        }
    }
    
    // MARK: - Private Helper Methods
    
    private func validateSignature(for paymentRequest: QRCodePaymentRequest, signature: String) -> Bool {
        // Create data to verify (excluding signature field)
        var requestForSigning = paymentRequest
        requestForSigning = QRCodePaymentRequest(
            walletId: requestForSigning.walletId,
            publicKey: requestForSigning.publicKey,
            deviceName: requestForSigning.deviceName,
            bluetoothInfo: requestForSigning.bluetoothInfo,
            paymentInfo: requestForSigning.paymentInfo,
            signature: nil
        )
        
        do {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            let dataToVerify = try encoder.encode(requestForSigning)
            
            let isValid = try cryptographyService.verifySignature(
                signature,
                for: dataToVerify,
                with: paymentRequest.publicKey
            )
            return isValid
        } catch {
            logger.log("Signature validation failed: \(error.localizedDescription)", level: .error)
            return false
        }
    }
    
    private func mapCorrectionLevel(_ level: QRCodeCorrectionLevel) -> QRCode.ErrorCorrection {
        switch level {
        case .low:
            return .low
        case .medium:
            return .medium
        case .quartile:
            return .quantize
        case .high:
            return .high
        }
    }
}

// MARK: - Supporting Extensions

extension CGColor {
    static func from(hex: String) -> CGColor {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        
        return CGColor(
            red: CGFloat(r) / 255,
            green: CGFloat(g) / 255,
            blue: CGFloat(b) / 255,
            alpha: CGFloat(a) / 255
        )
    }
}

// MARK: - Error Types

enum QRCodeServiceError: Error, LocalizedError {
    case encodingFailed
    case generationFailed
    case invalidData
    
    var errorDescription: String? {
        switch self {
        case .encodingFailed:
            return "Failed to encode QR code data"
        case .generationFailed:
            return "Failed to generate QR code image"
        case .invalidData:
            return "Invalid data provided for QR code generation"
        }
    }
}
