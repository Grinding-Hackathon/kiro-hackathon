//
//  BluetoothService.swift
//  offline-blockchain-wallet-ios
//
//  Created by Kiro on 7/21/25.
//

import Foundation
@preconcurrency import CoreBluetooth
import Combine

protocol BluetoothServiceProtocol {
    func startAdvertising(walletInfo: WalletInfo) throws
    func stopAdvertising()
    func scanForDevices() async throws -> [BluetoothDevice]
    func connectToDevice(_ device: BluetoothDevice) async throws -> BluetoothConnection
    func sendData(_ data: Data, to connection: BluetoothConnection) async throws
    func receiveData(from connection: BluetoothConnection) async throws -> Data
    func disconnect(_ connection: BluetoothConnection)
    func verifyPeerDevice(_ device: BluetoothDevice) async throws -> Bool
}

class BluetoothService: NSObject, BluetoothServiceProtocol {
    private var centralManager: CBCentralManager?
    private var peripheralManager: CBPeripheralManager?
    private var discoveredDevices: [BluetoothDevice] = []
    private var activeConnections: [String: BluetoothConnection] = [:]
    private var connectedPeripherals: [String: CBPeripheral] = [:]
    private var connectedCentrals: [String: CBCentral] = [:]
    private var characteristic: CBMutableCharacteristic?
    private var service: CBMutableService?
    
    // Data transmission management
    private var pendingTransmissions: [String: PendingTransmission] = [:]
    private var receivedDataBuffers: [String: Data] = [:]
    
    // Connection management
    private var connectionTimeouts: [String: Timer] = [:]
    private var retryAttempts: [String: Int] = [:]
    
    @Published var isScanning = false
    @Published var isAdvertising = false
    @Published var connectionStatus: BluetoothConnectionStatus = .disconnected
    @Published var discoveredDevicesPublisher: [BluetoothDevice] = []
    
    private let logger = Logger.shared
    private let maxRetryAttempts = 3
    private let chunkSize = 512 // Maximum data chunk size for reliable transmission
    
    override init() {
        super.init()
        setupBluetoothManagers()
    }
    
    private func setupBluetoothManagers() {
        centralManager = CBCentralManager(delegate: self, queue: DispatchQueue.global(qos: .userInitiated))
        peripheralManager = CBPeripheralManager(delegate: self, queue: DispatchQueue.global(qos: .userInitiated))
        setupService()
    }
    
    private func setupService() {
        // Create the service and characteristic for wallet communication
        let serviceUUID = CBUUID(string: Constants.Bluetooth.serviceUUID)
        let characteristicUUID = CBUUID(string: Constants.Bluetooth.characteristicUUID)
        
        characteristic = CBMutableCharacteristic(
            type: characteristicUUID,
            properties: [.read, .write, .notify],
            value: nil,
            permissions: [.readable, .writeable]
        )
        
        service = CBMutableService(type: serviceUUID, primary: true)
        service?.characteristics = [characteristic!]
    }
    
    // MARK: - Public Interface Implementation
    
    func startAdvertising(walletInfo: WalletInfo) throws {
        guard let peripheralManager = peripheralManager else {
            throw BluetoothError.bluetoothUnavailable
        }
        
        guard peripheralManager.state == .poweredOn else {
            throw BluetoothError.bluetoothUnavailable
        }
        
        // Add service if not already added
        if let service = service, !peripheralManager.isAdvertising {
            peripheralManager.add(service)
        }
        
        // Create advertisement data with wallet info
        let advertisementData: [String: Any] = [
            CBAdvertisementDataServiceUUIDsKey: [CBUUID(string: Constants.Bluetooth.serviceUUID)],
            CBAdvertisementDataLocalNameKey: "Wallet-\(walletInfo.deviceName)"
        ]
        
        peripheralManager.startAdvertising(advertisementData)
        
        DispatchQueue.main.async {
            self.isAdvertising = true
        }
        
        logger.log("Started advertising wallet: \(walletInfo.walletId)", level: .info)
    }
    
    func stopAdvertising() {
        peripheralManager?.stopAdvertising()
        DispatchQueue.main.async {
            self.isAdvertising = false
        }
        logger.log("Stopped advertising", level: .info)
    }
    
