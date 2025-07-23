#!/bin/bash

# GUID Conflict Fix Script
# This script attempts to fix duplicate GUID references in the Xcode project

echo "🔧 Fixing GUID conflicts in Xcode project..."
echo "============================================="

# Navigate to project directory
cd "$(dirname "$0")/.."

echo "Step 1: Backing up project file..."
cp offline-blockchain-wallet-ios.xcodeproj/project.pbxproj offline-blockchain-wallet-ios.xcodeproj/project.pbxproj.guid-backup

echo "Step 2: Complete cleanup of build artifacts..."
rm -rf ~/Library/Developer/Xcode/DerivedData/offline-blockchain-wallet-ios-*
rm -rf .build
rm -rf Package.resolved
rm -rf offline-blockchain-wallet-ios.xcodeproj/xcuserdata
rm -rf offline-blockchain-wallet-ios.xcodeproj/project.xcworkspace/xcuserdata

echo "Step 3: Resetting Swift Package Manager..."
swift package reset

echo "Step 4: Attempting to resolve packages..."
swift package resolve

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "Now try these steps in order:"
echo ""
echo "1. 🔄 Open Xcode and try to open the project"
echo "   - If it opens successfully, great!"
echo "   - If not, continue to step 2"
echo ""
echo "2. 🧹 In Xcode (if it opens):"
echo "   - File → Package Dependencies → Reset Package Caches"
echo "   - Product → Clean Build Folder"
echo "   - Close and reopen Xcode"
echo ""
echo "3. 📦 If packages are missing or duplicated:"
echo "   - File → Package Dependencies"
echo "   - Remove ALL packages"
echo "   - Add them back one by one:"
echo "     • https://github.com/Alamofire/Alamofire.git"
echo "     • https://github.com/dagronf/QRCode"
echo "     • https://github.com/krzyzanowskim/CryptoSwift.git"
echo "     • https://github.com/kishikawakatsumi/KeychainAccess.git"
echo "     • https://github.com/skywinder/web3swift.git"
echo "     • https://github.com/twostraws/CodeScanner.git"
echo ""
echo "4. 🚨 If the project still won't open:"
echo "   - Run: ./scripts/recover_project.sh"
echo "   - This will guide you through creating a fresh project"
echo ""
echo "Backup saved as: project.pbxproj.guid-backup"