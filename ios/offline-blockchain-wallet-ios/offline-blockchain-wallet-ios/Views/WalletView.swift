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
    @State private var showingQRScanner = false
    @State private var showingReceiveView = false
    
    init(viewModel: WalletViewModel) {
        self._walletViewModel = StateObject(wrappedValue: viewModel)
    }
    
    var body: some View {
        NavigationView {
            ZStack {
                if walletViewModel.isLoading && walletViewModel.offlineBalance == 0 && walletViewModel.blockchainBalance == 0 {
                    // Full screen loading state for initial load
                    LoadingView(message: "Loading wallet...")
                } else {
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
                    .refreshable {
                        await walletViewModel.refreshBalances()
                    }
                }
            }
            .navigationTitle("Wallet")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: {
                        showingSettings = true
                    }) {
                        Image(systemName: "gear")
                    }
                }
                ToolbarItem(placement: .navigationBarLeading) {
                    Button(action: {
                        Task {
                            await walletViewModel.refreshBalances()
                        }
                    }) {
                        Image(systemName: "arrow.clockwise")
                    }
                    .disabled(walletViewModel.isLoading)
                }
            }
            .sheet(isPresented: $showingSettings) {
                SettingsSheetView(walletViewModel: walletViewModel)
            }
            .sheet(isPresented: $showingTransactionView) {
                TransactionView(viewModel: DependencyContainer.shared.createTransactionViewModel())
            }
            .sheet(isPresented: $showingQRScanner) {
                QRScannerView(
                    onScanComplete: { paymentRequest in
                        // Handle QR scan result
                        handleQRScanResult(paymentRequest)
                    },
                    onError: { error in
                        walletViewModel.errorMessage = error.localizedDescription
                    }
                )
            }
            .sheet(isPresented: $showingReceiveView) {
                ReceiveView()
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
            // Total Balance Header with enhanced display
            VStack(spacing: 8) {
                HStack {
                    Text("Total Balance")
                        .font(.headline)
                        .foregroundColor(.secondary)
                    
                    Spacer()
                    
                    // Connection status indicator
                    ConnectionStatusIndicator()
                }
                
                HStack {
                    if walletViewModel.isLoading && walletViewModel.offlineBalance == 0 && walletViewModel.blockchainBalance == 0 {
                        ProgressView()
                            .scaleEffect(0.8)
                        Text("Loading...")
                            .font(.system(size: 36, weight: .bold, design: .rounded))
                            .foregroundColor(.secondary)
                    } else {
                        Text(String(format: "%.2f", walletViewModel.offlineBalance + walletViewModel.blockchainBalance))
                            .font(.system(size: 36, weight: .bold, design: .rounded))
                            .foregroundColor(.primary)
                            .contentTransition(.numericText())
                    }
                }
                
                // Enhanced sync status
                HStack(spacing: 4) {
                    if walletViewModel.isLoading {
                        ProgressView()
                            .scaleEffect(0.6)
                        Text("Syncing...")
                            .font(.caption)
                            .foregroundColor(.blue)
                    } else if let lastSync = walletViewModel.lastSyncTimestamp {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(.green)
                            .font(.caption)
                        Text("Updated \(lastSync, style: .relative)")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    } else {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundColor(.orange)
                            .font(.caption)
                        Text("Never synced")
                            .font(.caption)
                            .foregroundColor(.orange)
                    }
                }
            }
            .padding(.bottom, 8)
            
            // Enhanced Balance Cards with better visual hierarchy
            HStack(spacing: 12) {
                // Offline Balance Card with enhanced features
                EnhancedBalanceCard(
                    title: "Offline Tokens",
                    balance: walletViewModel.offlineBalance,
                    subtitle: "Available offline",
                    color: .blue,
                    icon: "wifi.slash",
                    isLoading: walletViewModel.isLoading,
                    showPercentage: true,
                    totalBalance: walletViewModel.offlineBalance + walletViewModel.blockchainBalance,
                    isConnected: false
                )
                
                // Blockchain Balance Card with enhanced features
                EnhancedBalanceCard(
                    title: "Blockchain",
                    balance: walletViewModel.blockchainBalance,
                    subtitle: "On-chain funds",
                    color: .green,
                    icon: "link",
                    isLoading: walletViewModel.isLoading,
                    showPercentage: true,
                    totalBalance: walletViewModel.offlineBalance + walletViewModel.blockchainBalance,
                    isConnected: true
                )
            }
            
            // Balance distribution visualization
            if walletViewModel.offlineBalance + walletViewModel.blockchainBalance > 0 {
                BalanceDistributionView(
                    offlineBalance: walletViewModel.offlineBalance,
                    blockchainBalance: walletViewModel.blockchainBalance
                )
            }
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
                    showingReceiveView = true
                }
                
                ActionButton(
                    title: "Buy Tokens",
                    icon: "plus.circle.fill",
                    color: .blue,
                    isLoading: walletViewModel.isLoading
                ) {
                    purchaseTokens()
                }
                
                ActionButton(
                    title: "Scan QR",
                    icon: "qrcode.viewfinder",
                    color: .purple
                ) {
                    showingQRScanner = true
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
            .background(Color.adaptiveSecondaryBackground)
            .cornerRadius(12)
            .padding(.horizontal)
        }
    }
    
    // MARK: - Helper Methods
    
    private func handleQRScanResult(_ paymentRequest: QRCodePaymentRequest) {
        // Pre-populate transaction view with scanned data
        showingTransactionView = true
        // Note: In a real implementation, we would pass the payment request data
        // to the transaction view to pre-populate the recipient and amount fields
    }
    
    private func purchaseTokens() {
        Task {
            do {
                await walletViewModel.purchaseOfflineTokens(amount: walletViewModel.autoRechargeAmount)
                // Refresh balances after purchase
                await walletViewModel.refreshBalances()
            } catch {
                walletViewModel.errorMessage = "Failed to purchase tokens: \(error.localizedDescription)"
            }
        }
    }
}

