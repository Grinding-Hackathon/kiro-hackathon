//
//  BackgroundTaskManager.swift
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

protocol BackgroundTaskManagerProtocol {
    func registerBackgroundTasks()
    func scheduleBackgroundAppRefresh()
    func scheduleTokenExpirationMonitoring()
    func schedulePeriodicSync()
    func scheduleAllBackgroundTasks()
    func cancelAllBackgroundTasks()
    func handleBackgroundAppRefresh()
    func handleTokenExpirationCheck()
    func handlePeriodicSync()
    func handleAppWillEnterBackground()
    func handleAppDidBecomeActive()
    func handleAppWillTerminate()
    func requestNotificationPermissions() async -> Bool
    func sendNotification(title: String, body: String, identifier: String)
}

class BackgroundTaskManager: NSObject, BackgroundTaskManagerProtocol {
    private let offlineTokenService: OfflineTokenServiceProtocol
    private let networkService: NetworkServiceProtocol
    private let bluetoothService: BluetoothServiceProtocol
    private let storageService: StorageServiceProtocol
    private let pushNotificationService: PushNotificationServiceProtocol
    private let backgroundBluetoothService: BackgroundBluetoothServiceProtocol
    private let logger = Logger.shared
    
    // Background task identifiers
    private let backgroundAppRefreshIdentifier = "com.offlineblockchainwallet.backgroundrefresh"
    private let tokenExpirationIdentifier = "com.offlineblockchainwallet.tokenexpiration"
    private let periodicSyncIdentifier = "com.offlineblockchainwallet.periodicsync"
    
    // Notification identifiers
    private let tokenExpirationNotificationId = "token_expiration"
    private let lowBalanceNotificationId = "low_balance"
    private let transactionStatusNotificationId = "transaction_status"
    private let syncCompleteNotificationId = "sync_complete"
    
    private var cancellables = Set<AnyCancellable>()
    
    init(offlineTokenService: OfflineTokenServiceProtocol,
         networkService: NetworkServiceProtocol,
         bluetoothService: BluetoothServiceProtocol,
         storageService: StorageServiceProtocol,
         pushNotificationService: PushNotificationServiceProtocol = PushNotificationService(),
         backgroundBluetoothService: BackgroundBluetoothServiceProtocol? = nil) {
        self.offlineTokenService = offlineTokenService
        self.networkService = networkService
        self.bluetoothService = bluetoothService
        self.storageService = storageService
        self.pushNotificationService = pushNotificationService
        
        // Initialize background Bluetooth service
        self.backgroundBluetoothService = backgroundBluetoothService ?? BackgroundBluetoothService(
            bluetoothService: bluetoothService,
            storageService: storageService,
            pushNotificationService: pushNotificationService
        )
        
        super.init()
        setupNotificationCenter()
    }
    
    // MARK: - Background Task Registration
    
    private static var isRegistered = false
    
    func registerBackgroundTasks() {
        // Prevent duplicate registration
        guard !Self.isRegistered else {
            logger.info("Background tasks already registered, skipping")
            return
        }
        
        logger.info("Registering background tasks")
        
        // Register background app refresh task
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: backgroundAppRefreshIdentifier,
            using: nil
        ) { [weak self] task in
            self?.handleBackgroundAppRefresh(task: task as! BGAppRefreshTask)
        }
        
