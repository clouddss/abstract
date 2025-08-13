import { ethers } from 'ethers';
import { prisma } from '../database/client';
import { appConfig, contractAddresses } from '../config';
import {
  provider,
  getLogs,
  getCurrentBlock,
  LAUNCH_FACTORY_ABI,
  BONDING_CURVE_ABI,
  PLATFORM_ROUTER_ABI,
  REWARDS_VAULT_ABI
} from './ethereum';
import { handleTokenLaunched, handleTokenMigrated } from './handlers/tokenLaunched';
import { handleTokensPurchased, handleTokensSold } from './handlers/trades';

class BlockchainIndexer {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {
    this.setupGracefulShutdown();
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('🚫 Indexer is already running');
      return;
    }

    console.log('🚀 Starting blockchain indexer...');
    console.log(`📡 RPC URL: ${appConfig.ABSTRACT_RPC_URL}`);
    console.log(`⏱️  Interval: ${appConfig.INDEXER_INTERVAL_MS}ms`);
    console.log(`📦 Batch size: ${appConfig.INDEXER_BATCH_SIZE}`);

    this.isRunning = true;

    // Initial sync
    await this.performSync();

    // Start periodic sync
    this.intervalId = setInterval(async () => {
      try {
        await this.performSync();
      } catch (error) {
        console.error('❌ Error in periodic sync:', error);
      }
    }, appConfig.INDEXER_INTERVAL_MS);

