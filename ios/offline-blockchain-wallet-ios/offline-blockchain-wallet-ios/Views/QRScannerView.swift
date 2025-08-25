//
//  QRScannerView.swift
//  offline-blockchain-wallet-ios
//
//  Created by Kiro on 7/21/25.
//

import SwiftUI
import CodeScanner
import AVFoundation

struct QRScannerView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel = QRScannerViewModel()
    
    let onScanComplete: (QRCodePaymentRequest) -> Void
    let onError: (QRCodeValidationError) -> Void
    
    @State private var showingAlert = false
    @State private var alertMessage = ""
    @State private var isProcessing = false
    @State private var showingManualEntry = false
    @State private var manualEntryText = ""
    @State private var torchIsOn = false
    
    var body: some View {
        NavigationView {
            ZStack {
                // Real camera view using CodeScanner
                CodeScannerView(
                    codeTypes: [.qr],
                    scanMode: .continuous,
                    scanInterval: 1.0,
                    showViewfinder: true,
                    simulatedData: "",
                    shouldVibrateOnSuccess: true,
                    isTorchOn: torchIsOn,
                    completion: { result in
                        switch result {
                        case .success(let scanResult):
                            handleScanResult(scanResult.string)
                        case .failure(let error):
                            showError("Camera error: \(error.localizedDescription)")
                        }
                    }
                )
                .ignoresSafeArea(edges: .all)
                
                // Overlay for processing state
                if isProcessing {
                    Color.black.opacity(0.3)
                        .ignoresSafeArea()
                    
                    VStack {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                            .scaleEffect(1.5)
                        
                        Text("Validating QR Code...")
                            .foregroundColor(.white)
                            .padding(.top)
                    }
                }
                
                // Instructions overlay
                VStack {
                    Spacer()
                    
                    VStack(spacing: 16) {
                        Text("Position QR code within the frame")
                            .font(.headline)
                            .foregroundColor(.white)
                            .multilineTextAlignment(.center)
                        
                        Text("Make sure the QR code is well-lit and clearly visible")
                            .font(.caption)
                            .foregroundColor(.white.opacity(0.8))
                            .multilineTextAlignment(.center)
                        
                        // Add manual entry option as fallback
                        Button("Enter Code Manually") {
                            showManualEntry()
                        }
                        .foregroundColor(.white)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                        .background(Color.blue.opacity(0.8))
                        .cornerRadius(8)
                        
                        #if DEBUG
                        // Debug option for testing
                        Button("Simulate QR (Debug)") {
                            let mockPaymentRequest = QRCodePaymentRequest(
                                walletId: "mock-wallet-id",
                                publicKey: "mock-public-key",
                                deviceName: "Mock Device",
                                bluetoothInfo: BluetoothConnectionInfo()
                            )
                            onScanComplete(mockPaymentRequest)
                            dismiss()
                        }
                        .foregroundColor(.white)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                        .background(Color.orange.opacity(0.8))
                        .cornerRadius(8)
                        #endif
                    }
                    .padding()
                    .background(Color.black.opacity(0.7))
                    .cornerRadius(12)
                    .padding(.horizontal)
                    .padding(.bottom, 50)
                }
            }
            .navigationTitle("Scan QR Code")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: toggleFlashlight) {
                        Image(systemName: torchIsOn ? "flashlight.on.fill" : "flashlight.off.fill")
                    }
                }
            }
        }
        .alert("QR Code Error", isPresented: $showingAlert) {
            Button("OK") { }
        } message: {
            Text(alertMessage)
        }
        .onDisappear {
            torchIsOn = false
        }
        .sheet(isPresented: $showingManualEntry) {
            ManualQREntryView(
                text: $manualEntryText,
                onSubmit: { qrText in
                    handleScanResult(qrText)
                    showingManualEntry = false
                },
                onCancel: {
                    showingManualEntry = false
                    manualEntryText = ""
                }
            )
        }
    }
    
    private func handleScanResult(_ qrString: String) {
        guard !isProcessing else { return }
        
        isProcessing = true
        
        // Add small delay to prevent multiple rapid scans
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            processQRCode(qrString)
        }
    }
    
    private func processQRCode(_ qrString: String) {
        let validationResult = viewModel.validateQRCode(qrString)
        
        DispatchQueue.main.async {
            isProcessing = false
            
            if validationResult.isValid, let paymentRequest = validationResult.paymentRequest {
                onScanComplete(paymentRequest)
                dismiss()
            } else if let error = validationResult.error {
                onError(error)
                showError(error.localizedDescription ?? "Unknown validation error")
            } else {
                showError("Invalid QR code format")
            }
        }
    }
    
    private func showError(_ message: String) {
        alertMessage = message
        showingAlert = true
    }
    
    private func toggleFlashlight() {
        torchIsOn.toggle()
    }
    
    private func showManualEntry() {
        showingManualEntry = true
    }
}

// MARK: - QR Scanner ViewModel

class QRScannerViewModel: ObservableObject {
    private let qrCodeService: QRCodeServiceProtocol
    private let logger: LoggerProtocol
    
    init() {
        // Initialize with dependency injection - will be properly injected in production
        self.qrCodeService = DependencyContainer.shared.qrCodeService
        self.logger = DependencyContainer.shared.logger
    }
    
    func validateQRCode(_ qrString: String) -> QRCodeValidationResult {
        logger.log("Validating scanned QR code", level: .info)
        return qrCodeService.validateQRCode(qrString)
    }
}

// MARK: - Manual QR Entry View

struct ManualQREntryView: View {
    @Binding var text: String
    let onSubmit: (String) -> Void
    let onCancel: () -> Void
    
    var body: some View {
        VStack(spacing: 20) {
            HStack {
                Button("Cancel") {
                    onCancel()
                }
                
                Spacer()
                
                Text("Manual Entry")
                    .font(.headline)
                
                Spacer()
                
                // Invisible button for balance
                Button("Cancel") {
                    onCancel()
                }
                .opacity(0)
            }
            .padding()
            
            VStack(spacing: 20) {
                Text("Enter QR Code Data")
                    .font(.title2)
                    .padding(.top)
                
                Text("Paste or type the QR code content manually")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                
                TextEditor(text: $text)
                    .padding(8)
                    .background(Color(.systemGray6))
                    .cornerRadius(8)
                    .frame(minHeight: 120)
                
                Button("Process QR Code") {
                    onSubmit(text)
                }
                .buttonStyle(.borderedProminent)
                .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                
                Spacer()
            }
            .padding()
        }
    }
}

// MARK: - Preview

#Preview {
    QRScannerView(
        onScanComplete: { paymentRequest in
            print("Scanned payment request: \(paymentRequest.walletId)")
        },
        onError: { error in
            print("Scan error: \(error.localizedDescription)")
        }
    )
}