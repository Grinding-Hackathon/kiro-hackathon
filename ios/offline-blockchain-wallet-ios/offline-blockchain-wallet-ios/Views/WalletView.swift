//
//  WalletView.swift
//  offline-blockchain-wallet-ios
//
//  Created by Kiro on 7/21/25.
//

import SwiftUI

struct WalletView: View {
    @StateObject private var walletViewModel: WalletViewModel
    @State private var showingSettings = false
    @State private var showingTransactionView = false
    
    init(viewModel: WalletViewModel) {
        self._walletViewModel = StateObject(wrappedValue: viewModel)
    }
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 20) {
                    // Balance Cards
                    balanceSection
                    
                    // Quick Actions
                    quickActionsSection
                    
                    // Recent Transactions Preview
                    recentTransactionsSection
                    
                    Spacer()
                }
                .padding()
            }
            .navigationTitle("Wallet")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Settings") {
                        showingSettings = true
                    }
                }
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Refresh") {
                        Task {
                            await walletViewModel.refreshBalances()
                        }
                    }
                    .disabled(walletViewModel.isLoading)
                }
            }
            .sheet(isPresented: $showingSettings) {
                SettingsView(walletViewModel: walletViewModel)
            }
            .sheet(isPresented: $showingTransactionView) {
                TransactionView(viewModel: DependencyContainer.shared.createTransactionViewModel())
            }
            .alert("Error", isPresented: .constant(walletViewModel.errorMessage != nil)) {
                Button("OK") {
                    walletViewModel.errorMessage = nil
                }
            } message: {
                Text(walletViewModel.errorMessage ?? "")
            }
        }
        .task {
            await walletViewModel.refreshBalances()
        }
    }
    
    private var balanceSection: some View {
        VStack(spacing: 16) {
            // Offline Balance Card
            BalanceCard(
                title: "Offline Tokens",
                balance: walletViewModel.offlineBalance,
                subtitle: "Available for offline transactions",
                color: .blue,
                isLoading: walletViewModel.isLoading
            )
            
            // Blockchain Balance Card
            BalanceCard(
                title: "Blockchain Balance",
                balance: walletViewModel.blockchainBalance,
                subtitle: "On-chain cryptocurrency",
                color: .green,
                isLoading: walletViewModel.isLoading
            )
        }
    }
    
    private var quickActionsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Quick Actions")
                .font(.headline)
                .padding(.horizontal)
            
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 12) {
                ActionButton(
                    title: "Send",
                    icon: "arrow.up.circle.fill",
                    color: .orange
                ) {
                    showingTransactionView = true
                }
                
                ActionButton(
                    title: "Receive",
                    icon: "arrow.down.circle.fill",
                    color: .green
                ) {
                    // Navigate to receive view
                }
                
                ActionButton(
                    title: "Buy Tokens",
                    icon: "plus.circle.fill",
                    color: .blue
                ) {
                    Task {
                        await walletViewModel.purchaseOfflineTokens(amount: walletViewModel.autoRechargeAmount)
                    }
                }
                
                ActionButton(
                    title: "Scan QR",
                    icon: "qrcode.viewfinder",
                    color: .purple
                ) {
                    // Navigate to QR scanner
                }
            }
            .padding(.horizontal)
        }
    }
    
    private var recentTransactionsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Recent Transactions")
                    .font(.headline)
                
                Spacer()
                
                Button("View All") {
                    showingTransactionView = true
                }
                .font(.caption)
                .foregroundColor(.blue)
            }
            .padding(.horizontal)
            
            // Placeholder for recent transactions
            VStack {
                Text("No recent transactions")
                    .foregroundColor(.secondary)
                    .padding()
            }
            .frame(maxWidth: .infinity)
            .background(Color(.systemGray6))
            .cornerRadius(12)
            .padding(.horizontal)
        }
    }
}

struct BalanceCard: View {
    let title: String
    let balance: Double
    let subtitle: String
    let color: Color
    let isLoading: Bool
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(title)
                    .font(.headline)
                    .foregroundColor(color)
                
                Spacer()
                
                if isLoading {
                    ProgressView()
                        .scaleEffect(0.8)
                }
            }
            
            Text(String(format: "%.2f", balance))
                .font(.largeTitle)
                .fontWeight(.bold)
            
            Text(subtitle)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.1), radius: 4, x: 0, y: 2)
    }
}

struct ActionButton: View {
    let title: String
    let icon: String
    let color: Color
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.title2)
                    .foregroundColor(color)
                
                Text(title)
                    .font(.caption)
                    .fontWeight(.medium)
            }
            .frame(maxWidth: .infinity)
            .padding()
            .background(Color(.systemGray6))
            .cornerRadius(12)
        }
        .buttonStyle(PlainButtonStyle())
    }
}

#Preview {
    WalletView(viewModel: DependencyContainer.shared.createWalletViewModel())
}