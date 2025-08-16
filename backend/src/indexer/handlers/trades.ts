import { ethers } from 'ethers';
import { prisma } from '../../database/client';
import { getBlockTimestamp, calculateTokenPrice } from '../ethereum';
import { TradeType } from '@prisma/client';
import { chartService } from '../../services/chartService';
import { wsEvents } from '../../websocket/events';

export interface TokensPurchasedEvent {
  buyer: string;
  ethAmount: string;
  tokenAmount: string;
  newPrice: string;
  tokenAddress: string;
  blockNumber: number;
  txHash: string;
  logIndex: number;
}

export interface TokensSoldEvent {
  seller: string;
  tokenAmount: string;
  ethAmount: string;
  newPrice: string;
  tokenAddress: string;
  blockNumber: number;
  txHash: string;
  logIndex: number;
}

export async function handleTokensPurchased(event: TokensPurchasedEvent): Promise<void> {
  try {
    console.log(`💰 Processing TokensPurchased event: ${event.buyer} bought ${ethers.formatEther(event.tokenAmount)} tokens`);

    const timestamp = await getBlockTimestamp(event.blockNumber);

    // Calculate platform fee (0.5% + 0.5% = 1% total)
    const ethAmountBig = BigInt(event.ethAmount);
    const feeAmount = (ethAmountBig * 100n) / 10000n; // 1% fee

    // Create trade record
    const trade = await prisma.trade.create({
      data: {
        tokenAddress: event.tokenAddress,
        trader: event.buyer,
        type: TradeType.BUY,
        amountIn: event.ethAmount,
        amountOut: event.tokenAmount,
        price: event.newPrice,
        feeAmount: feeAmount.toString(),
        txHash: event.txHash,
        blockNumber: event.blockNumber,
        blockHash: "", // We'd get this from the transaction receipt
        logIndex: event.logIndex,
        timestamp
      }
    });

    // Update or create holder record
    const holderUpdate = await updateHolderRecord(event.tokenAddress, event.buyer, event.tokenAmount, true, timestamp);
    
    // Emit holder update event
    if (holderUpdate) {
      wsEvents.emitHolderUpdate(holderUpdate);
    }

    // Update token statistics
    const tokenStatsUpdate = await updateTokenStats(event.tokenAddress, event.ethAmount, event.tokenAmount, timestamp, 'BUY');
    
    // Emit token update event
    if (tokenStatsUpdate) {
      wsEvents.emitTokenUpdate(event.tokenAddress, tokenStatsUpdate);
    }

    // Update platform statistics
    await updatePlatformTradeStats(event.ethAmount, feeAmount.toString(), timestamp);

    // Update price data for charts
    await updatePriceData(event.tokenAddress, event.newPrice, event.ethAmount, timestamp);
    
    // Update chart data using chartService
    await chartService.updateChartDataForTrade(trade);

    // Emit WebSocket events
    wsEvents.emitNewTrade({
      id: trade.id,
      tokenAddress: event.tokenAddress,
      trader: event.buyer,
      type: 'BUY',
      amountIn: event.ethAmount,
      amountOut: event.tokenAmount,
      price: event.newPrice,
      feeAmount: feeAmount.toString(),
      txHash: event.txHash,
      timestamp
    });

    // Emit price update
    wsEvents.emitPriceUpdate(event.tokenAddress, event.newPrice, event.ethAmount);

    console.log(`✅ Purchase processed: Trade ID ${trade.id}`);

  } catch (error) {
    console.error('❌ Error handling TokensPurchased event:', error);
    throw error;
  }
}

