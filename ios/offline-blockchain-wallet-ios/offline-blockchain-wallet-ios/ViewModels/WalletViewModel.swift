//
//  WalletViewModel.swift
//  offline-blockchain-wallet-ios
//
//  Created by Kiro on 7/21/25.
//

import Foundation
import SwiftUI
import Combine

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
        // Implementation will be added when storage service is available
        // For now, placeholder implementation
    }
    
    private func syncBlockchainBalance() async {
        // Implementation will be added when network service is available
        // For now, placeholder implementation
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
            // Implementation will be added when offline token service is available
            // For now, placeholder implementation
            print("Purchasing offline tokens: \(amount)")
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

