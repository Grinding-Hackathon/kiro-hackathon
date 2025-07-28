# Offline Blockchain Wallet - iOS App

This is the iOS application for the Offline Blockchain Wallet system, built with SwiftUI and following MVVM architecture patterns.

## Features

- **Offline Token Management**: Store and manage offline tokens for transactions without internet connectivity
- **Bluetooth Transactions**: Peer-to-peer transactions using Bluetooth Low Energy
- **QR Code Support**: Generate and scan QR codes for wallet addresses and transaction data
- **Secure Storage**: Private keys stored securely in iOS Keychain
- **Auto-recharge**: Automatic token purchase when balance falls below threshold
- **Transaction History**: Complete history of all transactions with filtering and search

## Architecture

The app follows MVVM (Model-View-ViewModel) architecture with dependency injection:

### Models
- `OfflineToken`: Represents offline tokens with cryptographic signatures
- `Transaction`: Transaction data with metadata and status tracking
- `TokenDivision`: Handles token splitting for change-making

### Views (SwiftUI)
- `WalletView`: Main wallet interface showing balances and quick actions
- `TransactionView`: Transaction creation and history management
- `SettingsView`: App configuration and wallet settings
- `QRScannerView`: QR code scanning functionality

### ViewModels
- `WalletViewModel`: Manages wallet state, balances, and auto-recharge
- `TransactionViewModel`: Handles transaction creation and history

### Services
- `CryptographyService`: Key generation, signing, and encryption
- `NetworkService`: Blockchain communication and API calls
- `StorageService`: Core Data persistence layer
- `BluetoothService`: Bluetooth Low Energy communication
- `OfflineTokenService`: Token validation and management

## Dependencies

The project uses Swift Package Manager (SPM) for dependency management:

- **web3swift**: Ethereum blockchain interactions
- **KeychainAccess**: Secure key storage
- **QRCode**: QR code generation
- **CodeScanner**: QR code scanning
- **CryptoSwift**: Additional cryptographic operations
- **Alamofire**: HTTP networking

## Requirements

- iOS 16.0+
- Xcode 15.0+
- Swift 5.7+

## Permissions

The app requires the following permissions:
- Camera access for QR code scanning
- Bluetooth access for offline transactions
- Local network access for blockchain communication
- Face ID/Touch ID for secure authentication

## Build Configuration

### Quick Setup
1. Open `offline-blockchain-wallet-ios.xcodeproj` in Xcode
2. Select your development team in project settings (Signing & Capabilities tab)
3. Add required permissions in the Info tab (see TROUBLESHOOTING.md for details)
4. Choose a simulator or device target
5. Build and run (⌘+R)

### Manual Setup
If you encounter build issues:
1. Clean derived data: `rm -rf ~/Library/Developer/Xcode/DerivedData/offline-blockchain-wallet-ios-*`
2. In Xcode, go to File → Add Package Dependencies
3. Add the following packages:
   - `https://github.com/skywinder/web3swift.git`
   - `https://github.com/kishikawakatsumi/KeychainAccess.git`
   - `https://github.com/dagronf/QRCode`
   - `https://github.com/twostraws/CodeScanner.git`
   - `https://github.com/krzyzanowskim/CryptoSwift.git`
   - `https://github.com/Alamofire/Alamofire.git`

### Common Issues
- **Multiple commands produce Info.plist**: Run `./configure_project.sh` to fix
- **Package dependencies not found**: Ensure you're opening the `.xcodeproj` file, not Package.swift
- **Build errors**: Clean build folder (⌘+Shift+K) and rebuild

## Testing

Unit tests are included for core services and can be run using:
```bash
# Using Xcode
⌘+U in Xcode

# Using command line
xcodebuild test -project offline-blockchain-wallet-ios.xcodeproj -scheme offline-blockchain-wallet-ios -destination 'platform=iOS Simulator,name=iPhone 15,OS=latest'
```

## Security

- Private keys are stored in iOS Keychain
- All transactions are cryptographically signed
- Biometric authentication for sensitive operations
- Network traffic uses TLS encryption