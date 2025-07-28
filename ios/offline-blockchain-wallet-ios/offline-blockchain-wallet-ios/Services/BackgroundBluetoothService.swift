//
//  BackgroundBluetoothService.swift
//  offline-blockchain-wallet-ios
//
//  Created by Kiro on 7/21/25.
//

import Foundation
import CoreBluetooth
import BackgroundTasks
#if canImport(UIKit)
import UIKit
#endif

protocol BackgroundBluetoothServiceProtocol {
    func startBackgroundAdvertising()
    func stopBackgroundAdvertising()
    func handleIncomingConnection(_ connection: BluetoothConnection)
    func updateAdvertisingData() async
    func scheduleAdvertisingRefresh()
    func scheduleBackgroundBluetoothTask()
    func handleBackgroundBluetoothTask(_ task: BGProcessingTask)
    var isBackgroundAdvertising: Bool { get }
}

class BackgroundBluetoothService: NSObject, BackgroundBluetoothServiceProtocol {
    private let bluetoothService: BluetoothServiceProtocol
    private let storageService: StorageServiceProtocol
    private let pushNotificationService: PushNotificationServiceProtocol
    private let logger = Logger.shared
    
    private var _isBackgroundAdvertising = false
    
    var isBackgroundAdvertising: Bool {
        return _isBackgroundAdvertising
    }
    private var advertisingRefreshTimer: Timer?
    #if canImport(UIKit)
    private var backgroundTask: UIBackgroundTaskIdentifier = .invalid
    #endif
    
    // Background advertising configuration
    private let advertisingRefreshInterval: TimeInterval = 300 // 5 minutes
    private let maxBackgroundAdvertisingDuration: TimeInterval = 180 // 3 minutes
    private let connectionTimeoutInterval: TimeInterval = 30 // 30 seconds
    
    // Connection tracking
    private var activeConnections: Set<String> = []
    private var connectionAttempts: [String: Date] = [:]
    
    init(bluetoothService: BluetoothServiceProtocol,
         storageService: StorageServiceProtocol,
         pushNotificationService: PushNotificationServiceProtocol) {
        self.bluetoothService = bluetoothService
        self.storageService = storageService
        self.pushNotificationService = pushNotificationService
        super.init()
        
        setupNotificationObservers()
    }
    
    deinit {
        stopBackgroundAdvertising()
        NotificationCenter.default.removeObserver(self)
    }
    
    // MARK: - Setup
    
