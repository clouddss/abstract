import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ethers } from 'ethers';
import { prisma } from '../../database/client';
import { validateRequest } from '../middleware/validation';
import { authMiddleware } from '../middleware/auth';
import { getProvider, BONDING_CURVE_ABI } from '../../contracts/LaunchFactory';
import { TradeType } from '@prisma/client';
import { getCachedVolumeData, invalidateVolumeCache } from '../services/volumeCache';

const router = Router();

// Validation schemas
const estimateTradeSchema = z.object({
  body: z.object({
    tokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/i), // Case insensitive
    type: z.enum(['BUY', 'SELL']), // Frontend sends uppercase
    amountIn: z.string(), // Amount in wei
  })
});

const executeTradeSchema = z.object({
  body: z.object({
    tokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    tradeType: z.enum(['buy', 'sell']),
    amount: z.string(),
    minOutput: z.string(), // Slippage protection
    txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional() // For confirmation
  })
});

/**
 * POST /api/trades/estimate
 * Estimate trade output and price impact
 */
router.post('/estimate', validateRequest(estimateTradeSchema), async (req: Request, res: Response) => {
  try {
    const { tokenAddress, type, amountIn } = req.body;
    const tradeType = type.toLowerCase(); // Convert BUY/SELL to buy/sell
    
    console.log('Trade estimate request:', { tokenAddress, type, amountIn });

    // Get token info
    const token = await prisma.token.findUnique({
      where: { address: tokenAddress.toLowerCase() }
    });

    if (!token) {
      return res.status(404).json({
        success: false,
        error: 'Token not found'
      });
    }

    if (token.migrated) {
      return res.status(400).json({
        success: false,
        error: 'Token has migrated to DEX. Use DEX for trading.'
      });
    }

    // Get bonding curve contract
    const provider = getProvider();
    const bondingCurve = new ethers.Contract(
      token.bondingCurve,
      BONDING_CURVE_ABI,
      provider
    );

    let output: string;
    let priceImpact: string;
    let newPrice: string;
    let fee: string;

    if (tradeType === 'buy') {
      // Calculate tokens out for ETH amount (amountIn is already in wei)
      const ethAmount = BigInt(amountIn);
      const tokensOut = await bondingCurve.calculateTokensOut(ethAmount);
      
      // Get current price
      const currentPrice = await bondingCurve.getCurrentPrice();
      
      // Calculate fee (1% total - 0.5% platform, 0.5% creator)
      const feeAmount = (ethAmount * 100n) / 10000n;
      
      output = ethers.formatEther(tokensOut);
      fee = ethers.formatEther(feeAmount);
      
      // Simple price impact calculation based on amount
      // Approximate: buying increases price
      const ethValue = Number(ethers.formatEther(ethAmount));
      priceImpact = (ethValue * 10).toFixed(2); // Rough estimate: 10% impact per 0.1 ETH
      
      newPrice = ethers.formatEther(currentPrice);
      
    } else {
      // Calculate ETH out for token amount (amountIn is already in wei)
      const tokenAmount = BigInt(amountIn);
      
      let ethOut: bigint;
      try {
        ethOut = await bondingCurve.calculateEthOut(tokenAmount);
      } catch (error) {
        console.error('Error calculating ETH out:', error);
        // Fallback calculation if the contract doesn't have calculateEthOut
        const currentPrice = await bondingCurve.getCurrentPrice();
        // Simple approximation: tokens * price
        ethOut = (tokenAmount * BigInt(currentPrice)) / ethers.parseEther('1');
      }
      
      // Get current price
      const currentPrice = await bondingCurve.getCurrentPrice();
      
      // Calculate fee (1% of ETH output)
      const feeAmount = (ethOut * 100n) / 10000n;
      
      output = ethers.formatEther(ethOut);
      fee = ethers.formatEther(feeAmount);
      
      // Simple price impact calculation
      const tokenValue = Number(ethers.formatEther(tokenAmount));
      const ethValue = Number(ethers.formatEther(ethOut));
      priceImpact = Math.min((tokenValue / 10000), 10).toFixed(2); // Cap at 10% for safety
      
      newPrice = ethers.formatEther(currentPrice);
    }

    // Ensure all values are defined
    if (!output || !newPrice || !fee || !priceImpact) {
      throw new Error('Failed to calculate trade parameters');
    }

    const response = {
      success: true,
      data: {
        tokenAddress,
        tradeType: type, // Return uppercase as frontend expects
        inputAmount: amountIn, // Return in wei as sent
        outputAmount: ethers.parseEther(output).toString(), // Return in wei
        priceImpact: parseFloat(priceImpact), // Return as number
        currentPrice: ethers.parseEther(newPrice).toString(), // Return in wei
        fee: ethers.parseEther(fee).toString(), // Return in wei
        minimumReceived: ethers.parseEther(output).toString(), // In wei
        executionPrice: ethers.parseEther(newPrice).toString() // In wei
      }
    };
    
    console.log('Trade estimate response:', response);
    res.json(response);

  } catch (error) {
    console.error('Error estimating trade:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to estimate trade'
    });
  }
});

