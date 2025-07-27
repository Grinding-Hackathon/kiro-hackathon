//
//  BackgroundServiceCoordinator.swift
//  offline-blockchain-wallet-ios
//
//  Created by Kiro on 7/21/25.
//

import Foundation
import BackgroundTasks
import UserNotifications
import Combine
#if canImport(UIKit)
import UIKit
#endif

protocol BackgroundServiceCoordinatorProtocol {
    func initializeBackgroundServices()
    func startAllBackgroundServices()
    func stopAllBackgroundServices()
    func handleAppDidEnterBackground()
    func handleAppWillEnterForeground()
    func handleAppWillTerminate()
    func getServiceStatus() -> BackgroundServiceStatus
}

class BackgroundServiceCoordinator: BackgroundServiceCoordinatorProtocol {
    private let backgroundTaskManager: BackgroundTaskManagerProtocol
    private let offlineTokenService: OfflineTokenServiceProtocol
    private let networkService: NetworkServiceProtocol
    private let bluetoothService: BluetoothServiceProtocol
    private let pushNotificationService: PushNotificationServiceProtocol
    private let backgroundBluetoothService: BackgroundBluetoothServiceProtocol
    private let storageService: StorageServiceProtocol
    private let logger = Logger.shared
    
    private var cancellables = Set<AnyCancellable>()
    private var isInitialized = false
    
    init(backgroundTaskManager: BackgroundTaskManagerProtocol,
         offlineTokenService: OfflineTokenServiceProtocol,
         networkService: NetworkServiceProtocol,
         bluetoothService: BluetoothServiceProtocol,
         pushNotificationService: PushNotificationServiceProtocol,
         backgroundBluetoothService: BackgroundBluetoothServiceProtocol,
         storageService: StorageServiceProtocol) {
        self.backgroundTaskManager = backgroundTaskManager
        self.offlineTokenService = offlineTokenService
        self.networkService = networkService
        self.bluetoothService = bluetoothService
        self.pushNotificationService = pushNotificationService
        self.backgroundBluetoothService = backgroundBluetoothService
        self.storageService = storageService
        
        setupNotificationObservers()
    }
    
    deinit {
        stopAllBackgroundServices()
        NotificationCenter.default.removeObserver(self)
    }
    
    // MARK: - Initialization
    
    func initializeBackgroundServices() {
        guard !isInitialized else {
            logger.info("Background services already initialized")
            return
        }
        
        logger.info("Initializing background services")
        
        // Register background tasks
        backgroundTaskManager.registerBackgroundTasks()
        
        // Request notification permissions
        Task {
            let granted = await backgroundTaskManager.requestNotificationPermissions()
            if granted {
                logger.info("Notification permissions granted")
            } else {
                logger.warning("Notification permissions denied - some features may not work")
            }
        }
        
        // Start automatic token management
        offlineTokenService.startAutomaticTokenManagement()
        
        // Schedule initial background tasks
        backgroundTaskManager.scheduleAllBackgroundTasks()
        
        isInitialized = true
        logger.info("Background services initialized successfully")
    }
    
    // MARK: - Service Management
    
    func startAllBackgroundServices() {
        logger.info("Starting all background services")
        
        // Ensure services are initialized
        if !isInitialized {
            initializeBackgroundServices()
        }
        
        // Start automatic token management if not already running
        if !offlineTokenService.isAutomaticManagementActive {
            offlineTokenService.startAutomaticTokenManagement()
        }
        
        // Schedule background tasks
        backgroundTaskManager.scheduleAllBackgroundTasks()
        
        // Start background Bluetooth advertising if app is in background
        #if canImport(UIKit)
        if UIApplication.shared.applicationState == .background {
            backgroundBluetoothService.startBackgroundAdvertising()
        }
        #endif
        
        logger.info("All background services started")
    }
    
    func stopAllBackgroundServices() {
        logger.info("Stopping all background services")
        
        // Stop automatic token management
        offlineTokenService.stopAutomaticTokenManagement()
        
        // Cancel background tasks
        backgroundTaskManager.cancelAllBackgroundTasks()
        
        // Stop background Bluetooth advertising
        backgroundBluetoothService.stopBackgroundAdvertising()
        
        // Clear cancellables
        cancellables.removeAll()
        
        logger.info("All background services stopped")
    }
    
