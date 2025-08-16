'use client'

import React, { useState, useEffect } from 'react'
import { Button } from './ui/Button'
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Zap,
  Info,
  Calculator,
  AlertTriangle,
  CheckCircle,
  Wallet
} from 'lucide-react'
import { useAccount, useWalletClient, usePublicClient } from 'wagmi'
import { formatETH, formatWei, formatTokenAmount, formatNumber, isValidETHAmount, parseETHToWei } from '@/lib/utils/format'
import { formatError } from '@/lib/utils/ui'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useEstimateTrade, useExecuteTrade, useSlippage } from '@/hooks/useTrades'
import { TradeType, Address } from '@/lib/api/types/common.types'
import { toast } from 'sonner'
import { useErrorHandler, getTransactionErrorMessage } from '@/lib/utils/error-handling'

interface TradingInterfaceProps {
  tokenSymbol: string
  tokenAddress: Address
  currentPrice: string
  bondingCurve?: string
  className?: string
}

export function TradingInterface({ 
  tokenSymbol,
  tokenAddress,
  currentPrice,
  bondingCurve,
  className = ''
}: TradingInterfaceProps) {
  const { address, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy')
  const [amount, setAmount] = useState('')
  const [slippageInput, setSlippageInput] = useState('1.0')
  const [isTrading, setIsTrading] = useState(false)
  const { slippage: slippageValue, setSlippage: setSlippageValue, calculateMinOutput } = useSlippage(1.0)
  const { handleError } = useErrorHandler()
  
  // Trade estimation hook
  const { data: estimateData, isLoading: isEstimating } = useEstimateTrade(
    amount && isValidETHAmount(amount) ? {
      tokenAddress,
      type: tradeType === 'buy' ? TradeType.BUY : TradeType.SELL,
      amountIn: parseETHToWei(amount).toString()
    } : undefined
  )
  
  // Trade execution hook
  const executeTrade = useExecuteTrade()
  
  // Subscribe to price updates
  const { lastMessage } = useWebSocket(
    process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3002',
    { autoConnect: !!tokenAddress }
  )
  
  // Filter for price updates for this token
  const priceUpdate = lastMessage?.type === 'price_update' && 
    lastMessage?.data?.tokenAddress === tokenAddress 
    ? lastMessage.data 
    : null

  const handleTrade = async () => {
    if (!isConnected) {
      toast.error('Please connect your wallet')
      return
    }
    
    if (!isValidETHAmount(amount)) {
      toast.error('Please enter a valid amount')
      return
    }
    
    if (!estimateData) {
      toast.error('Unable to estimate trade')
      return
    }
    
    // Validate amount against user balance
    const amountWei = parseETHToWei(amount)
    if (tradeType === 'buy' && address) {
      // Check ETH balance for buy orders
      // This would be done through wagmi hooks in real implementation
    }
    
    setIsTrading(true)
    
    try {
      const minAmountOut = calculateMinOutput(estimateData.amountOut || estimateData.outputAmount)
      
      // Get transaction data from backend
      const result = await executeTrade.mutateAsync({
        tokenAddress,
        type: tradeType === 'buy' ? TradeType.BUY : TradeType.SELL,
        amountIn: amountWei.toString(),
        minAmountOut
      })
      
      // If we have transaction data, send it through the wallet
      if (result.transactionData && walletClient) {
        try {
          const { to, data, value } = result.transactionData
          
          // Send transaction through wallet
          const hash = await walletClient.sendTransaction({
            to: to as `0x${string}`,
            data: data as `0x${string}`,
            value: BigInt(value),
            account: address!,
            chain: walletClient.chain
          })
          
          toast.info('Transaction submitted! Waiting for confirmation...', {
            duration: 5000
          })
          
          // Wait for transaction confirmation
          if (publicClient) {
            const receipt = await publicClient.waitForTransactionReceipt({
              hash,
              confirmations: 1
            })
            
            if (receipt.status === 'success') {
              toast.success(
                `Successfully ${tradeType === 'buy' ? 'bought' : 'sold'} ${tokenSymbol}!`,
                {
                  duration: 5000,
                  action: {
                    label: 'View Transaction',
                    onClick: () => window.open(`${process.env.NEXT_PUBLIC_CHAIN_EXPLORER_URL}/tx/${hash}`, '_blank')
                  }
                }
              )
              setAmount('')
            } else {
              toast.error('Transaction failed')
            }
          }
        } catch (walletError: any) {
          console.error('Wallet transaction error:', walletError)
          if (walletError.message?.includes('rejected')) {
            toast.error('Transaction rejected by user')
          } else {
            toast.error(walletError.message || 'Failed to send transaction')
          }
        }
      } else if (result.status === 'success') {
        // Fallback for direct execution (shouldn't happen with current flow)
        toast.success(
          `Successfully ${tradeType === 'buy' ? 'bought' : 'sold'} ${tokenSymbol}!`,
          {
            duration: 5000,
            action: {
              label: 'View Transaction',
              onClick: () => window.open(`${process.env.NEXT_PUBLIC_CHAIN_EXPLORER_URL}/tx/${result.txHash}`, '_blank')
            }
          }
        )
        setAmount('')
      } else {
        toast.error(result.message || 'Trade failed')
      }
    } catch (error: any) {
      // Handle specific error types
      const errorMessage = getTransactionErrorMessage(error)
      handleError(error, false) // Log but don't show toast
      
      // Show user-friendly error with action if applicable
      if (error?.code === 'INSUFFICIENT_FUNDS') {
        toast.error(errorMessage, {
          action: {
            label: 'Get Test ETH',
            onClick: () => window.open('https://faucet.testnet.abs.xyz', '_blank')
          }
        })
      } else {
        toast.error(errorMessage)
      }
    } finally {
      setIsTrading(false)
    }
  }

  // Update price from WebSocket
  useEffect(() => {
    if (priceUpdate?.price) {
      // Price update received via WebSocket
    }
  }, [priceUpdate])
  
  // Update slippage value when input changes
  useEffect(() => {
    const value = parseFloat(slippageInput)
    if (!isNaN(value) && value >= 0 && value <= 50) {
      setSlippageValue(value)
    }
  }, [slippageInput, setSlippageValue])

  return (
    <div className={`bg-white rounded-2xl p-6 border border-gray-100 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold flex items-center">
          <Zap className="h-5 w-5 mr-2 text-primary" />
          Trade {tokenSymbol}
        </h3>
        <div className="text-sm text-gray-600">
          Price: <span className="text-primary font-semibold">${currentPrice}</span>
        </div>
      </div>

      {/* Buy/Sell Toggle */}
      <div className="flex space-x-1 mb-6 bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => setTradeType('buy')}
          className={`
            flex-1 py-3 rounded-md transition-all duration-200 font-medium flex items-center justify-center
            ${tradeType === 'buy' 
              ? 'bg-primary text-white shadow-lg' 
              : 'text-gray-600 hover:text-gray-900 hover:bg-white'
            }
          `}
        >
          <TrendingUp className="w-4 h-4 mr-2" />
          Buy
        </button>
        <button
          onClick={() => setTradeType('sell')}
          className={`
            flex-1 py-3 rounded-md transition-all duration-200 font-medium flex items-center justify-center
            ${tradeType === 'sell' 
              ? 'bg-red-500 text-white shadow-lg' 
              : 'text-gray-600 hover:text-gray-900 hover:bg-white'
            }
          `}
        >
          <TrendingDown className="w-4 h-4 mr-2" />
          Sell
        </button>
      </div>

      {/* Trade Form */}
      <div className="space-y-6">
        {/* Amount Input */}
        <div>
          <label className="block text-sm font-medium mb-3">
            {tradeType === 'buy' ? 'ETH Amount' : `${tokenSymbol} Amount`}
          </label>
          <div className="relative">
            <input
              type="text"
              value={amount}
              onChange={(e) => {
                const value = e.target.value
                // Allow decimal input
                if (value === '' || /^\d*\.?\d*$/.test(value)) {
                  setAmount(value)
                }
              }}
              placeholder="0.0"
              className="w-full px-4 py-4 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-lg"
            />
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
              <DollarSign className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm font-medium text-gray-600">
                {tradeType === 'buy' ? 'ETH' : tokenSymbol}
              </span>
            </div>
          </div>
          
          {/* Quick amount buttons */}
          <div className="flex space-x-2 mt-3">
            {['0.1', '0.5', '1.0', '5.0'].map((quickAmount) => (
              <button
                key={quickAmount}
                onClick={() => setAmount(quickAmount)}
                className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors border border-gray-200"
              >
                {quickAmount}
              </button>
            ))}
          </div>
        </div>

        {/* Slippage Settings */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium">Slippage Tolerance</label>
            <div className="flex items-center space-x-2">
              <Info className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-gray-600">{slippageValue}%</span>
            </div>
          </div>
          <div className="flex space-x-2">
            {['0.5', '1.0', '2.0'].map((slippageOption) => (
              <button
                key={slippageOption}
                onClick={() => setSlippageInput(slippageOption)}
                className={`
                  px-3 py-2 text-sm rounded-md transition-colors border
                  ${slippageInput === slippageOption 
                    ? 'bg-primary text-white border-primary' 
                    : 'bg-gray-100 border-gray-200 hover:bg-gray-200'
                  }
                `}
              >
                {slippageOption}%
              </button>
            ))}
            <input
              type="number"
              value={slippageInput}
              onChange={(e) => setSlippageInput(e.target.value)}
              placeholder="Custom"
              className="flex-1 px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-md focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Trade Summary */}
        {amount && isValidETHAmount(amount) && (
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="flex items-center space-x-2 mb-3">
              <Calculator className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Trade Summary</span>
            </div>
            
            {isEstimating ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex justify-between">
                    <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
                    <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            ) : estimateData ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">You pay</span>
                  <span className="font-semibold">
                    {amount} {tradeType === 'buy' ? 'ETH' : tokenSymbol}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600">You receive</span>
                  <span className="font-semibold text-primary">
                    {tradeType === 'buy' 
                      ? formatTokenAmount(estimateData.amountOut || estimateData.outputAmount)
                      : formatWei(estimateData.amountOut || estimateData.outputAmount)
                    } {tradeType === 'buy' ? tokenSymbol : 'ETH'}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600">Price impact</span>
                  <span className={`font-semibold ${estimateData.priceImpact > 3 ? 'text-red-500' : estimateData.priceImpact > 1 ? 'text-yellow-500' : 'text-green-500'}`}>
                    {estimateData.priceImpact.toFixed(2)}%
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600">Platform fee</span>
                  <span className="font-semibold">{formatWei(estimateData.fee)} ETH</span>
                </div>
                
                <div className="flex justify-between border-t border-gray-200 pt-2">
                  <span className="text-gray-600">Minimum received</span>
                  <span className="font-semibold">
                    {tradeType === 'buy'
                      ? formatTokenAmount(calculateMinOutput(estimateData.amountOut || estimateData.outputAmount))
                      : formatWei(calculateMinOutput(estimateData.amountOut || estimateData.outputAmount))
                    }
                    {' '}{tradeType === 'buy' ? tokenSymbol : 'ETH'}
                  </span>
                </div>
                
                {/* Warnings */}
                {estimateData.priceImpact > 3 && (
                  <div className="flex items-start space-x-2 p-3 bg-red-50 border border-red-200 rounded-md">
                    <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5" />
                    <div className="text-sm">
                      <p className="text-red-400 font-medium">High Price Impact</p>
                      <p className="text-red-300">This trade will significantly affect the token price.</p>
                    </div>
                  </div>
                )}
                
                {/* Additional warnings */}
                {estimateData.priceImpact > 10 && (
                  <div className="flex items-start space-x-2 p-3 bg-red-100 border border-red-300 rounded-md">
                    <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5" />
                    <div className="text-sm">
                      <p className="text-red-500 font-medium">Extreme Price Impact!</p>
                      <p className="text-red-400">Consider splitting this trade into smaller amounts.</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500">
                <p className="text-sm">Unable to estimate trade</p>
              </div>
            )}
          </div>
        )}

        {/* Trade Button */}
        {!isConnected ? (
          <Button 
            className="w-full py-4 text-lg font-semibold"
            variant="outline"
          >
            <Wallet className="w-5 h-5 mr-2" />
            Connect Wallet to Trade
          </Button>
        ) : (
          <Button 
            onClick={handleTrade}
            disabled={!amount || isTrading || !isValidETHAmount(amount) || isEstimating || !estimateData}
            className={`w-full py-4 text-lg font-semibold text-white ${
              tradeType === 'buy' 
                ? 'bg-primary hover:bg-primary/90' 
                : 'bg-red-500 hover:bg-red-600'
            }`}
          >
          {isTrading ? (
            <div className="flex items-center space-x-2">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Processing...</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              {tradeType === 'buy' ? (
                <TrendingUp className="w-5 h-5" />
              ) : (
                <TrendingDown className="w-5 h-5" />
              )}
              <span>
                {tradeType === 'buy' ? 'Buy' : 'Sell'} {tokenSymbol}
              </span>
            </div>
          )}
          </Button>
        )}

        {/* Trade Info */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center space-x-2 text-sm text-gray-600">
            <CheckCircle className="w-4 h-4 text-primary" />
            <span>Trades execute instantly via bonding curve</span>
          </div>
          <p className="text-xs text-gray-500">
            No liquidity needed • Fair price discovery • Instant settlement
          </p>
        </div>
      </div>
    </div>
  )
}