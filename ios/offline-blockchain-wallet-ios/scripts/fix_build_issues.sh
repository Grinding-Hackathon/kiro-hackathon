#!/bin/bash

# Comprehensive Build Issues Fix Script
# This script fixes common build issues including missing frameworks and dependency problems

echo "🚀 Fixing all build issues..."

# Navigate to project directory
cd "$(dirname "$0")/.."

echo "Step 1: Cleaning up dependencies and build artifacts..."
./scripts/clean_dependencies.sh

echo ""
echo "Step 2: Fixing Xcode project configuration..."
./scripts/fix_xcode_project.sh

echo ""
echo "Step 3: Additional cleanup..."

# Remove any remaining problematic build artifacts
rm -rf ~/Library/Developer/Xcode/DerivedData/offline-blockchain-wallet-ios-*

# Clean up any Xcode user data that might be causing issues
if [ -d "offline-blockchain-wallet-ios.xcodeproj/xcuserdata" ]; then
    echo "Cleaning Xcode user data..."
    rm -rf offline-blockchain-wallet-ios.xcodeproj/xcuserdata
fi

echo ""
echo "🎉 All fixes applied successfully!"
echo ""
echo "Final steps to complete the fix:"
echo "1. Open Xcode"
echo "2. File → Packages → Reset Package Caches"
echo "3. Product → Clean Build Folder (Cmd+Shift+K)"
echo "4. Product → Build (Cmd+B)"
echo ""
echo "If you still encounter issues:"
echo "1. In Xcode, go to File → Add Package Dependencies"
echo "2. Remove any existing packages that show errors"
echo "3. Re-add only these main packages:"
echo "   - https://github.com/Alamofire/Alamofire.git"
echo "   - https://github.com/dagronf/QRCode"
echo "   - https://github.com/krzyzanowskim/CryptoSwift.git"
echo "   - https://github.com/kishikawakatsumi/KeychainAccess.git"
echo "   - https://github.com/skywinder/web3swift.git"
echo "   - https://github.com/twostraws/CodeScanner.git"