    func scanForDevices() async throws -> [BluetoothDevice] {
        guard let centralManager = centralManager else {
            throw BluetoothError.bluetoothUnavailable
        }
        
        guard centralManager.state == .poweredOn else {
            throw BluetoothError.bluetoothUnavailable
        }
        
        return try await withCheckedThrowingContinuation { continuation in
            DispatchQueue.main.async {
                self.isScanning = true
                self.discoveredDevices.removeAll()
            }
            
            // Start scanning for wallet services
            let serviceUUID = CBUUID(string: Constants.Bluetooth.serviceUUID)
            centralManager.scanForPeripherals(withServices: [serviceUUID], options: [
                CBCentralManagerScanOptionAllowDuplicatesKey: false
            ])
            
            // Set timeout for scanning
            DispatchQueue.global().asyncAfter(deadline: .now() + Constants.Bluetooth.scanTimeout) {
                centralManager.stopScan()
                DispatchQueue.main.async {
                    self.isScanning = false
                    self.discoveredDevicesPublisher = self.discoveredDevices
                }
                continuation.resume(returning: self.discoveredDevices)
            }
        }
    }
    
    func connectToDevice(_ device: BluetoothDevice) async throws -> BluetoothConnection {
        guard let centralManager = centralManager else {
            throw BluetoothError.bluetoothUnavailable
        }
        
        guard let peripheral = device.peripheral else {
            throw BluetoothError.deviceNotFound
        }
        
        return try await withCheckedThrowingContinuation { continuation in
            let connectionId = device.id
            
            // Set up connection timeout
            let timeoutTimer = Timer.scheduledTimer(withTimeInterval: Constants.Bluetooth.connectionTimeout, repeats: false) { _ in
                centralManager.cancelPeripheralConnection(peripheral)
                continuation.resume(throwing: BluetoothError.connectionFailed)
            }
            
            connectionTimeouts[connectionId] = timeoutTimer
            
            // Store continuation for completion in delegate
            pendingConnections[connectionId] = continuation
            
            // Initiate connection
            centralManager.connect(peripheral, options: nil)
            
            DispatchQueue.main.async {
                self.connectionStatus = .connecting
            }
        }
    }
    
    func sendData(_ data: Data, to connection: BluetoothConnection) async throws {
        guard let peripheral = connection.peripheral else {
            throw BluetoothError.connectionFailed
        }
        
        guard connection.isConnected else {
            throw BluetoothError.connectionFailed
        }
        
        // Find the characteristic to write to
        guard let service = peripheral.services?.first(where: { $0.uuid == CBUUID(string: Constants.Bluetooth.serviceUUID) }),
              let characteristic = service.characteristics?.first(where: { $0.uuid == CBUUID(string: Constants.Bluetooth.characteristicUUID) }) else {
            throw BluetoothError.transmissionFailed
        }
        
        return try await withCheckedThrowingContinuation { continuation in
            let transmissionId = UUID().uuidString
            let transmission = PendingTransmission(
                id: transmissionId,
                data: data,
                continuation: continuation,
                retryCount: 0
            )
            
            pendingTransmissions[transmissionId] = transmission
            
            // Send data in chunks if necessary
            sendDataInChunks(data, to: peripheral, characteristic: characteristic, transmissionId: transmissionId)
        }
    }
    
    func receiveData(from connection: BluetoothConnection) async throws -> Data {
        // This method returns data that has been received and buffered
        // The actual data reception happens in the peripheral delegate methods
        guard let bufferedData = receivedDataBuffers[connection.id] else {
            throw BluetoothError.transmissionFailed
        }
        
        // Clear the buffer after reading
        receivedDataBuffers.removeValue(forKey: connection.id)
        return bufferedData
    }
    
    func disconnect(_ connection: BluetoothConnection) {
        if let peripheral = connection.peripheral {
            centralManager?.cancelPeripheralConnection(peripheral)
        }
        
        // Clean up connection data
        activeConnections.removeValue(forKey: connection.id)
        connectedPeripherals.removeValue(forKey: connection.id)
        receivedDataBuffers.removeValue(forKey: connection.id)
        pendingTransmissions.removeValue(forKey: connection.id)
        
        // Cancel any pending timeouts
        connectionTimeouts[connection.id]?.invalidate()
        connectionTimeouts.removeValue(forKey: connection.id)
        
        DispatchQueue.main.async {
            self.connectionStatus = .disconnected
        }
        
        logger.log("Disconnected from device: \(connection.device.name)", level: .info)
    }
    
