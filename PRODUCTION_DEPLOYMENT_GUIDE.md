# Production Deployment Guide - Abstract Pump Platform

This guide provides comprehensive instructions for deploying the Abstract Pump Platform to production with all security, performance, and monitoring features enabled.

## Prerequisites

### Infrastructure Requirements

- **Server**: Linux-based server (Ubuntu 20.04+ recommended)
- **Memory**: Minimum 8GB RAM (16GB recommended)
- **Storage**: Minimum 100GB SSD
- **Network**: Static IP address with firewall configured
- **SSL Certificate**: Valid SSL certificate for HTTPS

### Software Dependencies

- Docker Engine 20.10+
- Docker Compose 2.0+
- PostgreSQL 14+ (managed service recommended)
- Redis 6+ (managed service recommended)
- NGINX (for reverse proxy)
- Certbot (for SSL certificates)

## Security Checklist

### 1. Environment Configuration

```bash
# Copy production environment templates
cp backend/.env.production.example backend/.env.production
cp frontend/.env.production.example frontend/.env.production

# Generate secure secrets
openssl rand -hex 32  # For JWT_SECRET
openssl rand -hex 32  # For ENCRYPTION_KEY
```

### 2. Database Security

```sql
-- Create dedicated database user
CREATE USER abstract_pump_prod WITH PASSWORD 'strong_random_password';
CREATE DATABASE abstract_pump_prod OWNER abstract_pump_prod;

-- Grant minimal required permissions
GRANT CONNECT ON DATABASE abstract_pump_prod TO abstract_pump_prod;
GRANT USAGE ON SCHEMA public TO abstract_pump_prod;
GRANT CREATE ON SCHEMA public TO abstract_pump_prod;

-- Enable row-level security for sensitive tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
```

### 3. Network Security

```bash
# Configure UFW firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Fail2ban for SSH protection
sudo apt install fail2ban
sudo systemctl enable fail2ban
```

## Production Environment Setup

### 1. Backend Configuration

Create `/backend/.env.production`:

```env
# Critical Production Settings
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@prod-db:5432/abstract_pump_prod?sslmode=require
REDIS_URL=redis://prod-redis:6379/0
JWT_SECRET=your-super-secure-jwt-secret-minimum-32-characters-long
ENCRYPTION_KEY=your-32-character-encryption-key-here
CORS_ORIGIN=https://yourdomain.com

# Security
ADMIN_API_KEYS=secure-admin-key-1,secure-admin-key-2
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100

# Monitoring
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
LOG_LEVEL=info
ENABLE_REQUEST_LOGGING=true

# Performance
INDEXER_INTERVAL_MS=5000
INDEXER_BATCH_SIZE=1000
WS_MAX_CONNECTIONS=1000
```

### 2. Frontend Configuration

Create `/frontend/.env.production`:

```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_WS_URL=wss://api.yourdomain.com
NEXT_PUBLIC_CHAIN_ID=11124
NEXT_PUBLIC_ENABLE_METRICS=true
NEXT_PUBLIC_SENTRY_DSN=your-frontend-sentry-dsn
```

### 3. NGINX Configuration

Create `/etc/nginx/sites-available/abstract-pump`:

