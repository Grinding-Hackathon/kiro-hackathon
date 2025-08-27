#!/bin/bash

# Production Monitoring Setup Script
# Sets up comprehensive monitoring for API Integration Fixes

set -e

echo "📊 Setting up production monitoring for API Integration Fixes..."

# Configuration
GRAFANA_ADMIN_PASSWORD=${1:-"admin123"}
ALERT_EMAIL=${2:-"alerts@offlinewallet.com"}
SLACK_WEBHOOK_URL=${3:-""}

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

log_step "1. Creating monitoring directories"

# Create monitoring directories
mkdir -p infrastructure/monitoring/{prometheus,grafana,alertmanager}
mkdir -p infrastructure/monitoring/grafana/{dashboards,datasources,provisioning}
mkdir -p logs/monitoring

log_info "✅ Monitoring directories created"

log_step "2. Configuring Prometheus"

# Create Prometheus configuration
cat > infrastructure/monitoring/prometheus/prometheus.yml << EOF
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    cluster: 'offline-wallet-production'
    environment: 'production'

rule_files:
  - "/etc/prometheus/alert_rules.yml"
  - "/etc/prometheus/api-integration-alerts.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'offline-wallet-backend'
    static_configs:
      - targets: ['app:3000']
    metrics_path: '/metrics'
    scrape_interval: 15s
    scrape_timeout: 10s

  - job_name: 'postgres-exporter'
    static_configs:
      - targets: ['postgres-exporter:9187']

  - job_name: 'redis-exporter'
    static_configs:
      - targets: ['redis-exporter:9121']

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']

  - job_name: 'nginx-exporter'
    static_configs:
      - targets: ['nginx-exporter:9113']

  # API Integration specific metrics
  - job_name: 'api-integration-endpoints'
    static_configs:
      - targets: ['app:3000']
    metrics_path: '/api/v1/metrics'
    scrape_interval: 10s
    params:
      module: [api_integration]

  - job_name: 'blockchain-metrics'
    static_configs:
      - targets: ['app:3000']
    metrics_path: '/api/v1/blockchain/metrics'
    scrape_interval: 30s

  - job_name: 'security-metrics'
    static_configs:
      - targets: ['app:3000']
    metrics_path: '/api/v1/security/metrics'
    scrape_interval: 10s
EOF

log_info "✅ Prometheus configuration created"

log_step "3. Configuring Alertmanager"

# Create Alertmanager configuration
cat > infrastructure/monitoring/alertmanager/alertmanager.yml << EOF
global:
  smtp_smarthost: 'localhost:587'
  smtp_from: 'alerts@offlinewallet.com'
  smtp_auth_username: 'alerts@offlinewallet.com'
  smtp_auth_password: 'your-smtp-password'

route:
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'web.hook'
  routes:
  - match:
      severity: critical
    receiver: 'critical-alerts'
    group_wait: 5s
    repeat_interval: 30m
  - match:
      severity: warning
    receiver: 'warning-alerts'
    repeat_interval: 2h
  - match:
      component: security
    receiver: 'security-alerts'
    group_wait: 0s
    repeat_interval: 15m

receivers:
- name: 'web.hook'
  webhook_configs:
  - url: 'http://localhost:5001/'

- name: 'critical-alerts'
  email_configs:
  - to: '${ALERT_EMAIL}'
    subject: '🚨 CRITICAL: {{ .GroupLabels.alertname }} - Offline Wallet'
    body: |
      {{ range .Alerts }}
      Alert: {{ .Annotations.summary }}
      Description: {{ .Annotations.description }}
      Instance: {{ .Labels.instance }}
      Severity: {{ .Labels.severity }}
      Time: {{ .StartsAt }}
      {{ end }}
  $([ -n "$SLACK_WEBHOOK_URL" ] && cat << SLACK_EOF
  slack_configs:
  - api_url: '${SLACK_WEBHOOK_URL}'
    channel: '#wallet-alerts'
    title: '🚨 CRITICAL Alert'
    text: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'
    color: 'danger'
SLACK_EOF
)

