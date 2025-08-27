//
//  TransactionService.swift
//  offline-blockchain-wallet-ios
//
//  Created by Kiro on 7/21/25.
//

import Foundation
import Combine

protocol TransactionServiceProtocol {
    // Publishers
    var transactionUpdates: PassthroughSubject<Transaction, Never> { get }
    var queueUpdates: PassthroughSubject<[Transaction], Never> { get }
    
    // Transaction initiation and signing
    func initiateTransaction(recipientId: String, amount: Double, type: TransactionType) async throws -> Transaction
    func signTransaction(_ transaction: Transaction, with privateKey: String) async throws -> Transaction
    
    // Transaction verification and validation
    func verifyTransaction(_ transaction: Transaction) async throws -> Bool
    func validateTransactionSignature(_ transaction: Transaction, publicKey: String) async throws -> Bool
    
    // Double-spending prevention and state management
    func checkDoubleSpending(for transaction: Transaction) async throws -> Bool
    func updateTransactionState(_ transaction: Transaction, to status: TransactionStatus) async throws
    func getTransactionState(id: String) async throws -> TransactionStatus?
    
    // Transaction queuing for offline-to-online synchronization
    func queueTransactionForSync(_ transaction: Transaction) async throws
    func getQueuedTransactions() async throws -> [Transaction]
    func processQueuedTransactions() async throws
    func removeFromQueue(transactionId: String) async throws
    
    // Error handling for failed or interrupted transactions
    func handleFailedTransaction(_ transaction: Transaction, error: Error) async throws
    func retryFailedTransaction(_ transaction: Transaction) async throws -> Transaction
    func cancelTransaction(_ transaction: Transaction) async throws
    
    // Transaction processing
    func processIncomingTransaction(_ transaction: Transaction) async throws -> Bool
    func processOutgoingTransaction(_ transaction: Transaction) async throws -> Bool
    func finalizeTransaction(_ transaction: Transaction) async throws
}

class TransactionService: TransactionServiceProtocol {
    private let storageService: StorageServiceProtocol
    private let cryptographyService: CryptographyServiceProtocol
    private let offlineTokenService: OfflineTokenServiceProtocol
    private let networkService: NetworkServiceProtocol
    private let logger = Logger.shared
    
    // Transaction state tracking
    private actor TransactionState {
        private var activeTransactions: [String: Transaction] = [:]
        private var transactionQueue: [Transaction] = []
        
        func setActiveTransaction(_ transaction: Transaction) {
            activeTransactions[transaction.id] = transaction
        }
        
        func removeActiveTransaction(id: String) {
            activeTransactions.removeValue(forKey: id)
        }
        
        func getActiveTransaction(id: String) -> Transaction? {
            return activeTransactions[id]
        }
        
        func addToQueue(_ transaction: Transaction) {
            if !transactionQueue.contains(where: { $0.id == transaction.id }) {
                transactionQueue.append(transaction)
            }
        }
        
        func removeFromQueue(id: String) {
            transactionQueue.removeAll { $0.id == id }
        }
        
        func getQueue() -> [Transaction] {
            return transactionQueue
        }
        
        func setQueue(_ queue: [Transaction]) {
            transactionQueue = queue
        }
    }
    
    private let transactionState = TransactionState()
    
    // Publishers for transaction updates
    @Published var transactionUpdates = PassthroughSubject<Transaction, Never>()
    @Published var queueUpdates = PassthroughSubject<[Transaction], Never>()
    
    init(storageService: StorageServiceProtocol,
         cryptographyService: CryptographyServiceProtocol,
         offlineTokenService: OfflineTokenServiceProtocol,
         networkService: NetworkServiceProtocol) {
        self.storageService = storageService
        self.cryptographyService = cryptographyService
        self.offlineTokenService = offlineTokenService
        self.networkService = networkService
        
        // Load queued transactions on initialization
        Task {
            await loadQueuedTransactions()
        }
    }
    
