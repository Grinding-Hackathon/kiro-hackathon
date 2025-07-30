#!/bin/bash

# Comprehensive Security Audit Script
# This script performs final security validation before production deployment

set -e

echo "🔒 Starting Comprehensive Security Audit..."
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
TESTS_PASSED=0
TESTS_FAILED=0
WARNINGS=0

# Function to print test results
print_result() {
    local test_name="$1"
    local result="$2"
    local message="$3"
    
    if [ "$result" = "PASS" ]; then
        echo -e "${GREEN}✓ $test_name: PASS${NC} - $message"
        ((TESTS_PASSED++))
    elif [ "$result" = "FAIL" ]; then
        echo -e "${RED}✗ $test_name: FAIL${NC} - $message"
        ((TESTS_FAILED++))
    else
        echo -e "${YELLOW}⚠ $test_name: WARNING${NC} - $message"
        ((WARNINGS++))
    fi
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

echo "🔍 Phase 1: Environment and Dependencies Check"
echo "----------------------------------------------"

# Check Node.js version
if command_exists node; then
    NODE_VERSION=$(node --version | cut -d'v' -f2)
    if [ "$(printf '%s\n' "18.0.0" "$NODE_VERSION" | sort -V | head -n1)" = "18.0.0" ]; then
        print_result "Node.js Version" "PASS" "v$NODE_VERSION"
    else
        print_result "Node.js Version" "FAIL" "v$NODE_VERSION (requires >= 18.0.0)"
    fi
else
    print_result "Node.js Installation" "FAIL" "Node.js not found"
fi

# Check npm dependencies
if [ -f "package.json" ]; then
    npm audit --audit-level=high --json > audit_results.json 2>/dev/null || true
    HIGH_VULNS=$(cat audit_results.json | jq -r '.metadata.vulnerabilities.high // 0' 2>/dev/null || echo "0")
    CRITICAL_VULNS=$(cat audit_results.json | jq -r '.metadata.vulnerabilities.critical // 0' 2>/dev/null || echo "0")
    
    if [ "$HIGH_VULNS" -eq 0 ] && [ "$CRITICAL_VULNS" -eq 0 ]; then
        print_result "NPM Security Audit" "PASS" "No high/critical vulnerabilities"
    else
        print_result "NPM Security Audit" "FAIL" "$HIGH_VULNS high, $CRITICAL_VULNS critical vulnerabilities"
    fi
    rm -f audit_results.json
else
    print_result "Package.json" "FAIL" "package.json not found"
fi

# Check Docker security
if command_exists docker; then
    # Check if Docker daemon is running
    if docker info >/dev/null 2>&1; then
        print_result "Docker Status" "PASS" "Docker daemon running"
        
        # Check for Docker security best practices
        if docker version --format '{{.Server.Version}}' | grep -E '^(20\.|2[1-9]\.)' >/dev/null; then
            print_result "Docker Version" "PASS" "$(docker version --format '{{.Server.Version}}')"
        else
            print_result "Docker Version" "WARNING" "Consider upgrading to Docker 20+"
        fi
    else
        print_result "Docker Status" "FAIL" "Docker daemon not running"
    fi
else
    print_result "Docker Installation" "FAIL" "Docker not found"
fi

echo ""
echo "🧪 Phase 2: Security Test Suite Execution"
echo "----------------------------------------"

# Run security tests
if [ -f "package.json" ] && npm list --depth=0 jest >/dev/null 2>&1; then
    echo "Running security test suite..."
    
    # Run cryptographic validation tests
    if npm test -- --testPathPattern=cryptographicValidation --silent >/dev/null 2>&1; then
        print_result "Cryptographic Validation" "PASS" "All cryptographic tests passed"
    else
        print_result "Cryptographic Validation" "FAIL" "Cryptographic tests failed"
    fi
    
    # Run security audit tests
    if npm test -- --testPathPattern=securityAudit --silent >/dev/null 2>&1; then
        print_result "Security Audit Tests" "PASS" "All security tests passed"
    else
        print_result "Security Audit Tests" "FAIL" "Security tests failed"
    fi
    
    # Run load tests
    if npm test -- --testPathPattern=loadTest --silent >/dev/null 2>&1; then
        print_result "Load Testing" "PASS" "Load tests passed"
    else
        print_result "Load Testing" "FAIL" "Load tests failed"
    fi
else
    print_result "Test Framework" "FAIL" "Jest not available or package.json missing"
fi

echo ""
echo "🔐 Phase 3: Configuration Security Check"
echo "---------------------------------------"

# Check environment file security
if [ -f ".env" ]; then
    # Check for weak secrets
    if grep -q "secret.*=.*test\|secret.*=.*123\|secret.*=.*password" .env; then
        print_result "Environment Secrets" "FAIL" "Weak secrets detected in .env"
    else
        print_result "Environment Secrets" "PASS" "No weak secrets detected"
    fi
    
    # Check for required environment variables
    REQUIRED_VARS=("JWT_SECRET" "DATABASE_URL" "ETHEREUM_RPC_URL" "NODE_ENV")
    MISSING_VARS=()
    
    for var in "${REQUIRED_VARS[@]}"; do
        if ! grep -q "^$var=" .env; then
            MISSING_VARS+=("$var")
        fi
    done
    
    if [ ${#MISSING_VARS[@]} -eq 0 ]; then
        print_result "Required Environment Variables" "PASS" "All required variables present"
    else
        print_result "Required Environment Variables" "FAIL" "Missing: ${MISSING_VARS[*]}"
    fi
    
    # Check file permissions
    ENV_PERMS=$(stat -c "%a" .env)
    if [ "$ENV_PERMS" = "600" ] || [ "$ENV_PERMS" = "400" ]; then
        print_result "Environment File Permissions" "PASS" "Secure permissions ($ENV_PERMS)"
    else
        print_result "Environment File Permissions" "WARNING" "Consider setting to 600 (current: $ENV_PERMS)"
    fi
else
    print_result "Environment Configuration" "FAIL" ".env file not found"
fi

# Check Docker Compose security
if [ -f "docker-compose.prod.yml" ]; then
    # Check for exposed ports
    if grep -q "ports:" docker-compose.prod.yml && ! grep -q "127.0.0.1:" docker-compose.prod.yml; then
        print_result "Docker Port Exposure" "WARNING" "Some ports may be exposed to all interfaces"
    else
        print_result "Docker Port Exposure" "PASS" "Ports properly configured"
    fi
    
    # Check for secrets in compose file
    if grep -q "password\|secret\|key" docker-compose.prod.yml; then
        print_result "Docker Compose Secrets" "WARNING" "Potential secrets in compose file"
    else
        print_result "Docker Compose Secrets" "PASS" "No hardcoded secrets detected"
    fi
else
    print_result "Docker Compose Configuration" "WARNING" "docker-compose.prod.yml not found"
fi

echo ""
echo "🌐 Phase 4: Network Security Validation"
echo "--------------------------------------"

# Check SSL/TLS configuration if certificates exist
if [ -d "infrastructure/nginx/ssl" ] && [ -f "infrastructure/nginx/ssl/cert.pem" ]; then
    # Check certificate validity
    if openssl x509 -in infrastructure/nginx/ssl/cert.pem -checkend 2592000 -noout >/dev/null 2>&1; then
        print_result "SSL Certificate Validity" "PASS" "Certificate valid for >30 days"
    else
        print_result "SSL Certificate Validity" "WARNING" "Certificate expires within 30 days"
    fi
    
    # Check certificate strength
    KEY_SIZE=$(openssl x509 -in infrastructure/nginx/ssl/cert.pem -text -noout | grep "Public-Key:" | grep -o '[0-9]*')
    if [ "$KEY_SIZE" -ge 2048 ]; then
        print_result "SSL Certificate Strength" "PASS" "${KEY_SIZE}-bit key"
    else
        print_result "SSL Certificate Strength" "FAIL" "${KEY_SIZE}-bit key (minimum 2048 required)"
    fi
else
    print_result "SSL Certificate" "WARNING" "SSL certificates not found"
fi

# Check Nginx security configuration
if [ -f "infrastructure/nginx/nginx.conf" ]; then
    # Check for security headers
    SECURITY_HEADERS=("X-Frame-Options" "X-Content-Type-Options" "X-XSS-Protection" "Strict-Transport-Security")
    MISSING_HEADERS=()
    
    for header in "${SECURITY_HEADERS[@]}"; do
        if ! grep -q "$header" infrastructure/nginx/nginx.conf; then
            MISSING_HEADERS+=("$header")
        fi
    done
    
    if [ ${#MISSING_HEADERS[@]} -eq 0 ]; then
        print_result "Nginx Security Headers" "PASS" "All security headers configured"
    else
        print_result "Nginx Security Headers" "WARNING" "Missing: ${MISSING_HEADERS[*]}"
    fi
    
    # Check for rate limiting
    if grep -q "limit_req" infrastructure/nginx/nginx.conf; then
        print_result "Nginx Rate Limiting" "PASS" "Rate limiting configured"
    else
        print_result "Nginx Rate Limiting" "WARNING" "Rate limiting not configured"
    fi
else
    print_result "Nginx Configuration" "WARNING" "nginx.conf not found"
fi

echo ""
echo "🗄️ Phase 5: Database Security Check"
echo "----------------------------------"

# Check database configuration
if [ -f "infrastructure/postgres/postgresql.conf" ]; then
    # Check SSL enforcement
    if grep -q "ssl = on" infrastructure/postgres/postgresql.conf; then
        print_result "Database SSL" "PASS" "SSL enabled"
    else
        print_result "Database SSL" "WARNING" "SSL not enforced"
    fi
    
    # Check logging configuration
    if grep -q "log_statement = 'all'" infrastructure/postgres/postgresql.conf; then
        print_result "Database Logging" "WARNING" "Full statement logging enabled (performance impact)"
    elif grep -q "log_statement" infrastructure/postgres/postgresql.conf; then
        print_result "Database Logging" "PASS" "Statement logging configured"
    else
        print_result "Database Logging" "WARNING" "Statement logging not configured"
    fi
else
    print_result "Database Configuration" "WARNING" "postgresql.conf not found"
fi

# Check database access control
if [ -f "infrastructure/postgres/pg_hba.conf" ]; then
    # Check for password authentication
    if grep -q "md5\|scram-sha-256" infrastructure/postgres/pg_hba.conf; then
        print_result "Database Authentication" "PASS" "Password authentication configured"
    else
        print_result "Database Authentication" "WARNING" "Weak authentication methods detected"
    fi
    
    # Check for trust authentication
    if grep -q "trust" infrastructure/postgres/pg_hba.conf; then
        print_result "Database Trust Auth" "WARNING" "Trust authentication enabled"
    else
        print_result "Database Trust Auth" "PASS" "No trust authentication"
    fi
else
    print_result "Database Access Control" "WARNING" "pg_hba.conf not found"
fi

echo ""
echo "🔧 Phase 6: Smart Contract Security"
echo "----------------------------------"

# Check smart contract security
if [ -f "contracts/OfflineWalletToken.sol" ]; then
    # Check for common vulnerabilities
    if grep -q "require(" contracts/OfflineWalletToken.sol; then
        print_result "Smart Contract Input Validation" "PASS" "Input validation present"
    else
        print_result "Smart Contract Input Validation" "WARNING" "Limited input validation"
    fi
    
    # Check for access control
    if grep -q "onlyOwner\|AccessControl" contracts/OfflineWalletToken.sol; then
        print_result "Smart Contract Access Control" "PASS" "Access control implemented"
    else
        print_result "Smart Contract Access Control" "WARNING" "Limited access control"
    fi
    
    # Check for reentrancy protection
    if grep -q "ReentrancyGuard\|nonReentrant" contracts/OfflineWalletToken.sol; then
        print_result "Smart Contract Reentrancy Protection" "PASS" "Reentrancy protection implemented"
    else
        print_result "Smart Contract Reentrancy Protection" "WARNING" "No reentrancy protection detected"
    fi
else
    print_result "Smart Contract" "WARNING" "Smart contract not found"
fi

echo ""
echo "📊 Phase 7: Monitoring and Alerting"
echo "----------------------------------"

# Check monitoring configuration
if [ -f "infrastructure/monitoring/prometheus.yml" ]; then
    print_result "Prometheus Configuration" "PASS" "Monitoring configuration present"
else
    print_result "Prometheus Configuration" "WARNING" "Prometheus configuration not found"
fi

if [ -f "infrastructure/monitoring/alert_rules.yml" ]; then
    # Check for critical alerts
    CRITICAL_ALERTS=("HighErrorRate" "ServiceDown" "DatabaseDown" "HighMemoryUsage")
    MISSING_ALERTS=()
    
    for alert in "${CRITICAL_ALERTS[@]}"; do
        if ! grep -q "$alert" infrastructure/monitoring/alert_rules.yml; then
            MISSING_ALERTS+=("$alert")
        fi
    done
    
    if [ ${#MISSING_ALERTS[@]} -eq 0 ]; then
        print_result "Critical Alert Rules" "PASS" "All critical alerts configured"
    else
        print_result "Critical Alert Rules" "WARNING" "Missing: ${MISSING_ALERTS[*]}"
    fi
else
    print_result "Alert Rules" "WARNING" "Alert rules not found"
fi

echo ""
echo "📋 Phase 8: Documentation and Compliance"
echo "---------------------------------------"

# Check documentation completeness
REQUIRED_DOCS=("README.md" "DEPLOYMENT_CHECKLIST.md" "DEPLOYMENT_RUNBOOK.md" "SECURITY_AUDIT_CHECKLIST.md")
MISSING_DOCS=()

for doc in "${REQUIRED_DOCS[@]}"; do
    if [ ! -f "$doc" ]; then
        MISSING_DOCS+=("$doc")
    fi
done

if [ ${#MISSING_DOCS[@]} -eq 0 ]; then
    print_result "Required Documentation" "PASS" "All required documents present"
else
    print_result "Required Documentation" "WARNING" "Missing: ${MISSING_DOCS[*]}"
fi

# Check backup procedures
if [ -f "scripts/backup-database.sh" ]; then
    if [ -x "scripts/backup-database.sh" ]; then
        print_result "Backup Scripts" "PASS" "Backup script present and executable"
    else
        print_result "Backup Scripts" "WARNING" "Backup script not executable"
    fi
else
    print_result "Backup Scripts" "WARNING" "Backup script not found"
fi

echo ""
echo "🎯 Final Security Assessment"
echo "============================"

# Calculate security score
TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED + WARNINGS))
SECURITY_SCORE=$((TESTS_PASSED * 100 / TOTAL_TESTS))

echo -e "${BLUE}Security Audit Summary:${NC}"
echo "  ✓ Tests Passed: $TESTS_PASSED"
echo "  ✗ Tests Failed: $TESTS_FAILED"
echo "  ⚠ Warnings: $WARNINGS"
echo "  📊 Security Score: $SECURITY_SCORE%"

# Determine overall security status
if [ $TESTS_FAILED -eq 0 ] && [ $SECURITY_SCORE -ge 90 ]; then
    echo -e "${GREEN}🎉 SECURITY AUDIT PASSED${NC}"
    echo "System is ready for production deployment."
    exit 0
elif [ $TESTS_FAILED -eq 0 ] && [ $SECURITY_SCORE -ge 80 ]; then
    echo -e "${YELLOW}⚠️ SECURITY AUDIT PASSED WITH WARNINGS${NC}"
    echo "System can be deployed but address warnings for optimal security."
    exit 0
else
    echo -e "${RED}❌ SECURITY AUDIT FAILED${NC}"
    echo "Critical security issues must be resolved before production deployment."
    exit 1
fi