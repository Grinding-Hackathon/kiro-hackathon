#!/bin/bash

# Clean Dependencies Script for Offline Blockchain Wallet iOS
# This script cleans up build artifacts and resets Swift Package Manager dependencies

echo "🧹 Cleaning up build artifacts and dependencies..."

# Navigate to project directory
cd "$(dirname "$0")/.."

# Clean derived data (if using Xcode)
echo "Cleaning Xcode derived data..."
rm -rf ~/Library/Developer/Xcode/DerivedData/offline-blockchain-wallet-ios-*

# Clean Swift Package Manager build artifacts
echo "Cleaning Swift Package Manager artifacts..."
rm -rf .build
rm -rf Package.resolved

# Clean Xcode build folder
echo "Cleaning Xcode build folder..."
if [ -d "offline-blockchain-wallet-ios.xcodeproj" ]; then
    xcodebuild clean -project offline-blockchain-wallet-ios.xcodeproj -scheme offline-blockchain-wallet-ios
fi

# Reset Swift Package Manager
echo "Resetting Swift Package Manager..."
swift package reset
swift package resolve

echo "✅ Cleanup complete!"
echo ""
echo "Next steps:"
echo "1. Open Xcode"
echo "2. Go to File > Packages > Reset Package Caches"
echo "3. Clean Build Folder (Cmd+Shift+K)"
echo "4. Build the project (Cmd+B)"