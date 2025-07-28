//
//  QRCodeDisplayView.swift
//  offline-blockchain-wallet-ios
//
//  Created by Kiro on 7/21/25.
//

import SwiftUI

struct QRCodeDisplayView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel = QRCodeDisplayViewModel()
    
    let walletId: String
    let publicKey: String
    let deviceName: String
    let paymentInfo: PaymentRequestInfo?
    let onBluetoothConnectionRequested: (QRCodePaymentRequest) -> Void
    
    @State private var showingShareSheet = false
    @State private var showingAlert = false
    @State private var alertMessage = ""
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 24) {
                    // Header
                    VStack(spacing: 8) {
                        Text(paymentInfo != nil ? "Payment Request" : "Connection Request")
                            .font(.title2)
                            .fontWeight(.semibold)
                        
                        if let paymentInfo = paymentInfo {
                            if let amount = paymentInfo.requestedAmount {
                                Text("Amount: \(amount, specifier: "%.2f") \(paymentInfo.currency)")
                                    .font(.headline)
                                    .foregroundColor(.primary)
                            }
                            
                            if let description = paymentInfo.description {
                                Text(description)
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)
                                    .multilineTextAlignment(.center)
                            }
                        }
                    }
                    .padding(.horizontal)
                    
                    // QR Code
                    VStack(spacing: 16) {
                        if let qrImageData = viewModel.qrCodeImageData {
                            createQRImage(from: qrImageData)
                                .interpolation(.none)
                                .resizable()
                                .aspectRatio(contentMode: .fit)
                                .frame(width: 250, height: 250)
                                .background(Color.white)
                                .cornerRadius(12)
                                .shadow(color: .black.opacity(0.1), radius: 8, x: 0, y: 4)
                        } else if viewModel.isGenerating {
                            VStack(spacing: 16) {
                                ProgressView()
                                    .progressViewStyle(CircularProgressViewStyle())
                                    .scaleEffect(1.2)
                                
                                Text("Generating QR Code...")
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)
                            }
                            .frame(width: 250, height: 250)
                            .background(Color.adaptiveSecondaryBackground)
                            .cornerRadius(12)
                        } else {
                            VStack(spacing: 16) {
                                Image(systemName: "exclamationmark.triangle")
                                    .font(.system(size: 40))
                                    .foregroundColor(.orange)
                                
                                Text("Failed to generate QR code")
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)
                                
                                Button("Retry") {
                                    generateQRCode()
                                }
                                .buttonStyle(.bordered)
                            }
                            .frame(width: 250, height: 250)
                            .background(Color.adaptiveSecondaryBackground)
                            .cornerRadius(12)
                        }
                        
                        // Instructions
                        VStack(spacing: 8) {
                            Text("Ask the other person to scan this QR code")
                                .font(.subheadline)
                                .foregroundColor(.primary)
                                .multilineTextAlignment(.center)
                            
                            Text("This will initiate a Bluetooth connection for the transaction")
                                .font(.caption)
                                .foregroundColor(.secondary)
                                .multilineTextAlignment(.center)
                        }
                        .padding(.horizontal)
                    }
                    
                    // Action Buttons
                    VStack(spacing: 12) {
                        Button(action: shareQRCode) {
                            HStack {
                                Image(systemName: "square.and.arrow.up")
                                Text("Share QR Code")
                            }
                            .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(viewModel.qrCodeImageData == nil)
                        
                        Button(action: refreshQRCode) {
                            HStack {
                                Image(systemName: "arrow.clockwise")
                                Text("Refresh")
                            }
                            .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)
                    }
                    .padding(.horizontal)
                    
                    // Expiration Info
                    if let paymentInfo = paymentInfo,
                       let expirationTime = paymentInfo.expirationTime {
                        VStack(spacing: 4) {
                            Text("Expires at:")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            
                            Text(expirationTime, style: .time)
                                .font(.caption)
                                .fontWeight(.medium)
                                .foregroundColor(.orange)
                        }
                        .padding(.top)
                    }
                    
                    Spacer(minLength: 20)
                }
                .padding()
            }
            .navigationTitle("QR Code")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Close") {
                        dismiss()
                    }
                }
                
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Settings") {
                        // TODO: Show QR code generation settings
                    }
                }
            }
        }

        .alert("Error", isPresented: $showingAlert) {
            Button("OK") { }
        } message: {
            Text(alertMessage)
        }
        .onAppear {
            generateQRCode()
        }
    }
    
    private func generateQRCode() {
        Task {
            await viewModel.generateQRCode(
                walletId: walletId,
                publicKey: publicKey,
                deviceName: deviceName,
                paymentInfo: paymentInfo
            )
            
            if let error = viewModel.lastError {
                alertMessage = error.localizedDescription
                showingAlert = true
            }
        }
    }
    
    private func shareQRCode() {
        // TODO: Implement platform-specific sharing
        print("Share QR code functionality - to be implemented")
    }
    
    private func refreshQRCode() {
        generateQRCode()
    }
    
    private func createQRImage(from data: Data) -> Image {
        #if os(iOS)
        return Image(uiImage: UIImage(data: data) ?? UIImage())
        #elseif os(macOS)
        return Image(nsImage: NSImage(data: data) ?? NSImage())
        #else
        return Image(systemName: "qrcode")
        #endif
    }
}

// MARK: - QR Code Display ViewModel

@MainActor
class QRCodeDisplayViewModel: ObservableObject {
    @Published var qrCodeImageData: Data?
    @Published var isGenerating = false
    @Published var lastError: Error?
    
    private let qrCodeService: QRCodeServiceProtocol
    private let logger: LoggerProtocol
    
    init() {
        // Initialize with dependency injection - will be properly injected in production
        self.qrCodeService = DependencyContainer.shared.qrCodeService
        self.logger = DependencyContainer.shared.logger
    }
    
    func generateQRCode(walletId: String, 
                       publicKey: String, 
                       deviceName: String, 
                       paymentInfo: PaymentRequestInfo?) async {
        isGenerating = true
        lastError = nil
        qrCodeImageData = nil
        
        do {
            let options = QRCodeGenerationOptions(
                size: CGSize(width: 300, height: 300),
                correctionLevel: .medium
            )
            
            let imageData = try qrCodeService.generatePaymentRequestQR(
                walletId: walletId,
                publicKey: publicKey,
                deviceName: deviceName,
                paymentInfo: paymentInfo,
                options: options
            )
            
            qrCodeImageData = imageData
            logger.log("QR code generated successfully", level: .info)
            
        } catch {
            lastError = error
            logger.log("Failed to generate QR code: \(error.localizedDescription)", level: .error)
        }
        
        isGenerating = false
    }
}

// MARK: - Share Sheet
// TODO: Implement platform-specific sharing functionality

// MARK: - Preview

#Preview {
    QRCodeDisplayView(
        walletId: "test-wallet-id",
        publicKey: "test-public-key",
        deviceName: "iPhone 15 Pro",
        paymentInfo: PaymentRequestInfo(
            requestedAmount: 25.50,
            description: "Coffee payment"
        ),
        onBluetoothConnectionRequested: { request in
            print("Bluetooth connection requested for: \(request.walletId)")
        }
    )
}