import { useQuery } from '@tanstack/react-query'

interface PlatformStats {
  success: boolean
  data: {
    timeframe: string
    overview: {
      totalTokens: number
      totalMigrated: number
      totalTrades: number
      totalVolume: string
      totalFees: string
      uniqueTraders: number
      migrationRate: number
    }
    trending: Array<{
      address: string
      name: string
      symbol: string
      imageUrl?: string
      volume: string
      progress: number
    }>
    recentLaunches: Array<{
      address: string
      name: string
      symbol: string
      imageUrl?: string
      creator: string
      createdAt: string
      progress: number
    }>
    historical?: {
      totalTokensAllTime: number
      totalVolumeAllTime: string
      totalFeesAllTime: string
      totalTradesAllTime: number
    }
  }
}

async function fetchStats(timeframe: string = '24h'): Promise<PlatformStats> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
  const response = await fetch(`${apiUrl}/api/stats/platform?timeframe=${timeframe}`)
  
  if (!response.ok) {
    throw new Error('Failed to fetch platform stats')
  }
  
  return response.json()
}

export function useStats(timeframe: string = '24h') {
  return useQuery({
    queryKey: ['stats', 'platform', timeframe],
    queryFn: () => fetchStats(timeframe),
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

// Hook for leaderboards
export function useLeaderboards(timeframe: string = '24h', limit: number = 10) {
  return useQuery({
    queryKey: ['leaderboards', timeframe, limit],
    queryFn: async () => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      const response = await fetch(`${apiUrl}/api/stats/leaderboards?timeframe=${timeframe}&limit=${limit}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch leaderboards')
      }
      
      return response.json()
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

// Hook for chart data
export function useChartData(metric: string = 'volume', timeframe: string = '7d') {
  return useQuery({
    queryKey: ['charts', metric, timeframe],
    queryFn: async () => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      const response = await fetch(`${apiUrl}/api/stats/charts?metric=${metric}&timeframe=${timeframe}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch chart data')
      }
      
      return response.json()
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  })
}