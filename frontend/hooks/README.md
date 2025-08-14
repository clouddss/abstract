# React Hooks for Abstract Frontend

This directory contains all the React hooks used in the Abstract frontend application. These hooks integrate with the API client services and provide a clean interface for components to fetch and manage data.

## Available Hooks

### Token Hooks

- `useTokens(params)` - Fetch paginated list of tokens
- `useToken(address)` - Fetch single token details
- `useTrendingTokens(limit)` - Fetch trending tokens by volume
- `useRecentTokens(limit)` - Fetch recently created tokens
- `useSearchTokens(query, limit)` - Search tokens by name/symbol
- `useTokensByCreator(creator, params)` - Fetch tokens by creator
- `useCreateToken()` - Create a new token mutation

### Trading Hooks

- `useEstimateTrade(data)` - Estimate trade output and impact
- `useExecuteTrade()` - Execute a trade mutation
- `useTradeStatus(txHash, enabled)` - Monitor trade transaction status
- `useUserTrades(address, params)` - Fetch user's trade history
- `useTokenTrades(address, params)` - Fetch trades for a token
- `useRealtimeTrades(tokenAddress, pollingInterval)` - Real-time trades with polling
- `useSlippage(defaultSlippage)` - Manage slippage settings

### Stats Hooks

- `useStats(timeframe)` - Platform statistics
- `useLeaderboards(timeframe, limit)` - All leaderboards data
- `useChartData(metric, timeframe)` - Chart data for metrics
- `useTopTraders(timeframe, limit)` - Top traders leaderboard
- `useTopTokens(timeframe, limit)` - Top tokens leaderboard
- `useTopHolders(limit)` - Top holders leaderboard
- `usePlatformHealth()` - Platform health metrics

### Rewards Hooks

- `useRewards(wallet, params)` - Fetch user rewards
- `useUnclaimedRewards(wallet, params)` - Fetch unclaimed rewards only
- `useClaimedRewards(wallet, params)` - Fetch claimed rewards only
- `useClaimRewards()` - Claim rewards mutation
- `useEpochs(params)` - Fetch reward epochs
- `useEpochDetails(epochNumber)` - Fetch specific epoch details
- `useCurrentEpoch()` - Fetch current active epoch
- `useRewardsLeaderboard(params)` - Rewards leaderboard
- `useHasUnclaimedRewards(wallet)` - Check for unclaimed rewards
- `useTotalRewards(wallet)` - Total rewards earned

### Authentication Hooks

- `useAuth()` - Current auth state and user
- `useLogin()` - Login mutation
- `useRegister()` - Registration mutation
- `useLogout()` - Logout mutation
- `useVerifyEmail()` - Email verification mutation
- `useRefreshToken()` - Token refresh mutation
- `useUpdateProfile()` - Profile update mutation
- `useRequireAuth(redirectTo)` - Protect authenticated routes
- `useRequireGuest(redirectTo)` - Protect guest-only routes
- `usePermission(permission)` - Check user permissions

### Chart Hooks

- `useTokenChart(address, params)` - Token price chart data
- `useChart(metric, timeframe)` - Platform metric charts
- `useVolumeChart(timeframe)` - Volume chart data
- `useTradesChart(timeframe)` - Trades chart data
- `useTokensChart(timeframe)` - New tokens chart data
- `useUsersChart(timeframe)` - Users chart data
- `useTokenWithChart(address, chartParams)` - Combined token and chart data

### WebSocket Hooks

- `useWebSocket(url, options)` - Core WebSocket connection
- `useTokenUpdates(tokenAddress)` - Subscribe to token updates
- `usePlatformUpdates()` - Subscribe to platform-wide updates
- `useUserUpdates()` - Subscribe to user-specific updates

### Infinite Scroll Hooks

- `useInfiniteTokens(params)` - Infinite scrolling tokens
- `useInfiniteTrendingTokens(limit)` - Infinite scrolling trending tokens
- `useInfiniteRecentTokens(limit)` - Infinite scrolling recent tokens
- `useInfiniteTokensByCreator(creator, limit)` - Infinite scrolling by creator
- `useInfiniteSearchTokens(search, limit)` - Infinite scrolling search results

