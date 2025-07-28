//
//  ErrorHandler.swift
//  offline-blockchain-wallet-ios
//
//  Created by Kiro on 7/21/25.
//

import Foundation
import SwiftUI

protocol AppError: Error {
    var title: String { get }
    var message: String { get }
    var isRecoverable: Bool { get }
    var suggestedAction: String? { get }
}

enum WalletError: AppError {
    case insufficientBalance(available: Double, required: Double)
    case tokenExpired(tokenId: String)
    case invalidTransaction(reason: String)
    case networkUnavailable
    case bluetoothUnavailable
    case authenticationFailed
    case cryptographyError(CryptographyError)
    case storageError(StorageError)
    case unknownError(Error)
    
    var title: String {
        switch self {
        case .insufficientBalance:
            return "Insufficient Balance"
        case .tokenExpired:
            return "Token Expired"
        case .invalidTransaction:
            return "Invalid Transaction"
        case .networkUnavailable:
            return "Network Unavailable"
        case .bluetoothUnavailable:
            return "Bluetooth Unavailable"
        case .authenticationFailed:
            return "Authentication Failed"
        case .cryptographyError:
            return "Security Error"
        case .storageError:
            return "Storage Error"
        case .unknownError:
            return "Unexpected Error"
        }
    }
    
    var message: String {
        switch self {
        case .insufficientBalance(let available, let required):
            return "You have \(String(format: "%.2f", available)) but need \(String(format: "%.2f", required)) for this transaction."
        case .tokenExpired(let tokenId):
            return "Token \(tokenId) has expired and cannot be used."
        case .invalidTransaction(let reason):
            return "Transaction failed: \(reason)"
        case .networkUnavailable:
            return "Network connection is not available. Please check your internet connection."
        case .bluetoothUnavailable:
            return "Bluetooth is not available or disabled. Please enable Bluetooth to use offline features."
        case .authenticationFailed:
            return "Authentication failed. Please try again."
        case .cryptographyError(let error):
            return "Security operation failed: \(error.localizedDescription)"
        case .storageError(let error):
            return "Storage operation failed: \(error.localizedDescription)"
        case .unknownError(let error):
            return "An unexpected error occurred: \(error.localizedDescription)"
        }
    }
    
    var isRecoverable: Bool {
        switch self {
        case .insufficientBalance, .tokenExpired, .invalidTransaction:
            return true
        case .networkUnavailable, .bluetoothUnavailable:
            return true
        case .authenticationFailed:
            return true
        case .cryptographyError, .storageError, .unknownError:
            return false
        }
    }
    
    var suggestedAction: String? {
        switch self {
        case .insufficientBalance:
            return "Purchase more offline tokens or use a different payment method."
        case .tokenExpired:
            return "Purchase new tokens to continue using offline features."
        case .invalidTransaction:
            return "Please verify transaction details and try again."
        case .networkUnavailable:
            return "Check your internet connection and try again."
        case .bluetoothUnavailable:
            return "Enable Bluetooth in Settings to use offline features."
        case .authenticationFailed:
            return "Try authenticating again or contact support."
        case .cryptographyError, .storageError, .unknownError:
            return "Please restart the app or contact support if the problem persists."
        }
    }
}

class ErrorHandler {
    static let shared = ErrorHandler()
    
    private init() {}
    
    func handle(_ error: Error, context: String? = nil) {
        let walletError = mapToWalletError(error)
        
        // Log the error
        Logger.shared.error("Error in \(context ?? "unknown context")", error: error)
        
        // Handle based on error type
        if walletError.isRecoverable {
            handleRecoverableError(walletError)
        } else {
            handleCriticalError(walletError)
        }
    }
    
    private func mapToWalletError(_ error: Error) -> WalletError {
        if let walletError = error as? WalletError {
            return walletError
        }
        
        if let cryptoError = error as? CryptographyError {
            return .cryptographyError(cryptoError)
        }
        
        if let storageError = error as? StorageError {
            return .storageError(storageError)
        }
        
        return .unknownError(error)
    }
    
    private func handleRecoverableError(_ error: WalletError) {
        // Post notification for UI to handle
        NotificationCenter.default.post(
            name: .walletErrorOccurred,
            object: error
        )
    }
    
    private func handleCriticalError(_ error: WalletError) {
        // Log critical error
        Logger.shared.critical("Critical error occurred: \(error.message)")
        
        // Post notification for UI to handle
        NotificationCenter.default.post(
            name: .walletCriticalErrorOccurred,
            object: error
        )
    }
}

// MARK: - Notification Names
extension Notification.Name {
    static let walletErrorOccurred = Notification.Name("WalletErrorOccurred")
    static let walletCriticalErrorOccurred = Notification.Name("WalletCriticalErrorOccurred")
}

// MARK: - SwiftUI Error Handling
struct ErrorAlert: ViewModifier {
    @State private var showingError = false
    @State private var currentError: WalletError?
    
    func body(content: Content) -> some View {
        content
            .onReceive(NotificationCenter.default.publisher(for: .walletErrorOccurred)) { notification in
                if let error = notification.object as? WalletError {
                    currentError = error
                    showingError = true
                }
            }
            .alert(currentError?.title ?? "Error", isPresented: $showingError) {
                Button("OK") {
                    showingError = false
                    currentError = nil
                }
                
                if let suggestedAction = currentError?.suggestedAction {
                    Button("Help") {
                        // Handle help action
                        showingError = false
                        currentError = nil
                    }
                }
            } message: {
                Text(currentError?.message ?? "An error occurred")
            }
    }
}

extension View {
    func handleWalletErrors() -> some View {
        modifier(ErrorAlert())
    }
}