        // Register token expiration monitoring task
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: tokenExpirationIdentifier,
            using: nil
        ) { [weak self] task in
            self?.handleTokenExpirationCheck(task: task as! BGProcessingTask)
        }
        
        // Register periodic sync task
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: periodicSyncIdentifier,
            using: nil
        ) { [weak self] task in
            self?.handlePeriodicSync(task: task as! BGProcessingTask)
        }
        
        Self.isRegistered = true
        logger.info("Background tasks registered successfully")
    }
    
    // MARK: - Background Task Scheduling
    
    func scheduleBackgroundAppRefresh() {
        let request = BGAppRefreshTaskRequest(identifier: backgroundAppRefreshIdentifier)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60) // 15 minutes
        
        do {
            try BGTaskScheduler.shared.submit(request)
            logger.info("Background app refresh scheduled")
        } catch {
            logger.error("Failed to schedule background app refresh: \(error)")
        }
    }
    
    func scheduleTokenExpirationMonitoring() {
        let request = BGProcessingTaskRequest(identifier: tokenExpirationIdentifier)
        request.requiresNetworkConnectivity = true
        request.requiresExternalPower = false
        request.earliestBeginDate = Date(timeIntervalSinceNow: 60 * 60) // 1 hour
        
        do {
            try BGTaskScheduler.shared.submit(request)
            logger.info("Token expiration monitoring scheduled")
        } catch {
            logger.error("Failed to schedule token expiration monitoring: \(error)")
        }
    }
    
    func schedulePeriodicSync() {
        let request = BGProcessingTaskRequest(identifier: periodicSyncIdentifier)
        request.requiresNetworkConnectivity = true
        request.requiresExternalPower = false
        request.earliestBeginDate = Date(timeIntervalSinceNow: 30 * 60) // 30 minutes
        
        do {
            try BGTaskScheduler.shared.submit(request)
            logger.info("Periodic sync scheduled")
        } catch {
            logger.error("Failed to schedule periodic sync: \(error)")
        }
    }
    
    // MARK: - Background Task Handlers
    
    private func handleBackgroundAppRefresh(task: BGAppRefreshTask) {
        logger.info("Handling background app refresh")
        
        task.expirationHandler = {
            task.setTaskCompleted(success: false)
        }
        
        Task {
            await performBackgroundRefresh()
            
            // Schedule next refresh
            scheduleBackgroundAppRefresh()
            
            task.setTaskCompleted(success: true)
        }
    }
    
    func handleBackgroundAppRefresh() {
        // Public method for manual triggering
        Task {
            await performBackgroundRefresh()
        }
    }
    
    private func handleTokenExpirationCheck(task: BGProcessingTask) {
        logger.info("Handling token expiration check")
        
        task.expirationHandler = {
            task.setTaskCompleted(success: false)
        }
        
        Task {
            await performTokenExpirationCheck()
            
            // Schedule next check
            scheduleTokenExpirationMonitoring()
            
            task.setTaskCompleted(success: true)
        }
    }
    
    func handleTokenExpirationCheck() {
        // Public method for manual triggering
        Task {
            await performTokenExpirationCheck()
        }
    }
    
    private func handlePeriodicSync(task: BGProcessingTask) {
        logger.info("Handling periodic sync")
        
        task.expirationHandler = {
            task.setTaskCompleted(success: false)
        }
        
        Task {
            await performPeriodicSync()
            
            // Schedule next sync
            schedulePeriodicSync()
            
            task.setTaskCompleted(success: true)
        }
    }
    
    func handlePeriodicSync() {
        // Public method for manual triggering
        Task {
            await performPeriodicSync()
        }
    }
    
    // MARK: - Core Background Operations
    
    private func performBackgroundRefresh() async {
        logger.info("Performing background refresh")
        
        do {
            // Check for tokens expiring soon
            let tokensExpiring24h = try await getTokensExpiringSoon(hours: 24)
            let tokensExpiring1h = try await getTokensExpiringSoon(hours: 1)
            let alreadyExpiredTokens = try await getExpiredTokens()
            
            // Send notifications for expiring tokens
            if !tokensExpiring1h.isEmpty {
                sendNotification(
                    title: "Tokens Expiring Soon",
                    body: "\(tokensExpiring1h.count) token(s) expire within 1 hour",
                    identifier: "tokens_expiring_1h_\(UUID().uuidString)"
                )
            } else if !tokensExpiring24h.isEmpty {
                sendNotification(
                    title: "Tokens Expiring",
                    body: "\(tokensExpiring24h.count) token(s) expire within 24 hours",
                    identifier: "tokens_expiring_24h_\(UUID().uuidString)"
                )
            }
            
            // Handle already expired tokens
            if !alreadyExpiredTokens.isEmpty {
                logger.warning("Found \(alreadyExpiredTokens.count) expired tokens")
                // Note: isExpired is a computed property, so we don't need to update it
                // The tokens are already expired based on their expiration date
                
                sendNotification(
                    title: "Tokens Expired",
                    body: "\(alreadyExpiredTokens.count) token(s) have expired",
                    identifier: "tokens_expired_\(UUID().uuidString)"
                )
            }
            
            // Check for auto-purchase
            await checkAndPerformAutoPurchase(urgentReason: "background refresh")
            
            // Check offline balance changes
            await checkOfflineBalanceChanges()
            
            // Update app badge
            #if canImport(UIKit)
            DispatchQueue.main.async {
                let badgeCount = alreadyExpiredTokens.count
                UIApplication.shared.applicationIconBadgeNumber = badgeCount
            }
            #endif
            
        } catch {
            logger.error("Background refresh failed: \(error)")
        }
    }
    
    private func performTokenExpirationCheck() async {
        logger.info("Performing token expiration check")
        
        do {
            // Check for tokens expiring in the next 24 hours
            let expiringTokens = try await getTokensExpiringSoon(hours: 24)
            if !expiringTokens.isEmpty {
                let message = "You have \(expiringTokens.count) token(s) expiring within 24 hours"
                sendNotification(
                    title: "Token Expiration Warning",
                    body: message,
                    identifier: "token_expiration_\(UUID().uuidString)"
                )
            }
            
            // Handle already expired tokens
            let expiredTokens = try await getExpiredTokens()
            if !expiredTokens.isEmpty {
                logger.warning("Found \(expiredTokens.count) expired tokens")
                // Note: isExpired is a computed property, so we don't need to update it
                // The tokens are already expired based on their expiration date
            }
            
        } catch {
            logger.error("Token expiration check failed: \(error)")
        }
    }
    
    private func performPeriodicSync() async {
        logger.info("Performing periodic sync")
        
        do {
            // Process offline queue first
            let offlineTransactions = try await storageService.getPendingTransactions()
            let offlineCount = offlineTransactions.filter { $0.isOffline }.count
            
            if offlineCount > 0 {
                logger.info("Processing \(offlineCount) offline transactions")
                for transaction in offlineTransactions.filter({ $0.isOffline }) {
                    do {
                        let submissionResponse = try await networkService.submitTransaction(transaction: transaction)
                        var updatedTransaction = transaction
                        updatedTransaction.isOffline = false
                        if let status = TransactionStatus(rawValue: submissionResponse.status) {
                            updatedTransaction.status = status
                        }
                        updatedTransaction.blockchainTxHash = submissionResponse.transactionId
                        try await storageService.updateTransaction(updatedTransaction)
                        logger.info("Successfully submitted offline transaction")
                    } catch {
                        logger.warning("Failed to submit offline transaction: \(error)")
                    }
                }
            }
            
            // Check for transaction status updates
            let pendingTransactions = try await storageService.getPendingTransactions()
            for transaction in pendingTransactions.prefix(10) { // Limit to avoid rate limiting
                do {
                    let statusResponse = try await networkService.getTransactionStatus(transactionId: transaction.id)
                    if statusResponse.status != transaction.status {
                        var updatedTransaction = transaction
                        updatedTransaction.status = statusResponse.status
                        try await storageService.updateTransaction(updatedTransaction)
                        logger.info("Updated transaction status")
                    }
                } catch {
                    logger.warning("Failed to check transaction status: \(error)")
                }
            }
            
            // Sync wallet balance
            if let walletState = try await storageService.loadWalletState() {
                do {
                    let balanceResponse = try await networkService.getWalletBalance(walletId: walletState.walletId)
                    var updatedState = walletState
                    updatedState.blockchainBalance = balanceResponse.blockchainBalance
                    updatedState.lastSyncTimestamp = Date()
                    try await storageService.saveWalletState(updatedState)
                    logger.info("Wallet balance synced")
                } catch {
                    logger.warning("Failed to sync wallet balance: \(error)")
                }
            }
            
            // Handle expired tokens
            try await offlineTokenService.handleExpiredTokens()
            
            // Update Bluetooth advertising
            await updateBluetoothAdvertising()
            
        } catch {
            logger.error("Periodic sync failed: \(error)")
        }
    }
    
    private func checkAndPerformAutoPurchase(urgentReason: String?) async {
        do {
            guard let walletState = try await storageService.loadWalletState(),
                  walletState.autoRechargeEnabled else {
                return
            }
            
            let currentBalance = await offlineTokenService.getAvailableBalance()
            let threshold = walletState.autoRechargeThreshold
            
            if currentBalance <= threshold {
                let amount = walletState.autoRechargeAmount
                logger.info("Auto-purchase triggered: balance \(currentBalance) <= threshold \(threshold)")
                
                do {
                    let newTokens = try await purchaseTokensWithRetry(amount: amount)
                    logger.info("Auto-purchase successful: \(newTokens.count) tokens purchased")
                    
                    // Send notification
                    let message = urgentReason != nil ? 
                        "Emergency auto-purchase completed: \(newTokens.count) tokens added" :
                        "Auto-purchase completed: \(newTokens.count) tokens added"
                    
                    sendNotification(
                        title: "Tokens Auto-Purchased",
                        body: message,
                        identifier: "auto_purchase_\(UUID().uuidString)"
                    )
                    
                } catch {
                    logger.error("Auto-purchase failed: \(error)")
                    
                    if isTransientError(error) {
                        scheduleAutoPurchaseRetry()
                    }
                    
                    // Send failure notification
                    sendNotification(
                        title: "Auto-Purchase Failed",
                        body: "Failed to automatically purchase tokens. Please check your account.",
                        identifier: "auto_purchase_failed_\(UUID().uuidString)"
                    )
                }
            }
        } catch {
            logger.error("Auto-purchase check failed: \(error)")
        }
    }
    
    private func checkOfflineBalanceChanges() async {
        do {
            guard let walletState = try await storageService.loadWalletState() else { return }
            
            let currentOfflineBalance = await offlineTokenService.getAvailableBalance()
            let previousBalance = walletState.lastKnownOfflineBalance ?? 0
            
            if abs(currentOfflineBalance - previousBalance) > 0.01 {
                logger.info("Offline balance changed from \(previousBalance) to \(currentOfflineBalance)")
                
                // Update stored balance
                var updatedState = walletState
                updatedState.lastKnownOfflineBalance = currentOfflineBalance
                try await storageService.saveWalletState(updatedState)
                
                // Check if auto-purchase is needed
                await checkAndPerformAutoPurchase(urgentReason: nil)
            }
        } catch {
            logger.error("Failed to check offline balance changes: \(error)")
        }
    }
    
    private func updateBluetoothAdvertising() async {
        do {
            guard let walletState = try await storageService.loadWalletState() else {
                logger.warning("No wallet state available for Bluetooth advertising")
                return
            }
            
            let currentBalance = await offlineTokenService.getAvailableBalance()
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
                capabilities: ["offline_tokens", "bluetooth_transfer", "background_active"],
                offlineBalance: currentBalance,
                lastSyncTimestamp: walletState.lastSyncTimestamp
            )
            
            try bluetoothService.startAdvertising(walletInfo: walletInfo)
            logger.info("Bluetooth advertising updated with current balance: \(currentBalance)")
        } catch {
            logger.error("Failed to update Bluetooth advertising: \(error)")
        }
    }
    
    // MARK: - App Lifecycle Management
    
    func scheduleAllBackgroundTasks() {
        scheduleBackgroundAppRefresh()
        scheduleTokenExpirationMonitoring()
        schedulePeriodicSync()
    }
    
    func cancelAllBackgroundTasks() {
        BGTaskScheduler.shared.cancelAllTaskRequests()
        logger.info("All background tasks cancelled")
    }
    
    func handleAppWillEnterBackground() {
        logger.info("App will enter background - scheduling background tasks")
        scheduleAllBackgroundTasks()
    }
    
    func handleAppDidBecomeActive() {
        logger.info("App became active - checking for immediate updates")
        
        Task {
            await performBackgroundRefresh()
        }
    }
    
    func handleAppWillTerminate() {
        logger.info("App will terminate - cleaning up background services")
        cancelAllBackgroundTasks()
    }
    
    // MARK: - Notification Management
    
    func requestNotificationPermissions() async -> Bool {
        return await pushNotificationService.requestPermissions()
    }
    
    func sendNotification(title: String, body: String, identifier: String) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        
        let request = UNNotificationRequest(
            identifier: identifier,
            content: content,
            trigger: nil
        )
        
        UNUserNotificationCenter.current().add(request) { [weak self] error in
            if let error = error {
                self?.logger.error("Failed to send notification: \(error)")
            } else {
                self?.logger.info("Notification sent successfully")
            }
        }
    }
    
    // MARK: - Setup Methods
    
    private func setupNotificationCenter() {
        // Setup app lifecycle notifications
        #if canImport(UIKit)
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(appWillEnterBackground),
            name: UIApplication.willResignActiveNotification,
            object: nil
        )
        
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(appDidBecomeActive),
            name: UIApplication.didBecomeActiveNotification,
            object: nil
        )
        
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(appWillTerminate),
            name: UIApplication.willTerminateNotification,
            object: nil
        )
        #endif
    }
    
    @objc private func appWillEnterBackground() {
        handleAppWillEnterBackground()
    }
    
    @objc private func appDidBecomeActive() {
        handleAppDidBecomeActive()
    }
    
    @objc private func appWillTerminate() {
        handleAppWillTerminate()
    }
    
    deinit {
        NotificationCenter.default.removeObserver(self)
        cancelAllBackgroundTasks()
    }
}

