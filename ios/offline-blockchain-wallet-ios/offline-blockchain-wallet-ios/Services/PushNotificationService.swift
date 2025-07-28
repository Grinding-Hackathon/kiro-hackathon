//
//  PushNotificationService.swift
//  offline-blockchain-wallet-ios
//
//  Created by Kiro on 7/21/25.
//

import Foundation
import UserNotifications
#if canImport(UIKit)
import UIKit
#endif

protocol PushNotificationServiceProtocol {
    func requestPermissions() async -> Bool
    func sendTransactionStatusNotification(transaction: Transaction, newStatus: TransactionStatus)
    func sendTokenExpirationNotification(expiringCount: Int, timeUntilExpiration: TimeInterval)
    func sendLowBalanceNotification(currentBalance: Double, threshold: Double)
    func sendAutoPurchaseNotification(success: Bool, tokenCount: Int?, error: String?)
    func sendSyncCompleteNotification(transactionCount: Int)
    func scheduleTokenExpirationReminder(for tokens: [OfflineToken])
    func cancelAllNotifications()
    func cancelNotification(identifier: String)
    func handleNotificationTap(identifier: String, userInfo: [AnyHashable: Any])
    func sendComprehensiveSyncNotification(syncResults: [String: Any])
    func sendBluetoothConnectionNotification(deviceName: String, connected: Bool)
    func sendBackgroundSyncFailureNotification(error: String)
    func sendBackgroundTaskCompletionNotification(taskType: String, success: Bool, details: String?)
    func sendTokenExpirationDetectedNotification(tokenCount: Int, timeUntilExpiration: TimeInterval)
    func sendAutoPurchaseTriggeredNotification(amount: Double, reason: String)
    func sendBalanceUpdatedNotification(oldBalance: Double, newBalance: Double, balanceType: String)
}

class PushNotificationService: NSObject, PushNotificationServiceProtocol {
    private let logger = Logger.shared
    private let notificationCenter = UNUserNotificationCenter.current()
    
    // Notification identifiers
    private struct NotificationIdentifiers {
        static let transactionStatus = "transaction_status"
        static let tokenExpiration = "token_expiration"
        static let lowBalance = "low_balance"
        static let autoPurchaseSuccess = "auto_purchase_success"
        static let autoPurchaseFailure = "auto_purchase_failure"
        static let syncComplete = "sync_complete"
        static let tokenExpirationReminder = "token_expiration_reminder"
    }
    
    override init() {
        super.init()
        notificationCenter.delegate = self
    }
    
    // MARK: - Permission Management
    
    func requestPermissions() async -> Bool {
        do {
            let granted = try await notificationCenter.requestAuthorization(
                options: [.alert, .badge, .sound, .provisional]
            )
            
            if granted {
                logger.info("Push notification permissions granted")
                await registerForRemoteNotifications()
            } else {
                logger.warning("Push notification permissions denied")
            }
            
            return granted
        } catch {
            logger.error("Failed to request notification permissions: \(error)")
            return false
        }
    }
    
    @MainActor
    private func registerForRemoteNotifications() {
        #if canImport(UIKit)
        UIApplication.shared.registerForRemoteNotifications()
        #endif
    }
    
    // MARK: - Transaction Status Notifications
    
    func sendTransactionStatusNotification(transaction: Transaction, newStatus: TransactionStatus) {
        let title: String
        let body: String
        
        switch newStatus {
        case .completed:
            title = "Transaction Completed"
            body = "Your transaction of \(transaction.amount) tokens has been completed successfully"
        case .failed:
            title = "Transaction Failed"
            body = "Your transaction of \(transaction.amount) tokens has failed"
        case .pending:
            title = "Transaction Pending"
            body = "Your transaction of \(transaction.amount) tokens is being processed"
        case .cancelled:
            title = "Transaction Cancelled"
            body = "Your transaction of \(transaction.amount) tokens has been cancelled"
        }
        
        let content = createNotificationContent(
            title: title,
            body: body,
            identifier: NotificationIdentifiers.transactionStatus,
            userInfo: [
                "transaction_id": transaction.id ?? "",
                "transaction_type": transaction.type.rawValue,
                "amount": transaction.amount,
                "status": newStatus.rawValue
            ]
        )
        
        sendNotification(content: content, identifier: "\(NotificationIdentifiers.transactionStatus)_\(transaction.id ?? UUID().uuidString)")
    }
    
