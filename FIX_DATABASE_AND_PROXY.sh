#!/bin/bash

echo "🔧 Fixing database and proxy issues..."

cd /home/blunr/side-projects/abstract/backend

# 1. Fix Express trust proxy issue
echo "📝 Fixing trust proxy setting..."
if [ -f src/api/index.ts ]; then
  # Add trust proxy setting after app creation
  sed -i "/const app = express();/a\\\n// Trust proxy for rate limiting behind NGINX\napp.set('trust proxy', true);" src/api/index.ts
else
  echo "⚠️  src/api/index.ts not found"
fi

# 2. Create and run database migration for User model
echo "🗄️  Creating database migration..."

# First, make sure the User model is in schema.prisma
if ! grep -q "model User" prisma/schema.prisma; then
  echo "📝 Adding User model to schema..."
  # Add User model after datasource
  sed -i '/datasource db {/,/}/a\
\
model User {\
  id            String    @id @default(cuid())\
  address       String    @unique\
  nonce         String?   // For additional security if needed\
  createdAt     DateTime  @default(now())\
  lastActiveAt  DateTime  @default(now())\
  \
  // Relations\
  createdTokens Token[]   @relation("TokenCreator")\
  trades        Trade[]   @relation("UserTrades")\
  rewards       RewardDistribution[] @relation("UserRewards")\
  \
  @@map("users")\
}' prisma/schema.prisma
fi

# 3. Update Token model to add creatorId
echo "📝 Updating Token model..."
if ! grep -q "creatorId" prisma/schema.prisma; then
  sed -i '/creator         String/a\  creatorId       String?' prisma/schema.prisma
  sed -i '/\/\/ Relations/,/trades/s/trades/creatorUser     User?    @relation("TokenCreator", fields: [creatorId], references: [id])\n  trades/' prisma/schema.prisma
fi

# 4. Update Trade model to add userId
echo "📝 Updating Trade model..."
if ! grep -q "userId" prisma/schema.prisma; then
  sed -i '/trader        String/a\  userId        String?' prisma/schema.prisma
  sed -i '/token         Token     @relation/a\  user          User?     @relation("UserTrades", fields: [userId], references: [id])' prisma/schema.prisma
fi

# 5. Update RewardDistribution model to add userId
echo "📝 Updating RewardDistribution model..."
if ! grep -q "userId.*String?" prisma/schema.prisma | grep -v "trades"; then
  sed -i '/wallet        String/a\  userId        String?' prisma/schema.prisma
  sed -i '/token         Token       @relation/a\  user          User?       @relation("UserRewards", fields: [userId], references: [id])' prisma/schema.prisma
fi

# 6. Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

# 7. Create migration
echo "🗄️  Creating migration..."
npx prisma migrate dev --name add-user-model --create-only

# 8. Apply migration
echo "🗄️  Applying migration..."
npx prisma migrate deploy

# 9. Rebuild backend
echo "🏗️  Building backend..."
npm run build

# 10. Restart PM2
echo "🔄 Restarting backend..."
pm2 restart abs-back

echo "✅ Done!"
echo ""
echo "📋 Check status:"
echo "1. pm2 logs abs-back --lines 30"
echo "2. Test auth: curl -X POST https://api.blastabs.fun/api/auth/login"
echo "3. Check health: curl https://api.blastabs.fun/health"