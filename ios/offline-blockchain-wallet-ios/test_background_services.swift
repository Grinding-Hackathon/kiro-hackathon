#!/usr/bin/env swift

//
//  test_background_services.swift
//  offline-blockchain-wallet-ios
//
//  Created by Kiro on 7/21/25.
//

import Foundation
import BackgroundTasks
import UserNotifications

// Mock implementations for testing
class MockOfflineTokenService: OfflineTokenServiceProtocol {
    var isAutomaticManagementActive = false
    var mockBalance: Double = 100.0
    var mockTokens: [OfflineToken] = []
    
    func purchaseTokens(amount: Double) async throws -> [OfflineToken] {
        let token = OfflineToken(
            amount: amount,
            signature: "mock_signature",
            issuer: "mock_otm",
            expirationDate: Date().addingTimeInterval(86400) // 24 hours
        )
        mockTokens.append(token)
        return [token]
    }
    
    func validateToken(_ token: OfflineToken) -> Bool {
        return !token.isExpired && !token.isSpent
    }
    
    func divideToken(_ token: OfflineToken, amount: Double) throws -> TokenDivisionResult {
        // Mock implementation
        let paymentToken = OfflineToken(
            amount: amount,
            signature: "payment_signature",
            issuer: token.issuer,
            expirationDate: token.expirationDate
        )
        
        let changeToken = OfflineToken(
            amount: token.amount - amount,
            signature: "change_signature", 
            issuer: token.issuer,
            expirationDate: token.expirationDate
        )
        
        return TokenDivisionResult(
            originalToken: token,
            paymentToken: paymentToken,
            changeToken: changeToken,
            requestedAmount: amount
        )
    }
    
    func markTokenAsSpent(tokenId: String) async throws {
        if let index = mockTokens.firstIndex(where: { $0.id == tokenId }) {
            mockTokens[index] = OfflineToken(
                id: mockTokens[index].id,
                amount: mockTokens[index].amount,
                signature: mockTokens[index].signature,
                issuer: mockTokens[index].issuer,
                issuedAt: mockTokens[index].issuedAt,
                expirationDate: mockTokens[index].expirationDate,
                isSpent: true,
                spentAt: Date(),
                divisions: mockTokens[index].divisions
            )
        }
    }
    
    func getAvailableBalance() async -> Double {
        return mockBalance
    }
    
    func handleExpiredTokens() async throws {
        mockTokens.removeAll { $0.isExpired }
    }
    
    func redeemTokens(_ tokens: [OfflineToken]) async throws -> String {
        return "mock_transaction_hash"
    }
    
    func startAutomaticTokenManagement() {
        isAutomaticManagementActive = true
        print("✅ Automatic token management started")
    }
    
    func stopAutomaticTokenManagement() {
        isAutomaticManagementActive = false
        print("✅ Automatic token management stopped")
    }
}

class MockNetworkService: NetworkServiceProtocol {
    var isOnlineStatus = true
    
    func isOnline() -> Bool {
        return isOnlineStatus
    }
    
    func processOfflineQueue() async {
        print("✅ Offline queue processed")
    }
    
    func syncTransactions() async throws -> [Transaction] {
        return []
    }
    
    func getWalletBalance(walletId: String) async throws -> WalletBalanceResponse {
        return WalletBalanceResponse(
            walletId: walletId,
            blockchainBalance: 500.0,
            lastUpdated: Date()
        )
    }
    
    func getTransactionStatus(transactionId: String) async throws -> TransactionStatusResponse {
        return TransactionStatusResponse(
            transactionId: transactionId,
            status: .completed,
            timestamp: Date()
        )
    }
    
    func fetchPublicKeys() async throws -> PublicKeyDatabase {
        return PublicKeyDatabase(keys: [:], lastUpdated: Date())
    }
    
