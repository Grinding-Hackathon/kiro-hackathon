#!/bin/bash

# Build script for Offline Blockchain Wallet iOS
# Usage: ./scripts/build.sh [clean|test|archive|release]

set -e

PROJECT_NAME="offline-blockchain-wallet-ios"
SCHEME_NAME="offline-blockchain-wallet-ios"
WORKSPACE_NAME="offline-blockchain-wallet-ios.xcworkspace"
PROJECT_FILE="offline-blockchain-wallet-ios.xcodeproj"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_xcode() {
    if ! command -v xcodebuild &> /dev/null; then
        log_error "Xcode command line tools not found. Please install Xcode."
        exit 1
    fi
    
    log_info "Xcode version: $(xcodebuild -version | head -n 1)"
}

install_dependencies() {
    log_info "Installing dependencies..."
    
    # Check if using CocoaPods or SPM
    if [ -f "Podfile" ]; then
        log_info "Installing CocoaPods dependencies..."
        if ! command -v pod &> /dev/null; then
            log_error "CocoaPods not found. Please install: sudo gem install cocoapods"
            exit 1
        fi
        pod install
        BUILD_TARGET="-workspace $WORKSPACE_NAME"
    else
        log_info "Using Swift Package Manager..."
        BUILD_TARGET="-project $PROJECT_FILE"
    fi
}

clean_build() {
    log_info "Cleaning build artifacts..."
    xcodebuild clean $BUILD_TARGET -scheme $SCHEME_NAME
    
    # Clean derived data
    rm -rf ~/Library/Developer/Xcode/DerivedData/$PROJECT_NAME-*
    
    log_info "Clean completed"
}

run_tests() {
    log_info "Running unit tests..."
    
    xcodebuild test \
        $BUILD_TARGET \
        -scheme $SCHEME_NAME \
        -destination 'platform=iOS Simulator,name=iPhone 15,OS=latest' \
        -enableCodeCoverage YES \
        | xcpretty --test --color
    
    log_info "Tests completed"
}

build_debug() {
    log_info "Building debug version..."
    
    xcodebuild build \
        $BUILD_TARGET \
        -scheme $SCHEME_NAME \
        -configuration Debug \
        -destination 'platform=iOS Simulator,name=iPhone 15,OS=latest' \
        | xcpretty --build --color
    
    log_info "Debug build completed"
}

build_release() {
    log_info "Building release version..."
    
    xcodebuild build \
        $BUILD_TARGET \
        -scheme $SCHEME_NAME \
        -configuration Release \
        -destination 'generic/platform=iOS' \
        | xcpretty --build --color
    
    log_info "Release build completed"
}

archive_app() {
    log_info "Creating archive..."
    
    ARCHIVE_PATH="./build/$PROJECT_NAME.xcarchive"
    
    xcodebuild archive \
        $BUILD_TARGET \
        -scheme $SCHEME_NAME \
        -configuration Release \
        -archivePath "$ARCHIVE_PATH" \
        | xcpretty --build --color
    
    log_info "Archive created at: $ARCHIVE_PATH"
}

# Main script
main() {
    log_info "Starting build process for $PROJECT_NAME"
    
    check_xcode
    install_dependencies
    
    case "${1:-build}" in
        "clean")
            clean_build
            ;;
        "test")
            run_tests
            ;;
        "build")
            build_debug
            ;;
        "release")
            build_release
            ;;
        "archive")
            archive_app
            ;;
        "all")
            clean_build
            run_tests
            build_release
            ;;
        *)
            log_error "Unknown command: $1"
            echo "Usage: $0 [clean|test|build|release|archive|all]"
            exit 1
            ;;
    esac
    
    log_info "Build process completed successfully"
}

# Check if xcpretty is installed
if ! command -v xcpretty &> /dev/null; then
    log_warning "xcpretty not found. Installing..."
    gem install xcpretty
fi

# Run main function
main "$@"