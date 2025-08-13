import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../database/client';
import { validateRequest } from '../middleware/validation';

const router = Router();

// Validation schemas
const getRewardsSchema = z.object({
  params: z.object({
    wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address')
  }),
  query: z.object({
    page: z.string().transform(Number).default('1'),
    limit: z.string().transform(Number).default('20'),
    claimed: z.string().transform(val => val === 'true').optional()
  })
});

const claimRewardsSchema = z.object({
  body: z.object({
    epochNumber: z.number(),
    ethAmount: z.string(),
    usdcAmount: z.string(),
    merkleProof: z.array(z.string()),
    signature: z.string() // User's wallet signature for verification
  })
});

/**
 * GET /api/rewards/:wallet
 * Get claimable and claimed rewards for a wallet
 */
router.get('/:wallet', validateRequest(getRewardsSchema), async (req, res) => {
  try {
    const { wallet } = req.params;
    const { page, limit, claimed } = req.query;

    // Build where clause
    const where: any = { wallet };
    if (claimed !== undefined) {
      where.claimed = claimed;
    }

    // Get rewards with pagination
    const skip = (page - 1) * limit;
    const [rewards, total] = await Promise.all([
      prisma.rewardDistribution.findMany({
        where,
        include: {
          epoch: true,
          token: {
            select: {
              name: true,
              symbol: true,
              address: true,
              imageUrl: true
            }
          }
        },
        orderBy: { epochNumber: 'desc' },
        skip,
        take: limit
      }),
      prisma.rewardDistribution.count({ where })
    ]);

    // Calculate totals
    const totals = await prisma.rewardDistribution.aggregate({
      where: { wallet },
      _sum: {
        ethAmount: true,
        usdcAmount: true
      }
    });

    const claimedTotals = await prisma.rewardDistribution.aggregate({
      where: { wallet, claimed: true },
      _sum: {
        ethAmount: true,
        usdcAmount: true
      }
    });

    const unclaimedTotals = await prisma.rewardDistribution.aggregate({
      where: { wallet, claimed: false },
      _sum: {
        ethAmount: true,
        usdcAmount: true
      }
    });

    // Format rewards
    const formattedRewards = rewards.map(reward => ({
      id: reward.id,
      epochNumber: reward.epochNumber,
      tokenAddress: reward.tokenAddress,
      tokenName: reward.token.name,
      tokenSymbol: reward.token.symbol,
      tokenImage: reward.token.imageUrl,
      ethAmount: reward.ethAmount,
      usdcAmount: reward.usdcAmount,
      weight: reward.weight,
      claimed: reward.claimed,
      claimedAt: reward.claimedAt,
      txHash: reward.txHash,
      epoch: {
        startTime: reward.epoch.startTime,
        endTime: reward.epoch.endTime,
        claimDeadline: reward.epoch.claimDeadline,
        finalized: reward.epoch.finalized
      }
    }));

    res.json({
      success: true,
      data: {
        rewards: formattedRewards,
        summary: {
          totalEth: totals._sum.ethAmount || '0',
          totalUsdc: totals._sum.usdcAmount || '0',
          claimedEth: claimedTotals._sum.ethAmount || '0',
          claimedUsdc: claimedTotals._sum.usdcAmount || '0',
          unclaimedEth: unclaimedTotals._sum.ethAmount || '0',
          unclaimedUsdc: unclaimedTotals._sum.usdcAmount || '0'
        },
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching rewards:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/rewards/claim
 * Submit a reward claim with merkle proof
 */
router.post('/claim', validateRequest(claimRewardsSchema), async (req, res) => {
  try {
    const { epochNumber, ethAmount, usdcAmount, merkleProof, signature } = req.body;

    // TODO: Verify the signature to ensure the request is from the wallet owner
    // This would involve reconstructing the message and verifying the signature

    // Check if the reward exists and is not already claimed
    const reward = await prisma.rewardDistribution.findFirst({
      where: {
        epochNumber,
        ethAmount,
        usdcAmount,
        claimed: false
      },
      include: {
        epoch: true
      }
    });

    if (!reward) {
      return res.status(404).json({
        success: false,
        error: 'Reward not found or already claimed'
      });
    }

    // Check if epoch is finalized and claim deadline hasn't passed
    if (!reward.epoch.finalized) {
      return res.status(400).json({
        success: false,
        error: 'Epoch not finalized yet'
      });
    }

    if (reward.epoch.claimDeadline && new Date() > reward.epoch.claimDeadline) {
      return res.status(400).json({
        success: false,
        error: 'Claim deadline has passed'
      });
    }

    // TODO: Verify merkle proof against the epoch's merkle root
    // This would involve reconstructing the leaf and verifying the proof

    // In a real implementation, this would call the RewardsVault contract
    // For now, we'll simulate the claiming process
    
    res.json({
      success: true,
      message: 'Claim submitted successfully. Please confirm the transaction in your wallet.',
      data: {
        epochNumber,
        ethAmount,
        usdcAmount,
        estimatedGas: '150000'
      }
    });

  } catch (error) {
    console.error('Error processing claim:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/rewards/epochs
 * Get all reward epochs
 */
router.get('/epochs', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;

    const [epochs, total] = await Promise.all([
      prisma.rewardEpoch.findMany({
        orderBy: { epochNumber: 'desc' },
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              distributions: true
            }
          }
        }
      }),
      prisma.rewardEpoch.count()
    ]);

    const formattedEpochs = epochs.map(epoch => ({
      epochNumber: epoch.epochNumber,
      startTime: epoch.startTime,
      endTime: epoch.endTime,
      totalEthRewards: epoch.totalEthRewards,
      totalUsdcRewards: epoch.totalUsdcRewards,
      merkleRoot: epoch.merkleRoot,
      snapshotTaken: epoch.snapshotTaken,
      finalized: epoch.finalized,
      claimDeadline: epoch.claimDeadline,
      totalDistributions: epoch._count.distributions,
      createdAt: epoch.createdAt
    }));

    res.json({
      success: true,
      data: {
        epochs: formattedEpochs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching epochs:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/rewards/epochs/:epochNumber
 * Get detailed information about a specific epoch
 */
router.get('/epochs/:epochNumber', async (req, res) => {
  try {
    const epochNumber = parseInt(req.params.epochNumber);
    
    if (isNaN(epochNumber)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid epoch number'
      });
    }

    const epoch = await prisma.rewardEpoch.findUnique({
      where: { epochNumber },
      include: {
        distributions: {
          include: {
            token: {
              select: {
                name: true,
                symbol: true,
                address: true,
                imageUrl: true
              }
            }
          },
          orderBy: { ethAmount: 'desc' },
          take: 100 // Top 100 distributions
        }
      }
    });

    if (!epoch) {
      return res.status(404).json({
        success: false,
        error: 'Epoch not found'
      });
    }

    // Calculate statistics
    const stats = {
      totalDistributions: epoch.distributions.length,
      totalClaimedDistributions: epoch.distributions.filter(d => d.claimed).length,
      totalUnclaimedDistributions: epoch.distributions.filter(d => !d.claimed).length,
      claimRate: epoch.distributions.length > 0 
        ? (epoch.distributions.filter(d => d.claimed).length / epoch.distributions.length) * 100 
        : 0
    };

    // Format distributions
    const distributions = epoch.distributions.map(dist => ({
      wallet: dist.wallet,
      tokenAddress: dist.tokenAddress,
      tokenName: dist.token.name,
      tokenSymbol: dist.token.symbol,
      tokenImage: dist.token.imageUrl,
      ethAmount: dist.ethAmount,
      usdcAmount: dist.usdcAmount,
      weight: dist.weight,
      claimed: dist.claimed,
      claimedAt: dist.claimedAt
    }));

    res.json({
      success: true,
      data: {
        ...epoch,
        distributions,
        stats
      }
    });

  } catch (error) {
    console.error('Error fetching epoch details:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/rewards/leaderboard
 * Get rewards leaderboard
 */
router.get('/leaderboard', async (req, res) => {
  try {
    const timeframe = req.query.timeframe as string || 'all';
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    // Build time filter
    let timeFilter = {};
    if (timeframe !== 'all') {
      const now = new Date();
      let startTime: Date;
      
      switch (timeframe) {
        case '24h':
          startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startTime = new Date(0);
      }
      
      timeFilter = {
        epoch: {
          startTime: { gte: startTime }
        }
      };
    }

    // Get top reward earners
    const topEarners = await prisma.rewardDistribution.groupBy({
      by: ['wallet'],
      where: timeFilter,
      _sum: {
        ethAmount: true,
        usdcAmount: true
      },
      _count: {
        _all: true
      },
      orderBy: {
        _sum: {
          ethAmount: 'desc'
        }
      },
      take: limit
    });

    const leaderboard = topEarners.map((earner, index) => ({
      rank: index + 1,
      wallet: earner.wallet,
      totalEthRewards: earner._sum.ethAmount || '0',
      totalUsdcRewards: earner._sum.usdcAmount || '0',
      totalClaims: earner._count._all
    }));

    res.json({
      success: true,
      data: {
        timeframe,
        leaderboard
      }
    });

  } catch (error) {
    console.error('Error fetching rewards leaderboard:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;