    func verifyPeerDevice(_ device: BluetoothDevice) async throws -> Bool {
        // Verify that the peer device is running compatible wallet software
        // This includes checking service UUID, device name pattern, and performing a handshake
        
        guard let peripheral = device.peripheral else {
            return false
        }
        
        // Step 1: Check if device advertises the wallet service
        let hasWalletService = peripheral.services?.contains { service in
            service.uuid == CBUUID(string: Constants.Bluetooth.serviceUUID)
        } ?? false
        
        // Step 2: Check device name pattern
        let hasValidName = device.name.hasPrefix("Wallet-")
        
        // Step 3: Check advertisement data for wallet capabilities
        let hasValidAdvertisement = validateAdvertisementData(device.advertisementData)
        
        // Step 4: Perform handshake verification if basic checks pass
        if hasWalletService && hasValidName && hasValidAdvertisement {
            return await performHandshakeVerification(with: device)
        }
        
        logger.log("Peer device verification failed: \(device.name) - Service: \(hasWalletService), Name: \(hasValidName), Ad: \(hasValidAdvertisement)", level: .warning)
        return false
    }
    
    // MARK: - Enhanced Security Methods
    
    private func validateAdvertisementData(_ advertisementData: [String: Any]?) -> Bool {
        guard let adData = advertisementData else { return false }
        
        // Check for required service UUIDs
        if let serviceUUIDs = adData[CBAdvertisementDataServiceUUIDsKey] as? [CBUUID] {
            let hasWalletService = serviceUUIDs.contains(CBUUID(string: Constants.Bluetooth.serviceUUID))
            if !hasWalletService { return false }
        }
        
        // Check local name format
        if let localName = adData[CBAdvertisementDataLocalNameKey] as? String {
            return localName.hasPrefix("Wallet-") && localName.count > 7
        }
        
        return true
    }
    
    private func performHandshakeVerification(with device: BluetoothDevice) async -> Bool {
        do {
            // Connect to device for handshake
            let connection = try await connectToDevice(device)
            
            // Create handshake packet with challenge
            let challenge = generateSecurityChallenge()
            let handshakeDict: [String: Any] = [
                "type": "handshake_challenge",
                "challenge": challenge,
                "wallet_version": Constants.App.version,
                "timestamp": Date().timeIntervalSince1970
            ]
            let handshakeData = try JSONSerialization.data(withJSONObject: handshakeDict)
            
            let handshakePacket = BluetoothDataPacket(
                type: .handshake,
                sequenceNumber: 0,
                totalPackets: 1,
                data: handshakeData
            )
            
            // Send handshake challenge
            try await sendPacket(handshakePacket, to: connection)
            
            // Wait for response with timeout
            let response = try await waitForHandshakeResponse(from: connection, timeout: 10.0)
            
            // Verify handshake response
            let isValid = validateHandshakeResponse(response, originalChallenge: challenge)
            
            if isValid {
                logger.log("Handshake verification successful for device: \(device.name)", level: .info)
            } else {
                logger.log("Handshake verification failed for device: \(device.name)", level: .warning)
                disconnect(connection)
            }
            
            return isValid
            
        } catch {
            logger.log("Handshake verification error for device \(device.name): \(error.localizedDescription)", level: .error)
            return false
        }
    }
    
    private func generateSecurityChallenge() -> String {
        let challengeData = Data((0..<32).map { _ in UInt8.random(in: 0...255) })
        return challengeData.base64EncodedString()
    }
    
    private func sendPacket(_ packet: BluetoothDataPacket, to connection: BluetoothConnection) async throws {
        let data = try JSONEncoder().encode(packet)
        try await sendData(data, to: connection)
    }
    
