//
//  StorageServiceTests.swift
//  OfflineBlockchainWalletTests
//
//  Created by Kiro on 7/21/25.
//

import XCTest
import CoreData
@testable import offline_blockchain_wallet_ios

final class StorageServiceTests: XCTestCase {
    var storageService: StorageService!
    var testContainer: NSPersistentContainer!
    
    override func setUpWithError() throws {
        try super.setUpWithError()
        
        // Create in-memory Core Data stack for testing
        testContainer = NSPersistentContainer(name: "WalletDataModel")
        let description = NSPersistentStoreDescription()
        description.type = NSInMemoryStoreType
        testContainer.persistentStoreDescriptions = [description]
        
        testContainer.loadPersistentStores { _, error in
            if let error = error {
                XCTFail("Failed to load test store: \(error)")
            }
        }
        
        storageService = StorageService()
    }
    
    override func tearDownWithError() throws {
        storageService = nil
        testContainer = nil
        try super.tearDownWithError()
    }
    
    // MARK: - Offline Token Tests
    
    func testSaveAndLoadOfflineTokens() async throws {
        // Given
        let token1 = createTestOfflineToken(amount: 100.0)
        let token2 = createTestOfflineToken(amount: 50.0)
        let tokens = [token1, token2]
        
        // When
        try await storageService.saveOfflineTokens(tokens)
        let loadedTokens = try await storageService.loadOfflineTokens()
        
        // Then
        XCTAssertEqual(loadedTokens.count, 2)
        XCTAssertTrue(loadedTokens.contains { $0.id == token1.id })
        XCTAssertTrue(loadedTokens.contains { $0.id == token2.id })
    }
    
    func testUpdateOfflineToken() async throws {
        // Given
        var token = createTestOfflineToken(amount: 100.0)
        try await storageService.saveOfflineToken(token)
        
        // When
        token.isSpent = true
        token.spentAt = Date()
        try await storageService.updateOfflineToken(token)
        
        // Then
        let loadedTokens = try await storageService.loadOfflineTokens()
        let updatedToken = loadedTokens.first { $0.id == token.id }
        XCTAssertNotNil(updatedToken)
        XCTAssertTrue(updatedToken!.isSpent)
        XCTAssertNotNil(updatedToken!.spentAt)
    }
    
    func testDeleteOfflineToken() async throws {
        // Given
        let token = createTestOfflineToken(amount: 100.0)
        try await storageService.saveOfflineToken(token)
        
        // When
        try await storageService.deleteOfflineToken(id: token.id)
        
        // Then
        let loadedTokens = try await storageService.loadOfflineTokens()
        XCTAssertFalse(loadedTokens.contains { $0.id == token.id })
    }
    
    func testGetUnspentTokens() async throws {
        // Given
        let spentToken = createTestOfflineToken(amount: 100.0, isSpent: true)
        let unspentToken = createTestOfflineToken(amount: 50.0, isSpent: false)
        let expiredToken = createTestOfflineToken(amount: 25.0, expirationDate: Date().addingTimeInterval(-3600))
        
        try await storageService.saveOfflineTokens([spentToken, unspentToken, expiredToken])
        
        // When
        let unspentTokens = try await storageService.getUnspentTokens()
        
        // Then
        XCTAssertEqual(unspentTokens.count, 1)
        XCTAssertEqual(unspentTokens.first?.id, unspentToken.id)
    }
    
    func testDeleteExpiredTokens() async throws {
        // Given
        let validToken = createTestOfflineToken(amount: 100.0, expirationDate: Date().addingTimeInterval(3600))
        let expiredToken1 = createTestOfflineToken(amount: 50.0, expirationDate: Date().addingTimeInterval(-3600))
        let expiredToken2 = createTestOfflineToken(amount: 25.0, expirationDate: Date().addingTimeInterval(-7200))
        
        try await storageService.saveOfflineTokens([validToken, expiredToken1, expiredToken2])
        
        // When
        let expiredIds = try await storageService.deleteExpiredTokens()
        
        // Then
        XCTAssertEqual(expiredIds.count, 2)
        XCTAssertTrue(expiredIds.contains(expiredToken1.id))
        XCTAssertTrue(expiredIds.contains(expiredToken2.id))
        
        let remainingTokens = try await storageService.loadOfflineTokens()
        XCTAssertEqual(remainingTokens.count, 1)
        XCTAssertEqual(remainingTokens.first?.id, validToken.id)
    }
    