// MARK: - Supporting Types

struct BackgroundRefreshResults {
    var expiredTokensHandled: Bool = false
    var autoPurchaseChecked: Bool = false
    var balanceChecked: Bool = false
    var lightweightSyncPerformed: Bool = false
    var offlineQueueProcessed: Bool = false
    var networkUnavailable: Bool = false
    var bluetoothAdvertisingUpdated: Bool = false
    var appBadgeUpdated: Bool = false
    
    var summary: String {
        var components: [String] = []
        if expiredTokensHandled { components.append("expired tokens handled") }
        if autoPurchaseChecked { components.append("auto-purchase checked") }
        if balanceChecked { components.append("balance checked") }
        if lightweightSyncPerformed { components.append("sync performed") }
        if offlineQueueProcessed { components.append("offline queue processed") }
        if bluetoothAdvertisingUpdated { components.append("bluetooth updated") }
        if appBadgeUpdated { components.append("badge updated") }
        if networkUnavailable { components.append("network unavailable") }
        return components.isEmpty ? "no operations performed" : components.joined(separator: ", ")
    }
}

struct SyncResults {
    var offlineQueueProcessed: Bool = false
    var transactionsSynced: Int = 0
    var transactionStatusUpdates: Int = 0
    var balanceUpdated: Bool = false
    var expiredTokensHandled: Bool = false
    var bluetoothAdvertisingUpdated: Bool = false
    var publicKeysSynced: Bool = false
    
