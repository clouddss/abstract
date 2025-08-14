import { useInfiniteQuery } from '@tanstack/react-query'
import { tokensService } from '@/lib/api/services/tokens.service'
import { GetTokensParams } from '@/lib/api/types/token.types'
import { useMemo } from 'react'

// Hook for infinite scrolling tokens
export function useInfiniteTokens(params?: Omit<GetTokensParams, 'page'>) {
  const limit = params?.limit || 20
  
  const query = useInfiniteQuery({
    queryKey: ['tokens', 'infinite', params],
    queryFn: ({ pageParam = 1 }) => 
      tokensService.getTokens({ ...params, page: pageParam, limit }),
    getNextPageParam: (lastPage) => {
      const { page, pages } = lastPage.pagination
      return page < pages ? page + 1 : undefined
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
    retry: 3,
  })
  
  // Flatten all tokens from all pages
  const tokens = useMemo(() => {
    return query.data?.pages.flatMap(page => page.tokens) || []
  }, [query.data])
  
  // Calculate total count
  const totalCount = query.data?.pages[0]?.pagination.total || 0
  
  return {
    tokens,
    totalCount,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    refetch: query.refetch,
  }
}

// Hook for infinite scrolling trending tokens
export function useInfiniteTrendingTokens(limit: number = 20) {
  return useInfiniteTokens({ sort: 'volume', order: 'desc', limit })
}

// Hook for infinite scrolling recent tokens
export function useInfiniteRecentTokens(limit: number = 20) {
  return useInfiniteTokens({ sort: 'created', order: 'desc', limit })
}

// Hook for infinite scrolling tokens by creator
export function useInfiniteTokensByCreator(creator: string | undefined, limit: number = 20) {
  return useInfiniteTokens({ creator, limit })
}

// Hook for infinite scrolling search results
export function useInfiniteSearchTokens(search: string | undefined, limit: number = 20) {
  return useInfiniteTokens({ search, limit })
}