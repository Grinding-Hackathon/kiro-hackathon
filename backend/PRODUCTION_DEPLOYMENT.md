# Production Deployment Guide

This guide covers the complete deployment of the Offline Blockchain Wallet backend services to a production environment.

## Prerequisites

### System Requirements
- Ubuntu 20.04+ or CentOS 8+ server
- Minimum 4GB RAM, 2 CPU cores
- 50GB+ available disk space
- Docker and Docker Compose installed
- Domain name with DNS configured
- SSL certificate (Let's Encrypt recommended)

### Required Accounts & API Keys
- Ethereum mainnet RPC provider (Infura, Alchemy, etc.)
- Etherscan API key for contract verification
- Email service for alerts (optional)
- Monitoring service API keys (optional)

## Pre-Deployment Setup

### 1. Server Preparation

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

# Install certbot for SSL certificates
sudo apt install certbot -y
```

### 2. Environment Configuration

```bash
# Clone the repository
git clone <repository-url>
cd offline-blockchain-wallet/backend

# Copy and configure environment file
cp .env.production .env
nano .env  # Configure all required variables
```

### 3. SSL Certificate Setup

```bash
# For Let's Encrypt certificates
sudo certbot certonly --standalone -d your-domain.com -m admin@your-domain.com --agree-tos

# Or use the setup script
./scripts/setup-ssl.sh your-domain.com admin@your-domain.com
```

## Deployment Process

### Automated Deployment

```bash
# Run the automated deployment script
./scripts/deploy-production.sh your-domain.com admin@your-domain.com

# The script will:
# 1. Run pre-deployment checks
# 2. Create database backup
# 3. Build Docker images
# 4. Run security scans
# 5. Deploy services with zero downtime
# 6. Run health checks
# 7. Deploy smart contracts (optional)
```

### Manual Deployment Steps

If you prefer manual deployment:

```bash
# 1. Build production images
docker-compose -f infrastructure/docker-compose.prod.yml build

# 2. Start database services
docker-compose -f infrastructure/docker-compose.prod.yml up -d postgres redis

# 3. Run database migrations
docker-compose -f infrastructure/docker-compose.prod.yml run --rm app1 npm run migrate

# 4. Start all services
docker-compose -f infrastructure/docker-compose.prod.yml up -d

# 5. Deploy smart contracts
npm run deploy:mainnet
```

## Smart Contract Deployment

### Mainnet Deployment

```bash
# Set environment variables
export ETHEREUM_MAINNET_RPC_URL="https://mainnet.infura.io/v3/YOUR_PROJECT_ID"
export ETHEREUM_PRIVATE_KEY="your_private_key_here"
export ETHERSCAN_API_KEY="your_etherscan_api_key"

# Deploy to mainnet
npm run deploy:mainnet

# Verify contract on Etherscan
npx hardhat verify --network mainnet <CONTRACT_ADDRESS>
```

### Gas Optimization

- Monitor gas prices before deployment
- Use gas estimation tools
- Consider deploying during low-traffic periods
- Set appropriate gas limits and prices

## Infrastructure Components

### Load Balancer (Nginx)
- SSL termination
- Rate limiting
- Security headers
- Health check routing

### Application Servers
- 2 Node.js instances for high availability
- Health checks and auto-restart
- Centralized logging
- Metrics collection

### Database (PostgreSQL)
- Master-slave replication (optional)
- Automated backups
- Connection pooling
- Performance monitoring

### Cache (Redis)
- Session storage
- API response caching
- Rate limiting data
- Background job queues

### Monitoring Stack
- Prometheus for metrics collection
- Grafana for visualization
- Alert manager for notifications
- Custom business metrics

## Security Configuration

### Network Security
```bash
# Configure firewall
sudo ufw enable
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw deny 5432/tcp   # Block direct database access
sudo ufw deny 6379/tcp   # Block direct Redis access
```

### Application Security
- JWT token authentication
- Rate limiting per IP
- Input validation and sanitization
- SQL injection prevention
- XSS protection headers
- CORS configuration

### Database Security
- Strong passwords
- SSL connections only
- Limited user privileges
- Regular security updates
- Audit logging

## Monitoring and Alerting

### Key Metrics to Monitor
- Application response times
- Error rates and status codes
- Database connection pool usage
- Memory and CPU utilization
- Disk space usage
- Blockchain connection status
- Token expiration rates

### Alert Configuration
```yaml
# Example alert rules (already configured in alert_rules.yml)
- Application downtime > 1 minute
- Error rate > 10%
- Response time > 1 second
- Database connections > 80%
- Disk usage > 85%
- Memory usage > 85%
```

### Log Management
- Centralized logging with structured format
- Log rotation and archival
- Error tracking and aggregation
- Security event monitoring

## Backup and Recovery

### Database Backups
```bash
# Automated daily backups
crontab -e
# Add: 0 2 * * * /path/to/backup-database.sh

# Manual backup
./scripts/backup-database.sh

# Restore from backup
pg_restore -h localhost -U postgres -d offline_wallet backup_file.sql
```

### Disaster Recovery Plan
1. **Data Backup**: Daily automated database backups
2. **Code Backup**: Git repository with tagged releases
3. **Configuration Backup**: Environment files and certificates
4. **Recovery Testing**: Monthly recovery drills
5. **Documentation**: Updated runbooks and procedures

## Performance Optimization

### Database Optimization
- Connection pooling
- Query optimization
- Index management
- Regular VACUUM and ANALYZE

### Application Optimization
- Response caching
- Database query optimization
- Memory management
- Connection reuse

### Infrastructure Optimization
- Load balancing
- CDN for static assets
- Gzip compression
- HTTP/2 support

## Maintenance Procedures

### Regular Maintenance Tasks
- **Daily**: Monitor alerts and logs
- **Weekly**: Review performance metrics
- **Monthly**: Security updates and patches
- **Quarterly**: Disaster recovery testing

### Update Procedures
```bash
# 1. Create backup
./scripts/backup-database.sh

# 2. Pull latest code
git pull origin main

# 3. Build new images
docker-compose -f infrastructure/docker-compose.prod.yml build

# 4. Rolling update
docker-compose -f infrastructure/docker-compose.prod.yml up -d --no-deps app1
# Wait and verify
docker-compose -f infrastructure/docker-compose.prod.yml up -d --no-deps app2
```

## Troubleshooting

### Common Issues

#### Service Won't Start
```bash
# Check logs
docker-compose -f infrastructure/docker-compose.prod.yml logs app1

# Check resource usage
docker stats

# Restart service
docker-compose -f infrastructure/docker-compose.prod.yml restart app1
```

#### Database Connection Issues
```bash
# Check database status
docker-compose -f infrastructure/docker-compose.prod.yml exec postgres pg_isready

# Check connection limits
docker-compose -f infrastructure/docker-compose.prod.yml exec postgres psql -U postgres -c "SELECT * FROM pg_stat_activity;"
```

#### SSL Certificate Issues
```bash
# Check certificate expiry
openssl x509 -in infrastructure/nginx/ssl/cert.pem -text -noout | grep "Not After"

# Renew certificate
./scripts/renew-ssl.sh your-domain.com
```

### Emergency Procedures

#### Service Outage
1. Check service status and logs
2. Restart affected services
3. Verify database connectivity
4. Check external dependencies (blockchain RPC)
5. Escalate if needed

#### Security Incident
1. Isolate affected systems
2. Preserve logs and evidence
3. Assess impact and scope
4. Implement containment measures
5. Document and report incident

## Support and Maintenance

### Monitoring Dashboards
- **Grafana**: http://your-domain.com:3001
- **Prometheus**: http://your-domain.com:9090
- **Application Health**: https://your-domain.com/health

### Log Locations
- Application logs: `/app/logs/`
- Nginx logs: `/var/log/nginx/`
- Database logs: PostgreSQL container logs
- System logs: `/var/log/syslog`

### Contact Information
- **Technical Support**: tech-support@your-domain.com
- **Security Issues**: security@your-domain.com
- **Emergency Contact**: +1-XXX-XXX-XXXX

## Compliance and Security

### Security Audits
- Regular penetration testing
- Code security reviews
- Dependency vulnerability scans
- Infrastructure security assessments

### Compliance Requirements
- Data protection regulations (GDPR, CCPA)
- Financial services regulations
- Blockchain compliance requirements
- Audit trail maintenance

This deployment guide ensures a secure, scalable, and maintainable production environment for the Offline Blockchain Wallet backend services.