struct BalanceCard: View {
    let title: String
    let balance: Double
    let subtitle: String
    let color: Color
    let isLoading: Bool
    let showPercentage: Bool
    let totalBalance: Double
    
    init(title: String, balance: Double, subtitle: String, color: Color, isLoading: Bool, showPercentage: Bool = false, totalBalance: Double = 0) {
        self.title = title
        self.balance = balance
        self.subtitle = subtitle
        self.color = color
        self.isLoading = isLoading
        self.showPercentage = showPercentage
        self.totalBalance = totalBalance
    }
    
    private var percentage: Double {
        guard totalBalance > 0 else { return 0 }
        return (balance / totalBalance) * 100
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .foregroundColor(color)
                    
                    if showPercentage && totalBalance > 0 {
                        Text("\(Int(percentage))%")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                }
                
                Spacer()
                
                if isLoading {
                    ProgressView()
                        .scaleEffect(0.7)
                }
            }
            
            Text(String(format: "%.2f", balance))
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(.primary)
            
            Text(subtitle)
                .font(.caption)
                .foregroundColor(.secondary)
                .lineLimit(2)
            
            // Progress bar for percentage
            if showPercentage && totalBalance > 0 {
                GeometryReader { geometry in
                    ZStack(alignment: .leading) {
                        Rectangle()
                            .fill(Color.gray.opacity(0.2))
                            .frame(height: 4)
                            .cornerRadius(2)
                        
                        Rectangle()
                            .fill(color)
                            .frame(width: geometry.size.width * (percentage / 100), height: 4)
                            .cornerRadius(2)
                    }
                }
                .frame(height: 4)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.adaptiveCardBackground)
        .cornerRadius(12)
        .shadow(color: Color.black.opacity(0.1), radius: 4, x: 0, y: 2)
    }
}

struct ActionButton: View {
    let title: String
    let icon: String
    let color: Color
    let isLoading: Bool
    let action: () -> Void
    
    init(title: String, icon: String, color: Color, isLoading: Bool = false, action: @escaping () -> Void) {
        self.title = title
        self.icon = icon
        self.color = color
        self.isLoading = isLoading
        self.action = action
    }
    
    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                if isLoading {
                    ProgressView()
                        .scaleEffect(0.8)
                        .frame(height: 24)
                } else {
                    Image(systemName: icon)
                        .font(.title2)
                        .foregroundColor(color)
                }
                
