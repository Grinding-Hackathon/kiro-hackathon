#!/bin/bash

echo "🔍 Verifying iOS project dependencies..."

# Navigate to project directory
cd "$(dirname "$0")/.."

echo ""
echo "📋 Current Package Dependencies:"
echo "================================"

# Check Package.swift dependencies
if [ -f "Package.swift" ]; then
    echo "From Package.swift:"
    grep -A 20 "dependencies:" Package.swift | grep "\.package" | sed 's/^[[:space:]]*/  - /'
fi

echo ""
echo "📋 Xcode Project Package References:"
echo "===================================="

# Check Xcode project for package references
if [ -f "offline-blockchain-wallet-ios.xcodeproj/project.pbxproj" ]; then
    echo "Package products in Xcode project:"
    grep "productName" offline-blockchain-wallet-ios.xcodeproj/project.pbxproj | sed 's/.*productName = \(.*\);/  - \1/' | sort | uniq
fi

echo ""
echo "🔍 Checking for problematic references:"
echo "======================================"

# Check for any remaining QRCodeDetector references
if grep -r "QRCodeDetector" offline-blockchain-wallet-ios.xcodeproj/ 2>/dev/null; then
    echo "❌ Found QRCodeDetector references (should be removed)"
else
    echo "✅ No QRCodeDetector references found"
fi

# Check for Dynamic framework references
if grep -r "Dynamic" offline-blockchain-wallet-ios.xcodeproj/ 2>/dev/null; then
    echo "⚠️  Found Dynamic framework references (may cause device deployment issues)"
else
    echo "✅ No problematic Dynamic framework references found"
fi

echo ""
echo "📱 Recommended action:"
echo "====================="
echo "1. Run: ./scripts/fix_device_deployment.sh"
echo "2. Open Xcode and clean build folder (Cmd+Shift+K)"
echo "3. Build for your device (Cmd+R)"