- name: 'warning-alerts'
  email_configs:
  - to: '${ALERT_EMAIL}'
    subject: '⚠️ WARNING: {{ .GroupLabels.alertname }} - Offline Wallet'
    body: |
      {{ range .Alerts }}
      Alert: {{ .Annotations.summary }}
      Description: {{ .Annotations.description }}
      Instance: {{ .Labels.instance }}
      Severity: {{ .Labels.severity }}
      Time: {{ .StartsAt }}
      {{ end }}

- name: 'security-alerts'
  email_configs:
  - to: 'security@offlinewallet.com'
    subject: '🔒 SECURITY ALERT: {{ .GroupLabels.alertname }}'
    body: |
      SECURITY INCIDENT DETECTED
      
      {{ range .Alerts }}
      Alert: {{ .Annotations.summary }}
      Description: {{ .Annotations.description }}
      Instance: {{ .Labels.instance }}
      Time: {{ .StartsAt }}
      
      IMMEDIATE ACTION REQUIRED
      {{ end }}
  $([ -n "$SLACK_WEBHOOK_URL" ] && cat << SLACK_EOF
  slack_configs:
  - api_url: '${SLACK_WEBHOOK_URL}'
    channel: '#security-alerts'
    title: '🔒 SECURITY ALERT'
    text: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'
    color: 'danger'
SLACK_EOF
)

inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname', 'cluster', 'service']
EOF

log_info "✅ Alertmanager configuration created"

log_step "4. Setting up Grafana"

# Create Grafana datasource configuration
mkdir -p infrastructure/monitoring/grafana/provisioning/datasources
cat > infrastructure/monitoring/grafana/provisioning/datasources/prometheus.yml << EOF
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true
EOF

# Create Grafana dashboard provisioning
mkdir -p infrastructure/monitoring/grafana/provisioning/dashboards
cat > infrastructure/monitoring/grafana/provisioning/dashboards/dashboards.yml << EOF
apiVersion: 1

providers:
  - name: 'default'
    orgId: 1
    folder: ''
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /var/lib/grafana/dashboards
EOF

# Copy the API integration dashboard
cp infrastructure/monitoring/grafana-dashboard-api-integration.json \
   infrastructure/monitoring/grafana/dashboards/

log_info "✅ Grafana configuration created"

log_step "5. Creating monitoring Docker Compose"

cat > infrastructure/monitoring/docker-compose.yml << EOF
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      - ../alert_rules.yml:/etc/prometheus/alert_rules.yml
      - ./api-integration-alerts.yml:/etc/prometheus/api-integration-alerts.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--storage.tsdb.retention.time=200h'
      - '--web.enable-lifecycle'
      - '--web.enable-admin-api'
    restart: unless-stopped
    networks:
      - monitoring

  alertmanager:
    image: prom/alertmanager:latest
    container_name: alertmanager
    ports:
      - "9093:9093"
    volumes:
      - ./alertmanager/alertmanager.yml:/etc/alertmanager/alertmanager.yml
      - alertmanager_data:/alertmanager
    command:
      - '--config.file=/etc/alertmanager/alertmanager.yml'
      - '--storage.path=/alertmanager'
      - '--web.external-url=http://localhost:9093'
    restart: unless-stopped
    networks:
      - monitoring

  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    ports:
      - "3001:3000"
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/provisioning:/etc/grafana/provisioning
      - ./grafana/dashboards:/var/lib/grafana/dashboards
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD}
      - GF_USERS_ALLOW_SIGN_UP=false
      - GF_INSTALL_PLUGINS=grafana-clock-panel,grafana-simple-json-datasource
    restart: unless-stopped
    networks:
      - monitoring

  node-exporter:
    image: prom/node-exporter:latest
    container_name: node-exporter
    ports:
      - "9100:9100"
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    command:
      - '--path.procfs=/host/proc'
      - '--path.rootfs=/rootfs'
      - '--path.sysfs=/host/sys'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'
    restart: unless-stopped
    networks:
      - monitoring

  postgres-exporter:
    image: prometheuscommunity/postgres-exporter:latest
    container_name: postgres-exporter
    ports:
      - "9187:9187"
    environment:
      - DATA_SOURCE_NAME=postgresql://\${DB_USER}:\${DB_PASSWORD}@postgres:5432/\${DB_NAME}?sslmode=disable
    restart: unless-stopped
    networks:
      - monitoring
    depends_on:
      - postgres

  redis-exporter:
    image: oliver006/redis_exporter:latest
    container_name: redis-exporter
    ports:
      - "9121:9121"
    environment:
      - REDIS_ADDR=redis://redis:6379
    restart: unless-stopped
    networks:
      - monitoring
    depends_on:
      - redis

  nginx-exporter:
    image: nginx/nginx-prometheus-exporter:latest
    container_name: nginx-exporter
    ports:
      - "9113:9113"
    command:
      - '-nginx.scrape-uri=http://nginx:80/nginx_status'
    restart: unless-stopped
    networks:
      - monitoring
    depends_on:
      - nginx

