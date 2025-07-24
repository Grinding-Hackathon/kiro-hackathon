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
    
    var body: some View {
        NavigationView {
            ZStack {
                // Camera view - simplified for cross-platform compatibility
                VStack {
                    Text("QR Scanner")
                        .font(.title2)
                        .padding()
                    
                    Text("Camera scanning not available in this build")
                        .foregroundColor(.secondary)
                        .padding()
                    
                    Button("Simulate QR Scan") {
                        // For testing purposes - simulate a valid QR code
                        let mockPaymentRequest = QRCodePaymentRequest(
                            walletId: "mock-wallet-id",
                            publicKey: "mock-public-key",
                            deviceName: "Mock Device",
                            bluetoothInfo: BluetoothConnectionInfo()
                        )
                        onScanComplete(mockPaymentRequest)
                        dismiss()
                    }
                    .buttonStyle(.borderedProminent)
                    .padding()
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Color.black.opacity(0.1))
                
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
                
                // Viewfinder overlay with instructions
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
                        Image(systemName: viewModel.isFlashlightOn ? "flashlight.on.fill" : "flashlight.off.fill")
                    }
                    .disabled(!viewModel.isFlashlightAvailable)
                }
            }
        }
        .alert("QR Code Error", isPresented: $showingAlert) {
            Button("OK") { }
        } message: {
            Text(alertMessage)
        }
        .onAppear {
            viewModel.checkFlashlightAvailability()
        }
        .onDisappear {
            viewModel.turnOffFlashlight()
        }
    }
    
    // Simplified for cross-platform compatibility
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
        viewModel.toggleFlashlight()
    }
}

// MARK: - QR Scanner ViewModel

class QRScannerViewModel: ObservableObject {
    @Published var isFlashlightOn = false
    @Published var isFlashlightAvailable = false
    
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
    
    func checkFlashlightAvailability() {
        guard let device = AVCaptureDevice.default(for: .video) else {
            isFlashlightAvailable = false
            return
        }
        isFlashlightAvailable = device.hasTorch
    }
    
    func toggleFlashlight() {
        guard let device = AVCaptureDevice.default(for: .video), device.hasTorch else {
            return
        }
        
        do {
            try device.lockForConfiguration()
            
            if isFlashlightOn {
                device.torchMode = .off
                isFlashlightOn = false
            } else {
                try device.setTorchModeOn(level: 1.0)
                isFlashlightOn = true
            }
            
            device.unlockForConfiguration()
        } catch {
            logger.log("Failed to toggle flashlight: \(error.localizedDescription)", level: .error)
        }
    }
    
    func turnOffFlashlight() {
        guard let device = AVCaptureDevice.default(for: .video), device.hasTorch, isFlashlightOn else {
            return
        }
        
        do {
            try device.lockForConfiguration()
            device.torchMode = .off
            device.unlockForConfiguration()
            isFlashlightOn = false
        } catch {
            logger.log("Failed to turn off flashlight: \(error.localizedDescription)", level: .error)
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