    var summary: String {
        var components: [String] = []
        if offlineQueueProcessed { components.append("offline queue processed") }
        if transactionsSynced > 0 { components.append("\(transactionsSynced) transactions synced") }
        if transactionStatusUpdates > 0 { components.append("\(transactionStatusUpdates) status updates") }
        if balanceUpdated { components.append("balance updated") }
        if expiredTokensHandled { components.append("expired tokens handled") }
        if bluetoothAdvertisingUpdated { components.append("bluetooth updated") }
        if publicKeysSynced { components.append("public keys synced") }
        return components.isEmpty ? "no changes" : components.joined(separator: ", ")
    }
}

// MARK: - BackgroundTaskManager Extension for Helper Methods
extension BackgroundTaskManager {
    
    private func purchaseTokensWithRetry(amount: Double, maxRetries: Int = 3) async throws -> [OfflineToken] {
        var lastError: Error?
        
        for attempt in 1...maxRetries {
            do {
                logger.info("Auto-purchase attempt \(attempt)/\(maxRetries)")
                return try await offlineTokenService.purchaseTokens(amount: amount)
            } catch {
                lastError = error
                logger.warning("Auto-purchase attempt \(attempt) failed: \(error)")
                
                if attempt < maxRetries {
                    // Exponential backoff: 2^attempt seconds
                    let delay = TimeInterval(pow(2.0, Double(attempt)))
                    try await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
                }
            }
        }
        
        throw lastError ?? OfflineTokenError.purchaseFailed(NSError(domain: "RetryFailed", code: -1))
    }
    
