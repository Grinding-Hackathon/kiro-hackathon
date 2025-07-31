# Deployment Runbook

## Overview
This runbook provides step-by-step instructions for deploying the Offline Blockchain Wallet backend system to production, including security validation, performance testing, and operational procedures.

## Prerequisites

### System Requirements
- Ubuntu 20.04+ or CentOS 8+ server
- Minimum 8GB RAM, 4 CPU cores, 100GB SSD storage
- Docker 20.10+ and Docker Compose 2.0+
- Node.js 18+ (for local development/testing)
- PostgreSQL 14+ (can be containerized)
- Redis 6+ (can be containerized)

### Access Requirements
- SSH access to production servers
- Docker Hub or private registry access
- Database administrator credentials
- Ethereum node access (Infura/Alchemy API keys)
- SSL certificate management access
- DNS management access

### Security Prerequisites
- All security audit tests must pass
- Penetration testing completed
- Cryptographic validation completed
- Load testing benchmarks met
- Code review and approval obtained

## Pre-Deployment Security Validation

### 1. Run Security Test Suite
```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm ci

# Run comprehensive security tests
npm run test:security

# Run cryptographic validation tests
npm run test:crypto

# Run load testing
npm run test:load

# Verify all tests pass
echo "All security tests must pass before proceeding"
```

### 2. Security Checklist Verification
- [ ] Authentication mechanisms tested
- [ ] Authorization rules validated
- [ ] Input validation and sanitization verified
- [ ] SQL injection prevention confirmed
- [ ] XSS protection enabled
- [ ] CSRF protection configured
- [ ] Rate limiting tested
- [ ] Security headers configured
- [ ] Cryptographic operations validated
- [ ] JWT token security verified

### 3. Load Testing Validation
```bash
# Run load tests with specific thresholds
npm run test:load -- --threshold-response-time=2000
npm run test:load -- --threshold-concurrent-users=100
npm run test:load -- --threshold-error-rate=0.01

# Verify performance benchmarks
echo "Response time < 2s: PASS/FAIL"
echo "Concurrent users > 100: PASS/FAIL"
echo "Error rate < 1%: PASS/FAIL"
```

## Deployment Process

### Phase 1: Environment Preparation

#### 1.1 Server Setup
```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installations
docker --version
docker-compose --version
```

#### 1.2 Security Hardening
```bash
# Configure firewall
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Disable root login
sudo sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sudo systemctl restart ssh

# Set up fail2ban
sudo apt install fail2ban -y
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

#### 1.3 SSL Certificate Setup
```bash
# Install Certbot
sudo apt install certbot -y

# Obtain SSL certificate
sudo certbot certonly --standalone -d your-domain.com

# Set up auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Phase 2: Application Deployment

#### 2.1 Code Deployment
```bash
# Clone repository
git clone https://github.com/your-org/offline-blockchain-wallet.git
cd offline-blockchain-wallet/backend

# Checkout specific version/tag
git checkout v1.0.0

# Verify code integrity
git verify-commit HEAD
```

#### 2.2 Environment Configuration
```bash
# Copy production environment template
cp .env.production .env

# Edit environment variables
nano .env

# Required variables:
# NODE_ENV=production
# PORT=3000
# DATABASE_URL=postgresql://user:pass@localhost:5432/wallet_db
# REDIS_URL=redis://localhost:6379
# JWT_SECRET=your-super-secret-jwt-key
# ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/your-key
# ETHEREUM_PRIVATE_KEY=your-private-key
# CORS_ORIGINS=https://your-frontend-domain.com
```

#### 2.3 Database Setup
```bash
# Start database container
docker-compose up -d postgres redis

# Wait for database to be ready
sleep 30

# Run database migrations
npm run migrate:prod

# Verify database schema
npm run db:verify

# Create initial data (if needed)
npm run seed:prod
```