    // MARK: - App Lifecycle Handling
    
    func handleAppDidEnterBackground() {
        logger.info("App entered background - activating background services")
        
        // Schedule background tasks
        backgroundTaskManager.handleAppWillEnterBackground()
        
        // Start background Bluetooth advertising
        backgroundBluetoothService.startBackgroundAdvertising()
        
        // Trigger immediate token expiration check
        Task {
            await backgroundTaskManager.handleTokenExpirationCheck()
        }
        
        // Perform immediate background refresh
        Task {
            await backgroundTaskManager.handleBackgroundAppRefresh()
        }
        
        // Update app badge with current status
        Task {
            await updateAppBadge()
        }
        
        // Send notification about background mode activation
        pushNotificationService.sendBackgroundTaskCompletionNotification(
            taskType: "Background Mode Activation",
            success: true,
            details: "Background services are now active"
        )
        
        logger.info("Background services activated successfully")
    }
    
    func handleAppWillEnterForeground() {
        logger.info("App entering foreground - adjusting background services")
        
        // Handle app becoming active
        backgroundTaskManager.handleAppDidBecomeActive()
        
        // Stop background Bluetooth advertising (foreground will handle it)
        backgroundBluetoothService.stopBackgroundAdvertising()
        
        // Perform immediate sync if online
        if networkService.isOnline() {
            Task {
                await backgroundTaskManager.handlePeriodicSync()
            }
        } else {
            logger.info("Device offline - skipping foreground sync")
        }
        
        // Check for expired tokens immediately
        Task {
            await backgroundTaskManager.handleTokenExpirationCheck()
        }
        
        // Update app badge
        Task {
            await updateAppBadge()
        }
        
        // Restart regular Bluetooth advertising for foreground
        Task {
            await restartForegroundBluetoothAdvertising()
        }
        
        logger.info("Foreground services activated successfully")
    }
    
    func handleAppWillTerminate() {
        logger.info("App will terminate - cleaning up background services")
        
        backgroundTaskManager.handleAppWillTerminate()
        stopAllBackgroundServices()
    }
    
    // MARK: - Service Status
    
    func getServiceStatus() -> BackgroundServiceStatus {
        #if canImport(UIKit)
        let backgroundRefreshStatus = UIApplication.shared.backgroundRefreshStatus
        let backgroundRefreshEnabled = backgroundRefreshStatus == .available
        let backgroundRefreshStatusDescription = backgroundRefreshStatus.description
        #else
        let backgroundRefreshEnabled = false
        let backgroundRefreshStatusDescription = "Not Available"
        #endif
        
        return BackgroundServiceStatus(
            isInitialized: isInitialized,
            backgroundRefreshEnabled: backgroundRefreshEnabled,
            backgroundRefreshStatus: backgroundRefreshStatusDescription,
            automaticTokenManagementActive: offlineTokenService.isAutomaticManagementActive,
            backgroundBluetoothActive: backgroundBluetoothService.isBackgroundAdvertising,
            notificationPermissionsGranted: false, // This would need to be async
            networkOnline: networkService.isOnline(),
            lastBackgroundSync: UserDefaults.standard.object(forKey: "lastBackgroundSync") as? Date,
            pendingBackgroundTasks: getPendingBackgroundTaskCount()
        )
    }
    
    // MARK: - Private Methods
    
    private func setupNotificationObservers() {
        // Listen for network connectivity changes
        NotificationCenter.default.publisher(for: .networkConnectivityChanged)
            .sink { [weak self] _ in
                self?.handleNetworkConnectivityChange()
            }
            .store(in: &cancellables)
        
        // Listen for token expiration events
        NotificationCenter.default.publisher(for: .tokenExpirationDetected)
            .sink { [weak self] notification in
                self?.handleTokenExpirationDetected(notification)
            }
            .store(in: &cancellables)
        
        // Listen for auto-purchase events
        NotificationCenter.default.publisher(for: .autoPurchaseTriggered)
            .sink { [weak self] notification in
                self?.handleAutoPurchaseTriggered(notification)
            }
            .store(in: &cancellables)
        
        // Listen for balance updates
        NotificationCenter.default.publisher(for: .balanceUpdated)
            .sink { [weak self] notification in
                self?.handleBalanceUpdated(notification)
            }
            .store(in: &cancellables)
    }
    
