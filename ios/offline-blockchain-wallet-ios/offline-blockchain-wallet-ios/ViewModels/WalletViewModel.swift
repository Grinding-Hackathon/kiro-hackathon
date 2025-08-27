//
//  WalletViewModel.swift
//  offline-blockchain-wallet-ios
//
//  Created by Kiro on 7/21/25.
//

import Foundation
import SwiftUI
import Combine

enum WalletViewModelError: Error, LocalizedError {
    case walletNotInitialized
    case insufficientBalance
    case networkError
    
    var errorDescription: String? {
        switch self {
        case .walletNotInitialized:
            return "Wallet not initialized"
        case .insufficientBalance:
            return "Insufficient balance"
        case .networkError:
            return "Network connection error"
        }
    }
}

@MainActor
class WalletViewModel: ObservableObject {
    @Published var offlineBalance: Double = 0.0
    @Published var blockchainBalance: Double = 0.0
    @Published var isLoading: Bool = false
    @Published var errorMessage: String?
    @Published var lastSyncTimestamp: Date?
    @Published var autoRechargeEnabled: Bool = false
    @Published var autoRechargeThreshold: Double = 50.0
    @Published var autoRechargeAmount: Double = 200.0
    
    private var cancellables = Set<AnyCancellable>()
    
    // Injected services
    private let offlineTokenService: OfflineTokenServiceProtocol
    private let networkService: NetworkServiceProtocol
    private let storageService: StorageServiceProtocol
    
    init(offlineTokenService: OfflineTokenServiceProtocol,
         networkService: NetworkServiceProtocol,
         storageService: StorageServiceProtocol) {
        self.offlineTokenService = offlineTokenService
        self.networkService = networkService
        self.storageService = storageService
        setupBindings()
    }
    
    private func setupBindings() {
        // Setup reactive bindings for auto-recharge monitoring
        $offlineBalance
            .sink { [weak self] balance in
                self?.checkAutoRecharge(balance: balance)
            }
            .store(in: &cancellables)
    }
    
    func refreshBalances() async {
        isLoading = true
        errorMessage = nil
        
        do {
            // Load offline balance from local storage
            await loadOfflineBalance()
            
            // Sync with blockchain if online
            await syncBlockchainBalance()
            
            lastSyncTimestamp = Date()
        } catch {
            errorMessage = error.localizedDescription
        }
        
        isLoading = false
    }
    
    private func loadOfflineBalance() async {
        do {
            offlineBalance = await offlineTokenService.getAvailableBalance()
        } catch {
            errorMessage = "Failed to load offline balance: \(error.localizedDescription)"
        }
    }
    
    private func syncBlockchainBalance() async {
        do {
            // Get wallet state to get wallet ID
            guard let walletState = try await storageService.loadWalletState() else {
                throw WalletViewModelError.walletNotInitialized
            }
            
            // Fetch balance from backend
            let balanceResponse = try await networkService.getWalletBalance(walletId: walletState.walletId)
            blockchainBalance = balanceResponse.blockchainBalance
            
        } catch {
            // Don't show error for network issues during sync
            if networkService.isOnline() {
                errorMessage = "Failed to sync blockchain balance: \(error.localizedDescription)"
            }
        }
    }
    
    private func checkAutoRecharge(balance: Double) {
        guard autoRechargeEnabled && balance < autoRechargeThreshold else { return }
        
        Task {
            await purchaseOfflineTokens(amount: autoRechargeAmount)
        }
    }
    
    func purchaseOfflineTokens(amount: Double) async {
        isLoading = true
        errorMessage = nil
        
        do {
            let tokens = try await offlineTokenService.purchaseTokens(amount: amount)
            
            // Update offline balance
            await loadOfflineBalance()
            
            // Show success message
            print("Successfully purchased \(tokens.count) offline tokens worth \(amount)")
            
        } catch {
            errorMessage = error.localizedDescription
        }
        
        isLoading = false
    }
    
    func toggleAutoRecharge() {
        autoRechargeEnabled.toggle()
    }
    
    func updateAutoRechargeSettings(threshold: Double, amount: Double) {
        autoRechargeThreshold = threshold
        autoRechargeAmount = amount
    }
}

