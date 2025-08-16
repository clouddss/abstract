# Deploy Backend to Ubuntu Server

## 1. Prerequisites on Ubuntu Server
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Install Redis
sudo apt install redis-server -y

# Install PM2 for process management
sudo npm install -g pm2

# Install nginx (if needed for reverse proxy)
sudo apt install nginx -y
```

## 2. Setup Database
```bash
# Access PostgreSQL
sudo -u postgres psql

# Create database and user
CREATE DATABASE abstract_pump_prod;
CREATE USER abstract_user_prod WITH PASSWORD 'Blastabsprod1122';
GRANT ALL PRIVILEGES ON DATABASE abstract_pump_prod TO abstract_user_prod;
\q
```

## 3. Transfer Files to Server
From your local machine:
```bash
# Create archive (excluding node_modules)
cd /Users/meampersonal/Documents/Abstract/backend
tar -czf backend.tar.gz --exclude=node_modules --exclude=dist --exclude=.env .

# Transfer to server
scp backend.tar.gz user@your-server-ip:/home/user/

# On server, extract
ssh user@your-server-ip
mkdir -p /home/user/abstract-backend
cd /home/user/abstract-backend
tar -xzf ~/backend.tar.gz
```

## 4. Setup Backend on Server
```bash
cd /home/user/abstract-backend

# Install dependencies
npm install

# Copy and configure environment
cp .env.production.example .env
nano .env  # Edit with your production values

# Build the project
npm run build

# Run database migrations
npx prisma migrate deploy
npx prisma generate
```

## 5. Configure Environment Variables
Edit `.env` file with production values:
```env
NODE_ENV=production
PORT=3008
DATABASE_URL=postgresql://abstract_user_prod:Blastabsprod1122@localhost:5432/abstract_pump_prod?schema=public
REDIS_URL=redis://localhost:6379
ABSTRACT_RPC_URL=https://api.testnet.abs.xyz
# ... other variables from .env.production.example
```

## 6. Start with PM2
```bash
# Start the application
pm2 start dist/index.js --name abstract-backend

# Save PM2 configuration
pm2 save
pm2 startup  # Follow the instructions to enable auto-start

# Check status
pm2 status
pm2 logs abstract-backend
```

## 7. Configure Nginx (Optional - for reverse proxy)
```nginx
# /etc/nginx/sites-available/abstract-backend
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3008;
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

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/abstract-backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 8. Setup Firewall
```bash
# Allow SSH, HTTP, HTTPS, and your backend port
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow 3008  # If not using nginx proxy
sudo ufw enable
```

## 9. SSL Certificate (with Let's Encrypt)
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

## 10. Monitoring Commands
```bash
# View logs
pm2 logs abstract-backend

# Monitor performance
pm2 monit

# Restart application
pm2 restart abstract-backend

# Stop application
pm2 stop abstract-backend

# Check system resources
htop
```

## Quick Deploy Script
Save this as `deploy.sh`:
```bash
#!/bin/bash
cd /home/user/abstract-backend
git pull  # If using git
npm install
npm run build
npx prisma migrate deploy
pm2 restart abstract-backend
```

Make it executable: `chmod +x deploy.sh`