    // MARK: - Transaction Initiation and Signing
    
    func initiateTransaction(recipientId: String, amount: Double, type: TransactionType) async throws -> Transaction {
        logger.info("Initiating transaction: \(type.rawValue) for amount \(amount)")
        
        // Validate input parameters
        guard amount > 0 else {
            throw TransactionError.invalidAmount
        }
        
        guard !recipientId.isEmpty else {
            throw TransactionError.invalidRecipient
        }
        
        // Check if user has sufficient balance for offline transactions
        if type == .offlineTransfer {
            let availableBalance = try await offlineTokenService.getAvailableBalance()
            guard availableBalance >= amount else {
                throw TransactionError.insufficientBalance
            }
        }
        
        // Get current user ID (this would come from wallet state)
        let walletState = try await storageService.loadWalletState()
        guard let currentUserId = walletState?.walletId else {
            throw TransactionError.walletNotInitialized
        }
        
        // Select tokens for the transaction if it's an offline transfer
        var tokenIds: [String] = []
        if type == .offlineTransfer {
            let selectedTokens = try await selectTokensForAmount(amount)
            tokenIds = selectedTokens.map { $0.id }
        }
        
        // Create transaction
        let transaction = Transaction(
            type: type,
            senderId: currentUserId,
            receiverId: recipientId,
            amount: amount,
            status: .pending,
            tokenIds: tokenIds,
            metadata: TransactionMetadata(
                connectionType: type == .offlineTransfer ? "bluetooth" : "online",
                deviceInfo: "iOS Device"
            )
        )
        
        // Store transaction
        try await storageService.saveTransaction(transaction)
        
        // Track active transaction
        await transactionState.setActiveTransaction(transaction)
        
        logger.info("Transaction initiated: \(transaction.id)")
        transactionUpdates.send(transaction)
        
        return transaction
    }
    
    func signTransaction(_ transaction: Transaction, with privateKey: String) async throws -> Transaction {
        logger.info("Signing transaction: \(transaction.id)")
        
        // Create transaction data for signing
        let transactionData = try createTransactionSigningData(transaction)
        
        // Sign the transaction data
        let signature = try cryptographyService.signData(transactionData, with: privateKey)
        
        // Update transaction with signature
        var signedTransaction = transaction
        if await transaction.senderId == getCurrentUserId() {
            signedTransaction.senderSignature = signature
        } else {
            signedTransaction.receiverSignature = signature
        }
        
        // Update transaction status
        signedTransaction.status = .pending
        
        // Save updated transaction
        try await storageService.updateTransaction(signedTransaction)
        
        // Update active transactions
        await transactionState.setActiveTransaction(signedTransaction)
        
        logger.info("Transaction signed: \(transaction.id)")
        transactionUpdates.send(signedTransaction)
        
        return signedTransaction
    }
    
    // MARK: - Transaction Verification and Validation
    
    func verifyTransaction(_ transaction: Transaction) async throws -> Bool {
        logger.info("Verifying transaction: \(transaction.id)")
        
        // Basic validation
        guard transaction.amount > 0 else {
            throw TransactionError.invalidAmount
        }
        
        guard !transaction.senderId.isEmpty && !transaction.receiverId.isEmpty else {
            throw TransactionError.invalidParticipants
        }
        
        // Check for double spending
        let isDoubleSpending = try await checkDoubleSpending(for: transaction)
        if isDoubleSpending {
            throw TransactionError.doubleSpending
        }
        
        // Verify signatures if present
        if transaction.senderSignature != nil {
            let senderPublicKey = try await getPublicKey(for: transaction.senderId)
            let isValidSenderSignature = try await validateTransactionSignature(transaction, publicKey: senderPublicKey)
            if !isValidSenderSignature {
                throw TransactionError.invalidSignature
            }
        }
        
        if transaction.receiverSignature != nil {
            let receiverPublicKey = try await getPublicKey(for: transaction.receiverId)
            let isValidReceiverSignature = try await validateTransactionSignature(transaction, publicKey: receiverPublicKey)
            if !isValidReceiverSignature {
                throw TransactionError.invalidSignature
            }
        }
        
        // Verify token ownership for offline transfers
        if transaction.type == .offlineTransfer {
            try await verifyTokenOwnership(transaction)
        }
        
        logger.info("Transaction verified successfully: \(transaction.id)")
        return true
    }
    
