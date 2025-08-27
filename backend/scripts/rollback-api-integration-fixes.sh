#!/bin/bash

# API Integration Fixes Rollback Script
# This script rolls back the API integration fixes deployment

set -e

echo "🔄 Starting API Integration Fixes rollback..."

# Configuration
ROLLBACK_TO_VERSION=${1:-"previous"}
BACKUP_TO_RESTORE=${2:-""}
SKIP_CONFIRMATION=${3:-"false"}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Rollback timestamp
ROLLBACK_TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

log_step "1. Pre-rollback validation"

# Check if we're in the correct directory
if [ ! -f "package.json" ]; then
    log_error "package.json not found. Please run this script from the backend directory."
    exit 1
fi

# Check Docker availability
if ! docker info > /dev/null 2>&1; then
    log_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Confirmation prompt
if [ "$SKIP_CONFIRMATION" != "true" ]; then
    echo
    log_warn "⚠️  WARNING: This will rollback the API Integration Fixes deployment!"
    echo "  - Current services will be stopped"
    echo "  - Previous version will be restored"
    echo "  - Database may be restored from backup"
    echo "  - Some data may be lost"
    echo
    read -p "Are you sure you want to continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Rollback cancelled by user."
        exit 0
    fi
fi

log_step "2. Creating rollback backup"

log_info "Creating current state backup before rollback..."
CURRENT_BACKUP_NAME="pre-rollback-${ROLLBACK_TIMESTAMP}"

# Backup current database state
if command -v pg_dump &> /dev/null; then
    log_info "Backing up current database state..."
    ./scripts/backup-database.sh "$CURRENT_BACKUP_NAME" || {
        log_warn "Database backup failed, but continuing with rollback..."
    }
else
    log_warn "pg_dump not available, skipping database backup"
fi

# Backup current configuration
log_info "Backing up current configuration..."
tar -czf "config-backup-${ROLLBACK_TIMESTAMP}.tar.gz" .env docker-compose.prod.yml infrastructure/ || {
    log_warn "Configuration backup failed, but continuing with rollback..."
}

log_step "3. Stopping current services"

log_info "Gracefully stopping current services..."
docker-compose -f infrastructure/docker-compose.prod.yml down --timeout 30 || {
    log_warn "Graceful shutdown failed, forcing stop..."
    docker-compose -f infrastructure/docker-compose.prod.yml kill
    docker-compose -f infrastructure/docker-compose.prod.yml down
}

# Stop monitoring services
log_info "Stopping monitoring services..."
docker-compose -f infrastructure/monitoring/docker-compose.yml down || {
    log_warn "Failed to stop monitoring services"
}

log_step "4. Restoring previous version"

# Check if previous image exists
if docker image inspect "offline-wallet-backend:${ROLLBACK_TO_VERSION}" > /dev/null 2>&1; then
    log_info "Restoring Docker image to version: ${ROLLBACK_TO_VERSION}"
    docker tag "offline-wallet-backend:${ROLLBACK_TO_VERSION}" "offline-wallet-backend:latest"
    log_info "✅ Docker image restored"
else
    log_error "Previous Docker image 'offline-wallet-backend:${ROLLBACK_TO_VERSION}' not found!"
    
    # Try to find available images
    log_info "Available images:"
    docker images offline-wallet-backend --format "table {{.Tag}}\t{{.CreatedAt}}\t{{.Size}}"
    
    echo
    read -p "Enter the tag of the image to rollback to: " -r MANUAL_TAG
    if [ -n "$MANUAL_TAG" ] && docker image inspect "offline-wallet-backend:${MANUAL_TAG}" > /dev/null 2>&1; then
        docker tag "offline-wallet-backend:${MANUAL_TAG}" "offline-wallet-backend:latest"
        log_info "✅ Docker image restored to ${MANUAL_TAG}"
    else
        log_error "Invalid or non-existent image tag. Rollback aborted."
        exit 1
    fi
fi

log_step "5. Database rollback"

