import { useQuery, useQueryClient } from '@tanstack/react-query'
import { statsService } from '@/lib/api/services/stats.service'
import { 
  GetPlatformStatsResponse, 
  GetLeaderboardsResponse, 
  GetChartsResponse,
  ChartMetric 
} from '@/lib/api/types/stats.types'

export function useStats(timeframe: '24h' | '7d' | '30d' = '24h') {
  return useQuery<GetPlatformStatsResponse, Error>({
    queryKey: ['stats', 'platform', timeframe],
    queryFn: () => statsService.getPlatformStats({ timeframe }),
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
}

// Hook for leaderboards
export function useLeaderboards(timeframe: '24h' | '7d' | '30d' = '24h', limit: number = 10) {
  return useQuery<GetLeaderboardsResponse, Error>({
    queryKey: ['leaderboards', timeframe, limit],
    queryFn: () => statsService.getLeaderboards({ timeframe, limit }),
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
}

// Hook for chart data
export function useChartData(metric: ChartMetric = 'volume', timeframe: '24h' | '7d' | '30d' = '7d') {
  return useQuery<GetChartsResponse, Error>({
    queryKey: ['charts', metric, timeframe],
    queryFn: () => statsService.getChartData({ metric, timeframe }),
    staleTime: 1000 * 60 * 2, // 2 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
}

// Hook for top traders
export function useTopTraders(timeframe: '24h' | '7d' | '30d' = '24h', limit: number = 10) {
  return useQuery({
    queryKey: ['leaderboards', 'traders', timeframe, limit],
    queryFn: () => statsService.getTopTraders(timeframe, limit),
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 3,
  })
}

// Hook for top tokens
export function useTopTokens(timeframe: '24h' | '7d' | '30d' = '24h', limit: number = 10) {
  return useQuery({
    queryKey: ['leaderboards', 'tokens', timeframe, limit],
    queryFn: () => statsService.getTopTokens(timeframe, limit),
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 3,
  })
}

// Hook for top holders
export function useTopHolders(limit: number = 10) {
  return useQuery({
    queryKey: ['leaderboards', 'holders', limit],
    queryFn: () => statsService.getTopHolders(limit),
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 3,
  })
}

// Hook for platform health
export function usePlatformHealth() {
  return useQuery({
    queryKey: ['stats', 'health'],
    queryFn: () => statsService.getPlatformHealth(),
    staleTime: 1000 * 60 * 2, // 2 minutes
    retry: 3,
  })
}

// Hook for all charts data
export function useAllCharts(timeframe: '24h' | '7d' | '30d' = '7d') {
  return useQuery({
    queryKey: ['charts', 'all', timeframe],
    queryFn: () => statsService.getAllCharts(timeframe),
    staleTime: 1000 * 60 * 2, // 2 minutes
    retry: 3,
  })
}

// Hook for prefetching stats
export function usePrefetchStats() {
  const queryClient = useQueryClient()
  
  return (timeframe: '24h' | '7d' | '30d' = '24h') => {
    return queryClient.prefetchQuery({
      queryKey: ['stats', 'platform', timeframe],
      queryFn: () => statsService.getPlatformStats({ timeframe }),
      staleTime: 1000 * 60 * 5, // 5 minutes
    })
  }
}