export async function handleTokensSold(event: TokensSoldEvent): Promise<void> {
  try {
    console.log(`💸 Processing TokensSold event: ${event.seller} sold ${ethers.formatEther(event.tokenAmount)} tokens`);

    const timestamp = await getBlockTimestamp(event.blockNumber);

    // Calculate platform fee
    const ethAmountBig = BigInt(event.ethAmount);
    const feeAmount = (ethAmountBig * 100n) / 10000n; // 1% fee

    // Create trade record
    const trade = await prisma.trade.create({
      data: {
        tokenAddress: event.tokenAddress,
        trader: event.seller,
        type: TradeType.SELL,
        amountIn: event.tokenAmount,
        amountOut: event.ethAmount,
        price: event.newPrice,
        feeAmount: feeAmount.toString(),
        txHash: event.txHash,
        blockNumber: event.blockNumber,
        blockHash: "",
        logIndex: event.logIndex,
        timestamp
      }
    });

    // Update holder record
    const holderUpdate = await updateHolderRecord(event.tokenAddress, event.seller, event.tokenAmount, false, timestamp);
    
    // Emit holder update event
    if (holderUpdate) {
      wsEvents.emitHolderUpdate(holderUpdate);
    }

    // Update token statistics
    const tokenStatsUpdate = await updateTokenStats(event.tokenAddress, event.ethAmount, event.tokenAmount, timestamp, 'SELL');
    
    // Emit token update event
    if (tokenStatsUpdate) {
      wsEvents.emitTokenUpdate(event.tokenAddress, tokenStatsUpdate);
    }

    // Update platform statistics
    await updatePlatformTradeStats(event.ethAmount, feeAmount.toString(), timestamp);

    // Update price data
    await updatePriceData(event.tokenAddress, event.newPrice, event.ethAmount, timestamp);
    
    // Update chart data using chartService
    await chartService.updateChartDataForTrade(trade);

    // Emit WebSocket events
    wsEvents.emitNewTrade({
      id: trade.id,
      tokenAddress: event.tokenAddress,
      trader: event.seller,
      type: 'SELL',
      amountIn: event.tokenAmount,
      amountOut: event.ethAmount,
      price: event.newPrice,
      feeAmount: feeAmount.toString(),
      txHash: event.txHash,
      timestamp
    });

    // Emit price update
    wsEvents.emitPriceUpdate(event.tokenAddress, event.newPrice, event.ethAmount);

    console.log(`✅ Sale processed: Trade ID ${trade.id}`);

  } catch (error) {
    console.error('❌ Error handling TokensSold event:', error);
    throw error;
  }
}

async function updateHolderRecord(
  tokenAddress: string,
  wallet: string,
  tokenAmount: string,
  isBuy: boolean,
  timestamp: Date
): Promise<{ tokenAddress: string; wallet: string; balance: string; totalBought: string; totalSold: string; isNewHolder?: boolean; isRemovedHolder?: boolean } | null> {
  const tokenAmountBig = BigInt(tokenAmount);

  try {
    // First, try to find existing holder
    const existingHolder = await prisma.holder.findUnique({
      where: {
        tokenAddress_wallet: {
          tokenAddress,
          wallet
        }
      }
    });

    if (existingHolder) {
      // Calculate new values
      const currentBalance = BigInt(existingHolder.balance);
      const currentTotalBought = BigInt(existingHolder.totalBought);
      const currentTotalSold = BigInt(existingHolder.totalSold);
      
      const newBalance = isBuy 
        ? currentBalance + tokenAmountBig
        : currentBalance - tokenAmountBig;
      
      const newTotalBought = isBuy 
        ? currentTotalBought + tokenAmountBig
        : currentTotalBought;
      
      const newTotalSold = !isBuy 
        ? currentTotalSold + tokenAmountBig
        : currentTotalSold;

      await prisma.holder.update({
        where: { id: existingHolder.id },
        data: {
          balance: newBalance.toString(),
          totalBought: newTotalBought.toString(),
          totalSold: newTotalSold.toString(),
          lastActivity: timestamp,
          updatedAt: timestamp
        }
      });

      return {
        tokenAddress,
        wallet,
        balance: newBalance.toString(),
        totalBought: newTotalBought.toString(),
        totalSold: newTotalSold.toString()
      };
    } else {
      // Create new holder
      const newHolder = await prisma.holder.create({
        data: {
          tokenAddress,
          wallet,
          balance: isBuy ? tokenAmount : "0",
          totalBought: isBuy ? tokenAmount : "0",
          totalSold: !isBuy ? tokenAmount : "0",
          firstBoughtAt: isBuy ? timestamp : null,
          lastActivity: timestamp,
          avgHoldTime: 0,
          realizedPnl: "0",
          unrealizedPnl: "0",
          rewardsClaimed: "0"
        }
      });

      return {
        tokenAddress,
        wallet,
        balance: newHolder.balance,
        totalBought: newHolder.totalBought,
        totalSold: newHolder.totalSold,
        isNewHolder: true
      };
    }

    // Remove holder if balance reaches zero
    if (!isBuy && existingHolder) {
      const updatedHolder = await prisma.holder.findUnique({
        where: { id: existingHolder.id }
      });
      
      if (updatedHolder && BigInt(updatedHolder.balance) <= 0n) {
        await prisma.holder.delete({
          where: { id: existingHolder.id }
        });
        
        return {
          tokenAddress,
          wallet,
          balance: "0",
          totalBought: updatedHolder.totalBought,
          totalSold: updatedHolder.totalSold,
          isRemovedHolder: true
        };
      }
    }

    return null;

  } catch (error) {
    console.error(`Error updating holder record for ${wallet}:`, error);
    throw error;
  }
}