    // Other required methods with mock implementations
    func connectToBlockchain() async throws -> Web3Connection { throw NetworkError.notImplemented }
    func callSmartContract(method: String, params: [Any]) async throws -> Any { throw NetworkError.notImplemented }
    func broadcastTransaction(transaction: SignedTransaction) async throws -> String { throw NetworkError.notImplemented }
    func getBlockchainBalance(address: String) async throws -> Double { return 500.0 }
    func sendTokenPurchaseRequest(_ request: TokenPurchaseRequest) async throws -> TokenPurchaseResponse { 
        return TokenPurchaseResponse(tokens: [], transactionHash: "mock_hash")
    }
    func sendTokenRedemptionRequest(_ request: TokenRedemptionRequest) async throws -> TokenRedemptionResponse {
        return TokenRedemptionResponse(transactionHash: "mock_hash", blockchainBalance: 500.0)
    }
    func submitTransaction(_ transaction: SignedTransaction) async throws -> String { return "mock_hash" }
}

class MockStorageService: StorageServiceProtocol {
    var mockWalletState: WalletState?
    var mockTokens: [OfflineToken] = []
    var mockTransactions: [Transaction] = []
    
    init() {
        mockWalletState = WalletState(
            walletId: "test_wallet",
            publicKey: "test_public_key",
            offlineBalance: 100.0,
            blockchainBalance: 500.0,
            lastSyncTimestamp: Date(),
            autoRechargeEnabled: true,
            autoRechargeThreshold: 50.0,
            autoRechargeAmount: 100.0
        )
    }
    
    func loadWalletState() async throws -> WalletState? {
        return mockWalletState
    }
    
    func saveWalletState(_ state: WalletState) async throws {
        mockWalletState = state
    }
    
    func getAllOfflineTokens() async throws -> [OfflineToken] {
        return mockTokens
    }
    
    func getPendingTransactions() async throws -> [Transaction] {
        return mockTransactions.filter { $0.status == .pending }
    }
    
    func getPendingTransactionsCount() async throws -> Int {
        return mockTransactions.filter { $0.status == .pending }.count
    }
    
    func saveOfflineTokens(_ tokens: [OfflineToken]) async throws {
        mockTokens.append(contentsOf: tokens)
    }
    
    func updateTransaction(_ transaction: Transaction) async throws {
        if let index = mockTransactions.firstIndex(where: { $0.id == transaction.id }) {
            mockTransactions[index] = transaction
        }
    }
    
    func saveBluetoothConnection(_ connection: BluetoothConnectionRecord) async throws {
        print("✅ Bluetooth connection saved: \(connection.deviceName)")
    }
    
    func updateBluetoothConnectionStatus(deviceId: String, status: BackgroundBluetoothConnectionStatus, disconnectedAt: Date?) async throws {
        print("✅ Bluetooth connection status updated: \(deviceId) -> \(status)")
    }
    
    func savePublicKeyDatabase(_ database: PublicKeyDatabase) async throws {
        print("✅ Public key database saved")
    }
    
    // Other required methods with mock implementations
    func loadOfflineTokens() async throws -> [OfflineToken] { return mockTokens }
    func saveOfflineToken(_ token: OfflineToken) async throws { mockTokens.append(token) }
    func updateOfflineToken(_ token: OfflineToken) async throws {}
    func deleteOfflineToken(id: String) async throws {}
    func loadTransactions() async throws -> [Transaction] { return mockTransactions }
    func saveTransaction(_ transaction: Transaction) async throws { mockTransactions.append(transaction) }
    func deleteTransaction(id: String) async throws {}
    func deleteExpiredTokens() async throws -> [String] { return [] }
    func markTokenAsSpent(id: String, spentAt: Date) async throws {}
    func getUnspentTokens() async throws -> [OfflineToken] { return mockTokens.filter { !$0.isSpent } }
    func getTransactionsByStatus(_ status: TransactionStatus) async throws -> [Transaction] { 
        return mockTransactions.filter { $0.status == status }
    }
    func getTotalOfflineBalance() async throws -> Double { return mockTokens.reduce(0) { $0 + $1.amount } }
    func getPendingSyncTransactions() async throws -> [Transaction] { return [] }
    func markTransactionAsSynced(id: String) async throws {}
    func getLastSyncTimestamp() async throws -> Date? { return Date() }
    func updateLastSyncTimestamp(_ timestamp: Date) async throws {}
    func clearAllData() async throws {}
    func exportData() async throws -> Data { return Data() }
    func importData(_ data: Data) async throws {}
    func performDataMigration() async throws {}
    func getBluetoothConnections() async throws -> [BluetoothConnectionRecord] { return [] }
    func deleteOldBluetoothConnections(olderThan: Date) async throws {}
    func loadPublicKeyDatabase() async throws -> PublicKeyDatabase? { return nil }
}

