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
    @State private var selectedFilter: TransactionFilter = .all
    @State private var showingQRScanner = false
    
    init(viewModel: TransactionViewModel) {
        self._transactionViewModel = StateObject(wrappedValue: viewModel)
    }
    
    private var isValidTransaction: Bool {
        !transactionViewModel.recipientId.isEmpty &&
        !transactionViewModel.amount.isEmpty &&
        Double(transactionViewModel.amount) != nil &&
        Double(transactionViewModel.amount)! > 0
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
            .sheet(isPresented: $showingQRScanner) {
                QRScannerView(
                    onScanComplete: { paymentRequest in
                        transactionViewModel.recipientId = paymentRequest.walletId
                        showingQRScanner = false
                    },
                    onError: { error in
                        transactionViewModel.errorMessage = error.localizedDescription
                        showingQRScanner = false
                    }
                )
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
                
                // Enhanced Recipient Input with QR Integration
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        Text("Recipient")
                            .font(.headline)
                            .fontWeight(.semibold)
                        
                        Spacer()
                        
                        if !transactionViewModel.recipientId.isEmpty {
                            HStack(spacing: 4) {
                                Image(systemName: "checkmark.circle.fill")
                                    .font(.caption)
                                    .foregroundColor(.green)
                                
                                Text("Valid")
                                    .font(.caption)
                                    .fontWeight(.medium)
                                    .foregroundColor(.green)
                            }
                        }
                    }
                    
                    HStack(spacing: 12) {
                        TextField("Enter recipient ID or scan QR", text: $transactionViewModel.recipientId)
                            .textFieldStyle(RoundedBorderTextFieldStyle())
                            .font(.system(.body, design: .monospaced))
                        
                        Button(action: {
                            // Open QR scanner with enhanced feedback
                            showQRScanner()
                        }) {
                            ZStack {
                                RoundedRectangle(cornerRadius: 8)
                                    .fill(Color.blue)
                                    .frame(width: 44, height: 44)
                                
                                Image(systemName: "qrcode.viewfinder")
                                    .font(.title3)
                                    .foregroundColor(.white)
                            }
                        }
                        .buttonStyle(PlainButtonStyle())
                    }
                    
                    // Enhanced recipient validation feedback
                    if !transactionViewModel.recipientId.isEmpty {
                        HStack(spacing: 8) {
                            Image(systemName: "person.circle.fill")
                                .font(.caption)
                                .foregroundColor(.blue)
                            
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Recipient ID: \(String(transactionViewModel.recipientId.prefix(12)))...")
                                    .font(.caption)
                                    .fontWeight(.medium)
                                    .foregroundColor(.primary)
                                
                                Text("Tap to verify recipient details")
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                            }
                            
                            Spacer()
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(
                            RoundedRectangle(cornerRadius: 8)
                                .fill(Color.blue.opacity(0.1))
                        )
                        .onTapGesture {
                            // Show recipient verification
                        }
                    } else {
                        HStack(spacing: 8) {
                            Image(systemName: "info.circle")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            
                            Text("Enter recipient wallet ID or scan their QR code")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                }
                
                // Enhanced Amount Input with validation
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        Text("Amount")
                            .font(.headline)
                            .fontWeight(.semibold)
                        
                        Spacer()
                        
                        if let amount = Double(transactionViewModel.amount), amount > 0 {
                            HStack(spacing: 4) {
                                Image(systemName: "checkmark.circle.fill")
                                    .font(.caption)
                                    .foregroundColor(.green)
                                
                                Text("Valid")
                                    .font(.caption)
                                    .fontWeight(.medium)
                                    .foregroundColor(.green)
                            }
                        }
                    }
                    
                    // Enhanced amount input field
                    VStack(spacing: 8) {
                        TextField("0.00", text: $transactionViewModel.amount)
                            .textFieldStyle(RoundedBorderTextFieldStyle())
                            .keyboardType(.decimalPad)
                            .font(.system(size: 24, weight: .semibold, design: .rounded))
                            .multilineTextAlignment(.center)
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(
                                        transactionViewModel.amount.isEmpty ? Color.clear :
                                        (Double(transactionViewModel.amount) != nil && Double(transactionViewModel.amount)! > 0) ? Color.green : Color.red,
                                        lineWidth: 2
                                    )
                            )
                        
                        // Quick amount buttons
                        HStack(spacing: 8) {
                            ForEach([10.0, 25.0, 50.0, 100.0], id: \.self) { quickAmount in
                                Button(action: {
                                    transactionViewModel.amount = String(format: "%.0f", quickAmount)
                                }) {
                                    Text(String(format: "%.0f", quickAmount))
                                        .font(.caption)
                                        .fontWeight(.medium)
                                        .padding(.horizontal, 12)
                                        .padding(.vertical, 6)
                                        .background(
                                            RoundedRectangle(cornerRadius: 16)
                                                .fill(Color.blue.opacity(0.1))
                                        )
                                        .foregroundColor(.blue)
                                }
                                .buttonStyle(PlainButtonStyle())
                            }
                        }
                    }
                    
                    // Enhanced balance indicator with visual feedback
                    VStack(spacing: 8) {
                        HStack {
                            Text("Available Balance:")
                                .font(.subheadline)
                                .fontWeight(.medium)
                                .foregroundColor(.secondary)
                            
                            Spacer()
                            
                            if transactionViewModel.transactionType == .offlineTransfer {
                                Text("250.00 OT") // This would come from wallet state
                                    .font(.subheadline)
                                    .fontWeight(.semibold)
                                    .foregroundColor(.blue)
                            } else {
                                Text("1,500.75") // This would come from wallet state
                                    .font(.subheadline)
                                    .fontWeight(.semibold)
                                    .foregroundColor(.green)
                            }
                        }
                        
                        // Balance usage indicator
                        if let amount = Double(transactionViewModel.amount), amount > 0 {
                            let availableBalance: Double = transactionViewModel.transactionType == .offlineTransfer ? 250.0 : 1500.75
                            let usagePercentage = min(amount / availableBalance, 1.0)
                            
                            VStack(spacing: 4) {
                                GeometryReader { geometry in
                                    ZStack(alignment: .leading) {
                                        Rectangle()
                                            .fill(Color.gray.opacity(0.2))
                                            .frame(height: 6)
                                            .cornerRadius(3)
                                        
                                        Rectangle()
                                            .fill(
                                                usagePercentage <= 0.8 ? 
                                                (transactionViewModel.transactionType == .offlineTransfer ? Color.blue : Color.green) :
                                                usagePercentage <= 0.95 ? Color.orange : Color.red
                                            )
                                            .frame(width: geometry.size.width * usagePercentage, height: 6)
                                            .cornerRadius(3)
                                            .animation(.easeInOut(duration: 0.3), value: usagePercentage)
                                    }
                                }
                                .frame(height: 6)
                                
                                HStack {
                                    Text("Using \(Int(usagePercentage * 100))% of balance")
                                        .font(.caption)
                                        .foregroundColor(
                                            usagePercentage <= 0.8 ? .secondary :
                                            usagePercentage <= 0.95 ? .orange : .red
                                        )
                                    
                                    Spacer()
                                    
                                    if usagePercentage > 1.0 {
                                        Text("Insufficient balance")
                                            .font(.caption)
                                            .fontWeight(.medium)
                                            .foregroundColor(.red)
                                    } else {
                                        Text("Remaining: \(String(format: "%.2f", availableBalance - amount))")
                                            .font(.caption)
                                            .foregroundColor(.secondary)
                                    }
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
                
                // Enhanced Transaction Summary
                if !transactionViewModel.recipientId.isEmpty && !transactionViewModel.amount.isEmpty {
                    VStack(alignment: .leading, spacing: 16) {
                        HStack {
                            Text("Transaction Summary")
                                .font(.headline)
                                .fontWeight(.semibold)
                            
                            Spacer()
                            
                            Image(systemName: transactionViewModel.transactionType == .offlineTransfer ? "bluetooth" : "wifi")
                                .font(.title3)
                                .foregroundColor(transactionViewModel.transactionType == .offlineTransfer ? .blue : .green)
                        }
                        
                        VStack(spacing: 12) {
                            // Transaction type with enhanced visual
                            HStack(spacing: 12) {
                                ZStack {
                                    Circle()
                                        .fill((transactionViewModel.transactionType == .offlineTransfer ? Color.blue : Color.green).opacity(0.15))
                                        .frame(width: 32, height: 32)
                                    
                                    Image(systemName: transactionViewModel.transactionType == .offlineTransfer ? "bluetooth" : "wifi")
                                        .font(.system(size: 14, weight: .medium))
                                        .foregroundColor(transactionViewModel.transactionType == .offlineTransfer ? .blue : .green)
                                }
                                
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("Transaction Type")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                    
                                    Text(transactionViewModel.transactionType == .offlineTransfer ? "Offline Transfer" : "Online Transfer")
                                        .font(.subheadline)
                                        .fontWeight(.semibold)
                                        .foregroundColor(transactionViewModel.transactionType == .offlineTransfer ? .blue : .green)
                                }
                                
                                Spacer()
                            }
                            
                            Divider()
                            
                            // Amount with enhanced display
                            HStack(spacing: 12) {
                                ZStack {
                                    Circle()
                                        .fill(Color.orange.opacity(0.15))
                                        .frame(width: 32, height: 32)
                                    
                                    Image(systemName: "dollarsign.circle")
                                        .font(.system(size: 14, weight: .medium))
                                        .foregroundColor(.orange)
                                }
                                
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("Amount")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                    
                                    Text(transactionViewModel.amount)
                                        .font(.title3)
                                        .fontWeight(.bold)
                                        .foregroundColor(.primary)
                                }
                                
                                Spacer()
                            }
                            
                            Divider()
                            
                            // Recipient with enhanced display
                            HStack(spacing: 12) {
                                ZStack {
                                    Circle()
                                        .fill(Color.purple.opacity(0.15))
                                        .frame(width: 32, height: 32)
                                    
                                    Image(systemName: "person.circle")
                                        .font(.system(size: 14, weight: .medium))
                                        .foregroundColor(.purple)
                                }
                                
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("Recipient")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                    
                                    Text(String(transactionViewModel.recipientId.prefix(12)) + "...")
                                        .font(.system(.subheadline, design: .monospaced))
                                        .fontWeight(.medium)
                                        .foregroundColor(.primary)
                                }
                                
                                Spacer()
                                
                                Button(action: {
                                    // Copy recipient ID
                                }) {
                                    Image(systemName: "doc.on.doc")
                                        .font(.caption)
                                        .foregroundColor(.blue)
                                }
                            }
                        }
                        .padding()
                        .background(
                            RoundedRectangle(cornerRadius: 16)
                                .fill(Color.adaptiveCardBackground)
                                .shadow(color: .black.opacity(0.05), radius: 8, x: 0, y: 4)
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 16)
                                .stroke(Color.gray.opacity(0.2), lineWidth: 1)
                        )
                    }
                }
                
                // Enhanced Send Button with better feedback
                VStack(spacing: 12) {
                    Button(action: {
                        Task {
                            await transactionViewModel.initiateTransaction()
                        }
                    }) {
                        HStack(spacing: 12) {
                            if transactionViewModel.isProcessingTransaction {
                                ProgressView()
                                    .scaleEffect(0.9)
                                    .progressViewStyle(CircularProgressViewStyle(tint: .white))
                            } else {
                                Image(systemName: transactionViewModel.transactionType == .offlineTransfer ? "bluetooth" : "wifi")
                                    .font(.title3)
                            }
                            
                            VStack(spacing: 2) {
                                Text(transactionViewModel.isProcessingTransaction ? "Processing Transaction..." : "Send Transaction")
                                    .font(.headline)
                                    .fontWeight(.semibold)
                                
                                if !transactionViewModel.isProcessingTransaction {
                                    Text(transactionViewModel.transactionType == .offlineTransfer ? "Via Bluetooth" : "Via Internet")
                                        .font(.caption)
                                        .opacity(0.8)
                                }
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(
                            RoundedRectangle(cornerRadius: 16)
                                .fill(
                                    isValidTransaction ? 
                                    (transactionViewModel.transactionType == .offlineTransfer ? Color.blue : Color.green) : 
                                    Color.gray
                                )
                        )
                        .foregroundColor(.white)
                        .scaleEffect(transactionViewModel.isProcessingTransaction ? 0.98 : 1.0)
                        .animation(.easeInOut(duration: 0.1), value: transactionViewModel.isProcessingTransaction)
                    }
                    .disabled(!isValidTransaction || transactionViewModel.isProcessingTransaction)
                    
                    // Transaction requirements checklist
                    if !isValidTransaction {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Required to send:")
                                .font(.caption)
                                .fontWeight(.medium)
                                .foregroundColor(.secondary)
                            
                            HStack(spacing: 8) {
                                Image(systemName: transactionViewModel.recipientId.isEmpty ? "circle" : "checkmark.circle.fill")
                                    .font(.caption)
                                    .foregroundColor(transactionViewModel.recipientId.isEmpty ? .secondary : .green)
                                
                                Text("Valid recipient ID")
                                    .font(.caption)
                                    .foregroundColor(transactionViewModel.recipientId.isEmpty ? .secondary : .green)
                            }
                            
                            HStack(spacing: 8) {
                                let hasValidAmount = !transactionViewModel.amount.isEmpty && 
                                                   Double(transactionViewModel.amount) != nil && 
                                                   Double(transactionViewModel.amount)! > 0
                                
                                Image(systemName: hasValidAmount ? "checkmark.circle.fill" : "circle")
                                    .font(.caption)
                                    .foregroundColor(hasValidAmount ? .green : .secondary)
                                
                                Text("Valid amount greater than 0")
                                    .font(.caption)
                                    .foregroundColor(hasValidAmount ? .green : .secondary)
                            }
                        }
                        .padding()
                        .background(
                            RoundedRectangle(cornerRadius: 12)
                                .fill(Color.orange.opacity(0.1))
                        )
                    }
                }
                
                Spacer()
            }
            .padding()
        }
    }
    
    private var transactionHistoryView: some View {
        VStack(spacing: 0) {
            // Enhanced filter tabs with counts
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(TransactionFilter.allCases, id: \.self) { filter in
                        EnhancedFilterTab(
                            title: filter.title,
                            count: getTransactionCount(for: filter),
                            isSelected: selectedFilter == filter,
                            color: filter.color
                        ) {
                            withAnimation(.easeInOut(duration: 0.2)) {
                                selectedFilter = filter
                            }
                        }
                    }
                }
                .padding(.horizontal)
            }
            .padding(.bottom, 8)
            
            // Enhanced content area with better loading and error states
            if transactionViewModel.isLoading {
                EnhancedLoadingView(message: "Loading transactions...")
            } else if transactionViewModel.transactions.isEmpty {
                EnhancedEmptyTransactionsView(
                    onSendPayment: {
                        selectedTab = 0
                    },
                    onScanQR: {
                        selectedTab = 0
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                            showingQRScanner = true
                        }
                    }
                )
            } else {
                let filteredTransactions = getFilteredTransactions()
                
                if filteredTransactions.isEmpty {
                    VStack(spacing: 16) {
                        Image(systemName: "tray")
                            .font(.system(size: 48))
                            .foregroundColor(.secondary)
                        
                        Text("No \(selectedFilter.title.lowercased()) transactions")
                            .font(.headline)
                            .foregroundColor(.secondary)
                        
                        Text("Transactions matching your filter will appear here")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color.adaptiveBackground)
                } else {
                    List {
                        ForEach(filteredTransactions) { transaction in
                            EnhancedTransactionRow(transaction: transaction)
                                .onTapGesture {
                                    transactionViewModel.selectTransaction(transaction)
                                }
                                .swipeActions(edge: .trailing) {
                                    if transaction.status == .failed {
                                        Button("Retry") {
                                            Task {
                                                await transactionViewModel.retryTransaction(transaction)
                                            }
                                        }
                                        .tint(.orange)
                                        
                                        Button("Cancel") {
                                            Task {
                                                await transactionViewModel.cancelTransaction(transaction)
                                            }
                                        }
                                        .tint(.red)
                                    }
                                }
                        }
                    }
                    .refreshable {
                        await transactionViewModel.refreshTransactions()
                    }
                    .listStyle(InsetGroupedListStyle())
                }
            }
        }
    }
    
    // MARK: - Helper Methods
    
    private func showQRScanner() {
        showingQRScanner = true
    }
}

