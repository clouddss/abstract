import { Address, PaginationParams, PaginationResponse } from './common.types';

// Reward distribution
export interface RewardDistribution {
  id: string;
  epochNumber: number;
  tokenAddress: Address;
  tokenName: string;
  tokenSymbol: string;
  tokenImage?: string;
  ethAmount: string;
  usdcAmount: string;
  weight: string;
  claimed: boolean;
  claimedAt?: string;
  txHash?: string;
  epoch: {
    startTime: string;
    endTime: string;
    claimDeadline?: string;
    finalized: boolean;
  };
}

// Get rewards
export interface GetRewardsParams extends PaginationParams {
  claimed?: boolean;
}

export interface RewardsSummary {
  totalEth: string;
  totalUsdc: string;
  claimedEth: string;
  claimedUsdc: string;
  unclaimedEth: string;
  unclaimedUsdc: string;
}

export interface GetRewardsResponse {
  rewards: RewardDistribution[];
  summary: RewardsSummary;
  pagination: PaginationResponse;
}

// Claim rewards
export interface ClaimRewardsRequest {
  epochNumber: number;
  ethAmount: string;
  usdcAmount: string;
  merkleProof: string[];
  signature: string;
}

export interface ClaimRewardsResponse {
  epochNumber: number;
  ethAmount: string;
  usdcAmount: string;
  estimatedGas: string;
}

// Reward epochs
export interface RewardEpoch {
  epochNumber: number;
  startTime: string;
  endTime: string;
  totalEthRewards: string;
  totalUsdcRewards: string;
  merkleRoot?: string;
  snapshotTaken: boolean;
  finalized: boolean;
  claimDeadline?: string;
  totalDistributions: number;
  createdAt: string;
}

export interface GetEpochsParams extends PaginationParams {}

export interface GetEpochsResponse {
  epochs: RewardEpoch[];
  pagination: PaginationResponse;
}

// Epoch details
export interface EpochDistribution {
  wallet: Address;
  tokenAddress: Address;
  tokenName: string;
  tokenSymbol: string;
  tokenImage?: string;
  ethAmount: string;
  usdcAmount: string;
  weight: string;
  claimed: boolean;
  claimedAt?: string;
}

export interface EpochStats {
  totalDistributions: number;
  totalClaimedDistributions: number;
  totalUnclaimedDistributions: number;
  claimRate: number;
}

export interface EpochDetails extends RewardEpoch {
  distributions: EpochDistribution[];
  stats: EpochStats;
}

// Rewards leaderboard
export interface RewardLeaderboardEntry {
  rank: number;
  wallet: Address;
  totalEthRewards: string;
  totalUsdcRewards: string;
  totalClaims: number;
}

export interface GetRewardLeaderboardParams {
  timeframe?: '24h' | '7d' | '30d' | 'all';
  limit?: number;
}

export interface GetRewardLeaderboardResponse {
  timeframe: string;
  leaderboard: RewardLeaderboardEntry[];
}