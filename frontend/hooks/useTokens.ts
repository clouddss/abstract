import { useQuery } from '@tanstack/react-query'

interface Token {
  address: string
  name: string
  symbol: string
  description?: string
  imageUrl?: string
  website?: string
  twitter?: string
  telegram?: string
  creator: string
  bondingCurve: string
  migrated: boolean
  migratedAt?: string
  dexPair?: string
  totalSupply: string
  soldSupply: string
  marketCap: string
  volume24h: string
  volume7d: string
  volumeTotal: string
  holders: number
  trades: number
  createdAt: string
  progress: number
}

interface TokensResponse {
  success: boolean
  data: {
    tokens: Token[]
    pagination: {
      page: number
      limit: number
      total: number
      pages: number
    }
  }
}

interface UseTokensParams {
  page?: number
  limit?: number
  sort?: 'created' | 'volume' | 'marketCap' | 'holders'
  order?: 'asc' | 'desc'
  creator?: string
  migrated?: boolean
  search?: string
}

async function fetchTokens(params: UseTokensParams): Promise<TokensResponse> {
  const searchParams = new URLSearchParams()
  
  if (params.page) searchParams.set('page', params.page.toString())
  if (params.limit) searchParams.set('limit', params.limit.toString())
  if (params.sort) searchParams.set('sort', params.sort)
  if (params.order) searchParams.set('order', params.order)
  if (params.creator) searchParams.set('creator', params.creator)
  if (params.migrated !== undefined) searchParams.set('migrated', params.migrated.toString())
  if (params.search) searchParams.set('search', params.search)

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
  const response = await fetch(`${apiUrl}/api/tokens?${searchParams}`)
  
  if (!response.ok) {
    throw new Error('Failed to fetch tokens')
  }
  
  return response.json()
}

export function useTokens(params: UseTokensParams = {}) {
  return useQuery({
    queryKey: ['tokens', params],
    queryFn: () => fetchTokens(params),
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

// Hook for fetching a single token
export function useToken(address: string) {
  return useQuery({
    queryKey: ['token', address],
    queryFn: async () => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      const response = await fetch(`${apiUrl}/api/tokens/${address}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch token')
      }
      
      return response.json()
    },
    enabled: !!address,
    staleTime: 1000 * 60 * 2, // 2 minutes
  })
}