struct TransactionRow: View {
    let transaction: Transaction
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                // Transaction type icon with online/offline indicator
                ZStack {
                    Circle()
                        .fill(colorForTransactionType(transaction.type).opacity(0.1))
                        .frame(width: 40, height: 40)
                    
                    Image(systemName: iconForTransactionType(transaction.type))
                        .foregroundColor(colorForTransactionType(transaction.type))
                        .font(.system(size: 18, weight: .medium))
                }
                
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(titleForTransactionType(transaction.type))
                            .font(.headline)
                            .fontWeight(.medium)
                        
                        // Online/Offline indicator
                        ConnectionIndicator(type: transaction.type)
                    }
                    
                    HStack {
                        Text(transaction.timestamp, style: .date)
                            .font(.caption)
                            .foregroundColor(.secondary)
                        
                        Text("•")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        
                        Text(transaction.timestamp, style: .time)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    
                    // Additional metadata
                    if let metadata = transaction.metadata {
                        HStack {
                            if let connectionType = metadata.connectionType {
                                Text("via \(connectionType)")
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                            }
                            
                            if let deviceInfo = metadata.deviceInfo {
                                Text("• \(deviceInfo)")
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                                    .lineLimit(1)
                            }
                        }
                    }
                }
                
                Spacer()
                
                VStack(alignment: .trailing, spacing: 6) {
                    Text(String(format: "%.2f", transaction.amount))
                        .font(.headline)
                        .fontWeight(.semibold)
                        .foregroundColor(.primary)
                    
                    StatusBadge(status: transaction.status)
                }
            }
            
            // Progress indicator for pending transactions
            if transaction.status == .pending {
                ProgressView()
                    .scaleEffect(0.8)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding(.vertical, 8)
        .contentShape(Rectangle())
    }
}