#### 2.4 Smart Contract Deployment
```bash
# Compile contracts
npm run compile

# Deploy to testnet first (for verification)
npm run deploy:testnet

# Verify testnet deployment
npm run verify:testnet

# Deploy to mainnet
npm run deploy:mainnet

# Verify mainnet deployment
npm run verify:mainnet

# Update environment with contract addresses
echo "OFFLINE_TOKEN_CONTRACT_ADDRESS=0x..." >> .env
```

### Phase 3: Service Deployment

#### 3.1 Build and Start Services
```bash
# Build production Docker image
docker-compose -f docker-compose.prod.yml build

# Start all services
docker-compose -f docker-compose.prod.yml up -d

# Verify services are running
docker-compose -f docker-compose.prod.yml ps
```

#### 3.2 Health Check Verification
```bash
# Wait for services to start
sleep 60

# Check application health
curl -f http://localhost:3000/api/health || exit 1

# Check database connectivity
curl -f http://localhost:3000/api/health/db || exit 1

# Check Redis connectivity
curl -f http://localhost:3000/api/health/redis || exit 1

# Check blockchain connectivity
curl -f http://localhost:3000/api/health/blockchain || exit 1
```

#### 3.3 Load Balancer Configuration
```bash
# Configure Nginx
sudo cp infrastructure/nginx/nginx.conf /etc/nginx/sites-available/wallet
sudo ln -s /etc/nginx/sites-available/wallet /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Phase 4: Post-Deployment Validation

#### 4.1 Functional Testing
```bash
# Run smoke tests
npm run test:smoke

# Test critical endpoints
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass"}'

# Test wallet operations
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass"}' | jq -r '.token')

curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/wallet/balance
```

#### 4.2 Performance Validation
```bash
# Run performance tests
npm run test:performance

# Monitor resource usage
docker stats

# Check response times
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3000/api/health
```

#### 4.3 Security Validation
```bash
# Verify security headers
curl -I https://your-domain.com/api/health

# Test rate limiting
for i in {1..20}; do
  curl -X POST https://your-domain.com/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test","password":"test"}'
done

# Verify SSL configuration
openssl s_client -connect your-domain.com:443 -servername your-domain.com
```

## Monitoring and Alerting Setup

### 1. Prometheus Configuration
```bash
# Start monitoring stack
docker-compose -f infrastructure/monitoring/docker-compose.yml up -d

# Verify Prometheus targets
curl http://localhost:9090/api/v1/targets

# Verify Grafana access
curl http://localhost:3001/api/health
```

### 2. Alert Configuration
```bash
# Copy alert rules
cp infrastructure/monitoring/alert_rules.yml /etc/prometheus/

# Reload Prometheus configuration
curl -X POST http://localhost:9090/-/reload

# Test alert rules
curl http://localhost:9090/api/v1/rules
```

### 3. Log Aggregation
```bash
# Configure log rotation
sudo cp infrastructure/logging/logrotate.conf /etc/logrotate.d/wallet

# Set up centralized logging (if using ELK stack)
docker-compose -f infrastructure/logging/docker-compose.yml up -d
```

## Backup and Recovery Procedures

### 1. Database Backup
```bash
# Create backup script
cp scripts/backup-database.sh /usr/local/bin/
chmod +x /usr/local/bin/backup-database.sh

# Set up automated backups
sudo crontab -e
# Add: 0 2 * * * /usr/local/bin/backup-database.sh

# Test backup restoration
./scripts/test-backup-restore.sh
```

### 2. Configuration Backup
```bash
# Backup environment configuration
tar -czf config-backup-$(date +%Y%m%d).tar.gz .env docker-compose.prod.yml

# Store in secure location
aws s3 cp config-backup-$(date +%Y%m%d).tar.gz s3://your-backup-bucket/
```

## Rollback Procedures

### 1. Application Rollback
```bash
# Stop current services
docker-compose -f docker-compose.prod.yml down

# Checkout previous version
git checkout v0.9.0

# Rebuild and restart
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d

