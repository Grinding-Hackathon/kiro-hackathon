# Toolbar Ambiguity Fix

## Problem
The app was experiencing compilation errors: "Ambiguous use of 'toolbar(content:)'" in multiple views including QRScannerView, ReceiveView, and SettingsView.

## Root Cause
The issue was caused by nested NavigationView structures in sheet presentations:
1. The main views had `NavigationView` with their own `.toolbar` modifiers
2. Views presented as sheets (ManualQREntryView, ReceiveView, SettingsView) also had their own `NavigationView` with `.toolbar` modifiers
3. This created ambiguous toolbar contexts that the compiler couldn't resolve

## Solution
Applied different strategies based on the view usage patterns:

### QRScannerView - ManualQREntryView
- Removed the `NavigationView` from `ManualQREntryView`
- Replaced with custom header containing Cancel button and title
- Eliminated nested navigation context

### WalletView - ReceiveView
- Removed the `NavigationView` from `ReceiveView`
- Replaced with custom header containing Done button and title
- Maintained the same visual appearance and functionality

### WalletView - SettingsView
- Modified `SettingsView` to conditionally use NavigationView based on context
- Added `isSheet` parameter to control navigation behavior
- Created `SettingsSheetView` wrapper with custom header
- Added `ConditionalToolbarModifier` to completely avoid toolbar when in sheet mode
- Preserved existing functionality for both tab and sheet presentations

## Files Modified
- `ios/offline-blockchain-wallet-ios/offline-blockchain-wallet-ios/Views/QRScannerView.swift`
  - Modified `ManualQREntryView` to remove `NavigationView`
  - Added custom header with Cancel button

- `ios/offline-blockchain-wallet-ios/offline-blockchain-wallet-ios/Views/WalletView.swift`
  - Modified `ReceiveView` to remove `NavigationView`
  - Added custom header with Done button
  - Created `SettingsSheetView` wrapper for sheet presentation

- `ios/offline-blockchain-wallet-ios/offline-blockchain-wallet-ios/Views/SettingsView.swift`
  - Added conditional NavigationView based on `isSheet` parameter
  - Created `ConditionalToolbarModifier` to completely avoid toolbar in sheet mode
  - Added proper ViewModifier pattern to handle conditional toolbar application
  - Maintained compatibility with both tab and sheet presentations

## Technical Details
- Sheet presentations don't require their own NavigationView when the parent already has one
- Custom headers provide better control over layout in sheet presentations
- Conditional NavigationView usage allows views to work in multiple contexts
- This approach eliminates toolbar conflicts while preserving user experience

## Testing
- Verify all views open without compilation errors
- Test sheet presentations and dismissals (QR manual entry, receive view, settings)
- Confirm button functionality works correctly in all contexts
- Ensure settings work both as tab and sheet presentation
- Verify QR code processing still functions properly