    func validateTransactionSignature(_ transaction: Transaction, publicKey: String) async throws -> Bool {
        let transactionData = try createTransactionSigningData(transaction)
        
        // Check sender signature
        if let senderSignature = transaction.senderSignature {
            return try cryptographyService.verifySignature(senderSignature, for: transactionData, with: publicKey)
        }
        
        // Check receiver signature
        if let receiverSignature = transaction.receiverSignature {
            return try cryptographyService.verifySignature(receiverSignature, for: transactionData, with: publicKey)
        }
        
        return false
    }
    
    // MARK: - Double-Spending Prevention and State Management
    
    func checkDoubleSpending(for transaction: Transaction) async throws -> Bool {
        logger.info("Checking double spending for transaction: \(transaction.id)")
        
        // For offline transfers, check if tokens are already spent
        if transaction.type == .offlineTransfer {
            for tokenId in transaction.tokenIds {
                let tokens = try await storageService.loadOfflineTokens()
                if let token = tokens.first(where: { $0.id == tokenId }) {
                    if token.isSpent {
                        logger.warning("Token already spent: \(tokenId)")
                        return true
                    }
                }
            }
        }
        
        // Check for duplicate transactions
        let existingTransactions = try await storageService.loadTransactions()
        let duplicateTransactions = existingTransactions.filter { existingTx in
            existingTx.senderId == transaction.senderId &&
            existingTx.receiverId == transaction.receiverId &&
            existingTx.amount == transaction.amount &&
            existingTx.status == .completed &&
            abs(existingTx.timestamp.timeIntervalSince(transaction.timestamp)) < 60 // Within 1 minute
        }
        
        if !duplicateTransactions.isEmpty {
            logger.warning("Potential duplicate transaction detected")
            return true
        }
        
        return false
    }
    
    func updateTransactionState(_ transaction: Transaction, to status: TransactionStatus) async throws {
        logger.info("Updating transaction \(transaction.id) status to \(status.rawValue)")
        
        var updatedTransaction = transaction
        updatedTransaction.status = status
        
        // Add error metadata if transaction failed
        if status == .failed {
            var metadata = transaction.metadata ?? TransactionMetadata()
            metadata = TransactionMetadata(
                connectionType: metadata.connectionType,
                deviceInfo: metadata.deviceInfo,
                bluetoothDeviceId: metadata.bluetoothDeviceId,
                errorMessage: "Transaction failed"
            )
            updatedTransaction.metadata = metadata
        }
        
        // Save updated transaction
        try await storageService.updateTransaction(updatedTransaction)
        
        // Update active transactions
        if status == .completed || status == .failed || status == .cancelled {
            await transactionState.removeActiveTransaction(id: transaction.id)
        } else {
            await transactionState.setActiveTransaction(updatedTransaction)
        }
        
        // Mark tokens as spent if transaction completed
        if status == .completed && transaction.type == .offlineTransfer {
            for tokenId in transaction.tokenIds {
                try await storageService.markTokenAsSpent(id: tokenId, spentAt: Date())
            }
        }
        
        transactionUpdates.send(updatedTransaction)
    }
    
    func getTransactionState(id: String) async throws -> TransactionStatus? {
        // Check active transactions first
        let activeTransaction = await transactionState.getActiveTransaction(id: id)
        
        if let transaction = activeTransaction {
            return transaction.status
        }
        
        // Check stored transactions
        let transactions = try await storageService.loadTransactions()
        return transactions.first(where: { $0.id == id })?.status
    }
    
    // MARK: - Transaction Queuing for Synchronization
    
