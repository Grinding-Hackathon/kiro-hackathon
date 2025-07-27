//
//  ContentView.swift
//  offline-blockchain-wallet-ios
//
//  Created by danny santoso on 7/21/25.
//

import SwiftUI

struct ContentView: View {
    @State private var selectedTab = 0
    @StateObject private var themeManager = ThemeManager()
    private let dependencyContainer = DependencyContainer.shared
    
    var body: some View {
        TabView(selection: $selectedTab) {
            WalletView(viewModel: dependencyContainer.createWalletViewModel())
                .tabItem {
                    Image(systemName: "wallet.pass")
                    Text("Wallet")
                }
                .tag(0)
            
            TransactionView(viewModel: dependencyContainer.createTransactionViewModel())
                .tabItem {
                    Image(systemName: "arrow.left.arrow.right")
                    Text("Transactions")
                }
                .tag(1)
            
            QRCodeView()
                .tabItem {
                    Image(systemName: "qrcode")
                    Text("QR Code")
                }
                .tag(2)
            
            SettingsView(walletViewModel: dependencyContainer.createWalletViewModel())
                .tabItem {
                    Image(systemName: "gear")
                    Text("Settings")
                }
                .tag(3)
        }
        .accentColor(.blue)
        .environmentObject(themeManager)
        .themed()
    }
}

struct QRCodeView: View {
    @State private var showingScanner = false
    @State private var showingGenerator = false
    @State private var scannedCode = ""
    @State private var lastPaymentRequest: QRCodePaymentRequest?
    
    var body: some View {
        NavigationView {
            VStack(spacing: 24) {
                Text("QR Code")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                
                // Action buttons
                VStack(spacing: 16) {
                    Button(action: {
                        showingScanner = true
                    }) {
                        HStack {
                            Image(systemName: "qrcode.viewfinder")
                                .font(.title2)
                            Text("Scan QR Code")
                                .fontWeight(.semibold)
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.blue)
                        .foregroundColor(.white)
                        .cornerRadius(12)
                    }
                    
                    Button(action: {
                        showingGenerator = true
                    }) {
                        HStack {
                            Image(systemName: "qrcode")
                                .font(.title2)
                            Text("Generate QR Code")
                                .fontWeight(.semibold)
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.green)
                        .foregroundColor(.white)
                        .cornerRadius(12)
                    }
                }
                .padding(.horizontal)
                
                // Last scanned result
                if let paymentRequest = lastPaymentRequest {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Last Scanned Payment Request")
                            .font(.headline)
                        
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Text("Wallet ID:")
                                    .fontWeight(.medium)
                                Spacer()
                                Text(String(paymentRequest.walletId.prefix(8)) + "...")
                                    .font(.system(.caption, design: .monospaced))
                                    .foregroundColor(.secondary)
                            }
                            
                            if let paymentInfo = paymentRequest.paymentInfo,
                               let amount = paymentInfo.requestedAmount, amount > 0 {
                                HStack {
                                    Text("Amount:")
                                        .fontWeight(.medium)
                                    Spacer()
                                    Text(String(format: "%.2f", amount))
                                        .foregroundColor(.blue)
                                }
                            }
                            
                            HStack {
                                Text("Scanned:")
                                    .fontWeight(.medium)
                                Spacer()
                                Text(paymentRequest.timestamp, style: .relative)
                                    .foregroundColor(.secondary)
                            }
                        }
                        .font(.subheadline)
                        .padding()
                        .background(Color.adaptiveSecondaryBackground)
                        .cornerRadius(8)
                        
                        Button("Send Payment") {
                            // This would navigate to transaction view with pre-filled data
                        }
                        .font(.subheadline)
                        .foregroundColor(.blue)
                    }
                    .padding(.horizontal)
                }
                
                Spacer()
            }
            .padding()
            .navigationTitle("QR Code")
            .navigationBarTitleDisplayMode(.inline)
            .sheet(isPresented: $showingScanner) {
                QRScannerView(
                    onScanComplete: { paymentRequest in
                        lastPaymentRequest = paymentRequest
                        scannedCode = paymentRequest.walletId
                    },
                    onError: { error in
                        print("QR scan error: \(error.localizedDescription)")
                    }
                )
            }
            .sheet(isPresented: $showingGenerator) {
                QRCodeDisplayView(
                    walletId: "current-wallet-id", // This would come from wallet state
                    publicKey: "current-public-key",
                    deviceName: "iPhone",
                    paymentInfo: nil,
                    onBluetoothConnectionRequested: { request in
                        // Handle Bluetooth connection request
                        print("Bluetooth connection requested for wallet: \(request.walletId)")
                    }
                )
            }
        }
    }
}

#Preview {
    ContentView()
}
