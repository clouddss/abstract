import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ethers } from 'ethers';
import { prisma } from '../../database/client';
import { validateRequest } from '../middleware/validation';
import { authMiddleware } from '../middleware/auth';
import { 
  getLaunchFee, 
  encodeDeployTokenData,
  CONTRACT_ADDRESSES,
  getProvider,
  decodeTokenLaunchedEvent
} from '../../contracts/LaunchFactory';

const router = Router();

// Validation schemas
const launchTokenSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(50),
    symbol: z.string().min(1).max(10),
    description: z.string().max(500).optional(),
    imageUrl: z.string().url().optional(),
    website: z.string().url().optional(),
    twitter: z.string().max(50).optional(),
    telegram: z.string().max(50).optional()
  })
});

const confirmLaunchSchema = z.object({
  body: z.object({
    txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
    name: z.string(),
    symbol: z.string(),
    description: z.string().optional(),
    imageUrl: z.string().optional(),
    website: z.string().optional(),
    twitter: z.string().optional(),
    telegram: z.string().optional()
  })
});

/**
 * POST /api/tokens/launch
 * Prepare token launch - returns transaction data for user to sign
 */
router.post('/launch', authMiddleware, validateRequest(launchTokenSchema), async (req: Request, res: Response) => {
  try {
    const { name, symbol } = req.body;
    const userAddress = req.user!.address;

    // Get launch fee from contract
    const launchFee = await getLaunchFee();
    
    // Encode the transaction data
    const data = encodeDeployTokenData(name, symbol);

    // Return transaction details for user to sign
    res.json({
      success: true,
      data: {
        to: CONTRACT_ADDRESSES.LAUNCH_FACTORY,
        data,
        value: launchFee.toString(),
        launchFee: ethers.formatEther(launchFee),
        message: 'Please sign the transaction in your wallet to launch the token'
      }
    });

  } catch (error) {
    console.error('Error preparing token launch:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to prepare token launch'
    });
  }
});

/**
 * POST /api/tokens/launch/confirm
 * Confirm token launch after user has sent the transaction
 */
router.post('/launch/confirm', authMiddleware, validateRequest(confirmLaunchSchema), async (req: Request, res: Response) => {
  try {
    const { txHash, name, symbol, description, imageUrl, website, twitter, telegram } = req.body;
    const userAddress = req.user!.address;

    // Check if transaction already processed
    const existingToken = await prisma.token.findFirst({
      where: { deployTxHash: txHash }
    });

    if (existingToken) {
      return res.json({
        success: true,
        data: {
          token: existingToken,
          message: 'Token already registered'
        }
      });
    }

    // Get provider and wait for transaction
    const provider = getProvider();
    const receipt = await provider.getTransactionReceipt(txHash);

    if (!receipt) {
      return res.status(400).json({
        success: false,
        error: 'Transaction not found. It may still be pending.'
      });
    }

    if (receipt.status !== 1) {
      return res.status(400).json({
        success: false,
        error: 'Transaction failed'
      });
    }

    // Decode the TokenLaunched event
    const launchEvent = decodeTokenLaunchedEvent(receipt);
    
    if (!launchEvent) {
      return res.status(400).json({
        success: false,
        error: 'Token launch event not found in transaction'
      });
    }

    // Verify the creator matches the authenticated user
    if (launchEvent.creator.toLowerCase() !== userAddress.toLowerCase()) {
      return res.status(403).json({
        success: false,
        error: 'Transaction was not sent by authenticated user'
      });
    }

    // Get initial token supply (800M tokens)
    const INITIAL_SUPPLY = ethers.parseEther('800000000');
    const CURVE_SUPPLY = ethers.parseEther('400000000'); // 50% for bonding curve

    // Create token in database
    const token = await prisma.token.create({
      data: {
        address: launchEvent.token.toLowerCase(),
        name: launchEvent.name,
        symbol: launchEvent.symbol,
        description: description || null,
        imageUrl: imageUrl || null,
        website: website || null,
        twitter: twitter || null,
        telegram: telegram || null,
        creator: launchEvent.creator.toLowerCase(),
        creatorId: req.user!.userId,
        bondingCurve: launchEvent.bondingCurve.toLowerCase(),
        totalSupply: INITIAL_SUPPLY.toString(),
        curveSupply: CURVE_SUPPLY.toString(),
        soldSupply: '0',
        deployTxHash: txHash,
        deployBlockNumber: receipt.blockNumber,
        migrated: false,
        marketCap: '0',
        volume24h: '0',
        volume7d: '0',
        volumeTotal: '0',
        holderCount: 1,
        txCount: 0,
        createdAt: new Date()
      }
    });

    // Create initial holder record for creator (they get 50% of supply)
    const CREATOR_SUPPLY = ethers.parseEther('400000000');
    await prisma.holder.create({
      data: {
        tokenAddress: token.address,
        wallet: launchEvent.creator.toLowerCase(),
        balance: CREATOR_SUPPLY.toString(),
        firstBoughtAt: new Date(),
        lastActivity: new Date()
      }
    });

    res.json({
      success: true,
      data: {
        token: {
          address: token.address,
          name: token.name,
          symbol: token.symbol,
          description: token.description,
          imageUrl: token.imageUrl,
          bondingCurve: token.bondingCurve,
          creator: token.creator,
          txHash: token.deployTxHash,
          createdAt: token.createdAt
        },
        message: 'Token launched successfully!'
      }
    });

  } catch (error) {
    console.error('Error confirming token launch:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to confirm token launch'
    });
  }
});

/**
 * GET /api/tokens/launch/fee
 * Get current launch fee
 */
router.get('/launch/fee', async (req: Request, res: Response) => {
  try {
    const launchFee = await getLaunchFee();
    
    res.json({
      success: true,
      data: {
        fee: launchFee.toString(),
        feeFormatted: ethers.formatEther(launchFee),
        currency: 'ETH'
      }
    });
  } catch (error) {
    console.error('Error fetching launch fee:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch launch fee'
    });
  }
});

export default router;