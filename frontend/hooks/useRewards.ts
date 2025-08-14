import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { rewardsService } from '@/lib/api/services/rewards.service'
import { 
  GetRewardsParams,
  GetRewardsResponse,
  ClaimRewardsRequest,
  ClaimRewardsResponse,
  GetEpochsParams,
  GetEpochsResponse,
  EpochDetails,
  GetRewardLeaderboardParams,
  GetRewardLeaderboardResponse
} from '@/lib/api/types/reward.types'
import { Address } from '@/lib/api/types/common.types'

// Hook for fetching user rewards
export function useRewards(wallet: Address | undefined, params?: GetRewardsParams) {
  return useQuery<GetRewardsResponse, Error>({
    queryKey: ['rewards', wallet, params],
    queryFn: () => rewardsService.getRewards(wallet!, params),
    enabled: !!wallet,
    staleTime: 1000 * 60 * 2, // 2 minutes
    retry: 3,
    retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
}

// Hook for fetching unclaimed rewards
export function useUnclaimedRewards(wallet: Address | undefined, params?: Omit<GetRewardsParams, 'claimed'>) {
  return useQuery<GetRewardsResponse, Error>({
    queryKey: ['rewards', 'unclaimed', wallet, params],
    queryFn: () => rewardsService.getUnclaimedRewards(wallet!, params),
    enabled: !!wallet,
    staleTime: 1000 * 60 * 2, // 2 minutes
    retry: 3,
  })
}

// Hook for fetching claimed rewards
export function useClaimedRewards(wallet: Address | undefined, params?: Omit<GetRewardsParams, 'claimed'>) {
  return useQuery<GetRewardsResponse, Error>({
    queryKey: ['rewards', 'claimed', wallet, params],
    queryFn: () => rewardsService.getClaimedRewards(wallet!, params),
    enabled: !!wallet,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 3,
  })
}

// Hook for claiming rewards
export function useClaimRewards() {
  const queryClient = useQueryClient()
  
  return useMutation<ClaimRewardsResponse, Error, ClaimRewardsRequest>({
    mutationFn: (data) => rewardsService.claimRewards(data),
    onSuccess: () => {
      // Invalidate all rewards queries since claiming affects data
      queryClient.invalidateQueries({ 
        queryKey: ['rewards'] 
      })
      // Invalidate leaderboard as rankings might change
      queryClient.invalidateQueries({ 
        queryKey: ['rewards', 'leaderboard'] 
      })
    },
    retry: 1,
  })
}

// Hook for fetching epochs
export function useEpochs(params?: GetEpochsParams) {
  return useQuery<GetEpochsResponse, Error>({
    queryKey: ['rewards', 'epochs', params],
    queryFn: () => rewardsService.getEpochs(params),
    staleTime: 1000 * 60 * 10, // 10 minutes
    retry: 3,
  })
}

// Hook for fetching epoch details
export function useEpochDetails(epochNumber: number | undefined) {
  return useQuery<EpochDetails, Error>({
    queryKey: ['rewards', 'epoch', epochNumber],
    queryFn: () => rewardsService.getEpochDetails(epochNumber!),
    enabled: epochNumber !== undefined,
    staleTime: 1000 * 60 * 10, // 10 minutes
    retry: 3,
  })
}

// Hook for fetching current epoch
export function useCurrentEpoch() {
  return useQuery<EpochDetails | null, Error>({
    queryKey: ['rewards', 'epoch', 'current'],
    queryFn: () => rewardsService.getCurrentEpoch(),
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 3,
  })
}

// Hook for fetching rewards leaderboard
export function useRewardsLeaderboard(params?: GetRewardLeaderboardParams) {
  return useQuery<GetRewardLeaderboardResponse, Error>({
    queryKey: ['rewards', 'leaderboard', params],
    queryFn: () => rewardsService.getLeaderboard(params),
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 3,
  })
}

// Hook for checking if user has unclaimed rewards
export function useHasUnclaimedRewards(wallet: Address | undefined) {
  return useQuery<boolean, Error>({
    queryKey: ['rewards', 'hasUnclaimed', wallet],
    queryFn: () => rewardsService.hasUnclaimedRewards(wallet!),
    enabled: !!wallet,
    staleTime: 1000 * 60 * 2, // 2 minutes
    retry: 3,
  })
}

// Hook for fetching total rewards earned
export function useTotalRewards(wallet: Address | undefined) {
  return useQuery<{ eth: string; usdc: string }, Error>({
    queryKey: ['rewards', 'total', wallet],
    queryFn: () => rewardsService.getTotalRewards(wallet!),
    enabled: !!wallet,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 3,
  })
}

// Hook for prefetching rewards
export function usePrefetchRewards() {
  const queryClient = useQueryClient()
  
  return (wallet: Address, params?: GetRewardsParams) => {
    return queryClient.prefetchQuery({
      queryKey: ['rewards', wallet, params],
      queryFn: () => rewardsService.getRewards(wallet, params),
      staleTime: 1000 * 60 * 2, // 2 minutes
    })
  }
}

// Hook for prefetching epochs
export function usePrefetchEpochs() {
  const queryClient = useQueryClient()
  
  return (params?: GetEpochsParams) => {
    return queryClient.prefetchQuery({
      queryKey: ['rewards', 'epochs', params],
      queryFn: () => rewardsService.getEpochs(params),
      staleTime: 1000 * 60 * 10, // 10 minutes
    })
  }
}