async function updateTokenStats(
  tokenAddress: string,
  ethAmount: string,
  tokenAmount: string,
  timestamp: Date,
  tradeType?: 'BUY' | 'SELL'
): Promise<{ price?: string; volume24h?: string; volume7d?: string; volumeTotal?: string; marketCap?: string; holderCount?: number; soldSupply?: string } | null> {
  try {
    // Get current token
    const token = await prisma.token.findUnique({
      where: { address: tokenAddress }
    });

    if (!token) {
      console.error(`Token ${tokenAddress} not found`);
      return null;
    }

    // Update sold supply and volume
    const ethAmountBig = BigInt(ethAmount);
    const tokenAmountBig = BigInt(tokenAmount);
    const currentSoldSupply = BigInt(token.soldSupply);
    const currentVolumeTotal = BigInt(token.volumeTotal);

    // FIXED: soldSupply should only increase on BUY trades, never decrease on SELL
    // soldSupply represents total tokens ever sold from the bonding curve
    const newSoldSupply = (tradeType === 'BUY') 
      ? currentSoldSupply + tokenAmountBig 
      : currentSoldSupply; // Don't change on sells
    
    const currentPrice = calculateTokenPrice(ethAmountBig, tokenAmountBig);
    
    // FIXED: Market cap should use circulating supply (soldSupply), not newSoldSupply for sells
    const circulatingSupply = newSoldSupply;
    const marketCap = circulatingSupply > 0n 
      ? (circulatingSupply * BigInt(ethers.parseEther(currentPrice))) / BigInt(ethers.parseEther("1"))
      : 0n;
    
    // FIXED: Volume should always be positive (use absolute value)
    const newVolumeTotal = (currentVolumeTotal + (ethAmountBig > 0n ? ethAmountBig : -ethAmountBig)).toString();

    await prisma.token.update({
      where: { address: tokenAddress },
      data: {
        soldSupply: newSoldSupply.toString(),
        volumeTotal: newVolumeTotal,
        marketCap: marketCap.toString(),
        updatedAt: timestamp
      }
    });

    // Update 24h and 7d volumes (simplified - in production use time windows)
    await updateTokenVolumeWindows(tokenAddress, ethAmount, timestamp);

    // Update holder count
    await updateTokenHolderCount(tokenAddress);

    // Get updated token data
    const updatedToken = await prisma.token.findUnique({
      where: { address: tokenAddress }
    });

    if (updatedToken) {
      return {
        price: currentPrice,
        volume24h: updatedToken.volume24h,
        volume7d: updatedToken.volume7d,
        volumeTotal: updatedToken.volumeTotal,
        marketCap: updatedToken.marketCap,
        holderCount: updatedToken.holderCount,
        soldSupply: updatedToken.soldSupply
      };
    }

    return null;

  } catch (error) {
    console.error(`Error updating token stats for ${tokenAddress}:`, error);
    throw error;
  }
}

async function updateTokenVolumeWindows(
  tokenAddress: string,
  ethAmount: string,
  timestamp: Date
): Promise<void> {
  // This is a simplified implementation
  // In production, you'd calculate rolling windows properly
  
  const ethAmountBig = BigInt(ethAmount);
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  try {
    // Calculate 24h volume
    const trades24h = await prisma.trade.findMany({
      where: {
        tokenAddress,
        timestamp: { gte: oneDayAgo }
      }
    });

    const volume24h = trades24h.reduce((sum, trade) => {
      // FIXED: Use absolute values to ensure volume is always positive
      const tradeVolume = BigInt(trade.type === TradeType.BUY ? trade.amountIn : trade.amountOut);
      return sum + (tradeVolume > 0n ? tradeVolume : -tradeVolume);
    }, 0n);

    // Calculate 7d volume
    const trades7d = await prisma.trade.findMany({
      where: {
        tokenAddress,
        timestamp: { gte: sevenDaysAgo }
      }
    });

    const volume7d = trades7d.reduce((sum, trade) => {
      // FIXED: Use absolute values to ensure volume is always positive
      const tradeVolume = BigInt(trade.type === TradeType.BUY ? trade.amountIn : trade.amountOut);
      return sum + (tradeVolume > 0n ? tradeVolume : -tradeVolume);
    }, 0n);

    await prisma.token.update({
      where: { address: tokenAddress },
      data: {
        volume24h: volume24h.toString(),
        volume7d: volume7d.toString(),
        updatedAt: timestamp
      }
    });

  } catch (error) {
    console.error(`Error updating volume windows for ${tokenAddress}:`, error);
  }
}

