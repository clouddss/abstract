import React from 'react'
import Link from 'next/link'
import { Activity } from 'lucide-react'

export function RecentTrades() {
  // Mock data - in real app this would come from API
  const mockTrades = [
    { id: '1', type: 'buy', trader: '0x1234...5678', token: 'MEME', amount: '1.2 ETH', time: '2m ago' },
    { id: '2', type: 'sell', trader: '0x9abc...def0', token: 'DEGEN', amount: '0.8 ETH', time: '5m ago' },
    { id: '3', type: 'buy', trader: '0x5555...6666', token: 'PUMP', amount: '2.1 ETH', time: '8m ago' },
    { id: '4', type: 'sell', trader: '0x7777...8888', token: 'MOON', amount: '0.5 ETH', time: '12m ago' },
  ]

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Trades</h3>
        <Activity className="w-5 h-5 text-purple-600" />
      </div>
      <div className="space-y-3">
        {mockTrades.map((trade) => (
          <div
            key={trade.id}
            className="flex items-center justify-between p-3 rounded-lg border border-gray-100 dark:border-gray-700"
          >
            <div className="flex items-center space-x-3">
              <div className={`w-2 h-2 rounded-full ${
                trade.type === 'buy' ? 'bg-green-500' : 'bg-red-500'
              }`} />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {trade.type === 'buy' ? 'Bought' : 'Sold'} ${trade.token}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {trade.trader} • {trade.time}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900 dark:text-white">{trade.amount}</p>
            </div>
          </div>
        ))}
      </div>
      <Link
        href="/trades"
        className="block mt-4 text-center text-sm text-purple-600 hover:text-purple-700 font-medium"
      >
        View All Trades
      </Link>
    </div>
  )
}