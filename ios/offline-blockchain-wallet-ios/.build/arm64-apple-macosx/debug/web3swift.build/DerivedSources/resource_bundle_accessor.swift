import Foundation

extension Foundation.Bundle {
    static let module: Bundle = {
        let mainPath = Bundle.main.bundleURL.appendingPathComponent("Web3swift_web3swift.bundle").path
        let buildPath = "/Users/dannysantoso/Desktop/Kiro-Hackathon/ios/offline-blockchain-wallet-ios/.build/arm64-apple-macosx/debug/Web3swift_web3swift.bundle"

        let preferredBundle = Bundle(path: mainPath)

        guard let bundle = preferredBundle ?? Bundle(path: buildPath) else {
            // Users can write a function called fatalError themselves, we should be resilient against that.
            Swift.fatalError("could not load resource bundle: from \(mainPath) or \(buildPath)")
        }

        return bundle
    }()
}