    private func waitForHandshakeResponse(from connection: BluetoothConnection, timeout: TimeInterval) async throws -> BluetoothDataPacket {
        return try await withThrowingTaskGroup(of: BluetoothDataPacket.self) { group in
            // Add timeout task
            group.addTask {
                try await Task.sleep(nanoseconds: UInt64(timeout * 1_000_000_000))
                throw BluetoothError.connectionTimeout
            }
            
            // Add response waiting task
            group.addTask {
                while true {
                    let data = try await self.receiveData(from: connection)
                    if let packet = try? JSONDecoder().decode(BluetoothDataPacket.self, from: data),
                       packet.type == .handshake {
                        return packet
                    }
                    // Continue waiting for handshake response
                    try await Task.sleep(nanoseconds: 100_000_000) // 0.1 second
                }
            }
            
            // Return first completed task result
            let result = try await group.next()!
            group.cancelAll()
            return result
        }
    }
    
    private func validateHandshakeResponse(_ packet: BluetoothDataPacket, originalChallenge: String) -> Bool {
        do {
            let responseData = try JSONSerialization.jsonObject(with: packet.data) as? [String: Any]
            
            guard let type = responseData?["type"] as? String,
                  type == "handshake_response",
                  let challengeResponse = responseData?["challenge_response"] as? String,
                  let peerVersion = responseData?["wallet_version"] as? String else {
                return false
            }
            
            // Verify challenge response (simplified - in production would use cryptographic verification)
            let expectedResponse = originalChallenge.reversed()
            let isValidChallenge = challengeResponse == String(expectedResponse)
            
            // Verify version compatibility
            let isCompatibleVersion = isVersionCompatible(peerVersion)
            
            return isValidChallenge && isCompatibleVersion
            
        } catch {
            logger.log("Error validating handshake response: \(error.localizedDescription)", level: .error)
            return false
        }
    }
    
    private func isVersionCompatible(_ peerVersion: String) -> Bool {
        // Simple version compatibility check
        // In production, this would implement semantic versioning comparison
        let supportedVersions = ["1.0.0", "1.0.1", "1.1.0"]
        return supportedVersions.contains(peerVersion)
    }
    
    // MARK: - Connection Management and Recovery
    
    func reconnectToDevice(_ device: BluetoothDevice) async throws -> BluetoothConnection {
        logger.log("Attempting to reconnect to device: \(device.name)", level: .info)
        
        // Clean up any existing connection state
        if let existingConnection = activeConnections[device.id] {
            disconnect(existingConnection)
        }
        
        // Reset retry count for fresh reconnection attempt
        retryAttempts.removeValue(forKey: device.id)
        
        // Attempt new connection
        return try await connectToDevice(device)
    }
    
    func getConnectionHealth(_ connection: BluetoothConnection) -> ConnectionHealth {
        let timeSinceLastActivity = Date().timeIntervalSince(connection.lastActivity)
        let isStale = timeSinceLastActivity > 60.0 // 1 minute
        
        return ConnectionHealth(
            isConnected: connection.isConnected,
            lastActivity: connection.lastActivity,
            isStale: isStale,
            signalStrength: getSignalStrength(for: connection)
        )
    }
    
    private func getSignalStrength(for connection: BluetoothConnection) -> Int {
        // Get RSSI if available
        if let device = discoveredDevices.first(where: { $0.id == connection.id }) {
            return device.rssi
        }
        return -100 // Unknown/weak signal
    }
    
    func performConnectionMaintenance() {
        logger.log("Performing connection maintenance", level: .info)
        
        for (deviceId, connection) in activeConnections {
            let health = getConnectionHealth(connection)
            
            if health.isStale && connection.isConnected {
                logger.log("Connection to \(deviceId) is stale, sending ping", level: .warning)
                sendPingToConnection(connection)
            } else if !health.isConnected {
                logger.log("Connection to \(deviceId) is disconnected, cleaning up", level: .info)
                disconnect(connection)
            }
        }
    }
    
    private func sendPingToConnection(_ connection: BluetoothConnection) {
        let pingPacket = BluetoothDataPacket(
            type: .handshake,
            sequenceNumber: 0,
            totalPackets: 1,
            data: "ping".data(using: .utf8) ?? Data()
        )
        
        Task {
            do {
                try await sendPacket(pingPacket, to: connection)
                logger.log("Ping sent to connection: \(connection.id)", level: .info)
            } catch {
                logger.log("Failed to send ping to connection \(connection.id): \(error.localizedDescription)", level: .error)
                disconnect(connection)
            }
        }
    }
    
    // MARK: - Private Helper Methods
    