```nginx
# Rate limiting
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/m;

# Upstream backends
upstream backend {
    least_conn;
    server localhost:3001 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

# Frontend server
server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;
    
    # SSL configuration
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header Referrer-Policy "strict-origin-when-cross-origin";
    
    # Frontend static files
    location / {
        proxy_pass http://localhost:3500;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# API server
server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;
    
    # SSL configuration (same as above)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    
    # API routes with rate limiting
    location /api/auth {
        limit_req zone=auth burst=5 nodelay;
        proxy_pass http://backend;
        include proxy_params;
    }
    
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://backend;
        include proxy_params;
    }
    
    location /health {
        proxy_pass http://backend;
        include proxy_params;
        access_log off;
    }
    
    # WebSocket support
    location /ws {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com api.yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

## Docker Deployment

### 1. Production Docker Compose

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.production
    ports:
      - "3001:3001"
      - "3002:3002"
    environment:
      - NODE_ENV=production
    env_file:
      - ./backend/.env.production
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '1.0'
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
    logging:
      driver: "json-file"
      options:
        max-size: "100m"
        max-file: "3"

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        - NODE_ENV=production
    ports:
      - "3500:3000"
    environment:
      - NODE_ENV=production
    env_file:
      - ./frontend/.env.production
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '0.5'
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000"]
      interval: 30s
      timeout: 10s
      retries: 3
    logging:
      driver: "json-file"
      options:
        max-size: "100m"
        max-file: "3"

  postgres:
    image: postgres:14-alpine
    environment:
      POSTGRES_DB: abstract_pump_prod
      POSTGRES_USER: abstract_pump_prod
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backend/database/init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 4G
          cpus: '2.0'
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U abstract_pump_prod"]
      interval: 30s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD} --maxmemory 1gb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '0.5'
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 5s
      retries: 3

volumes:
  postgres_data:
  redis_data:

networks:
  default:
    driver: bridge
```

### 2. Deployment Scripts

Create `scripts/deploy.sh`:

```bash
#!/bin/bash
set -e

echo "🚀 Starting production deployment..."

# Pull latest code
git pull origin main

# Build and deploy
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d

# Run database migrations
echo "📊 Running database migrations..."
docker-compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy

# Health check
echo "🏥 Performing health checks..."
sleep 30

backend_health=$(curl -f http://localhost:3001/health || echo "FAILED")
frontend_health=$(curl -f http://localhost:3500 || echo "FAILED")

if [[ $backend_health == *"success"* && $frontend_health != "FAILED" ]]; then
    echo "✅ Deployment successful!"
else
    echo "❌ Deployment failed - rolling back..."
    docker-compose -f docker-compose.prod.yml down
    exit 1
fi

echo "🎉 Production deployment complete!"
```

## Monitoring and Alerting

### 1. Prometheus Configuration

Create `monitoring/prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "alert_rules.yml"

scrape_configs:
  - job_name: 'abstract-pump-backend'
    static_configs:
      - targets: ['localhost:3001']
    metrics_path: /health/metrics
    scrape_interval: 30s

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['localhost:9100']

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093
```

### 2. Alert Rules

Create `monitoring/alert_rules.yml`:

```yaml
groups:
  - name: abstract_pump_alerts
    rules:
      - alert: ServiceDown
        expr: up == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Service {{ $labels.instance }} is down"
          
      - alert: HighErrorRate
        expr: rate(api_errors_total[5m]) > 0.1
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High error rate detected"
          
      - alert: DatabaseConnectionFailed
        expr: database_connections_failed_total > 5
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Database connection failures detected"
```

## Security Hardening

### 1. Server Hardening

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install security tools
sudo apt install -y ufw fail2ban unattended-upgrades

# Configure automatic security updates
sudo dpkg-reconfigure -plow unattended-upgrades

# Disable root SSH login
sudo sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sudo systemctl restart ssh

# Configure fail2ban
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 2. Application Security

```bash
# Set up log rotation
sudo tee /etc/logrotate.d/abstract-pump > /dev/null <<EOF
/var/log/abstract-pump/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 644 nodejs nodejs
    postrotate
        docker-compose -f docker-compose.prod.yml restart backend
    endscript
}
EOF

# Set up backup script
cat > /opt/backup-abstract-pump.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/backups/abstract-pump"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Database backup
docker-compose -f docker-compose.prod.yml exec -T postgres pg_dump -U abstract_pump_prod abstract_pump_prod > $BACKUP_DIR/db_$DATE.sql

# Cleanup old backups (keep 7 days)
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
EOF

chmod +x /opt/backup-abstract-pump.sh

# Add to crontab
echo "0 2 * * * /opt/backup-abstract-pump.sh" | sudo crontab -
```

## Performance Optimization

### 1. Database Optimization

