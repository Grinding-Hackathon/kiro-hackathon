//
//  BuildConfiguration.swift
//  offline-blockchain-wallet-ios
//
//  Created by Kiro on 7/21/25.
//

import Foundation

struct BuildConfiguration {
    static let shared = BuildConfiguration()
    
    private init() {}
    
    // MARK: - Build Settings
    var isDebug: Bool {
        #if DEBUG
        return true
        #else
        return false
        #endif
    }
    
    var isRelease: Bool {
        return !isDebug
    }
    
    // MARK: - API Configuration
    var apiBaseURL: String {
        if isDebug {
            return "https://api-dev.offlineblockchainwallet.com"
        } else {
            return "https://api.offlineblockchainwallet.com"
        }
    }
    
    var blockchainNetworkURL: String {
        if isDebug {
            return "https://sepolia.infura.io/v3/YOUR_PROJECT_ID"
        } else {
            return "https://mainnet.infura.io/v3/YOUR_PROJECT_ID"
        }
    }
    
    // MARK: - App Configuration
    var appVersion: String {
        return Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
    }
    
    var buildNumber: String {
        return Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
    }
    
    var bundleIdentifier: String {
        return Bundle.main.bundleIdentifier ?? "com.offlineblockchainwallet.ios"
    }
    
    // MARK: - Feature Flags
    var enableBiometricAuth: Bool {
        return true
    }
    
    var enableAutoRecharge: Bool {
        return true
    }
    
    var enableBluetoothTransactions: Bool {
        return true
    }
    
    var enableQRCodeScanning: Bool {
        return true
    }
    
    // MARK: - Logging Configuration
    var logLevel: LogLevel {
        if isDebug {
            return .debug
        } else {
            return .error
        }
    }
    
    var enableCrashReporting: Bool {
        return isRelease
    }
    
    var enableAnalytics: Bool {
        return isRelease
    }
}

// LogLevel enum moved to Logger.swift to avoid duplication
// Use LogLevel directly for logging configuration