    // MARK: - Token Management Notifications
    
    func sendTokenExpirationNotification(expiringCount: Int, timeUntilExpiration: TimeInterval) {
        let hours = Int(timeUntilExpiration / 3600)
        let timeString = hours > 24 ? "\(hours / 24) day(s)" : "\(hours) hour(s)"
        
        let content = createNotificationContent(
            title: "Tokens Expiring Soon",
            body: "\(expiringCount) offline tokens will expire in \(timeString)",
            identifier: NotificationIdentifiers.tokenExpiration,
            userInfo: [
                "expiring_count": expiringCount,
                "time_until_expiration": timeUntilExpiration
            ]
        )
        
        sendNotification(content: content, identifier: NotificationIdentifiers.tokenExpiration)
    }
    
    func sendLowBalanceNotification(currentBalance: Double, threshold: Double) {
        let content = createNotificationContent(
            title: "Low Token Balance",
            body: "Your offline token balance (\(String(format: "%.2f", currentBalance))) is below the threshold (\(String(format: "%.2f", threshold)))",
            identifier: NotificationIdentifiers.lowBalance,
            userInfo: [
                "current_balance": currentBalance,
                "threshold": threshold
            ]
        )
        
        sendNotification(content: content, identifier: NotificationIdentifiers.lowBalance)
    }
    
    func sendAutoPurchaseNotification(success: Bool, tokenCount: Int?, error: String?) {
        let identifier: String
        let title: String
        let body: String
        var userInfo: [String: Any] = ["success": success]
        
        if success, let count = tokenCount {
            identifier = NotificationIdentifiers.autoPurchaseSuccess
            title = "Tokens Purchased"
            body = "Successfully purchased \(count) offline tokens automatically"
            userInfo["token_count"] = count
        } else {
            identifier = NotificationIdentifiers.autoPurchaseFailure
            title = "Auto-Purchase Failed"
            body = error ?? "Failed to automatically purchase tokens. Please check your balance and try again."
            userInfo["error"] = error ?? "Unknown error"
        }
        
        let content = createNotificationContent(
            title: title,
            body: body,
            identifier: identifier,
            userInfo: userInfo
        )
        
        sendNotification(content: content, identifier: identifier)
    }
    
    func sendSyncCompleteNotification(transactionCount: Int) {
        let bodyText: String
        if transactionCount == 0 {
            bodyText = "Wallet synchronized with blockchain. No new transactions."
        } else if transactionCount == 1 {
            bodyText = "Wallet synchronized with blockchain. 1 transaction updated."
        } else {
            bodyText = "Wallet synchronized with blockchain. \(transactionCount) transactions updated."
        }
        
        let content = createNotificationContent(
            title: "Sync Complete",
            body: bodyText,
            identifier: NotificationIdentifiers.syncComplete,
            userInfo: [
                "transaction_count": transactionCount,
                "sync_timestamp": Date().timeIntervalSince1970
            ]
        )
        
        sendNotification(content: content, identifier: NotificationIdentifiers.syncComplete)
    }
    
    func sendComprehensiveSyncNotification(syncResults: [String: Any]) {
        let transactionCount = syncResults["transaction_count"] as? Int ?? 0
        let balanceUpdated = syncResults["balance_updated"] as? Bool ?? false
        let expiredTokensHandled = syncResults["expired_tokens_handled"] as? Bool ?? false
        
        var bodyComponents: [String] = []
        
        if transactionCount > 0 {
            bodyComponents.append("\(transactionCount) transactions updated")
        }
        
        if balanceUpdated {
            bodyComponents.append("balance updated")
        }
        
        if expiredTokensHandled {
            bodyComponents.append("expired tokens processed")
        }
        
        let body = bodyComponents.isEmpty ? "Wallet synchronized successfully" : bodyComponents.joined(separator: ", ")
        
        let content = createNotificationContent(
            title: "Comprehensive Sync Complete",
            body: body.capitalized,
            identifier: "comprehensive_sync_complete",
            userInfo: syncResults
        )
        
        sendNotification(content: content, identifier: "comprehensive_sync_complete")
    }
    
