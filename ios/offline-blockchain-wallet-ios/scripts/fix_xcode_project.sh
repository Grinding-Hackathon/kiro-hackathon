#!/bin/bash

# Fix Xcode Project Configuration Script
# This script removes problematic dynamic framework references from the Xcode project

echo "🔧 Fixing Xcode project configuration..."

# Navigate to project directory
cd "$(dirname "$0")/.."

# Backup the original project file
cp offline-blockchain-wallet-ios.xcodeproj/project.pbxproj offline-blockchain-wallet-ios.xcodeproj/project.pbxproj.backup

# Remove problematic dynamic framework references
echo "Removing AlamofireDynamic and QRCodeDynamic references..."

# Remove AlamofireDynamic references
sed -i '' '/AlamofireDynamic/d' offline-blockchain-wallet-ios.xcodeproj/project.pbxproj

# Remove QRCodeDynamic references  
sed -i '' '/QRCodeDynamic/d' offline-blockchain-wallet-ios.xcodeproj/project.pbxproj

# Remove QRCodeStatic references (we'll use the main QRCode instead)
sed -i '' '/QRCodeStatic/d' offline-blockchain-wallet-ios.xcodeproj/project.pbxproj

# Remove QRCodeDetector references (not needed for basic QR functionality)
sed -i '' '/QRCodeDetector/d' offline-blockchain-wallet-ios.xcodeproj/project.pbxproj

echo "✅ Xcode project configuration fixed!"
echo ""
echo "Next steps:"
echo "1. Open Xcode"
echo "2. Clean Build Folder (Cmd+Shift+K)"
echo "3. Build the project (Cmd+B)"
echo ""
echo "If you still have issues, you may need to:"
echo "1. Remove and re-add the package dependencies in Xcode"
echo "2. Go to File → Add Package Dependencies and add only the main packages"