# Verify rollback
curl -f http://localhost:3000/api/health
```

### 2. Database Rollback
```bash
# Stop application
docker-compose -f docker-compose.prod.yml stop app

# Restore database from backup
./scripts/restore-database.sh backup-20240130.sql

# Restart application
docker-compose -f docker-compose.prod.yml start app
```

## Troubleshooting Guide

### Common Issues

#### 1. Service Won't Start
```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs app

# Check resource usage
df -h
free -m

# Check port conflicts
netstat -tulpn | grep :3000
```

#### 2. Database Connection Issues
```bash
# Check database status
docker-compose -f docker-compose.prod.yml logs postgres

# Test connection manually
psql -h localhost -U wallet_user -d wallet_db

# Check connection pool
curl http://localhost:3000/api/health/db
```

#### 3. Blockchain Connectivity Issues
```bash
# Check Ethereum node status
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  $ETHEREUM_RPC_URL

# Check contract deployment
npm run verify:contract

# Check gas prices
curl https://api.etherscan.io/api?module=gastracker&action=gasoracle
```

#### 4. Performance Issues
```bash
# Check resource usage
docker stats

# Analyze slow queries
docker exec -it postgres_container psql -U wallet_user -d wallet_db \
  -c "SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"

# Check Redis performance
docker exec -it redis_container redis-cli info stats
```

## Security Incident Response

### 1. Incident Detection
```bash
# Check security logs
tail -f /var/log/auth.log
docker-compose -f docker-compose.prod.yml logs app | grep -i "security\|error\|unauthorized"

# Check for suspicious activity
curl http://localhost:3000/api/security/audit-log
```

### 2. Incident Response
```bash
# Immediate actions
# 1. Isolate affected systems
docker-compose -f docker-compose.prod.yml stop

# 2. Preserve evidence
tar -czf incident-logs-$(date +%Y%m%d-%H%M).tar.gz /var/log/ logs/

# 3. Notify security team
echo "Security incident detected at $(date)" | mail -s "URGENT: Security Incident" security@company.com
```

### 3. Recovery Actions
```bash
# After investigation and remediation
# 1. Apply security patches
git pull origin security-patch-branch
docker-compose -f docker-compose.prod.yml build

# 2. Restart services
docker-compose -f docker-compose.prod.yml up -d

# 3. Verify security measures
npm run test:security
```

## Maintenance Procedures

### 1. Regular Updates
```bash
# Monthly security updates
sudo apt update && sudo apt upgrade -y

# Quarterly dependency updates
npm audit
npm update

# Docker image updates
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d
```

### 2. Performance Optimization
```bash
# Database maintenance
docker exec -it postgres_container psql -U wallet_user -d wallet_db \
  -c "VACUUM ANALYZE;"

# Redis maintenance
docker exec -it redis_container redis-cli FLUSHDB

# Log cleanup
find /var/log -name "*.log" -mtime +30 -delete
```

### 3. Security Audits
```bash
# Monthly security scan
npm audit
docker scan wallet-backend:latest

# Quarterly penetration testing
./scripts/run-security-tests.sh

# Annual security review
./scripts/comprehensive-security-audit.sh
```

## Contact Information

### Emergency Contacts
- **On-Call Engineer**: +1-555-0123
- **Security Team**: security@company.com
- **DevOps Team**: devops@company.com
- **Management**: management@company.com

### Escalation Procedures
1. **Level 1**: On-call engineer (immediate response)
2. **Level 2**: Team lead (within 30 minutes)
3. **Level 3**: Management (within 1 hour)
4. **Level 4**: Executive team (critical incidents only)

### Documentation Links
- **API Documentation**: https://docs.company.com/api
- **Architecture Diagrams**: https://wiki.company.com/architecture
- **Security Policies**: https://wiki.company.com/security
- **Incident Response Plan**: https://wiki.company.com/incident-response

---

**Document Version**: 1.0
**Last Updated**: $(date)
**Next Review Date**: $(date -d "+3 months")
**Document Owner**: DevOps Team