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
    @State private var showingResetConfirmation = false
    
    var body: some View {
        NavigationView {
            Form {
                // Enhanced Auto-recharge Settings
                Section {
                    // Main toggle with enhanced styling
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Auto-recharge")
                                .font(.subheadline)
                                .fontWeight(.medium)
                            
                            Text("Automatically buy tokens when low")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        
                        Spacer()
                        
                        Toggle("", isOn: $walletViewModel.autoRechargeEnabled)
                            .tint(.blue)
                    }
                    
                    if walletViewModel.autoRechargeEnabled {
                        // Enhanced threshold setting
                        VStack(alignment: .leading, spacing: 12) {
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("Recharge Threshold")
                                        .font(.subheadline)
                                        .fontWeight(.medium)
                                    
                                    Text("Trigger when balance falls below")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                                
                                Spacer()
                                
                                Text(String(format: "%.0f", walletViewModel.autoRechargeThreshold))
                                    .font(.subheadline)
                                    .fontWeight(.semibold)
                                    .foregroundColor(.blue)
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 6)
                                    .background(
                                        RoundedRectangle(cornerRadius: 8)
                                            .fill(Color.blue.opacity(0.1))
                                    )
                            }
                            
                            Slider(
                                value: $walletViewModel.autoRechargeThreshold,
                                in: 10...500,
                                step: 10
                            ) {
                                Text("Threshold")
                            }
                            .tint(.blue)
                            
                            // Visual threshold indicator
                            HStack {
                                Text("Low (10)")
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                                
                                Spacer()
                                
                                Text("High (500)")
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                            }
                        }
                        .padding(.vertical, 8)
                        
                        // Enhanced amount setting
                        VStack(alignment: .leading, spacing: 12) {
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("Recharge Amount")
                                        .font(.subheadline)
                                        .fontWeight(.medium)
                                    
                                    Text("Amount to purchase each time")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                                
                                Spacer()
                                
                                Text(String(format: "%.0f", walletViewModel.autoRechargeAmount))
                                    .font(.subheadline)
                                    .fontWeight(.semibold)
                                    .foregroundColor(.green)
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 6)
                                    .background(
                                        RoundedRectangle(cornerRadius: 8)
                                            .fill(Color.green.opacity(0.1))
                                    )
                            }
                            
                            Slider(
                                value: $walletViewModel.autoRechargeAmount,
                                in: 50...1000,
                                step: 25
                            ) {
                                Text("Amount")
                            }
                            .tint(.green)
                            
                            // Visual amount indicator
                            HStack {
                                Text("Small (50)")
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                                
                                Spacer()
                                
                                Text("Large (1000)")
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                            }
                        }
                        .padding(.vertical, 8)
                        
                        // Auto-recharge preview
                        AutoRechargePreview(
                            threshold: walletViewModel.autoRechargeThreshold,
                            amount: walletViewModel.autoRechargeAmount,
                            currentBalance: walletViewModel.offlineBalance
                        )
                    }
                } header: {
                    HStack {
                        Text("Auto-recharge Settings")
                        
                        Spacer()
                        
                        if walletViewModel.autoRechargeEnabled {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundColor(.green)
                                .font(.caption)
                        }
                    }
                } footer: {
                    if walletViewModel.autoRechargeEnabled {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Auto-recharge will automatically purchase offline tokens when your balance is low, ensuring you can always make offline transactions.")
                            
                            HStack(spacing: 4) {
                                Image(systemName: "info.circle")
                                    .foregroundColor(.blue)
                                    .font(.caption)
                                
                                Text("Requires sufficient blockchain balance for purchases")
                                    .font(.caption)
                                    .foregroundColor(.blue)
                            }
                        }
                    } else {
                        Text("Enable auto-recharge to automatically maintain your offline token balance.")
                    }
                }
                
                // Enhanced Wallet Information
                Section {
                    EnhancedInfoRow(
                        title: "Offline Balance",
                        value: String(format: "%.2f", walletViewModel.offlineBalance),
                        color: .blue,
                        icon: "wifi.slash",
                        subtitle: "Available offline",
                        isLoading: walletViewModel.isLoading
                    )
                    
                    EnhancedInfoRow(
                        title: "Blockchain Balance",
                        value: String(format: "%.2f", walletViewModel.blockchainBalance),
                        color: .green,
                        icon: "link",
                        subtitle: "Requires internet",
                        isLoading: walletViewModel.isLoading
                    )
                    
                    Divider()
                    
                    EnhancedInfoRow(
                        title: "Total Balance",
                        value: String(format: "%.2f", walletViewModel.offlineBalance + walletViewModel.blockchainBalance),
                        color: .primary,
                        icon: "wallet.pass",
                        subtitle: "Combined balance",
                        isLoading: walletViewModel.isLoading,
                        isTotal: true
                    )
                    
                    if let lastSync = walletViewModel.lastSyncTimestamp {
                        EnhancedInfoRow(
                            title: "Last Sync",
                            value: lastSync.formatted(.relative(presentation: .named)),
                            color: .secondary,
                            icon: "arrow.clockwise",
                            subtitle: "Data freshness"
                        )
                    } else {
                        EnhancedInfoRow(
                            title: "Sync Status",
                            value: "Never synced",
                            color: .orange,
                            icon: "exclamationmark.triangle",
                            subtitle: "Tap refresh to sync"
                        )
                    }
                } header: {
                    HStack {
                        Text("Wallet Information")
                        
                        Spacer()
                        
                        if walletViewModel.isLoading {
                            ProgressView()
                                .scaleEffect(0.7)
                        }
                    }
                } footer: {
                    Text("Balances are updated when you refresh or perform transactions. Offline balance is available without internet connection.")
                }
                
                // Actions
                Section("Actions") {
                    ActionRow(
                        title: "Refresh Balances",
                        icon: "arrow.clockwise",
                        isLoading: walletViewModel.isLoading
                    ) {
                        Task {
                            await walletViewModel.refreshBalances()
                        }
                    }
                    
                    ActionRow(
                        title: "Purchase Offline Tokens",
                        icon: "plus.circle",
                        isLoading: walletViewModel.isLoading
                    ) {
                        Task {
                            await walletViewModel.purchaseOfflineTokens(amount: walletViewModel.autoRechargeAmount)
                        }
                    }
                }
                
                // Debug Information (Development only)
                #if DEBUG
                Section("Debug") {
                    Button(action: {
                        showingResetConfirmation = true
                    }) {
                        HStack {
                            Image(systemName: "trash")
                                .foregroundColor(.red)
                            Text("Clear All Data")
                                .foregroundColor(.red)
                        }
                    }
                }
                #endif
            }
            .navigationTitle("Settings")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
            .alert("Clear All Data", isPresented: $showingResetConfirmation) {
                Button("Cancel", role: .cancel) { }
                Button("Clear", role: .destructive) {
                    // Implementation will be added later
                }
            } message: {
                Text("This will permanently delete all wallet data including transactions and tokens. This action cannot be undone.")
            }
            .alert("Error", isPresented: .constant(walletViewModel.errorMessage != nil)) {
                Button("OK") {
                    walletViewModel.errorMessage = nil
                }
            } message: {
                Text(walletViewModel.errorMessage ?? "")
            }
        }
    }
}

