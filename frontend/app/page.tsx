'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { TokenCard } from '@/components/TokenCard'
import { StatsCard } from '@/components/StatsCard'
import { TrendingTokens } from '@/components/TrendingTokens'
import { RecentTrades } from '@/components/RecentTrades'
import { ConnectWallet } from '@/components/ConnectWallet'
import { Button } from '@/components/ui/Button'
import { useTokens } from '@/hooks/useTokens'
import { useStats } from '@/hooks/useStats'
import { Rocket, TrendingUp, Users, DollarSign } from 'lucide-react'

export default function HomePage() {
  const [filter, setFilter] = useState<'all' | 'trending' | 'new'>('trending')
  const { data: tokens, isLoading: tokensLoading } = useTokens({ 
    sort: filter === 'new' ? 'created' : 'volume',
    limit: 12 
  })
  const { data: stats, isLoading: statsLoading } = useStats()

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 dark:from-gray-900 dark:to-purple-900">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm dark:bg-gray-900/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Rocket className="h-8 w-8 text-purple-600" />
                <span className="text-xl font-bold gradient-text">Abstract Pump</span>
              </div>
              <nav className="hidden md:flex space-x-6">
                <Link href="/" className="text-gray-900 dark:text-gray-100 hover:text-purple-600">
                  Home
                </Link>
                <Link href="/launch" className="text-gray-600 dark:text-gray-300 hover:text-purple-600">
                  Launch
                </Link>
                <Link href="/rewards" className="text-gray-600 dark:text-gray-300 hover:text-purple-600">
                  Rewards
                </Link>
                <Link href="/leaderboard" className="text-gray-600 dark:text-gray-300 hover:text-purple-600">
                  Leaderboard
                </Link>
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              <ConnectWallet />
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
            Launch Tokens with
            <span className="gradient-text block">Bonding Curves</span>
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto">
            Create and trade tokens on Abstract with fair price discovery through bonding curves. 
            Earn rewards as a top holder and migrate to full DEX when ready.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button asChild size="lg" className="bg-purple-600 hover:bg-purple-700">
              <Link href="/launch">
                <Rocket className="w-5 h-5 mr-2" />
                Launch Token
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="#explore">
                Explore Tokens
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatsCard
              title="Total Tokens"
              value={stats?.data?.overview?.totalTokens?.toLocaleString() || '0'}
              change="+12%"
              icon={<Rocket className="w-5 h-5" />}
              loading={statsLoading}
            />
            <StatsCard
              title="Total Volume"
              value={`${parseFloat(stats?.data?.overview?.totalVolume || '0').toFixed(2)} ETH`}
              change="+8%"
              icon={<DollarSign className="w-5 h-5" />}
              loading={statsLoading}
            />
            <StatsCard
              title="Active Traders"
              value={stats?.data?.overview?.uniqueTraders?.toLocaleString() || '0'}
              change="+15%"
              icon={<Users className="w-5 h-5" />}
              loading={statsLoading}
            />
            <StatsCard
              title="Migration Rate"
              value={`${(stats?.data?.overview?.migrationRate || 0).toFixed(1)}%`}
              change="+3%"
              icon={<TrendingUp className="w-5 h-5" />}
              loading={statsLoading}
            />
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section id="explore" className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Tokens List */}
            <div className="lg:col-span-2">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {filter === 'trending' ? 'Trending Tokens' : filter === 'new' ? 'New Tokens' : 'All Tokens'}
                </h2>
                <div className="flex space-x-2">
                  {(['trending', 'new', 'all'] as const).map((f) => (
                    <Button
                      key={f}
                      variant={filter === f ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFilter(f)}
                    >
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </Button>
                  ))}
                </div>
              </div>

              {tokensLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 h-48"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {tokens?.data?.tokens?.map((token: any) => (
                    <TokenCard key={token.address} token={token} />
                  ))}
                </div>
              )}

              {tokens?.data?.tokens?.length === 0 && !tokensLoading && (
                <div className="text-center py-12">
                  <p className="text-gray-500 dark:text-gray-400">No tokens found</p>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <TrendingTokens />
              <RecentTrades />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-900 border-t">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center space-x-2 mb-4">
                <Rocket className="h-8 w-8 text-purple-600" />
                <span className="text-xl font-bold gradient-text">Abstract Pump</span>
              </div>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                The premier token launch platform on Abstract. Fair, transparent, and rewarding.
              </p>
              <div className="flex space-x-4">
                <a href="#" className="text-gray-400 hover:text-purple-600">
                  <span className="sr-only">Twitter</span>
                  {/* Twitter icon */}
                </a>
                <a href="#" className="text-gray-400 hover:text-purple-600">
                  <span className="sr-only">Discord</span>
                  {/* Discord icon */}
                </a>
                <a href="#" className="text-gray-400 hover:text-purple-600">
                  <span className="sr-only">Telegram</span>
                  {/* Telegram icon */}
                </a>
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Platform</h3>
              <ul className="space-y-2">
                <li><Link href="/launch" className="text-gray-600 dark:text-gray-300 hover:text-purple-600">Launch Token</Link></li>
                <li><Link href="/rewards" className="text-gray-600 dark:text-gray-300 hover:text-purple-600">Rewards</Link></li>
                <li><Link href="/leaderboard" className="text-gray-600 dark:text-gray-300 hover:text-purple-600">Leaderboard</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Resources</h3>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-600 dark:text-gray-300 hover:text-purple-600">Documentation</a></li>
                <li><a href="#" className="text-gray-600 dark:text-gray-300 hover:text-purple-600">FAQ</a></li>
                <li><a href="#" className="text-gray-600 dark:text-gray-300 hover:text-purple-600">Support</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t pt-8 mt-8">
            <p className="text-center text-gray-500 dark:text-gray-400">
              © 2024 Abstract Pump Platform. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}