#!/bin/bash

echo "🔧 Quick Frontend Fix..."

# Copy just the updated files
scp -r /Users/meampersonal/Documents/Abstract/frontend/.next blunr@92.205.165.167:/var/www/abstract/blastabs/frontend/
scp /Users/meampersonal/Documents/Abstract/frontend/app/launch/page.tsx blunr@92.205.165.167:/var/www/abstract/blastabs/frontend/app/launch/

# Restart frontend
ssh blunr@92.205.165.167 << 'ENDSSH'
cd /var/www/abstract/blastabs/frontend
pm2 restart abs-front

echo "✅ Frontend updated!"
echo ""
echo "The transaction should now appear in your wallet."
echo "The wallet will handle gas estimation automatically."
ENDSSH