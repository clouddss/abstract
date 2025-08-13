import React from 'react'
import Link from 'next/link'
import { Button } from './ui/Button'

interface Token {
  address: string
  name: string
  symbol: string
  description?: string
  imageUrl?: string
  creator: string
  progress: number
  volume24h: string
  holders: number
  marketCap: string
}

interface TokenCardProps {
  token: Token
}

export function TokenCard({ token }: TokenCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-400 to-pink-400 flex items-center justify-center">
            {token.imageUrl ? (
              <img src={token.imageUrl} alt={token.name} className="w-12 h-12 rounded-full" />
            ) : (
              <span className="text-white font-bold text-lg">{token.symbol[0]}</span>
            )}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">{token.name}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">${token.symbol}</p>
          </div>
        </div>
        <Button size="sm" asChild>
          <Link href={`/token/${token.address}`}>
            Trade
          </Link>
        </Button>
      </div>

      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-600 dark:text-gray-300">Bonding Curve Progress</span>
          <span className="text-sm font-medium">{token.progress.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div 
            className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${token.progress}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-gray-600 dark:text-gray-300">Market Cap</p>
          <p className="font-medium">{parseFloat(token.marketCap).toFixed(4)} ETH</p>
        </div>
        <div>
          <p className="text-gray-600 dark:text-gray-300">24h Volume</p>
          <p className="font-medium">{parseFloat(token.volume24h).toFixed(4)} ETH</p>
        </div>
        <div>
          <p className="text-gray-600 dark:text-gray-300">Holders</p>
          <p className="font-medium">{token.holders}</p>
        </div>
        <div>
          <p className="text-gray-600 dark:text-gray-300">Creator</p>
          <p className="font-medium text-xs">{token.creator.slice(0, 6)}...{token.creator.slice(-4)}</p>
        </div>
      </div>

      {token.description && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
            {token.description}
          </p>
        </div>
      )}
    </div>
  )
}