    private func sendDataInChunks(_ data: Data, to peripheral: CBPeripheral, characteristic: CBCharacteristic, transmissionId: String) {
        let chunks = data.chunked(into: chunkSize)
        var chunkIndex = 0
        
        func sendNextChunk() {
            guard chunkIndex < chunks.count else {
                // All chunks sent successfully
                if let transmission = pendingTransmissions[transmissionId] {
                    transmission.continuation.resume()
                    pendingTransmissions.removeValue(forKey: transmissionId)
                }
                return
            }
            
            let chunk = chunks[chunkIndex]
            let writeType: CBCharacteristicWriteType = characteristic.properties.contains(.writeWithoutResponse) ? .withoutResponse : .withResponse
            
            peripheral.writeValue(chunk, for: characteristic, type: writeType)
            chunkIndex += 1
            
            // Schedule next chunk (with small delay to prevent overwhelming)
            DispatchQueue.global().asyncAfter(deadline: .now() + 0.01) {
                sendNextChunk()
            }
        }
        
        sendNextChunk()
    }
    
    private func handleConnectionError(_ error: Error, for deviceId: String) {
        logger.log("Connection error for device \(deviceId): \(error.localizedDescription)", level: .error)
        
        // Retry logic
        let currentRetries = retryAttempts[deviceId] ?? 0
        if currentRetries < maxRetryAttempts {
            retryAttempts[deviceId] = currentRetries + 1
            logger.log("Retrying connection (\(currentRetries + 1)/\(maxRetryAttempts))", level: .info)
            // Retry logic would be implemented here
        } else {
            retryAttempts.removeValue(forKey: deviceId)
            DispatchQueue.main.async {
                self.connectionStatus = .error("Connection failed after \(self.maxRetryAttempts) attempts")
            }
        }
    }
    
    // Store pending connections for async completion
    private var pendingConnections: [String: CheckedContinuation<BluetoothConnection, Error>] = [:]
}

// MARK: - CBCentralManagerDelegate

extension BluetoothService: CBCentralManagerDelegate {
    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        logger.log("Central manager state updated: \(central.state.rawValue)", level: .info)
        
        switch central.state {
        case .poweredOn:
            logger.log("Bluetooth is powered on and ready", level: .info)
        case .poweredOff:
            logger.log("Bluetooth is powered off", level: .warning)
            DispatchQueue.main.async {
                self.connectionStatus = .error("Bluetooth is turned off")
            }
        case .unauthorized:
            logger.log("Bluetooth access unauthorized", level: .error)
            DispatchQueue.main.async {
                self.connectionStatus = .error("Bluetooth permission denied")
            }
        case .unsupported:
            logger.log("Bluetooth not supported on this device", level: .error)
            DispatchQueue.main.async {
                self.connectionStatus = .error("Bluetooth not supported")
            }
        default:
            logger.log("Bluetooth state unknown or resetting", level: .warning)
        }
    }
    
    func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral, advertisementData: [String : Any], rssi RSSI: NSNumber) {
        let device = BluetoothDevice(peripheral: peripheral, rssi: RSSI, advertisementData: advertisementData)
        
        // Check if device is already discovered
        if !discoveredDevices.contains(where: { $0.id == device.id }) {
            discoveredDevices.append(device)
            logger.log("Discovered wallet device: \(device.name) (RSSI: \(RSSI))", level: .info)
            
            DispatchQueue.main.async {
                self.discoveredDevicesPublisher = self.discoveredDevices
            }
        }
    }
    
    func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        logger.log("Connected to peripheral: \(peripheral.name ?? "Unknown")", level: .info)
        
        // Set up peripheral delegate
        peripheral.delegate = self
        
        // Discover services
        let serviceUUID = CBUUID(string: Constants.Bluetooth.serviceUUID)
        peripheral.discoverServices([serviceUUID])
        
        // Create connection object
        if let device = discoveredDevices.first(where: { $0.peripheral?.identifier == peripheral.identifier }) {
            let connection = BluetoothConnection(device: device, peripheral: peripheral)
            connection.updateConnectionState(.connected)
            
            activeConnections[device.id] = connection
            connectedPeripherals[device.id] = peripheral
            
            // Cancel timeout timer
            connectionTimeouts[device.id]?.invalidate()
            connectionTimeouts.removeValue(forKey: device.id)
            
            // Complete pending connection
            if let continuation = pendingConnections[device.id] {
                continuation.resume(returning: connection)
                pendingConnections.removeValue(forKey: device.id)
            }
            
            DispatchQueue.main.async {
                self.connectionStatus = .connected(connection)
            }
        }
    }
    
    func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) {
        let deviceId = peripheral.identifier.uuidString
        logger.log("Failed to connect to peripheral: \(peripheral.name ?? "Unknown") - \(error?.localizedDescription ?? "Unknown error")", level: .error)
        
        // Cancel timeout timer
        connectionTimeouts[deviceId]?.invalidate()
        connectionTimeouts.removeValue(forKey: deviceId)
        
        // Complete pending connection with error
        if let continuation = pendingConnections[deviceId] {
            continuation.resume(throwing: error ?? BluetoothError.connectionFailed)
            pendingConnections.removeValue(forKey: deviceId)
        }
        
        handleConnectionError(error ?? BluetoothError.connectionFailed, for: deviceId)
    }
    
    func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
        let deviceId = peripheral.identifier.uuidString
        logger.log("Disconnected from peripheral: \(peripheral.name ?? "Unknown")", level: .info)
        
        // Clean up connection
        if let connection = activeConnections[deviceId] {
            connection.updateConnectionState(.disconnected)
        }
        
        activeConnections.removeValue(forKey: deviceId)
        connectedPeripherals.removeValue(forKey: deviceId)
        receivedDataBuffers.removeValue(forKey: deviceId)
        
        DispatchQueue.main.async {
            self.connectionStatus = .disconnected
        }
        
        if let error = error {
            logger.log("Disconnection error: \(error.localizedDescription)", level: .error)
        }
    }
}

