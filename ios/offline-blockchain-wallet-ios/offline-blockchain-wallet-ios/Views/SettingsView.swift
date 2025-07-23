//
//  SettingsView.swift
//  offline-blockchain-wallet-ios
//
//  Created by Kiro on 7/21/25.
//

import SwiftUI

struct SettingsView: View {
    @ObservedObject var walletViewModel: WalletViewModel
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationView {
            Form {
                // Auto-recharge Settings
                Section("Auto-recharge Settings") {
                    Toggle("Enable Auto-recharge", isOn: $walletViewModel.autoRechargeEnabled)
                    
                    if walletViewModel.autoRechargeEnabled {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Recharge Threshold")
                            TextField("Threshold", value: $walletViewModel.autoRechargeThreshold, format: .number)
                                .textFieldStyle(RoundedBorderTextFieldStyle())
                        }
                        
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Recharge Amount")
                            TextField("Amount", value: $walletViewModel.autoRechargeAmount, format: .number)
                                .textFieldStyle(RoundedBorderTextFieldStyle())
                        }
                    }
                }
                
                // Wallet Information
                Section("Wallet Information") {
                    if let lastSync = walletViewModel.lastSyncTimestamp {
                        HStack {
                            Text("Last Sync")
                            Spacer()
                            Text(lastSync, style: .relative)
                                .foregroundColor(.secondary)
                        }
                    }
                    
                    HStack {
                        Text("Offline Balance")
                        Spacer()
                        Text(String(format: "%.2f", walletViewModel.offlineBalance))
                            .foregroundColor(.secondary)
                    }
                    
                    HStack {
                        Text("Blockchain Balance")
                        Spacer()
                        Text(String(format: "%.2f", walletViewModel.blockchainBalance))
                            .foregroundColor(.secondary)
                    }
                }
                
                // Actions
                Section("Actions") {
                    Button("Refresh Balances") {
                        Task {
                            await walletViewModel.refreshBalances()
                        }
                    }
                    .disabled(walletViewModel.isLoading)
                    
                    Button("Purchase Offline Tokens") {
                        Task {
                            await walletViewModel.purchaseOfflineTokens(amount: walletViewModel.autoRechargeAmount)
                        }
                    }
                    .disabled(walletViewModel.isLoading)
                }
                
                // Debug Information (Development only)
                #if DEBUG
                Section("Debug") {
                    Button("Clear All Data") {
                        // Implementation will be added later
                    }
                    .foregroundColor(.red)
                }
                #endif
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }
}
//
//#Preview {
//    SettingsView(walletViewModel: WalletViewModel())
//}
