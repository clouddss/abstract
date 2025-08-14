import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tokensService } from '@/lib/api/services/tokens.service'
import { GetTokensParams, GetTokensResponse, TokenDetails } from '@/lib/api/types/token.types'
import { Address } from '@/lib/api/types/common.types'

export function useTokens(params: GetTokensParams = {}) {
  return useQuery<GetTokensResponse, Error>({
    queryKey: ['tokens', params],
    queryFn: () => tokensService.getTokens(params),
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
}

// Hook for fetching a single token
export function useToken(address: Address | undefined) {
  return useQuery<TokenDetails, Error>({
    queryKey: ['token', address],
    queryFn: () => tokensService.getTokenDetails(address!),
    enabled: !!address,
    staleTime: 1000 * 60 * 2, // 2 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
}

// Hook for fetching trending tokens
export function useTrendingTokens(limit: number = 10) {
  return useQuery<GetTokensResponse, Error>({
    queryKey: ['tokens', 'trending', limit],
    queryFn: () => tokensService.getTrendingTokens(limit),
    staleTime: 1000 * 60 * 2, // 2 minutes
    retry: 3,
  })
}

// Hook for fetching recent tokens
export function useRecentTokens(limit: number = 10) {
  return useQuery<GetTokensResponse, Error>({
    queryKey: ['tokens', 'recent', limit],
    queryFn: () => tokensService.getRecentTokens(limit),
    staleTime: 1000 * 60 * 2, // 2 minutes
    retry: 3,
  })
}

// Hook for searching tokens
export function useSearchTokens(query: string, limit: number = 10) {
  return useQuery<GetTokensResponse, Error>({
    queryKey: ['tokens', 'search', query, limit],
    queryFn: () => tokensService.searchTokens(query, limit),
    enabled: !!query && query.length > 0,
    staleTime: 1000 * 60 * 2, // 2 minutes
    retry: 2,
  })
}

// Hook for fetching tokens by creator
export function useTokensByCreator(creator: Address | undefined, params?: Omit<GetTokensParams, 'creator'>) {
  return useQuery<GetTokensResponse, Error>({
    queryKey: ['tokens', 'creator', creator, params],
    queryFn: () => tokensService.getTokensByCreator(creator!, params),
    enabled: !!creator,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 3,
  })
}

// Hook for prefetching tokens
export function usePrefetchTokens() {
  const queryClient = useQueryClient()
  
  return (params: GetTokensParams = {}) => {
    return queryClient.prefetchQuery({
      queryKey: ['tokens', params],
      queryFn: () => tokensService.getTokens(params),
      staleTime: 1000 * 60 * 5, // 5 minutes
    })
  }
}

// Hook for prefetching a single token
export function usePrefetchToken() {
  const queryClient = useQueryClient()
  
  return (address: Address) => {
    return queryClient.prefetchQuery({
      queryKey: ['token', address],
      queryFn: () => tokensService.getTokenDetails(address),
      staleTime: 1000 * 60 * 2, // 2 minutes
    })
  }
}