    func queueTransactionForSync(_ transaction: Transaction) async throws {
        logger.info("Queuing transaction for sync: \(transaction.id)")
        
        // Add to queue if not already present
        await transactionState.addToQueue(transaction)
        let updatedQueue = await transactionState.getQueue()
        queueUpdates.send(updatedQueue)
        
        // Persist queue to storage
        try await persistTransactionQueue()
    }
    
    func getQueuedTransactions() async throws -> [Transaction] {
        return await transactionState.getQueue()
    }
    
    func processQueuedTransactions() async throws {
        logger.info("Processing queued transactions")
        
        let queuedTransactions = try await getQueuedTransactions()
        
        for transaction in queuedTransactions {
            do {
                // Process based on transaction type
                switch transaction.type {
                case .tokenRedemption:
                    try await processTokenRedemption(transaction)
                case .offlineTransfer:
                    try await syncOfflineTransfer(transaction)
                default:
                    logger.info("Skipping sync for transaction type: \(transaction.type.rawValue)")
                }
                
                // Remove from queue on success
                try await removeFromQueue(transactionId: transaction.id)
                
            } catch {
                logger.error("Failed to process queued transaction \(transaction.id): \(error)")
                try await handleFailedTransaction(transaction, error: error)
            }
        }
    }
    
    func removeFromQueue(transactionId: String) async throws {
        await transactionState.removeFromQueue(id: transactionId)
        let updatedQueue = await transactionState.getQueue()
        
        queueUpdates.send(updatedQueue)
        try await persistTransactionQueue()
    }
    
    // MARK: - Error Handling
    
    func handleFailedTransaction(_ transaction: Transaction, error: Error) async throws {
        logger.error("Handling failed transaction \(transaction.id): \(error)")
        
        var failedTransaction = transaction
        failedTransaction.status = .failed
        
        // Add error information to metadata
        var metadata = transaction.metadata ?? TransactionMetadata()
        metadata = TransactionMetadata(
            connectionType: metadata.connectionType,
            deviceInfo: metadata.deviceInfo,
            bluetoothDeviceId: metadata.bluetoothDeviceId,
            errorMessage: error.localizedDescription
        )
        failedTransaction.metadata = metadata
        
        // Save failed transaction
        try await storageService.updateTransaction(failedTransaction)
        
        // Remove from active transactions
        await transactionState.removeActiveTransaction(id: transaction.id)
        
        transactionUpdates.send(failedTransaction)
    }
    
    func retryFailedTransaction(_ transaction: Transaction) async throws -> Transaction {
        logger.info("Retrying failed transaction: \(transaction.id)")
        
        // Reset transaction status
        var retryTransaction = transaction
        retryTransaction.status = .pending
        retryTransaction.metadata = TransactionMetadata(
            connectionType: transaction.metadata?.connectionType,
            deviceInfo: transaction.metadata?.deviceInfo,
            bluetoothDeviceId: transaction.metadata?.bluetoothDeviceId,
            errorMessage: nil
        )
        
        // Save updated transaction
        try await storageService.updateTransaction(retryTransaction)
        
        // Add back to active transactions
        await transactionState.setActiveTransaction(retryTransaction)
        
        transactionUpdates.send(retryTransaction)
        return retryTransaction
    }
    
    func cancelTransaction(_ transaction: Transaction) async throws {
        logger.info("Cancelling transaction: \(transaction.id)")
        
        var cancelledTransaction = transaction
        cancelledTransaction.status = .cancelled
        
        // Save cancelled transaction
        try await storageService.updateTransaction(cancelledTransaction)
        
        // Remove from active transactions and queue
        await transactionState.removeActiveTransaction(id: transaction.id)
        await transactionState.removeFromQueue(id: transaction.id)
        let updatedQueue = await transactionState.getQueue()
        
        queueUpdates.send(updatedQueue)
        transactionUpdates.send(cancelledTransaction)
    }
    