struct EnhancedTransactionRow: View {
    let transaction: Transaction
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 12) {
                // Enhanced transaction type icon with status overlay
                ZStack {
                    Circle()
                        .fill(colorForTransactionType(transaction.type).opacity(0.15))
                        .frame(width: 48, height: 48)
                    
                    Image(systemName: iconForTransactionType(transaction.type))
                        .foregroundColor(colorForTransactionType(transaction.type))
                        .font(.system(size: 20, weight: .medium))
                    
                    // Status indicator overlay
                    if transaction.status == .pending {
                        Circle()
                            .fill(Color.orange)
                            .frame(width: 16, height: 16)
                            .overlay(
                                ProgressView()
                                    .scaleEffect(0.5)
                                    .progressViewStyle(CircularProgressViewStyle(tint: .white))
                            )
                            .offset(x: 16, y: -16)
                    } else if transaction.status == .failed {
                        Circle()
                            .fill(Color.red)
                            .frame(width: 16, height: 16)
                            .overlay(
                                Image(systemName: "xmark")
                                    .font(.system(size: 8, weight: .bold))
                                    .foregroundColor(.white)
                            )
                            .offset(x: 16, y: -16)
                    } else if transaction.status == .completed {
                        Circle()
                            .fill(Color.green)
                            .frame(width: 16, height: 16)
                            .overlay(
                                Image(systemName: "checkmark")
                                    .font(.system(size: 8, weight: .bold))
                                    .foregroundColor(.white)
                            )
                            .offset(x: 16, y: -16)
                    }
                }
                
                VStack(alignment: .leading, spacing: 6) {
                    // Transaction title with enhanced connection indicator
                    HStack(spacing: 8) {
                        Text(titleForTransactionType(transaction.type))
                            .font(.headline)
                            .fontWeight(.semibold)
                            .foregroundColor(.primary)
                        
                        EnhancedConnectionIndicator(type: transaction.type)
                    }
                    
                    // Participant information
                    HStack(spacing: 4) {
                        Text("To:")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        
                        Text(String(transaction.receiverId.prefix(8)) + "...")
                            .font(.caption)
                            .fontWeight(.medium)
                            .foregroundColor(.primary)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(
                                RoundedRectangle(cornerRadius: 4)
                                    .fill(Color.gray.opacity(0.1))
                            )
                    }
                    
                    // Enhanced timestamp with relative time
                    HStack(spacing: 8) {
                        Text(transaction.timestamp, style: .relative)
                            .font(.caption)
                            .foregroundColor(.secondary)
                        
                        Text("•")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        
                        Text(transaction.timestamp, format: .dateTime.hour().minute())
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    
                    // Enhanced metadata display
                    if let metadata = transaction.metadata {
                        HStack(spacing: 8) {
                            if let connectionType = metadata.connectionType {
                                HStack(spacing: 4) {
                                    Image(systemName: connectionType == "bluetooth" ? "bluetooth" : "wifi")
                                        .font(.caption2)
                                        .foregroundColor(.blue)
                                    
                                    Text(connectionType.capitalized)
                                        .font(.caption2)
                                        .foregroundColor(.blue)
                                }
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(
                                    RoundedRectangle(cornerRadius: 8)
                                        .fill(Color.blue.opacity(0.1))
                                )
                            }
                            
                            if let errorMessage = metadata.errorMessage {
                                HStack(spacing: 4) {
                                    Image(systemName: "exclamationmark.triangle.fill")
                                        .font(.caption2)
                                        .foregroundColor(.red)
                                    
                                    Text("Error")
                                        .font(.caption2)
                                        .foregroundColor(.red)
                                }
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(
                                    RoundedRectangle(cornerRadius: 8)
                                        .fill(Color.red.opacity(0.1))
                                )
                            }
                        }
                    }
                }
                
                Spacer()
                
                // Enhanced amount and status display
                VStack(alignment: .trailing, spacing: 8) {
                    Text(String(format: "%.2f", transaction.amount))
                        .font(.title3)
                        .fontWeight(.bold)
                        .foregroundColor(.primary)
                    
                    EnhancedStatusBadge(status: transaction.status)
                }
            }
            
            // Enhanced progress indicator for pending transactions
            if transaction.status == .pending {
                HStack(spacing: 8) {
                    ProgressView()
                        .scaleEffect(0.8)
                        .progressViewStyle(CircularProgressViewStyle(tint: .orange))
                    
                    Text("Processing transaction...")
                        .font(.caption)
                        .foregroundColor(.orange)
                        .fontWeight(.medium)
                    
                    Spacer()
                }
                .padding(.top, 4)
            }
            
            // Error message display for failed transactions
            if transaction.status == .failed, 
               let errorMessage = transaction.metadata?.errorMessage {
                HStack(spacing: 8) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.caption)
                        .foregroundColor(.red)
                    
                    Text(errorMessage)
                        .font(.caption)
                        .foregroundColor(.red)
                        .lineLimit(2)
                    
                    Spacer()
                }
                .padding(.top, 4)
            }
        }
        .padding(.vertical, 12)
        .contentShape(Rectangle())
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