// MARK: - CBPeripheralDelegate

extension BluetoothService: CBPeripheralDelegate {
    func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        if let error = error {
            logger.log("Error discovering services: \(error.localizedDescription)", level: .error)
            return
        }
        
        guard let services = peripheral.services else {
            logger.log("No services found on peripheral", level: .warning)
            return
        }
        
        // Discover characteristics for wallet service
        for service in services {
            if service.uuid == CBUUID(string: Constants.Bluetooth.serviceUUID) {
                let characteristicUUID = CBUUID(string: Constants.Bluetooth.characteristicUUID)
                peripheral.discoverCharacteristics([characteristicUUID], for: service)
            }
        }
    }
    
    func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
        if let error = error {
            logger.log("Error discovering characteristics: \(error.localizedDescription)", level: .error)
            return
        }
        
        guard let characteristics = service.characteristics else {
            logger.log("No characteristics found for service", level: .warning)
            return
        }
        
        // Set up notifications for wallet characteristic
        for characteristic in characteristics {
            if characteristic.uuid == CBUUID(string: Constants.Bluetooth.characteristicUUID) {
                if characteristic.properties.contains(.notify) {
                    peripheral.setNotifyValue(true, for: characteristic)
                    logger.log("Enabled notifications for wallet characteristic", level: .info)
                }
            }
        }
    }
    
    func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
        if let error = error {
            logger.log("Error reading characteristic value: \(error.localizedDescription)", level: .error)
            return
        }
        
        guard let data = characteristic.value else {
            logger.log("No data received from characteristic", level: .warning)
            return
        }
        
        let deviceId = peripheral.identifier.uuidString
        
        // Update connection activity
        if let connection = activeConnections[deviceId] {
            connection.updateActivity()
        }
        
        // Handle received data
        handleReceivedData(data, from: deviceId)
        
        logger.log("Received \(data.count) bytes from device: \(peripheral.name ?? "Unknown")", level: .info)
    }
    
    func peripheral(_ peripheral: CBPeripheral, didWriteValueFor characteristic: CBCharacteristic, error: Error?) {
        let deviceId = peripheral.identifier.uuidString
        
        if let error = error {
            logger.log("Error writing to characteristic: \(error.localizedDescription)", level: .error)
            
            // Handle transmission failure
            if let transmission = pendingTransmissions.values.first(where: { _ in true }) {
                transmission.continuation.resume(throwing: BluetoothError.transmissionFailed)
                pendingTransmissions.removeValue(forKey: transmission.id)
            }
            return
        }
        
        // Update connection activity
        if let connection = activeConnections[deviceId] {
            connection.updateActivity()
        }
        
        logger.log("Successfully wrote data to characteristic", level: .info)
    }
    
    func peripheral(_ peripheral: CBPeripheral, didUpdateNotificationStateFor characteristic: CBCharacteristic, error: Error?) {
        if let error = error {
            logger.log("Error updating notification state: \(error.localizedDescription)", level: .error)
            return
        }
        
        if characteristic.isNotifying {
            logger.log("Notifications enabled for characteristic: \(characteristic.uuid)", level: .info)
        } else {
            logger.log("Notifications disabled for characteristic: \(characteristic.uuid)", level: .info)
        }
    }
}