                Text(title)
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundColor(isLoading ? .secondary : .primary)
            }
            .frame(maxWidth: .infinity)
            .padding()
            .background(Color.adaptiveSecondaryBackground)
            .cornerRadius(12)
            .opacity(isLoading ? 0.6 : 1.0)
        }
        .buttonStyle(PlainButtonStyle())
        .disabled(isLoading)
    }
}

// MARK: - Supporting Views

struct LoadingView: View {
    let message: String
    
    var body: some View {
        VStack(spacing: 20) {
            ProgressView()
                .scaleEffect(1.5)
            
            Text(message)
                .font(.headline)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.adaptiveBackground)
    }
}

struct ConnectionStatusIndicator: View {
    @State private var isOnline = true // This would be connected to actual network status
    
    var body: some View {
        HStack(spacing: 4) {
            Circle()
                .fill(isOnline ? Color.green : Color.red)
                .frame(width: 8, height: 8)
            
            Text(isOnline ? "Online" : "Offline")
                .font(.caption2)
                .fontWeight(.medium)
                .foregroundColor(isOnline ? .green : .red)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill((isOnline ? Color.green : Color.red).opacity(0.1))
        )
    }
}

struct EnhancedBalanceCard: View {
    let title: String
    let balance: Double
    let subtitle: String
    let color: Color
    let icon: String
    let isLoading: Bool
    let showPercentage: Bool
    let totalBalance: Double
    let isConnected: Bool
    
    private var percentage: Double {
        guard totalBalance > 0 else { return 0 }
        return (balance / totalBalance) * 100
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header with icon and connection status
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 6) {
                        Image(systemName: icon)
                            .font(.caption)
                            .foregroundColor(color)
                        
                        Text(title)
                            .font(.subheadline)
                            .fontWeight(.medium)
                            .foregroundColor(color)
                    }
                    
                    if showPercentage && totalBalance > 0 {
                        Text("\(Int(percentage))% of total")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                }
                
                Spacer()
                
                // Loading or connection indicator
                if isLoading {
                    ProgressView()
                        .scaleEffect(0.7)
                } else {
                    Image(systemName: isConnected ? "checkmark.circle.fill" : "wifi.slash")
                        .font(.caption)
                        .foregroundColor(isConnected ? .green : .orange)
                }
            }
            
            // Balance display with animation
            HStack {
                if isLoading && balance == 0 {
                    ProgressView()
                        .scaleEffect(0.8)
                    Text("--")
                        .font(.title2)
                        .fontWeight(.bold)
                        .foregroundColor(.secondary)
                } else {
                    Text(String(format: "%.2f", balance))
                        .font(.title2)
                        .fontWeight(.bold)
                        .foregroundColor(.primary)
                        .contentTransition(.numericText())
                }
                
                Spacer()
            }
            
            // Subtitle with additional info
            VStack(alignment: .leading, spacing: 4) {
                Text(subtitle)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(2)
                
                // Additional status info
                if !isConnected && balance > 0 {
                    Text("Ready for offline use")
                        .font(.caption2)
                        .foregroundColor(.blue)
                        .fontWeight(.medium)
                } else if isConnected && balance > 0 {
                    Text("Requires internet")
                        .font(.caption2)
                        .foregroundColor(.green)
                        .fontWeight(.medium)
                }
            }
            
            // Enhanced progress bar
            if showPercentage && totalBalance > 0 {
                GeometryReader { geometry in
                    ZStack(alignment: .leading) {
                        Rectangle()
                            .fill(Color.gray.opacity(0.2))
                            .frame(height: 6)
                            .cornerRadius(3)
                        
                        Rectangle()
                            .fill(
                                LinearGradient(
                                    colors: [color.opacity(0.7), color],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .frame(width: geometry.size.width * (percentage / 100), height: 6)
                            .cornerRadius(3)
                            .animation(.easeInOut(duration: 0.5), value: percentage)
                    }
                }
                .frame(height: 6)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.adaptiveCardBackground)
                .shadow(color: Color.black.opacity(0.08), radius: 8, x: 0, y: 4)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(color.opacity(0.2), lineWidth: 1)
        )
    }
}

