import { useQuery, useQueryClient } from '@tanstack/react-query'
import { statsService } from '@/lib/api/services/stats.service'
import { rewardsService } from '@/lib/api/services/rewards.service'
import { 
  GetLeaderboardsResponse,
  GetLeaderboardsParams
} from '@/lib/api/types/stats.types'
import {
  GetRewardLeaderboardResponse,
  GetRewardLeaderboardParams
} from '@/lib/api/types/reward.types'

// Hook for fetching all leaderboards (traders, tokens, holders)
export function useLeaderboard(params?: GetLeaderboardsParams) {
  const timeframe = params?.timeframe || '24h'
  const limit = params?.limit || 10
  
  return useQuery<GetLeaderboardsResponse, Error>({
    queryKey: ['leaderboard', 'all', timeframe, limit],
    queryFn: () => statsService.getLeaderboards(params),
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 3,
    retryDelay: (attemptIndex: number ) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
}

// Hook for fetching top traders leaderboard
export function useTopTradersLeaderboard(timeframe: '24h' | '7d' | '30d' = '24h', limit: number = 10) {
  return useQuery({
    queryKey: ['leaderboard', 'traders', timeframe, limit],
    queryFn: () => statsService.getTopTraders(timeframe, limit),
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 3,
  })
}

// Hook for fetching top tokens leaderboard
export function useTopTokensLeaderboard(timeframe: '24h' | '7d' | '30d' = '24h', limit: number = 10) {
  return useQuery({
    queryKey: ['leaderboard', 'tokens', timeframe, limit],
    queryFn: () => statsService.getTopTokens(timeframe, limit),
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 3,
  })
}

// Hook for fetching top holders leaderboard
export function useTopHoldersLeaderboard(limit: number = 10) {
  return useQuery({
    queryKey: ['leaderboard', 'holders', limit],
    queryFn: () => statsService.getTopHolders(limit),
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 3,
  })
}

// Hook for fetching rewards leaderboard
export function useRewardsLeaderboard(params?: GetRewardLeaderboardParams) {
  return useQuery<GetRewardLeaderboardResponse, Error>({
    queryKey: ['leaderboard', 'rewards', params],
    queryFn: () => rewardsService.getLeaderboard(params),
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 3,
  })
}

// Combined hook for all leaderboard data
export function useAllLeaderboards(timeframe: '24h' | '7d' | '30d' = '24h', limit: number = 10) {
  const leaderboards = useLeaderboard({ timeframe, limit })
  const rewards = useRewardsLeaderboard({ timeframe, limit })
  
  return {
    traders: leaderboards.data?.topTraders,
    tokens: leaderboards.data?.topTokens,
    holders: leaderboards.data?.topHolders,
    rewards: rewards.data?.leaderboard,
    isLoading: leaderboards.isLoading || rewards.isLoading,
    isError: leaderboards.isError || rewards.isError,
    error: leaderboards.error || rewards.error,
  }
}

// Hook for prefetching leaderboard data
export function usePrefetchLeaderboard() {
  const queryClient = useQueryClient()
  
  return (params?: GetLeaderboardsParams) => {
    return queryClient.prefetchQuery({
      queryKey: ['leaderboard', 'all', params?.timeframe || '24h', params?.limit || 10],
      queryFn: () => statsService.getLeaderboards(params),
      staleTime: 1000 * 60 * 5, // 5 minutes
    })
  }
}

// Hook for prefetching rewards leaderboard
export function usePrefetchRewardsLeaderboard() {
  const queryClient = useQueryClient()
  
  return (params?: GetRewardLeaderboardParams) => {
    return queryClient.prefetchQuery({
      queryKey: ['leaderboard', 'rewards', params],
      queryFn: () => rewardsService.getLeaderboard(params),
      staleTime: 1000 * 60 * 5, // 5 minutes
    })
  }
}