// MARK: - CBPeripheralManagerDelegate

extension BluetoothService: CBPeripheralManagerDelegate {
    func peripheralManagerDidUpdateState(_ peripheral: CBPeripheralManager) {
        logger.log("Peripheral manager state updated: \(peripheral.state.rawValue)", level: .info)
        
        switch peripheral.state {
        case .poweredOn:
            logger.log("Peripheral manager powered on", level: .info)
            // Add service when powered on
            if let service = service {
                peripheral.add(service)
            }
        case .poweredOff:
            logger.log("Peripheral manager powered off", level: .warning)
        case .unauthorized:
            logger.log("Peripheral manager unauthorized", level: .error)
        case .unsupported:
            logger.log("Peripheral manager unsupported", level: .error)
        default:
            logger.log("Peripheral manager state unknown", level: .warning)
        }
    }
    
    func peripheralManager(_ peripheral: CBPeripheralManager, didAdd service: CBService, error: Error?) {
        if let error = error {
            logger.log("Error adding service: \(error.localizedDescription)", level: .error)
            return
        }
        
        logger.log("Successfully added wallet service: \(service.uuid)", level: .info)
    }
    
    func peripheralManagerDidStartAdvertising(_ peripheral: CBPeripheralManager, error: Error?) {
        if let error = error {
            logger.log("Error starting advertising: \(error.localizedDescription)", level: .error)
            DispatchQueue.main.async {
                self.isAdvertising = false
            }
            return
        }
        
        logger.log("Started advertising wallet service", level: .info)
        DispatchQueue.main.async {
            self.isAdvertising = true
        }
    }
    
    func peripheralManager(_ peripheral: CBPeripheralManager, central: CBCentral, didSubscribeTo characteristic: CBCharacteristic) {
        logger.log("Central subscribed to characteristic: \(central.identifier)", level: .info)
        
        // Store the central for future communication
        connectedCentrals[central.identifier.uuidString] = central
    }
    
    func peripheralManager(_ peripheral: CBPeripheralManager, central: CBCentral, didUnsubscribeFrom characteristic: CBCharacteristic) {
        logger.log("Central unsubscribed from characteristic: \(central.identifier)", level: .info)
        
        // Remove the central
        connectedCentrals.removeValue(forKey: central.identifier.uuidString)
    }
    
    func peripheralManager(_ peripheral: CBPeripheralManager, didReceiveRead request: CBATTRequest) {
        logger.log("Received read request from central: \(request.central.identifier)", level: .info)
        
        // Handle read request - could return wallet info or status
        let responseData = "Wallet Ready".data(using: .utf8) ?? Data()
        
        if request.offset > responseData.count {
            peripheralManager?.respond(to: request, withResult: .invalidOffset)
            return
        }
        
        let responseBytes = responseData.subdata(in: request.offset..<responseData.count)
        request.value = responseBytes
        
        peripheralManager?.respond(to: request, withResult: .success)
    }
    
    func peripheralManager(_ peripheral: CBPeripheralManager, didReceiveWrite requests: [CBATTRequest]) {
        logger.log("Received \(requests.count) write requests", level: .info)
        
        for request in requests {
            guard let data = request.value else {
                peripheralManager?.respond(to: request, withResult: .invalidAttributeValueLength)
                continue
            }
            
            // Handle received data
            let centralId = request.central.identifier.uuidString
            handleReceivedData(data, from: centralId)
            
            // Update characteristic value
            if let characteristic = self.characteristic {
                characteristic.value = data
            }
        }
        
        // Respond to all requests
        if let firstRequest = requests.first {
            peripheralManager?.respond(to: firstRequest, withResult: .success)
        }
    }
}

// MARK: - Private Data Handling Methods

