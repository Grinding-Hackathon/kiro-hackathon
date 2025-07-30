#!/bin/bash

# Production Deployment Script
# This script deploys the offline wallet backend to production

set -e

echo "🚀 Starting production deployment..."

# Configuration
DOMAIN=${1:-"your-domain.com"}
EMAIL=${2:-"admin@your-domain.com"}
BACKUP_BEFORE_DEPLOY=${3:-"true"}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# Pre-deployment checks
log_info "Running pre-deployment checks..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    log_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if required environment file exists
if [ ! -f ".env" ]; then
    log_error ".env file not found. Please copy .env.production to .env and configure it."
    exit 1
fi

# Check if SSL certificates exist
if [ ! -f "infrastructure/nginx/ssl/cert.pem" ]; then
    log_warn "SSL certificates not found. Setting up SSL..."
    ./scripts/setup-ssl.sh $DOMAIN $EMAIL
fi

# Backup current database if requested
if [ "$BACKUP_BEFORE_DEPLOY" = "true" ]; then
    log_info "Creating database backup before deployment..."
    ./scripts/backup-database.sh
fi

# Build production images
log_info "Building production Docker images..."
docker-compose -f infrastructure/docker-compose.prod.yml build --no-cache

# Run security scans
log_info "Running security scans..."
docker-compose -f infrastructure/security-hardening.yml up security-scanner --exit-code-from security-scanner

# Stop existing services
log_info "Stopping existing services..."
docker-compose -f infrastructure/docker-compose.prod.yml down

# Start database and wait for it to be ready
log_info "Starting database..."
docker-compose -f infrastructure/docker-compose.prod.yml up -d postgres redis
sleep 30

# Run database migrations
log_info "Running database migrations..."
docker-compose -f infrastructure/docker-compose.prod.yml run --rm app1 npm run migrate

# Start all services
log_info "Starting all services..."
docker-compose -f infrastructure/docker-compose.prod.yml up -d

# Wait for services to be healthy
log_info "Waiting for services to be healthy..."
sleep 60

# Health checks
log_info "Running health checks..."
for i in {1..10}; do
    if curl -f http://localhost/health > /dev/null 2>&1; then
        log_info "Health check passed!"
        break
    else
        log_warn "Health check failed, retrying in 10 seconds... ($i/10)"
        sleep 10
    fi
    
    if [ $i -eq 10 ]; then
        log_error "Health checks failed after 10 attempts"
        exit 1
    fi
done

# Deploy smart contracts to mainnet (if not already deployed)
if [ -z "$ETHEREUM_CONTRACT_ADDRESS" ]; then
    log_info "Deploying smart contracts to mainnet..."
    log_warn "⚠️  This will deploy to MAINNET and cost real ETH!"
    read -p "Are you sure you want to continue? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        npm run deploy:mainnet
    else
        log_warn "Smart contract deployment skipped. Please deploy manually later."
    fi
fi

# Start monitoring and security services
log_info "Starting monitoring and security services..."
docker-compose -f infrastructure/security-hardening.yml up -d fail2ban ossec

# Final verification
log_info "Running final verification..."

# Test API endpoints
if curl -f https://$DOMAIN/api/health > /dev/null 2>&1; then
    log_info "✅ HTTPS API endpoint is working"
else
    log_error "❌ HTTPS API endpoint is not responding"
fi

# Test database connection
if docker-compose -f infrastructure/docker-compose.prod.yml exec -T postgres pg_isready > /dev/null 2>&1; then
    log_info "✅ Database is healthy"
else
    log_error "❌ Database is not healthy"
fi

# Test Redis connection
if docker-compose -f infrastructure/docker-compose.prod.yml exec -T redis redis-cli ping > /dev/null 2>&1; then
    log_info "✅ Redis is healthy"
else
    log_error "❌ Redis is not healthy"
fi

# Display deployment summary
log_info "🎉 Production deployment completed!"
echo
echo "📋 Deployment Summary:"
echo "  Domain: https://$DOMAIN"
echo "  API Health: https://$DOMAIN/health"
echo "  Grafana Dashboard: https://$DOMAIN:3001"
echo "  Prometheus Metrics: https://$DOMAIN:9090"
echo
echo "📝 Post-deployment tasks:"
echo "  1. Verify all services are running: docker-compose -f infrastructure/docker-compose.prod.yml ps"
echo "  2. Check logs: docker-compose -f infrastructure/docker-compose.prod.yml logs -f"
echo "  3. Set up SSL certificate auto-renewal cron job"
echo "  4. Configure monitoring alerts"
echo "  5. Test mobile app integration"
echo "  6. Update DNS records if needed"
echo
echo "🔐 Security reminders:"
echo "  1. Change default passwords in .env file"
echo "  2. Restrict database access to application servers only"
echo "  3. Enable firewall rules"
echo "  4. Set up log monitoring and alerting"
echo "  5. Schedule regular security scans"