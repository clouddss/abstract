# Ubuntu Server Deployment Guide for Abstract Platform

## Prerequisites

- Ubuntu 20.04 or 22.04 LTS
- Minimum 2GB RAM, 20GB storage
- Domain name pointed to your server (optional but recommended)
- Root or sudo access

## Step 1: Update System and Install Dependencies

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install essential tools
sudo apt install -y curl git wget build-essential

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installations
node --version  # Should show v20.x.x
npm --version   # Should show 10.x.x

# Install PM2 for process management
sudo npm install -g pm2

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install Redis
sudo apt install -y redis-server

# Install Nginx
sudo apt install -y nginx

# Install Docker (optional, for containerized deployment)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

## Step 2: Setup PostgreSQL Database

```bash
# Switch to postgres user
sudo -u postgres psql

# In PostgreSQL prompt, run:
CREATE DATABASE abstract_pump;
CREATE USER abstract_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE abstract_pump TO abstract_user;
\q

# Enable PostgreSQL to start on boot
sudo systemctl enable postgresql
```

## Step 3: Configure Redis

```bash
# Edit Redis configuration
sudo nano /etc/redis/redis.conf

# Set these values:
# supervised systemd
# maxmemory 256mb
# maxmemory-policy allkeys-lru

# Enable Redis to start on boot
sudo systemctl enable redis-server
sudo systemctl restart redis-server
```

## Step 4: Clone and Setup the Project

```bash
# Create app directory
sudo mkdir -p /var/www/abstract
sudo chown $USER:$USER /var/www/abstract
cd /var/www/abstract

# Clone your repository
git clone https://github.com/YOUR_USERNAME/abstract-platform.git .
# OR upload your files via SCP/SFTP

# Setup backend
cd backend
npm install

# Copy and configure environment variables
cp .env.example .env
nano .env

# Update these values in .env:
# DATABASE_URL="postgresql://abstract_user:your_secure_password@localhost:5432/abstract_pump"
# REDIS_URL="redis://localhost:6379"
# NODE_ENV="production"
# PORT=3001
# Add your other production values (RPC URLs, contract addresses, etc.)

# Run database migrations
npm run generate    # Generate Prisma client
npm run migrate     # Apply database migrations

# Build backend
npm run build

# Setup frontend
cd ../frontend
npm install

# Copy and configure environment variables
cp .env.example .env.local
nano .env.local

# Update these values in .env.local:
# NEXT_PUBLIC_API_URL="https://api.yourdomain.com/api"
# Or for IP-based setup: NEXT_PUBLIC_API_URL="http://YOUR_SERVER_IP:3001/api"
# Add your contract addresses and other values

# Build frontend
npm run build
```

## Step 5: Setup PM2 Process Manager

```bash
# Create PM2 ecosystem file
cd /var/www/abstract
nano ecosystem.config.js
```

Add this content:
```javascript
module.exports = {
  apps: [
    {
      name: 'abstract-backend',
      script: './backend/dist/index.js',
      cwd: './backend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      }
    },
    {
      name: 'abstract-frontend',
      script: 'npm',
      args: 'start',
      cwd: './frontend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    }
  ]
};
```

```bash
# Start services with PM2
pm2 start ecosystem.config.js

# Save PM2 process list
pm2 save

# Setup PM2 to start on boot
pm2 startup systemd -u $USER --hp /home/$USER
```

## Step 6: Configure Nginx

```bash
# Create Nginx configuration
sudo nano /etc/nginx/sites-available/abstract
```

Add this configuration:
```nginx
# API Backend
server {
    listen 80;
    server_name api.yourdomain.com;  # Or use your server IP

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Frontend
server {
    listen 80;
    server_name yourdomain.com;  # Or use your server IP

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/abstract /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

## Step 7: Setup Firewall

```bash
# Allow SSH (if using)
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow custom ports if needed
sudo ufw allow 3000/tcp  # Frontend (if accessing directly)
sudo ufw allow 3001/tcp  # Backend API (if accessing directly)

# Enable firewall
sudo ufw enable
```

## Step 8: SSL Certificate (Optional but Recommended)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com -d api.yourdomain.com

# Auto-renewal is set up automatically
```

## Step 9: Deploy Smart Contracts

```bash
# From your local machine or server
cd /var/www/abstract/contracts

# Install dependencies
npm install

# Deploy contracts (make sure you have the private key)
npm run deploy:abstract-testnet

# Update contract addresses in:
# - /var/www/abstract/backend/.env
# - /var/www/abstract/frontend/.env.local

# Restart services
pm2 restart all
```

## Step 10: Seed Test Data (Optional)

```bash
cd /var/www/abstract/backend
npm run test:seed
```

## Step 11: Monitoring and Maintenance

```bash
# View PM2 logs
pm2 logs

# Monitor processes
pm2 monit

# Check service status
pm2 status

# View Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Database backup (set up cron job)
pg_dump -U abstract_user abstract_pump > backup_$(date +%Y%m%d).sql
```

## Quick Commands Reference

```bash
# Start all services
pm2 start ecosystem.config.js

# Stop all services
pm2 stop all

# Restart all services
pm2 restart all

# Update code and redeploy
cd /var/www/abstract
git pull
cd backend && npm install && npm run build
cd ../frontend && npm install && npm run build
pm2 restart all

# View real-time logs
pm2 logs --lines 100

# Check disk space
df -h

# Check memory usage
free -m
```

## Troubleshooting

### Backend not starting
- Check logs: `pm2 logs abstract-backend`
- Verify database connection: `psql -U abstract_user -d abstract_pump -h localhost`
- Check .env file permissions: `ls -la backend/.env`

### Frontend not accessible
- Check if running: `pm2 status`
- Test locally: `curl http://localhost:3000`
- Check Nginx: `sudo nginx -t && sudo systemctl status nginx`

### Database connection issues
- Check PostgreSQL status: `sudo systemctl status postgresql`
- Verify credentials in backend/.env
- Check PostgreSQL logs: `sudo tail -f /var/log/postgresql/*.log`

### High memory usage
- Restart services: `pm2 restart all`
- Check for memory leaks: `pm2 monit`
- Increase swap if needed

## Security Checklist

- [ ] Change default PostgreSQL password
- [ ] Configure firewall rules
- [ ] Set up SSL certificates
- [ ] Disable root SSH access
- [ ] Keep system updated
- [ ] Set up regular backups
- [ ] Monitor logs for suspicious activity
- [ ] Use environment variables for secrets
- [ ] Set up fail2ban for brute force protection

## Next Steps

1. Access your frontend at `http://YOUR_SERVER_IP` or `https://yourdomain.com`
2. Access your API at `http://YOUR_SERVER_IP:3001/api` or `https://api.yourdomain.com`
3. Monitor the services using PM2
4. Set up regular backups for the database
5. Configure monitoring alerts

For production, always use HTTPS and proper domain names instead of IP addresses.