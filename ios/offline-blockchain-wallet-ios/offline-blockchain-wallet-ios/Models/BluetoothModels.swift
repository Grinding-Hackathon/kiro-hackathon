//
//  BluetoothModels.swift
//  offline-blockchain-wallet-ios
//
//  Created by Kiro on 7/21/25.
//

import Foundation
import CoreBluetooth
#if canImport(UIKit)
import UIKit
#endif

// MARK: - Bluetooth Device Model

/// Represents a discovered Bluetooth device
struct BluetoothDevice: Identifiable, Equatable {
    let id: String
    let name: String
    let rssi: Int
    let peripheral: CBPeripheral?
    let advertisementData: [String: Any]?
    let discoveredAt: Date
    
    init(peripheral: CBPeripheral, rssi: NSNumber, advertisementData: [String: Any]?) {
        self.id = peripheral.identifier.uuidString
        self.name = peripheral.name ?? "Unknown Device"
        self.rssi = rssi.intValue
        self.peripheral = peripheral
        self.advertisementData = advertisementData
        self.discoveredAt = Date()
    }
    
    // Alternative initializer for creating devices from QR code data
    init(id: String, name: String, rssi: Int = 0, peripheral: CBPeripheral? = nil, advertisementData: [String: Any]? = nil) {
        self.id = id
        self.name = name
        self.rssi = rssi
        self.peripheral = peripheral
        self.advertisementData = advertisementData
        self.discoveredAt = Date()
    }
    
    static func == (lhs: BluetoothDevice, rhs: BluetoothDevice) -> Bool {
        return lhs.id == rhs.id
    }
}

// MARK: - Bluetooth Connection Model

/// Represents an active Bluetooth connection
class BluetoothConnection: ObservableObject {
    let id: String
    let device: BluetoothDevice
    let peripheral: CBPeripheral?
    let central: CBCentral?
    
    @Published var isConnected: Bool = false
    @Published var connectionState: BluetoothConnectionState = .disconnected
    @Published var lastActivity: Date = Date()
    
    private let connectionTimeout: TimeInterval
    private var timeoutTimer: Timer?
    
    init(device: BluetoothDevice, peripheral: CBPeripheral? = nil, central: CBCentral? = nil, timeout: TimeInterval = 30.0) {
        self.id = device.id
        self.device = device
        self.peripheral = peripheral
        self.central = central
        self.connectionTimeout = timeout
        
        startTimeoutTimer()
    }
    
    func updateConnectionState(_ state: BluetoothConnectionState) {
        DispatchQueue.main.async {
            self.connectionState = state
            self.isConnected = (state == .connected)
            self.lastActivity = Date()
        }
        
        if state == .connected {
            resetTimeoutTimer()
        }
    }
    
    func updateActivity() {
        DispatchQueue.main.async {
            self.lastActivity = Date()
        }
        resetTimeoutTimer()
    }
    
    private func startTimeoutTimer() {
        timeoutTimer = Timer.scheduledTimer(withTimeInterval: connectionTimeout, repeats: false) { [weak self] _ in
            self?.handleTimeout()
        }
    }
    
    private func resetTimeoutTimer() {
        timeoutTimer?.invalidate()
        startTimeoutTimer()
    }
    
    private func handleTimeout() {
        DispatchQueue.main.async {
            self.connectionState = .timeout
            self.isConnected = false
        }
    }
    
    deinit {
        timeoutTimer?.invalidate()
    }
}

// MARK: - Connection State Enum

enum BluetoothConnectionState: String, CaseIterable {
    case disconnected = "disconnected"
    case connecting = "connecting"
    case connected = "connected"
    case disconnecting = "disconnecting"
    case timeout = "timeout"
    case error = "error"
}

// MARK: - Connection Status

enum BluetoothConnectionStatus: Equatable {
    case disconnected
    case connecting
    case connected(BluetoothConnection)
    case error(String)
    
    static func == (lhs: BluetoothConnectionStatus, rhs: BluetoothConnectionStatus) -> Bool {
        switch (lhs, rhs) {
        case (.disconnected, .disconnected),
             (.connecting, .connecting):
            return true
        case (.connected(let lhsConnection), .connected(let rhsConnection)):
            return lhsConnection.id == rhsConnection.id
        case (.error(let lhsError), .error(let rhsError)):
            return lhsError == rhsError
        default:
            return false
        }
    }
}

// MARK: - Wallet Info Model

/// Information about the local wallet for advertising
struct WalletInfo {
    let walletId: String
    let publicKey: String
    let deviceName: String
    let version: String
    let capabilities: [WalletCapability]
    
    init(walletId: String, publicKey: String, deviceName: String = {
        #if canImport(UIKit)
        return UIDevice.current.name
        #else
        return "Unknown Device"
        #endif
    }(), version: String = "1.0.0") {
        self.walletId = walletId
        self.publicKey = publicKey
        self.deviceName = deviceName
        self.version = version
        self.capabilities = [.offlineTokens, .qrCodePayments, .bluetoothTransfers]
    }
}

enum WalletCapability: String, CaseIterable, Codable {
    case offlineTokens = "offline_tokens"
    case qrCodePayments = "qr_payments"
    case bluetoothTransfers = "bluetooth_transfers"
    case tokenDivision = "token_division"
    case automaticSync = "automatic_sync"
}

// MARK: - Pending Transmission Model

/// Represents a data transmission in progress
class PendingTransmission {
    let id: String
    let data: Data
    let continuation: CheckedContinuation<Void, Error>
    var retryCount: Int
    let maxRetries: Int
    let timestamp: Date
    