    func testGetTotalOfflineBalance() async throws {
        // Given
        let token1 = createTestOfflineToken(amount: 100.0, isSpent: false)
        let token2 = createTestOfflineToken(amount: 50.0, isSpent: false)
        let spentToken = createTestOfflineToken(amount: 25.0, isSpent: true)
        
        try await storageService.saveOfflineTokens([token1, token2, spentToken])
        
        // When
        let totalBalance = try await storageService.getTotalOfflineBalance()
        
        // Then
        XCTAssertEqual(totalBalance, 150.0)
    }
    
    // MARK: - Transaction Tests
    
    func testSaveAndLoadTransactions() async throws {
        // Given
        let transaction1 = createTestTransaction(amount: 100.0, type: .offlineTransfer)
        let transaction2 = createTestTransaction(amount: 50.0, type: .tokenPurchase)
        
        // When
        try await storageService.saveTransaction(transaction1)
        try await storageService.saveTransaction(transaction2)
        let loadedTransactions = try await storageService.loadTransactions()
        
        // Then
        XCTAssertEqual(loadedTransactions.count, 2)
        XCTAssertTrue(loadedTransactions.contains { $0.id == transaction1.id })
        XCTAssertTrue(loadedTransactions.contains { $0.id == transaction2.id })
    }
    
    func testUpdateTransaction() async throws {
        // Given
        var transaction = createTestTransaction(amount: 100.0, type: .offlineTransfer)
        try await storageService.saveTransaction(transaction)
        
        // When
        transaction.status = .completed
        try await storageService.updateTransaction(transaction)
        
        // Then
        let loadedTransactions = try await storageService.loadTransactions()
        let updatedTransaction = loadedTransactions.first { $0.id == transaction.id }
        XCTAssertNotNil(updatedTransaction)
        XCTAssertEqual(updatedTransaction!.status, .completed)
    }
    
    func testGetTransactionsByStatus() async throws {
        // Given
        let pendingTransaction = createTestTransaction(amount: 100.0, status: .pending)
        let completedTransaction = createTestTransaction(amount: 50.0, status: .completed)
        let failedTransaction = createTestTransaction(amount: 25.0, status: .failed)
        
        try await storageService.saveTransaction(pendingTransaction)
        try await storageService.saveTransaction(completedTransaction)
        try await storageService.saveTransaction(failedTransaction)
        
        // When
        let pendingTransactions = try await storageService.getTransactionsByStatus(.pending)
        let completedTransactions = try await storageService.getTransactionsByStatus(.completed)
        
        // Then
        XCTAssertEqual(pendingTransactions.count, 1)
        XCTAssertEqual(pendingTransactions.first?.id, pendingTransaction.id)
        
        XCTAssertEqual(completedTransactions.count, 1)
        XCTAssertEqual(completedTransactions.first?.id, completedTransaction.id)
    }
    
    func testGetPendingSyncTransactions() async throws {
        // Given
        let redemptionTransaction = createTestTransaction(amount: 100.0, type: .tokenRedemption, status: .pending)
        let offlineTransferTransaction = createTestTransaction(amount: 50.0, type: .offlineTransfer, status: .completed)
        let regularTransaction = createTestTransaction(amount: 25.0, type: .onlineTransfer, status: .pending)
        
        try await storageService.saveTransaction(redemptionTransaction)
        try await storageService.saveTransaction(offlineTransferTransaction)
        try await storageService.saveTransaction(regularTransaction)
        
        // When
        let pendingSyncTransactions = try await storageService.getPendingSyncTransactions()
        
        // Then
        XCTAssertEqual(pendingSyncTransactions.count, 2)
        XCTAssertTrue(pendingSyncTransactions.contains { $0.id == redemptionTransaction.id })
        XCTAssertTrue(pendingSyncTransactions.contains { $0.id == offlineTransferTransaction.id })
    }
    
    // MARK: - Wallet State Tests
    
    func testSaveAndLoadWalletState() async throws {
        // Given
        let walletState = createTestWalletState()
        
        // When
        try await storageService.saveWalletState(walletState)
        let loadedWalletState = try await storageService.loadWalletState()
        
        // Then
        XCTAssertNotNil(loadedWalletState)
        XCTAssertEqual(loadedWalletState!.walletId, walletState.walletId)
        XCTAssertEqual(loadedWalletState!.publicKey, walletState.publicKey)
        XCTAssertEqual(loadedWalletState!.offlineBalance, walletState.offlineBalance)
        XCTAssertEqual(loadedWalletState!.blockchainBalance, walletState.blockchainBalance)
    }
    
