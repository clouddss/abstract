import { apiClient } from '../client';
import {
  GetRewardsParams,
  GetRewardsResponse,
  ClaimRewardsRequest,
  ClaimRewardsResponse,
  GetEpochsParams,
  GetEpochsResponse,
  EpochDetails,
  GetRewardLeaderboardParams,
  GetRewardLeaderboardResponse,
} from '../types/reward.types';
import { Address } from '../types/common.types';

export class RewardsService {
  private static instance: RewardsService;
  
  private constructor() {}

  public static getInstance(): RewardsService {
    if (!RewardsService.instance) {
      RewardsService.instance = new RewardsService();
    }
    return RewardsService.instance;
  }

  /**
   * Get claimable and claimed rewards for a wallet
   */
  async getRewards(wallet: Address, params?: GetRewardsParams): Promise<GetRewardsResponse> {
    return apiClient.get<GetRewardsResponse>(`/rewards/${wallet}`, { params });
  }

  /**
   * Get unclaimed rewards for a wallet
   */
  async getUnclaimedRewards(wallet: Address, params?: Omit<GetRewardsParams, 'claimed'>): Promise<GetRewardsResponse> {
    return this.getRewards(wallet, { ...params, claimed: false });
  }

  /**
   * Get claimed rewards for a wallet
   */
  async getClaimedRewards(wallet: Address, params?: Omit<GetRewardsParams, 'claimed'>): Promise<GetRewardsResponse> {
    return this.getRewards(wallet, { ...params, claimed: true });
  }

  /**
   * Submit a reward claim with merkle proof
   */
  async claimRewards(data: ClaimRewardsRequest): Promise<ClaimRewardsResponse> {
    return apiClient.post<ClaimRewardsResponse>('/rewards/claim', data);
  }

  /**
   * Get all reward epochs
   */
  async getEpochs(params?: GetEpochsParams): Promise<GetEpochsResponse> {
    return apiClient.get<GetEpochsResponse>('/rewards/epochs', { params });
  }

  /**
   * Get detailed information about a specific epoch
   */
  async getEpochDetails(epochNumber: number): Promise<EpochDetails> {
    return apiClient.get<EpochDetails>(`/rewards/epochs/${epochNumber}`);
  }

  /**
   * Get the current active epoch
   */
  async getCurrentEpoch(): Promise<EpochDetails | null> {
    const { epochs } = await this.getEpochs({ limit: 1 });
    if (epochs.length === 0) return null;
    
    const latestEpoch = epochs[0];
    const now = new Date();
    const endTime = new Date(latestEpoch.endTime);
    
    // If the latest epoch hasn't ended yet, it's the current one
    if (now < endTime) {
      return this.getEpochDetails(latestEpoch.epochNumber);
    }
    
    return null;
  }

  /**
   * Get rewards leaderboard
   */
  async getLeaderboard(params?: GetRewardLeaderboardParams): Promise<GetRewardLeaderboardResponse> {
    return apiClient.get<GetRewardLeaderboardResponse>('/rewards/leaderboard', { params });
  }

  /**
   * Check if a wallet has any unclaimed rewards
   */
  async hasUnclaimedRewards(wallet: Address): Promise<boolean> {
    const { summary } = await this.getRewards(wallet, { limit: 1, claimed: false });
    return parseFloat(summary.unclaimedEth) > 0 || parseFloat(summary.unclaimedUsdc) > 0;
  }

  /**
   * Get total rewards earned by a wallet
   */
  async getTotalRewards(wallet: Address): Promise<{ eth: string; usdc: string }> {
    const { summary } = await this.getRewards(wallet, { limit: 1 });
    return {
      eth: summary.totalEth,
      usdc: summary.totalUsdc,
    };
  }

  /**
   * Generate claim signature for a reward
   * This would typically involve signing a message with the user's wallet
   */
  async generateClaimSignature(
    epochNumber: number,
    ethAmount: string,
    usdcAmount: string,
    merkleProof: string[]
  ): Promise<string> {
    // This is a placeholder - in a real implementation, this would:
    // 1. Create a structured message with the claim details
    // 2. Request signature from the user's wallet
    // 3. Return the signature
    
    // For now, we'll throw an error indicating this needs to be implemented
    throw new Error('Claim signature generation not implemented. This should be handled by the wallet integration.');
  }
}

// Export singleton instance
export const rewardsService = RewardsService.getInstance();