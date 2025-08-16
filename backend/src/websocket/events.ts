import { EventEmitter } from 'events';
import { wsManager } from './server';
import logger from '../utils/logger';

export interface TokenUpdateEvent {
  address: string;
  price?: string;
  volume24h?: string;
  volume7d?: string;
  volumeTotal?: string;
  marketCap?: string;
  holderCount?: number;
  soldSupply?: string;
  launchpadProgress?: number;
}

export interface TradeEvent {
  id: string;
  tokenAddress: string;
  trader: string;
  type: 'BUY' | 'SELL';
  amountIn: string;
  amountOut: string;
  price: string;
  feeAmount: string;
  txHash: string;
  timestamp: Date;
}

export interface HolderUpdateEvent {
  tokenAddress: string;
  wallet: string;
  balance: string;
  totalBought: string;
  totalSold: string;
  isNewHolder?: boolean;
  isRemovedHolder?: boolean;
}

export interface StatsUpdateEvent {
  totalTrades?: number;
  totalVolume?: string;
  totalFees?: string;
  volume24h?: string;
  fees24h?: string;
  activeTraders?: number;
  totalTokens?: number;
}

export interface RewardClaimedEvent {
  wallet: string;
  amount: string;
  type: string;
  txHash?: string;
  timestamp: Date;
}

export interface NewTokenEvent {
  address: string;
  name: string;
  symbol: string;
  description?: string;
  creator: string;
  fundingGoal: string;
  initialPrice: string;
  totalSupply: string;
  timestamp: Date;
}

class WebSocketEventEmitter extends EventEmitter {
  constructor() {
    super();
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    // Token update events
    this.on('token:update', (data: TokenUpdateEvent) => {
      try {
        wsManager.broadcastTokenUpdate(data.address, data);
        logger.info(`Broadcasted token update for ${data.address}`);
      } catch (error) {
        logger.error('Error broadcasting token update:', error);
      }
    });

    // New token events
    this.on('token:new', (data: NewTokenEvent) => {
      try {
        wsManager.broadcastNewToken(data);
        logger.info(`Broadcasted new token: ${data.address}`);
      } catch (error) {
        logger.error('Error broadcasting new token:', error);
      }
    });

    // Trade events
    this.on('trade:new', (data: TradeEvent) => {
      try {
        wsManager.broadcastNewTrade(data);
        logger.info(`Broadcasted new trade: ${data.id}`);
      } catch (error) {
        logger.error('Error broadcasting new trade:', error);
      }
    });

    // Holder update events
    this.on('holder:update', (data: HolderUpdateEvent) => {
      try {
        wsManager.broadcastHolderUpdate(data.tokenAddress, data);
        logger.info(`Broadcasted holder update for ${data.tokenAddress}`);
      } catch (error) {
        logger.error('Error broadcasting holder update:', error);
      }
    });

    // Price update events
    this.on('price:update', (data: { tokenAddress: string; price: string; volume?: string }) => {
      try {
        wsManager.broadcastPriceUpdate(data.tokenAddress, data);
        logger.info(`Broadcasted price update for ${data.tokenAddress}`);
      } catch (error) {
        logger.error('Error broadcasting price update:', error);
      }
    });

    // Platform stats events
    this.on('stats:update', (data: StatsUpdateEvent) => {
      try {
        wsManager.broadcastStatsUpdate(data);
        logger.info('Broadcasted stats update');
      } catch (error) {
        logger.error('Error broadcasting stats update:', error);
      }
    });

    // Reward claimed events
    this.on('reward:claimed', (data: RewardClaimedEvent) => {
      try {
        wsManager.broadcastRewardClaimed(data.wallet, data);
        logger.info(`Broadcasted reward claimed for ${data.wallet}`);
      } catch (error) {
        logger.error('Error broadcasting reward claimed:', error);
      }
    });

    // Leaderboard update events
    this.on('leaderboard:update', (data: any) => {
      try {
        wsManager.broadcastLeaderboardUpdate(data);
        logger.info('Broadcasted leaderboard update');
      } catch (error) {
        logger.error('Error broadcasting leaderboard update:', error);
      }
    });
  }

  // Convenience methods for emitting events

  public emitTokenUpdate(address: string, updates: Partial<TokenUpdateEvent>) {
    this.emit('token:update', { address, ...updates });
  }

  public emitNewToken(tokenData: NewTokenEvent) {
    this.emit('token:new', tokenData);
  }

  public emitNewTrade(tradeData: TradeEvent) {
    this.emit('trade:new', tradeData);
  }

  public emitHolderUpdate(data: HolderUpdateEvent) {
    this.emit('holder:update', data);
  }

  public emitPriceUpdate(tokenAddress: string, price: string, volume?: string) {
    this.emit('price:update', { tokenAddress, price, volume });
  }

  public emitStatsUpdate(stats: StatsUpdateEvent) {
    this.emit('stats:update', stats);
  }

  public emitRewardClaimed(wallet: string, amount: string, type: string, txHash?: string) {
    this.emit('reward:claimed', {
      wallet,
      amount,
      type,
      txHash,
      timestamp: new Date()
    });
  }

  public emitLeaderboardUpdate(leaderboardData: any) {
    this.emit('leaderboard:update', leaderboardData);
  }
}

export const wsEvents = new WebSocketEventEmitter();