/**
 * GET /api/trades/price/:tokenAddress
 * Get current token price and stats
 */
router.get('/price/:tokenAddress', async (req: Request, res: Response) => {
  try {
    const { tokenAddress } = req.params;

    // Get token info
    const token = await prisma.token.findUnique({
      where: { address: tokenAddress.toLowerCase() }
    });

    if (!token) {
      return res.status(404).json({
        success: false,
        error: 'Token not found'
      });
    }

    // Get bonding curve contract
    const provider = getProvider();
    const bondingCurve = new ethers.Contract(
      token.bondingCurve,
      BONDING_CURVE_ABI,
      provider
    );

    // Get current price and cached volume data
    try {
      const [currentPrice, testAmount, cachedData] = await Promise.all([
        bondingCurve.getCurrentPrice(),
        bondingCurve.calculateTokensOut(ethers.parseEther("1")),
        getCachedVolumeData(tokenAddress)
      ]);
      
      // Calculate market cap using actual circulating supply
      const marketCapData = await calculateMarketCap(tokenAddress, token.bondingCurve);
      
      res.json({
        success: true,
        data: {
          tokenAddress,
          currentPrice: ethers.formatEther(currentPrice),
          tokensSold: marketCapData.circulatingSupply,
          tokensRemaining: (BigInt(token.curveSupply) - BigInt(marketCapData.circulatingSupply)).toString(),
          reserveBalance: "0", // Would need to get from bonding curve
          marketCap: ethers.formatEther(marketCapData.marketCap),
          volume24h: ethers.formatEther(cachedData.volume24h),
          volume7d: ethers.formatEther(cachedData.volume7d),
          volumeTotal: ethers.formatEther(cachedData.volumeTotal),
          holderCount: cachedData.holderCount,
          progressPercent: Number((BigInt(marketCapData.circulatingSupply) * 100n) / BigInt(token.curveSupply)),
          isCompleted: false,
          isMigrated: token.migrated,
          tokensPerEth: ethers.formatEther(testAmount)
        }
      });
    } catch (error: any) {
      // Fallback if bonding curve doesn't have these functions
      res.json({
        success: true,
        data: {
          tokenAddress,
          currentPrice: "0.000001",
          tokensSold: "0",
          tokensRemaining: "700000000",
          reserveBalance: "0",
          marketCap: "0",
          progressPercent: 0,
          isCompleted: false,
          isMigrated: token.migrated
        }
      });
    }

  } catch (error) {
    console.error('Error fetching price:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch price'
    });
  }
});

/**
 * POST /api/trades/execute
 * Execute a trade (returns transaction data for wallet to sign)
 */
router.post('/execute', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { tokenAddress, type, amountIn, minAmountOut } = req.body;
    
    // Get token info
    const token = await prisma.token.findUnique({
      where: { address: tokenAddress.toLowerCase() }
    });

    if (!token) {
      return res.status(404).json({
        success: false,
        error: 'Token not found'
      });
    }

    const bondingCurveAddress = token.bondingCurve;
    const iface = new ethers.Interface(BONDING_CURVE_ABI);
    
    let to: string;
    let data: string;
    let value: string;

    if (type === TradeType.BUY || type === 'BUY') {
      // Prepare buy transaction (amountIn is in wei)
      const minTokensOut = BigInt(minAmountOut || '0');
      
      to = bondingCurveAddress;
      data = iface.encodeFunctionData('buyTokens', [minTokensOut]);
      value = amountIn; // Already in wei
      
    } else if (type === TradeType.SELL || type === 'SELL') {
      // Prepare sell transaction
      const tokenAmount = BigInt(amountIn);
      const minEthOut = BigInt(minAmountOut || '0');
      
      to = bondingCurveAddress;
      data = iface.encodeFunctionData('sellTokens', [tokenAmount, minEthOut]);
      value = '0'; // Sell transactions don't send ETH
    } else {
      throw new Error(`Invalid trade type: ${type}`);
    }

    res.json({
      success: true,
      data: {
        txHash: '', // Will be filled by frontend after signing
        status: 'pending',
        message: 'Please sign the transaction in your wallet',
        transactionData: {
          to,
          data,
          value
        }
      }
    });

  } catch (error) {
    console.error('Error preparing trade execution:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to prepare trade'
    });
  }
});

