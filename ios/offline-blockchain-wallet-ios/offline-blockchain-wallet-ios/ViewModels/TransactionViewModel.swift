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
    @Published var isLoading: Bool = false
    @Published var errorMessage: String?
    @Published var selectedTransaction: Transaction?
    
    // Transaction creation properties
    @Published var recipientId: String = ""
    @Published var amount: String = ""
    @Published var transactionType: TransactionType = .offlineTransfer
    
    private var cancellables = Set<AnyCancellable>()
    
    // Injected services
    private let storageService: StorageServiceProtocol
    private let bluetoothService: BluetoothServiceProtocol
    private let cryptographyService: CryptographyServiceProtocol
    
    init(storageService: StorageServiceProtocol,
         bluetoothService: BluetoothServiceProtocol,
         cryptographyService: CryptographyServiceProtocol) {
        self.storageService = storageService
        self.bluetoothService = bluetoothService
        self.cryptographyService = cryptographyService
        loadTransactions()
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
            // Implementation will be added when storage service is available
            // For now, load mock data
            await loadMockTransactions()
        } catch {
            errorMessage = error.localizedDescription
        }
        
        isLoading = false
    }
    
    private func loadMockTransactions() async {
        // Mock data for development
        transactions = [
            Transaction(
                type: .offlineTransfer,
                senderId: "user1",
                receiverId: "user2",
                amount: 25.50,
                status: .completed,
                tokenIds: ["token1"],
                metadata: TransactionMetadata(
                    connectionType: "bluetooth",
                    deviceInfo: "iPhone 15 Pro"
                )
            ),
            Transaction(
                type: .tokenPurchase,
                senderId: "user1",
                receiverId: "otm",
                amount: 100.00,
                status: .completed,
                tokenIds: ["token2", "token3"]
            )
        ]
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
        
        isLoading = true
        errorMessage = nil
        
        do {
            let transaction = Transaction(
                type: transactionType,
                senderId: "current_user", // Will be replaced with actual user ID
                receiverId: recipientId,
                amount: amountValue,
                tokenIds: [] // Will be populated by transaction service
            )
            
            // Implementation will be added when transaction service is available
            print("Initiating transaction: \(transaction)")
            
            // Clear form
            clearForm()
            
            // Refresh transactions
            await refreshTransactions()
            
        } catch {
            errorMessage = error.localizedDescription
        }
        
        isLoading = false
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
}

// MARK: - Service Protocol
protocol TransactionServiceProtocol {
    func initiateTransaction(recipientId: String, amount: Double) async throws -> Transaction
    func processIncomingTransaction(transaction: Transaction) async throws -> Bool
    func syncWithBlockchain() async throws
}