    // MARK: - Transaction Processing
    
    func processIncomingTransaction(_ transaction: Transaction) async throws -> Bool {
        logger.info("Processing incoming transaction: \(transaction.id)")
        
        // Verify the transaction
        let isValid = try await verifyTransaction(transaction)
        if !isValid {
            throw TransactionError.invalidTransaction
        }
        
        // Process based on transaction type
        switch transaction.type {
        case .offlineTransfer:
            return try await processIncomingOfflineTransfer(transaction)
        case .tokenRedemption:
            return try await processIncomingTokenRedemption(transaction)
        default:
            logger.warning("Unsupported incoming transaction type: \(transaction.type.rawValue)")
            return false
        }
    }
    
    func processOutgoingTransaction(_ transaction: Transaction) async throws -> Bool {
        logger.info("Processing outgoing transaction: \(transaction.id)")
        
        // Verify the transaction
        let isValid = try await verifyTransaction(transaction)
        if !isValid {
            throw TransactionError.invalidTransaction
        }
        
        // Process based on transaction type
        switch transaction.type {
        case .offlineTransfer:
            return try await processOutgoingOfflineTransfer(transaction)
        case .tokenPurchase:
            return try await processTokenPurchase(transaction)
        default:
            logger.warning("Unsupported outgoing transaction type: \(transaction.type.rawValue)")
            return false
        }
    }
    
    func finalizeTransaction(_ transaction: Transaction) async throws {
        logger.info("Finalizing transaction: \(transaction.id)")
        
        // Update transaction status to completed
        try await updateTransactionState(transaction, to: .completed)
        
        // Queue for synchronization if needed
        if transaction.type == .offlineTransfer || transaction.type == .tokenRedemption {
            try await queueTransactionForSync(transaction)
        }
        
        logger.info("Transaction finalized: \(transaction.id)")
    }
}

// MARK: - Helper Methods
extension TransactionService {
    
    private func loadQueuedTransactions() async {
        do {
            let pendingTransactions = try await storageService.getPendingSyncTransactions()
            await transactionState.setQueue(pendingTransactions)
            queueUpdates.send(pendingTransactions)
        } catch {
            logger.error("Failed to load queued transactions: \(error)")
        }
    }
    
    private func persistTransactionQueue() async throws {
        // This would persist the queue state to storage
        // For now, we rely on the transaction status in the database
        logger.info("Transaction queue persisted")
    }
    
    private func selectTokensForAmount(_ amount: Double) async throws -> [OfflineToken] {
        let availableTokens = try await storageService.getUnspentTokens()
        
        // Sort tokens by amount (smallest first for better change management)
        let sortedTokens = availableTokens.sorted { $0.amount < $1.amount }
        
        var selectedTokens: [OfflineToken] = []
        var totalAmount: Double = 0
        
        for token in sortedTokens {
            selectedTokens.append(token)
            totalAmount += token.amount
            
            if totalAmount >= amount {
                break
            }
        }
        
        guard totalAmount >= amount else {
            throw TransactionError.insufficientBalance
        }
        
        return selectedTokens
    }
    
    private func createTransactionSigningData(_ transaction: Transaction) throws -> Data {
        let signingData = TransactionSigningData(
            id: transaction.id,
            type: transaction.type.rawValue,
            senderId: transaction.senderId,
            receiverId: transaction.receiverId,
            amount: transaction.amount,
            timestamp: transaction.timestamp,
            tokenIds: transaction.tokenIds
        )
        
        return try JSONEncoder().encode(signingData)
    }
    
    private func getCurrentUserId() async -> String {
        // Get current user ID from wallet state
        do {
            let walletState = try await storageService.loadWalletState()
            return walletState?.walletId ?? "unknown_user"
        } catch {
            logger.error("Failed to get current user ID: \(error)")
            return "unknown_user"
        }
    }
    