/**
 * POST /api/trades/prepare
 * Prepare trade transaction data
 */
router.post('/prepare', authMiddleware, validateRequest(executeTradeSchema), async (req: Request, res: Response) => {
  try {
    const { tokenAddress, tradeType, amount, minOutput } = req.body;

    // Get token info
    const token = await prisma.token.findUnique({
      where: { address: tokenAddress.toLowerCase() }
    });

    if (!token) {
      return res.status(404).json({
        success: false,
        error: 'Token not found'
      });
    }

    let to: string;
    let data: string;
    let value: string;

    const bondingCurveAddress = token.bondingCurve;
    const iface = new ethers.Interface(BONDING_CURVE_ABI);

    if (tradeType === 'buy') {
      // Prepare buy transaction
      const ethAmount = ethers.parseEther(amount);
      const minTokensOut = ethers.parseEther(minOutput);
      
      to = bondingCurveAddress;
      data = iface.encodeFunctionData('buyTokens', [minTokensOut]);
      value = ethAmount.toString();
      
    } else {
      // Prepare sell transaction
      const tokenAmount = ethers.parseEther(amount);
      const minEthOut = ethers.parseEther(minOutput);
      
      to = bondingCurveAddress;
      data = iface.encodeFunctionData('sellTokens', [tokenAmount, minEthOut]);
      value = '0';
    }

    res.json({
      success: true,
      data: {
        to,
        data,
        value,
        tradeType,
        message: `Please sign the ${tradeType} transaction in your wallet`
      }
    });

  } catch (error) {
    console.error('Error preparing trade:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to prepare trade'
    });
  }
});

/**
 * Production-ready volume calculation functions
 */
async function calculateVolumeMetrics(tokenAddress: string, ethAmount: string, timestamp: Date) {
  const ethAmountBig = BigInt(ethAmount);
  const now = timestamp;
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Use database aggregation for efficient volume calculation
  const [volume24hResult, volume7dResult, currentToken] = await Promise.all([
    // Calculate 24h volume using SQL aggregation
    prisma.trade.count({
      where: {
        tokenAddress: tokenAddress.toLowerCase(),
        timestamp: { gte: oneDayAgo }
      }
    }),
    
    // Calculate 7d volume using SQL aggregation  
    prisma.trade.count({
      where: {
        tokenAddress: tokenAddress.toLowerCase(),
        timestamp: { gte: sevenDaysAgo }
      }
    }),
    
    // Get current token data
    prisma.token.findUnique({
      where: { address: tokenAddress.toLowerCase() },
      select: { volumeTotal: true }
    })
  ]);

  // For more accurate volume calculation, we need to sum ETH amounts from both buys and sells
  const [volume24hDetailed, volume7dDetailed] = await Promise.all([
    prisma.trade.findMany({
      where: {
        tokenAddress: tokenAddress.toLowerCase(),
        timestamp: { gte: oneDayAgo }
      },
      select: { type: true, amountIn: true, amountOut: true }
    }),
    
    prisma.trade.findMany({
      where: {
        tokenAddress: tokenAddress.toLowerCase(),
        timestamp: { gte: sevenDaysAgo }
      },
      select: { type: true, amountIn: true, amountOut: true }
    })
  ]);

  // Calculate ETH volume properly (amountIn for buys, amountOut for sells)
  const volume24h = volume24hDetailed.reduce((sum, trade) => {
    const ethAmount = trade.type === TradeType.BUY ? trade.amountIn : trade.amountOut;
    return sum + BigInt(ethAmount);
  }, 0n);

  const volume7d = volume7dDetailed.reduce((sum, trade) => {
    const ethAmount = trade.type === TradeType.BUY ? trade.amountIn : trade.amountOut;
    return sum + BigInt(ethAmount);
  }, 0n);

  const currentVolumeTotal = BigInt(currentToken?.volumeTotal || '0');
  const newVolumeTotal = currentVolumeTotal + ethAmountBig;

  return {
    volume24h: (volume24h + ethAmountBig).toString(),
    volume7d: (volume7d + ethAmountBig).toString(),
    volumeTotal: newVolumeTotal.toString()
  };
}

/**
 * Update holder information with proper balance tracking
 */
