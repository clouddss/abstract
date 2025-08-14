'use client'

import React from 'react'
import Link from 'next/link'
import { TrendingUp, AlertCircle } from 'lucide-react'
import { useTrendingTokens } from '@/hooks/useTokens'
import { formatETH, formatNumber, calculatePrice } from '@/lib/utils/format'
import { Skeleton } from './ui/skeleton'

export function TrendingTokens() {
  const { data, isLoading, error } = useTrendingTokens(5)

  if (error) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Trending</h3>
          <TrendingUp className="w-5 h-5 text-primary" />
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-gray-500">
          <AlertCircle className="w-12 h-12 mb-3 text-gray-400" />
          <p className="text-sm">Failed to load trending tokens</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-2 text-xs text-primary hover:text-primary/80"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Trending</h3>
        <TrendingUp className="w-5 h-5 text-primary" />
      </div>
      <div className="space-y-3">
        {isLoading ? (
          // Loading skeletons
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-gray-100">
              <div className="flex items-center space-x-3">
                <Skeleton className="w-4 h-4" />
                <Skeleton className="w-8 h-8 rounded-full" />
                <div>
                  <Skeleton className="h-4 w-20 mb-1" />
                  <Skeleton className="h-3 w-12" />
                </div>
              </div>
              <div className="text-right">
                <Skeleton className="h-4 w-12 mb-1 ml-auto" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))
        ) : data?.tokens && data.tokens.length > 0 ? (
          data.tokens.slice(0, 3).map((token, index) => (
          <Link
            key={token.address}
            href={`/token/${token.address}`}
            className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100"
          >
            <div className="flex items-center space-x-3">
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400 w-4">
                {index + 1}
              </span>
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-primary/80 to-emerald-300 flex items-center justify-center">
                {token.imageUrl ? (
                  <img 
                    src={token.imageUrl} 
                    alt={token.name} 
                    className="w-8 h-8 rounded-full object-cover" 
                  />
                ) : (
                  <span className="text-white font-bold text-xs">{token.symbol[0]}</span>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{token.name}</p>
                <p className="text-xs text-gray-500">${token.symbol}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-primary">${calculatePrice(token.marketCap, token.totalSupply)}</p>
              <p className="text-xs text-gray-500">{formatETH(token.volume24h)} ETH</p>
            </div>
          </Link>
        ))
        ) : (
          <div className="text-center py-8 text-gray-500">
            <TrendingUp className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">No trending tokens yet</p>
          </div>
        )}
      </div>
      <Link
        href="/tokens"
        className="block mt-4 text-center text-sm text-primary hover:text-primary/80 font-medium"
      >
        View All Tokens
      </Link>
    </div>
  )
}