async function updateTokenHolderCount(tokenAddress: string): Promise<void> {
  try {
    const holderCount = await prisma.holder.count({
      where: { 
        tokenAddress,
        balance: { gt: "0" }
      }
    });

    await prisma.token.update({
      where: { address: tokenAddress },
      data: { holderCount: holderCount }
    });

  } catch (error) {
    console.error(`Error updating holder count for ${tokenAddress}:`, error);
  }
}

async function updatePlatformTradeStats(
  ethAmount: string,
  feeAmount: string,
  timestamp: Date
): Promise<void> {
  const today = new Date(timestamp.getFullYear(), timestamp.getMonth(), timestamp.getDate());
  
  try {
    // First find existing stats
    const existingStats = await prisma.platformStats.findUnique({
      where: { date: today }
    });

    if (existingStats) {
      // Calculate new values
      const currentTotalVolume = BigInt(existingStats.totalVolume);
      const currentTotalFees = BigInt(existingStats.totalFees);
      const currentVolume24h = BigInt(existingStats.volume24h);
      const currentFees24h = BigInt(existingStats.fees24h);
      
      // FIXED: Use absolute values to ensure volume is always positive
      const ethAmountValue = BigInt(ethAmount);
      const feeAmountValue = BigInt(feeAmount);
      const newTotalVolume = currentTotalVolume + (ethAmountValue > 0n ? ethAmountValue : -ethAmountValue);
      const newTotalFees = currentTotalFees + (feeAmountValue > 0n ? feeAmountValue : -feeAmountValue);
      const newVolume24h = currentVolume24h + (ethAmountValue > 0n ? ethAmountValue : -ethAmountValue);
      const newFees24h = currentFees24h + (feeAmountValue > 0n ? feeAmountValue : -feeAmountValue);

      await prisma.platformStats.update({
        where: { date: today },
        data: {
          totalTrades: existingStats.totalTrades + 1,
          totalVolume: newTotalVolume.toString(),
          totalFees: newTotalFees.toString(),
          volume24h: newVolume24h.toString(),
          fees24h: newFees24h.toString(),
          updatedAt: new Date()
        }
      });
    } else {
      // Create new stats
      await prisma.platformStats.create({
        data: {
          date: today,
          totalTokens: 0,
          totalTrades: 1,
          totalVolume: ethAmount,
          totalFees: feeAmount,
          activeTraders: 0,
          newTokens24h: 0,
          volume24h: ethAmount,
          fees24h: feeAmount,
          migratedTokens: 0,
          totalHolders: 0
        }
      });
    }

  } catch (error) {
    console.error('Error updating platform trade stats:', error);
  }
}

async function updatePriceData(
  tokenAddress: string,
  price: string,
  volume: string,
  timestamp: Date
): Promise<void> {
  // This is a simplified implementation for 1-hour intervals
  // In production, you'd handle multiple intervals and proper OHLCV data
  
  const hourTimestamp = new Date(
    timestamp.getFullYear(),
    timestamp.getMonth(),
    timestamp.getDate(),
    timestamp.getHours(),
    0, 0, 0
  );

  try {
    // Check if price data exists
    const existingPriceData = await prisma.priceData.findUnique({
      where: {
        tokenAddress_timestamp_interval: {
          tokenAddress,
          timestamp: hourTimestamp,
          interval: 'HOUR_1'
        }
      }
    });

    if (existingPriceData) {
      // Update existing data
      const currentVolume = BigInt(existingPriceData.volume);
      const newVolume = currentVolume + BigInt(volume);
      const currentHigh = parseFloat(existingPriceData.high);
      const currentLow = parseFloat(existingPriceData.low);
      const priceFloat = parseFloat(price);

      await prisma.priceData.update({
        where: {
          tokenAddress_timestamp_interval: {
            tokenAddress,
            timestamp: hourTimestamp,
            interval: 'HOUR_1'
          }
        },
        data: {
          close: price,
          high: priceFloat > currentHigh ? price : existingPriceData.high,
          low: priceFloat < currentLow ? price : existingPriceData.low,
          volume: newVolume.toString(),
          volumeUsd: "0" // Would calculate USD value
        }
      });
    } else {
      // Create new price data
      await prisma.priceData.create({
        data: {
          tokenAddress,
          timestamp: hourTimestamp,
          interval: 'HOUR_1',
          open: price,
          high: price,
          low: price,
          close: price,
          volume,
          volumeUsd: "0"
        }
      });
    }

  } catch (error) {
    console.error(`Error updating price data for ${tokenAddress}:`, error);
  }
}