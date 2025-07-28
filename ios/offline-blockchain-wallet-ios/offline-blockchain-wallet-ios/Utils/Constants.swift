//
//  Constants.swift
//  offline-blockchain-wallet-ios
//
//  Created by Kiro on 7/21/25.
//

import Foundation

struct Constants {
    
    // MARK: - App Configuration
    struct App {
        static let name = "Offline Blockchain Wallet"
        static let version = "1.0.0"
        static let bundleIdentifier = "com.offlineblockchainwallet.ios"
    }
    
    // MARK: - Network Configuration
    struct Network {
        static let baseURL = "https://api.offlineblockchainwallet.com"
        static let timeout: TimeInterval = 30.0
        static let retryAttempts = 3
    }
    
    // MARK: - Blockchain Configuration
    struct Blockchain {
        static let defaultChainId = 1 // Ethereum Mainnet
        static let testnetChainId = 5 // Goerli Testnet
        static let gasLimit = 21000
        static let gasPriceMultiplier = 1.2
    }
    
    // MARK: - Bluetooth Configuration
    struct Bluetooth {
        static let serviceUUID = "12345678-1234-1234-1234-123456789ABC"
        static let characteristicUUID = "87654321-4321-4321-4321-CBA987654321"
        static let scanTimeout: TimeInterval = 30.0
        static let connectionTimeout: TimeInterval = 10.0
    }
    
    // MARK: - Token Configuration
    struct Token {
        static let defaultExpirationDays = 30
        static let maxTokenAmount = 10000.0
        static let minTokenAmount = 0.01
        static let autoRechargeThreshold = 50.0
        static let autoRechargeAmount = 200.0
    }
    
    // MARK: - Security Configuration
    struct Security {
        static let keychainService = "com.offlineblockchainwallet.keys"
        static let biometricPrompt = "Authenticate to access your wallet"
        static let maxFailedAttempts = 5
        static let lockoutDuration: TimeInterval = 300 // 5 minutes
    }
    
    // MARK: - UI Configuration
    struct UI {
        static let animationDuration = 0.3
        static let cornerRadius = 12.0
        static let shadowRadius = 4.0
        static let shadowOpacity = 0.1
    }
    
    // MARK: - Storage Configuration
    struct Storage {
        static let coreDataModelName = "WalletDataModel"
        static let maxCacheSize = 100 * 1024 * 1024 // 100MB
        static let backupInterval: TimeInterval = 3600 // 1 hour
    }
}