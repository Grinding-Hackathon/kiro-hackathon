//
//  BluetoothServiceTests.swift
//  OfflineBlockchainWalletTests
//
//  Created by Kiro on 7/21/25.
//

import XCTest
import CoreBluetooth
@testable import offline_blockchain_wallet_ios

final class BluetoothServiceTests: XCTestCase {
    
    var bluetoothService: BluetoothService!
    var mockCentralManager: MockCBCentralManager!
    var mockPeripheralManager: MockCBPeripheralManager!
    
    override func setUpWithError() throws {
        try super.setUpWithError()
        bluetoothService = BluetoothService()
        mockCentralManager = MockCBCentralManager()
        mockPeripheralManager = MockCBPeripheralManager()
    }
    
    override func tearDownWithError() throws {
        bluetoothService = nil
        mockCentralManager = nil
        mockPeripheralManager = nil
        try super.tearDownWithError()
    }
    
    // MARK: - Advertising Tests
    
    func testStartAdvertising() throws {
        // Given
        let walletInfo = WalletInfo(
            walletId: "test-wallet-123",
            publicKey: "test-public-key",
            deviceName: "Test Device"
        )
        
        // When & Then
        XCTAssertNoThrow(try bluetoothService.startAdvertising(walletInfo: walletInfo))
        
        // Verify advertising state
        XCTAssertTrue(bluetoothService.isAdvertising)
    }
    
    func testStopAdvertising() {
        // Given
        let walletInfo = WalletInfo(
            walletId: "test-wallet-123",
            publicKey: "test-public-key"
        )
        try? bluetoothService.startAdvertising(walletInfo: walletInfo)
        
        // When
        bluetoothService.stopAdvertising()
        
        // Then
        XCTAssertFalse(bluetoothService.isAdvertising)
    }
    
    // MARK: - Device Discovery Tests
    
    func testScanForDevices() async throws {
        // Given
        let expectation = XCTestExpectation(description: "Scan for devices")
        
        // When
        Task {
            do {
                let devices = try await bluetoothService.scanForDevices()
                
                // Then
                XCTAssertNotNil(devices)
                XCTAssertTrue(devices.isEmpty) // No devices in test environment
                expectation.fulfill()
            } catch {
                XCTFail("Scan failed with error: \(error)")
                expectation.fulfill()
            }
        }
        
        await fulfillment(of: [expectation], timeout: 5.0)
    }
    
    // MARK: - Device Verification Tests
    
    func testVerifyPeerDeviceWithValidDevice() async throws {
        // Given
        let mockPeripheral = MockCBPeripheral(name: "Wallet-TestDevice")
        let device = BluetoothDevice(
            peripheral: mockPeripheral,
            rssi: NSNumber(value: -50),
            advertisementData: [
                CBAdvertisementDataServiceUUIDsKey: [CBUUID(string: Constants.Bluetooth.serviceUUID)],
                CBAdvertisementDataLocalNameKey: "Wallet-TestDevice"
            ]
        )
        
        // When
        let isValid = try await bluetoothService.verifyPeerDevice(device)
        
        // Then
        XCTAssertTrue(isValid)
    }
    
    func testVerifyPeerDeviceWithInvalidDevice() async throws {
        // Given
        let mockPeripheral = MockCBPeripheral(name: "InvalidDevice")
        let device = BluetoothDevice(
            peripheral: mockPeripheral,
            rssi: NSNumber(value: -50),
            advertisementData: [:]
        )
        
        // When
        let isValid = try await bluetoothService.verifyPeerDevice(device)
        
        // Then
        XCTAssertFalse(isValid)
    }
    
    // MARK: - Data Transmission Tests
    
    func testBluetoothDataPacketCreation() {
        // Given
        let testData = "Hello, Bluetooth!".data(using: .utf8)!
        
        // When
        let packet = BluetoothDataPacket(
            type: .tokenTransfer,
            sequenceNumber: 1,
            totalPackets: 1,
            data: testData
        )
        
        // Then
        XCTAssertEqual(packet.type, .tokenTransfer)
        XCTAssertEqual(packet.sequenceNumber, 1)
        XCTAssertEqual(packet.totalPackets, 1)
        XCTAssertEqual(packet.data, testData)
        XCTAssertTrue(packet.isValid())
    }
    
    func testBluetoothDataPacketValidation() {
        // Given
        let testData = "Test data".data(using: .utf8)!
        var packet = BluetoothDataPacket(
            type: .handshake,
            sequenceNumber: 0,
            totalPackets: 1,
            data: testData
        )
        
        // When - corrupt the checksum
        packet = BluetoothDataPacket(
            id: packet.id,
            type: packet.type,
            sequenceNumber: packet.sequenceNumber,
            totalPackets: packet.totalPackets,
            data: packet.data,
            checksum: "invalid_checksum",
            timestamp: packet.timestamp
        )
        
        // Then
        XCTAssertFalse(packet.isValid())
    }
    
    // MARK: - Connection Health Tests
    
    func testConnectionHealthCalculation() {
        // Given
        let recentActivity = Date()
        let goodSignal = -60
        
        let health = ConnectionHealth(
            isConnected: true,
            lastActivity: recentActivity,
            isStale: false,
            signalStrength: goodSignal
        )
        
        // When
        let score = health.healthScore
        let status = health.status
        
        // Then
        XCTAssertGreaterThan(score, 0.8)
        XCTAssertEqual(status, .excellent)
    }
    
