'use client'

import { useState, useEffect, useMemo } from 'react'
import { useTokens, useSearchTokens } from '@/hooks/useTokens'
import { useStats } from '@/hooks/useStats'
import { TokenCard } from '@/components/TokenCard'
import { Button } from '@/components/ui/Button'
import { 
  Coins, 
  Search, 
  TrendingUp, 
  Clock, 
  DollarSign,
  Target,
  SlidersHorizontal,
  Loader2
} from 'lucide-react'
import { formatUSD, formatNumber, formatETH } from '@/lib/utils/format'
import { debounce } from '@/lib/utils/ui'
import { Skeleton } from '@/components/ui/skeleton'

export default function TokensPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'volume' | 'created' | 'marketCap' | 'holders'>('volume')
  const [filterBy, setFilterBy] = useState<'all' | 'trending' | 'new' | 'migrated'>('all')
  const [showFilters, setShowFilters] = useState(false)
  
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  
  // Debounce search input
  useEffect(() => {
    const handler = debounce(() => {
      setDebouncedSearch(searchTerm)
      setPage(1) // Reset to first page on search
    }, 300)
    
    handler()
  }, [searchTerm])
  
  // Get tokens based on search or regular query
  const { data: tokensData, isLoading, error } = useTokens({ 
    sort: sortBy,
    limit: 20,
    page,
    search: debouncedSearch,
    migrated: filterBy === 'migrated' ? true : undefined
  })
  
  // Get platform stats
  const { data: stats } = useStats()

  const sortOptions = [
    { value: 'volume', label: 'Volume', icon: DollarSign },
    { value: 'created', label: 'Newest', icon: Clock },
    { value: 'marketCap', label: 'Market Cap', icon: Target },
    { value: 'holders', label: 'Holders', icon: TrendingUp }
  ]

  const filterOptions = [
    { value: 'all', label: 'All Tokens' },
    { value: 'trending', label: 'Trending' },
    { value: 'new', label: 'New Launches' },
    { value: 'migrated', label: 'Migrated to DEX' }
  ]

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-4">
            <Coins className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold gradient-text">All Tokens</h1>
          </div>
          <p className="text-xl text-muted-foreground">
            Discover and trade tokens launched on Blast Abstract
          </p>
        </div>

        {/* Search and Filters */}
        <div className="glass-card rounded-lg p-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search Bar */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search tokens by name or symbol..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-secondary border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
            </div>

            {/* Filter Toggle for Mobile */}
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="lg:hidden"
            >
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              Filters
            </Button>

            {/* Sort Dropdown */}
            <div className={`lg:flex gap-2 ${showFilters ? 'flex' : 'hidden'} flex-wrap`}>
              <div className="flex flex-wrap gap-2">
                {sortOptions.map(({ value, label, icon: Icon }) => (
                  <Button
                    key={value}
                    variant={sortBy === value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSortBy(value as any)}
                    className="flex items-center space-x-2"
                  >
                    <Icon className="h-4 w-4" />
                    <span>{label}</span>
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Filter Options */}
          <div className={`${showFilters ? 'block' : 'hidden'} lg:block mt-4 pt-4 border-t border-border`}>
            <div className="flex flex-wrap gap-2">
              {filterOptions.map(({ value, label }) => (
                <Button
                  key={value}
                  variant={filterBy === value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterBy(value as any)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="glass-card rounded-lg p-4">
            <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-1">
              <Coins className="h-4 w-4" />
              <span>Total Tokens</span>
            </div>
            <span className="text-2xl font-bold text-primary">
              {stats?.overview?.totalTokens ? formatNumber(stats.overview.totalTokens, 0) : '0'}
            </span>
          </div>

          <div className="glass-card rounded-lg p-4">
            <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-1">
              <DollarSign className="h-4 w-4" />
              <span>24h Volume</span>
            </div>
            <span className="text-2xl font-bold text-green-400">
              {stats?.overview?.totalVolume ? formatETH(stats.overview.totalVolume) + ' ETH' : '0 ETH'}
            </span>
          </div>

          <div className="glass-card rounded-lg p-4">
            <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-1">
              <Target className="h-4 w-4" />
              <span>Market Cap</span>
            </div>
            <span className="text-2xl font-bold text-blue-400">
              {stats?.overview?.totalVolume ? formatETH(stats.overview.totalVolume) + ' ETH' : '0 ETH'}
            </span>
          </div>

          <div className="glass-card rounded-lg p-4">
            <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              <span>Migrated</span>
            </div>
            <span className="text-2xl font-bold text-yellow-400">
              {stats?.overview?.totalMigrated ? formatNumber(stats.overview.totalMigrated, 0) : '0'}
            </span>
          </div>
        </div>

        {/* Tokens Grid */}
        {isLoading && page === 1 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <TokenCard key={i} token={{} as any} isLoading />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <div className="glass-card rounded-lg p-8 max-w-md mx-auto">
              <div className="text-red-400 text-6xl mb-4">⚠️</div>
              <h3 className="text-xl font-semibold mb-2">Error Loading Tokens</h3>
              <p className="text-muted-foreground mb-4">
                There was an issue loading the token data. Please try again.
              </p>
              <Button onClick={() => window.location.reload()} className="btn-gradient">
                Retry
              </Button>
            </div>
          </div>
        ) : !tokensData?.tokens || tokensData.tokens.length === 0 ? (
          <div className="text-center py-16">
            <div className="glass-card rounded-lg p-8 max-w-md mx-auto">
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-xl font-semibold mb-2">No Tokens Found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm 
                  ? `No tokens match "${searchTerm}". Try adjusting your search.`
                  : 'No tokens available yet. Be the first to launch one!'
                }
              </p>
              <Button asChild className="btn-gradient">
                <a href="/launch">Launch Token</a>
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {tokensData?.tokens?.map((token) => (
                <TokenCard key={token.address} token={token} />
              ))}
            </div>

            {/* Load More */}
            {tokensData?.pagination && page < tokensData.pagination.pages && (
              <div className="text-center mt-12">
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="px-8"
                  onClick={() => setPage(p => p + 1)}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Load More Tokens'
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}