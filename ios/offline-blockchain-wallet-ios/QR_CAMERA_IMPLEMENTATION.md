# QR Code Camera Implementation

## Overview
Updated the QR scanner to use real camera functionality instead of mock simulation buttons.

## Changes Made

### 1. Info.plist Updates
- Added `NSCameraUsageDescription` permission for camera access
- Description: "This app needs camera access to scan QR codes for secure wallet connections and transactions."

### 2. QRScannerView.swift Updates

#### Real Camera Integration
- Replaced mock button with `CodeScannerView` from the CodeScanner library
- Configured for QR code scanning with continuous mode
- Added proper error handling for camera failures

#### Enhanced User Experience
- Added manual entry option as fallback for users who can't use camera
- Included debug simulation button (only visible in debug builds)
- Maintained existing flashlight toggle functionality
- Kept processing overlay and validation logic

#### New Features
- **Manual Entry Sheet**: Users can paste or type QR code data manually
- **Real-time Camera Scanning**: Continuous QR code detection
- **Improved Instructions**: Clear guidance for positioning QR codes
- **Fallback Options**: Multiple ways to input QR data

### 3. Technical Implementation

#### Camera Configuration
```swift
CodeScannerView(
    codeTypes: [.qr],
    scanMode: .continuous,
    scanInterval: 1.0,
    showViewfinder: true,
    simulatedData: "",
    completion: { result in
        // Handle scan results
    }
)
```

#### Manual Entry Component
- New `ManualQREntryView` for text input
- Validation before processing
- Clean UI with proper navigation

#### Error Handling
- Camera permission errors
- Scan failure handling
- Invalid QR code format errors

## Usage

### For Users
1. **Camera Scanning**: Point camera at QR code within the viewfinder
2. **Manual Entry**: Tap "Enter Code Manually" to input text
3. **Debug Mode**: Use "Simulate QR (Debug)" for testing (debug builds only)

### For Developers
- All existing validation and processing logic remains unchanged
- Camera permissions are automatically requested on first use
- Flashlight controls work on supported devices
- Manual entry provides accessibility compliance

## Dependencies
- Uses existing `CodeScanner` package (already in Package.swift)
- Leverages `AVFoundation` for flashlight control
- Maintains compatibility with existing `QRCodeService`

## Testing
- Debug simulation button for development testing
- Manual entry for testing without physical QR codes
- Real camera scanning for production use

## Security
- Camera access only requested when needed
- All QR validation logic preserved
- Signature verification still enforced
- No changes to cryptographic operations