if [ -n "$BACKUP_TO_RESTORE" ]; then
    log_info "Restoring database from backup: ${BACKUP_TO_RESTORE}"
    
    # Check if backup file exists
    if [ -f "backups/${BACKUP_TO_RESTORE}.sql" ] || [ -f "backups/${BACKUP_TO_RESTORE}" ]; then
        # Start database service
        log_info "Starting database service..."
        docker-compose -f infrastructure/docker-compose.prod.yml up -d postgres
        sleep 30
        
        # Restore database
        ./scripts/restore-database.sh "$BACKUP_TO_RESTORE" || {
            log_error "Database restoration failed!"
            log_info "You may need to restore manually or continue without database rollback."
            read -p "Continue without database rollback? (y/N): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                exit 1
            fi
        }
        log_info "✅ Database restored from backup"
    else
        log_error "Backup file not found: ${BACKUP_TO_RESTORE}"
        log_info "Available backups:"
        ls -la backups/ 2>/dev/null || echo "No backups directory found"
        
        read -p "Continue without database rollback? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
else
    log_warn "No database backup specified. Database will not be rolled back."
    log_info "Current database state will be preserved."
fi

log_step "6. Starting rolled-back services"

log_info "Starting database and cache services..."
docker-compose -f infrastructure/docker-compose.prod.yml up -d postgres redis
sleep 30

log_info "Starting application services..."
docker-compose -f infrastructure/docker-compose.prod.yml up -d app nginx

log_info "Starting monitoring services..."
docker-compose -f infrastructure/monitoring/docker-compose.yml up -d

log_step "7. Post-rollback validation"

log_info "Waiting for services to be ready..."
sleep 60

# Health check function
check_endpoint() {
    local endpoint=$1
    local expected_status=${2:-200}
    local max_attempts=${3:-10}
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        local status_code=$(curl -s -o /dev/null -w "%{http_code}" "$endpoint" || echo "000")
        
        if [ "$status_code" = "$expected_status" ]; then
            log_info "✅ $endpoint is healthy (HTTP $status_code)"
            return 0
        else
            log_warn "❌ $endpoint returned HTTP $status_code (attempt $attempt/$max_attempts)"
            sleep 10
            ((attempt++))
        fi
    done
    
    log_error "❌ $endpoint failed health check after $max_attempts attempts"
    return 1
}

# Core health checks
log_info "Running health checks..."
if check_endpoint "http://localhost:3000/health" 200; then
    log_info "✅ Basic health check passed"
else
    log_error "❌ Basic health check failed"
    log_info "Checking service logs..."
    docker-compose -f infrastructure/docker-compose.prod.yml logs --tail=50 app
fi

# Check if services are running
log_info "Checking service status..."
RUNNING_SERVICES=$(docker-compose -f infrastructure/docker-compose.prod.yml ps --services --filter "status=running" | wc -l)
TOTAL_SERVICES=$(docker-compose -f infrastructure/docker-compose.prod.yml ps --services | wc -l)

if [ "$RUNNING_SERVICES" -eq "$TOTAL_SERVICES" ]; then
    log_info "✅ All services are running ($RUNNING_SERVICES/$TOTAL_SERVICES)"
else
    log_warn "⚠️  Only $RUNNING_SERVICES/$TOTAL_SERVICES services are running"
    docker-compose -f infrastructure/docker-compose.prod.yml ps
fi

log_step "8. Rollback verification"

log_info "Verifying rollback success..."

# Test basic API functionality
log_info "Testing basic API endpoints..."
if curl -f -s http://localhost:3000/health > /dev/null; then
    log_info "✅ Health endpoint working"
else
    log_error "❌ Health endpoint not responding"
fi

# Check database connectivity
if curl -f -s http://localhost:3000/health/detailed > /dev/null; then
    log_info "✅ Database connectivity verified"
else
    log_warn "⚠️  Database connectivity issues detected"
fi

log_step "9. Cleanup and documentation"

log_info "Cleaning up rollback artifacts..."

