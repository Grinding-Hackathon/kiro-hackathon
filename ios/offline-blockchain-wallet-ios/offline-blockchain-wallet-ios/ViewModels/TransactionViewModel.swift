//
//  TransactionViewModel.swift
//  offline-blockchain-wallet-ios
//
//  Created by Kiro on 7/21/25.
//

import Foundation
import SwiftUI
import Combine

@MainActor
class TransactionViewModel: ObservableObject {
    @Published var transactions: [Transaction] = []
    @Published var queuedTransactions: [Transaction] = []
    @Published var isLoading: Bool = false
    @Published var errorMessage: String?
    @Published var selectedTransaction: Transaction?
    @Published var isProcessingTransaction: Bool = false
    
    // Transaction creation properties
    @Published var recipientId: String = ""
    @Published var amount: String = ""
    @Published var transactionType: TransactionType = .offlineTransfer
    
    private var cancellables = Set<AnyCancellable>()
    
    // Injected services
    private let transactionService: TransactionServiceProtocol
    private let storageService: StorageServiceProtocol
    private let bluetoothService: BluetoothServiceProtocol
    private let cryptographyService: CryptographyServiceProtocol
    
    init(transactionService: TransactionServiceProtocol,
         storageService: StorageServiceProtocol,
         bluetoothService: BluetoothServiceProtocol,
         cryptographyService: CryptographyServiceProtocol) {
        self.transactionService = transactionService
        self.storageService = storageService
        self.bluetoothService = bluetoothService
        self.cryptographyService = cryptographyService
        
        setupSubscriptions()
        loadTransactions()
    }
    
    private func setupSubscriptions() {
        // Subscribe to transaction updates
        transactionService.transactionUpdates
            .receive(on: DispatchQueue.main)
            .sink { [weak self] updatedTransaction in
                self?.handleTransactionUpdate(updatedTransaction)
            }
            .store(in: &cancellables)
        
        // Subscribe to queue updates
        transactionService.queueUpdates
            .receive(on: DispatchQueue.main)
            .sink { [weak self] queuedTransactions in
                self?.queuedTransactions = queuedTransactions
            }
            .store(in: &cancellables)
    }
    
    func loadTransactions() {
        Task {
            await refreshTransactions()
        }
    }
    
    func refreshTransactions() async {
        isLoading = true
        errorMessage = nil
        
        do {
            transactions = try await storageService.loadTransactions()
            queuedTransactions = try await transactionService.getQueuedTransactions()
        } catch {
            errorMessage = error.localizedDescription
        }
        
        isLoading = false
    }
    
    func initiateTransaction() async {
        guard let amountValue = Double(amount), amountValue > 0 else {
            errorMessage = "Please enter a valid amount"
            return
        }
        
        guard !recipientId.isEmpty else {
            errorMessage = "Please enter recipient ID"
            return
        }
        
        isProcessingTransaction = true
        errorMessage = nil
        
        do {
            let transaction = try await transactionService.initiateTransaction(
                recipientId: recipientId,
                amount: amountValue,
                type: transactionType
            )
            
            // Sign the transaction if it's an offline transfer
            if transactionType == .offlineTransfer {
                let privateKey = try await getUserPrivateKey()
                _ = try await transactionService.signTransaction(transaction, with: privateKey)
            }
            
            // Clear form
            clearForm()
            
            // Refresh transactions
            await refreshTransactions()
            
        } catch {
            errorMessage = error.localizedDescription
        }
        
        isProcessingTransaction = false
    }
    
    func clearForm() {
        recipientId = ""
        amount = ""
        transactionType = .offlineTransfer
    }
    
    func selectTransaction(_ transaction: Transaction) {
        selectedTransaction = transaction
    }
    
    func getFilteredTransactions(by type: TransactionType?) -> [Transaction] {
        guard let type = type else { return transactions }
        return transactions.filter { $0.type == type }
    }
    
    func getPendingTransactions() -> [Transaction] {
        return transactions.filter { $0.status == .pending }
    }
    
    func getCompletedTransactions() -> [Transaction] {
        return transactions.filter { $0.status == .completed }
    }
    
    // MARK: - Transaction Processing
    
    func processIncomingTransaction(_ transaction: Transaction) async {
        isProcessingTransaction = true
        errorMessage = nil
        
        do {
            let success = try await transactionService.processIncomingTransaction(transaction)
            if success {
                try await transactionService.finalizeTransaction(transaction)
                await refreshTransactions()
            } else {
                errorMessage = "Failed to process incoming transaction"
            }
        } catch {
            errorMessage = error.localizedDescription
            try? await transactionService.handleFailedTransaction(transaction, error: error)
        }
        
        isProcessingTransaction = false
    }
    
    func retryTransaction(_ transaction: Transaction) async {
        isProcessingTransaction = true
        errorMessage = nil
        
        do {
            let retriedTransaction = try await transactionService.retryFailedTransaction(transaction)
            
            // Process the retried transaction based on its type
            if retriedTransaction.type == .offlineTransfer {
                let success = try await transactionService.processOutgoingTransaction(retriedTransaction)
                if success {
                    try await transactionService.finalizeTransaction(retriedTransaction)
                }
            }
            
            await refreshTransactions()
        } catch {
            errorMessage = error.localizedDescription
        }
        
        isProcessingTransaction = false
    }
    
    func cancelTransaction(_ transaction: Transaction) async {
        do {
            try await transactionService.cancelTransaction(transaction)
            await refreshTransactions()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
    
    func syncQueuedTransactions() async {
        isLoading = true
        errorMessage = nil
        
        do {
            try await transactionService.processQueuedTransactions()
            await refreshTransactions()
        } catch {
            errorMessage = "Failed to sync transactions: \(error.localizedDescription)"
        }
        
        isLoading = false
    }
    
    // MARK: - Transaction Verification
    
    func verifyTransaction(_ transaction: Transaction) async -> Bool {
        do {
            return try await transactionService.verifyTransaction(transaction)
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }
    
    // MARK: - Helper Methods
    
    private func handleTransactionUpdate(_ transaction: Transaction) {
        // Update the transaction in the local array
        if let index = transactions.firstIndex(where: { $0.id == transaction.id }) {
            transactions[index] = transaction
        } else {
            transactions.append(transaction)
        }
        
        // Sort transactions by timestamp (newest first)
        transactions.sort { $0.timestamp > $1.timestamp }
    }
    
    private func getUserPrivateKey() async throws -> String {
        // This would retrieve the user's private key from secure storage
        // For now, return a placeholder
        guard let privateKey = try cryptographyService.retrievePrivateKey(for: "user_signing_key") else {
            throw TransactionError.walletNotInitialized
        }
        return privateKey
    }
    
    // MARK: - Transaction State Queries
    
    func getTransactionsByType(_ type: TransactionType) -> [Transaction] {
        return transactions.filter { $0.type == type }
    }
    
    func getTransactionsByStatus(_ status: TransactionStatus) -> [Transaction] {
        return transactions.filter { $0.status == status }
    }
    
    func getOfflineTransactions() -> [Transaction] {
        return transactions.filter { $0.type == .offlineTransfer }
    }
    
    func getOnlineTransactions() -> [Transaction] {
        return transactions.filter { $0.type == .onlineTransfer || $0.type == .tokenPurchase || $0.type == .tokenRedemption }
    }
    
    func hasFailedTransactions() -> Bool {
        return transactions.contains { $0.status == .failed }
    }
    
    func hasPendingTransactions() -> Bool {
        return transactions.contains { $0.status == .pending }
    }
    
    func getFailedTransactions() -> [Transaction] {
        return transactions.filter { $0.status == .failed }
    }
}