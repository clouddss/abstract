#!/bin/bash

echo "🚀 Quick Token Launch Deployment..."

# Copy files to server
echo "📤 Copying files to server..."
scp /Users/meampersonal/Documents/Abstract/backend/src/contracts/LaunchFactory.ts blunr@92.205.165.167:/var/www/abstract/blastabs/backend/src/contracts/
scp /Users/meampersonal/Documents/Abstract/backend/src/api/routes/tokens-launch.ts blunr@92.205.165.167:/var/www/abstract/blastabs/backend/src/api/routes/
scp /Users/meampersonal/Documents/Abstract/backend/src/api/middleware/error.ts blunr@92.205.165.167:/var/www/abstract/blastabs/backend/src/api/middleware/
scp /Users/meampersonal/Documents/Abstract/backend/src/api/index.ts blunr@92.205.165.167:/var/www/abstract/blastabs/backend/src/api/
scp /Users/meampersonal/Documents/Abstract/backend/src/api/routes/tokens.ts blunr@92.205.165.167:/var/www/abstract/blastabs/backend/src/api/routes/
scp /Users/meampersonal/Documents/Abstract/backend/prisma/schema.prisma blunr@92.205.165.167:/var/www/abstract/blastabs/backend/prisma/

# SSH and build
echo "🔧 Building on server..."
ssh blunr@92.205.165.167 << 'ENDSSH'
cd /var/www/abstract/blastabs/backend

# Create contracts directory
mkdir -p src/contracts

# Install ethers if needed
npm install ethers

# Generate Prisma client
npx prisma generate

# Create and apply migration
npx prisma migrate dev --name add-deploy-fields --create-only
npx prisma migrate deploy

# Build
npm run build

# Restart
pm2 restart abs-back

echo "✅ Done!"
echo ""
echo "📋 Testing:"
curl -s https://api.blastabs.fun/api/tokens/launch/fee | jq .
ENDSSH