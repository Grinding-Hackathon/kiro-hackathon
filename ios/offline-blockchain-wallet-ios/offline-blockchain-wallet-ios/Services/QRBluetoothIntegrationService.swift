//
//  QRBluetoothIntegrationService.swift
//  offline-blockchain-wallet-ios
//
//  Created by Kiro on 7/21/25.
//

import Foundation
import Combine

protocol QRBluetoothIntegrationServiceProtocol {
    func initiateConnectionFromQR(_ paymentRequest: QRCodePaymentRequest) async throws -> BluetoothConnection
    func prepareForIncomingConnection(_ paymentRequest: QRCodePaymentRequest) async throws
    func handleQRCodeScanned(_ paymentRequest: QRCodePaymentRequest) async throws -> QRConnectionResult
}

class QRBluetoothIntegrationService: QRBluetoothIntegrationServiceProtocol {
    private let bluetoothService: BluetoothServiceProtocol
    private let qrCodeService: QRCodeServiceProtocol
    private let logger: LoggerProtocol
    
    @Published var connectionStatus: QRConnectionStatus = .idle
    
    init(bluetoothService: BluetoothServiceProtocol, 
         qrCodeService: QRCodeServiceProtocol, 
         logger: LoggerProtocol) {
        self.bluetoothService = bluetoothService
        self.qrCodeService = qrCodeService
        self.logger = logger
    }
    
    // MARK: - QR Code to Bluetooth Connection
    
    func initiateConnectionFromQR(_ paymentRequest: QRCodePaymentRequest) async throws -> BluetoothConnection {
        logger.log("Initiating Bluetooth connection from QR code for wallet: \(paymentRequest.walletId)", level: .info)
        
        connectionStatus = .connecting
        
        do {
            // Validate QR code data
            let validationResult = qrCodeService.validateQRCode(encodePaymentRequest(paymentRequest))
            guard validationResult.isValid else {
                throw QRBluetoothIntegrationError.invalidQRCode(validationResult.error)
            }
            
            // Create Bluetooth device info from QR data
            let bluetoothDevice = createBluetoothDevice(from: paymentRequest)
            
            // Attempt to connect to the device
            let connection = try await bluetoothService.connectToDevice(bluetoothDevice)
            
            connectionStatus = .connected(connection)
            logger.log("Successfully connected to device via QR code", level: .info)
            
            return connection
            
        } catch {
            connectionStatus = .failed(error)
            logger.log("Failed to connect via QR code: \(error.localizedDescription)", level: .error)
            throw error
        }
    }
    
    func prepareForIncomingConnection(_ paymentRequest: QRCodePaymentRequest) async throws {
        logger.log("Preparing for incoming Bluetooth connection from QR code", level: .info)
        
        connectionStatus = .waitingForConnection
        
        do {
            // Create wallet info for advertising
            let walletInfo = WalletInfo(
                walletId: paymentRequest.walletId,
                publicKey: paymentRequest.publicKey,
                deviceName: paymentRequest.deviceName
            )
            
            // Start advertising for incoming connections
            try bluetoothService.startAdvertising(walletInfo: walletInfo)
            
            logger.log("Started advertising for incoming connections", level: .info)
            
        } catch {
            connectionStatus = .failed(error)
            logger.log("Failed to prepare for incoming connection: \(error.localizedDescription)", level: .error)
            throw error
        }
    }
    
    func handleQRCodeScanned(_ paymentRequest: QRCodePaymentRequest) async throws -> QRConnectionResult {
        logger.log("Handling scanned QR code for wallet: \(paymentRequest.walletId)", level: .info)
        
        // Determine the action based on QR code type
        switch paymentRequest.type {
        case .paymentRequest:
            return try await handlePaymentRequest(paymentRequest)
        case .connectionRequest:
            return try await handleConnectionRequest(paymentRequest)
        case .tokenTransfer:
            return try await handleTokenTransfer(paymentRequest)
        }
    }
    
    // MARK: - Private Helper Methods
    
    private func handlePaymentRequest(_ paymentRequest: QRCodePaymentRequest) async throws -> QRConnectionResult {
        // For payment requests, we initiate the connection as the sender
        let connection = try await initiateConnectionFromQR(paymentRequest)
        
        return QRConnectionResult(
            type: .paymentInitiated,
            connection: connection,
            paymentRequest: paymentRequest,
            role: .sender
        )
    }
    
    private func handleConnectionRequest(_ paymentRequest: QRCodePaymentRequest) async throws -> QRConnectionResult {
        // For connection requests, we prepare to receive a connection
        try await prepareForIncomingConnection(paymentRequest)
        
        return QRConnectionResult(
            type: .connectionPrepared,
            connection: nil,
            paymentRequest: paymentRequest,
            role: .receiver
        )
    }
    
    private func handleTokenTransfer(_ paymentRequest: QRCodePaymentRequest) async throws -> QRConnectionResult {
        // For token transfers, we initiate connection to receive tokens
        let connection = try await initiateConnectionFromQR(paymentRequest)
        
        return QRConnectionResult(
            type: .tokenTransferInitiated,
            connection: connection,
            paymentRequest: paymentRequest,
            role: .receiver
        )
    }
    
    private func createBluetoothDevice(from paymentRequest: QRCodePaymentRequest) -> BluetoothDevice {
        let walletInfo = WalletInfo(
            walletId: paymentRequest.walletId,
            publicKey: paymentRequest.publicKey,
            deviceName: paymentRequest.deviceName
        )
        
        return BluetoothDevice(
            id: paymentRequest.bluetoothInfo.deviceIdentifier ?? paymentRequest.walletId,
            name: paymentRequest.deviceName,
            rssi: 0, // Will be updated during scanning
            walletInfo: walletInfo
        )
    }
    
    private func encodePaymentRequest(_ paymentRequest: QRCodePaymentRequest) -> String {
        do {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            let data = try encoder.encode(paymentRequest)
            return String(data: data, encoding: .utf8) ?? ""
        } catch {
            logger.log("Failed to encode payment request: \(error.localizedDescription)", level: .error)
            return ""
        }
    }
}

// MARK: - Supporting Types

enum QRConnectionStatus {
    case idle
    case connecting
    case waitingForConnection
    case connected(BluetoothConnection)
    case failed(Error)
}

struct QRConnectionResult {
    let type: QRConnectionType
    let connection: BluetoothConnection?
    let paymentRequest: QRCodePaymentRequest
    let role: ConnectionRole
}

enum QRConnectionType {
    case paymentInitiated
    case connectionPrepared
    case tokenTransferInitiated
}

enum ConnectionRole {
    case sender
    case receiver
}

enum QRBluetoothIntegrationError: Error, LocalizedError {
    case invalidQRCode(QRCodeValidationError?)
    case bluetoothUnavailable
    case connectionTimeout
    case deviceNotFound
    case authenticationFailed
    
    var errorDescription: String? {
        switch self {
        case .invalidQRCode(let qrError):
            return "Invalid QR code: \(qrError?.localizedDescription ?? "Unknown error")"
        case .bluetoothUnavailable:
            return "Bluetooth is not available"
        case .connectionTimeout:
            return "Connection timed out"
        case .deviceNotFound:
            return "Device not found"
        case .authenticationFailed:
            return "Authentication failed"
        }
    }
}