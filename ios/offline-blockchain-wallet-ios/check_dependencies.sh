#!/bin/bash

# Script to check if all required dependencies are properly added to the Xcode project

PROJECT_FILE="offline-blockchain-wallet-ios.xcodeproj"
PBXPROJ_FILE="$PROJECT_FILE/project.pbxproj"

echo "🔍 Checking Package Dependencies..."

# List of required packages
REQUIRED_PACKAGES=(
    "CryptoSwift"
    "KeychainAccess" 
    "Alamofire"
    "web3swift"
    "QRCode"
    "CodeScanner"
)

# Check if packages are referenced in project file
echo "📦 Checking project file for package references..."

for package in "${REQUIRED_PACKAGES[@]}"; do
    if grep -q "$package" "$PBXPROJ_FILE" 2>/dev/null; then
        echo "✅ $package - Found in project"
    else
        echo "❌ $package - NOT found in project"
    fi
done

echo ""
echo "📋 If any packages show ❌, you need to add them manually in Xcode:"
echo "1. File → Add Package Dependencies"
echo "2. Add the missing packages from XCODE_SETUP.md"
echo ""
echo "🔧 After adding packages, clean and rebuild:"
echo "   Product → Clean Build Folder (⌘+Shift+K)"
echo "   Product → Build (⌘+B)"