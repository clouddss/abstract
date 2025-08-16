import { ethers } from 'ethers';
import { prisma } from '../../database/client';
import { getBlockTimestamp } from '../ethereum';
import { wsEvents } from '../../websocket/events';

export interface TokenLaunchedEvent {
  tokenAddress: string;
  creator: string;
  bondingCurve: string;
  metadata: {
    name: string;
    symbol: string;
    description: string;
    imageUrl: string;
    website: string;
    twitter: string;
    telegram: string;
  };
  blockNumber: number;
  txHash: string;
  logIndex: number;
}

export async function handleTokenLaunched(event: TokenLaunchedEvent): Promise<void> {
  try {
    console.log(`🚀 Processing TokenLaunched event for ${event.metadata.name} (${event.metadata.symbol})`);

    const timestamp = await getBlockTimestamp(event.blockNumber);

    // Check if token already exists
    const existingToken = await prisma.token.findUnique({
      where: { address: event.tokenAddress }
    });

    if (existingToken) {
      console.log(`⚠️  Token ${event.tokenAddress} already exists in database`);
      return;
    }

    // Create new token record
    const token = await prisma.token.create({
      data: {
        address: event.tokenAddress,
        name: event.metadata.name,
        symbol: event.metadata.symbol,
        description: event.metadata.description || null,
        imageUrl: event.metadata.imageUrl || null,
        website: event.metadata.website || null,
        twitter: event.metadata.twitter || null,
        telegram: event.metadata.telegram || null,
        creator: event.creator,
        bondingCurve: event.bondingCurve,
        migrated: false,
        totalSupply: "1000000000000000000000000000", // 1B tokens
        curveSupply: "700000000000000000000000000",   // 700M tokens
        soldSupply: "0",
        marketCap: "0",
        volume24h: "0",
        volume7d: "0",
        volumeTotal: "0",
        holderCount: 0,
        createdAt: timestamp,
        updatedAt: timestamp
      }
    });

    // Update platform stats
    await updatePlatformStats(timestamp);

    console.log(`✅ Token ${token.symbol} created successfully`);

    // Emit WebSocket event for new token
    wsEvents.emitNewToken({
      address: token.address,
      name: token.name,
      symbol: token.symbol,
      description: token.description || undefined,
      creator: token.creator,
      fundingGoal: "30000000000000000000", // 30 ETH default funding goal
      initialPrice: "1000000000000000", // 0.001 ETH initial price
      totalSupply: token.totalSupply,
      timestamp
    });

  } catch (error) {
    console.error('❌ Error handling TokenLaunched event:', error);
    throw error;
  }
}

async function updatePlatformStats(date: Date): Promise<void> {
  const today = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  try {
    // Get or create today's stats
    const stats = await prisma.platformStats.upsert({
      where: { date: today },
      update: {
        totalTokens: { increment: 1 },
        newTokens24h: { increment: 1 },
        updatedAt: new Date()
      },
      create: {
        date: today,
        totalTokens: 1,
        newTokens24h: 1,
        totalTrades: 0,
        totalVolume: "0",
        totalFees: "0",
        activeTraders: 0,
        volume24h: "0",
        fees24h: "0",
        migratedTokens: 0,
        totalHolders: 0
      }
    });

    console.log(`📊 Platform stats updated: ${stats.totalTokens} total tokens`);
  } catch (error) {
    console.error('Error updating platform stats:', error);
  }
}

export async function handleTokenMigrated(event: {
  tokenAddress: string;
  dexPair: string;
  liquidityAmount: string;
  blockNumber: number;
  txHash: string;
}): Promise<void> {
  try {
    console.log(`🔄 Processing TokenMigrated event for ${event.tokenAddress}`);

    const timestamp = await getBlockTimestamp(event.blockNumber);

    // Update token record
    const token = await prisma.token.update({
      where: { address: event.tokenAddress },
      data: {
        migrated: true,
        migratedAt: timestamp,
        dexPair: event.dexPair,
        updatedAt: timestamp
      }
    });

    // Update platform stats
    const today = new Date(timestamp.getFullYear(), timestamp.getMonth(), timestamp.getDate());
    await prisma.platformStats.upsert({
      where: { date: today },
      update: {
        migratedTokens: { increment: 1 },
        updatedAt: new Date()
      },
      create: {
        date: today,
        totalTokens: 0,
        totalTrades: 0,
        totalVolume: "0",
        totalFees: "0",
        activeTraders: 0,
        newTokens24h: 0,
        volume24h: "0",
        fees24h: "0",
        migratedTokens: 1,
        totalHolders: 0
      }
    });

    console.log(`✅ Token ${token.symbol} marked as migrated`);

  } catch (error) {
    console.error('❌ Error handling TokenMigrated event:', error);
    throw error;
  }
}