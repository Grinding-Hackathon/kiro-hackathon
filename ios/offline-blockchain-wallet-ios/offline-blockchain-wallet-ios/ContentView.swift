//
//  ContentView.swift
//  offline-blockchain-wallet-ios
//
//  Created by danny santoso on 7/21/25.
//

import SwiftUI

struct ContentView: View {
    @State private var selectedTab = 0
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
    }
}

struct QRCodeView: View {
    @State private var showingScanner = false
    @State private var scannedCode = ""
    
    var body: some View {
        NavigationView {
            VStack(spacing: 20) {
                Text("QR Code Scanner")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                
                if !scannedCode.isEmpty {
                    Text("Last scanned:")
                        .font(.headline)
                    
                    Text(scannedCode)
                        .font(.caption)
                        .padding()
                        .background(Color(.systemGray6))
                        .cornerRadius(8)
                }
                
                Button("Scan QR Code") {
                    showingScanner = true
                }
                .font(.headline)
                .foregroundColor(.white)
                .padding()
                .background(Color.blue)
                .cornerRadius(12)
                
                Spacer()
            }
            .padding()
            .navigationTitle("QR Scanner")
            .sheet(isPresented: $showingScanner) {
                QRScannerView { code in
                    scannedCode = code
                }
            }
        }
    }
}

#Preview {
    ContentView()
}
