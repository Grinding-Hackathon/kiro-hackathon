//
//  TransactionView.swift
//  offline-blockchain-wallet-ios
//
//  Created by Kiro on 7/21/25.
//

import SwiftUI

struct TransactionView: View {
    @StateObject private var transactionViewModel: TransactionViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var selectedTab = 0
    
    init(viewModel: TransactionViewModel) {
        self._transactionViewModel = StateObject(wrappedValue: viewModel)
    }
    
    var body: some View {
        NavigationView {
            VStack {
                // Tab Picker
                Picker("Transaction Type", selection: $selectedTab) {
                    Text("Send").tag(0)
                    Text("History").tag(1)
                }
                .pickerStyle(SegmentedPickerStyle())
                .padding()
                
                // Content based on selected tab
                if selectedTab == 0 {
                    sendTransactionView
                } else {
                    transactionHistoryView
                }
                
                Spacer()
            }
            .navigationTitle("Transactions")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Close") {
                        dismiss()
                    }
                }
            }
            .alert("Error", isPresented: .constant(transactionViewModel.errorMessage != nil)) {
                Button("OK") {
                    transactionViewModel.errorMessage = nil
                }
            } message: {
                Text(transactionViewModel.errorMessage ?? "")
            }
        }
    }
    
    private var sendTransactionView: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Transaction Type Picker
                VStack(alignment: .leading, spacing: 8) {
                    Text("Transaction Type")
                        .font(.headline)
                    
                    Picker("Type", selection: $transactionViewModel.transactionType) {
                        Text("Offline Transfer").tag(TransactionType.offlineTransfer)
                        Text("Online Transfer").tag(TransactionType.onlineTransfer)
                    }
                    .pickerStyle(SegmentedPickerStyle())
                }
                
                // Recipient Input
                VStack(alignment: .leading, spacing: 8) {
                    Text("Recipient")
                        .font(.headline)
                    
                    HStack {
                        TextField("Enter recipient ID or scan QR", text: $transactionViewModel.recipientId)
                            .textFieldStyle(RoundedBorderTextFieldStyle())
                        
                        Button(action: {
                            // Open QR scanner
                        }) {
                            Image(systemName: "qrcode.viewfinder")
                                .font(.title2)
                        }
                    }
                }
                
                // Amount Input
                VStack(alignment: .leading, spacing: 8) {
                    Text("Amount")
                        .font(.headline)
                    
                    TextField("0.00", text: $transactionViewModel.amount)
                        .textFieldStyle(RoundedBorderTextFieldStyle())
                        .keyboardType(.decimalPad)
                }
                
                // Send Button
                Button(action: {
                    Task {
                        await transactionViewModel.initiateTransaction()
                    }
                }) {
                    HStack {
                        if transactionViewModel.isLoading {
                            ProgressView()
                                .scaleEffect(0.8)
                        }
                        
                        Text("Send Transaction")
                            .fontWeight(.semibold)
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.blue)
                    .foregroundColor(.white)
                    .cornerRadius(12)
                }
                .disabled(transactionViewModel.isLoading || 
                         transactionViewModel.recipientId.isEmpty || 
                         transactionViewModel.amount.isEmpty)
                
                Spacer()
            }
            .padding()
        }
    }
    
    private var transactionHistoryView: some View {
        VStack {
            if transactionViewModel.isLoading {
                ProgressView("Loading transactions...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if transactionViewModel.transactions.isEmpty {
                VStack(spacing: 16) {
                    Image(systemName: "list.bullet.rectangle")
                        .font(.system(size: 48))
                        .foregroundColor(.secondary)
                    
                    Text("No Transactions")
                        .font(.headline)
                        .foregroundColor(.secondary)
                    
                    Text("Your transaction history will appear here")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List(transactionViewModel.transactions) { transaction in
                    TransactionRow(transaction: transaction)
                        .onTapGesture {
                            transactionViewModel.selectTransaction(transaction)
                        }
                }
                .refreshable {
                    await transactionViewModel.refreshTransactions()
                }
            }
        }
    }
}

struct TransactionRow: View {
    let transaction: Transaction
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                // Transaction type icon
                Image(systemName: iconForTransactionType(transaction.type))
                    .foregroundColor(colorForTransactionType(transaction.type))
                    .frame(width: 24, height: 24)
                
                VStack(alignment: .leading, spacing: 4) {
                    Text(titleForTransactionType(transaction.type))
                        .font(.headline)
                    
                    Text(transaction.timestamp, style: .date)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
                
                VStack(alignment: .trailing, spacing: 4) {
                    Text(String(format: "%.2f", transaction.amount))
                        .font(.headline)
                        .fontWeight(.semibold)
                    
                    Text(transaction.status.rawValue.capitalized)
                        .font(.caption)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 2)
                        .background(backgroundColorForStatus(transaction.status))
                        .foregroundColor(textColorForStatus(transaction.status))
                        .cornerRadius(8)
                }
            }
            
            if let metadata = transaction.metadata, let connectionType = metadata.connectionType {
                Text("via \(connectionType)")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
    
    private func iconForTransactionType(_ type: TransactionType) -> String {
        switch type {
        case .offlineTransfer:
            return "bluetooth"
        case .onlineTransfer:
            return "network"
        case .tokenPurchase:
            return "plus.circle"
        case .tokenRedemption:
            return "arrow.clockwise.circle"
        }
    }
    
    private func colorForTransactionType(_ type: TransactionType) -> Color {
        switch type {
        case .offlineTransfer:
            return .blue
        case .onlineTransfer:
            return .green
        case .tokenPurchase:
            return .orange
        case .tokenRedemption:
            return .purple
        }
    }
    
    private func titleForTransactionType(_ type: TransactionType) -> String {
        switch type {
        case .offlineTransfer:
            return "Offline Transfer"
        case .onlineTransfer:
            return "Online Transfer"
        case .tokenPurchase:
            return "Token Purchase"
        case .tokenRedemption:
            return "Token Redemption"
        }
    }
    
    private func backgroundColorForStatus(_ status: TransactionStatus) -> Color {
        switch status {
        case .pending:
            return .yellow.opacity(0.2)
        case .completed:
            return .green.opacity(0.2)
        case .failed:
            return .red.opacity(0.2)
        case .cancelled:
            return .gray.opacity(0.2)
        }
    }
    
    private func textColorForStatus(_ status: TransactionStatus) -> Color {
        switch status {
        case .pending:
            return .orange
        case .completed:
            return .green
        case .failed:
            return .red
        case .cancelled:
            return .gray
        }
    }
}

#Preview {
    TransactionView(viewModel: DependencyContainer.shared.createTransactionViewModel())
}