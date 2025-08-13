import React from 'react'
import Link from 'next/link'
import { TrendingUp } from 'lucide-react'

export function TrendingTokens() {
  // Mock data - in real app this would come from API
  const mockTokens = [
    { address: '0x1', name: 'MemeToken', symbol: 'MEME', change: '+12.5%', volume: '45.2 ETH' },
    { address: '0x2', name: 'DegenCoin', symbol: 'DEGEN', change: '+8.3%', volume: '32.1 ETH' },
    { address: '0x3', name: 'PumpToken', symbol: 'PUMP', change: '+6.7%', volume: '28.9 ETH' },
  ]

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Trending</h3>
        <TrendingUp className="w-5 h-5 text-purple-600" />
      </div>
      <div className="space-y-3">
        {mockTokens.map((token, index) => (
          <Link
            key={token.address}
            href={`/token/${token.address}`}
            className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400 w-4">
                {index + 1}
              </span>
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-400 to-pink-400 flex items-center justify-center">
                <span className="text-white font-bold text-xs">{token.symbol[0]}</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{token.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">${token.symbol}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-green-600">{token.change}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{token.volume}</p>
            </div>
          </Link>
        ))}
      </div>
      <Link
        href="/tokens"
        className="block mt-4 text-center text-sm text-purple-600 hover:text-purple-700 font-medium"
      >
        View All Tokens
      </Link>
    </div>
  )
}