    private func isTransientError(_ error: Error) -> Bool {
        // Check if error is likely to be resolved by retrying
        if let urlError = error as? URLError {
            switch urlError.code {
            case .timedOut, .cannotConnectToHost, .networkConnectionLost, .notConnectedToInternet:
                return true
            default:
                return false
            }
        }
        return false
    }
    
    private func scheduleAutoPurchaseRetry() {
        // Schedule a retry in 5 minutes
        DispatchQueue.main.asyncAfter(deadline: .now() + 300) { [weak self] in
            Task {
                await self?.checkAndPerformAutoPurchase(urgentReason: "retry after failure")
            }
        }
    }
    
    private func getTokensExpiringSoon(hours: Int) async throws -> [OfflineToken] {
        let allTokens = try await storageService.getAllOfflineTokens()
        let cutoffDate = Date().addingTimeInterval(TimeInterval(hours * 3600))
        return allTokens.filter { token in
            !token.isSpent && !token.isExpired && token.expirationDate <= cutoffDate
        }
    }
    
    private func getExpiredTokens() async throws -> [OfflineToken] {
        let allTokens = try await storageService.getAllOfflineTokens()
        let now = Date()
        return allTokens.filter { token in
            !token.isSpent && token.expirationDate <= now
        }
    }
}

