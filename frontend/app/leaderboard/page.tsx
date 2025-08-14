'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { 
  Trophy, 
  Medal, 
  Star, 
  TrendingUp, 
  Users, 
  DollarSign,
  Crown,
  Award,
  Target,
  Zap,
  Gift,
  AlertCircle
} from 'lucide-react'
import { useLeaderboards } from '@/hooks/useStats'
import { formatETH, formatAddress, formatNumber } from '@/lib/utils/format'
import { Skeleton } from '@/components/ui/skeleton'


const getRankIcon = (rank: number) => {
  switch (rank) {
    case 1:
      return <Crown className="h-6 w-6 text-yellow-400" />
    case 2:
      return <Medal className="h-6 w-6 text-gray-300" />
    case 3:
      return <Award className="h-6 w-6 text-amber-600" />
    default:
      return <span className="text-lg font-bold text-muted-foreground">#{rank}</span>
  }
}

const getRankBadge = (rank: number) => {
  switch (rank) {
    case 1:
      return 'bg-gradient-to-r from-yellow-400 to-orange-500 text-black'
    case 2:
      return 'bg-gradient-to-r from-gray-300 to-gray-400 text-black'
    case 3:
      return 'bg-gradient-to-r from-amber-600 to-amber-700 text-white'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<'traders' | 'tokens' | 'holders'>('traders')
  const [timeframe, setTimeframe] = useState<'24h' | '7d' | '30d'>('7d')
  
  const { data: leaderboards, isLoading, error } = useLeaderboards(timeframe, 10)
  
  const getAvatar = (address: string, rank: number) => {
    // Generate emoji based on address and rank
    const emojis = ['🐋', '💎', '🌙', '🚀', '👑', '🧙', '⚡', '💪', '🦁', '🔥']
    const index = parseInt(address.slice(-2), 16) % emojis.length
    return rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : emojis[index]
  }

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-4">
            <Trophy className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold gradient-text">Leaderboard</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Top performers on Blast Abstract. Compete for rankings and special rewards.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 mb-8 glass-card rounded-lg p-1">
          {[
            { id: 'traders', label: 'Top Traders', icon: TrendingUp },
            { id: 'tokens', label: 'Top Tokens', icon: Zap },
            { id: 'holders', label: 'Top Holders', icon: Star }
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as any)}
              className={`
                flex items-center space-x-2 px-4 py-2 rounded-md transition-all duration-200 flex-1 justify-center
                ${activeTab === id 
                  ? 'bg-primary text-primary-foreground' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                }
              `}
            >
              <Icon className="h-4 w-4" />
              <span className="font-medium">{label}</span>
            </button>
          ))}
        </div>

        {/* Timeframe Selector */}
        <div className="flex justify-end mb-6">
          <div className="flex space-x-2 glass-card rounded-lg p-1">
            {(['24h', '7d', '30d'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`
                  px-3 py-1 rounded-md text-sm font-medium transition-all
                  ${timeframe === tf 
                    ? 'bg-primary text-primary-foreground' 
                    : 'text-muted-foreground hover:text-foreground'
                  }
                `}
              >
                {tf === '24h' ? '24 Hours' : tf === '7d' ? '7 Days' : '30 Days'}
              </button>
            ))}
          </div>
        </div>

        {/* Loading/Error States */}
        {error && (
          <div className="glass-card rounded-lg p-8 text-center mb-8">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-400" />
            <p className="text-muted-foreground">Failed to load leaderboard data</p>
          </div>
        )}

        {/* Top 3 Podium */}
        <div className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-48" />
              ))
            ) : (
              (activeTab === 'traders' ? leaderboards?.topTraders : 
               activeTab === 'tokens' ? leaderboards?.topTokens : 
               leaderboards?.topHolders)?.slice(0, 3).map((user, index) => (
              <div 
                key={user.address} 
                className={`
                  glass-card rounded-lg p-6 relative overflow-hidden group
                  ${index === 0 ? 'glow-purple transform scale-105' : index === 1 ? 'glow-blue' : 'glow-cyan'}
                `}
              >
                {/* Rank Badge */}
                <div className={`
                  absolute top-4 right-4 w-12 h-12 rounded-full flex items-center justify-center
                  ${getRankBadge(user.rank)}
                `}>
                  {getRankIcon(user.rank)}
                </div>

                {/* User Info */}
                <div className="mb-4">
                  <div className="text-4xl mb-2">{getAvatar(user.address, user.rank)}</div>
                  <h3 className="text-xl font-bold text-foreground">
                    {activeTab === 'tokens' && 'name' in user ? user.name : `User ${user.rank}`}
                  </h3>
                  <p className="text-sm text-muted-foreground font-mono">
                    {formatAddress(user.address)}
                  </p>
                </div>

                {/* Stats */}
                <div className="space-y-2">
                  {activeTab === 'traders' && 'volume' in user && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Volume</span>
                        <span className="text-sm font-semibold">{formatETH(user.volume)} ETH</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Trades</span>
                        <span className="text-sm font-semibold">{formatNumber(user.trades, 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Fees Paid</span>
                        <span className="text-sm font-semibold">{formatETH('fees' in user ? user.fees : '0')} ETH</span>
                      </div>
                    </>
                  )}
                  {activeTab === 'tokens' && 'volume' in user && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Symbol</span>
                        <span className="text-sm font-semibold">${'symbol' in user ? user.symbol : '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Volume</span>
                        <span className="text-sm font-semibold">{formatETH(user.volume)} ETH</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Progress</span>
                        <span className="text-sm font-semibold text-green-400">{'progress' in user ? user.progress : 0}%</span>
                      </div>
                    </>
                  )}
                  {activeTab === 'holders' && 'totalValue' in user && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Tokens Held</span>
                        <span className="text-sm font-semibold">{user.tokenCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Total Value</span>
                        <span className="text-sm font-semibold">{formatETH(user.totalValue)} ETH</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Gradient overlay for rank 1 */}
                {index === 0 && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent animate-gradient-fast pointer-events-none" />
                )}
              </div>
            ))
            )}
          </div>
        </div>

        {/* Full Leaderboard Table */}
        <div className="glass-card rounded-lg overflow-hidden">
          <div className="p-6 border-b border-white/10">
            <h3 className="text-xl font-semibold flex items-center">
              <Target className="h-5 w-5 mr-2 text-primary" />
              Full Rankings
            </h3>
            <p className="text-muted-foreground">Complete leaderboard for all participants</p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium">Rank</th>
                  <th className="px-6 py-3 text-left text-sm font-medium">User</th>
                  <th className="px-6 py-3 text-left text-sm font-medium">Address</th>
                  {activeTab === 'traders' && (
                    <>
                      <th className="px-6 py-3 text-left text-sm font-medium">Volume</th>
                      <th className="px-6 py-3 text-left text-sm font-medium">Trades</th>
                      <th className="px-6 py-3 text-left text-sm font-medium">Win Rate</th>
                    </>
                  )}
                  {activeTab === 'tokens' && (
                    <>
                      <th className="px-6 py-3 text-left text-sm font-medium">Symbol</th>
                      <th className="px-6 py-3 text-left text-sm font-medium">Volume</th>
                      <th className="px-6 py-3 text-left text-sm font-medium">Progress</th>
                    </>
                  )}
                  {activeTab === 'holders' && (
                    <>
                      <th className="px-6 py-3 text-left text-sm font-medium">Tokens Held</th>
                      <th className="px-6 py-3 text-left text-sm font-medium">Total Value</th>
                      <th className="px-6 py-3 text-left text-sm font-medium">Hold Time</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={6} className="px-6 py-4">
                        <Skeleton className="h-12 w-full" />
                      </td>
                    </tr>
                  ))
                ) : (
                  (activeTab === 'traders' ? leaderboards?.topTraders : 
                   activeTab === 'tokens' ? leaderboards?.topTokens : 
                   leaderboards?.topHolders)?.map((user) => (
                  <tr key={user.address} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        {getRankIcon(user.rank)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">{getAvatar(user.address, user.rank)}</span>
                        <span className="font-semibold">
                          {activeTab === 'tokens' && 'name' in user ? user.name : `User ${user.rank}`}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-muted-foreground">
                      {formatAddress(user.address)}
                    </td>
                    {activeTab === 'traders' && 'volume' in user && (
                      <>
                        <td className="px-6 py-4 text-sm font-semibold">{formatETH(user.volume)} ETH</td>
                        <td className="px-6 py-4 text-sm">{formatNumber(user.trades, 0)}</td>
                        <td className="px-6 py-4 text-sm">{formatETH('fees' in user ? user.fees : '0')} ETH</td>
                      </>
                    )}
                    {activeTab === 'tokens' && 'volume' in user && (
                      <>
                        <td className="px-6 py-4 text-sm">${'symbol' in user ? user.symbol : '-'}</td>
                        <td className="px-6 py-4 text-sm font-semibold">{formatETH(user.volume)} ETH</td>
                        <td className="px-6 py-4 text-sm text-green-400">{'progress' in user ? user.progress : 0}%</td>
                      </>
                    )}
                    {activeTab === 'holders' && 'totalValue' in user && (
                      <>
                        <td className="px-6 py-4 text-sm">{user.tokenCount}</td>
                        <td className="px-6 py-4 text-sm font-semibold">{formatETH(user.totalValue)} ETH</td>
                        <td className="px-6 py-4 text-sm">-</td>
                      </>
                    )}
                  </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Rewards Section */}
        <div className="mt-8 glass-card rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-4 flex items-center">
            <Gift className="h-5 w-5 mr-2 text-primary" />
            Leaderboard Rewards
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 rounded-lg bg-gradient-to-r from-yellow-400/10 to-orange-500/10 border border-yellow-400/20">
              <Crown className="h-8 w-8 text-yellow-400 mx-auto mb-2" />
              <h4 className="font-semibold text-yellow-400">1st Place</h4>
              <p className="text-2xl font-bold gradient-text">5 ETH</p>
              <p className="text-sm text-muted-foreground">+ Special NFT</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-gradient-to-r from-gray-300/10 to-gray-400/10 border border-gray-300/20">
              <Medal className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <h4 className="font-semibold text-gray-300">2nd Place</h4>
              <p className="text-2xl font-bold text-gray-300">3 ETH</p>
              <p className="text-sm text-muted-foreground">+ Rare NFT</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-gradient-to-r from-amber-600/10 to-amber-700/10 border border-amber-600/20">
              <Award className="h-8 w-8 text-amber-600 mx-auto mb-2" />
              <h4 className="font-semibold text-amber-600">3rd Place</h4>
              <p className="text-2xl font-bold text-amber-600">1 ETH</p>
              <p className="text-sm text-muted-foreground">+ NFT Badge</p>
            </div>
          </div>
          <div className="mt-4 text-center">
            <p className="text-sm text-muted-foreground">
              Monthly rewards distributed to top performers. Rankings reset every 30 days.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}