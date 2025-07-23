# Xcode Setup Guide

## Quick Fix for Info.plist Error

The "Multiple commands produce Info.plist" error has been resolved by removing the manual Info.plist file. Follow these steps to complete the setup:

### Step 1: Open Project
1. Open `offline-blockchain-wallet-ios.xcodeproj` in Xcode
2. **Do NOT open Package.swift** - this will create conflicts

### Step 2: Configure Target Settings
1. Select the project file (blue icon) in the navigator
2. Select the target "offline-blockchain-wallet-ios"

### Step 3: Add Required Permissions
Go to the **Info** tab and add these custom properties:

| Key | Value |
|-----|-------|
| `NSCameraUsageDescription` | "This app needs camera access to scan QR codes for transactions." |
| `NSBluetoothAlwaysUsageDescription` | "This app uses Bluetooth to enable offline transactions between devices." |
| `NSBluetoothPeripheralUsageDescription` | "This app uses Bluetooth to enable offline transactions between devices." |
| `NSLocalNetworkUsageDescription` | "This app needs local network access to communicate with blockchain services." |
| `NSFaceIDUsageDescription` | "This app uses Face ID to secure access to your wallet and private keys." |

### Step 4: Configure Signing & Capabilities
1. Go to **Signing & Capabilities** tab
2. Select your development team
3. Ensure "Automatically manage signing" is checked
4. Add **Background Modes** capability with these modes:
   - `bluetooth-central`
   - `bluetooth-peripheral` 
   - `background-app-refresh`

### Step 5: Add Package Dependencies (REQUIRED)
The dependencies are not automatically added. You MUST add them manually:

1. Go to **File** → **Add Package Dependencies...**
2. Add these packages **one by one** (copy each URL exactly):

#### Package 1: CryptoSwift
- URL: `https://github.com/krzyzanowskim/CryptoSwift.git`
- Version: Up to Next Major (1.8.0)

#### Package 2: KeychainAccess  
- URL: `https://github.com/kishikawakatsumi/KeychainAccess.git`
- Version: Up to Next Major (4.2.2)

#### Package 3: Alamofire
- URL: `https://github.com/Alamofire/Alamofire.git`
- Version: Up to Next Major (5.8.1)

#### Package 4: web3swift
- URL: `https://github.com/skywinder/web3swift.git`
- Version: Up to Next Major (3.1.2)

#### Package 5: QRCode
- URL: `https://github.com/dagronf/QRCode`
- Version: Up to Next Major (17.0.0)

#### Package 6: CodeScanner
- URL: `https://github.com/twostraws/CodeScanner.git`
- Version: Up to Next Major (2.3.3)

3. For each package, click **Add Package** and then **Add Package** again to add it to your target

### Step 6: Build and Run
1. Clean build folder: **Product** → **Clean Build Folder** (⌘+Shift+K)
2. Select a simulator or device
3. Build and run (⌘+R)

## Common Issues

### Package Dependencies Not Resolving
- **File** → **Package Dependencies** → **Reset Package Caches**
- Restart Xcode
- Try adding packages manually

### Code Signing Errors
- Ensure you have a valid Apple Developer account
- Select the correct development team
- For device testing, ensure the device is registered

### Simulator Issues
- Use iOS 16.0+ simulator
- Reset simulator if needed: **Device** → **Erase All Content and Settings**

### Build Errors
- Check the error console for specific issues
- Ensure all files are properly added to the target
- Verify deployment target is set to iOS 16.0

## Success Indicators

When everything is configured correctly:
- ✅ No Info.plist errors
- ✅ All package dependencies resolved
- ✅ App builds without errors
- ✅ App launches on simulator/device
- ✅ Tab navigation works
- ✅ No permission-related crashes

## Need Help?

Check `TROUBLESHOOTING.md` for more detailed solutions to common issues.