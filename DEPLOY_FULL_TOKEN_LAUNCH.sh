#!/bin/bash

echo "🚀 Deploying Full Token Launch Feature..."

# Deploy frontend changes
echo "📤 Deploying frontend..."
scp -r /Users/meampersonal/Documents/Abstract/frontend/.next blunr@92.205.165.167:/var/www/abstract/blastabs/frontend/
scp /Users/meampersonal/Documents/Abstract/frontend/lib/api/services/tokens.service.ts blunr@92.205.165.167:/var/www/abstract/blastabs/frontend/lib/api/services/
scp /Users/meampersonal/Documents/Abstract/frontend/app/launch/page.tsx blunr@92.205.165.167:/var/www/abstract/blastabs/frontend/app/launch/

# Deploy backend changes
echo "📤 Deploying backend..."
scp -r /Users/meampersonal/Documents/Abstract/backend/dist blunr@92.205.165.167:/var/www/abstract/blastabs/backend/
scp /Users/meampersonal/Documents/Abstract/backend/src/contracts/LaunchFactory.ts blunr@92.205.165.167:/var/www/abstract/blastabs/backend/src/contracts/
scp /Users/meampersonal/Documents/Abstract/backend/src/api/routes/tokens-launch.ts blunr@92.205.165.167:/var/www/abstract/blastabs/backend/src/api/routes/
scp /Users/meampersonal/Documents/Abstract/backend/src/api/routes/tokens.ts blunr@92.205.165.167:/var/www/abstract/blastabs/backend/src/api/routes/
scp /Users/meampersonal/Documents/Abstract/backend/src/api/routes/auth.ts blunr@92.205.165.167:/var/www/abstract/blastabs/backend/src/api/routes/
scp /Users/meampersonal/Documents/Abstract/backend/src/api/middleware/error.ts blunr@92.205.165.167:/var/www/abstract/blastabs/backend/src/api/middleware/
scp /Users/meampersonal/Documents/Abstract/backend/src/api/index.ts blunr@92.205.165.167:/var/www/abstract/blastabs/backend/src/api/
scp /Users/meampersonal/Documents/Abstract/backend/prisma/schema.prisma blunr@92.205.165.167:/var/www/abstract/blastabs/backend/prisma/

# SSH and complete deployment
ssh blunr@92.205.165.167 << 'ENDSSH'
cd /var/www/abstract/blastabs

# Backend setup
echo "🔧 Setting up backend..."
cd backend
mkdir -p src/contracts

# Install ethers if needed
npm install ethers

# Generate Prisma client
npx prisma generate

# Apply migrations
npx prisma migrate deploy

# Restart backend
pm2 restart abs-back

# Frontend setup
echo "🔧 Setting up frontend..."
cd ../frontend

# Build if needed (or use the uploaded .next folder)
# npm run build

# Restart frontend
pm2 restart abs-front

echo "✅ Deployment complete!"
echo ""
echo "📋 Testing endpoints:"
echo "1. Launch fee: curl -s https://api.blastabs.fun/api/tokens/launch/fee | jq ."
echo "2. Frontend: https://blastabs.fun/launch"
echo ""
echo "📊 Check logs:"
echo "Backend: pm2 logs abs-back --lines 50"
echo "Frontend: pm2 logs abs-front --lines 50"
ENDSSH

echo "✅ Full deployment complete!"