// MARK: - Supporting Views

struct FilterTab: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline)
                .fontWeight(isSelected ? .semibold : .regular)
                .foregroundColor(isSelected ? .blue : .secondary)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(
                    RoundedRectangle(cornerRadius: 16)
                        .fill(isSelected ? Color.blue.opacity(0.1) : Color.clear)
                )
        }
        .buttonStyle(PlainButtonStyle())
    }
}

struct EnhancedFilterTab: View {
    let title: String
    let count: Int
    let isSelected: Bool
    let color: Color
    let action: () -> Void
    
    init(title: String, count: Int, isSelected: Bool, color: Color = .blue, action: @escaping () -> Void) {
        self.title = title
        self.count = count
        self.isSelected = isSelected
        self.color = color
        self.action = action
    }
    
    var body: some View {
        Button(action: action) {
            VStack(spacing: 2) {
                HStack(spacing: 4) {
                    Text(title)
                        .font(.subheadline)
                        .fontWeight(isSelected ? .semibold : .medium)
                    
                    if count > 0 {
                        Text("\(count)")
                            .font(.caption2)
                            .fontWeight(.semibold)
                            .foregroundColor(.white)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(
                                Capsule()
                                    .fill(isSelected ? color : Color.secondary)
                            )
                    }
                }
                .foregroundColor(isSelected ? color : .secondary)
                
                // Selection indicator
                Rectangle()
                    .fill(isSelected ? color : Color.clear)
                    .frame(height: 2)
                    .animation(.easeInOut(duration: 0.2), value: isSelected)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(isSelected ? color.opacity(0.1) : Color.clear)
                    .animation(.easeInOut(duration: 0.2), value: isSelected)
            )
        }
        .buttonStyle(PlainButtonStyle())
    }
}

