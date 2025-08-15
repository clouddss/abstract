#!/bin/bash

echo "🔧 Fixing PM2 environment variables..."

cd /var/www/abstract/blastabs/backend

# Option 1: Update ecosystem.config.js to load .env file
echo "📝 Updating PM2 ecosystem config..."
cat > ../ecosystem.config.js << 'EOF'
const dotenv = require('dotenv');
const path = require('path');

// Load backend .env file
const backendEnv = dotenv.config({ 
  path: path.join(__dirname, 'backend', '.env') 
}).parsed || {};

// Load frontend .env.local file
const frontendEnv = dotenv.config({ 
  path: path.join(__dirname, 'frontend', '.env.local') 
}).parsed || {};

module.exports = {
  apps: [
    {
      name: 'abs-back',
      script: './backend/dist/index.js',
      cwd: './',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        ...backendEnv,
        NODE_ENV: 'production',
        PORT: 3008
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_file: './logs/backend-combined.log',
      time: true
    },
    {
      name: 'abs-front',
      script: 'npm',
      args: 'start',
      cwd: './frontend',
      instances: 1,
      env: {
        ...frontendEnv,
        NODE_ENV: 'production',
        PORT: 3005
      },
      error_file: '../logs/frontend-error.log',
      out_file: '../logs/frontend-out.log',
      log_file: '../logs/frontend-combined.log',
      time: true
    }
  ]
};
EOF

# Option 2: Quick fix - source .env before starting
echo "📝 Creating start script with env..."
cat > start-backend.sh << 'EOF'
#!/bin/bash
cd /var/www/abstract/blastabs/backend
source .env
export DATABASE_URL
export JWT_SECRET
export ABSTRACT_RPC_URL
export CHAIN_ID
export PORT=3008
node dist/index.js
EOF

chmod +x start-backend.sh

# Install dotenv for ecosystem config
cd ..
npm install dotenv

# Method 1: Restart with updated ecosystem config
echo "🔄 Restarting with ecosystem config..."
pm2 delete all
pm2 start ecosystem.config.js

# Show status
pm2 status

echo "✅ Done!"
echo ""
echo "If still having issues, try:"
echo "1. Check .env exists: ls -la backend/.env"
echo "2. Check .env content: grep DATABASE_URL backend/.env"
echo "3. Use alternative start: pm2 start backend/start-backend.sh --name abs-back"
echo "4. Check logs: pm2 logs abs-back --lines 50"