// MARK: - Supporting Views

struct InfoRow: View {
    let title: String
    let value: String
    let color: Color
    
    var body: some View {
        HStack {
            Text(title)
                .font(.subheadline)
            
            Spacer()
            
            Text(value)
                .font(.subheadline)
                .fontWeight(.medium)
                .foregroundColor(color)
        }
    }
}

struct EnhancedInfoRow: View {
    let title: String
    let value: String
    let color: Color
    let icon: String
    let subtitle: String
    let isLoading: Bool
    let isTotal: Bool
    
    init(title: String, value: String, color: Color, icon: String, subtitle: String, isLoading: Bool = false, isTotal: Bool = false) {
        self.title = title
        self.value = value
        self.color = color
        self.icon = icon
        self.subtitle = subtitle
        self.isLoading = isLoading
        self.isTotal = isTotal
    }
    
    var body: some View {
        HStack(spacing: 12) {
            // Icon with background
            ZStack {
                Circle()
                    .fill(color.opacity(0.15))
                    .frame(width: 32, height: 32)
                
                Image(systemName: icon)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(color)
            }
            
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline)
                    .fontWeight(isTotal ? .semibold : .medium)
                    .foregroundColor(.primary)
                
                Text(subtitle)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            VStack(alignment: .trailing, spacing: 2) {
                if isLoading && value == "0.00" {
                    ProgressView()
                        .scaleEffect(0.8)
                } else {
                    Text(value)
                        .font(isTotal ? .headline : .subheadline)
                        .fontWeight(isTotal ? .bold : .semibold)
                        .foregroundColor(color)
                        .contentTransition(.numericText())
                }
                
                if isTotal {
                    Text("Total")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding(.vertical, 4)
    }
}

struct AutoRechargePreview: View {
    let threshold: Double
    let amount: Double
    let currentBalance: Double
    
    private var willTrigger: Bool {
        currentBalance <= threshold
    }
    
    private var balanceAfterRecharge: Double {
        willTrigger ? currentBalance + amount : currentBalance
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Preview")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundColor(.secondary)
                
                Spacer()
                
                if willTrigger {
                    HStack(spacing: 4) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .font(.caption2)
                            .foregroundColor(.orange)
                        
                        Text("Will trigger now")
                            .font(.caption2)
                            .fontWeight(.medium)
                            .foregroundColor(.orange)
                    }
                } else {
                    HStack(spacing: 4) {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.caption2)
                            .foregroundColor(.green)
                        
                        Text("Above threshold")
                            .font(.caption2)
                            .fontWeight(.medium)
                            .foregroundColor(.green)
                    }
                }
            }
            