    func sendBluetoothConnectionNotification(deviceName: String, connected: Bool) {
        let title = connected ? "Device Connected" : "Device Disconnected"
        let body = connected ? "Connected to \(deviceName) for offline transactions" : "Disconnected from \(deviceName)"
        
        let content = createNotificationContent(
            title: title,
            body: body,
            identifier: "bluetooth_connection",
            userInfo: [
                "device_name": deviceName,
                "connected": connected
            ]
        )
        
        sendNotification(content: content, identifier: "bluetooth_connection_\(deviceName)")
    }
    
    func sendBackgroundSyncFailureNotification(error: String) {
        let content = createNotificationContent(
            title: "Background Sync Failed",
            body: "Unable to sync with blockchain: \(error)",
            identifier: "background_sync_failure",
            userInfo: [
                "error": error,
                "failure_timestamp": Date().timeIntervalSince1970
            ]
        )
        
        sendNotification(content: content, identifier: "background_sync_failure")
    }
    
    func sendBackgroundTaskCompletionNotification(taskType: String, success: Bool, details: String? = nil) {
        let title = success ? "Background Task Completed" : "Background Task Failed"
        let body = details ?? (success ? "\(taskType) completed successfully" : "\(taskType) failed to complete")
        
        let content = createNotificationContent(
            title: title,
            body: body,
            identifier: "background_task_\(taskType.lowercased())",
            userInfo: [
                "task_type": taskType,
                "success": success,
                "completion_timestamp": Date().timeIntervalSince1970
            ]
        )
        
        sendNotification(content: content, identifier: "background_task_\(taskType.lowercased())_\(UUID().uuidString)")
        
        // Post internal notification for app components
        let notificationName: Notification.Name = success ? .backgroundTaskCompleted : .backgroundTaskFailed
        NotificationCenter.default.post(
            name: notificationName,
            object: nil,
            userInfo: [
                "task_type": taskType,
                "success": success,
                "details": details ?? ""
            ]
        )
    }
    
    func sendTokenExpirationDetectedNotification(tokenCount: Int, timeUntilExpiration: TimeInterval) {
        // Send push notification
        sendTokenExpirationNotification(expiringCount: tokenCount, timeUntilExpiration: timeUntilExpiration)
        
        // Post internal notification for immediate app response
        NotificationCenter.default.post(
            name: .tokenExpirationDetected,
            object: nil,
            userInfo: [
                "token_count": tokenCount,
                "time_until_expiration": timeUntilExpiration
            ]
        )
    }
    
    func sendAutoPurchaseTriggeredNotification(amount: Double, reason: String) {
        let content = createNotificationContent(
            title: "Auto-Purchase Initiated",
            body: "Purchasing \(String(format: "%.2f", amount)) tokens: \(reason)",
            identifier: "auto_purchase_initiated",
            userInfo: [
                "amount": amount,
                "reason": reason,
                "timestamp": Date().timeIntervalSince1970
            ]
        )
        
        sendNotification(content: content, identifier: "auto_purchase_initiated")
        
        // Post internal notification
        NotificationCenter.default.post(
            name: .autoPurchaseTriggered,
            object: nil,
            userInfo: [
                "amount": amount,
                "reason": reason
            ]
        )
    }
    
    func sendBalanceUpdatedNotification(oldBalance: Double, newBalance: Double, balanceType: String) {
        let change = newBalance - oldBalance
        let changeType = change > 0 ? "increased" : "decreased"
        let formattedChange = String(format: "%.4f", abs(change))
        
        let content = createNotificationContent(
            title: "\(balanceType.capitalized) Balance Updated",
            body: "Your \(balanceType) balance has \(changeType) by \(formattedChange) tokens",
            identifier: "balance_updated_\(balanceType)",
            userInfo: [
                "balance_type": balanceType,
                "old_balance": oldBalance,
                "new_balance": newBalance,
                "change": change
            ]
        )
        
        sendNotification(content: content, identifier: "balance_updated_\(balanceType)")
        
        // Post internal notification
        NotificationCenter.default.post(
            name: .balanceUpdated,
            object: nil,
            userInfo: [
                "balance_type": balanceType,
                "old_balance": oldBalance,
                "new_balance": newBalance,
                "change": change
            ]
        )
    }
    
    // MARK: - Scheduled Notifications
    