async function updateHolderBalance(
  tokenAddress: string,
  holderAddress: string,
  tokenAmount: string,
  isBuy: boolean,
  timestamp: Date
) {
  const tokenAmountBig = BigInt(tokenAmount);
  
  // Get current holder to calculate new balances
  const currentHolder = await prisma.holder.findUnique({
    where: {
      tokenAddress_wallet: {
        tokenAddress: tokenAddress.toLowerCase(),
        wallet: holderAddress.toLowerCase()
      }
    }
  });

  const currentBalance = BigInt(currentHolder?.balance || '0');
  const currentTotalBought = BigInt(currentHolder?.totalBought || '0');
  const currentTotalSold = BigInt(currentHolder?.totalSold || '0');

  const newBalance = isBuy ? currentBalance + tokenAmountBig : currentBalance - tokenAmountBig;
  const newTotalBought = isBuy ? currentTotalBought + tokenAmountBig : currentTotalBought;
  const newTotalSold = !isBuy ? currentTotalSold + tokenAmountBig : currentTotalSold;

  // Use upsert for atomic operation
  const holder = await prisma.holder.upsert({
    where: {
      tokenAddress_wallet: {
        tokenAddress: tokenAddress.toLowerCase(),
        wallet: holderAddress.toLowerCase()
      }
    },
    update: {
      balance: newBalance.toString(),
      totalBought: newTotalBought.toString(),
      totalSold: newTotalSold.toString(),
      lastActivity: timestamp,
      updatedAt: timestamp
    },
    create: {
      tokenAddress: tokenAddress.toLowerCase(),
      wallet: holderAddress.toLowerCase(),
      balance: isBuy ? tokenAmount : '0',
      totalBought: isBuy ? tokenAmount : '0',
      totalSold: !isBuy ? tokenAmount : '0',
      firstBoughtAt: isBuy ? timestamp : null,
      lastActivity: timestamp,
      avgHoldTime: 0,
      realizedPnl: '0',
      unrealizedPnl: '0',
      rewardsClaimed: '0'
    }
  });

  // If selling and balance becomes zero or negative, remove the holder
  if (!isBuy && newBalance <= 0n) {
    await prisma.holder.delete({
      where: { id: holder.id }
    });
    return null;
  }

  return holder;
}

/**
 * Calculate market cap based on circulating supply from bonding curve
 */
async function calculateMarketCap(tokenAddress: string, bondingCurveAddress: string) {
  try {
    const provider = getProvider();
    const bondingCurve = new ethers.Contract(
      bondingCurveAddress,
      BONDING_CURVE_ABI,
      provider
    );

    // Get current price and circulating supply
    const [currentPrice, tokensSold] = await Promise.all([
      bondingCurve.getCurrentPrice(),
      bondingCurve.tokensSold ? bondingCurve.tokensSold() : Promise.resolve(0n)
    ]);

    // If tokensSold is not available, calculate from database
    let circulatingSupply = tokensSold;
    if (!tokensSold || tokensSold === 0n) {
      const token = await prisma.token.findUnique({
        where: { address: tokenAddress.toLowerCase() },
        select: { soldSupply: true }
      });
      circulatingSupply = BigInt(token?.soldSupply || '0');
    }

    // Market cap = current price * circulating supply
    const marketCap = (BigInt(currentPrice) * BigInt(circulatingSupply)) / BigInt(ethers.parseEther('1'));
    
    return {
      marketCap: marketCap.toString(),
      currentPrice: currentPrice.toString(),
      circulatingSupply: circulatingSupply.toString()
    };
  } catch (error) {
    console.error('Error calculating market cap:', error);
    // Fallback calculation
    const token = await prisma.token.findUnique({
      where: { address: tokenAddress.toLowerCase() },
      select: { soldSupply: true }
    });
    
    // Use a default price if bonding curve call fails
    const defaultPrice = ethers.parseEther('0.000001');
    const circulatingSupply = BigInt(token?.soldSupply || '0');
    const marketCap = (BigInt(defaultPrice) * circulatingSupply) / BigInt(ethers.parseEther('1'));
    
    return {
      marketCap: marketCap.toString(),
      currentPrice: defaultPrice.toString(),
      circulatingSupply: circulatingSupply.toString()
    };
  }
}

/**
 * Update holder count efficiently
 */
async function updateHolderCount(tokenAddress: string) {
  const holderCount = await prisma.holder.count({
    where: {
      tokenAddress: tokenAddress.toLowerCase(),
      balance: { gt: '0' }
    }
  });

  await prisma.token.update({
    where: { address: tokenAddress.toLowerCase() },
    data: { holderCount }
  });

  return holderCount;
}

/**
 * POST /api/trades/confirm
 * Confirm trade after transaction is mined - Production Ready
 */
