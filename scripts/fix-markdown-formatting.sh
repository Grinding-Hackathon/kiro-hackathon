#!/bin/bash

# Script to fix markdown formatting issues
# Replaces \n escape sequences with actual line breaks

echo "🔧 Fixing Markdown Formatting Issues"
echo "===================================="

# List of markdown files to fix
MARKDOWN_FILES=(
    "README.md"
    "COMPLETE_SYSTEM_DOCUMENTATION.md"
    "BACKEND_API_DOCUMENTATION.md"
    "MOBILE_IOS_DOCUMENTATION.md"
    "DEPLOYMENT_GUIDE.md"
    "API_REFERENCE.md"
    "backend/README.md"
    "backend/DEPLOYMENT_RUNBOOK.md"
    "backend/SECURITY_AUDIT_CHECKLIST.md"
    "backend/DEPLOYMENT_CHECKLIST.md"
    "backend/PRODUCTION_DEPLOYMENT.md"
    "backend/MOBILE_BACKEND_INTEGRATION.md"
    "ios/offline-blockchain-wallet-ios/README.md"
    "ios/offline-blockchain-wallet-ios/XCODE_SETUP.md"
    "ios/offline-blockchain-wallet-ios/TROUBLESHOOTING.md"
    "ios/offline-blockchain-wallet-ios/DEVICE_TESTING_MATRIX.md"
    "ios/offline-blockchain-wallet-ios/BLUETOOTH_IMPLEMENTATION_SUMMARY.md"
    "ios/offline-blockchain-wallet-ios/CRYPTOGRAPHY_IMPLEMENTATION_SUMMARY.md"
    "ios/offline-blockchain-wallet-ios/BACKGROUND_SERVICES_IMPLEMENTATION.md"
    "ios/offline-blockchain-wallet-ios/TRANSACTION_SERVICE_IMPLEMENTATION.md"
    "ios/offline-blockchain-wallet-ios/OFFLINE_TOKEN_SERVICE_IMPLEMENTATION.md"
    "test-results/comprehensive_test_results_summary.md"
    "test-results/security_test_fixes_final.md"
    "test-results/security_validation_summary.md"
    "test-results/load_test_fix_summary.md"
    "test-results/final_validation_summary.md"
    "test-results/final_test_results_summary.md"
    "test-results/FINAL_TEST_COMPLETION_REPORT.md"
)

# Function to fix a single markdown file
fix_markdown_file() {
    local file="$1"
    
    if [ -f "$file" ]; then
        echo "📝 Fixing: $file"
        
        # Create backup
        cp "$file" "$file.backup"
        
        # Replace \n with actual newlines using sed
        sed 's/\\n/\
/g' "$file.backup" > "$file"
        
        # Remove backup if successful
        if [ $? -eq 0 ]; then
            rm "$file.backup"
            echo "   ✅ Fixed successfully"
        else
            echo "   ❌ Failed to fix, restoring backup"
            mv "$file.backup" "$file"
        fi
    else
        echo "   ⚠️  File not found: $file"
    fi
}

# Fix all markdown files
for file in "${MARKDOWN_FILES[@]}"; do
    fix_markdown_file "$file"
done

echo ""
echo "🎉 Markdown formatting fix completed!"
echo ""
echo "📋 Summary:"
echo "   - Fixed escape sequences (\\n) to proper line breaks"
echo "   - Updated all major documentation files"
echo "   - Files should now render properly on GitHub"
echo ""
echo "🔍 To verify fixes:"
echo "   git diff --name-only"
echo "   git add ."
echo "   git commit -m 'fix: correct markdown formatting for GitHub compatibility'"