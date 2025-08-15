#!/bin/bash

# Quick fix for auth deployment on blastabs.fun
echo "🚀 Fixing Auth Routes Deployment..."

cd /var/www/abstract/blastabs/backend

# Create error middleware
echo "📝 Creating error middleware..."
mkdir -p src/api/middleware
cat > src/api/middleware/error.ts << 'EOF'
import { Request, Response, NextFunction } from 'express';

export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
EOF

# Create validation middleware
echo "📝 Creating validation middleware..."
cat > src/api/middleware/validation.ts << 'EOF'
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

export const validateRequest = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors
        });
      }
      next(error);
    }
  };
};
EOF

# Update auth.ts to remove missing imports and use inline async handler
echo "📝 Updating auth routes..."
cat > src/api/routes/auth.ts << 'EOF'
import { Router, Request, Response, NextFunction } from 'express';
import { ethers } from 'ethers';
import jwt from 'jsonwebtoken';
import { prisma } from '../../database/client';
import { appConfig } from '../../config';
import { authMiddleware } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

// Inline async handler
const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Inline validation middleware
const validateRequest = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors
        });
      }
      next(error);
    }
  };
};

// Validation schemas
const loginSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  signature: z.string(),
  message: z.string(),
  timestamp: z.number()
});

const refreshSchema = z.object({
  refreshToken: z.string()
});

// Helper to verify signature
function verifySignature(address: string, signature: string, message: string): boolean {
  try {
    const recoveredAddress = ethers.verifyMessage(message, signature);
    return recoveredAddress.toLowerCase() === address.toLowerCase();
  } catch (error) {
    return false;
  }
}

// Generate tokens
function generateTokens(userId: string, address: string) {
  const accessToken = jwt.sign(
    { userId, address },
    appConfig.JWT_SECRET,
    { expiresIn: '24h' }
  );
  
  const refreshToken = jwt.sign(
    { userId, address, type: 'refresh' },
    appConfig.JWT_SECRET,
    { expiresIn: '7d' }
  );
  
  return { accessToken, refreshToken, expiresIn: 86400 }; // 24 hours in seconds
}

// POST /api/auth/login
router.post('/login', validateRequest(loginSchema), asyncHandler(async (req: Request, res: Response) => {
  const { address, signature, message, timestamp } = req.body;
  
  // Verify timestamp is recent (within 5 minutes)
  const now = Date.now();
  if (Math.abs(now - timestamp) > 5 * 60 * 1000) {
    return res.status(400).json({
      success: false,
      error: 'Authentication request expired'
    });
  }
  
  // Verify signature
  if (!verifySignature(address, signature, message)) {
    return res.status(401).json({
      success: false,
      error: 'Invalid signature'
    });
  }
  
  // Find or create user
  let user = await prisma.user.findUnique({
    where: { address: address.toLowerCase() }
  });
  
  if (!user) {
    user = await prisma.user.create({
      data: {
        address: address.toLowerCase(),
        lastActiveAt: new Date()
      }
    });
  } else {
    // Update last active
    await prisma.user.update({
      where: { id: user.id },
      data: { lastActiveAt: new Date() }
    });
  }
  
  // Generate tokens
  const tokens = generateTokens(user.id, user.address);
  
  res.json({
    success: true,
    data: {
      ...tokens,
      user: {
        id: user.id,
        address: user.address,
        createdAt: user.createdAt,
        lastActiveAt: user.lastActiveAt
      }
    }
  });
}));

// POST /api/auth/refresh
router.post('/refresh', validateRequest(refreshSchema), asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  
  try {
    const decoded = jwt.verify(refreshToken, appConfig.JWT_SECRET) as any;
    
    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }
    
    // Get user
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });
    
    if (!user) {
      throw new Error('User not found');
    }
    
    // Generate new tokens
    const tokens = generateTokens(user.id, user.address);
    
    res.json({
      success: true,
      data: tokens
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Invalid refresh token'
    });
  }
}));

// GET /api/auth/profile
router.get('/profile', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    include: {
      _count: {
        select: {
          createdTokens: true,
          trades: true,
          rewards: true
        }
      }
    }
  });
  
  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found'
    });
  }
  
  res.json({
    success: true,
    data: {
      id: user.id,
      address: user.address,
      createdAt: user.createdAt,
      lastActiveAt: user.lastActiveAt,
      stats: {
        tokensCreated: user._count.createdTokens,
        totalTrades: user._count.trades,
        totalRewards: user._count.rewards
      }
    }
  });
}));

// PATCH /api/auth/profile
router.patch('/profile', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  res.json({
    success: true,
    data: { message: 'Profile update not implemented' }
  });
}));

// POST /api/auth/logout
router.post('/logout', asyncHandler(async (req: Request, res: Response) => {
  res.json({
    success: true,
    data: { message: 'Logged out successfully' }
  });
}));

export default router;
EOF

# Check if JWT_SECRET is set
echo "📝 Checking environment variables..."
if ! grep -q "JWT_SECRET=" .env; then
  echo "⚠️  JWT_SECRET not found in .env, adding..."
  echo "JWT_SECRET=$(openssl rand -base64 32)" >> .env
fi

# Update imports in api/index.ts
echo "📝 Updating API index..."
if ! grep -q "import authRouter" src/api/index.ts; then
  sed -i "/import statsRouter/a import authRouter from './routes/auth';" src/api/index.ts
fi

if ! grep -q "app.use('/api/auth'" src/api/index.ts; then
  sed -i "/app.use('\/api\/tokens'/i app.use('/api/auth', authRouter);" src/api/index.ts
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install jsonwebtoken ethers zod
npm install --save-dev @types/jsonwebtoken

# Build
echo "🏗️  Building backend..."
npm run build

# Restart
echo "🔄 Restarting backend..."
pm2 restart abs-back

echo "✅ Done! Testing..."
sleep 3
curl http://localhost:3008/api | jq .
echo ""
echo "📋 Check logs: pm2 logs abs-back --lines 50"