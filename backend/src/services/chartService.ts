import { PrismaClient, Interval, Trade } from '@prisma/client';
import { ethers } from 'ethers';

const prisma = new PrismaClient();

interface OHLCV {
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

export class ChartService {
  private static instance: ChartService;

  private constructor() {}

  static getInstance(): ChartService {
    if (!ChartService.instance) {
      ChartService.instance = new ChartService();
    }
    return ChartService.instance;
  }

  /**
   * Generate chart data from trades for a specific token
   */
  async generateChartDataFromTrades(tokenAddress: string, interval: Interval = Interval.HOUR_1) {
    try {
      // Get all trades for the token
      const trades = await prisma.trade.findMany({
        where: { tokenAddress: tokenAddress.toLowerCase() },
        orderBy: { timestamp: 'asc' }
      });

      if (trades.length === 0) {
        console.log(`No trades found for token ${tokenAddress}`);
        return;
      }

      // Group trades by interval
      const intervals = this.groupTradesByInterval(trades, interval);
      
      // Generate OHLCV data for each interval
      const chartData = [];
      for (const [intervalStart, intervalTrades] of intervals) {
        const ohlcv = this.calculateOHLCV(intervalTrades);
        
        chartData.push({
          tokenAddress: tokenAddress.toLowerCase(),
          interval,
          timestamp: new Date(intervalStart),
          open: ohlcv.open,
          high: ohlcv.high,
          low: ohlcv.low,
          close: ohlcv.close,
          volume: ohlcv.volume,
          trades: intervalTrades.length
        });
      }

      // Upsert chart data
      for (const data of chartData) {
        await prisma.priceData.upsert({
          where: {
            tokenAddress_timestamp_interval: {
              tokenAddress: data.tokenAddress,
              timestamp: data.timestamp,
              interval: data.interval
            }
          },
          update: {
            open: data.open,
            high: data.high,
            low: data.low,
            close: data.close,
            volume: data.volume,
            volumeUsd: "0" // Would calculate USD value in production
          },
          create: {
            tokenAddress: data.tokenAddress,
            timestamp: data.timestamp,
            interval: data.interval,
            open: data.open,
            high: data.high,
            low: data.low,
            close: data.close,
            volume: data.volume,
            volumeUsd: "0" // Would calculate USD value in production
          }
        });
      }

      console.log(`Generated ${chartData.length} chart data points for ${tokenAddress}`);
      return chartData;
    } catch (error) {
      console.error('Error generating chart data:', error);
      throw error;
    }
  }

  /**
   * Group trades by time interval
   */
  private groupTradesByInterval(trades: Trade[], interval: Interval): Map<number, Trade[]> {
    const grouped = new Map<number, Trade[]>();
    
    const intervalMs = this.getIntervalMilliseconds(interval);
    
    for (const trade of trades) {
      const timestamp = trade.timestamp.getTime();
      const intervalStart = Math.floor(timestamp / intervalMs) * intervalMs;
      
      if (!grouped.has(intervalStart)) {
        grouped.set(intervalStart, []);
      }
      grouped.get(intervalStart)!.push(trade);
    }
    
    return grouped;
  }

  /**
   * Calculate OHLCV from trades in an interval
   */
  private calculateOHLCV(trades: Trade[]): OHLCV {
    if (trades.length === 0) {
      return { open: '0', high: '0', low: '0', close: '0', volume: '0' };
    }

    // Sort trades by timestamp
    trades.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Calculate prices from trades
    const prices = trades.map(trade => {
      // Price = amountIn / amountOut for buys, amountOut / amountIn for sells
      const amountIn = BigInt(trade.amountIn);
      const amountOut = BigInt(trade.amountOut);
      
      if (trade.type === 'BUY') {
        // ETH in / tokens out = price per token in ETH
        return Number(ethers.formatEther(amountIn)) / Number(ethers.formatEther(amountOut));
      } else {
        // ETH out / tokens in = price per token in ETH
        return Number(ethers.formatEther(amountOut)) / Number(ethers.formatEther(amountIn));
      }
    });

    // Calculate volume (total ETH traded)
    const volume = trades.reduce((sum, trade) => {
      const ethAmount = trade.type === 'BUY' ? BigInt(trade.amountIn) : BigInt(trade.amountOut);
      return sum + ethAmount;
    }, BigInt(0));

    return {
      open: prices[0].toString(),
      high: Math.max(...prices).toString(),
      low: Math.min(...prices).toString(),
      close: prices[prices.length - 1].toString(),
      volume: ethers.formatEther(volume)
    };
  }

