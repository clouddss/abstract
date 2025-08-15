#!/bin/bash

echo "🔧 Fixing Gas Estimation..."

# Copy updated files
echo "📤 Copying updated files..."
scp /Users/meampersonal/Documents/Abstract/backend/dist/contracts/LaunchFactory.js blunr@92.205.165.167:/var/www/abstract/blastabs/backend/dist/contracts/
scp /Users/meampersonal/Documents/Abstract/backend/src/contracts/LaunchFactory.ts blunr@92.205.165.167:/var/www/abstract/blastabs/backend/src/contracts/
scp -r /Users/meampersonal/Documents/Abstract/frontend/.next blunr@92.205.165.167:/var/www/abstract/blastabs/frontend/
scp /Users/meampersonal/Documents/Abstract/frontend/app/launch/page.tsx blunr@92.205.165.167:/var/www/abstract/blastabs/frontend/app/launch/

# Restart services
ssh blunr@92.205.165.167 << 'ENDSSH'
cd /var/www/abstract/blastabs

# Restart backend
pm2 restart abs-back

# Restart frontend
pm2 restart abs-front

echo "✅ Gas estimation fix deployed!"
echo ""
echo "The launch process now:"
echo "1. Backend returns transaction data"
echo "2. Frontend estimates gas with user's wallet"
echo "3. User signs and sends transaction"
echo "4. Transaction is confirmed on-chain"
echo "5. Token is saved to database"
ENDSSH

echo "✅ Deployment complete!"