struct BalanceDistributionView: View {
    let offlineBalance: Double
    let blockchainBalance: Double
    
    private var totalBalance: Double {
        offlineBalance + blockchainBalance
    }
    
    private var offlinePercentage: Double {
        guard totalBalance > 0 else { return 0 }
        return (offlineBalance / totalBalance) * 100
    }
    
    private var blockchainPercentage: Double {
        guard totalBalance > 0 else { return 0 }
        return (blockchainBalance / totalBalance) * 100
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Balance Distribution")
                .font(.caption)
                .fontWeight(.medium)
                .foregroundColor(.secondary)
            
            // Distribution bar
            GeometryReader { geometry in
                HStack(spacing: 0) {
                    Rectangle()
                        .fill(Color.blue)
                        .frame(width: geometry.size.width * (offlinePercentage / 100))
                    
                    Rectangle()
                        .fill(Color.green)
                        .frame(width: geometry.size.width * (blockchainPercentage / 100))
                }
                .cornerRadius(4)
                .animation(.easeInOut(duration: 0.5), value: offlinePercentage)
            }
            .frame(height: 8)
            
            // Legend
            HStack(spacing: 16) {
                HStack(spacing: 4) {
                    Circle()
                        .fill(Color.blue)
                        .frame(width: 8, height: 8)
                    Text("Offline (\(Int(offlinePercentage))%)")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
                
                HStack(spacing: 4) {
                    Circle()
                        .fill(Color.green)
                        .frame(width: 8, height: 8)
                    Text("Blockchain (\(Int(blockchainPercentage))%)")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
            }
        }
        .padding(.horizontal)
    }
}

struct ReceiveView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var showingQRCode = false
    @State private var requestAmount: String = ""
    
    var body: some View {
        VStack(spacing: 0) {
            // Custom header
            HStack {
                Spacer()
                
                Text("Receive")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                Spacer()
                
                Button("Done") {
                    dismiss()
                }
                .fontWeight(.medium)
            }
            .padding()
            .background(Color(.systemBackground))
            
            // Main content
            VStack(spacing: 24) {
                Text("Receive Payment")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                    .padding(.top)
                
                VStack(spacing: 16) {
                    Text("Enter amount (optional)")
                        .font(.headline)
                    
                    TextField("0.00", text: $requestAmount)
                        .textFieldStyle(RoundedBorderTextFieldStyle())
                        .keyboardType(.decimalPad)
                        .font(.title2)
                        .multilineTextAlignment(.center)
                }
                .padding(.horizontal)
                
                Button(action: {
                    showingQRCode = true
                }) {
                    HStack {
                        Image(systemName: "qrcode")
                        Text("Generate QR Code")
                            .fontWeight(.semibold)
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.blue)
                    .foregroundColor(.white)
                    .cornerRadius(12)
                }
                .padding(.horizontal)
                
                Spacer()
            }
            .sheet(isPresented: $showingQRCode) {
                QRCodeDisplayView(
                    walletId: "current-wallet-id", // This would come from wallet state
                    publicKey: "current-public-key",
                    deviceName: "iPhone",
                    paymentInfo: Double(requestAmount) != nil && Double(requestAmount)! > 0 ? 
                        PaymentRequestInfo(requestedAmount: Double(requestAmount)) : nil,
                    onBluetoothConnectionRequested: { request in
                        // Handle Bluetooth connection request
                        print("Bluetooth connection requested for wallet: \(request.walletId)")
                    }
                )
            }
        }
    }
}

// MARK: - Settings Sheet Wrapper

struct SettingsSheetView: View {
    @ObservedObject var walletViewModel: WalletViewModel
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        VStack(spacing: 0) {
            // Custom header
            HStack {
                Spacer()
                
                Text("Settings")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                Spacer()
                
                Button("Done") {
                    dismiss()
                }
                .fontWeight(.medium)
            }
            .padding()
            .background(Color(.systemBackground))
            
            // Settings content without NavigationView
            SettingsView(walletViewModel: walletViewModel, isSheet: true)
        }
    }
}

#Preview {
    WalletView(viewModel: DependencyContainer.shared.createWalletViewModel())
}