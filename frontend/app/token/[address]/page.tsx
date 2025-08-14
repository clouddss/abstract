'use client'

import React, { useState } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { TradingInterface } from '@/components/TradingInterface'
import { RecentTrades } from '@/components/RecentTrades'
import { 
  DollarSign, 
  Users, 
  Clock,
  ExternalLink,
  Copy,
  Heart,
  Share2,
  BarChart3,
  Activity,
  Target,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Globe,
  Twitter,
  MessageCircle,
  AlertCircle,
  Loader2
} from 'lucide-react'
import { useToken } from '@/hooks/useTokens'
import { useTokenChart } from '@/hooks/useChart'
import { formatETH, formatAddress, formatNumber, formatTimestamp, calculatePrice, getPriceChangeColor } from '@/lib/utils/format'
import { copyToClipboard, formatError } from '@/lib/utils/ui'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { ChartInterval } from '@/lib/api/types/common.types'

export default function TokenPage() {
  const params = useParams()
  // Ensure the address is properly typed
  const rawAddress = params.address as string
  const tokenAddress = (rawAddress.startsWith('0x') ? rawAddress : `0x${rawAddress}`) as `0x${string}`
  
  const [isLiked, setIsLiked] = useState(false)
  const [chartInterval, setChartInterval] = useState<ChartInterval>(ChartInterval.ONE_DAY)
  
  // Fetch token data
  const { data: token, isLoading, error } = useToken(tokenAddress)
  const { data: chartData, isLoading: chartLoading } = useTokenChart(tokenAddress, { interval: chartInterval })
  
  // Calculate derived values
  const currentPrice = token ? calculatePrice(token.marketCap, token.totalSupply) : '0'

  const handleCopyAddress = async () => {
    const success = await copyToClipboard(tokenAddress)
    if (success) {
      toast.success('Address copied to clipboard')
    } else {
      toast.error('Failed to copy address')
    }
  }
  
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${token?.name} (${token?.symbol})`,
          text: `Check out ${token?.name} on Abstract Protocol!`,
          url: window.location.href
        })
      } catch (err) {
        // User cancelled share
      }
    } else {
      handleCopyAddress()
    }
  }

  if (error) {
    return (
      <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-16">
            <div className="glass-card rounded-lg p-8 max-w-md mx-auto">
              <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Error Loading Token</h3>
              <p className="text-muted-foreground mb-4">{formatError(error)}</p>
              <Button onClick={() => window.history.back()} variant="outline">
                Go Back
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Token Header */}
        <div className="glass-card rounded-lg p-6 mb-8">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="flex items-start space-x-4">
              <div className="relative">
                {token?.imageUrl ? (
                  <img 
                    src={token.imageUrl} 
                    alt={token.name} 
                    className="w-20 h-20 rounded-full object-cover" 
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center">
                    <span className="text-3xl font-bold text-white">
                      {token?.symbol?.charAt(0) || '?'}
                    </span>
                  </div>
                )}
                {token?.migrated && (
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                    <Zap className="w-3 h-3 text-white" />
                  </div>
                )}
              </div>
              <div>
                <div className="flex items-center space-x-3 mb-2">
                  <h1 className="text-3xl font-bold gradient-text">
                    {isLoading ? <Skeleton className="h-8 w-32" /> : token?.name}
                  </h1>
                  <span className="px-3 py-1 bg-primary/10 text-primary text-sm rounded-full font-medium">
                    ${isLoading ? <Skeleton className="h-4 w-16 inline-block" /> : token?.symbol}
                  </span>
                </div>
                {token?.description && (
                  <p className="text-muted-foreground mb-2">{token.description}</p>
                )}
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <span>Created by</span>
                  <span className="font-mono text-primary">
                    {isLoading ? <Skeleton className="h-4 w-24 inline-block" /> : formatAddress(token?.creator || '', 6)}
                  </span>
                  <button onClick={handleCopyAddress}>
                    <Copy className="h-4 w-4 hover:text-foreground transition-colors" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <button
                onClick={() => setIsLiked(!isLiked)}
                className={`p-2 rounded-lg transition-colors ${isLiked ? 'text-red-400 bg-red-400/10' : 'text-muted-foreground hover:text-foreground hover:bg-white/5'}`}
              >
                <Heart className={`h-5 w-5 ${isLiked ? 'fill-current' : ''}`} />
              </button>
              <button className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors">
                <Share2 className="h-5 w-5" />
              </button>
              <div className="flex items-center space-x-2">
                {token?.website && (
                  <a 
                    href={token.website} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                    title="Website"
                  >
                    <Globe className="h-5 w-5" />
                  </a>
                )}
                {token?.twitter && (
                  <a 
                    href={token.twitter} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                    title="Twitter"
                  >
                    <Twitter className="h-5 w-5" />
                  </a>
                )}
                {token?.telegram && (
                  <a 
                    href={token.telegram} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                    title="Telegram"
                  >
                    <MessageCircle className="h-5 w-5" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
          <div className="glass-card rounded-lg p-4">
            <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-1">
              <DollarSign className="h-4 w-4" />
              <span>Price</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xl font-bold">
                {isLoading ? <Skeleton className="h-6 w-20" /> : `$${currentPrice}`}
              </span>
              <span className={`text-sm font-medium flex items-center ${getPriceChangeColor(token?.priceChange24h || 0)}`}>
                {token?.priceChange24h && token.priceChange24h >= 0 ? (
                  <ArrowUpRight className="h-3 w-3 mr-1" />
                ) : (
                  <ArrowDownRight className="h-3 w-3 mr-1" />
                )}
                {isLoading ? <Skeleton className="h-4 w-12" /> : `${Math.abs(token?.priceChange24h || 0).toFixed(2)}%`}
              </span>
            </div>
          </div>

          <div className="glass-card rounded-lg p-4">
            <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-1">
              <Target className="h-4 w-4" />
              <span>Market Cap</span>
            </div>
            <span className="text-xl font-bold">
              {isLoading ? <Skeleton className="h-6 w-24" /> : formatETH(token?.marketCap || '0')} ETH
            </span>
          </div>

          <div className="glass-card rounded-lg p-4">
            <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-1">
              <Activity className="h-4 w-4" />
              <span>Volume 24h</span>
            </div>
            <span className="text-xl font-bold">
              {isLoading ? <Skeleton className="h-6 w-24" /> : formatETH(token?.volume24h || '0')} ETH
            </span>
          </div>

          <div className="glass-card rounded-lg p-4">
            <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-1">
              <Users className="h-4 w-4" />
              <span>Holders</span>
            </div>
            <span className="text-xl font-bold">
              {isLoading ? <Skeleton className="h-6 w-16" /> : formatNumber(token?.holders || 0, 0)}
            </span>
          </div>

          <div className="glass-card rounded-lg p-4">
            <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-1">
              <Zap className="h-4 w-4" />
              <span>Bonding Curve</span>
            </div>
            <span className="text-xl font-bold text-primary">
              {isLoading ? <Skeleton className="h-6 w-16" /> : `${token?.progress.toFixed(1)}%`}
            </span>
          </div>

          <div className="glass-card rounded-lg p-4">
            <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span>Migration</span>
            </div>
            <span className="text-sm font-bold text-yellow-400">
              {isLoading ? <Skeleton className="h-5 w-20" /> : token?.migrated ? 'Migrated' : `${(100 - (token?.progress || 0)).toFixed(1)}% left`}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Chart and Trading */}
          <div className="lg:col-span-2 space-y-6">
            {/* Price Chart */}
            <div className="glass-card rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2 text-primary" />
                  Price Chart
                </h3>
                <div className="flex items-center space-x-2">
                  {[
                    { value: ChartInterval.ONE_HOUR, label: '1h' },
                    { value: ChartInterval.FOUR_HOURS, label: '4h' },
                    { value: ChartInterval.ONE_DAY, label: '1d' },
                    { value: ChartInterval.ONE_WEEK, label: '1w' }
                  ].map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => setChartInterval(value)}
                      className={`px-3 py-1 text-sm rounded-md transition-colors ${
                        chartInterval === value 
                          ? 'bg-primary text-white' 
                          : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="relative h-64">
                {chartLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : chartData && chartData.data.length > 0 ? (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    {/* TODO: Integrate proper charting library like recharts */}
                    <p>Chart visualization coming soon</p>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <p>No chart data available</p>
                  </div>
                )}
              </div>
            </div>

            {/* Bonding Curve Progress */}
            <div className="glass-card rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4 flex items-center">
                <Target className="h-5 w-5 mr-2 text-primary" />
                Bonding Curve Progress
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Progress to DEX Migration</span>
                  <span className="font-semibold">
                    {isLoading ? <Skeleton className="h-4 w-12" /> : `${token?.progress.toFixed(1)}%`}
                  </span>
                </div>
                <div className="w-full bg-secondary rounded-full h-3 overflow-hidden">
                  {!isLoading && (
                    <div 
                      className="progress-bar h-3 rounded-full transition-all duration-500" 
                      style={{ width: `${token?.progress || 0}%` }}
                    />
                  )}
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Current: {isLoading ? <Skeleton className="h-3 w-16 inline-block" /> : formatETH(token?.marketCap || '0')} ETH</span>
                  <span>Target: 100%</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {token?.migrated 
                    ? 'This token has been successfully migrated to DEX.'
                    : 'When the bonding curve reaches 100%, liquidity will be migrated to a DEX pair automatically.'
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Trading Panel and Info */}
          <div className="space-y-6">
            {/* Trading Panel */}
            {!isLoading && token && (
              <TradingInterface
                tokenSymbol={token.symbol}
                tokenAddress={tokenAddress}
                currentPrice={currentPrice}
                bondingCurve={token.bondingCurve}
                className="glass-card"
              />
            )}

            {/* Recent Trades */}
            <RecentTrades tokenAddress={tokenAddress} limit={5} />

            {/* Top Holders */}
            <div className="glass-card rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Users className="h-5 w-5 mr-2 text-primary" />
                Top Holders
              </h3>
              <div className="space-y-3">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Skeleton className="h-4 w-6" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                      <div className="text-right">
                        <Skeleton className="h-4 w-12 mb-1" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                  ))
                ) : token?.topHolders && token.topHolders.length > 0 ? (
                  token.topHolders.slice(0, 5).map((holder, index) => (
                    <div key={holder.address} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <span className="text-sm font-medium">#{index + 1}</span>
                        <span className="text-sm font-mono text-muted-foreground">
                          {formatAddress(holder.address)}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{holder.percentage.toFixed(2)}%</p>
                        <p className="text-xs text-muted-foreground">
                          {formatNumber(holder.balance)}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No holder data available</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}