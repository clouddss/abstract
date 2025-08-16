import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ethers } from 'ethers';
import { prisma } from '../../database/client';
import { validateRequest } from '../middleware/validation';
import { authMiddleware } from '../middleware/auth';
import { getProvider, BONDING_CURVE_ABI } from '../../contracts/LaunchFactory';

const router = Router();

// Validation schemas
const estimateTradeSchema = z.object({
  body: z.object({
    tokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    tradeType: z.enum(['buy', 'sell']),
    amount: z.string(), // ETH amount for buy, token amount for sell
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
    const { tokenAddress, tradeType, amount } = req.body;

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
      // Calculate tokens out for ETH amount
      const ethAmount = ethers.parseEther(amount);
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
      // Calculate ETH out for token amount
      const tokenAmount = ethers.parseEther(amount);
      const ethOut = await bondingCurve.calculateEthOut(tokenAmount);
      
      // Get current price
      const currentPrice = await bondingCurve.getCurrentPrice();
      
      // Calculate fee
      const feeAmount = (ethOut * 100n) / 10000n;
      
      output = ethers.formatEther(ethOut);
      fee = ethers.formatEther(feeAmount);
      
      // Simple price impact calculation
      const tokenValue = Number(ethers.formatEther(tokenAmount));
      priceImpact = (tokenValue / 1000).toFixed(2); // Rough estimate based on token amount
      
      newPrice = ethers.formatEther(currentPrice);
    }

    res.json({
      success: true,
      data: {
        tokenAddress,
        tradeType,
        inputAmount: amount,
        outputAmount: output,
        priceImpact,
        currentPrice: newPrice,
        fee,
        minimumReceived: output, // In production, subtract slippage
        executionPrice: newPrice
      }
    });

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

    // Get current price
    try {
      const currentPrice = await bondingCurve.getCurrentPrice();
      
      // Calculate some tokens to estimate market cap
      const testAmount = ethers.parseEther("1");
      const tokensForOneEth = await bondingCurve.calculateTokensOut(testAmount);
      
      res.json({
        success: true,
        data: {
          tokenAddress,
          currentPrice: ethers.formatEther(currentPrice),
          tokensSold: "0", // We don't have this info from the simple bonding curve
          tokensRemaining: "700000000", // Default curve supply
          reserveBalance: "0", // We don't have this info
          marketCap: ethers.formatEther(currentPrice * 1000000000n), // Price * total supply
          progressPercent: 0, // We don't have this info
          isCompleted: false,
          isMigrated: token.migrated,
          tokensPerEth: ethers.formatEther(tokensForOneEth)
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
 * POST /api/trades/confirm
 * Confirm trade after transaction is mined
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
            type: parsed.name === 'TokensPurchased' ? 'buy' : 'sell',
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

    // Update token stats in database
    const token = await prisma.token.findUnique({
      where: { address: tokenAddress.toLowerCase() }
    });

    if (token) {
      // Get updated stats from bonding curve
      const bondingCurve = new ethers.Contract(
        token.bondingCurve,
        BONDING_CURVE_ABI,
        provider
      );
      
      // Update token stats (simplified without getCurveStats)
      const currentPrice = await bondingCurve.getCurrentPrice();
      
      await prisma.token.update({
        where: { address: tokenAddress.toLowerCase() },
        data: {
          marketCap: (currentPrice * 1000000000n).toString(),
          txCount: { increment: 1 }
        }
      });

      // Record trade in database
      const isEthBuy = tradeType === 'buy';
      await prisma.trade.create({
        data: {
          tokenAddress: tokenAddress.toLowerCase(),
          trader: req.user!.address.toLowerCase(),
          userId: req.user!.userId,
          type: tradeType,
          amountIn: isEthBuy ? ethers.parseEther(tradeData.ethAmount).toString() : ethers.parseEther(tradeData.tokenAmount).toString(),
          amountOut: isEthBuy ? ethers.parseEther(tradeData.tokenAmount).toString() : ethers.parseEther(tradeData.ethAmount).toString(),
          price: ethers.parseEther(tradeData.newPrice).toString(),
          feeAmount: '0', // Calculate fee if needed
          txHash,
          blockNumber: receipt.blockNumber,
          blockHash: receipt.blockHash,
          logIndex: 0,
          timestamp: new Date()
        }
      });
    }

    res.json({
      success: true,
      data: {
        ...tradeData,
        txHash,
        blockNumber: receipt.blockNumber,
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