struct SectionHeader: View {
    let title: String
    let count: Int
    let color: Color
    let icon: String
    
    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .font(.caption)
                .foregroundColor(color)
            
            Text(title)
                .font(.subheadline)
                .fontWeight(.semibold)
                .foregroundColor(color)
            
            Text("(\(count))")
                .font(.caption)
                .foregroundColor(.secondary)
            
            Spacer()
        }
        .padding(.vertical, 4)
    }
}

struct EnhancedLoadingView: View {
    let message: String
    
    var body: some View {
        VStack(spacing: 20) {
            ProgressView()
                .scaleEffect(1.2)
                .progressViewStyle(CircularProgressViewStyle(tint: .blue))
            
            VStack(spacing: 8) {
                Text(message)
                    .font(.headline)
                    .foregroundColor(.primary)
                
                Text("This may take a moment...")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(.systemGroupedBackground))
    }
}

struct EnhancedEmptyTransactionsView: View {
    let onSendPayment: () -> Void
    let onScanQR: () -> Void
    
    var body: some View {
        VStack(spacing: 24) {
            // Illustration
            ZStack {
                Circle()
                    .fill(Color.blue.opacity(0.1))
                    .frame(width: 80, height: 80)
                
                Image(systemName: "list.bullet.rectangle")
                    .font(.system(size: 32))
                    .foregroundColor(.blue)
            }
            
            VStack(spacing: 12) {
                Text("No Transactions Yet")
                    .font(.title2)
                    .fontWeight(.semibold)
                    .foregroundColor(.primary)
                
                Text("Your transaction history will appear here once you start sending or receiving payments")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .lineLimit(3)
            }
            
            // Quick action buttons
            VStack(spacing: 12) {
                Button(action: onSendPayment) {
                    HStack {
                        Image(systemName: "arrow.up.circle.fill")
                        Text("Send Payment")
                            .fontWeight(.medium)
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.blue)
                    .foregroundColor(.white)
                    .cornerRadius(12)
                }
                
                Button(action: onScanQR) {
                    HStack {
                        Image(systemName: "qrcode")
                        Text("Scan QR Code")
                            .fontWeight(.medium)
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.green)
                    .foregroundColor(.white)
                    .cornerRadius(12)
                }
            }
            .padding(.horizontal, 40)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding()
        .background(Color(.systemGroupedBackground))
    }
}

struct ConnectionIndicator: View {
    let type: TransactionType
    
