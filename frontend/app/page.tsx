'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { TokenCard } from '@/components/TokenCard'
import { TrendingTokens } from '@/components/TrendingTokens'
import { RecentTrades } from '@/components/RecentTrades'
import { Button } from '@/components/ui/Button'
import { useTokens } from '@/hooks/useTokens'
import { useStats } from '@/hooks/useStats'
import { formatETH } from '@/lib/utils/format'
import { Rocket, TrendingUp, Users, DollarSign } from 'lucide-react'

export default function HomePage() {
  const [filter, setFilter] = useState<'all' | 'trending' | 'new'>('trending')
  const { data: tokens, isLoading: tokensLoading } = useTokens({ 
    sort: filter === 'new' ? 'created' : 'volume',
    limit: 12 
  })
  const { data: stats, isLoading: statsLoading } = useStats()

  return (
    <div className="min-h-screen">{/* Navigation is now in layout */}

      {/* Hero Section */}
      <section className="relative py-24 px-4 sm:px-6 lg:px-8 overflow-hidden" style={{ background: 'radial-gradient(circle, #fff 0, #fff 10%, #e5f9e5 115%, #d7e8f8 120%)' }}>
        {/* Clean minimal background */}
        
        <div className="max-w-7xl mx-auto text-center relative z-10">
          <div className="mb-8">
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
              <Rocket className="h-4 w-4 text-primary mr-2" />
              <span className="text-sm font-medium text-primary">The Future of Token Launches</span>
            </div>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold text-gray-900 mb-8 leading-tight">
            Launch Tokens with
            <span className="text-primary block">
              Bonding Curves
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-gray-600 mb-12 max-w-4xl mx-auto leading-relaxed">
            Create and trade tokens on Abstract with fair price discovery through bonding curves. 
            Earn rewards as a top holder and migrate to full DEX when ready.
          </p>
          
          <div className="flex flex-col sm:flex-row justify-center gap-6 mb-16">
            <Button asChild size="lg" className="bg-primary hover:bg-primary/90 px-8 py-4 text-lg font-semibold text-white">
              <Link href="/launch">
                Launch Token
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild className="px-8 py-4 text-lg font-semibold border-gray-300 hover:bg-gray-50 text-gray-900">
              <Link href="#explore">
                Explore Tokens
              </Link>
            </Button>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="bg-white rounded-2xl p-6 group hover:shadow-lg transition-all duration-300 border border-gray-100">
              <div className="mb-4">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <DollarSign className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-gray-900">Fair Launch</h3>
                <p className="text-gray-600 text-sm">
                  No presales, no team allocations. Everyone starts equal with bonding curve pricing.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 group hover:shadow-lg transition-all duration-300 border border-gray-100">
              <div className="mb-4">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-gray-900">Auto Migration</h3>
                <p className="text-gray-600 text-sm">
                  Successful tokens automatically migrate to DEX with full liquidity provision.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 group hover:shadow-lg transition-all duration-300 border border-gray-100">
              <div className="mb-4">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-gray-900">Earn Rewards</h3>
                <p className="text-gray-600 text-sm">
                  Token creators and top holders earn rewards from platform fees.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Platform Statistics</h2>
            <p className="text-gray-600 text-lg">Real-time metrics from Blast Abstract</p>
          </div>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {statsLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white rounded-2xl p-6 text-center animate-pulse border border-gray-100">
                  <div className="w-16 h-16 bg-secondary rounded-full mx-auto mb-4" />
                  <div className="h-8 bg-secondary rounded mb-2" />
                  <div className="h-4 bg-secondary rounded mb-2" />
                  <div className="h-3 bg-secondary rounded" />
                </div>
              ))
            ) : (
              <>
                <div className="bg-white rounded-2xl p-6 text-center group hover:shadow-lg transition-all duration-300 border border-gray-100">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                    <Rocket className="w-8 h-8 text-primary" />
                  </div>
                  <div className="text-3xl font-bold text-gray-900 mb-2">
                    {stats?.overview?.totalTokens?.toLocaleString() || '0'}
                  </div>
                  <div className="text-sm text-gray-600 mb-2">Total Tokens</div>
                  <div className="text-xs text-primary font-medium">+12% this week</div>
                </div>

                <div className="bg-white rounded-2xl p-6 text-center group hover:shadow-lg transition-all duration-300 border border-gray-100">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                    <DollarSign className="w-8 h-8 text-primary" />
                  </div>
                  <div className="text-3xl font-bold text-primary mb-2">
                    {stats?.overview?.totalVolume ? formatETH(stats.overview.totalVolume) : '0.00'} ETH
                  </div>
                  <div className="text-sm text-gray-600 mb-2">Total Volume</div>
                  <div className="text-xs text-primary font-medium">+8% today</div>
                </div>

                <div className="bg-white rounded-2xl p-6 text-center group hover:shadow-lg transition-all duration-300 border border-gray-100">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                    <Users className="w-8 h-8 text-primary" />
                  </div>
                  <div className="text-3xl font-bold text-primary mb-2">
                    {stats?.overview?.uniqueTraders?.toLocaleString() || '0'}
                  </div>
                  <div className="text-sm text-gray-600 mb-2">Active Traders</div>
                  <div className="text-xs text-primary font-medium">+15% this week</div>
                </div>

                <div className="bg-white rounded-2xl p-6 text-center group hover:shadow-lg transition-all duration-300 border border-gray-100">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                    <TrendingUp className="w-8 h-8 text-primary" />
                  </div>
                  <div className="text-3xl font-bold text-primary mb-2">
                    {(stats?.overview?.migrationRate || 0).toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-600 mb-2">Migration Rate</div>
                  <div className="text-xs text-primary font-medium">+3% this month</div>
                </div>
              </>
            )}
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
                <h2 className="text-2xl font-bold text-gray-900">
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
                      <div className="bg-white rounded-lg p-6 h-48 border border-gray-100"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {tokens?.tokens?.map((token) => (
                    <TokenCard key={token.address} token={token} />
                  ))}
                </div>
              )}

              {tokens?.tokens?.length === 0 && !tokensLoading && (
                <div className="text-center py-12">
                  <p className="text-gray-500">No tokens found</p>
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
      <footer className="bg-gray-50 border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center space-x-2 mb-4">
                <svg viewBox="0 0 24 22" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-primary">
                  <path d="M15.821 14.984L20.642 19.759L18.38 21.999L13.56 17.225C13.146 16.815 12.602 16.592 12.015 16.592C11.429 16.592 10.884 16.815 10.471 17.225L5.651 21.999L3.389 19.759L8.209 14.984H15.818H15.821Z" fill="currentColor"></path>
                  <path d="M16.626 13.608L23.209 15.353L24.036 12.29L17.453 10.545C16.889 10.396 16.42 10.038 16.127 9.536C15.834 9.037 15.758 8.453 15.909 7.895L17.671 1.374L14.579 0.556L12.816 7.076L16.623 13.604L16.626 13.608Z" fill="currentColor"></path>
                  <path d="M7.409 13.608L0.827 15.353L0 12.29L6.583 10.545C7.146 10.396 7.616 10.038 7.909 9.536C8.202 9.037 8.277 8.453 8.127 7.895L6.365 1.374L9.457 0.556L11.219 7.076L7.413 13.604L7.409 13.608Z" fill="currentColor"></path>
                </svg>
                <span className="text-xl font-bold text-gray-900">Blast Abstract</span>
              </div>
              <p className="text-gray-600 mb-4">
                The premier token launch platform on Abstract. Fair, transparent, and rewarding.
              </p>
              <div className="flex space-x-4">
                <a href="#" className="text-gray-400 hover:text-primary">
                  <span className="sr-only">Twitter</span>
                  {/* Twitter icon */}
                </a>
                <a href="#" className="text-gray-400 hover:text-primary">
                  <span className="sr-only">Discord</span>
                  {/* Discord icon */}
                </a>
                <a href="#" className="text-gray-400 hover:text-primary">
                  <span className="sr-only">Telegram</span>
                  {/* Telegram icon */}
                </a>
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-4">Platform</h3>
              <ul className="space-y-2">
                <li><Link href="/launch" className="text-gray-600 hover:text-primary">Launch Token</Link></li>
                <li><Link href="/rewards" className="text-gray-600 hover:text-primary">Rewards</Link></li>
                <li><Link href="/leaderboard" className="text-gray-600 hover:text-primary">Leaderboard</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-4">Resources</h3>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-600 hover:text-primary">Documentation</a></li>
                <li><a href="#" className="text-gray-600 hover:text-primary">FAQ</a></li>
                <li><a href="#" className="text-gray-600 hover:text-primary">Support</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t pt-8 mt-8">
            <p className="text-center text-gray-500">
              © 2025 Blast Abstract Platform. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}