    func testUpdateLastSyncTimestamp() async throws {
        // Given
        let walletState = createTestWalletState()
        try await storageService.saveWalletState(walletState)
        let newTimestamp = Date()
        
        // When
        try await storageService.updateLastSyncTimestamp(newTimestamp)
        
        // Then
        let updatedWalletState = try await storageService.loadWalletState()
        XCTAssertNotNil(updatedWalletState)
        XCTAssertNotNil(updatedWalletState!.lastSyncTimestamp)
        XCTAssertEqual(updatedWalletState!.lastSyncTimestamp!.timeIntervalSince1970, 
                      newTimestamp.timeIntervalSince1970, accuracy: 1.0)
    }
    
    // MARK: - Data Management Tests
    
    func testClearAllData() async throws {
        // Given
        let token = createTestOfflineToken(amount: 100.0)
        let transaction = createTestTransaction(amount: 50.0)
        let walletState = createTestWalletState()
        
        try await storageService.saveOfflineToken(token)
        try await storageService.saveTransaction(transaction)
        try await storageService.saveWalletState(walletState)
        
        // When
        try await storageService.clearAllData()
        
        // Then
        let tokens = try await storageService.loadOfflineTokens()
        let transactions = try await storageService.loadTransactions()
        let loadedWalletState = try await storageService.loadWalletState()
        
        XCTAssertTrue(tokens.isEmpty)
        XCTAssertTrue(transactions.isEmpty)
        XCTAssertNil(loadedWalletState)
    }
    
    func testExportAndImportData() async throws {
        // Given
        let token = createTestOfflineToken(amount: 100.0)
        let transaction = createTestTransaction(amount: 50.0)
        let walletState = createTestWalletState()
        
        try await storageService.saveOfflineToken(token)
        try await storageService.saveTransaction(transaction)
        try await storageService.saveWalletState(walletState)
        
        // When
        let exportedData = try await storageService.exportData()
        try await storageService.clearAllData()
        try await storageService.importData(exportedData)
        
        // Then
        let importedTokens = try await storageService.loadOfflineTokens()
        let importedTransactions = try await storageService.loadTransactions()
        let importedWalletState = try await storageService.loadWalletState()
        
        XCTAssertEqual(importedTokens.count, 1)
        XCTAssertEqual(importedTokens.first?.id, token.id)
        
        XCTAssertEqual(importedTransactions.count, 1)
        XCTAssertEqual(importedTransactions.first?.id, transaction.id)
        
        XCTAssertNotNil(importedWalletState)
        XCTAssertEqual(importedWalletState!.walletId, walletState.walletId)
    }
    
    // MARK: - Helper Methods
    
    private func createTestOfflineToken(
        amount: Double,
        isSpent: Bool = false,
        expirationDate: Date = Date().addingTimeInterval(3600)
    ) -> OfflineToken {
        return OfflineToken(
            id: UUID().uuidString,
            amount: amount,
            signature: "test_signature_\(UUID().uuidString)",
            issuer: "test_issuer",
            issuedAt: Date(),
            expirationDate: expirationDate,
            isSpent: isSpent,
            spentAt: isSpent ? Date() : nil,
            divisions: []
        )
    }
    
    private func createTestTransaction(
        amount: Double,
        type: TransactionType = .offlineTransfer,
        status: TransactionStatus = .pending
    ) -> Transaction {
        return Transaction(
            id: UUID().uuidString,
            type: type,
            senderId: "test_sender",
            receiverId: "test_receiver",
            amount: amount,
            timestamp: Date(),
            status: status,
            tokenIds: [UUID().uuidString],
            senderSignature: "test_sender_signature",
            receiverSignature: "test_receiver_signature",
            metadata: nil
        )
    }
    
    private func createTestWalletState() -> WalletState {
        return WalletState(
            walletId: UUID().uuidString,
            publicKey: "test_public_key_\(UUID().uuidString)",
            offlineBalance: 500.0,
            blockchainBalance: 1000.0,
            lastSyncTimestamp: Date(),
            autoRechargeEnabled: true,
            autoRechargeThreshold: 100.0,
            autoRechargeAmount: 200.0
        )
    }
}