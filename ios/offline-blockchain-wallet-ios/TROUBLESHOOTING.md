# Troubleshooting Guide

## Common Build Issues

### Multiple commands produce Info.plist

**Error**: `Multiple commands produce '/Users/.../Info.plist'`

**Cause**: Xcode is trying to auto-generate an Info.plist while a manual one exists.

**Solution**: The manual Info.plist has been removed. Xcode will now auto-generate it. You need to configure the app settings in Xcode:

1. In Xcode, select the project file in the navigator
2. Select the target "offline-blockchain-wallet-ios"
3. Go to "Info" tab
4. Add the following custom properties:
   - **NSCameraUsageDescription**: "This app needs camera access to scan QR codes for transactions."
   - **NSBluetoothAlwaysUsageDescription**: "This app uses Bluetooth to enable offline transactions between devices."
   - **NSBluetoothPeripheralUsageDescription**: "This app uses Bluetooth to enable offline transactions between devices."
   - **NSLocalNetworkUsageDescription**: "This app needs local network access to communicate with blockchain services."
   - **NSFaceIDUsageDescription**: "This app uses Face ID to secure access to your wallet and private keys."
5. In "Signing & Capabilities" tab, add:
   - **Background Modes**: bluetooth-central, bluetooth-peripheral, background-app-refresh

### "No such module 'CryptoSwift'" or Similar Import Errors

**Error**: `No such module 'CryptoSwift'`, `No such module 'KeychainAccess'`, etc.

**Cause**: Package dependencies are not added to the Xcode project.

**Solution**:
1. Open `offline-blockchain-wallet-ios.xcodeproj` in Xcode (NOT Package.swift)
2. Go to **File** → **Add Package Dependencies...**
3. Add each package manually:
   - `https://github.com/krzyzanowskim/CryptoSwift.git`
   - `https://github.com/kishikawakatsumi/KeychainAccess.git`
   - `https://github.com/Alamofire/Alamofire.git`
   - `https://github.com/skywinder/web3swift.git`
   - `https://github.com/dagronf/QRCode`
   - `https://github.com/twostraws/CodeScanner.git`
4. Clean build folder: Product → Clean Build Folder
5. Build project: Product → Build

### Project Corruption - GUID Conflicts

**Error**: `The workspace contains multiple references with the same GUID` or `unable to load transferred PIF`

**Cause**: Xcode project file has duplicate GUID references, usually from corrupted package dependencies.

**Solution**:
```bash
./scripts/fix_guid_conflicts.sh
```

**Manual Fix in Xcode**:
1. Open the project in Xcode
2. Select the project in the navigator
3. Go to the target settings
4. Look for "Embedded Content" or duplicate package references
5. Remove any duplicate or conflicting embedded content entries
6. Clean Build Folder and rebuild

**If project still won't open**:
```bash
./scripts/recover_project.sh
```

### Missing Framework Files (QRCodeDynamic, AlamofireDynamic)

**Error**: `no such file or directory: '.../QRCodeDynamic.framework/QRCodeDynamic'` or similar for `AlamofireDynamic.framework`

**Cause**: Xcode project is trying to link against dynamic framework variants that don't exist or aren't properly built.

**Quick Fix**:
```bash
./scripts/fix_build_issues.sh
```

**Manual Solution**:
1. Run the dependency cleanup script: `./scripts/clean_dependencies.sh`
2. Fix Xcode project configuration: `./scripts/fix_xcode_project.sh`
3. In Xcode: File → Package Dependencies → Reset Package Caches
4. Clean build folder: Product → Clean Build Folder
5. Build project: Product → Build

### Swift Package Manager Dependencies Not Resolving

**Error**: Package dependencies not found or failing to resolve

**Solution**:
1. Run the comprehensive fix: `./scripts/fix_build_issues.sh`
2. In Xcode: File → Package Dependencies → Reset Package Caches
3. Clean build folder: Product → Clean Build Folder
4. Restart Xcode
5. If still failing, remove and re-add the problematic package

**Alternative Manual Solution**:
```bash
# Clean derived data
rm -rf ~/Library/Developer/Xcode/DerivedData/offline-blockchain-wallet-ios-*

# Clean Swift Package Manager artifacts
rm -rf .build
rm -rf Package.resolved

# Reset and resolve packages
swift package reset
swift package resolve
```

### Code Signing Issues

**Error**: Code signing errors during build

**Solution**:
1. Select your development team in project settings
2. Ensure "Automatically manage signing" is enabled for development
3. For release builds, configure proper provisioning profiles

### Simulator Issues

**Error**: App crashes on simulator launch

**Solution**:
1. Reset simulator: Device → Erase All Content and Settings
2. Ensure deployment target matches simulator iOS version
3. Check console logs for specific error messages

## Build Configuration

### Debug Build
```bash
./scripts/build.sh build
```

### Release Build
```bash
./scripts/build.sh release
```

### Run Tests
```bash
./scripts/build.sh test
```

### Clean Build
```bash
./scripts/build.sh clean
```

## Xcode Project Setup

1. Open `offline-blockchain-wallet-ios.xcodeproj` in Xcode
2. Select your development team in project settings
3. Ensure iOS deployment target is set to 16.0 or higher
4. Build and run on simulator or device

## Common Development Issues

### Missing Permissions
Ensure all required permissions are added to Info.plist:
- Camera usage (for QR scanning)
- Bluetooth usage (for offline transactions)
- Face ID usage (for authentication)

### Core Data Issues
If Core Data model changes cause crashes:
1. Delete app from simulator/device
2. Clean build folder
3. Rebuild and reinstall

### Dependency Conflicts
If package dependencies conflict:
1. Update Package.swift versions
2. Reset package caches
3. Resolve package versions manually if needed