## Usage Examples

### Basic Token List

```tsx
import { useTokens } from '@/hooks'

function TokenList() {
  const { data, isLoading, error } = useTokens({
    page: 1,
    limit: 20,
    sort: 'volume',
    order: 'desc'
  })

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>

  return (
    <div>
      {data?.tokens.map(token => (
        <TokenCard key={token.address} token={token} />
      ))}
    </div>
  )
}
```

### Execute Trade with Estimation

```tsx
import { useEstimateTrade, useExecuteTrade, useSlippage } from '@/hooks'

function TradeForm({ tokenAddress }) {
  const [amount, setAmount] = useState('')
  const { slippage, setSlippage, calculateMinOutput } = useSlippage(0.5)
  
  const estimate = useEstimateTrade({
    tokenAddress,
    type: TradeType.BUY,
    amountIn: amount
  })
  
  const executeTrade = useExecuteTrade()

  const handleTrade = () => {
    if (!estimate.data) return
    
    executeTrade.mutate({
      tokenAddress,
      type: TradeType.BUY,
      amountIn: amount,
      minAmountOut: calculateMinOutput(estimate.data.amountOut)
    })
  }

  return (
    <form onSubmit={handleTrade}>
      <input value={amount} onChange={(e) => setAmount(e.target.value)} />
      {estimate.data && (
        <div>
          Expected output: {estimate.data.amountOut}
          Price impact: {estimate.data.priceImpact}%
        </div>
      )}
      <button type="submit" disabled={executeTrade.isPending}>
        {executeTrade.isPending ? 'Trading...' : 'Trade'}
      </button>
    </form>
  )
}
```

### Real-time Token Updates

```tsx
import { useToken, useTokenUpdates } from '@/hooks'

function TokenDetails({ address }) {
  const { data: token } = useToken(address)
  const ws = useTokenUpdates(address)

  // Token data will automatically update when WebSocket receives updates
  
  return (
    <div>
      <h1>{token?.name}</h1>
      <p>Price: {token?.price}</p>
      <p>Volume: {token?.volume24h}</p>
      {ws.isConnected && <span>🟢 Live</span>}
    </div>
  )
}
```

### Infinite Scroll Tokens

```tsx
import { useInfiniteTokens } from '@/hooks'
import { useInView } from 'react-intersection-observer'

function InfiniteTokenList() {
  const { 
    tokens, 
    hasNextPage, 
    fetchNextPage, 
    isFetchingNextPage 
  } = useInfiniteTokens({ sort: 'volume', order: 'desc' })
  
  const { ref } = useInView({
    onChange: (inView) => {
      if (inView && hasNextPage && !isFetchingNextPage) {
        fetchNextPage()
      }
    },
  })

  return (
    <div>
      {tokens.map((token) => (
        <TokenCard key={token.address} token={token} />
      ))}
      <div ref={ref}>
        {isFetchingNextPage && <Spinner />}
      </div>
    </div>
  )
}
```

### Protected Route

```tsx
import { useRequireAuth } from '@/hooks'

function Dashboard() {
  const { isLoading } = useRequireAuth()
  
  if (isLoading) return <LoadingScreen />
  
  // User is authenticated if we get here
  return <DashboardContent />
}
```

## Best Practices

1. **Error Handling**: All hooks include proper error handling and retry logic
2. **Loading States**: Always check `isLoading` before rendering data
3. **Caching**: React Query handles caching automatically with appropriate stale times
4. **Optimistic Updates**: Trade and mutation hooks include optimistic updates
5. **Real-time Updates**: Use WebSocket hooks for real-time data requirements
6. **Pagination**: Use infinite scroll hooks for large lists
7. **Authentication**: Use auth hooks to protect routes and check permissions

## Configuration

The hooks use the following environment variables:

- `NEXT_PUBLIC_API_URL` - API base URL (default: http://localhost:3001)
- `NEXT_PUBLIC_WS_URL` - WebSocket URL (default: ws://localhost:3001/ws)

Make sure these are set in your `.env.local` file.