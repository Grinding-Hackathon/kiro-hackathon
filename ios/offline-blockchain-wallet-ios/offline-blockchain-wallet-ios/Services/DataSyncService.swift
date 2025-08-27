//
//  DataSyncService.swift
//  offline-blockchain-wallet-ios
//
//  Created by Kiro on 7/21/25.
//

import Foundation
import Network
import Combine

protocol DataSyncServiceProtocol {
    var isOnline: Bool { get }
    var syncStatus: AnyPublisher<SyncStatus, Never> { get }
    
    func startMonitoring()
    func stopMonitoring()
    func performFullSync() async throws
    func syncPendingTransactions() async throws
    func syncWalletBalance() async throws
    func handleOfflineToOnlineTransition() async throws
}

class DataSyncService: DataSyncServiceProtocol {
    private let storageService: StorageServiceProtocol
    private let networkService: NetworkServiceProtocol
    private let logger = Logger.shared
    
    private let monitor = NWPathMonitor()
    private let monitorQueue = DispatchQueue(label: "NetworkMonitor")
    
    private let syncStatusSubject = CurrentValueSubject<SyncStatus, Never>(.idle)
    
    @Published private(set) var isOnline: Bool = false
    
    var syncStatus: AnyPublisher<SyncStatus, Never> {
        syncStatusSubject.eraseToAnyPublisher()
    }
    
    private var lastKnownOnlineState: Bool = false
    private var syncTimer: Timer?
    
    init(storageService: StorageServiceProtocol, networkService: NetworkServiceProtocol) {
        self.storageService = storageService
        self.networkService = networkService
    }
    
    deinit {
        stopMonitoring()
    }
    
    // MARK: - Network Monitoring
    
    func startMonitoring() {
        monitor.pathUpdateHandler = { [weak self] path in
            DispatchQueue.main.async {
                let wasOnline = self?.isOnline ?? false
                self?.isOnline = path.status == .satisfied
                
                if !wasOnline && self?.isOnline == true {
                    // Transitioned from offline to online
                    Task {
                        await self?.handleOfflineToOnlineTransition()
                    }
                }
                
                self?.logger.info("Network status changed: \(self?.isOnline == true ? "Online" : "Offline")")
            }
        }
        
        monitor.start(queue: monitorQueue)
        
        // Start periodic sync timer for when online
        startPeriodicSync()
        
        logger.info("Data sync monitoring started")
    }
    
    func stopMonitoring() {
        monitor.cancel()
        syncTimer?.invalidate()
        syncTimer = nil
        logger.info("Data sync monitoring stopped")
    }
    
    private func startPeriodicSync() {
        syncTimer = Timer.scheduledTimer(withTimeInterval: 300, repeats: true) { [weak self] _ in
            guard self?.isOnline == true else { return }
            
            Task {
                do {
                    try await self?.syncPendingTransactions()
                    try await self?.syncWalletBalance()
                } catch {
                    self?.logger.error("Periodic sync failed: \(error)")
                }
            }
        }
    }
    
    // MARK: - Synchronization Operations
    
    func performFullSync() async throws {
        guard isOnline else {
            throw DataSyncError.offline
        }
        
        syncStatusSubject.send(.syncing)
        logger.info("Starting full data synchronization")
        
        do {
            // Sync in order of priority
            try await syncPendingTransactions()
            try await syncWalletBalance()
            try await updateLastSyncTimestamp()
            
            syncStatusSubject.send(.completed)
            logger.info("Full data synchronization completed successfully")
        } catch {
            syncStatusSubject.send(.failed(error))
            logger.error("Full data synchronization failed: \(error)")
            throw error
        }
    }
    
    func syncPendingTransactions() async throws {
        guard isOnline else {
            throw DataSyncError.offline
        }
        
        logger.info("Syncing pending transactions")
        
        let pendingTransactions = try await storageService.getPendingSyncTransactions()
        
        for transaction in pendingTransactions {
            do {
                switch transaction.type {
                case .tokenRedemption:
                    try await syncTokenRedemption(transaction)
                case .offlineTransfer:
                    try await syncOfflineTransfer(transaction)
                default:
                    continue // Skip other transaction types
                }
                
                try await storageService.markTransactionAsSynced(id: transaction.id)
                logger.info("Synced transaction: \(transaction.id)")
            } catch {
                logger.error("Failed to sync transaction \(transaction.id): \(error)")
                // Continue with other transactions instead of failing completely
            }
        }
    }
    