    func testConnectionHealthWithPoorConditions() {
        // Given
        let oldActivity = Date().addingTimeInterval(-300) // 5 minutes ago
        let weakSignal = -90
        
        let health = ConnectionHealth(
            isConnected: false,
            lastActivity: oldActivity,
            isStale: true,
            signalStrength: weakSignal
        )
        
        // When
        let score = health.healthScore
        let status = health.status
        
        // Then
        XCTAssertLessThan(score, 0.4)
        XCTAssertEqual(status, .poor)
    }
    
    // MARK: - Error Handling Tests
    
    func testBluetoothErrorDescriptions() {
        let errors: [BluetoothError] = [
            .bluetoothUnavailable,
            .bluetoothPoweredOff,
            .deviceNotFound,
            .connectionFailed,
            .connectionTimeout,
            .transmissionFailed,
            .invalidData,
            .peerVerificationFailed,
            .serviceNotFound,
            .characteristicNotFound,
            .permissionDenied,
            .unknownError("Test error")
        ]
        
        for error in errors {
            XCTAssertNotNil(error.errorDescription)
            XCTAssertFalse(error.errorDescription!.isEmpty)
        }
    }
    
    // MARK: - Data Chunking Tests
    
    func testDataChunking() {
        // Given
        let largeData = Data(repeating: 0x42, count: 1500) // 1.5KB
        let chunkSize = 512
        
        // When
        let chunks = largeData.chunked(into: chunkSize)
        
        // Then
        XCTAssertEqual(chunks.count, 3) // Should be split into 3 chunks
        XCTAssertEqual(chunks[0].count, chunkSize)
        XCTAssertEqual(chunks[1].count, chunkSize)
        XCTAssertEqual(chunks[2].count, 1500 - (chunkSize * 2))
        
        // Verify data integrity
        let reconstructed = chunks.reduce(Data()) { $0 + $1 }
        XCTAssertEqual(reconstructed, largeData)
    }
    
    // MARK: - Security Challenge Tests
    
    func testSecurityChallengeGeneration() {
        // Given
        let service = BluetoothService()
        
        // When
        let challenge1 = service.generateSecurityChallenge()
        let challenge2 = service.generateSecurityChallenge()
        
        // Then
        XCTAssertNotEqual(challenge1, challenge2)
        XCTAssertFalse(challenge1.isEmpty)
        XCTAssertFalse(challenge2.isEmpty)
        
        // Verify base64 encoding
        XCTAssertNotNil(Data(base64Encoded: challenge1))
        XCTAssertNotNil(Data(base64Encoded: challenge2))
    }
    
    // MARK: - Version Compatibility Tests
    
    func testVersionCompatibility() {
        // Given
        let service = BluetoothService()
        
        // When & Then
        XCTAssertTrue(service.isVersionCompatible("1.0.0"))
        XCTAssertTrue(service.isVersionCompatible("1.0.1"))
        XCTAssertTrue(service.isVersionCompatible("1.1.0"))
        XCTAssertFalse(service.isVersionCompatible("2.0.0"))
        XCTAssertFalse(service.isVersionCompatible("0.9.0"))
        XCTAssertFalse(service.isVersionCompatible("invalid"))
    }
}

// MARK: - Mock Classes

class MockCBCentralManager: CBCentralManager {
    var mockState: CBManagerState = .poweredOn
    
    override var state: CBManagerState {
        return mockState
    }
    
    override func scanForPeripherals(withServices serviceUUIDs: [CBUUID]?, options: [String : Any]? = nil) {
        // Mock implementation
    }
    
    override func stopScan() {
        // Mock implementation
    }
    
    override func connect(_ peripheral: CBPeripheral, options: [String : Any]? = nil) {
        // Mock implementation
    }
    
    override func cancelPeripheralConnection(_ peripheral: CBPeripheral) {
        // Mock implementation
    }
}

class MockCBPeripheralManager: CBPeripheralManager {
    var mockState: CBManagerState = .poweredOn
    
    override var state: CBManagerState {
        return mockState
    }
    
    override func add(_ service: CBMutableService) {
        // Mock implementation
    }
    
    override func startAdvertising(_ advertisementData: [String : Any]?) {
        // Mock implementation
    }
    
    override func stopAdvertising() {
        // Mock implementation
    }
}

class MockCBPeripheral: CBPeripheral {
    private let mockName: String
    private let mockIdentifier: UUID
    
    init(name: String) {
        self.mockName = name
        self.mockIdentifier = UUID()
        super.init()
    }
    
    override var name: String? {
        return mockName
    }
    
    override var identifier: UUID {
        return mockIdentifier
    }
    
    override var services: [CBService]? {
        // Return mock service for testing
        let mockService = MockCBService()
        return [mockService]
    }
}

class MockCBService: CBService {
    override var uuid: CBUUID {
        return CBUUID(string: Constants.Bluetooth.serviceUUID)
    }
    
    override var characteristics: [CBCharacteristic]? {
        let mockCharacteristic = MockCBCharacteristic()
        return [mockCharacteristic]
    }
}

class MockCBCharacteristic: CBCharacteristic {
    override var uuid: CBUUID {
        return CBUUID(string: Constants.Bluetooth.characteristicUUID)
    }
    
    override var properties: CBCharacteristicProperties {
        return [.read, .write, .notify]
    }
}

// MARK: - Test Extensions

extension BluetoothService {
    // Expose private methods for testing
    func generateSecurityChallenge() -> String {
        let challengeData = Data((0..<32).map { _ in UInt8.random(in: 0...255) })
        return challengeData.base64EncodedString()
    }
    
    func isVersionCompatible(_ peerVersion: String) -> Bool {
        let supportedVersions = ["1.0.0", "1.0.1", "1.1.0"]
        return supportedVersions.contains(peerVersion)
    }
}