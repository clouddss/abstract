/**
 * Example usage of the API client in React hooks
 * This file demonstrates best practices for using the API services
 */

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  tokensService, 
  rewardsService, 
  statsService,
  tradesService,
  handleApiError,
  TokenListItem,
  GetTokensParams,
  Address,
  TradeType,
} from '@/lib/api';

// Example: Fetching tokens with React Query
export function useTokens(params?: GetTokensParams) {
  return useQuery({
    queryKey: ['tokens', params],
    queryFn: () => tokensService.getTokens(params),
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // 1 minute
  });
}

// Example: Fetching a specific token
export function useToken(address: Address) {
  return useQuery({
    queryKey: ['token', address],
    queryFn: () => tokensService.getTokenDetails(address),
    enabled: !!address,
    staleTime: 10 * 1000, // 10 seconds
  });
}

// Example: Creating a token with mutation
export function useCreateToken() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: tokensService.createToken,
    onSuccess: () => {
      // Invalidate tokens list to refetch
      queryClient.invalidateQueries({ queryKey: ['tokens'] });
    },
    onError: (error) => {
      const message = handleApiError(error);
      console.error('Failed to create token:', message);
      // Handle error (show toast, etc.)
    },
  });
}

// Example: Trading with optimistic updates
export function useTrade() {
  const queryClient = useQueryClient();
  const [isEstimating, setIsEstimating] = useState(false);
  
  const estimateTrade = useCallback(async (
    tokenAddress: Address,
    type: TradeType,
    amountIn: string
  ) => {
    setIsEstimating(true);
    try {
      const estimate = await tradesService.estimateTrade({
        tokenAddress,
        type,
        amountIn,
      });
      return estimate;
    } catch (error) {
      console.error('Trade estimation failed:', handleApiError(error));
      throw error;
    } finally {
      setIsEstimating(false);
    }
  }, []);
  
  const executeTrade = useMutation({
    mutationFn: tradesService.executeTrade,
    onMutate: async (variables) => {
      // Optimistic update
      const previousToken = queryClient.getQueryData(['token', variables.tokenAddress]);
      
      // Update token data optimistically
      queryClient.setQueryData(['token', variables.tokenAddress], (old: any) => {
        if (!old) return old;
        
        // Update based on trade type
        if (variables.type === TradeType.BUY) {
          return {
            ...old,
            soldSupply: (BigInt(old.soldSupply) + BigInt(variables.amountIn)).toString(),
            volume24h: (BigInt(old.volume24h) + BigInt(variables.amountIn)).toString(),
          };
        }
        
        return old;
      });
      
      return { previousToken };
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousToken) {
        queryClient.setQueryData(['token', variables.tokenAddress], context.previousToken);
      }
      console.error('Trade execution failed:', handleApiError(error));
    },
    onSuccess: (data) => {
      // Monitor trade status
      tradesService.monitorTradeStatus(data.txHash, (status) => {
        console.log('Trade status:', status);
        if (status.status === 'success') {
          // Invalidate relevant queries
          queryClient.invalidateQueries({ queryKey: ['token', status.trade?.tokenAddress] });
          queryClient.invalidateQueries({ queryKey: ['user-trades'] });
        }
      });
    },
  });
  
  return {
    estimateTrade,
    executeTrade: executeTrade.mutate,
    isEstimating,
    isExecuting: executeTrade.isPending,
  };
}