volumes:
  prometheus_data:
  alertmanager_data:
  grafana_data:

networks:
  monitoring:
    external: true
EOF

log_info "✅ Monitoring Docker Compose created"

log_step "6. Setting up log aggregation"

# Create log aggregation configuration
mkdir -p infrastructure/logging
cat > infrastructure/logging/docker-compose.yml << EOF
version: '3.8'

services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:7.15.0
    container_name: elasticsearch
    environment:
      - discovery.type=single-node
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
    ports:
      - "9200:9200"
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data
    networks:
      - logging

  logstash:
    image: docker.elastic.co/logstash/logstash:7.15.0
    container_name: logstash
    volumes:
      - ./logstash/pipeline:/usr/share/logstash/pipeline
      - ./logstash/config:/usr/share/logstash/config
    ports:
      - "5044:5044"
    networks:
      - logging
    depends_on:
      - elasticsearch

  kibana:
    image: docker.elastic.co/kibana/kibana:7.15.0
    container_name: kibana
    ports:
      - "5601:5601"
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
    networks:
      - logging
    depends_on:
      - elasticsearch

volumes:
  elasticsearch_data:

networks:
  logging:
    external: true
EOF

# Create Logstash pipeline configuration
mkdir -p infrastructure/logging/logstash/{pipeline,config}
cat > infrastructure/logging/logstash/pipeline/logstash.conf << EOF
input {
  beats {
    port => 5044
  }
  
  tcp {
    port => 5000
    codec => json
  }
}

filter {
  if [fields][service] == "offline-wallet-backend" {
    grok {
      match => { "message" => "%{TIMESTAMP_ISO8601:timestamp} %{LOGLEVEL:level} %{GREEDYDATA:message}" }
    }
    
    if [level] == "ERROR" {
      mutate {
        add_tag => [ "error" ]
      }
    }
    
    if [message] =~ /security|fraud|suspicious/ {
      mutate {
        add_tag => [ "security" ]
      }
    }
  }
}

output {
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    index => "offline-wallet-%{+YYYY.MM.dd}"
  }
  
  if "error" in [tags] {
    email {
      to => "${ALERT_EMAIL}"
      subject => "Error in Offline Wallet Backend"
      body => "Error detected: %{message}"
    }
  }
  
  if "security" in [tags] {
    http {
      url => "http://alertmanager:9093/api/v1/alerts"
      http_method => "post"
      format => "json"
      mapping => {
        "alerts" => [
          {
            "labels" => {
              "alertname" => "SecurityLogAlert"
              "severity" => "warning"
              "service" => "offline-wallet-backend"
            }
            "annotations" => {
              "summary" => "Security event detected in logs"
              "description" => "%{message}"
            }
          }
        ]
      }
    }
  }
}
EOF

log_info "✅ Log aggregation configuration created"

