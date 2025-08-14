'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { 
  Gift, 
  TrendingUp, 
  Coins, 
  Users, 
  Clock, 
  Download,
  ExternalLink,
  Star,
  Trophy,
  Target,
  AlertCircle
} from 'lucide-react'
import { useAccount } from 'wagmi'
import { useRewards, useClaimedRewards, useClaimRewards } from '@/hooks/useRewards'
import { formatETH, formatTimestamp } from '@/lib/utils/format'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'


export default function RewardsPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'active'>('overview')
  const { address, isConnected } = useAccount()
  
  // Fetch rewards data
  const { data: rewards, isLoading: rewardsLoading, error: rewardsError } = useRewards(address)
  const { data: history, isLoading: historyLoading } = useClaimedRewards(address)
  const claimRewards = useClaimRewards()
  
  const handleClaimRewards = async () => {
    if (!rewards?.summary || (rewards.summary.unclaimedEth === '0' && rewards.summary.unclaimedUsdc === '0')) return
    
    // Find the first unclaimed reward
    const unclaimedReward = rewards.rewards.find(r => !r.claimed)
    if (!unclaimedReward || !address) return
    
    try {
      await claimRewards.mutateAsync({
        epochNumber: unclaimedReward.epochNumber,
        ethAmount: unclaimedReward.ethAmount,
        usdcAmount: unclaimedReward.usdcAmount,
        merkleProof: [], // This should come from the backend
        signature: '' // This needs to be generated
      })
      toast.success('Rewards claimed successfully!')
    } catch (error) {
      toast.error('Failed to claim rewards')
    }
  }

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-4">
            <Gift className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold gradient-text">Rewards Dashboard</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Earn rewards as a token creator and top holder. Track your earnings and claim rewards.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 mb-8 glass-card rounded-lg p-1">
          {[
            { id: 'overview', label: 'Overview', icon: Target },
            { id: 'history', label: 'History', icon: Clock },
            { id: 'active', label: 'Active Positions', icon: Star }
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

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="glass-card rounded-lg p-6 group hover:glow-purple transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Coins className="h-6 w-6 text-primary" />
                  </div>
                  {rewardsLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <span className="text-2xl font-bold gradient-text">
                      {formatETH(rewards?.summary?.totalEth || '0')} ETH
                    </span>
                  )}
                </div>
                <h3 className="font-semibold text-foreground">Total Earned</h3>
                <p className="text-sm text-muted-foreground">All-time rewards</p>
              </div>

              <div className="glass-card rounded-lg p-6 group hover:glow-blue transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Clock className="h-6 w-6 text-blue-400" />
                  </div>
                  {rewardsLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <span className="text-2xl font-bold text-blue-400">
                      {formatETH(rewards?.summary?.totalEth || '0')} ETH
                    </span>
                  )}
                </div>
                <h3 className="font-semibold text-foreground">Pending</h3>
                <p className="text-sm text-muted-foreground">Waiting distribution</p>
              </div>

              <div className="glass-card rounded-lg p-6 group hover:glow-cyan transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <Download className="h-6 w-6 text-green-400" />
                  </div>
                  {rewardsLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <span className="text-2xl font-bold text-green-400">
                      {formatETH(rewards?.summary?.unclaimedEth || '0')} ETH
                    </span>
                  )}
                </div>
                <h3 className="font-semibold text-foreground">Claimable</h3>
                <p className="text-sm text-muted-foreground">Ready to claim</p>
              </div>

              <div className="glass-card rounded-lg p-6 group hover:glow-purple transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 rounded-lg bg-purple-500/10">
                    <Trophy className="h-6 w-6 text-purple-400" />
                  </div>
                  {rewardsLoading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <span className="text-2xl font-bold text-purple-400">
                      #{rewards?.rewards?.length || 0}
                    </span>
                  )}
                </div>
                <h3 className="font-semibold text-foreground">Global Rank</h3>
                <p className="text-sm text-muted-foreground">Top earner</p>
              </div>
            </div>

            {/* Action Section */}
            <div className="glass-card rounded-lg p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="text-xl font-semibold mb-2">Claim Rewards</h3>
                  <p className="text-muted-foreground">
                    You have {formatETH(rewards?.summary?.unclaimedEth || '0')} ETH available to claim
                  </p>
                </div>
                <Button 
                  className="btn-gradient px-6 py-3"
                  disabled={!isConnected || !rewards?.summary || (rewards.summary.unclaimedEth === '0' && rewards.summary.unclaimedUsdc === '0') || claimRewards.isPending}
                  onClick={handleClaimRewards}
                >
                  {claimRewards.isPending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Claim {formatETH(rewards?.summary?.unclaimedEth || '0')} ETH
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Rewards Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass-card rounded-lg p-6">
                <h3 className="text-xl font-semibold mb-4 flex items-center">
                  <TrendingUp className="h-5 w-5 mr-2 text-primary" />
                  Weekly Performance
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">This Week</span>
                    <span className="font-semibold">{formatETH(rewards?.summary?.totalEth || '0')} ETH</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Multiplier</span>
                    <span className="text-primary font-semibold">1x</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div 
                      className="progress-bar h-2 rounded-full" 
                      style={{ width: '50%' }}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Progress to next tier
                  </p>
                </div>
              </div>

              <div className="glass-card rounded-lg p-6">
                <h3 className="text-xl font-semibold mb-4 flex items-center">
                  <Users className="h-5 w-5 mr-2 text-primary" />
                  Reward Types
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 rounded-lg bg-white/5">
                    <span className="text-sm">Creator Bonuses</span>
                    <span className="text-sm font-semibold">60%</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-white/5">
                    <span className="text-sm">Top Holder Rewards</span>
                    <span className="text-sm font-semibold">25%</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-white/5">
                    <span className="text-sm">Volume Bonuses</span>
                    <span className="text-sm font-semibold">15%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="glass-card rounded-lg overflow-hidden">
            <div className="p-6 border-b border-white/10">
              <h3 className="text-xl font-semibold">Reward History</h3>
              <p className="text-muted-foreground">Your complete reward transaction history</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/5">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-medium">Type</th>
                    <th className="px-6 py-3 text-left text-sm font-medium">Amount</th>
                    <th className="px-6 py-3 text-left text-sm font-medium">Token</th>
                    <th className="px-6 py-3 text-left text-sm font-medium">Date</th>
                    <th className="px-6 py-3 text-left text-sm font-medium">Status</th>
                    <th className="px-6 py-3 text-left text-sm font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {historyLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        <td colSpan={6} className="px-6 py-4">
                          <Skeleton className="h-12 w-full" />
                        </td>
                      </tr>
                    ))
                  ) : history?.rewards && history.rewards.length > 0 ? (
                    history.rewards.map((reward) => (
                    <tr key={reward.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 text-sm capitalize">Reward</td>
                      <td className="px-6 py-4 text-sm font-semibold">{formatETH(reward.ethAmount)} ETH</td>
                      <td className="px-6 py-4 text-sm">{reward.tokenSymbol || '-'}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{formatTimestamp(reward.claimedAt || '')}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`
                          px-2 py-1 rounded-full text-xs font-medium
                          bg-green-500/10 text-green-400
                        `}>
                          Claimed
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <Button variant="outline" size="sm" asChild>
                          <a href={reward.txHash ? `https://explorer.testnet.abs.xyz/tx/${reward.txHash}` : '#'} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3 w-3 mr-1" />
                            View
                          </a>
                        </Button>
                      </td>
                    </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center">
                        <Gift className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                        <p className="text-muted-foreground">No reward history yet</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Active Positions Tab */}
        {activeTab === 'active' && (
          <div className="space-y-6">
            {rewardsLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))
            ) : rewards?.rewards && rewards.rewards.length > 0 ? (
              rewards.rewards.filter(r => !r.claimed).map((position) => (
                <div key={position.tokenAddress} className="glass-card rounded-lg p-6">
                  <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-xl font-semibold">{position.tokenSymbol}</h3>
                        <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">
                          {position.type === 'creator' ? 'Creator' : `Top Holder #${position.holderRank || '-'}`}
                        </span>
                      </div>
                      <p className="text-muted-foreground text-sm font-mono">
                        {position.tokenAddress}
                      </p>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-4 lg:gap-6">
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Earned</p>
                        <p className="text-lg font-semibold text-green-400">{formatETH(position.earned)} ETH</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Pending</p>
                        <p className="text-lg font-semibold text-yellow-400">{formatETH(position.pending)} ETH</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Share</p>
                        <p className="text-lg font-semibold text-primary">{position.share || 0}%</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 glass-card rounded-lg">
                <Star className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p className="text-muted-foreground">No active reward positions</p>
                <p className="text-sm text-muted-foreground mt-2">Create a token or become a top holder to start earning</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}