// Example: Fetching rewards with pagination
export function useRewards(wallet: Address | undefined) {
  const [page, setPage] = useState(1);
  const limit = 20;
  
  const query = useQuery({
    queryKey: ['rewards', wallet, page, limit],
    queryFn: () => rewardsService.getRewards(wallet!, { page, limit }),
    enabled: !!wallet,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  
  const hasNextPage = query.data 
    ? page < query.data.pagination.pages 
    : false;
  
  const hasPreviousPage = page > 1;
  
  return {
    ...query,
    page,
    setPage,
    hasNextPage,
    hasPreviousPage,
    nextPage: () => hasNextPage && setPage(p => p + 1),
    previousPage: () => hasPreviousPage && setPage(p => p - 1),
  };
}

// Example: Platform stats with real-time updates
export function usePlatformStats(timeframe: '24h' | '7d' | '30d' = '24h') {
  const query = useQuery({
    queryKey: ['platform-stats', timeframe],
    queryFn: () => statsService.getPlatformStats({ timeframe }),
    refetchInterval: 30 * 1000, // 30 seconds for real-time feel
  });
  
  // Calculate percentage changes
  const stats = query.data?.overview;
  const historical = query.data?.historical;
  
  const volumeChange = stats && historical
    ? ((parseFloat(stats.totalVolume) - parseFloat(historical.totalVolumeAllTime)) / parseFloat(historical.totalVolumeAllTime)) * 100
    : 0;
  
  return {
    ...query,
    volumeChange,
    isPositive: volumeChange > 0,
  };
}

// Example: Complex data fetching with dependencies
export function useTokenWithChart(address: Address) {
  const tokenQuery = useQuery({
    queryKey: ['token', address],
    queryFn: () => tokensService.getTokenDetails(address),
    enabled: !!address,
  });
  
  const chartQuery = useQuery({
    queryKey: ['token-chart', address, '1h'],
    queryFn: () => tokensService.getTokenChart(address, { interval: ChartInterval.ONE_HOUR }),
    enabled: !!address && tokenQuery.isSuccess,
  });
  
  const tradesQuery = useQuery({
    queryKey: ['token-trades', address],
    queryFn: () => tokensService.getTokenTrades(address, { limit: 10 }),
    enabled: !!address && tokenQuery.isSuccess,
  });
  
  return {
    token: tokenQuery.data,
    chart: chartQuery.data,
    trades: tradesQuery.data,
    isLoading: tokenQuery.isLoading || chartQuery.isLoading || tradesQuery.isLoading,
    error: tokenQuery.error || chartQuery.error || tradesQuery.error,
  };
}

// Example: Polling for updates
export function useRealtimeTrades(tokenAddress: Address | undefined) {
  return useQuery({
    queryKey: ['realtime-trades', tokenAddress],
    queryFn: () => tokensService.getTokenTrades(tokenAddress!, { limit: 20 }),
    enabled: !!tokenAddress,
    refetchInterval: 5000, // Poll every 5 seconds
    refetchIntervalInBackground: true,
  });
}

// Example: Prefetching data
export function usePrefetchToken() {
  const queryClient = useQueryClient();
  
  const prefetchToken = useCallback((address: Address) => {
    queryClient.prefetchQuery({
      queryKey: ['token', address],
      queryFn: () => tokensService.getTokenDetails(address),
      staleTime: 10 * 1000,
    });
  }, [queryClient]);
  
  return prefetchToken;
}

// Example: Error handling with retry
export function useTokensWithRetry(params?: GetTokensParams) {
  const [retryCount, setRetryCount] = useState(0);
  
  const query = useQuery({
    queryKey: ['tokens', params, retryCount],
    queryFn: () => tokensService.getTokens(params),
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    onError: (error) => {
      console.error('Failed to fetch tokens:', handleApiError(error));
    },
  });
  
  const manualRetry = useCallback(() => {
    setRetryCount(c => c + 1);
  }, []);
  
  return {
    ...query,
    manualRetry,
  };
}

// Example: Infinite scroll pagination
export function useInfiniteTokens(params?: Omit<GetTokensParams, 'page' | 'limit'>) {
  const limit = 20;
  const [tokens, setTokens] = useState<TokenListItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  const initialQuery = useQuery({
    queryKey: ['infinite-tokens', params, 1],
    queryFn: () => tokensService.getTokens({ ...params, page: 1, limit }),
    onSuccess: (data) => {
      setTokens(data.tokens);
      setHasMore(data.pagination.page < data.pagination.pages);
    },
  });
  
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore) return;
    
    setIsLoadingMore(true);
    try {
      const nextPage = page + 1;
      const data = await tokensService.getTokens({ ...params, page: nextPage, limit });
      
      setTokens(prev => [...prev, ...data.tokens]);
      setPage(nextPage);
      setHasMore(nextPage < data.pagination.pages);
    } catch (error) {
      console.error('Failed to load more tokens:', handleApiError(error));
    } finally {
      setIsLoadingMore(false);
    }
  }, [page, hasMore, isLoadingMore, params]);
  
  return {
    tokens,
    hasMore,
    loadMore,
    isLoading: initialQuery.isLoading,
    isLoadingMore,
    error: initialQuery.error,
  };
}