  /**
   * Get interval duration in milliseconds
   */
  private getIntervalMilliseconds(interval: Interval): number {
    const intervals: Record<Interval, number> = {
      [Interval.MINUTE_1]: 60 * 1000,
      [Interval.MINUTE_5]: 5 * 60 * 1000,
      [Interval.MINUTE_15]: 15 * 60 * 1000,
      [Interval.HOUR_1]: 60 * 60 * 1000,
      [Interval.HOUR_4]: 4 * 60 * 60 * 1000,
      [Interval.DAY_1]: 24 * 60 * 60 * 1000,
      [Interval.WEEK_1]: 7 * 24 * 60 * 60 * 1000
    };
    
    return intervals[interval];
  }

  /**
   * Update chart data when a new trade occurs
   */
  async updateChartDataForTrade(trade: Trade) {
    try {
      const intervals = [
        Interval.MINUTE_1,
        Interval.MINUTE_5,
        Interval.MINUTE_15,
        Interval.HOUR_1,
        Interval.HOUR_4,
        Interval.DAY_1,
        Interval.WEEK_1
      ];

      for (const interval of intervals) {
        await this.updateIntervalData(trade, interval);
      }
    } catch (error) {
      console.error('Error updating chart data for trade:', error);
    }
  }

  /**
   * Update a specific interval with new trade data
   */
  private async updateIntervalData(trade: Trade, interval: Interval) {
    const intervalMs = this.getIntervalMilliseconds(interval);
    const timestamp = trade.timestamp.getTime();
    const intervalStart = new Date(Math.floor(timestamp / intervalMs) * intervalMs);

    // Calculate trade price
    const amountIn = BigInt(trade.amountIn);
    const amountOut = BigInt(trade.amountOut);
    const price = trade.type === 'BUY' 
      ? Number(ethers.formatEther(amountIn)) / Number(ethers.formatEther(amountOut))
      : Number(ethers.formatEther(amountOut)) / Number(ethers.formatEther(amountIn));
    
    const ethVolume = trade.type === 'BUY' ? amountIn : amountOut;

    // Check if interval data exists
    const existing = await prisma.priceData.findUnique({
      where: {
        tokenAddress_timestamp_interval: {
          tokenAddress: trade.tokenAddress,
          timestamp: intervalStart,
          interval
        }
      }
    });

    if (existing) {
      // Update existing interval
      const newHigh = Math.max(parseFloat(existing.high), price);
      const newLow = Math.min(parseFloat(existing.low), price);
      const newVolume = BigInt(ethers.parseEther(existing.volume)) + ethVolume;

      await prisma.priceData.update({
        where: {
          tokenAddress_timestamp_interval: {
            tokenAddress: trade.tokenAddress,
            timestamp: intervalStart,
            interval
          }
        },
        data: {
          high: newHigh.toString(),
          low: newLow.toString(),
          close: price.toString(),
          volume: ethers.formatEther(newVolume),
          volumeUsd: "0" // Would calculate USD value in production
        }
      });
    } else {
      // Create new interval
      await prisma.priceData.create({
        data: {
          tokenAddress: trade.tokenAddress,
          interval,
          timestamp: intervalStart,
          open: price.toString(),
          high: price.toString(),
          low: price.toString(),
          close: price.toString(),
          volume: ethers.formatEther(ethVolume),
          volumeUsd: "0" // Would calculate USD value in production
        }
      });
    }
  }

  /**
   * Generate initial chart data for all tokens
   */
  async generateAllTokenCharts() {
    try {
      const tokens = await prisma.token.findMany({
        select: { address: true }
      });

      console.log(`Generating charts for ${tokens.length} tokens...`);

      for (const token of tokens) {
        await this.generateChartDataFromTrades(token.address);
      }

      console.log('Chart generation complete');
    } catch (error) {
      console.error('Error generating all charts:', error);
    }
  }

  /**
   * Clean up old chart data
   */
  async cleanupOldData(daysToKeep: number = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const deleted = await prisma.priceData.deleteMany({
      where: {
        timestamp: {
          lt: cutoffDate
        }
      }
    });

    console.log(`Deleted ${deleted.count} old chart data points`);
    return deleted.count;
  }
}

export const chartService = ChartService.getInstance();