    private func handleNetworkConnectivityChange() {
        logger.info("Network connectivity changed")
        
        if networkService.isOnline() {
            // Network came back online - process offline queue
            Task {
                await networkService.processOfflineQueue()
                await backgroundTaskManager.handlePeriodicSync()
            }
        }
    }
    
    private func handleTokenExpirationDetected(_ notification: Notification) {
        logger.info("Token expiration detected - triggering background check")
        
        Task {
            await backgroundTaskManager.handleTokenExpirationCheck()
        }
    }
    
    private func handleAutoPurchaseTriggered(_ notification: Notification) {
        logger.info("Auto-purchase triggered - updating services")
        
        // Update app badge after auto-purchase
        Task {
            await updateAppBadge()
        }
    }
    
    private func handleBalanceUpdated(_ notification: Notification) {
        logger.info("Balance updated - refreshing Bluetooth advertising")
        
        // Update Bluetooth advertising with new balance
        Task {
            await backgroundBluetoothService.updateAdvertisingData()
        }
    }
    
    private func updateAppBadge() async {
        do {
            // Get current offline balance
            let offlineBalance = await offlineTokenService.getAvailableBalance()
            
            // Get pending transactions count
            let pendingTransactions = try await getPendingTransactionsCount()
            
            // Set badge to pending transactions count (0 clears the badge)
            #if canImport(UIKit)
            await MainActor.run {
                UIApplication.shared.applicationIconBadgeNumber = pendingTransactions
            }
            #endif
            
            logger.info("App badge updated: \(pendingTransactions) pending transactions")
            
        } catch {
            logger.error("Failed to update app badge: \(error)")
        }
    }
    
    private func getPendingTransactionsCount() async throws -> Int {
        return try await storageService.getPendingTransactionsCount()
    }
    
    private func getPendingBackgroundTaskCount() -> Int {
        // This is not directly accessible from BGTaskScheduler
        // Return estimated count based on scheduled tasks
        return 4 // backgroundrefresh, tokenexpiration, periodicsync, bluetooth
    }
    
    private func restartForegroundBluetoothAdvertising() async {
        do {
            guard let walletState = try await storageService.loadWalletState() else {
                logger.warning("No wallet state available for Bluetooth advertising")
                return
            }
            
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
                capabilities: ["offline_tokens", "bluetooth_transfer", "foreground_active"],
                offlineBalance: walletState.offlineBalance,
                lastSyncTimestamp: walletState.lastSyncTimestamp
            )
            
            try bluetoothService.startAdvertising(walletInfo: walletInfo)
            logger.info("Foreground Bluetooth advertising restarted")
            
        } catch {
            logger.error("Failed to restart foreground Bluetooth advertising: \(error)")
        }
    }
}

// MARK: - Supporting Types

struct BackgroundServiceStatus {
    let isInitialized: Bool
    let backgroundRefreshEnabled: Bool
    let backgroundRefreshStatus: String
    let automaticTokenManagementActive: Bool
    let backgroundBluetoothActive: Bool
    let notificationPermissionsGranted: Bool
    let networkOnline: Bool
    let lastBackgroundSync: Date?
    let pendingBackgroundTasks: Int
    
    var description: String {
        return """
        Background Service Status:
        - Initialized: \(isInitialized)
        - Background Refresh: \(backgroundRefreshEnabled) (\(backgroundRefreshStatus))
        - Auto Token Management: \(automaticTokenManagementActive)
        - Background Bluetooth: \(backgroundBluetoothActive)
        - Notifications: \(notificationPermissionsGranted)
        - Network: \(networkOnline ? "Online" : "Offline")
        - Last Sync: \(lastBackgroundSync?.description ?? "Never")
        - Pending Tasks: \(pendingBackgroundTasks)
        """
    }
}

// MARK: - Extensions

#if canImport(UIKit)
extension UIBackgroundRefreshStatus {
    var description: String {
        switch self {
        case .available:
            return "Available"
        case .denied:
            return "Denied"
        case .restricted:
            return "Restricted"
        @unknown default:
            return "Unknown"
        }
    }
}
#endif

// MARK: - Additional Notification Names

extension Notification.Name {
    static let networkConnectivityChanged = Notification.Name("networkConnectivityChanged")
}