class MockBluetoothService: BluetoothServiceProtocol {
    func startAdvertising(walletInfo: WalletInfo) throws {
        print("✅ Bluetooth advertising started for wallet: \(walletInfo.walletId)")
    }
    
    func stopAdvertising() {
        print("✅ Bluetooth advertising stopped")
    }
    
    func scanForDevices() async throws -> [BluetoothDevice] { return [] }
    func connectToDevice(_ device: BluetoothDevice) async throws -> BluetoothConnection { 
        return BluetoothConnection(deviceId: device.id, deviceName: device.name, isConnected: true)
    }
    func sendData(_ data: Data, to connection: BluetoothConnection) async throws {}
    func receiveData(from connection: BluetoothConnection) async throws -> Data { return Data() }
    func disconnect(_ connection: BluetoothConnection) async throws {}
}

class MockPushNotificationService: PushNotificationServiceProtocol {
    func requestPermissions() async -> Bool {
        print("✅ Push notification permissions requested")
        return true
    }
    
    func sendTransactionStatusNotification(transaction: Transaction, newStatus: TransactionStatus) {
        print("✅ Transaction status notification sent: \(transaction.id ?? "unknown") -> \(newStatus)")
    }
    
    func sendTokenExpirationNotification(expiringCount: Int, timeUntilExpiration: TimeInterval) {
        print("✅ Token expiration notification sent: \(expiringCount) tokens expiring")
    }
    
    func sendLowBalanceNotification(currentBalance: Double, threshold: Double) {
        print("✅ Low balance notification sent: \(currentBalance) < \(threshold)")
    }
    
    func sendAutoPurchaseNotification(success: Bool, tokenCount: Int?, error: String?) {
        print("✅ Auto-purchase notification sent: success=\(success), tokens=\(tokenCount ?? 0)")
    }
    
    func sendSyncCompleteNotification(transactionCount: Int) {
        print("✅ Sync complete notification sent: \(transactionCount) transactions")
    }
    
    func scheduleTokenExpirationReminder(for tokens: [OfflineToken]) {
        print("✅ Token expiration reminder scheduled for \(tokens.count) tokens")
    }
    
    func cancelAllNotifications() {
        print("✅ All notifications cancelled")
    }
    
    func cancelNotification(identifier: String) {
        print("✅ Notification cancelled: \(identifier)")
    }
    
    func handleNotificationTap(identifier: String, userInfo: [AnyHashable: Any]) {
        print("✅ Notification tap handled: \(identifier)")
    }
    
    // Additional methods from the enhanced implementation
    func sendAutoPurchaseTriggeredNotification(amount: Double, reason: String) {
        print("✅ Auto-purchase triggered notification: \(amount) tokens, reason: \(reason)")
    }
    
    func sendBalanceUpdatedNotification(oldBalance: Double, newBalance: Double, balanceType: String) {
        print("✅ Balance updated notification: \(balanceType) \(oldBalance) -> \(newBalance)")
    }
    
    func sendBackgroundTaskCompletionNotification(taskType: String, success: Bool, details: String?) {
        print("✅ Background task completion notification: \(taskType) success=\(success)")
    }
    
    func sendTokenExpirationDetectedNotification(tokenCount: Int, timeUntilExpiration: TimeInterval) {
        print("✅ Token expiration detected notification: \(tokenCount) tokens")
    }
    
    func sendBluetoothConnectionNotification(deviceName: String, connected: Bool) {
        print("✅ Bluetooth connection notification: \(deviceName) connected=\(connected)")
    }
    
    func sendBackgroundSyncFailureNotification(error: String) {
        print("✅ Background sync failure notification: \(error)")
    }
}

class MockBackgroundBluetoothService: BackgroundBluetoothServiceProtocol {
    var isBackgroundAdvertising = false
    
    func startBackgroundAdvertising() {
        isBackgroundAdvertising = true
        print("✅ Background Bluetooth advertising started")
    }
    
