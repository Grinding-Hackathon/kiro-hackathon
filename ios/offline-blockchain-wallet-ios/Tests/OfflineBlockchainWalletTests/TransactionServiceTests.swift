//
//  TransactionServiceTests.swift
//  OfflineBlockchainWalletTests
//
//  Created by Kiro on 7/21/25.
//

import XCTest
import Combine
@testable import offline_blockchain_wallet_ios

final class TransactionServiceTests: XCTestCase {
    
    var transactionService: TransactionService!
    var mockStorageService: MockStorageService!
    var mockCryptographyService: MockCryptographyService!
    var mockOfflineTokenService: MockOfflineTokenService!
    var cancellables: Set<AnyCancellable>!
    
    override func setUpWithError() throws {
        try super.setUpWithError()
        
        mockStorageService = MockStorageService()
        mockCryptographyService = MockCryptographyService()
        mockOfflineTokenService = MockOfflineTokenService()
        
        transactionService = TransactionService(
            storageService: mockStorageService,
            cryptographyService: mockCryptographyService,
            offlineTokenService: mockOfflineTokenService
        )
        
        cancellables = Set<AnyCancellable>()
    }
    
    override func tearDownWithError() throws {
        transactionService = nil
        mockStorageService = nil
        mockCryptographyService = nil
        mockOfflineTokenService = nil
        cancellables = nil
        try super.tearDownWithError()
    }
    
    // MARK: - Transaction Initiation Tests
    
    func testInitiateTransactionSuccess() async throws {
        // Given
        let recipientId = "recipient123"
        let amount = 50.0
        let type = TransactionType.offlineTransfer
        
        mockOfflineTokenService.availableBalance = 100.0
        mockStorageService.mockWalletState = createMockWalletState()
        mockOfflineTokenService.mockUnspentTokens = [
            createMockOfflineToken(id: "token1", amount: 60.0)
        ]
        
        // When
        let transaction = try await transactionService.initiateTransaction(
            recipientId: recipientId,
            amount: amount,
            type: type
        )
        
        // Then
        XCTAssertEqual(transaction.recipientId, recipientId)
        XCTAssertEqual(transaction.amount, amount)
        XCTAssertEqual(transaction.type, type)
        XCTAssertEqual(transaction.status, .pending)
        XCTAssertFalse(transaction.tokenIds.isEmpty)
        XCTAssertTrue(mockStorageService.savedTransactions.contains { $0.id == transaction.id })
    }
    
