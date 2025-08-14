import React from 'react'
import Link from 'next/link'
import { Activity, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react'
import { useTrades } from '@/hooks/useTrades'
import { formatETH, formatAddress, formatTimestamp } from '@/lib/utils/format'
import { Skeleton } from './ui/skeleton'

interface RecentTradesProps {
  tokenAddress?: string
  limit?: number
}

export function RecentTrades({ tokenAddress, limit = 5 }: RecentTradesProps) {
  const { data, isLoading, error } = useTrades({
    tokenAddress,
    limit,
    sort: 'timestamp',
    order: 'desc'
  })

  if (error) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Recent Trades</h3>
          <Activity className="w-5 h-5 text-primary" />
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-gray-500">
          <AlertCircle className="w-12 h-12 mb-3 text-gray-400" />
          <p className="text-sm">Failed to load trades</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Recent Trades</h3>
        <Activity className="w-5 h-5 text-primary" />
      </div>
      <div className="space-y-3">
        {isLoading ? (
          // Loading skeletons
          Array.from({ length: limit }).map((_, i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-gray-100">
              <div className="flex items-center space-x-3">
                <Skeleton className="w-2 h-2 rounded-full" />
                <div>
                  <Skeleton className="h-4 w-24 mb-1" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
          ))
        ) : data?.trades && data.trades.length > 0 ? (
          data.trades.map((trade) => (
            <div
              key={trade.id}
              className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className={`w-2 h-2 rounded-full ${
                  trade.type === 'buy' ? 'bg-green-500' : 'bg-red-500'
                }`} />
                <div>
                  <p className="text-sm font-medium text-gray-900 flex items-center">
                    {trade.type === 'buy' ? (
                      <>
                        <TrendingUp className="w-3 h-3 mr-1 text-green-500" />
                        Bought
                      </>
                    ) : (
                      <>
                        <TrendingDown className="w-3 h-3 mr-1 text-red-500" />
                        Sold
                      </>
                    )}
                    {' '}
                    {formatETH(trade.amountOut)} tokens
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatAddress(trade.trader)} • {formatTimestamp(trade.timestamp)}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{formatETH(trade.amountIn)} ETH</p>
                <p className="text-xs text-gray-500">${trade.price}</p>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Activity className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">No trades yet</p>
          </div>
        )}
      </div>
      {data?.trades && data.trades.length > 0 && (
        <Link
          href={tokenAddress ? `/token/${tokenAddress}/trades` : '/trades'}
          className="block mt-4 text-center text-sm text-primary hover:text-primary/80 font-medium"
        >
          View All Trades
        </Link>
      )}
    </div>
  )
}