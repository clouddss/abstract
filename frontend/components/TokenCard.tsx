import React from 'react'
import Link from 'next/link'
import { Button } from './ui/Button'
import { 
  TrendingUp, 
  Users, 
  DollarSign, 
  ExternalLink,
  Zap,
  Star,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle
} from 'lucide-react'
import { TokenListItem } from '@/lib/api/types/token.types'
import { formatETH, formatAddress, formatNumber, calculatePrice, formatPrice, getPriceChangeColor } from '@/lib/utils/format'
import { Skeleton } from './ui/skeleton'

interface TokenCardProps {
  token: TokenListItem
  isLoading?: boolean
}

export function TokenCard({ token, isLoading = false }: TokenCardProps) {
  // Calculate current price from market cap and supply
  const currentPrice = calculatePrice(token.marketCap, token.totalSupply)
  
  // Calculate price change - will be 0 if not provided by API
  const priceChange24h = 0 // TODO: Add price change when API provides it
  const getProgressColor = (progress: number) => {
    if (progress < 25) return 'from-red-400 to-orange-400'
    if (progress < 50) return 'from-orange-400 to-yellow-400'
    if (progress < 75) return 'from-yellow-400 to-green-400'
    return 'from-green-400 to-emerald-400'
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-gray-100">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Skeleton className="w-14 h-14 rounded-full" />
            <div>
              <Skeleton className="h-5 w-24 mb-2" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
          <Skeleton className="h-9 w-20" />
        </div>
        <Skeleton className="h-24 w-full mb-4" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl p-6 group hover:shadow-lg transition-all duration-300 relative overflow-hidden border border-gray-100">
      {/* Hover effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-green-50/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                {token.imageUrl ? (
                  <img 
                    src={token.imageUrl} 
                    alt={token.name} 
                    className="w-14 h-14 rounded-full object-cover" 
                  />
                ) : (
                  <span className="text-white font-bold text-xl">{token.symbol[0]}</span>
                )}
              </div>
              {token.progress >= 90 && (
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center">
                  <Star className="w-3 h-3 text-black" />
                </div>
              )}
            </div>
            <div>
              <h3 className="font-bold text-lg text-gray-900 group-hover:text-primary transition-all">
                {token.name}
              </h3>
              <p className="text-sm text-gray-600 font-medium">${token.symbol}</p>
              <div className="flex items-center space-x-2 mt-1">
                <span className={`font-semibold text-primary ${
                  currentPrice.length > 12 ? 'text-xs' : 'text-sm'
                }`}>${formatPrice(currentPrice)}</span>
                <span className={`text-xs font-medium flex items-center ${getPriceChangeColor(priceChange24h)}`}>
                  {priceChange24h >= 0 ? (
                    <ArrowUpRight className="w-3 h-3 mr-1" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3 mr-1" />
                  )}
                  {Math.abs(priceChange24h).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
          <Button size="sm" asChild className="bg-primary hover:bg-primary/90 text-white opacity-90 group-hover:opacity-100 transition-opacity">
            <Link href={`/token/${token.address}`}>
              <ExternalLink className="w-4 h-4 mr-2" />
              Trade
            </Link>
          </Button>
        </div>

        {/* Bonding Curve Progress */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center space-x-2">
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-gray-600">Bonding Curve</span>
            </div>
            <span className="text-sm font-bold text-primary">{token.progress.toFixed(1)}%</span>
          </div>
          <div className="relative w-full bg-gray-100 rounded-full h-3 overflow-hidden">
            <div 
              className={`bg-gradient-to-r ${getProgressColor(token.progress)} h-3 rounded-full transition-all duration-500 relative`}
              style={{ width: `${token.progress}%` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
            </div>
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>Launch</span>
            <span>{token.migrated ? 'Migrated!' : 'DEX Migration'}</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-gray-50 rounded-lg p-3 group-hover:bg-gray-100 transition-colors">
            <div className="flex items-center space-x-2 mb-1">
              <DollarSign className="w-4 h-4 text-green-400" />
              <span className="text-xs text-gray-600">Market Cap</span>
            </div>
            <p className="font-bold text-sm text-primary">
              {formatETH(token.marketCap)} ETH
            </p>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-3 group-hover:bg-gray-100 transition-colors">
            <div className="flex items-center space-x-2 mb-1">
              <TrendingUp className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-gray-600">24h Volume</span>
            </div>
            <p className="font-bold text-sm text-gray-900">
              {formatETH(token.volume24h)} ETH
            </p>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-3 group-hover:bg-gray-100 transition-colors">
            <div className="flex items-center space-x-2 mb-1">
              <Users className="w-4 h-4 text-purple-400" />
              <span className="text-xs text-gray-600">Holders</span>
            </div>
            <p className="font-bold text-sm text-gray-900">{formatNumber(token.holders, 0)}</p>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-3 group-hover:bg-gray-100 transition-colors">
            <div className="flex items-center space-x-2 mb-1">
              <span className="text-xs text-gray-600">Creator</span>
            </div>
            <p className="font-bold text-xs font-mono text-gray-500">
              {formatAddress(token.creator)}
            </p>
          </div>
        </div>

        {/* Description */}
        {token.description && (
          <div className="pt-4 border-t border-border">
            <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
              {token.description}
            </p>
          </div>
        )}

        {/* Status badges */}
        <div className="flex items-center justify-between mt-4">
          <div className="flex space-x-2">
            {token.migrated && (
              <span className="px-2 py-1 bg-green-500/10 text-green-400 text-xs rounded-full font-medium">
                Migrated
              </span>
            )}
            {token.progress >= 90 && !token.migrated && (
              <span className="px-2 py-1 bg-yellow-500/10 text-yellow-400 text-xs rounded-full font-medium">
                Near Migration
              </span>
            )}
            {parseFloat(token.volume24h) > parseFloat('1000000000000000000') && (
              <span className="px-2 py-1 bg-blue-500/10 text-blue-400 text-xs rounded-full font-medium">
                High Volume
              </span>
            )}
          </div>
          
          {/* Quick action button */}
          <Button 
            size="sm" 
            variant="outline" 
            asChild 
            className="opacity-0 group-hover:opacity-100 transition-all duration-300 text-xs"
          >
            <Link href={`/token/${token.address}`}>
              View Details
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}