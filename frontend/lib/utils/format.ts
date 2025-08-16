import { formatEther, parseEther } from 'viem'

// Format ETH values with appropriate decimals
export function formatETH(value: string | number | bigint, decimals: number = 4): string {
  try {
    if (typeof value === 'string') {
      // Check if it's already in ETH format (has decimal point and is small)
      const num = parseFloat(value)
      if (!isNaN(num) && value.includes('.')) {
        return num.toFixed(decimals)
      }
    }
    
    // Convert from wei to ETH
    const eth = formatEther(BigInt(value))
    return parseFloat(eth).toFixed(decimals)
  } catch {
    return '0.0000'
  }
}

// Format wei values directly to ETH
export function formatWei(value: string | bigint, decimals: number = 4): string {
  try {
    const eth = formatEther(BigInt(value))
    const num = parseFloat(eth)
    
    // Handle very small numbers
    if (num > 0 && num < 0.0001) {
      return num.toExponential(2)
    }
    
    return num.toFixed(decimals)
  } catch {
    return '0.0000'
  }
}

// Format fee values (handles very small amounts better)
export function formatFee(value: string | bigint): string {
  try {
    const eth = formatEther(BigInt(value))
    const num = parseFloat(eth)
    
    if (num === 0) {
      return '0'
    }
    
    // For very small fees (less than 0.0001 ETH)
    if (num < 0.0001) {
      // Convert to more readable format
      if (num < 0.00001) {
        return `<0.00001`
      }
      return num.toFixed(5)
    }
    
    // For small fees (less than 0.01 ETH)
    if (num < 0.01) {
      return num.toFixed(4)
    }
    
    // For normal fees
    if (num < 1) {
      return num.toFixed(3)
    }
    
    // For large fees
    return num.toFixed(2)
  } catch {
    return '0'
  }
}

// Format token amounts (already in readable units) - always show full number
export function formatTokenAmount(value: string | bigint, decimals: number = 4): string {
  try {
    // If value is in wei format (large number), convert it
    if (typeof value === 'string' && value.length > 15) {
      const eth = formatEther(BigInt(value))
      const num = parseFloat(eth)
      
      // Remove unnecessary decimals for whole numbers
      if (num >= 1 && num % 1 === 0) {
        // Use toLocaleString to add commas but show full number
        return num.toLocaleString('en-US', { maximumFractionDigits: 0 })
      }
      
      // For numbers with decimals
      if (num >= 1) {
        return num.toLocaleString('en-US', { maximumFractionDigits: 2 })
      }
      
      // Small numbers keep more decimals
      return num.toFixed(decimals)
    }
    
    const num = typeof value === 'string' ? parseFloat(value) : Number(value)
    
    // Remove unnecessary decimals for whole numbers
    if (num >= 1 && num % 1 === 0) {
      // Use toLocaleString to add commas but show full number
      return num.toLocaleString('en-US', { maximumFractionDigits: 0 })
    }
    
    // For numbers with decimals
    if (num >= 1) {
      return num.toLocaleString('en-US', { maximumFractionDigits: 2 })
    }
    
    // Small numbers keep more decimals
    return num.toFixed(decimals)
  } catch {
    return '0'
  }
}

// Format USD values
export function formatUSD(value: string | number, decimals: number = 2): string {
  try {
    const num = typeof value === 'string' ? parseFloat(value) : value
    if (isNaN(num)) return '$0.00'
    
    // For large numbers, use compact format
    if (num > 1000000000) {
      return `$${(num / 1000000000).toFixed(2)}B`
    }
    if (num > 1000000) {
      return `$${(num / 1000000).toFixed(2)}M`
    }
    if (num > 1000) {
      return `$${(num / 1000).toFixed(2)}K`
    }
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(num)
  } catch {
    return '$0.00'
  }
}

// Calculate USD value from ETH amount (assuming ETH price)
export function calculateUSDValue(ethAmount: string | bigint, ethPrice: number = 2000): string {
  try {
    const eth = typeof ethAmount === 'string' && ethAmount.length > 15 
      ? formatEther(BigInt(ethAmount))
      : ethAmount.toString()
    
    const ethValue = parseFloat(eth)
    const usdValue = ethValue * ethPrice
    
    return formatUSD(usdValue)
  } catch {
    return '$0.00'
  }
}

// Format large numbers with K, M, B suffixes
export function formatNumber(value: string | number, decimals: number = 2): string {
  try {
    const num = typeof value === 'string' ? parseFloat(value) : value
    if (isNaN(num)) return '0'
    
    if (num < 1000) {
      // If decimals is 0 and number is whole, show without decimals
      if (decimals === 0 || num % 1 === 0) {
        return Math.round(num).toString()
      }
      return num.toFixed(decimals)
    } else if (num < 1000000) {
      const val = num / 1000
      return `${decimals === 0 ? Math.round(val) : val.toFixed(decimals)}K`
    } else if (num < 1000000000) {
      const val = num / 1000000
      return `${decimals === 0 ? Math.round(val) : val.toFixed(decimals)}M`
    } else {
      const val = num / 1000000000
      return `${decimals === 0 ? Math.round(val) : val.toFixed(decimals)}B`
    }
  } catch {
    return '0'
  }
}