log_step "7. Creating monitoring startup script"

cat > infrastructure/monitoring/start-monitoring.sh << EOF
#!/bin/bash

echo "🚀 Starting monitoring stack..."

# Create networks if they don't exist
docker network create monitoring 2>/dev/null || true
docker network create logging 2>/dev/null || true

# Start monitoring services
echo "Starting Prometheus, Grafana, and Alertmanager..."
docker-compose -f docker-compose.yml up -d

# Wait for services to be ready
echo "Waiting for services to start..."
sleep 30

# Check service health
echo "Checking service health..."
curl -f http://localhost:9090/-/healthy && echo "✅ Prometheus is healthy"
curl -f http://localhost:3001/api/health && echo "✅ Grafana is healthy"
curl -f http://localhost:9093/-/healthy && echo "✅ Alertmanager is healthy"

echo "✅ Monitoring stack started successfully!"
echo "📊 Access points:"
echo "  - Prometheus: http://localhost:9090"
echo "  - Grafana: http://localhost:3001 (admin/${GRAFANA_ADMIN_PASSWORD})"
echo "  - Alertmanager: http://localhost:9093"
EOF

chmod +x infrastructure/monitoring/start-monitoring.sh

log_info "✅ Monitoring startup script created"

log_step "8. Setting up health check endpoints"

# Create health check script
cat > scripts/health-check-comprehensive.sh << EOF
#!/bin/bash

# Comprehensive health check for API Integration Fixes

echo "🏥 Running comprehensive health checks..."

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

HEALTH_SCORE=0
TOTAL_CHECKS=0

check_endpoint() {
    local name=\$1
    local url=\$2
    local expected_status=\${3:-200}
    
    TOTAL_CHECKS=\$((TOTAL_CHECKS + 1))
    
    local status_code=\$(curl -s -o /dev/null -w "%{http_code}" "\$url" || echo "000")
    
    if [ "\$status_code" = "\$expected_status" ]; then
        echo -e "\${GREEN}✅ \$name: HEALTHY\${NC}"
        HEALTH_SCORE=\$((HEALTH_SCORE + 1))
    else
        echo -e "\${RED}❌ \$name: UNHEALTHY (HTTP \$status_code)\${NC}"
    fi
}

# Core API health checks
echo "🔍 Core API Health:"
check_endpoint "Basic Health" "http://localhost:3000/health"
check_endpoint "Detailed Health" "http://localhost:3000/health/detailed"
check_endpoint "Database Health" "http://localhost:3000/health/db"
check_endpoint "Redis Health" "http://localhost:3000/health/redis"
check_endpoint "Blockchain Health" "http://localhost:3000/health/blockchain"

# API Integration endpoints
echo
echo "🔍 API Integration Endpoints:"
check_endpoint "Auth Validation" "http://localhost:3000/api/v1/auth/validate-session" 401
check_endpoint "Transaction Sync" "http://localhost:3000/api/v1/transactions/sync" 401
check_endpoint "Token Validation" "http://localhost:3000/api/v1/tokens/validate" 401
check_endpoint "Security Status" "http://localhost:3000/api/v1/security/mobile/status" 401
check_endpoint "Wallet History" "http://localhost:3000/api/v1/wallet/history" 401
check_endpoint "Public Keys" "http://localhost:3000/api/v1/tokens/public-keys" 401

# Monitoring endpoints
echo
echo "🔍 Monitoring Services:"
check_endpoint "Prometheus" "http://localhost:9090/-/healthy"
check_endpoint "Grafana" "http://localhost:3001/api/health"
check_endpoint "Alertmanager" "http://localhost:9093/-/healthy"

# Calculate health percentage
HEALTH_PERCENTAGE=\$((HEALTH_SCORE * 100 / TOTAL_CHECKS))

echo
echo "📊 Health Summary:"
echo "  Healthy checks: \$HEALTH_SCORE/\$TOTAL_CHECKS"
echo "  Health percentage: \$HEALTH_PERCENTAGE%"

