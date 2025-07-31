# Complete Deployment Guide

## 🎯 Overview

This guide covers the complete deployment process for the Offline Blockchain Wallet system, including backend API, mobile app, and infrastructure setup.

## 📋 Prerequisites

### System Requirements
- Docker 20.10+
- Docker Compose 2.0+
- Node.js 18+
- PostgreSQL 13+
- Redis 6+
- Nginx 1.20+
- SSL certificates
- Domain name

### Development Tools
- Git
- npm/yarn
- Xcode 15+ (for iOS)
- Apple Developer Account
- Ethereum node access (Infura/Alchemy)

## 🖥️ Backend Deployment

### 1. Environment Setup

```bash
# Clone repository
git clone <repository-url>
cd backend

# Create production environment
cp .env.example .env.production
```

### 2. Production Environment Variables

```bash
# Server Configuration
PORT=3000
NODE_ENV=production
API_VERSION=v1

# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=wallet_prod
DB_USER=wallet_user
DB_PASSWORD=secure_production_password
DB_SSL=true

# JWT Security
JWT_SECRET=your_super_secure_jwt_secret_256_bits
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# Blockchain
ETH_RPC_URL=https://mainnet.infura.io/v3/your_infura_key
ETH_PRIVATE_KEY=0x...
CONTRACT_ADDRESS=0x...

# Redis
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=secure_redis_password

# Security
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
BCRYPT_SALT_ROUNDS=12
```

### 3. Database Setup

```bash
# Start PostgreSQL container
docker-compose -f infrastructure/docker-compose.prod.yml up -d postgres

# Wait for database to be ready
sleep 10

# Run migrations
npm run db:migrate:prod

# Seed initial data (optional)
npm run db:seed:prod
```

### 4. SSL Certificate Setup

```bash
# Using Let's Encrypt
./scripts/setup-ssl.sh your-domain.com

# Or use existing certificates
cp /path/to/cert.pem infrastructure/ssl/
cp /path/to/key.pem infrastructure/ssl/
```
"#
## 5. Smart Contract Deployment

```bash
# Deploy to mainnet
npm run deploy:mainnet

# Verify contract on Etherscan
npm run verify:contract -- --network mainnet

# Update contract address in environment
echo \"CONTRACT_ADDRESS=0x...\" >> .env.production
```

### 6. Production Deployment

```bash
# Build and deploy all services
./scripts/deploy-production.sh

# Verify deployment
curl https://your-domain.com/health
```

## 📱 Mobile App Deployment

### 1. iOS App Store Preparation

```bash
cd ios/offline-blockchain-wallet-ios

# Update version
./scripts/update-version.sh 1.0.0

# Configure release settings
vim offline-blockchain-wallet-ios/Configuration/Release.xcconfig
```

### 2. Build for Release

```bash
# Clean and build
./scripts/build.sh --release

# Run tests
swift test

# Archive for App Store
xcodebuild archive -scheme offline-blockchain-wallet-ios \\
  -archivePath build/offline-blockchain-wallet-ios.xcarchive
```

### 3. App Store Submission

```bash
# Export for App Store
xcodebuild -exportArchive \\
  -archivePath build/offline-blockchain-wallet-ios.xcarchive \\
  -exportPath build/AppStore \\
  -exportOptionsPlist ExportOptions.plist

# Upload to App Store Connect
xcrun altool --upload-app \\
  -f build/AppStore/offline-blockchain-wallet-ios.ipa \\
  -u your-apple-id@example.com
```

## 🏗️ Infrastructure Setup

### Docker Compose Configuration

```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  app:
    build: .
    ports:
      - \"3000:3000\"
    environment:
      - NODE_ENV=production
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  postgres:
    image: postgres:13
    environment:
      POSTGRES_DB: wallet_prod
      POSTGRES_USER: wallet_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./infrastructure/postgres/postgresql.conf:/etc/postgresql/postgresql.conf
    restart: unless-stopped

  redis:
    image: redis:6-alpine
    command: redis-server /usr/local/etc/redis/redis.conf
    volumes:
      - redis_data:/data
      - ./infrastructure/redis/redis.conf:/usr/local/etc/redis/redis.conf
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - \"80:80\"
      - \"443:443\"
    volumes:
      - ./infrastructure/nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./infrastructure/ssl:/etc/ssl
    depends_on:
      - app
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/ssl/cert.pem;
    ssl_certificate_key /etc/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;

    location / {
        proxy_pass http://app:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection \"upgrade\";
    }

    location /health {
        proxy_pass http://app:3000/health;
        access_log off;
    }

    location /metrics {
        proxy_pass http://app:3000/metrics;
        allow 10.0.0.0/8;
        deny all;
    }
}
```

