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
    
    // Additional properties for background service compatibility
    var deviceId: String { return id }
    var deviceName: String { return device.name }
    
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
    let capabilities: [String]
    let offlineBalance: Double?
    let lastSyncTimestamp: Date?
    
    init(walletId: String, publicKey: String, deviceName: String = {
        #if canImport(UIKit)
        return UIDevice.current.name
        #else
        return "Unknown Device"
        #endif
    }(), version: String = "1.0.0", capabilities: [String] = ["offline_tokens", "qr_payments", "bluetooth_transfers"], offlineBalance: Double? = nil, lastSyncTimestamp: Date? = nil) {
        self.walletId = walletId
        self.publicKey = publicKey
        self.deviceName = deviceName
        self.version = version
        self.capabilities = capabilities
        self.offlineBalance = offlineBalance
        self.lastSyncTimestamp = lastSyncTimestamp
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

// MARK: - Storage Models

/// Represents the type of Bluetooth connection
enum BluetoothConnectionType: String, Codable {
    case incoming = "incoming"
    case outgoing = "outgoing"
}

/// Represents a Bluetooth connection record for storage
struct BluetoothConnectionRecord: Codable {
    let deviceId: String
    let deviceName: String
    let connectedAt: Date
    let connectionType: BluetoothConnectionType?
    var disconnectedAt: Date?
    var status: BackgroundBluetoothConnectionStatus
    let lastActivity: Date
    
    init(deviceId: String, deviceName: String, connectedAt: Date, connectionType: BluetoothConnectionType? = nil, disconnectedAt: Date? = nil, status: BackgroundBluetoothConnectionStatus, lastActivity: Date = Date()) {
        self.deviceId = deviceId
        self.deviceName = deviceName
        self.connectedAt = connectedAt
        self.connectionType = connectionType
        self.disconnectedAt = disconnectedAt
        self.status = status
        self.lastActivity = lastActivity
    }
    
    // Manual Codable implementation for backward compatibility
    enum CodingKeys: String, CodingKey {
        case deviceId, deviceName, connectedAt, connectionType, disconnectedAt, status, lastActivity
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        deviceId = try container.decode(String.self, forKey: .deviceId)
        deviceName = try container.decode(String.self, forKey: .deviceName)
        connectedAt = try container.decode(Date.self, forKey: .connectedAt)
        connectionType = try container.decodeIfPresent(BluetoothConnectionType.self, forKey: .connectionType)
        disconnectedAt = try container.decodeIfPresent(Date.self, forKey: .disconnectedAt)
        status = try container.decode(BackgroundBluetoothConnectionStatus.self, forKey: .status)
        lastActivity = try container.decodeIfPresent(Date.self, forKey: .lastActivity) ?? Date()
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(deviceId, forKey: .deviceId)
        try container.encode(deviceName, forKey: .deviceName)
        try container.encode(connectedAt, forKey: .connectedAt)
        try container.encodeIfPresent(connectionType, forKey: .connectionType)
        try container.encodeIfPresent(disconnectedAt, forKey: .disconnectedAt)
        try container.encode(status, forKey: .status)
        try container.encode(lastActivity, forKey: .lastActivity)
    }
}

/// Represents the status of a background Bluetooth connection
enum BackgroundBluetoothConnectionStatus: String, Codable, CaseIterable {
    case connected = "connected"
    case disconnected = "disconnected"
    case connecting = "connecting"
    case failed = "failed"
    case timeout = "timeout"
}

/// Represents a public key database for peer verification
struct PublicKeyDatabase: Codable {
    let version: String
    let lastUpdated: Date
    let publicKeys: [String: PublicKeyEntry]
    
    init(version: String = "1.0.0", lastUpdated: Date = Date(), publicKeys: [String: PublicKeyEntry] = [:]) {
        self.version = version
        self.lastUpdated = lastUpdated
        self.publicKeys = publicKeys
    }
}

/// Represents a public key entry in the database
struct PublicKeyEntry: Codable {
    let walletId: String
    let publicKey: String
    let addedAt: Date
    let isVerified: Bool
    let deviceName: String?
    
    init(walletId: String, publicKey: String, addedAt: Date = Date(), isVerified: Bool = false, deviceName: String? = nil) {
        self.walletId = walletId
        self.publicKey = publicKey
        self.addedAt = addedAt
        self.isVerified = isVerified
        self.deviceName = deviceName
    }
}