    init(id: String, data: Data, continuation: CheckedContinuation<Void, Error>, retryCount: Int = 0, maxRetries: Int = 3) {
        self.id = id
        self.data = data
        self.continuation = continuation
        self.retryCount = retryCount
        self.maxRetries = maxRetries
        self.timestamp = Date()
    }
    
    func canRetry() -> Bool {
        return retryCount < maxRetries
    }
    
    func incrementRetry() {
        retryCount += 1
    }
}

// MARK: - Bluetooth Error Types

enum BluetoothError: Error, LocalizedError {
    case bluetoothUnavailable
    case bluetoothPoweredOff
    case deviceNotFound
    case connectionFailed
    case connectionTimeout
    case transmissionFailed
    case invalidData
    case peerVerificationFailed
    case serviceNotFound
    case characteristicNotFound
    case permissionDenied
    case unknownError(String)
    
    var errorDescription: String? {
        switch self {
        case .bluetoothUnavailable:
            return "Bluetooth is not available on this device"
        case .bluetoothPoweredOff:
            return "Bluetooth is turned off. Please enable Bluetooth in Settings"
        case .deviceNotFound:
            return "The target device could not be found"
        case .connectionFailed:
            return "Failed to establish connection with the device"
        case .connectionTimeout:
            return "Connection attempt timed out"
        case .transmissionFailed:
            return "Failed to transmit data to the device"
        case .invalidData:
            return "The data received is invalid or corrupted"
        case .peerVerificationFailed:
            return "Could not verify that the peer device is a legitimate wallet"
        case .serviceNotFound:
            return "Required Bluetooth service not found on device"
        case .characteristicNotFound:
            return "Required Bluetooth characteristic not found"
        case .permissionDenied:
            return "Bluetooth permission denied. Please grant permission in Settings"
        case .unknownError(let message):
            return "Unknown Bluetooth error: \(message)"
        }
    }
}

// MARK: - Data Transmission Protocol

/// Protocol for data transmission over Bluetooth
struct BluetoothDataPacket: Codable {
    let id: String
    let type: PacketType
    let sequenceNumber: Int
    let totalPackets: Int
    let data: Data
    let checksum: String
    let timestamp: Date
    
    enum PacketType: String, Codable {
        case tokenTransfer = "token_transfer"
        case paymentRequest = "payment_request"
        case paymentResponse = "payment_response"
        case handshake = "handshake"
        case acknowledgment = "ack"
        case error = "error"
    }
    
    init(id: String = UUID().uuidString, type: PacketType, sequenceNumber: Int, totalPackets: Int, data: Data) {
        self.id = id
        self.type = type
        self.sequenceNumber = sequenceNumber
        self.totalPackets = totalPackets
        self.data = data
        self.checksum = data.sha256
        self.timestamp = Date()
    }
    
    func isValid() -> Bool {
        return data.sha256 == checksum
    }
}

// MARK: - Extensions

extension Data {
    var sha256: String {
        return self.withUnsafeBytes { bytes in
            let buffer = bytes.bindMemory(to: UInt8.self)
            var hash = [UInt8](repeating: 0, count: Int(CC_SHA256_DIGEST_LENGTH))
            CC_SHA256(buffer.baseAddress, CC_LONG(self.count), &hash)
            return hash.map { String(format: "%02x", $0) }.joined()
        }
    }
    
    func chunked(into size: Int) -> [Data] {
        var chunks: [Data] = []
        var offset = 0
        
        while offset < self.count {
            let chunkSize = Swift.min(size, self.count - offset)
            let chunk = self.subdata(in: offset..<(offset + chunkSize))
            chunks.append(chunk)
            offset += chunkSize
        }
        
        return chunks
    }
}

import CommonCrypto

// MARK: - Connection Health Model

/// Represents the health status of a Bluetooth connection
struct ConnectionHealth {
    let isConnected: Bool
    let lastActivity: Date
    let isStale: Bool
    let signalStrength: Int
    
    var healthScore: Double {
        var score = 0.0
        
        // Connection status (40% weight)
        if isConnected {
            score += 0.4
        }
        
        // Activity freshness (30% weight)
        let timeSinceActivity = Date().timeIntervalSince(lastActivity)
        if timeSinceActivity < 30 { // Less than 30 seconds
            score += 0.3
        } else if timeSinceActivity < 60 { // Less than 1 minute
            score += 0.2
        } else if timeSinceActivity < 300 { // Less than 5 minutes
            score += 0.1
        }
        
        // Signal strength (30% weight)
        if signalStrength > -50 {
            score += 0.3 // Excellent signal
        } else if signalStrength > -70 {
            score += 0.2 // Good signal
        } else if signalStrength > -85 {
            score += 0.1 // Fair signal
        }
        // Poor signal adds 0
        
        return score
    }
    
    var status: ConnectionHealthStatus {
        let score = healthScore
        if score >= 0.8 {
            return .excellent
        } else if score >= 0.6 {
            return .good
        } else if score >= 0.4 {
            return .fair
        } else {
            return .poor
        }
    }
}

enum ConnectionHealthStatus: String, CaseIterable {
    case excellent = "excellent"
    case good = "good"
    case fair = "fair"
    case poor = "poor"
    
    var description: String {
        switch self {
        case .excellent:
            return "Excellent connection quality"
        case .good:
            return "Good connection quality"
        case .fair:
            return "Fair connection quality"
        case .poor:
            return "Poor connection quality"
        }
    }
}