    console.log('✅ Indexer started successfully');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    console.log('🛑 Stopping indexer...');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    console.log('✅ Indexer stopped');
  }

  private async performSync(): Promise<void> {
    try {
      const currentBlock = await getCurrentBlock();
      console.log(`🔄 Syncing to block ${currentBlock}`);

      // Sync each contract type
      await Promise.all([
        this.syncLaunchFactory(currentBlock),
        this.syncBondingCurves(currentBlock),
        this.syncPlatformRouter(currentBlock),
        this.syncRewardsVault(currentBlock)
      ]);

      console.log(`✅ Sync completed for block ${currentBlock}`);

    } catch (error) {
      console.error('❌ Error in performSync:', error);
      throw error;
    }
  }

  private async syncLaunchFactory(currentBlock: number): Promise<void> {
    if (!contractAddresses.launchFactory) {
      console.log('⚠️  LaunchFactory address not configured, skipping...');
      return;
    }

    try {
      const lastBlock = await this.getLastProcessedBlock('LaunchFactory');
      const fromBlock = Math.max(lastBlock + 1, appConfig.START_BLOCK);
      
      if (fromBlock > currentBlock) return;

      console.log(`📝 Syncing LaunchFactory from block ${fromBlock} to ${currentBlock}`);

      const contract = new ethers.Contract(contractAddresses.launchFactory, LAUNCH_FACTORY_ABI, provider);

      // Get TokenLaunched events
      const tokenLaunchedFilter = contract.filters.TokenLaunched();
      const tokenLaunchedLogs = await getLogs({
        ...tokenLaunchedFilter,
        fromBlock,
        toBlock: currentBlock
      });

      for (const log of tokenLaunchedLogs) {
        await this.processTokenLaunchedLog(contract, log);
      }

      // Get TokenMigrated events
      const tokenMigratedFilter = contract.filters.TokenMigrated();
      const tokenMigratedLogs = await getLogs({
        ...tokenMigratedFilter,
        fromBlock,
        toBlock: currentBlock
      });

      for (const log of tokenMigratedLogs) {
        await this.processTokenMigratedLog(contract, log);
      }

      await this.updateLastProcessedBlock('LaunchFactory', currentBlock);

    } catch (error) {
      console.error('❌ Error syncing LaunchFactory:', error);
      throw error;
    }
  }

  private async syncBondingCurves(currentBlock: number): Promise<void> {
    try {
      // Get all bonding curve addresses from database
      const tokens = await prisma.token.findMany({
        where: { migrated: false },
        select: { bondingCurve: true, address: true }
      });

      for (const token of tokens) {
        await this.syncBondingCurve(token.bondingCurve, token.address, currentBlock);
      }

    } catch (error) {
      console.error('❌ Error syncing bonding curves:', error);
      throw error;
    }
  }

  private async syncBondingCurve(bondingCurveAddress: string, tokenAddress: string, currentBlock: number): Promise<void> {
    try {
      const contractName = `BondingCurve_${bondingCurveAddress}`;
      const lastBlock = await this.getLastProcessedBlock(contractName);
      const fromBlock = Math.max(lastBlock + 1, appConfig.START_BLOCK);
      
      if (fromBlock > currentBlock) return;

      const contract = new ethers.Contract(bondingCurveAddress, BONDING_CURVE_ABI, provider);

      // Get TokensPurchased events
      const purchasedFilter = contract.filters.TokensPurchased();
      const purchasedLogs = await getLogs({
        ...purchasedFilter,
        fromBlock,
        toBlock: currentBlock
      });

      for (const log of purchasedLogs) {
        await this.processTokensPurchasedLog(contract, log, tokenAddress);
      }

      // Get TokensSold events
      const soldFilter = contract.filters.TokensSold();
      const soldLogs = await getLogs({
        ...soldFilter,
        fromBlock,
        toBlock: currentBlock
      });

      for (const log of soldLogs) {
        await this.processTokensSoldLog(contract, log, tokenAddress);
      }

      await this.updateLastProcessedBlock(contractName, currentBlock);

    } catch (error) {
      console.error(`❌ Error syncing bonding curve ${bondingCurveAddress}:`, error);
    }
  }

  private async syncPlatformRouter(currentBlock: number): Promise<void> {
    if (!contractAddresses.platformRouter) {
      console.log('⚠️  PlatformRouter address not configured, skipping...');
      return;
    }

    try {
      const lastBlock = await this.getLastProcessedBlock('PlatformRouter');
      const fromBlock = Math.max(lastBlock + 1, appConfig.START_BLOCK);
      
      if (fromBlock > currentBlock) return;

      console.log(`🔀 Syncing PlatformRouter from block ${fromBlock} to ${currentBlock}`);

      const contract = new ethers.Contract(contractAddresses.platformRouter, PLATFORM_ROUTER_ABI, provider);

      // Get SwapExecuted events
      const swapFilter = contract.filters.SwapExecuted();
      const swapLogs = await getLogs({
        ...swapFilter,
        fromBlock,
        toBlock: currentBlock
      });

      for (const log of swapLogs) {
        await this.processSwapExecutedLog(contract, log);
      }

      await this.updateLastProcessedBlock('PlatformRouter', currentBlock);

    } catch (error) {
      console.error('❌ Error syncing PlatformRouter:', error);
      throw error;
    }
  }

  private async syncRewardsVault(currentBlock: number): Promise<void> {
    if (!contractAddresses.rewardsVault) {
      console.log('⚠️  RewardsVault address not configured, skipping...');
      return;
    }

    try {
      const lastBlock = await this.getLastProcessedBlock('RewardsVault');
      const fromBlock = Math.max(lastBlock + 1, appConfig.START_BLOCK);
      
      if (fromBlock > currentBlock) return;

      console.log(`🎁 Syncing RewardsVault from block ${fromBlock} to ${currentBlock}`);

      const contract = new ethers.Contract(contractAddresses.rewardsVault, REWARDS_VAULT_ABI, provider);

      // Get RewardsDeposited events
      const depositedFilter = contract.filters.RewardsDeposited();
      const depositedLogs = await getLogs({
        ...depositedFilter,
        fromBlock,
        toBlock: currentBlock
      });

      for (const log of depositedLogs) {
        await this.processRewardsDepositedLog(contract, log);
      }

      // Get RewardsClaimed events
      const claimedFilter = contract.filters.RewardsClaimed();
      const claimedLogs = await getLogs({
        ...claimedFilter,
        fromBlock,
        toBlock: currentBlock
      });

      for (const log of claimedLogs) {
        await this.processRewardsClaimedLog(contract, log);
      }

      await this.updateLastProcessedBlock('RewardsVault', currentBlock);

    } catch (error) {
      console.error('❌ Error syncing RewardsVault:', error);
      throw error;
    }
  }

  // Event processing methods
  private async processTokenLaunchedLog(contract: ethers.Contract, log: ethers.Log): Promise<void> {
    try {
      const parsed = contract.interface.parseLog({ topics: log.topics, data: log.data });
      if (!parsed) return;

      await handleTokenLaunched({
        tokenAddress: parsed.args.tokenAddress,
        creator: parsed.args.creator,
        bondingCurve: parsed.args.bondingCurve,
        metadata: parsed.args.metadata,
        blockNumber: log.blockNumber,
        txHash: log.transactionHash,
        logIndex: log.index
      });

    } catch (error) {
      console.error('Error processing TokenLaunched log:', error);
    }
  }

  private async processTokenMigratedLog(contract: ethers.Contract, log: ethers.Log): Promise<void> {
    try {
      const parsed = contract.interface.parseLog({ topics: log.topics, data: log.data });
      if (!parsed) return;

      await handleTokenMigrated({
        tokenAddress: parsed.args.tokenAddress,
        dexPair: parsed.args.dexPair,
        liquidityAmount: parsed.args.liquidityAmount.toString(),
        blockNumber: log.blockNumber,
        txHash: log.transactionHash
      });

    } catch (error) {
      console.error('Error processing TokenMigrated log:', error);
    }
  }

  private async processTokensPurchasedLog(contract: ethers.Contract, log: ethers.Log, tokenAddress: string): Promise<void> {
    try {
      const parsed = contract.interface.parseLog({ topics: log.topics, data: log.data });
      if (!parsed) return;

      await handleTokensPurchased({
        buyer: parsed.args.buyer,
        ethAmount: parsed.args.ethAmount.toString(),
        tokenAmount: parsed.args.tokenAmount.toString(),
        newPrice: parsed.args.newPrice.toString(),
        tokenAddress,
        blockNumber: log.blockNumber,
        txHash: log.transactionHash,
        logIndex: log.index
      });

    } catch (error) {
      console.error('Error processing TokensPurchased log:', error);
    }
  }

  private async processTokensSoldLog(contract: ethers.Contract, log: ethers.Log, tokenAddress: string): Promise<void> {
    try {
      const parsed = contract.interface.parseLog({ topics: log.topics, data: log.data });
      if (!parsed) return;

      await handleTokensSold({
        seller: parsed.args.seller,
        tokenAmount: parsed.args.tokenAmount.toString(),
        ethAmount: parsed.args.ethAmount.toString(),
        newPrice: parsed.args.newPrice.toString(),
        tokenAddress,
        blockNumber: log.blockNumber,
        txHash: log.transactionHash,
        logIndex: log.index
      });

    } catch (error) {
      console.error('Error processing TokensSold log:', error);
    }
  }

  private async processSwapExecutedLog(contract: ethers.Contract, log: ethers.Log): Promise<void> {
    try {
      const parsed = contract.interface.parseLog({ topics: log.topics, data: log.data });
      if (!parsed) return;

      // Handle platform router swaps (for DEX trades after migration)
      console.log(`🔀 DEX swap: ${parsed.args.user} swapped ${parsed.args.amountIn} for ${parsed.args.amountOut}`);

    } catch (error) {
      console.error('Error processing SwapExecuted log:', error);
    }
  }

  private async processRewardsDepositedLog(contract: ethers.Contract, log: ethers.Log): Promise<void> {
    try {
      const parsed = contract.interface.parseLog({ topics: log.topics, data: log.data });
      if (!parsed) return;

      console.log(`🎁 Rewards deposited for epoch ${parsed.args.epoch}: ${parsed.args.ethAmount} ETH, ${parsed.args.usdcAmount} USDC`);

    } catch (error) {
      console.error('Error processing RewardsDeposited log:', error);
    }
  }

  private async processRewardsClaimedLog(contract: ethers.Contract, log: ethers.Log): Promise<void> {
    try {
      const parsed = contract.interface.parseLog({ topics: log.topics, data: log.data });
      if (!parsed) return;

      console.log(`💰 Rewards claimed by ${parsed.args.claimer} for epoch ${parsed.args.epoch}`);

    } catch (error) {
      console.error('Error processing RewardsClaimed log:', error);
    }
  }

  // Database helpers
  private async getLastProcessedBlock(contractName: string): Promise<number> {
    try {
      const state = await prisma.indexerState.findUnique({
        where: { contractName }
      });
      return state?.lastBlock ?? appConfig.START_BLOCK;
    } catch (error) {
      console.error(`Error getting last processed block for ${contractName}:`, error);
      return appConfig.START_BLOCK;
    }
  }

  private async updateLastProcessedBlock(contractName: string, blockNumber: number): Promise<void> {
    try {
      await prisma.indexerState.upsert({
        where: { contractName },
        update: {
          lastBlock: blockNumber,
          synced: true,
          syncedAt: new Date(),
          updatedAt: new Date()
        },
        create: {
          contractName,
          lastBlock: blockNumber,
          synced: true,
          syncedAt: new Date()
        }
      });
    } catch (error) {
      console.error(`Error updating last processed block for ${contractName}:`, error);
    }
  }

  private setupGracefulShutdown(): void {
    process.on('SIGINT', async () => {
      console.log('\n🛑 Received SIGINT. Gracefully shutting down...');
      await this.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n🛑 Received SIGTERM. Gracefully shutting down...');
      await this.stop();
      process.exit(0);
    });
  }
}

// Start indexer if this file is run directly
if (require.main === module) {
  const indexer = new BlockchainIndexer();
  
  indexer.start().catch((error) => {
    console.error('❌ Failed to start indexer:', error);
    process.exit(1);
  });
}

export { BlockchainIndexer };