    var body: some View {
        HStack(spacing: 4) {
            Circle()
                .fill(isOnline ? Color.green : Color.blue)
                .frame(width: 6, height: 6)
            
            Text(isOnline ? "Online" : "Offline")
                .font(.caption2)
                .fontWeight(.medium)
                .foregroundColor(isOnline ? .green : .blue)
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 2)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill((isOnline ? Color.green : Color.blue).opacity(0.1))
        )
    }
    
    private var isOnline: Bool {
        switch type {
        case .offlineTransfer:
            return false
        case .onlineTransfer, .tokenPurchase, .tokenRedemption:
            return true
        }
    }
}

struct EnhancedConnectionIndicator: View {
    let type: TransactionType
    
    var body: some View {
        HStack(spacing: 6) {
            // Animated connection icon
            ZStack {
                if isOnline {
                    Image(systemName: "wifi")
                        .font(.caption2)
                        .foregroundColor(.green)
                } else {
                    Image(systemName: "bluetooth")
                        .font(.caption2)
                        .foregroundColor(.blue)
                }
            }
            .frame(width: 12, height: 12)
            
            Text(connectionText)
                .font(.caption2)
                .fontWeight(.semibold)
                .foregroundColor(isOnline ? .green : .blue)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill((isOnline ? Color.green : Color.blue).opacity(0.15))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke((isOnline ? Color.green : Color.blue).opacity(0.3), lineWidth: 1)
                )
        )
    }
    