if [ \$HEALTH_PERCENTAGE -ge 90 ]; then
    echo -e "\${GREEN}🎉 System is HEALTHY\${NC}"
    exit 0
elif [ \$HEALTH_PERCENTAGE -ge 70 ]; then
    echo -e "\${YELLOW}⚠️  System has WARNINGS\${NC}"
    exit 1
else
    echo -e "\${RED}🚨 System is UNHEALTHY\${NC}"
    exit 2
fi
EOF

chmod +x scripts/health-check-comprehensive.sh

log_info "✅ Comprehensive health check script created"

log_step "9. Setting up automated monitoring tasks"

# Create monitoring cron jobs
cat > infrastructure/monitoring/monitoring-cron.txt << EOF
# Offline Wallet Monitoring Cron Jobs

# Health check every 5 minutes
*/5 * * * * /path/to/backend/scripts/health-check-comprehensive.sh >> /var/log/wallet-health.log 2>&1

# Database backup every 6 hours
0 */6 * * * /path/to/backend/scripts/backup-database.sh auto-\$(date +\%Y\%m\%d-\%H\%M) >> /var/log/wallet-backup.log 2>&1

# Log rotation daily at 2 AM
0 2 * * * /usr/sbin/logrotate /etc/logrotate.d/wallet >> /var/log/logrotate.log 2>&1

# Prometheus rule reload every hour
0 * * * * curl -X POST http://localhost:9090/-/reload >> /var/log/prometheus-reload.log 2>&1

# Cleanup old Docker images weekly
0 3 * * 0 docker system prune -f >> /var/log/docker-cleanup.log 2>&1

# Security scan daily at 3 AM
0 3 * * * /path/to/backend/scripts/comprehensive-security-audit.sh >> /var/log/security-scan.log 2>&1
EOF

log_info "✅ Monitoring cron jobs configuration created"

log_step "10. Final setup and validation"

# Copy alert rules to monitoring directory
cp infrastructure/monitoring/api-integration-alerts.yml \
   infrastructure/monitoring/

# Create monitoring network
docker network create monitoring 2>/dev/null || log_info "Monitoring network already exists"

# Start monitoring stack
log_info "Starting monitoring stack..."
cd infrastructure/monitoring
./start-monitoring.sh
cd ../..

# Wait for services to be ready
log_info "Waiting for monitoring services to be ready..."
sleep 60

# Run initial health check
log_info "Running initial health check..."
./scripts/health-check-comprehensive.sh || log_warn "Some health checks failed"

log_info "🎉 Production monitoring setup completed!"

echo
echo "📊 Monitoring Dashboard Access:"
echo "  Grafana: http://localhost:3001"
echo "    Username: admin"
echo "    Password: ${GRAFANA_ADMIN_PASSWORD}"
echo
echo "  Prometheus: http://localhost:9090"
echo "  Alertmanager: http://localhost:9093"
echo
echo "📧 Alert Configuration:"
echo "  Email alerts: ${ALERT_EMAIL}"
echo "  Slack webhook: $([ -n "$SLACK_WEBHOOK_URL" ] && echo "Configured" || echo "Not configured")"
echo
echo "📝 Next Steps:"
echo "  1. Configure SMTP settings in alertmanager.yml"
echo "  2. Set up Slack webhook URL if needed"
echo "  3. Install monitoring cron jobs: crontab infrastructure/monitoring/monitoring-cron.txt"
echo "  4. Configure log rotation: cp infrastructure/logging/logrotate.conf /etc/logrotate.d/wallet"
echo "  5. Test alert notifications"
echo
echo "🔍 Monitoring Commands:"
echo "  Health check: ./scripts/health-check-comprehensive.sh"
echo "  View logs: docker-compose -f infrastructure/monitoring/docker-compose.yml logs -f"
echo "  Restart monitoring: cd infrastructure/monitoring && docker-compose restart"

log_info "Production monitoring setup completed successfully! 📊"