    func testInitiateTransactionInvalidAmount() async {
        // Given
        let recipientId = "recipient123"
        let amount = -10.0
        let type = TransactionType.offlineTransfer
        
        // When/Then
        do {
            _ = try await transactionService.initiateTransaction(
                recipientId: recipientId,
                amount: amount,
                type: type
            )
            XCTFail("Should have thrown invalidAmount error")
        } catch TransactionError.invalidAmount {
            // Expected
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }
    
    func testInitiateTransactionInsufficientBalance() async {
        // Given
        let recipientId = "recipient123"
        let amount = 150.0
        let type = TransactionType.offlineTransfer
        
        mockOfflineTokenService.availableBalance = 100.0
        mockStorageService.mockWalletState = createMockWalletState()
        
        // When/Then
        do {
            _ = try await transactionService.initiateTransaction(
                recipientId: recipientId,
                amount: amount,
                type: type
            )
            XCTFail("Should have thrown insufficientBalance error")
        } catch TransactionError.insufficientBalance {
            // Expected
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }
    
    // MARK: - Transaction Signing Tests
    
    func testSignTransactionSuccess() async throws {
        // Given
        let transaction = createMockTransaction()
        let privateKey = "mock_private_key"
        let expectedSignature = "mock_signature"
        
        mockCryptographyService.mockSignature = expectedSignature
        
        // When
        let signedTransaction = try await transactionService.signTransaction(transaction, with: privateKey)
        
        // Then
        XCTAssertEqual(signedTransaction.senderSignature, expectedSignature)
        XCTAssertEqual(signedTransaction.status, .pending)
        XCTAssertTrue(mockStorageService.updatedTransactions.contains { $0.id == transaction.id })
    }
    
    func testSignTransactionCryptographyError() async {
        // Given
        let transaction = createMockTransaction()
        let privateKey = "invalid_key"
        
        mockCryptographyService.shouldThrowError = true
        
        // When/Then
        do {
            _ = try await transactionService.signTransaction(transaction, with: privateKey)
            XCTFail("Should have thrown cryptography error")
        } catch {
            // Expected
        }
    }
    
    // MARK: - Transaction Verification Tests
    
    func testVerifyTransactionSuccess() async throws {
        // Given
        let transaction = createMockTransaction(
            senderSignature: "valid_signature",
            receiverSignature: "valid_signature"
        )
        
        mockCryptographyService.mockVerificationResult = true
        mockStorageService.mockOfflineTokens = [
            createMockOfflineToken(id: "token1", amount: 50.0, isSpent: false)
        ]
        
        // When
        let isValid = try await transactionService.verifyTransaction(transaction)
        
        // Then
        XCTAssertTrue(isValid)
    }
    
    func testVerifyTransactionInvalidAmount() async {
        // Given
        let transaction = createMockTransaction(amount: -10.0)
        
        // When/Then
        do {
            _ = try await transactionService.verifyTransaction(transaction)
            XCTFail("Should have thrown invalidAmount error")
        } catch TransactionError.invalidAmount {
            // Expected
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }
    
    func testVerifyTransactionDoubleSpending() async {
        // Given
        let transaction = createMockTransaction(tokenIds: ["token1"])
        
        mockStorageService.mockOfflineTokens = [
            createMockOfflineToken(id: "token1", amount: 50.0, isSpent: true)
        ]
        
        // When/Then
        do {
            _ = try await transactionService.verifyTransaction(transaction)
            XCTFail("Should have thrown doubleSpending error")
        } catch TransactionError.doubleSpending {
            // Expected
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }
    
    // MARK: - Double Spending Prevention Tests
    
    func testCheckDoubleSpendingWithSpentToken() async throws {
        // Given
        let transaction = createMockTransaction(tokenIds: ["token1"])
        
        mockStorageService.mockOfflineTokens = [
            createMockOfflineToken(id: "token1", amount: 50.0, isSpent: true)
        ]
        
        // When
        let isDoubleSpending = try await transactionService.checkDoubleSpending(for: transaction)
        
        // Then
        XCTAssertTrue(isDoubleSpending)
    }
    
    func testCheckDoubleSpendingWithUnspentToken() async throws {
        // Given
        let transaction = createMockTransaction(tokenIds: ["token1"])
        
        mockStorageService.mockOfflineTokens = [
            createMockOfflineToken(id: "token1", amount: 50.0, isSpent: false)
        ]
        
        // When
        let isDoubleSpending = try await transactionService.checkDoubleSpending(for: transaction)
        
        // Then
        XCTAssertFalse(isDoubleSpending)
    }
    
    func testCheckDoubleSpendingWithDuplicateTransaction() async throws {
        // Given
        let transaction = createMockTransaction()
        
        mockStorageService.mockTransactions = [
            createMockTransaction(
                senderId: transaction.senderId,
                receiverId: transaction.receiverId,
                amount: transaction.amount,
                status: .completed,
                timestamp: Date()
            )
        ]
        
        // When
        let isDoubleSpending = try await transactionService.checkDoubleSpending(for: transaction)
        
        // Then
        XCTAssertTrue(isDoubleSpending)
    }
    
    // MARK: - Transaction State Management Tests
    
    func testUpdateTransactionStateToCompleted() async throws {
        // Given
        let transaction = createMockTransaction(tokenIds: ["token1"])
        
        // When
        try await transactionService.updateTransactionState(transaction, to: .completed)
        
        // Then
        XCTAssertTrue(mockStorageService.updatedTransactions.contains { 
            $0.id == transaction.id && $0.status == .completed 
        })
        XCTAssertTrue(mockStorageService.spentTokenIds.contains("token1"))
    }
    
    func testUpdateTransactionStateToFailed() async throws {
        // Given
        let transaction = createMockTransaction()
        
        // When
        try await transactionService.updateTransactionState(transaction, to: .failed)
        
        // Then
        XCTAssertTrue(mockStorageService.updatedTransactions.contains { 
            $0.id == transaction.id && $0.status == .failed 
        })
    }
    
    func testGetTransactionState() async throws {
        // Given
        let transaction = createMockTransaction()
        mockStorageService.mockTransactions = [transaction]
        
        // When
        let status = try await transactionService.getTransactionState(id: transaction.id)
        
        // Then
        XCTAssertEqual(status, transaction.status)
    }
    
    // MARK: - Transaction Queue Tests
    
    func testQueueTransactionForSync() async throws {
        // Given
        let transaction = createMockTransaction()
        
        // When
        try await transactionService.queueTransactionForSync(transaction)
        
        // Then
        let queuedTransactions = try await transactionService.getQueuedTransactions()
        XCTAssertTrue(queuedTransactions.contains { $0.id == transaction.id })
    }
    
    func testRemoveFromQueue() async throws {
        // Given
        let transaction = createMockTransaction()
        try await transactionService.queueTransactionForSync(transaction)
        
        // When
        try await transactionService.removeFromQueue(transactionId: transaction.id)
        
        // Then
        let queuedTransactions = try await transactionService.getQueuedTransactions()
        XCTAssertFalse(queuedTransactions.contains { $0.id == transaction.id })
    }
    
    func testProcessQueuedTransactions() async throws {
        // Given
        let transaction = createMockTransaction(type: .tokenRedemption)
        try await transactionService.queueTransactionForSync(transaction)
        
        // When
        try await transactionService.processQueuedTransactions()
        
        // Then
        let queuedTransactions = try await transactionService.getQueuedTransactions()
        XCTAssertTrue(queuedTransactions.isEmpty)
    }
    
    // MARK: - Error Handling Tests
    
    func testHandleFailedTransaction() async throws {
        // Given
        let transaction = createMockTransaction()
        let error = TransactionError.processingFailed
        
        // When
        try await transactionService.handleFailedTransaction(transaction, error: error)
        
        // Then
        XCTAssertTrue(mockStorageService.updatedTransactions.contains { 
            $0.id == transaction.id && $0.status == .failed 
        })
    }
    
    func testRetryFailedTransaction() async throws {
        // Given
        let transaction = createMockTransaction(status: .failed)
        
        // When
        let retriedTransaction = try await transactionService.retryFailedTransaction(transaction)
        
        // Then
        XCTAssertEqual(retriedTransaction.status, .pending)
        XCTAssertNil(retriedTransaction.metadata?.errorMessage)
        XCTAssertTrue(mockStorageService.updatedTransactions.contains { 
            $0.id == transaction.id && $0.status == .pending 
        })
    }
    
    func testCancelTransaction() async throws {
        // Given
        let transaction = createMockTransaction()
        try await transactionService.queueTransactionForSync(transaction)
        
        // When
        try await transactionService.cancelTransaction(transaction)
        
        // Then
        XCTAssertTrue(mockStorageService.updatedTransactions.contains { 
            $0.id == transaction.id && $0.status == .cancelled 
        })
        
        let queuedTransactions = try await transactionService.getQueuedTransactions()
        XCTAssertFalse(queuedTransactions.contains { $0.id == transaction.id })
    }
    
    // MARK: - Transaction Processing Tests
    
    func testProcessIncomingTransaction() async throws {
        // Given
        let transaction = createMockTransaction(type: .offlineTransfer)
        
        mockCryptographyService.mockVerificationResult = true
        mockStorageService.mockOfflineTokens = [
            createMockOfflineToken(id: "token1", amount: 50.0, isSpent: false)
        ]
        
        // When
        let result = try await transactionService.processIncomingTransaction(transaction)
        
        // Then
        XCTAssertTrue(result)
    }
    
    func testProcessOutgoingTransaction() async throws {
        // Given
        let transaction = createMockTransaction(type: .offlineTransfer)
        
        mockCryptographyService.mockVerificationResult = true
        mockStorageService.mockOfflineTokens = [
            createMockOfflineToken(id: "token1", amount: 50.0, isSpent: false)
        ]
        
        // When
        let result = try await transactionService.processOutgoingTransaction(transaction)
        
        // Then
        XCTAssertTrue(result)
    }
    
    func testFinalizeTransaction() async throws {
        // Given
        let transaction = createMockTransaction()
        
        // When
        try await transactionService.finalizeTransaction(transaction)
        
        // Then
        XCTAssertTrue(mockStorageService.updatedTransactions.contains { 
            $0.id == transaction.id && $0.status == .completed 
        })
        
        let queuedTransactions = try await transactionService.getQueuedTransactions()
        XCTAssertTrue(queuedTransactions.contains { $0.id == transaction.id })
    }
    
    // MARK: - Publisher Tests
    
    func testTransactionUpdatesPublisher() async throws {
        // Given
        let expectation = XCTestExpectation(description: "Transaction update received")
        let transaction = createMockTransaction()
        
        transactionService.transactionUpdates
            .sink { updatedTransaction in
                if updatedTransaction.id == transaction.id {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)
        
        // When
        try await transactionService.updateTransactionState(transaction, to: .completed)
        
        // Then
        await fulfillment(of: [expectation], timeout: 1.0)
    }
    
    func testQueueUpdatesPublisher() async throws {
        // Given
        let expectation = XCTestExpectation(description: "Queue update received")
        let transaction = createMockTransaction()
        
        transactionService.queueUpdates
            .sink { queuedTransactions in
                if queuedTransactions.contains(where: { $0.id == transaction.id }) {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)
        
        // When
        try await transactionService.queueTransactionForSync(transaction)
        
        // Then
        await fulfillment(of: [expectation], timeout: 1.0)
    }
}

// MARK: - Helper Methods
extension TransactionServiceTests {
    
    private func createMockTransaction(
        id: String = UUID().uuidString,
        type: TransactionType = .offlineTransfer,
        senderId: String = "sender123",
        receiverId: String = "receiver123",
        amount: Double = 50.0,
        status: TransactionStatus = .pending,
        tokenIds: [String] = ["token1"],
        senderSignature: String? = nil,
        receiverSignature: String? = nil,
        timestamp: Date = Date()
    ) -> Transaction {
        return Transaction(
            id: id,
            type: type,
            senderId: senderId,
            receiverId: receiverId,
            amount: amount,
            timestamp: timestamp,
            status: status,
            tokenIds: tokenIds,
            senderSignature: senderSignature,
            receiverSignature: receiverSignature,
            metadata: TransactionMetadata(
                connectionType: "bluetooth",
                deviceInfo: "iPhone Test"
            )
        )
    }
    
    private func createMockOfflineToken(
        id: String = UUID().uuidString,
        amount: Double = 50.0,
        isSpent: Bool = false
    ) -> OfflineToken {
        return OfflineToken(
            id: id,
            amount: amount,
            signature: "mock_signature",
            issuer: "mock_issuer",
            issuedAt: Date(),
            expirationDate: Date().addingTimeInterval(86400),
            isSpent: isSpent,
            spentAt: isSpent ? Date() : nil,
            divisions: []
        )
    }
    
    private func createMockWalletState() -> WalletState {
        return WalletState(
            walletId: "wallet123",
            publicKey: "mock_public_key",
            offlineBalance: 100.0,
            blockchainBalance: 500.0,
            lastSyncTimestamp: Date(),
            autoRechargeEnabled: true,
            autoRechargeThreshold: 50.0,
            autoRechargeAmount: 200.0
        )
    }
}

// MARK: - Mock Services
class MockStorageService: StorageServiceProtocol {
    var mockTransactions: [Transaction] = []
    var mockOfflineTokens: [OfflineToken] = []
    var mockWalletState: WalletState?
    
    var savedTransactions: [Transaction] = []
    var updatedTransactions: [Transaction] = []
    var spentTokenIds: [String] = []
    
    func loadOfflineTokens() async throws -> [OfflineToken] {
        return mockOfflineTokens
    }
    
    func saveOfflineToken(_ token: OfflineToken) async throws {}
    func saveOfflineTokens(_ tokens: [OfflineToken]) async throws {}
    func updateOfflineToken(_ token: OfflineToken) async throws {}
    func deleteOfflineToken(id: String) async throws {}
    
    func loadTransactions() async throws -> [Transaction] {
        return mockTransactions
    }
    
    func saveTransaction(_ transaction: Transaction) async throws {
        savedTransactions.append(transaction)
    }
    
    func updateTransaction(_ transaction: Transaction) async throws {
        updatedTransactions.append(transaction)
    }
    
    func deleteTransaction(id: String) async throws {}
    
    func loadWalletState() async throws -> WalletState? {
        return mockWalletState
    }
    
    func saveWalletState(_ state: WalletState) async throws {}
    
    func deleteExpiredTokens() async throws -> [String] { return [] }
    
    func markTokenAsSpent(id: String, spentAt: Date) async throws {
        spentTokenIds.append(id)
    }
    
    func getUnspentTokens() async throws -> [OfflineToken] {
        return mockOfflineTokens.filter { !$0.isSpent }
    }
    
    func getTransactionsByStatus(_ status: TransactionStatus) async throws -> [Transaction] {
        return mockTransactions.filter { $0.status == status }
    }
    
    func getTotalOfflineBalance() async throws -> Double { return 100.0 }
    func getPendingSyncTransactions() async throws -> [Transaction] { return [] }
    func markTransactionAsSynced(id: String) async throws {}
    func getLastSyncTimestamp() async throws -> Date? { return nil }
    func updateLastSyncTimestamp(_ timestamp: Date) async throws {}
    func clearAllData() async throws {}
    func exportData() async throws -> Data { return Data() }
    func importData(_ data: Data) async throws {}
    func performDataMigration() async throws {}
}

class MockCryptographyService: CryptographyServiceProtocol {
    var mockSignature = "mock_signature"
    var mockVerificationResult = true
    var shouldThrowError = false
    
    func generateKeyPair() throws -> (privateKey: String, publicKey: String) {
        return ("private", "public")
    }
    
    func generateKeyPairForSigning() throws -> (privateKey: String, publicKey: String) {
        return ("private", "public")
    }
    
    func generateKeyPairForEncryption() throws -> (privateKey: String, publicKey: String) {
        return ("private", "public")
    }
    
    func signData(_ data: Data, with privateKey: String) throws -> String {
        if shouldThrowError {
            throw CryptographyError.signatureVerificationFailed
        }
        return mockSignature
    }
    
    func verifySignature(_ signature: String, for data: Data, with publicKey: String) throws -> Bool {
        if shouldThrowError {
            throw CryptographyError.signatureVerificationFailed
        }
        return mockVerificationResult
    }
    
    func signMessage(_ message: String, with privateKey: String) throws -> String {
        return mockSignature
    }
    
    func verifyMessageSignature(_ signature: String, for message: String, with publicKey: String) throws -> Bool {
        return mockVerificationResult
    }
    
    func encryptData(_ data: Data, with publicKey: String) throws -> Data { return data }
    func decryptData(_ encryptedData: Data, with privateKey: String) throws -> Data { return encryptedData }
    func encryptMessage(_ message: String, with publicKey: String) throws -> String { return message }
    func decryptMessage(_ encryptedMessage: String, with privateKey: String) throws -> String { return encryptedMessage }
    func storePrivateKey(_ privateKey: String, for identifier: String) throws {}
    func retrievePrivateKey(for identifier: String) throws -> String? { return nil }
    func deletePrivateKey(for identifier: String) throws {}
    func keyExists(for identifier: String) -> Bool { return false }
    func hashData(_ data: Data) -> String { return "hash" }
    func hashMessage(_ message: String) -> String { return "hash" }
    func validatePrivateKey(_ privateKey: String) -> Bool { return true }
    func validatePublicKey(_ publicKey: String) -> Bool { return true }
    func validateKeyPair(privateKey: String, publicKey: String) -> Bool { return true }
}

class MockOfflineTokenService: OfflineTokenServiceProtocol {
    var availableBalance: Double = 100.0
    var mockUnspentTokens: [OfflineToken] = []
    
    func purchaseTokens(amount: Double) async throws -> [OfflineToken] { return [] }
    func validateToken(_ token: OfflineToken) async throws -> Bool { return true }
    func divideToken(_ token: OfflineToken, amount: Double) async throws -> TokenDivision { 
        return TokenDivision(paymentToken: token, changeToken: nil)
    }
    func markTokenAsSpent(tokenId: String) async throws {}
    func getAvailableBalance() async throws -> Double { return availableBalance }
    func handleExpiredTokens() async throws {}
    func redeemTokens(_ tokens: [OfflineToken]) async throws {}
    func getUnspentTokens() async throws -> [OfflineToken] { return mockUnspentTokens }
    func syncWithBackend() async throws {}
}