    func syncWalletBalance() async throws {
        guard isOnline else {
            throw DataSyncError.offline
        }
        
        logger.info("Syncing wallet balance")
        
        do {
            // Get wallet address from wallet state to check balance
            guard let walletState = try await storageService.loadWalletState() else {
                throw DataSyncError.walletStateNotFound
            }
            
            // Extract wallet address from public key or use a placeholder
            let walletAddress = "0x" + String(walletState.publicKey.suffix(40)) // Simplified address derivation
            
            let blockchainBalance = try await networkService.getBlockchainBalance(address: walletAddress)
            let offlineBalance = try await storageService.getTotalOfflineBalance()
            
            let updatedWalletState = WalletState(
                walletId: walletState.walletId,
                publicKey: walletState.publicKey,
                offlineBalance: offlineBalance,
                blockchainBalance: blockchainBalance,
                lastSyncTimestamp: walletState.lastSyncTimestamp,
                autoRechargeEnabled: walletState.autoRechargeEnabled,
                autoRechargeThreshold: walletState.autoRechargeThreshold,
                autoRechargeAmount: walletState.autoRechargeAmount
            )
            
            try await storageService.saveWalletState(updatedWalletState)
            logger.info("Wallet balance synced - Blockchain: \(blockchainBalance), Offline: \(offlineBalance)")
        } catch {
            logger.error("Failed to sync wallet balance: \(error)")
            throw error
        }
    }
    
    func handleOfflineToOnlineTransition() async {
        logger.info("Handling offline to online transition")
        
        do {
            // Clean up expired tokens first
            let expiredTokenIds = try await storageService.deleteExpiredTokens()
            if !expiredTokenIds.isEmpty {
                logger.info("Cleaned up \(expiredTokenIds.count) expired tokens")
            }
            
            // Perform full sync
            try await performFullSync()
            
            // Check if auto-recharge is needed
            try await checkAndPerformAutoRecharge()
            
        } catch {
            logger.error("Failed to handle offline to online transition: \(error)")
        }
    }
    
    // MARK: - Private Sync Methods
    
    private func syncTokenRedemption(_ transaction: Transaction) async throws {
        logger.info("Syncing token redemption: \(transaction.id)")
        
        // Submit transaction to backend for processing
        let response = try await networkService.submitTransaction(transaction: transaction)
        logger.info("Token redemption submitted: \(response.transactionId)")
        
        // Update local transaction status
        var updatedTransaction = transaction
        updatedTransaction.status = .pending
        try await storageService.updateTransaction(updatedTransaction)
    }
    
    private func syncOfflineTransfer(_ transaction: Transaction) async throws {
        logger.info("Syncing offline transfer: \(transaction.id)")
        
        // Submit transaction to backend for audit logging
        let response = try await networkService.submitTransaction(transaction: transaction)
        logger.info("Offline transfer synced: \(response.transactionId)")
        
        // Update local transaction status
        var updatedTransaction = transaction
        updatedTransaction.status = .completed
        try await storageService.updateTransaction(updatedTransaction)
    }
    
    private func updateLastSyncTimestamp() async throws {
        try await storageService.updateLastSyncTimestamp(Date())
    }
    
    private func checkAndPerformAutoRecharge() async throws {
        guard let walletState = try await storageService.loadWalletState(),
              walletState.autoRechargeEnabled else {
            return
        }
        
        let currentOfflineBalance = try await storageService.getTotalOfflineBalance()
        
        if currentOfflineBalance < walletState.autoRechargeThreshold {
            logger.info("Auto-recharge triggered - Current balance: \(currentOfflineBalance), Threshold: \(walletState.autoRechargeThreshold)")
            
            // Create token purchase request
            let purchaseRequest = TokenPurchaseRequest(
                amount: walletState.autoRechargeAmount,
                walletId: walletState.walletId,
                timestamp: Date()
            )
            
            // Purchase tokens from backend
            let response = try await networkService.purchaseOfflineTokens(request: purchaseRequest)
            logger.info("Auto-recharge completed: purchased \(response.tokens.count) tokens")
        }
    }
}

// MARK: - Supporting Types

enum SyncStatus {
    case idle
    case syncing
    case completed
    case failed(Error)
}

public enum DataSyncError: Error, LocalizedError {
    case offline
    case walletStateNotFound
    case syncFailed(String)
    case networkError(Error)
    
    public var errorDescription: String? {
        switch self {
        case .offline:
            return "Device is offline"
        case .walletStateNotFound:
            return "Wallet state not found"
        case .syncFailed(let message):
            return "Sync failed: \(message)"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        }
    }
}

