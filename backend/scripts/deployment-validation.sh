#!/bin/bash

# Deployment Validation Script
# Validates production deployment readiness

set -e

echo "🚀 Production Deployment Validation"
echo "==================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Validation results
VALIDATIONS_PASSED=0
VALIDATIONS_FAILED=0
VALIDATIONS_WARNING=0

# Function to print validation results
print_validation() {
    local test_name="$1"
    local result="$2"
    local message="$3"
    
    if [ "$result" = "PASS" ]; then
        echo -e "${GREEN}✓ $test_name: PASS${NC} - $message"
        ((VALIDATIONS_PASSED++))
    elif [ "$result" = "FAIL" ]; then
        echo -e "${RED}✗ $test_name: FAIL${NC} - $message"
        ((VALIDATIONS_FAILED++))
    else
        echo -e "${YELLOW}⚠ $test_name: WARNING${NC} - $message"
        ((VALIDATIONS_WARNING++))
    fi
}

echo "🔍 Phase 1: Pre-Deployment Checks"
echo "--------------------------------"

# Check if all tests pass
if npm test > /dev/null 2>&1; then
    print_validation "Test Suite" "PASS" "All tests passing"
else
    print_validation "Test Suite" "FAIL" "Some tests failing"
fi

# Check security audit
if ./scripts/comprehensive-security-audit.sh > /dev/null 2>&1; then
    print_validation "Security Audit" "PASS" "Security audit passed"
else
    print_validation "Security Audit" "FAIL" "Security audit failed"
fi# Check
 environment configuration
if [ -f ".env" ]; then
    if grep -q "NODE_ENV=production" .env; then
        print_validation "Environment Config" "PASS" "Production environment configured"
    else
        print_validation "Environment Config" "FAIL" "Not configured for production"
    fi
else
    print_validation "Environment Config" "FAIL" ".env file missing"
fi

# Check Docker configuration
if [ -f "docker-compose.prod.yml" ]; then
    print_validation "Docker Config" "PASS" "Production Docker config present"
else
    print_validation "Docker Config" "FAIL" "Production Docker config missing"
fi

echo ""
echo "🏗️ Phase 2: Infrastructure Validation"
echo "------------------------------------"

# Check database connectivity
if docker-compose -f docker-compose.prod.yml exec -T postgres pg_isready > /dev/null 2>&1; then
    print_validation "Database Connection" "PASS" "Database accessible"
else
    print_validation "Database Connection" "WARNING" "Database not running or accessible"
fi

# Check Redis connectivity
if docker-compose -f docker-compose.prod.yml exec -T redis redis-cli ping > /dev/null 2>&1; then
    print_validation "Redis Connection" "PASS" "Redis accessible"
else
    print_validation "Redis Connection" "WARNING" "Redis not running or accessible"
fi

echo ""
echo "🔒 Phase 3: Security Validation"
echo "------------------------------"

# Check SSL certificates
if [ -f "infrastructure/nginx/ssl/cert.pem" ]; then
    if openssl x509 -in infrastructure/nginx/ssl/cert.pem -checkend 86400 -noout > /dev/null 2>&1; then
        print_validation "SSL Certificate" "PASS" "SSL certificate valid"
    else
        print_validation "SSL Certificate" "WARNING" "SSL certificate expires soon"
    fi
else
    print_validation "SSL Certificate" "WARNING" "SSL certificate not found"
fi

# Check firewall configuration
if command -v ufw > /dev/null 2>&1; then
    if ufw status | grep -q "Status: active"; then
        print_validation "Firewall" "PASS" "Firewall active"
    else
        print_validation "Firewall" "WARNING" "Firewall not active"
    fi
else
    print_validation "Firewall" "WARNING" "UFW not installed"
fi

echo ""
echo "📊 Phase 4: Performance Validation"
echo "---------------------------------"

# Run load tests
if npm run test:load > /dev/null 2>&1; then
    print_validation "Load Testing" "PASS" "Load tests passed"
else
    print_validation "Load Testing" "FAIL" "Load tests failed"
fi

echo ""
echo "🎯 Final Deployment Assessment"
echo "============================="

TOTAL_VALIDATIONS=$((VALIDATIONS_PASSED + VALIDATIONS_FAILED + VALIDATIONS_WARNING))
SUCCESS_RATE=$((VALIDATIONS_PASSED * 100 / TOTAL_VALIDATIONS))

echo -e "${BLUE}Deployment Validation Summary:${NC}"
echo "  ✅ Validations Passed: $VALIDATIONS_PASSED"
echo "  ❌ Validations Failed: $VALIDATIONS_FAILED"
echo "  ⚠️ Warnings: $VALIDATIONS_WARNING"
echo "  📊 Success Rate: $SUCCESS_RATE%"

if [ $VALIDATIONS_FAILED -eq 0 ] && [ $SUCCESS_RATE -ge 90 ]; then
    echo -e "${GREEN}🎉 DEPLOYMENT VALIDATION PASSED${NC}"
    echo "System is ready for production deployment."
    exit 0
else
    echo -e "${RED}❌ DEPLOYMENT VALIDATION FAILED${NC}"
    echo "Critical issues must be resolved before deployment."
    exit 1
fi