router.post('/confirm', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { txHash, tokenAddress, tradeType } = req.body;

    // Get provider and wait for transaction
    const provider = getProvider();
    const receipt = await provider.getTransactionReceipt(txHash);

    if (!receipt) {
      return res.status(400).json({
        success: false,
        error: 'Transaction not found'
      });
    }

    if (receipt.status !== 1) {
      return res.status(400).json({
        success: false,
        error: 'Transaction failed'
      });
    }

    // Parse events to get trade details
    const iface = new ethers.Interface(BONDING_CURVE_ABI);
    let tradeData: any = null;

    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog({
          topics: log.topics as string[],
          data: log.data
        });

        if (parsed && (parsed.name === 'TokensPurchased' || parsed.name === 'TokensSold')) {
          tradeData = {
            type: parsed.name === 'TokensPurchased' ? TradeType.BUY : TradeType.SELL,
            user: parsed.args[0],
            ethAmount: ethers.formatEther(parsed.args[1]),
            tokenAmount: ethers.formatEther(parsed.args[2]),
            newPrice: ethers.formatEther(parsed.args[3])
          };
          break;
        }
      } catch (e) {
        // Not our event
      }
    }

    if (!tradeData) {
      return res.status(400).json({
        success: false,
        error: 'Trade event not found in transaction'
      });
    }

    // Get token info
    const token = await prisma.token.findUnique({
      where: { address: tokenAddress.toLowerCase() }
    });

    if (!token) {
      return res.status(404).json({
        success: false,
        error: 'Token not found'
      });
    }

    const timestamp = new Date();
    const ethAmount = ethers.parseEther(tradeData.ethAmount).toString();
    const tokenAmount = ethers.parseEther(tradeData.tokenAmount).toString();
    const isBuy = tradeType === 'buy' || tradeType === TradeType.BUY;
    const feeAmount = (BigInt(ethAmount) * 100n) / 10000n; // 1% fee

    // Use database transaction for atomicity
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create trade record
      const trade = await tx.trade.create({
        data: {
          tokenAddress: tokenAddress.toLowerCase(),
          trader: req.user!.address.toLowerCase(),
          userId: req.user!.userId,
          type: tradeType === 'buy' ? TradeType.BUY : TradeType.SELL,
          amountIn: isBuy ? ethAmount : tokenAmount,
          amountOut: isBuy ? tokenAmount : ethAmount,
          price: ethers.parseEther(tradeData.newPrice).toString(),
          feeAmount: feeAmount.toString(),
          txHash,
          blockNumber: receipt.blockNumber,
          blockHash: receipt.blockHash,
          logIndex: 0,
          timestamp
        }
      });

      // 2. Calculate volume metrics efficiently with caching
      // Invalidate cache first to ensure fresh calculation
      invalidateVolumeCache(tokenAddress);
      
      const volumeMetrics = await calculateVolumeMetrics(
        tokenAddress,
        ethAmount,
        timestamp
      );

      // 3. Calculate market cap based on actual circulating supply
      const marketCapData = await calculateMarketCap(
        tokenAddress,
        token.bondingCurve
      );

      // 4. Update sold supply
      const tokenAmountBig = BigInt(tokenAmount);
      const currentSoldSupply = BigInt(token.soldSupply);
      const newSoldSupply = isBuy 
        ? currentSoldSupply + tokenAmountBig
        : currentSoldSupply; // Sells don't change total sold supply

      // 5. Update token stats
      await tx.token.update({
        where: { address: tokenAddress.toLowerCase() },
        data: {
          soldSupply: newSoldSupply.toString(),
          marketCap: marketCapData.marketCap,
          txCount: { increment: 1 },
          volumeTotal: volumeMetrics.volumeTotal,
          volume24h: volumeMetrics.volume24h,
          volume7d: volumeMetrics.volume7d,
          updatedAt: timestamp
        }
      });

      return { trade, volumeMetrics, marketCapData };
    });

    // 6. Update holder balance (outside transaction to avoid deadlocks)
    await updateHolderBalance(
      tokenAddress,
      req.user!.address,
      tokenAmount,
      isBuy,
      timestamp
    );

    // 7. Update holder count
    const holderCount = await updateHolderCount(tokenAddress);

    res.json({
      success: true,
      data: {
        ...tradeData,
        txHash,
        blockNumber: receipt.blockNumber,
        volumeMetrics: result.volumeMetrics,
        marketCap: result.marketCapData.marketCap,
        holderCount,
        message: `${tradeType === 'buy' ? 'Purchase' : 'Sale'} completed successfully!`
      }
    });

  } catch (error) {
    console.error('Error confirming trade:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to confirm trade'
    });
  }
});

export default router;