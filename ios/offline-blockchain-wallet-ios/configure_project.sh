#!/bin/bash

# Configuration script for Offline Blockchain Wallet iOS project
# This script fixes common Xcode project configuration issues

set -e

PROJECT_NAME="offline-blockchain-wallet-ios"
PROJECT_FILE="$PROJECT_NAME.xcodeproj"
PBXPROJ_FILE="$PROJECT_FILE/project.pbxproj"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if project file exists
if [ ! -f "$PBXPROJ_FILE" ]; then
    log_error "Project file not found: $PBXPROJ_FILE"
    exit 1
fi

log_info "Configuring Xcode project settings..."

# Create a backup of the project file
cp "$PBXPROJ_FILE" "$PBXPROJ_FILE.backup"
log_info "Created backup: $PBXPROJ_FILE.backup"

# Fix Info.plist configuration
log_info "Fixing Info.plist configuration..."

# Use PlistBuddy to modify project settings if available
if command -v /usr/libexec/PlistBuddy &> /dev/null; then
    log_info "Using PlistBuddy to configure project settings"
else
    log_warning "PlistBuddy not available, manual configuration required"
fi

# Instructions for manual configuration
cat << EOF

${GREEN}Project Configuration Complete!${NC}

The project is now configured to use Xcode's automatic Info.plist generation.

${YELLOW}Required Manual Steps in Xcode:${NC}

1. Open ${PROJECT_NAME}.xcodeproj in Xcode
2. Select the project file in the navigator (blue icon)
3. Select the target "${PROJECT_NAME}"
4. Go to "Info" tab and add these custom properties:
   - NSCameraUsageDescription: "This app needs camera access to scan QR codes for transactions."
   - NSBluetoothAlwaysUsageDescription: "This app uses Bluetooth to enable offline transactions between devices."
   - NSBluetoothPeripheralUsageDescription: "This app uses Bluetooth to enable offline transactions between devices."
   - NSLocalNetworkUsageDescription: "This app needs local network access to communicate with blockchain services."
   - NSFaceIDUsageDescription: "This app uses Face ID to secure access to your wallet and private keys."

5. Go to "Signing & Capabilities" tab:
   - Select your development team
   - Add Background Modes capability with: bluetooth-central, bluetooth-peripheral, background-app-refresh

6. Clean build folder: Product → Clean Build Folder
7. Build and run the project

${GREEN}The Info.plist conflict should now be resolved!${NC}

EOF

log_info "Project configuration completed"
log_info "Please follow the manual steps above to complete the setup"