// MARK: - BackgroundTaskManager: UNUserNotificationCenterDelegate
extension BackgroundTaskManager: UNUserNotificationCenterDelegate {
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        // Show notification even when app is in foreground
        completionHandler([.alert, .sound, .badge])
    }
    
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let identifier = response.notification.request.identifier
        let userInfo = response.notification.request.content.userInfo
        handleNotificationResponse(identifier: identifier, userInfo: userInfo)
        completionHandler()
    }
    
    private func handleNotificationResponse(identifier: String, userInfo: [AnyHashable: Any]) {
        logger.info("Handling notification response: \(identifier)")
        
        // Extract the base identifier (remove any UUID suffixes)
        let baseIdentifier = identifier.components(separatedBy: "_").first ?? identifier
        
        switch baseIdentifier {
        case tokenExpirationNotificationId:
            NotificationCenter.default.post(name: .navigateToTokenManagement, object: nil)
        case lowBalanceNotificationId:
            NotificationCenter.default.post(name: .navigateToPurchaseTokens, object: nil)
        case transactionStatusNotificationId:
            if let transactionId = userInfo["transactionId"] as? String {
                NotificationCenter.default.post(
                    name: .navigateToTransactionDetails,
                    object: nil,
                    userInfo: ["transactionId": transactionId]
                )
            } else {
                NotificationCenter.default.post(name: .navigateToTransactionHistory, object: nil)
            }
        case syncCompleteNotificationId:
            NotificationCenter.default.post(name: .navigateToWallet, object: nil)
        default:
            logger.info("Unhandled notification identifier: \(identifier)")
        }
    }
}

// MARK: - Notification Names
extension Notification.Name {
    static let navigateToTokenManagement = Notification.Name("navigateToTokenManagement")
    static let navigateToPurchaseTokens = Notification.Name("navigateToPurchaseTokens")
    static let navigateToTransactionDetails = Notification.Name("navigateToTransactionDetails")
    static let navigateToTransactionHistory = Notification.Name("navigateToTransactionHistory")
    static let navigateToWallet = Notification.Name("navigateToWallet")
    static let tokenExpirationWarning = Notification.Name("tokenExpirationWarning")
    static let autoPurchaseCompleted = Notification.Name("autoPurchaseCompleted")
}