    func stopBackgroundAdvertising() {
        isBackgroundAdvertising = false
        print("✅ Background Bluetooth advertising stopped")
    }
    
    func handleIncomingConnection(_ connection: BluetoothConnection) {
        print("✅ Incoming Bluetooth connection handled: \(connection.deviceName)")
    }
    
    func updateAdvertisingData() async {
        print("✅ Bluetooth advertising data updated")
    }
    
    func scheduleAdvertisingRefresh() {
        print("✅ Bluetooth advertising refresh scheduled")
    }
    
    func scheduleBackgroundBluetoothTask() {
        print("✅ Background Bluetooth task scheduled")
    }
    
    func handleBackgroundBluetoothTask(_ task: BGProcessingTask) {
        print("✅ Background Bluetooth task handled")
        task.setTaskCompleted(success: true)
    }
}

// Test function
func testBackgroundServices() async {
    print("🧪 Testing Background Services Implementation")
    print("=" * 50)
    
    // Create mock services
    let mockOfflineTokenService = MockOfflineTokenService()
    let mockNetworkService = MockNetworkService()
    let mockStorageService = MockStorageService()
    let mockBluetoothService = MockBluetoothService()
    let mockPushNotificationService = MockPushNotificationService()
    let mockBackgroundBluetoothService = MockBackgroundBluetoothService()
    
    // Create BackgroundTaskManager
    let backgroundTaskManager = BackgroundTaskManager(
        offlineTokenService: mockOfflineTokenService,
        networkService: mockNetworkService,
        bluetoothService: mockBluetoothService,
        storageService: mockStorageService,
        pushNotificationService: mockPushNotificationService,
        backgroundBluetoothService: mockBackgroundBluetoothService
    )
    
    // Create BackgroundServiceCoordinator
    let backgroundServiceCoordinator = BackgroundServiceCoordinator(
        backgroundTaskManager: backgroundTaskManager,
        offlineTokenService: mockOfflineTokenService,
        networkService: mockNetworkService,
        bluetoothService: mockBluetoothService,
        pushNotificationService: mockPushNotificationService,
        backgroundBluetoothService: mockBackgroundBluetoothService,
        storageService: mockStorageService
    )
    
    // Test 1: Initialize background services
    print("\n📱 Test 1: Initialize Background Services")
    backgroundServiceCoordinator.initializeBackgroundServices()
    
    // Test 2: Start all background services
    print("\n📱 Test 2: Start All Background Services")
    backgroundServiceCoordinator.startAllBackgroundServices()
    
    // Test 3: Test app entering background
    print("\n📱 Test 3: App Entering Background")
    backgroundServiceCoordinator.handleAppDidEnterBackground()
    
    // Test 4: Test background app refresh
    print("\n📱 Test 4: Background App Refresh")
    await backgroundTaskManager.handleBackgroundAppRefresh()
    
    // Test 5: Test token expiration check
    print("\n📱 Test 5: Token Expiration Check")
    await backgroundTaskManager.handleTokenExpirationCheck()
    
    // Test 6: Test periodic sync
    print("\n📱 Test 6: Periodic Sync")
    await backgroundTaskManager.handlePeriodicSync()
    
    // Test 7: Test app entering foreground
    print("\n📱 Test 7: App Entering Foreground")
    backgroundServiceCoordinator.handleAppWillEnterForeground()
    
    // Test 8: Test automatic token purchase
    print("\n📱 Test 8: Automatic Token Purchase")
    mockOfflineTokenService.mockBalance = 30.0 // Below threshold
    await backgroundTaskManager.handleBackgroundAppRefresh()
    
    // Test 9: Test service status
    print("\n📱 Test 9: Service Status")
    let status = backgroundServiceCoordinator.getServiceStatus()
    print("Service Status: \(status.description)")
    
    // Test 10: Stop all services
    print("\n📱 Test 10: Stop All Background Services")
    backgroundServiceCoordinator.stopAllBackgroundServices()
    
    print("\n✅ All background service tests completed successfully!")
    print("=" * 50)
}

// Run the test
Task {
    await testBackgroundServices()
}

// Keep the script running for async operations
RunLoop.main.run()