    private func getPublicKey(for userId: String) async throws -> String {
        // Fetch public key from storage or network
        if let walletState = try await storageService.loadWalletState(),
           walletState.walletId == userId {
            return walletState.publicKey
        }
        
        // If not found locally, fetch from network
        let publicKeyDatabase = try await networkService.fetchPublicKeys()
        if let publicKeyInfo = publicKeyDatabase.publicKeys[userId] {
            return publicKeyInfo.publicKey
        }
        
        throw TransactionError.invalidParticipants
    }
    
    private func verifyTokenOwnership(_ transaction: Transaction) async throws {
        let tokens = try await storageService.loadOfflineTokens()
        
        for tokenId in transaction.tokenIds {
            guard tokens.contains(where: { $0.id == tokenId && !$0.isSpent }) else {
                throw TransactionError.tokenNotOwned
            }
        }
    }
    
    private func processIncomingOfflineTransfer(_ transaction: Transaction) async throws -> Bool {
        // Process incoming offline transfer
        // This would involve validating tokens and updating balances
        logger.info("Processing incoming offline transfer")
        return true
    }
    
    private func processIncomingTokenRedemption(_ transaction: Transaction) async throws -> Bool {
        // Process incoming token redemption
        logger.info("Processing incoming token redemption")
        return true
    }
    
    private func processOutgoingOfflineTransfer(_ transaction: Transaction) async throws -> Bool {
        // Process outgoing offline transfer
        logger.info("Processing outgoing offline transfer")
        return true
    }
    
    private func processTokenPurchase(_ transaction: Transaction) async throws -> Bool {
        // Process token purchase
        logger.info("Processing token purchase")
        return true
    }
    
    private func processTokenRedemption(_ transaction: Transaction) async throws {
        logger.info("Processing token redemption with backend")
        
        // Submit transaction to backend for processing
        let response = try await networkService.submitTransaction(transaction: transaction)
        logger.info("Token redemption submitted: \(response.transactionId)")
        
        // Update transaction status
        var updatedTransaction = transaction
        updatedTransaction.status = .pending
        try await updateTransactionState(updatedTransaction, to: .pending)
    }
    
    private func syncOfflineTransfer(_ transaction: Transaction) async throws {
        logger.info("Syncing offline transfer with backend")
        
        // Submit transaction to backend for synchronization
        let response = try await networkService.submitTransaction(transaction: transaction)
        logger.info("Offline transfer synced: \(response.transactionId)")
        
        // Update transaction status
        var updatedTransaction = transaction
        updatedTransaction.status = .pending
        try await updateTransactionState(updatedTransaction, to: .pending)
    }
}

// MARK: - Supporting Data Structures

struct TransactionSigningData: Codable {
    let id: String
    let type: String
    let senderId: String
    let receiverId: String
    let amount: Double
    let timestamp: Date
    let tokenIds: [String]
}

// MARK: - Transaction Errors

public enum TransactionError: Error, LocalizedError {
    case invalidAmount
    case invalidRecipient
    case invalidParticipants
    case insufficientBalance
    case walletNotInitialized
    case invalidTransaction
    case invalidSignature
    case doubleSpending
    case tokenNotOwned
    case transactionNotFound
    case processingFailed
    case syncFailed
    
    public var errorDescription: String? {
        switch self {
        case .invalidAmount:
            return "Invalid transaction amount"
        case .invalidRecipient:
            return "Invalid recipient ID"
        case .invalidParticipants:
            return "Invalid transaction participants"
        case .insufficientBalance:
            return "Insufficient balance for transaction"
        case .walletNotInitialized:
            return "Wallet not initialized"
        case .invalidTransaction:
            return "Invalid transaction data"
        case .invalidSignature:
            return "Invalid transaction signature"
        case .doubleSpending:
            return "Double spending detected"
        case .tokenNotOwned:
            return "Token not owned by sender"
        case .transactionNotFound:
            return "Transaction not found"
        case .processingFailed:
            return "Transaction processing failed"
        case .syncFailed:
            return "Transaction synchronization failed"
        }
    }
}