    func scheduleTokenExpirationReminder(for tokens: [OfflineToken]) {
        // Cancel existing reminders
        cancelNotification(identifier: NotificationIdentifiers.tokenExpirationReminder)
        
        // Find the earliest expiration date
        guard let earliestExpiration = tokens.map({ $0.expirationDate }).min() else {
            return
        }
        
        // Schedule reminder 24 hours before expiration
        let reminderDate = earliestExpiration.addingTimeInterval(-24 * 60 * 60)
        
        // Only schedule if reminder date is in the future
        guard reminderDate > Date() else {
            return
        }
        
        let content = createNotificationContent(
            title: "Token Expiration Reminder",
            body: "\(tokens.count) offline tokens will expire tomorrow. Consider using them or enabling auto-purchase.",
            identifier: NotificationIdentifiers.tokenExpirationReminder,
            userInfo: [
                "token_count": tokens.count,
                "expiration_date": earliestExpiration.timeIntervalSince1970
            ]
        )
        
        let trigger = UNTimeIntervalNotificationTrigger(
            timeInterval: reminderDate.timeIntervalSinceNow,
            repeats: false
        )
        
        let request = UNNotificationRequest(
            identifier: NotificationIdentifiers.tokenExpirationReminder,
            content: content,
            trigger: trigger
        )
        
        notificationCenter.add(request) { [weak self] error in
            if let error = error {
                self?.logger.error("Failed to schedule token expiration reminder: \(error)")
            } else {
                self?.logger.info("Token expiration reminder scheduled for \(reminderDate)")
            }
        }
    }
    
    // MARK: - Notification Management
    
    func cancelAllNotifications() {
        notificationCenter.removeAllPendingNotificationRequests()
        notificationCenter.removeAllDeliveredNotifications()
        logger.info("All notifications cancelled")
    }
    
    func cancelNotification(identifier: String) {
        notificationCenter.removePendingNotificationRequests(withIdentifiers: [identifier])
        notificationCenter.removeDeliveredNotifications(withIdentifiers: [identifier])
        logger.info("Cancelled notification: \(identifier)")
    }
    
    // MARK: - Notification Handling
    
    func handleNotificationTap(identifier: String, userInfo: [AnyHashable: Any]) {
        logger.info("Handling notification tap: \(identifier)")
        
        switch identifier {
        case NotificationIdentifiers.transactionStatus:
            handleTransactionStatusTap(userInfo: userInfo)
        case NotificationIdentifiers.tokenExpiration, NotificationIdentifiers.tokenExpirationReminder:
            handleTokenExpirationTap(userInfo: userInfo)
        case NotificationIdentifiers.lowBalance:
            handleLowBalanceTap(userInfo: userInfo)
        case NotificationIdentifiers.autoPurchaseSuccess, NotificationIdentifiers.autoPurchaseFailure:
            handleAutoPurchaseTap(userInfo: userInfo)
        case NotificationIdentifiers.syncComplete:
            handleSyncCompleteTap(userInfo: userInfo)
        default:
            logger.warning("Unknown notification identifier: \(identifier)")
        }
    }
    
    // MARK: - Private Helper Methods
    
    private func createNotificationContent(
        title: String,
        body: String,
        identifier: String,
        userInfo: [String: Any] = [:]
    ) -> UNMutableNotificationContent {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        #if canImport(UIKit)
        content.badge = NSNumber(value: UIApplication.shared.applicationIconBadgeNumber + 1)
        #else
        content.badge = NSNumber(value: 1)
        #endif
        
        var fullUserInfo = userInfo
        fullUserInfo["notification_id"] = identifier
        fullUserInfo["timestamp"] = Date().timeIntervalSince1970
        content.userInfo = fullUserInfo
        
        return content
    }
    
    private func sendNotification(content: UNNotificationContent, identifier: String) {
        let request = UNNotificationRequest(
            identifier: identifier,
            content: content,
            trigger: nil // Immediate delivery
        )
        
        notificationCenter.add(request) { [weak self] error in
            if let error = error {
                self?.logger.error("Failed to send notification '\(identifier)': \(error)")
            } else {
                self?.logger.info("Notification sent: \(identifier)")
            }
        }
    }
    
    // MARK: - Notification Tap Handlers
    
    private func handleTransactionStatusTap(userInfo: [AnyHashable: Any]) {
        if let transactionId = userInfo["transaction_id"] as? String {
            NotificationCenter.default.post(
                name: .navigateToTransactionDetails,
                object: nil,
                userInfo: ["transaction_id": transactionId]
            )
        } else {
            NotificationCenter.default.post(name: .navigateToTransactionHistory, object: nil)
        }
    }
    