            // Visual representation
            VStack(spacing: 8) {
                HStack {
                    Text("Current: \(String(format: "%.0f", currentBalance))")
                        .font(.caption)
                        .foregroundColor(.primary)
                    
                    Spacer()
                    
                    Text("Threshold: \(String(format: "%.0f", threshold))")
                        .font(.caption)
                        .foregroundColor(.orange)
                }
                
                // Progress bar showing current balance vs threshold
                GeometryReader { geometry in
                    ZStack(alignment: .leading) {
                        Rectangle()
                            .fill(Color.gray.opacity(0.2))
                            .frame(height: 6)
                            .cornerRadius(3)
                        
                        // Current balance bar
                        Rectangle()
                            .fill(willTrigger ? Color.orange : Color.blue)
                            .frame(
                                width: min(geometry.size.width * (currentBalance / max(threshold * 2, 100)), geometry.size.width),
                                height: 6
                            )
                            .cornerRadius(3)
                        
                        // Threshold line
                        Rectangle()
                            .fill(Color.orange)
                            .frame(width: 2, height: 10)
                            .offset(x: geometry.size.width * (threshold / max(threshold * 2, 100)))
                    }
                }
                .frame(height: 10)
                
                if willTrigger {
                    HStack {
                        Text("After recharge: \(String(format: "%.0f", balanceAfterRecharge))")
                            .font(.caption)
                            .foregroundColor(.green)
                            .fontWeight(.medium)
                        
                        Spacer()
                    }
                }
            }
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(.systemGray6))
        )
    }
}

struct ActionRow: View {
    let title: String
    let icon: String
    let isLoading: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            HStack {
                if isLoading {
                    ProgressView()
                        .scaleEffect(0.8)
                        .frame(width: 16, height: 16)
                } else {
                    Image(systemName: icon)
                        .foregroundColor(.blue)
                        .frame(width: 16, height: 16)
                }
                
                Text(title)
                    .foregroundColor(.primary)
                
                Spacer()
            }
        }
        .disabled(isLoading)
    }
}

#Preview {
    SettingsView(walletViewModel: DependencyContainer.shared.createWalletViewModel())
}