## 📊 Monitoring Setup

### Prometheus Configuration

```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'wallet-api'
    static_configs:
      - targets: ['app:3000']
    metrics_path: '/metrics'
    scrape_interval: 30s

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']

  - job_name: 'nginx'
    static_configs:
      - targets: ['nginx-exporter:9113']
```

### Grafana Dashboard Setup

```bash
# Start monitoring stack
docker-compose -f infrastructure/monitoring/docker-compose.yml up -d

# Import dashboards
curl -X POST \\
  http://admin:admin@localhost:3001/api/dashboards/db \\
  -H 'Content-Type: application/json' \\
  -d @infrastructure/monitoring/grafana/dashboards/wallet-api.json
```

## 🔒 Security Hardening

### 1. Firewall Configuration

```bash
# Configure UFW
ufw --force reset
ufw default deny incoming
ufw default allow outgoing

# Allow necessary ports
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS

# Enable firewall
ufw --force enable
```

### 2. Database Security

```bash
# PostgreSQL security configuration
echo \"listen_addresses = 'localhost'\" >> /etc/postgresql/13/main/postgresql.conf
echo \"ssl = on\" >> /etc/postgresql/13/main/postgresql.conf

# Restrict connections
echo \"host wallet_prod wallet_user 127.0.0.1/32 md5\" >> /etc/postgresql/13/main/pg_hba.conf
```

### 3. SSL/TLS Hardening

```bash
# Generate strong DH parameters
openssl dhparam -out /etc/ssl/dhparam.pem 2048

# Add to nginx configuration
ssl_dhparam /etc/ssl/dhparam.pem;
ssl_session_timeout 1d;
ssl_session_cache shared:SSL:50m;
ssl_stapling on;
ssl_stapling_verify on;
```

## 💾 Backup and Recovery

### Database Backup

```bash
#!/bin/bash
# backup-database.sh

BACKUP_DIR=\"/backups/postgres\"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME=\"wallet_prod\"

# Create backup
pg_dump -h localhost -U wallet_user $DB_NAME | \\
  gzip > \"$BACKUP_DIR/wallet_db_$DATE.sql.gz\"

# Encrypt backup
gpg --encrypt --recipient backup@company.com \\
  \"$BACKUP_DIR/wallet_db_$DATE.sql.gz\"

# Clean old backups (keep 30 days)
find $BACKUP_DIR -name \"*.gpg\" -mtime +30 -delete
```

### Automated Backup Schedule

```bash
# Add to crontab
crontab -e

# Daily backup at 2 AM
0 2 * * * /opt/wallet/scripts/backup-database.sh

# Weekly full system backup
0 3 * * 0 /opt/wallet/scripts/backup-system.sh
```

### Recovery Process

```bash
# Restore from backup
gpg --decrypt backup_file.sql.gz.gpg | \\
  gunzip | \\
  psql -h localhost -U wallet_user wallet_prod

# Verify data integrity
psql -h localhost -U wallet_user wallet_prod -c \"SELECT COUNT(*) FROM users;\"
```

## 🚀 Deployment Scripts

### Production Deployment Script

```bash
#!/bin/bash
# deploy-production.sh

set -e

echo \"🚀 Starting production deployment...\"

# Pull latest code
git pull origin main

# Build application
echo \"📦 Building application...\"
npm ci --production
npm run build

# Run database migrations
echo \"🗄️ Running database migrations...\"
npm run db:migrate:prod

# Build and start containers
echo \"🐳 Starting Docker containers...\"
docker-compose -f infrastructure/docker-compose.prod.yml build
docker-compose -f infrastructure/docker-compose.prod.yml up -d

# Wait for services to be ready
echo \"⏳ Waiting for services...\"
sleep 30

# Health check
echo \"🏥 Performing health check...\"
if curl -f https://your-domain.com/health; then
    echo \"✅ Deployment successful!\"
else
    echo \"❌ Deployment failed!\"
    exit 1
fi

# Clean up old images
docker image prune -f

echo \"🎉 Production deployment completed!\"
```