    private func setupNotificationObservers() {
        #if canImport(UIKit)
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(appDidEnterBackground),
            name: UIApplication.didEnterBackgroundNotification,
            object: nil
        )
        
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(appWillEnterForeground),
            name: UIApplication.willEnterForegroundNotification,
            object: nil
        )
        #endif
    }
    
    // MARK: - Background Advertising Management
    
    func startBackgroundAdvertising() {
        guard !_isBackgroundAdvertising else {
            logger.info("Background advertising already active")
            return
        }
        
        logger.info("Starting background Bluetooth advertising")
        
        Task {
            await updateAdvertisingData()
            
            // Start background task to maintain advertising
            #if canImport(UIKit)
            backgroundTask = UIApplication.shared.beginBackgroundTask(withName: "BluetoothAdvertising") { [weak self] in
                self?.stopBackgroundAdvertising()
            }
            #endif
            
            _isBackgroundAdvertising = true
            scheduleAdvertisingRefresh()
            
            // Set timer to stop advertising after max duration
            DispatchQueue.main.asyncAfter(deadline: .now() + maxBackgroundAdvertisingDuration) { [weak self] in
                self?.stopBackgroundAdvertising()
            }
        }
    }
    
    func stopBackgroundAdvertising() {
        guard _isBackgroundAdvertising else { return }
        
        logger.info("Stopping background Bluetooth advertising")
        
        _isBackgroundAdvertising = false
        advertisingRefreshTimer?.invalidate()
        advertisingRefreshTimer = nil
        
        // End background task
        #if canImport(UIKit)
        if backgroundTask != .invalid {
            UIApplication.shared.endBackgroundTask(backgroundTask)
            backgroundTask = .invalid
        }
        #endif
    }
    
    func scheduleAdvertisingRefresh() {
        advertisingRefreshTimer?.invalidate()
        
        advertisingRefreshTimer = Timer.scheduledTimer(withTimeInterval: advertisingRefreshInterval, repeats: true) { [weak self] _ in
            Task {
                await self?.updateAdvertisingData()
            }
        }
    }
    
    func updateAdvertisingData() async {
        do {
            guard let walletState = try await storageService.loadWalletState() else {
                logger.warning("No wallet state available for advertising")
                return
            }
            
            // Get current available balance for advertising
            let availableBalance = try await getAvailableOfflineBalance()
            
            let walletInfo = WalletInfo(
                walletId: walletState.walletId,
                publicKey: walletState.publicKey,
                deviceName: {
                    #if canImport(UIKit)
                    return UIDevice.current.name
                    #else
                    return "Unknown Device"
                    #endif
                }(),
                capabilities: ["offline_tokens", "bluetooth_transfer", "background_advertising", "auto_purchase"],
                offlineBalance: availableBalance,
                lastSyncTimestamp: walletState.lastSyncTimestamp
            )
            
            try bluetoothService.startAdvertising(walletInfo: walletInfo)
            logger.info("Advertising data updated - balance: \(availableBalance), capabilities: \(walletInfo.capabilities)")
            
        } catch {
            logger.error("Failed to update advertising data: \(error)")
        }
    }
    
    private func getAvailableOfflineBalance() async throws -> Double {
        let allTokens = try await storageService.getAllOfflineTokens()
        return allTokens.filter { !$0.isSpent && !$0.isExpired }.reduce(0) { $0 + $1.amount }
    }
    
    // MARK: - Connection Handling
    
    func handleIncomingConnection(_ connection: BluetoothConnection) {
        logger.info("Handling incoming Bluetooth connection: \(connection.deviceId)")
        
        // Track active connection
        activeConnections.insert(connection.deviceId)
        connectionAttempts[connection.deviceId] = Date()
        
        // Send notification about incoming connection
        pushNotificationService.sendBluetoothConnectionNotification(
            deviceName: connection.deviceName,
            connected: true
        )
        
        // Store connection info for potential transaction processing
        Task {
            await storeIncomingConnection(connection)
            await handleConnectionTimeout(for: connection.deviceId)
        }
    }
    
    func handleConnectionDisconnected(_ deviceId: String) {
        logger.info("Bluetooth connection disconnected: \(deviceId)")
        
        // Remove from active connections
        activeConnections.remove(deviceId)
        connectionAttempts.removeValue(forKey: deviceId)
        
        // Update connection record
        Task {
            await updateConnectionStatus(deviceId: deviceId, status: .disconnected)
        }
    }
    
    private func handleConnectionTimeout(for deviceId: String) async {
        // Wait for connection timeout
        try? await Task.sleep(nanoseconds: UInt64(connectionTimeoutInterval * 1_000_000_000))
        
        // Check if connection is still active
        if activeConnections.contains(deviceId) {
            logger.warning("Connection timeout for device: \(deviceId)")
            
            // Remove from active connections
            activeConnections.remove(deviceId)
            connectionAttempts.removeValue(forKey: deviceId)
            
            // Update connection status
            await updateConnectionStatus(deviceId: deviceId, status: .failed)
        }
    }
    
    private func storeIncomingConnection(_ connection: BluetoothConnection) async {
        do {
            // Create a connection record for tracking
            let connectionRecord = BluetoothConnectionRecord(
                deviceId: connection.deviceId,
                deviceName: connection.deviceName,
                connectedAt: Date(),
                connectionType: .incoming,
                status: .connected
            )
            
            try await storageService.saveBluetoothConnection(connectionRecord)
            logger.info("Stored incoming connection record")
            
        } catch {
            logger.error("Failed to store connection record: \(error)")
        }
    }
    
    private func updateConnectionStatus(deviceId: String, status: BackgroundBluetoothConnectionStatus) async {
        do {
            // Update the connection record status
            try await storageService.updateBluetoothConnectionStatus(
                deviceId: deviceId,
                status: status,
                disconnectedAt: status == .disconnected || status == .failed ? Date() : nil
            )
            
            logger.info("Updated connection status for \(deviceId): \(status)")
            
        } catch {
            logger.error("Failed to update connection status: \(error)")
        }
    }
    
    // MARK: - App Lifecycle Handlers
    
    @objc private func appDidEnterBackground() {
        logger.info("App entered background, starting background advertising")
        startBackgroundAdvertising()
    }
    
    @objc private func appWillEnterForeground() {
        logger.info("App entering foreground, stopping background advertising")
        stopBackgroundAdvertising()
    }
    
    // MARK: - Background Task Scheduling
    
    func scheduleBackgroundBluetoothTask() {
        let request = BGProcessingTaskRequest(identifier: "com.offlineblockchainwallet.bluetooth")
        request.requiresNetworkConnectivity = false
        request.requiresExternalPower = false
        request.earliestBeginDate = Date(timeIntervalSinceNow: 10 * 60) // 10 minutes
        
        do {
            try BGTaskScheduler.shared.submit(request)
            logger.info("Background Bluetooth task scheduled")
        } catch {
            logger.error("Failed to schedule background Bluetooth task: \(error)")
        }
    }
    
    func handleBackgroundBluetoothTask(_ task: BGProcessingTask) {
        logger.info("Handling background Bluetooth task")
        
        // Schedule next task
        scheduleBackgroundBluetoothTask()
        
        task.expirationHandler = {
            self.logger.warning("Background Bluetooth task expired")
            self.stopBackgroundAdvertising()
            task.setTaskCompleted(success: false)
        }
        
        // Start advertising for a limited time
        startBackgroundAdvertising()
        
        // Complete task after advertising period
        DispatchQueue.main.asyncAfter(deadline: .now() + maxBackgroundAdvertisingDuration) {
            self.stopBackgroundAdvertising()
            task.setTaskCompleted(success: true)
        }
    }
}

// MARK: - Supporting Types