# Remove failed deployment images (keep for forensics)
log_info "Tagging failed deployment image for forensics..."
if docker image inspect "offline-wallet-backend:latest" > /dev/null 2>&1; then
    docker tag "offline-wallet-backend:latest" "offline-wallet-backend:failed-${ROLLBACK_TIMESTAMP}"
fi

# Generate rollback report
log_info "Generating rollback report..."
cat > "rollback-report-${ROLLBACK_TIMESTAMP}.md" << EOF
# API Integration Fixes Rollback Report

**Rollback ID**: rollback-${ROLLBACK_TIMESTAMP}
**Timestamp**: $(date)
**Rolled back to**: ${ROLLBACK_TO_VERSION}
**Database backup restored**: ${BACKUP_TO_RESTORE:-"None"}

## Rollback Summary
- Services stopped and restarted successfully
- Docker image restored to previous version
- Database $([ -n "$BACKUP_TO_RESTORE" ] && echo "restored from backup" || echo "preserved current state")
- Health checks $([ $? -eq 0 ] && echo "passed" || echo "failed")

## Service Status
\`\`\`
$(docker-compose -f infrastructure/docker-compose.prod.yml ps)
\`\`\`

## Next Steps
1. Investigate root cause of deployment failure
2. Fix identified issues
3. Test fixes in staging environment
4. Plan re-deployment strategy

## Forensics
- Failed deployment image: offline-wallet-backend:failed-${ROLLBACK_TIMESTAMP}
- Current state backup: ${CURRENT_BACKUP_NAME}
- Configuration backup: config-backup-${ROLLBACK_TIMESTAMP}.tar.gz

## Contact
- On-call Engineer: +1-555-WALLET-1
- DevOps Team: devops@offlinewallet.com
EOF

log_info "Updating rollback history..."
echo "${ROLLBACK_TIMESTAMP}:ROLLBACK:${ROLLBACK_TO_VERSION}:$(date)" >> rollback-history.log

log_info "🎉 Rollback completed successfully!"

echo
echo "📋 Rollback Summary:"
echo "  Rollback ID: rollback-${ROLLBACK_TIMESTAMP}"
echo "  Rolled back to: ${ROLLBACK_TO_VERSION}"
echo "  Database: $([ -n "$BACKUP_TO_RESTORE" ] && echo "Restored from ${BACKUP_TO_RESTORE}" || echo "Preserved current state")"
echo "  Services: $RUNNING_SERVICES/$TOTAL_SERVICES running"
echo
echo "🔗 Important Links:"
echo "  API Health: http://localhost:3000/health"
echo "  Grafana Dashboard: http://localhost:3001"
echo "  Prometheus Metrics: http://localhost:9090"
echo
echo "📝 Next Steps:"
echo "  1. Review rollback report: rollback-report-${ROLLBACK_TIMESTAMP}.md"
echo "  2. Investigate deployment failure"
echo "  3. Monitor system stability"
echo "  4. Plan remediation strategy"
echo
echo "🔍 Forensics:"
echo "  Failed image: offline-wallet-backend:failed-${ROLLBACK_TIMESTAMP}"
echo "  Backup created: ${CURRENT_BACKUP_NAME}"
echo "  Config backup: config-backup-${ROLLBACK_TIMESTAMP}.tar.gz"
echo
echo "📞 Support:"
echo "  On-call: +1-555-WALLET-1"
echo "  Email: devops@offlinewallet.com"
echo "  Slack: #wallet-ops"

# Send rollback notification (if configured)
if command -v mail &> /dev/null && [ -n "$NOTIFICATION_EMAIL" ]; then
    echo "API Integration Fixes rolled back at $(date). Reason: Deployment failure. Rollback ID: rollback-${ROLLBACK_TIMESTAMP}" | \
    mail -s "🔄 Rollback Completed: rollback-${ROLLBACK_TIMESTAMP}" "$NOTIFICATION_EMAIL"
fi

log_info "Rollback completed successfully! 🔄"