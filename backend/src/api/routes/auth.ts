import { Router } from 'express';
import { ethers } from 'ethers';
import jwt from 'jsonwebtoken';
import { prisma } from '../../database/client';
import { appConfig } from '../../config';
import { asyncHandler } from '../middleware/error';
import { authMiddleware } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { z } from 'zod';

const router = Router();

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
router.post('/login', validateRequest(loginSchema), asyncHandler(async (req, res) => {
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
router.post('/refresh', validateRequest(refreshSchema), asyncHandler(async (req, res) => {
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
router.get('/profile', authMiddleware, asyncHandler(async (req, res) => {
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
router.patch('/profile', authMiddleware, asyncHandler(async (req, res) => {
  // For now, we don't have additional profile fields to update
  // This endpoint is here for future expansion
  res.json({
    success: true,
    data: { message: 'Profile update not implemented' }
  });
}));

// POST /api/auth/logout
router.post('/logout', asyncHandler(async (req, res) => {
  // Since we use JWT, we don't need to do anything server-side
  // The client should remove the tokens
  res.json({
    success: true,
    data: { message: 'Logged out successfully' }
  });
}));

export default router;