//
//  QRScannerView.swift
//  offline-blockchain-wallet-ios
//
//  Created by Kiro on 7/21/25.
//

import SwiftUI
import CodeScanner

struct QRScannerView: View {
    @Environment(\.dismiss) private var dismiss
    let onScanComplete: (String) -> Void
    
    var body: some View {
        NavigationView {
            CodeScannerView(
                codeTypes: [.qr],
                scanMode: .once,
                manualSelect: false,
                scanInterval: 0.1,
                showViewfinder: true
            ) { result in
                switch result {
                case .success(let code):
                    onScanComplete(code.string)
                    dismiss()
                case .failure(let error):
                    print("QR Scanning failed: \(error.localizedDescription)")
                    dismiss()
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
            }
        }
    }
}

#Preview {
    QRScannerView { code in
        print("Scanned: \(code)")
    }
}