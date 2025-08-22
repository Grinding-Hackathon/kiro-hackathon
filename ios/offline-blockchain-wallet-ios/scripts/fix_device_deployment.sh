#!/bin/bash

echo "🔧 Fixing iOS device deployment issues..."

# Navigate to project directory
cd "$(dirname "$0")/.."

# Clean all build artifacts
echo "🧹 Cleaning build artifacts..."
rm -rf .build
rm -rf DerivedData
rm -rf ~/Library/Developer/Xcode/DerivedData/offline-blockchain-wallet-ios-*

# Clean Xcode build folder
echo "🧹 Cleaning Xcode build folder..."
xcodebuild clean -project offline-blockchain-wallet-ios.xcodeproj -scheme offline-blockchain-wallet-ios

# Resolve package dependencies
echo "📦 Resolving package dependencies..."
xcodebuild -resolvePackageDependencies -project offline-blockchain-wallet-ios.xcodeproj

# Build for device
echo "🔨 Building for device..."
xcodebuild build -project offline-blockchain-wallet-ios.xcodeproj -scheme offline-blockchain-wallet-ios -destination 'generic/platform=iOS'

if [ $? -eq 0 ]; then
    echo "✅ Device build successful!"
    echo ""
    echo "Next steps:"
    echo "1. Open Xcode"
    echo "2. Select your physical device as the target"
    echo "3. Build and run (Cmd+R)"
    echo ""
    echo "If you still encounter issues:"
    echo "1. In Xcode, go to Product → Clean Build Folder"
    echo "2. Go to File → Packages → Reset Package Caches"
    echo "3. Try building again"
else
    echo "❌ Build failed. Check the output above for errors."
    exit 1
fi