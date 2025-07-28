#!/bin/bash

# Project Recovery Script
# This script completely rebuilds the Xcode project to fix GUID conflicts and corruption

echo "🚨 Project Recovery - Fixing GUID conflicts and corruption"
echo "=========================================================="
echo ""

# Navigate to project directory
cd "$(dirname "$0")/.."

echo "Step 1: Backing up current project state..."
cp -r offline-blockchain-wallet-ios.xcodeproj offline-blockchain-wallet-ios.xcodeproj.corrupted-backup

echo "Step 2: Complete cleanup..."
# Remove all build artifacts and caches
rm -rf ~/Library/Developer/Xcode/DerivedData/offline-blockchain-wallet-ios-*
rm -rf .build
rm -rf Package.resolved
rm -rf offline-blockchain-wallet-ios.xcodeproj/xcuserdata
rm -rf offline-blockchain-wallet-ios.xcodeproj/project.xcworkspace/xcuserdata

echo "Step 3: Reset Swift Package Manager completely..."
swift package reset

echo "Step 4: Creating a fresh Xcode project..."
# We'll need to recreate the project from scratch
echo ""
echo "⚠️  MANUAL STEPS REQUIRED:"
echo ""
echo "The project has severe corruption. You need to:"
echo ""
echo "1. 🗑️  Delete the corrupted project:"
echo "   rm -rf offline-blockchain-wallet-ios.xcodeproj"
echo ""
echo "2. 📱 Create a new iOS project in Xcode:"
echo "   - Open Xcode"
echo "   - File → New → Project"
echo "   - iOS → App"
echo "   - Product Name: offline-blockchain-wallet-ios"
echo "   - Bundle Identifier: com.offlineblockchainwallet.ios"
echo "   - Language: Swift"
echo "   - Interface: SwiftUI"
echo "   - Use Core Data: ✓"
echo "   - Save in: $(pwd)"
echo ""
echo "3. 📦 Add package dependencies:"
echo "   - File → Add Package Dependencies"
echo "   - Add each package:"
echo "     • https://github.com/Alamofire/Alamofire.git"
echo "     • https://github.com/dagronf/QRCode"
echo "     • https://github.com/krzyzanowskim/CryptoSwift.git"
echo "     • https://github.com/kishikawakatsumi/KeychainAccess.git"
echo "     • https://github.com/skywinder/web3swift.git"
echo "     • https://github.com/twostraws/CodeScanner.git"
echo ""
echo "4. 🔧 Configure project settings:"
echo "   - Select project → Target → Info"
echo "   - Add custom properties:"
echo "     • NSCameraUsageDescription: 'Camera access for QR scanning'"
echo "     • NSBluetoothAlwaysUsageDescription: 'Bluetooth for offline transactions'"
echo "     • NSFaceIDUsageDescription: 'Face ID for wallet security'"
echo ""
echo "5. 📁 Copy your source files:"
echo "   - Delete the default ContentView.swift and App.swift"
echo "   - Copy all files from offline-blockchain-wallet-ios/ folder"
echo "   - Add them to the project in Xcode"
echo ""
echo "6. 🏗️ Build and test"
echo ""
echo "This is the safest way to recover from project corruption."
echo "The backup is saved as offline-blockchain-wallet-ios.xcodeproj.corrupted-backup"