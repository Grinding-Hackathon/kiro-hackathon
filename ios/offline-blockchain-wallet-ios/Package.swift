// swift-tools-version:5.7
import PackageDescription

let package = Package(
    name: "OfflineBlockchainWallet",
    platforms: [
        .iOS(.v16),
        .macOS(.v12)
    ],
    products: [
        .library(
            name: "OfflineBlockchainWallet",
            targets: ["OfflineBlockchainWallet"]
        ),
    ],
    dependencies: [
        // Web3Swift for Ethereum blockchain interactions
        .package(url: "https://github.com/skywinder/web3swift.git", from: "3.1.2"),
        
        // KeychainAccess for secure key storage
        .package(url: "https://github.com/kishikawakatsumi/KeychainAccess.git", from: "4.2.2"),
        
        // QRCode for QR code generation and scanning
        .package(url: "https://github.com/dagronf/QRCode", from: "17.0.0"),
        
        // CodeScanner for QR code scanning
        .package(url: "https://github.com/twostraws/CodeScanner.git", from: "2.3.3"),
        
        // CryptoSwift for additional cryptographic operations
        .package(url: "https://github.com/krzyzanowskim/CryptoSwift.git", from: "1.8.0"),
        
        // Alamofire for HTTP networking
        .package(url: "https://github.com/Alamofire/Alamofire.git", from: "5.8.1")
    ],
    targets: [
        .target(
            name: "OfflineBlockchainWallet",
            dependencies: [
                .product(name: "web3swift", package: "web3swift"),
                .product(name: "KeychainAccess", package: "KeychainAccess"),
                .product(name: "QRCode", package: "QRCode"),
                .product(name: "CodeScanner", package: "CodeScanner"),
                .product(name: "CryptoSwift", package: "CryptoSwift"),
                .product(name: "Alamofire", package: "Alamofire")
            ],
            path: "offline-blockchain-wallet-ios"
        ),
        .testTarget(
            name: "OfflineBlockchainWalletTests",
            dependencies: ["OfflineBlockchainWallet"],
            path: "Tests/OfflineBlockchainWalletTests"
        ),
    ]
)