// Format percentage
export function formatPercentage(value: number, decimals: number = 2): string {
  return `${value.toFixed(decimals)}%`
}

// Format wallet address
export function formatAddress(address: string, chars: number = 4): string {
  if (!address) return ''
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`
}

// Format date/time
export function formatTimestamp(timestamp: string | number | Date): string {
  try {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    // Less than 1 minute
    if (diff < 60000) {
      return 'Just now'
    }
    
    // Less than 1 hour
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000)
      return `${minutes}m ago`
    }
    
    // Less than 24 hours
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000)
      return `${hours}h ago`
    }
    
    // Less than 7 days
    if (diff < 604800000) {
      const days = Math.floor(diff / 86400000)
      return `${days}d ago`
    }
    
    // Default to date format
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    })
  } catch {
    return 'Unknown'
  }
}

// Format token supply
export function formatSupply(value: string | bigint, decimals: number = 18): string {
  try {
    const supply = formatEther(BigInt(value))
    return formatNumber(supply, 2)
  } catch {
    return '0'
  }
}

// Calculate and format price from market cap and supply
export function calculatePrice(marketCap: string | undefined, totalSupply: string | undefined): string {
  try {
    if (!marketCap || !totalSupply) {
      return '0.000000'
    }
    
    // Convert market cap from wei to ETH
    const mcapInEth = parseFloat(formatEther(BigInt(marketCap || '0')))
    const supplyInTokens = parseFloat(formatEther(BigInt(totalSupply || '0')))
    
    if (supplyInTokens === 0) return '0.000000'
    
    const price = mcapInEth / supplyInTokens
    
    return formatPrice(price)
  } catch (error) {
    console.error('Error calculating price:', error)
    return '0.000000'
  }
}

// Format price values with proper notation
export function formatPrice(price: number | string): string {
  try {
    const num = typeof price === 'string' ? parseFloat(price) : price
    
    if (num === 0) {
      return '0.00'
    }
    
    // For extremely small prices (less than 0.00000001)
    if (num < 0.00000001) {
      // Count zeros after decimal
      const zeros = -Math.floor(Math.log10(num)) - 1
      if (zeros > 10) {
        // For very tiny numbers, show compact notation
        const significand = (num * Math.pow(10, zeros + 1)).toFixed(2)
        return `${significand}e-${zeros + 1}`
      }
      return `0.0{${zeros}}${(num * Math.pow(10, zeros + 1)).toFixed(2)}`
    }
    
    // For very small prices (less than 0.000001)
    if (num < 0.000001) {
      // Count zeros and show in readable format
      const str = num.toFixed(12).replace(/0+$/, '')
      return str
    }
    
    // For small prices (less than 0.01)
    if (num < 0.01) {
      return num.toFixed(6).replace(/0+$/, '').replace(/\.$/, '')
    }
    
    // For medium prices (less than 1)
    if (num < 1) {
      return num.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
    }
    
    // For normal prices (less than 1000)
    if (num < 1000) {
      return num.toFixed(2)
    }
    
    // For large prices
    return formatNumber(num, 2)
  } catch {
    return '0.00'
  }
}

// Format transaction hash
export function formatTxHash(hash: string, chars: number = 6): string {
  if (!hash) return ''
  return `${hash.slice(0, chars + 2)}...${hash.slice(-chars)}`
}

// Get color for price change
export function getPriceChangeColor(change: number): string {
  if (change > 0) return 'text-green-500'
  if (change < 0) return 'text-red-500'
  return 'text-gray-500'
}

// Get background color for price change
export function getPriceChangeBgColor(change: number): string {
  if (change > 0) return 'bg-green-50'
  if (change < 0) return 'bg-red-50'
  return 'bg-gray-50'
}

// Format slippage tolerance
export function formatSlippage(slippage: number | string): string {
  const value = typeof slippage === 'string' ? parseFloat(slippage) : slippage
  return `${value.toFixed(1)}%`
}

// Validate ETH amount input
export function isValidETHAmount(amount: string): boolean {
  if (!amount || amount === '') return false
  
  const regex = /^\d*\.?\d*$/
  if (!regex.test(amount)) return false
  
  const num = parseFloat(amount)
  return !isNaN(num) && num > 0
}

// Parse ETH amount to wei
export function parseETHToWei(amount: string): bigint {
  try {
    return parseEther(amount)
  } catch {
    return BigInt(0)
  }
}