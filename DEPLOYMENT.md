# Abstract Pump Platform - Production Deployment Guide

This guide covers the complete deployment process for the Abstract Pump Platform, including smart contracts, backend API, and frontend application.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Configuration](#environment-configuration)
3. [Smart Contract Deployment](#smart-contract-deployment)
4. [Database Setup](#database-setup)
5. [Backend API Deployment](#backend-api-deployment)
6. [Frontend Deployment](#frontend-deployment)
7. [Post-Deployment Checklist](#post-deployment-checklist)
8. [Monitoring & Maintenance](#monitoring--maintenance)

## Prerequisites

### Required Services
- PostgreSQL 14+ database
- Redis 6+ for caching
- Node.js 18+ runtime
- PM2 or similar process manager
- Nginx or similar reverse proxy
- SSL certificates (Let's Encrypt recommended)

### Required Accounts
- Abstract testnet wallet with funds
- Pinata account for IPFS storage
- Domain name with DNS access
- Optional: Sentry, Google Analytics, monitoring services

## Environment Configuration

### Step 1: Backend Environment Setup

1. Copy the example environment file:
   ```bash
   cd backend
   cp .env.example .env
   ```

2. Fill in the required values:
   - **Database**: Set `DATABASE_URL` with your PostgreSQL connection string
   - **Redis**: Set `REDIS_URL` with your Redis connection string
   - **Blockchain**: Update RPC URL if using a different Abstract endpoint
   - **Security**: Generate strong secrets for `JWT_SECRET` and `ENCRYPTION_KEY`
   - **CORS**: Update `CORS_ORIGIN` with your frontend domain(s)

3. Generate secure secrets:
   ```bash
   # Generate JWT secret
   openssl rand -base64 32
   
   # Generate encryption key (32 characters)
   openssl rand -hex 16
   ```

### Step 2: Frontend Environment Setup

1. Copy the example environment file:
   ```bash
   cd frontend
   cp .env.example .env.local
   ```

2. Update with production values:
   - Set `NEXT_PUBLIC_API_URL` to your backend API URL
   - Keep Abstract testnet configuration as-is
   - Add contract addresses after deployment (see next section)

## Smart Contract Deployment

### Step 1: Deploy Core Contracts

1. Set up deployment environment:
   ```bash
   cd contracts
   npm install
   ```

2. Create deployment configuration:
   ```bash
   cp .env.example .env
   ```

3. Add your deployer private key and RPC URL to `.env`

4. Deploy contracts:
   ```bash
   # Deploy to Abstract testnet
   npm run deploy:abstract-testnet
   ```

5. Note the deployed addresses:
   - LaunchFactory: `0x...`
   - RewardsVault: `0x...`
   - PlatformRouter: `0x...`

### Step 2: Update Configuration Files

Update both frontend and backend `.env` files with the deployed contract addresses:

**Frontend (.env.local)**:
```env
NEXT_PUBLIC_LAUNCH_FACTORY_ADDRESS=<deployed_address>
NEXT_PUBLIC_REWARDS_VAULT_ADDRESS=<deployed_address>
NEXT_PUBLIC_PLATFORM_ROUTER_ADDRESS=<deployed_address>
```

**Backend (.env)**:
```env
LAUNCH_FACTORY_ADDRESS=<deployed_address>
REWARDS_VAULT_ADDRESS=<deployed_address>
PLATFORM_ROUTER_ADDRESS=<deployed_address>
```

### Step 3: Verify Contracts

Verify contracts on Abstract explorer for transparency:
```bash
npm run verify:abstract-testnet
```

## Database Setup

### Step 1: Create Database

```sql
-- Connect to PostgreSQL as superuser
CREATE DATABASE abstract_pump;
CREATE USER abstractuser WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE abstract_pump TO abstractuser;
```

### Step 2: Run Migrations

```bash
cd backend
npm run migrate
```

### Step 3: Verify Schema

```bash
npm run generate
```

## Backend API Deployment

### Step 1: Build Application

```bash
cd backend
npm install --production
npm run build
```

### Step 2: Set Up Process Manager

Create PM2 configuration (`ecosystem.config.js`):
```javascript
module.exports = {
  apps: [{
    name: 'abstract-pump-api',
    script: './dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
}
```

### Step 3: Configure Nginx

```nginx
server {
    listen 80;
    server_name api.your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.your-domain.com;

    ssl_certificate /etc/letsencrypt/live/api.your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.your-domain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /ws {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Step 4: Start Services

```bash
# Start the API
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save
pm2 startup
```

## Frontend Deployment

### Option 1: Vercel Deployment (Recommended)

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Deploy:
   ```bash
   cd frontend
   vercel --prod
   ```

3. Set environment variables in Vercel dashboard

### Option 2: Self-Hosted Deployment

1. Build the application:
   ```bash
   cd frontend
   npm run build
   ```

2. Start the production server:
   ```bash
   npm start
   ```

3. Configure Nginx:
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       return 301 https://$server_name$request_uri;
   }

   server {
       listen 443 ssl http2;
       server_name your-domain.com;

       ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

## Post-Deployment Checklist

### Security Verification
- [ ] All secrets are unique and strong
- [ ] CORS is configured for production domains only
- [ ] Rate limiting is enabled
- [ ] SSL certificates are installed and auto-renewing
- [ ] Database has proper user permissions
- [ ] API keys are rotated from development

### Functional Testing
- [ ] Wallet connection works
- [ ] Token creation flow completes
- [ ] Trading interface loads and updates
- [ ] WebSocket connections establish
- [ ] Rewards claiming works
- [ ] Leaderboard updates

### Performance Testing
- [ ] Page load times < 3 seconds
- [ ] API response times < 200ms
- [ ] WebSocket latency < 100ms
- [ ] Database queries optimized

### Monitoring Setup
- [ ] Error tracking (Sentry) configured
- [ ] Uptime monitoring active
- [ ] Log aggregation configured
- [ ] Database backups scheduled
- [ ] SSL certificate monitoring

## Monitoring & Maintenance

### Health Checks

The API provides health check endpoints:
- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed system status

### Log Management

Backend logs location:
- Application logs: `./logs/`
- PM2 logs: `~/.pm2/logs/`
- Nginx logs: `/var/log/nginx/`

### Database Maintenance

Regular maintenance tasks:
```bash
# Backup database
pg_dump abstract_pump > backup_$(date +%Y%m%d).sql

# Vacuum and analyze
psql -d abstract_pump -c "VACUUM ANALYZE;"
```

### Updates and Patches

1. Test updates in staging environment
2. Backup database before updates
3. Use blue-green deployment for zero downtime
4. Monitor error rates after deployment

## Troubleshooting

### Common Issues

1. **CORS Errors**
   - Verify `CORS_ORIGIN` includes your frontend domain
   - Check for trailing slashes in URLs

2. **WebSocket Connection Failed**
   - Ensure WebSocket port is open
   - Check Nginx WebSocket proxy configuration

3. **Contract Interaction Failures**
   - Verify contract addresses are correct
   - Check chain ID matches
   - Ensure RPC URL is accessible

4. **Database Connection Issues**
   - Verify PostgreSQL is running
   - Check connection string format
   - Ensure firewall allows connections

### Support

For deployment support:
1. Check application logs first
2. Review this documentation
3. Contact the development team

---

Remember to keep this documentation updated as the deployment process evolves!