```sql
-- Create indexes for performance
CREATE INDEX CONCURRENTLY idx_tokens_created_at ON tokens(created_at);
CREATE INDEX CONCURRENTLY idx_trades_timestamp ON trades(timestamp);
CREATE INDEX CONCURRENTLY idx_trades_token_address ON trades(token_address);
CREATE INDEX CONCURRENTLY idx_holders_balance ON holders(balance);

-- Configure PostgreSQL for production
ALTER SYSTEM SET shared_buffers = '2GB';
ALTER SYSTEM SET effective_cache_size = '6GB';
ALTER SYSTEM SET work_mem = '256MB';
ALTER SYSTEM SET maintenance_work_mem = '512MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;

SELECT pg_reload_conf();
```

### 2. Redis Configuration

```bash
# Optimize Redis configuration
echo 'vm.overcommit_memory = 1' >> /etc/sysctl.conf
echo 'net.core.somaxconn = 1024' >> /etc/sysctl.conf
sysctl -p
```

## Maintenance Procedures

### 1. Health Checks

```bash
# Daily health check script
cat > /opt/daily-health-check.sh << 'EOF'
#!/bin/bash
echo "=== Daily Health Check $(date) ==="

# Check service status
docker-compose -f docker-compose.prod.yml ps

# Check disk space
df -h

# Check memory usage
free -h

# Check logs for errors
docker-compose -f docker-compose.prod.yml logs --tail=100 backend | grep -i error

# Check database connections
docker-compose -f docker-compose.prod.yml exec postgres psql -U abstract_pump_prod -c "SELECT count(*) FROM pg_stat_activity;"

echo "=== Health Check Complete ==="
EOF

chmod +x /opt/daily-health-check.sh
```

### 2. Update Procedures

```bash
# Safe update script
cat > /opt/update-abstract-pump.sh << 'EOF'
#!/bin/bash
set -e

echo "🔄 Starting safe update procedure..."

# Create backup
/opt/backup-abstract-pump.sh

# Pull latest code
cd /opt/abstract-pump
git fetch origin
git checkout main
git pull origin main

# Build new images
docker-compose -f docker-compose.prod.yml build

# Rolling update
docker-compose -f docker-compose.prod.yml up -d --no-deps backend
sleep 30

# Health check
if curl -f http://localhost:3001/health; then
    echo "✅ Backend update successful"
    docker-compose -f docker-compose.prod.yml up -d --no-deps frontend
    sleep 30
    
    if curl -f http://localhost:3500; then
        echo "✅ Update completed successfully"
    else
        echo "❌ Frontend update failed - rolling back"
        docker-compose -f docker-compose.prod.yml down
        exit 1
    fi
else
    echo "❌ Backend update failed - rolling back"
    docker-compose -f docker-compose.prod.yml down
    exit 1
fi
EOF

chmod +x /opt/update-abstract-pump.sh
```

## Troubleshooting

### Common Issues

1. **Database Connection Issues**
   ```bash
   # Check database logs
   docker-compose -f docker-compose.prod.yml logs postgres
   
   # Test connection
   docker-compose -f docker-compose.prod.yml exec backend npx prisma db push
   ```

2. **High Memory Usage**
   ```bash
   # Check container resource usage
   docker stats
   
   # Restart services if needed
   docker-compose -f docker-compose.prod.yml restart
   ```

3. **SSL Certificate Issues**
   ```bash
   # Renew certificates
   sudo certbot renew
   sudo systemctl reload nginx
   ```

## Final Checklist

- [ ] All environment variables configured
- [ ] SSL certificates installed and verified
- [ ] Firewall rules configured
- [ ] Database optimized and backed up
- [ ] Monitoring systems active
- [ ] Alert rules configured
- [ ] Health checks passing
- [ ] Performance metrics within acceptable ranges
- [ ] Security hardening complete
- [ ] Documentation updated

## Support

For production support:
- Monitor logs: `docker-compose -f docker-compose.prod.yml logs -f`
- Check metrics: `curl https://api.yourdomain.com/health/detailed`
- Review alerts: Check your monitoring dashboard

Remember to regularly update dependencies, review security logs, and perform security audits.