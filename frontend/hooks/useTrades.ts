import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tradesService } from '@/lib/api/services/trades.service'
import { tokensService } from '@/lib/api/services/tokens.service'
import { 
  EstimateTradeRequest,
  EstimateTradeResponse,
  ExecuteTradeRequest,
  ExecuteTradeResponse,
  TradeStatus,
  GetUserTradesParams,
  GetUserTradesResponse
} from '@/lib/api/services/trades.service'
import { 
  GetTokenTradesParams,
  TokenTradesResponse,
  TokenTrade  
} from '@/lib/api/types/token.types'
import { Address } from '@/lib/api/types/common.types'
import { useEffect, useState } from 'react'

// General hook for fetching trades (token trades or all recent trades)
export function useTrades(params?: {
  tokenAddress?: `0x${string}`;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}) {
  return useQuery<{ trades: TokenTrade[] }, Error>({
    queryKey: ['trades', params],
    queryFn: async () => {
      if (params?.tokenAddress) {
        // Fetch trades for specific token
        const response = await tokensService.getTokenTrades(params.tokenAddress, {
          limit: params.limit || 20,
          page: 1
        });
        return { trades: response.trades };
      } else {
        // Fetch recent trades across all tokens
        // This would need a new API endpoint for all recent trades
        // For now, we'll return empty array or mock data
        return { trades: [] };
      }
    },
    staleTime: 1000 * 30, // 30 seconds for recent trades
    retry: 3,
  })
}

// Hook for estimating trade output
export function useEstimateTrade(data: EstimateTradeRequest | undefined) {
  return useQuery<EstimateTradeResponse, Error>({
    queryKey: ['trades', 'estimate', data],
    queryFn: () => tradesService.estimateTrade(data!),
    enabled: !!data && !!data.tokenAddress && !!data.amountIn && parseFloat(data.amountIn) > 0,
    staleTime: 1000 * 10, // 10 seconds - trade estimates change quickly
    retry: 2,
  })
}

// Hook for executing trades
export function useExecuteTrade() {
  const queryClient = useQueryClient()
  
  return useMutation<ExecuteTradeResponse, Error, ExecuteTradeRequest>({
    mutationFn: (data) => tradesService.executeTrade(data),
    onSuccess: (_, variables: ExecuteTradeRequest) => {
      // Invalidate user trades
      queryClient.invalidateQueries({ 
        queryKey: ['trades', 'user'] 
      })
      // Invalidate token data as price/volume might have changed
      queryClient.invalidateQueries({ 
        queryKey: ['token', variables.tokenAddress] 
      })
      // Invalidate token trades
      queryClient.invalidateQueries({ 
        queryKey: ['trades', 'token', variables.tokenAddress] 
      })
      // Force refetch of all trades queries
      queryClient.invalidateQueries({ 
        queryKey: ['trades']
      })
    },
    retry: 1,
  })
}

// Hook for monitoring trade status
export function useTradeStatus(txHash: string | undefined, enabled: boolean = true) {
  const [status, setStatus] = useState<TradeStatus | null>(null)
  const [isMonitoring, setIsMonitoring] = useState(false)
  const queryClient = useQueryClient()
  
  useEffect(() => {
    if (!txHash || !enabled) return
    
    setIsMonitoring(true)
    
    const monitor = async () => {
      try {
        const finalStatus = await tradesService.monitorTradeStatus(
          txHash,
          (status: TradeStatus  ) => setStatus(status),
          60, // max 60 attempts
          2000 // 2 second intervals
        )
        setStatus(finalStatus)
        
        // Invalidate queries when trade completes
        if (finalStatus.status === 'success') {
          queryClient.invalidateQueries({ queryKey: ['trades', 'user'] })
          if (finalStatus.trade) {
            queryClient.invalidateQueries({ 
              queryKey: ['token', finalStatus.trade.id] 
            })
            // Also invalidate all trades queries
            queryClient.invalidateQueries({ 
              queryKey: ['trades']
            })
          }
        }
      } catch (error) {
        console.error('Trade monitoring error:', error)
      } finally {
        setIsMonitoring(false)
      }
    }
    
    monitor()
  }, [txHash, enabled, queryClient])
  
  return {
    status,
    isMonitoring,
  }
}

// Hook for fetching user trade history
export function useUserTrades(address: Address | undefined, params?: GetUserTradesParams) {
  return useQuery<GetUserTradesResponse, Error>({
    queryKey: ['trades', 'user', address, params],
    queryFn: () => tradesService.getUserTrades(address!, params),
    enabled: !!address,
    staleTime: 1000 * 60 * 2, // 2 minutes
    retry: 3,
  })
}

// Hook for fetching token trades
export function useTokenTrades(address: Address | undefined, params?: GetTokenTradesParams) {
  return useQuery<TokenTradesResponse, Error>({
    queryKey: ['trades', 'token', address, params],
    queryFn: () => tokensService.getTokenTrades(address!, params),
    enabled: !!address,
    staleTime: 1000 * 60, // 1 minute
    retry: 3,
  })
}

// Hook for real-time token trades with polling
export function useRealtimeTrades(
  tokenAddress: Address | undefined, 
  pollingInterval: number = 5000 // 5 seconds
) {
  return useQuery<TokenTradesResponse, Error>({
    queryKey: ['trades', 'token', tokenAddress, 'realtime'],
    queryFn: () => tokensService.getTokenTrades(tokenAddress!, { limit: 50 }),
    enabled: !!tokenAddress,
    staleTime: 0, // Always fetch fresh data
    refetchInterval: pollingInterval,
    refetchIntervalInBackground: true,
    retry: 2,
  })
}

// Hook for calculating slippage
export function useSlippage(defaultSlippage: number = 0.5) {
  const [slippage, setSlippage] = useState(defaultSlippage)
  
  const calculateMinOutput = (expectedOutput: string) => {
    return tradesService.calculateMinimumOutput(expectedOutput, slippage)
  }
  
  return {
    slippage,
    setSlippage,
    calculateMinOutput,
  }
}

// Hook for trade history with pagination
export function useInfiniteTrades(address: Address | undefined, params?: Omit<GetUserTradesParams, 'page'>) {
  const [page, setPage] = useState(1)
  const limit = params?.limit || 20
  
  const query = useUserTrades(address, { ...params, page, limit })
  
  const loadMore = () => {
    if (query.data && page < query.data.pagination.pages) {
      setPage(page + 1)
    }
  }
  
  const hasMore = query.data ? page < query.data.pagination.pages : false
  
  return {
    ...query,
    loadMore,
    hasMore,
    currentPage: page,
  }
}

// Hook for prefetching trade estimation
export function usePrefetchEstimate() {
  const queryClient = useQueryClient()
  
  return (data: EstimateTradeRequest) => {
    return queryClient.prefetchQuery({
      queryKey: ['trades', 'estimate', data],
      queryFn: () => tradesService.estimateTrade(data),
      staleTime: 1000 * 10, // 10 seconds
    })
  }
}

// Hook for prefetching user trades
export function usePrefetchUserTrades() {
  const queryClient = useQueryClient()
  
  return (address: Address, params?: GetUserTradesParams) => {
    return queryClient.prefetchQuery({
      queryKey: ['trades', 'user', address, params],
      queryFn: () => tradesService.getUserTrades(address, params),
      staleTime: 1000 * 60 * 2, // 2 minutes
    })
  }
}