    private var isOnline: Bool {
        switch type {
        case .offlineTransfer:
            return false
        case .onlineTransfer, .tokenPurchase, .tokenRedemption:
            return true
        }
    }
    
    private var connectionText: String {
        switch type {
        case .offlineTransfer:
            return "Offline"
        case .onlineTransfer:
            return "Online"
        case .tokenPurchase:
            return "Purchase"
        case .tokenRedemption:
            return "Redeem"
        }
    }
}

struct StatusBadge: View {
    let status: TransactionStatus
    
    var body: some View {
        Text(status.rawValue.capitalized)
            .font(.caption2)
            .fontWeight(.medium)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(backgroundColorForStatus(status))
            .foregroundColor(textColorForStatus(status))
            .cornerRadius(8)
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

struct EnhancedStatusBadge: View {
    let status: TransactionStatus
    
    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: iconForStatus(status))
                .font(.caption2)
                .fontWeight(.semibold)
            
            Text(status.rawValue.capitalized)
                .font(.caption2)
                .fontWeight(.semibold)
        }
        .foregroundColor(textColorForStatus(status))
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(backgroundColorForStatus(status))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(textColorForStatus(status).opacity(0.3), lineWidth: 1)
                )
        )
    }
    
    private func iconForStatus(_ status: TransactionStatus) -> String {
        switch status {
        case .pending:
            return "clock"
        case .completed:
            return "checkmark.circle.fill"
        case .failed:
            return "xmark.circle.fill"
        case .cancelled:
            return "minus.circle.fill"
        }
    }
    
    private func backgroundColorForStatus(_ status: TransactionStatus) -> Color {
        switch status {
        case .pending:
            return .orange.opacity(0.15)
        case .completed:
            return .green.opacity(0.15)
        case .failed:
            return .red.opacity(0.15)
        case .cancelled:
            return .gray.opacity(0.15)
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

struct EmptyTransactionsView: View {
    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "list.bullet.rectangle")
                .font(.system(size: 48))
                .foregroundColor(.secondary)
            
            VStack(spacing: 8) {
                Text("No Transactions")
                    .font(.headline)
                    .foregroundColor(.secondary)
                
                Text("Your transaction history will appear here")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding()
    }
}

// MARK: - Helper Functions

func colorForTransactionType(_ type: TransactionType) -> Color {
    switch type {
    case .offlineTransfer:
        return .blue
    case .onlineTransfer:
        return .green
    case .tokenPurchase:
        return .purple
    case .tokenRedemption:
        return .orange
    }
}

func iconForTransactionType(_ type: TransactionType) -> String {
    switch type {
    case .offlineTransfer:
        return "wifi.slash"
    case .onlineTransfer:
        return "arrow.up.arrow.down.circle.fill"
    case .tokenPurchase:
        return "plus.circle.fill"
    case .tokenRedemption:
        return "minus.circle.fill"
    }
}

func titleForTransactionType(_ type: TransactionType) -> String {
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

// MARK: - Transaction Filtering Extensions

extension TransactionView {
    private func getTransactionCount(for filter: TransactionFilter) -> Int {
        switch filter {
        case .all:
            return transactionViewModel.transactions.count
        case .offline:
            return transactionViewModel.getOfflineTransactions().count
        case .online:
            return transactionViewModel.getOnlineTransactions().count
        case .pending:
            return transactionViewModel.getPendingTransactions().count
        case .failed:
            return transactionViewModel.getFailedTransactions().count
        }
    }
    
    private func getFilteredTransactions() -> [Transaction] {
        switch selectedFilter {
        case .all:
            return transactionViewModel.transactions
        case .offline:
            return transactionViewModel.getOfflineTransactions()
        case .online:
            return transactionViewModel.getOnlineTransactions()
        case .pending:
            return transactionViewModel.getPendingTransactions()
        case .failed:
            return transactionViewModel.getFailedTransactions()
        }
    }
}

enum TransactionFilter: CaseIterable {
    case all, offline, online, pending, failed
    
    var title: String {
        switch self {
        case .all: return "All"
        case .offline: return "Offline"
        case .online: return "Online"
        case .pending: return "Pending"
        case .failed: return "Failed"
        }
    }
    
    var color: Color {
        switch self {
        case .all: return .primary
        case .offline: return .blue
        case .online: return .green
        case .pending: return .orange
        case .failed: return .red
        }
    }
}

#Preview {
    TransactionView(viewModel: DependencyContainer.shared.createTransactionViewModel())
}