### Rollback Script

```bash
#!/bin/bash
# rollback.sh

set -e

PREVIOUS_VERSION=${1:-HEAD~1}

echo \"🔄 Rolling back to $PREVIOUS_VERSION...\"

# Checkout previous version
git checkout $PREVIOUS_VERSION

# Rebuild and restart
npm ci --production
npm run build

docker-compose -f infrastructure/docker-compose.prod.yml build
docker-compose -f infrastructure/docker-compose.prod.yml up -d

# Health check
if curl -f https://your-domain.com/health; then
    echo \"✅ Rollback successful!\"
else
    echo \"❌ Rollback failed!\"
    exit 1
fi
```

## 📋 Deployment Checklist

### Pre-Deployment
- [ ] All tests passing
- [ ] Security audit completed
- [ ] Performance testing done
- [ ] Backup procedures tested
- [ ] SSL certificates valid
- [ ] Environment variables configured
- [ ] Database migrations ready
- [ ] Smart contracts deployed
- [ ] Monitoring configured

### Deployment
- [ ] Deploy backend services
- [ ] Run database migrations
- [ ] Verify smart contract deployment
- [ ] Configure load balancer
- [ ] Test all API endpoints
- [ ] Verify SSL configuration
- [ ] Check application logs
- [ ] Validate monitoring alerts

### Post-Deployment
- [ ] Monitor system metrics
- [ ] Verify backup procedures
- [ ] Test disaster recovery
- [ ] Update documentation
- [ ] Notify stakeholders
- [ ] Schedule security review

## 🔧 Maintenance

### Regular Maintenance Tasks

```bash
# Weekly maintenance script
#!/bin/bash
# weekly-maintenance.sh

# Update system packages
sudo apt update && sudo apt upgrade -y

# Clean Docker resources
docker system prune -f

# Rotate logs
logrotate /etc/logrotate.conf

# Check disk space
df -h

# Verify backups
./scripts/verify-backups.sh

# Security scan
./scripts/security-scan.sh
```

### Performance Monitoring

```bash
# Monitor key metrics
echo \"📊 System Performance Report\"
echo \"=============================\"
echo \"CPU Usage: $(top -bn1 | grep \"Cpu(s)\" | awk '{print $2}' | cut -d'%' -f1)\"
echo \"Memory Usage: $(free | grep Mem | awk '{printf \"%.2f%%\", $3/$2 * 100.0}')\"
echo \"Disk Usage: $(df -h / | awk 'NR==2{printf \"%s\", $5}')\"
echo \"Active Connections: $(netstat -an | grep :3000 | wc -l)\"
```

## 🆘 Troubleshooting

### Common Issues

#### Service Won't Start
```bash
# Check logs
docker-compose logs app

# Check port conflicts
sudo netstat -tulpn | grep :3000

# Restart services
docker-compose restart
```

#### Database Connection Issues
```bash
# Test database connection
psql -h localhost -U wallet_user -d wallet_prod

# Check PostgreSQL logs
docker-compose logs postgres

# Restart database
docker-compose restart postgres
```

#### SSL Certificate Issues
```bash
# Check certificate validity
openssl x509 -in /etc/ssl/cert.pem -text -noout

# Test SSL connection
openssl s_client -connect your-domain.com:443

# Renew Let's Encrypt certificate
certbot renew
```

### Emergency Procedures

#### System Recovery
```bash
# Emergency rollback
./scripts/rollback.sh

# Restore from backup
./scripts/restore-backup.sh latest

# Scale down to maintenance mode
docker-compose scale app=0
```

#### Contact Information
- **DevOps Team**: devops@company.com
- **Security Team**: security@company.com
- **On-call Engineer**: +1-555-0123

---

*This deployment guide is maintained by the DevOps team and updated with each release. For questions or issues, please contact the development team.*
"