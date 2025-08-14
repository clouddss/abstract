import { useQuery, useQueryClient } from '@tanstack/react-query'
import { tokensService } from '@/lib/api/services/tokens.service'
import { statsService } from '@/lib/api/services/stats.service'
import { 
  GetTokenChartParams,
  TokenChartResponse
} from '@/lib/api/types/token.types'
import { 
  GetChartsResponse,
  ChartMetric
} from '@/lib/api/types/stats.types'
import { Address } from '@/lib/api/types/common.types'

// Hook for fetching token price chart data
export function useTokenChart(
  address: Address | undefined, 
  params?: GetTokenChartParams
) {
  const timeframe = params?.timeframe || '24h'
  const interval = params?.interval || '1h'
  
  return useQuery<TokenChartResponse, Error>({
    queryKey: ['chart', 'token', address, timeframe, interval],
    queryFn: () => tokensService.getTokenChart(address!, params),
    enabled: !!address,
    staleTime: 1000 * 60 * 2, // 2 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
}

// Hook for fetching platform chart data (volume, trades, tokens, users)
export function useChart(
  metric: ChartMetric = 'volume', 
  timeframe: '24h' | '7d' | '30d' = '7d'
) {
  return useQuery<GetChartsResponse, Error>({
    queryKey: ['chart', 'platform', metric, timeframe],
    queryFn: () => statsService.getChartData({ metric, timeframe }),
    staleTime: 1000 * 60 * 2, // 2 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
}

// Hook for fetching volume chart
export function useVolumeChart(timeframe: '24h' | '7d' | '30d' = '7d') {
  return useChart('volume', timeframe)
}

// Hook for fetching trades chart
export function useTradesChart(timeframe: '24h' | '7d' | '30d' = '7d') {
  return useChart('trades', timeframe)
}

// Hook for fetching tokens chart
export function useTokensChart(timeframe: '24h' | '7d' | '30d' = '7d') {
  return useChart('tokens', timeframe)
}

// Hook for fetching users chart
export function useUsersChart(timeframe: '24h' | '7d' | '30d' = '7d') {
  return useChart('users', timeframe)
}

// Hook for fetching all platform charts at once
export function useAllCharts(timeframe: '24h' | '7d' | '30d' = '7d') {
  return useQuery({
    queryKey: ['chart', 'platform', 'all', timeframe],
    queryFn: () => statsService.getAllCharts(timeframe),
    staleTime: 1000 * 60 * 2, // 2 minutes
    retry: 3,
  })
}

// Combined hook for token with chart data
export function useTokenWithChart(
  address: Address | undefined,
  chartParams?: GetTokenChartParams
) {
  const token = useQuery({
    queryKey: ['token', address],
    queryFn: () => tokensService.getTokenDetails(address!),
    enabled: !!address,
    staleTime: 1000 * 60 * 2, // 2 minutes
  })
  
  const chart = useTokenChart(address, chartParams)
  
  return {
    token: token.data,
    chart: chart.data,
    isLoading: token.isLoading || chart.isLoading,
    isError: token.isError || chart.isError,
    error: token.error || chart.error,
  }
}

// Hook for prefetching token chart
export function usePrefetchTokenChart() {
  const queryClient = useQueryClient()
  
  return (address: Address, params?: GetTokenChartParams) => {
    const timeframe = params?.timeframe || '24h'
    const interval = params?.interval || '1h'
    
    return queryClient.prefetchQuery({
      queryKey: ['chart', 'token', address, timeframe, interval],
      queryFn: () => tokensService.getTokenChart(address, params),
      staleTime: 1000 * 60 * 2, // 2 minutes
    })
  }
}

// Hook for prefetching platform chart
export function usePrefetchChart() {
  const queryClient = useQueryClient()
  
  return (metric: ChartMetric = 'volume', timeframe: '24h' | '7d' | '30d' = '7d') => {
    return queryClient.prefetchQuery({
      queryKey: ['chart', 'platform', metric, timeframe],
      queryFn: () => statsService.getChartData({ metric, timeframe }),
      staleTime: 1000 * 60 * 2, // 2 minutes
    })
  }
}