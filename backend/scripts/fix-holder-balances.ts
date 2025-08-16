#!/usr/bin/env npx tsx
/**
 * Script to recalculate holder balances from trade history
 * This fixes the double-counting issue where both the API and indexer were updating balances
 */

import { PrismaClient, TradeType } from '@prisma/client';
import { ethers } from 'ethers';

const prisma = new PrismaClient();

async function fixHolderBalances() {
  console.log('🔧 Starting holder balance recalculation...');
  
  try {
    // Get all unique token addresses
    const tokens = await prisma.token.findMany({
      select: { address: true }
    });
    
    console.log(`Found ${tokens.length} tokens to process`);
    
    for (const token of tokens) {
      console.log(`\n📊 Processing token: ${token.address}`);
      
      // Delete all existing holder records for this token
      const deletedCount = await prisma.holder.deleteMany({
        where: { tokenAddress: token.address }
      });
      console.log(`  Deleted ${deletedCount.count} existing holder records`);
      
      // Get all trades for this token ordered by timestamp
      const trades = await prisma.trade.findMany({
        where: { tokenAddress: token.address },
        orderBy: { timestamp: 'asc' }
      });
      
      console.log(`  Found ${trades.length} trades to process`);
      
      // Track holder balances
      const holderBalances = new Map<string, {
        balance: bigint;
        totalBought: bigint;
        totalSold: bigint;
        firstBoughtAt: Date | null;
        lastActivity: Date;
      }>();
      
      // Process each trade
      for (const trade of trades) {
        const trader = trade.trader.toLowerCase();
        const isBuy = trade.type === TradeType.BUY;
        const tokenAmount = BigInt(isBuy ? trade.amountOut : trade.amountIn);
        
        // Get or create holder data
        let holderData = holderBalances.get(trader) || {
          balance: 0n,
          totalBought: 0n,
          totalSold: 0n,
          firstBoughtAt: null,
          lastActivity: trade.timestamp
        };
        
        // Update balances
        if (isBuy) {
          holderData.balance += tokenAmount;
          holderData.totalBought += tokenAmount;
          if (!holderData.firstBoughtAt) {
            holderData.firstBoughtAt = trade.timestamp;
          }
        } else {
          holderData.balance -= tokenAmount;
          holderData.totalSold += tokenAmount;
        }
        
        holderData.lastActivity = trade.timestamp;
        holderBalances.set(trader, holderData);
      }
      
      // Create holder records for non-zero balances
      let holdersCreated = 0;
      for (const [wallet, data] of holderBalances.entries()) {
        if (data.balance > 0n) {
          await prisma.holder.create({
            data: {
              tokenAddress: token.address,
              wallet,
              balance: data.balance.toString(),
              totalBought: data.totalBought.toString(),
              totalSold: data.totalSold.toString(),
              firstBoughtAt: data.firstBoughtAt,
              lastActivity: data.lastActivity,
              avgHoldTime: 0,
              realizedPnl: '0',
              unrealizedPnl: '0',
              rewardsClaimed: '0'
            }
          });
          holdersCreated++;
        }
      }
      
      console.log(`  Created ${holdersCreated} holder records with non-zero balances`);
      
      // Update token holder count
      await prisma.token.update({
        where: { address: token.address },
        data: { holderCount: holdersCreated }
      });
      
      console.log(`  Updated token holder count to ${holdersCreated}`);
    }
    
    console.log('\n✅ Holder balance recalculation complete!');
    
    // Show summary
    const totalHolders = await prisma.holder.count();
    const totalTokens = await prisma.token.count();
    console.log(`\n📈 Summary:`);
    console.log(`  Total tokens: ${totalTokens}`);
    console.log(`  Total holder records: ${totalHolders}`);
    
  } catch (error) {
    console.error('❌ Error recalculating holder balances:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
fixHolderBalances().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});