    private func handleTokenExpirationTap(userInfo: [AnyHashable: Any]) {
        NotificationCenter.default.post(name: .navigateToTokenManagement, object: nil)
    }
    
    private func handleLowBalanceTap(userInfo: [AnyHashable: Any]) {
        NotificationCenter.default.post(name: .navigateToPurchaseTokens, object: nil)
    }
    
    private func handleAutoPurchaseTap(userInfo: [AnyHashable: Any]) {
        let success = userInfo["success"] as? Bool ?? false
        if success {
            NotificationCenter.default.post(name: .navigateToWallet, object: nil)
        } else {
            NotificationCenter.default.post(name: .navigateToPurchaseTokens, object: nil)
        }
    }
    
    private func handleSyncCompleteTap(userInfo: [AnyHashable: Any]) {
        NotificationCenter.default.post(name: .navigateToWallet, object: nil)
    }
}

// MARK: - UNUserNotificationCenterDelegate

extension PushNotificationService: UNUserNotificationCenterDelegate {
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        // Show notification even when app is in foreground
        completionHandler([.banner, .badge, .sound])
    }
    
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let identifier = response.notification.request.identifier
        let userInfo = response.notification.request.content.userInfo
        
        handleNotificationTap(identifier: identifier, userInfo: userInfo)
        completionHandler()
    }
    
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        openSettingsFor notification: UNNotification?
    ) {
        // Handle when user opens notification settings
        logger.info("User opened notification settings")
        NotificationCenter.default.post(name: .navigateToSettings, object: nil)
    }
}

// MARK: - Additional Notification Names

extension Notification.Name {
    static let navigateToSettings = Notification.Name("navigateToSettings")
    
    // Background task notifications
    static let backgroundTaskCompleted = Notification.Name("backgroundTaskCompleted")
    static let backgroundTaskFailed = Notification.Name("backgroundTaskFailed")
    static let tokenExpirationDetected = Notification.Name("tokenExpirationDetected")
    static let autoPurchaseTriggered = Notification.Name("autoPurchaseTriggered")
    static let balanceUpdated = Notification.Name("balanceUpdated")
}

// MARK: - Remote Notification Handling

extension PushNotificationService {
    func handleRemoteNotification(_ userInfo: [AnyHashable: Any]) {
        logger.info("Received remote notification: \(userInfo)")
        
        // Handle server-sent push notifications
        if let notificationType = userInfo["type"] as? String {
            switch notificationType {
            case "transaction_update":
                handleRemoteTransactionUpdate(userInfo)
            case "token_expiration_warning":
                handleRemoteTokenExpirationWarning(userInfo)
            case "system_maintenance":
                handleSystemMaintenanceNotification(userInfo)
            default:
                logger.warning("Unknown remote notification type: \(notificationType)")
            }
        }
    }
    
    private func handleRemoteTransactionUpdate(_ userInfo: [AnyHashable: Any]) {
        guard let transactionId = userInfo["transaction_id"] as? String,
              let statusString = userInfo["status"] as? String,
              let status = TransactionStatus(rawValue: statusString) else {
            logger.error("Invalid transaction update notification")
            return
        }
        
        // Create a mock transaction for notification purposes
        let transaction = Transaction(
            id: transactionId,
            type: .offlineTransfer,
            senderId: "",
            receiverId: "",
            amount: userInfo["amount"] as? Double ?? 0.0,
            status: status,
            tokenIds: []
        )
        
        sendTransactionStatusNotification(transaction: transaction, newStatus: status)
    }
    
    private func handleRemoteTokenExpirationWarning(_ userInfo: [AnyHashable: Any]) {
        let expiringCount = userInfo["expiring_count"] as? Int ?? 0
        let timeUntilExpiration = userInfo["time_until_expiration"] as? TimeInterval ?? 0
        
        sendTokenExpirationNotification(expiringCount: expiringCount, timeUntilExpiration: timeUntilExpiration)
    }
    
    private func handleSystemMaintenanceNotification(_ userInfo: [AnyHashable: Any]) {
        let title = userInfo["title"] as? String ?? "System Maintenance"
        let message = userInfo["message"] as? String ?? "The system will undergo maintenance"
        
        let content = createNotificationContent(
            title: title,
            body: message,
            identifier: "system_maintenance",
            userInfo: userInfo as? [String: Any] ?? [:]
        )
        
        sendNotification(content: content, identifier: "system_maintenance")
    }
}