private extension BluetoothService {
    func handleReceivedData(_ data: Data, from deviceId: String) {
        // Try to decode as BluetoothDataPacket
        do {
            let packet = try JSONDecoder().decode(BluetoothDataPacket.self, from: data)
            
            // Validate packet integrity
            guard packet.isValid() else {
                logger.log("Received invalid packet from \(deviceId)", level: .warning)
                return
            }
            
            // Handle different packet types
            switch packet.type {
            case .tokenTransfer:
                handleTokenTransferPacket(packet, from: deviceId)
            case .paymentRequest:
                handlePaymentRequestPacket(packet, from: deviceId)
            case .paymentResponse:
                handlePaymentResponsePacket(packet, from: deviceId)
            case .handshake:
                handleHandshakePacket(packet, from: deviceId)
            case .acknowledgment:
                handleAcknowledgmentPacket(packet, from: deviceId)
            case .error:
                handleErrorPacket(packet, from: deviceId)
            }
            
        } catch {
            // If not a structured packet, treat as raw data
            logger.log("Received raw data from \(deviceId): \(data.count) bytes", level: .info)
            
            // Buffer the raw data
            if var existingBuffer = receivedDataBuffers[deviceId] {
                existingBuffer.append(data)
                receivedDataBuffers[deviceId] = existingBuffer
            } else {
                receivedDataBuffers[deviceId] = data
            }
        }
    }
    
    func handleTokenTransferPacket(_ packet: BluetoothDataPacket, from deviceId: String) {
        logger.log("Received token transfer packet from \(deviceId)", level: .info)
        // Token transfer handling would be implemented here
        // This would integrate with the OfflineTokenService
    }
    
    func handlePaymentRequestPacket(_ packet: BluetoothDataPacket, from deviceId: String) {
        logger.log("Received payment request packet from \(deviceId)", level: .info)
        // Payment request handling would be implemented here
    }
    
    func handlePaymentResponsePacket(_ packet: BluetoothDataPacket, from deviceId: String) {
        logger.log("Received payment response packet from \(deviceId)", level: .info)
        // Payment response handling would be implemented here
    }
    
    func handleHandshakePacket(_ packet: BluetoothDataPacket, from deviceId: String) {
        logger.log("Received handshake packet from \(deviceId)", level: .info)
        
        // Send acknowledgment
        let ackPacket = BluetoothDataPacket(
            type: .acknowledgment,
            sequenceNumber: 0,
            totalPackets: 1,
            data: "handshake_ack".data(using: .utf8) ?? Data()
        )
        
        sendPacketToDevice(ackPacket, deviceId: deviceId)
    }
    
    func handleAcknowledgmentPacket(_ packet: BluetoothDataPacket, from deviceId: String) {
        logger.log("Received acknowledgment packet from \(deviceId)", level: .info)
        // Handle acknowledgment - could be used for reliable transmission
    }
    
    func handleErrorPacket(_ packet: BluetoothDataPacket, from deviceId: String) {
        logger.log("Received error packet from \(deviceId)", level: .warning)
        // Handle error packet
    }
    
    func sendPacketToDevice(_ packet: BluetoothDataPacket, deviceId: String) {
        do {
            let data = try JSONEncoder().encode(packet)
            
            // Send via peripheral if we're central
            if let peripheral = connectedPeripherals[deviceId],
               let service = peripheral.services?.first(where: { $0.uuid == CBUUID(string: Constants.Bluetooth.serviceUUID) }),
               let characteristic = service.characteristics?.first(where: { $0.uuid == CBUUID(string: Constants.Bluetooth.characteristicUUID) }) {
                
                let writeType: CBCharacteristicWriteType = characteristic.properties.contains(.writeWithoutResponse) ? .withoutResponse : .withResponse
                peripheral.writeValue(data, for: characteristic, type: writeType)
            }
            
            // Send via central if we're peripheral
            if let central = connectedCentrals[deviceId],
               let characteristic = self.characteristic {
                
                let success = peripheralManager?.updateValue(data, for: characteristic, onSubscribedCentrals: [central]) ?? false
                if !success {
                    logger.log("Failed to send packet to central \(deviceId)", level: .warning)
                }
            }
            
        } catch {
            logger.log("Failed to encode packet: \(error.localizedDescription)", level: .error)
        }
    }
}