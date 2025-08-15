#!/bin/bash

echo "🔧 Fixing Auth Validation..."

# SSH into server and fix
ssh blunr@92.205.165.167 << 'ENDSSH'
cd /var/www/abstract/blastabs/backend

# Update auth.ts validation schemas
echo "📝 Updating auth validation schemas..."
sed -i '/const loginSchema = z.object({/,/});/c\
const loginSchema = z.object({\
  body: z.object({\
    address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),\
    signature: z.string(),\
    message: z.string(),\
    timestamp: z.number()\
  })\
});' src/api/routes/auth.ts

sed -i '/const refreshSchema = z.object({/,/});/c\
const refreshSchema = z.object({\
  body: z.object({\
    refreshToken: z.string()\
  })\
});' src/api/routes/auth.ts

# Build
echo "🏗️  Building backend..."
npm run build

# Restart
echo "🔄 Restarting backend..."
pm2 restart abs-back

echo "✅ Done!"
echo ""
echo "📋 Testing login endpoint..."
sleep 2
curl -X POST https://api.blastabs.fun/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"address":"0x25519F356174b2f4Db629dc8DD916043b0f8447D","signature":"test","message":"test","timestamp":1755226488623}'
ENDSSH