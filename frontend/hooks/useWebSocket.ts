import { useEffect, useRef, useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from './useAuth'

export interface WebSocketMessage {
  type: string
  data: any
  timestamp: number
}

export interface UseWebSocketOptions {
  autoConnect?: boolean
  reconnectInterval?: number
  maxReconnectAttempts?: number
  heartbeatInterval?: number
}

// Hook for WebSocket connection
export function useWebSocket(
  url: string,
  options: UseWebSocketOptions = {}
) {
  const {
    autoConnect = true,
    reconnectInterval = 5000,
    maxReconnectAttempts = 10,
    heartbeatInterval = 30000,
  } = options

  const [isConnected, setIsConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null)
  const [error, setError] = useState<Error | null>(null)
  
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null)
  
  const queryClient = useQueryClient()
  const { isAuthenticated, user } = useAuth()

  // Send message through WebSocket
  const sendMessage = useCallback((type: string, data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message: WebSocketMessage = {
        type,
        data,
        timestamp: Date.now(),
      }
      wsRef.current.send(JSON.stringify(message))
      return true
    }
    return false
  }, [])

  // Subscribe to specific events
  const subscribe = useCallback((event: string) => {
    return sendMessage('subscribe', { event })
  }, [sendMessage])

  // Unsubscribe from specific events
  const unsubscribe = useCallback((event: string) => {
    return sendMessage('unsubscribe', { event })
  }, [sendMessage])

  // Handle incoming messages
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message: WebSocketMessage = JSON.parse(event.data)
      setLastMessage(message)
      
      // Handle different message types
      switch (message.type) {
        case 'token:update':
          // Invalidate token queries
          queryClient.invalidateQueries({ 
            queryKey: ['token', message.data.address] 
          })
          break
          
        case 'token:new':
          // Invalidate tokens list
          queryClient.invalidateQueries({ 
            queryKey: ['tokens'] 
          })
          break
          
        case 'trade:new':
          // Invalidate token trades
          queryClient.invalidateQueries({ 
            queryKey: ['trades', 'token', message.data.tokenAddress] 
          })
          // Update token data
          queryClient.invalidateQueries({ 
            queryKey: ['token', message.data.tokenAddress] 
          })
          break
          
        case 'stats:update':
          // Invalidate stats queries
          queryClient.invalidateQueries({ 
            queryKey: ['stats'] 
          })
          break
          
        case 'leaderboard:update':
          // Invalidate leaderboard queries
          queryClient.invalidateQueries({ 
            queryKey: ['leaderboard'] 
          })
          break
          
        case 'reward:claimed':
          // Invalidate user rewards if it's the current user
          if (message.data.wallet === user?.address) {
            queryClient.invalidateQueries({ 
              queryKey: ['rewards', user.address] 
            })
          }
          break
          
        case 'heartbeat':
          // Server heartbeat response
          break
          
        default:
          console.log('Unknown WebSocket message type:', message.type)
      }
    } catch (err) {
      console.error('Failed to parse WebSocket message:', err)
    }
  }, [queryClient, user])

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    try {
      // Add auth token to URL if authenticated
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
      const wsUrl = token ? `${url}?token=${token}` : url
      
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('WebSocket connected')
        setIsConnected(true)
        setError(null)
        reconnectAttemptsRef.current = 0
        
        // Start heartbeat
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current)
        }
        heartbeatIntervalRef.current = setInterval(() => {
          sendMessage('heartbeat', { timestamp: Date.now() })
        }, heartbeatInterval)
      }

      ws.onmessage = handleMessage

      ws.onerror = (event) => {
        console.error('WebSocket error:', event)
        setError(new Error('WebSocket connection error'))
      }

      ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason)
        setIsConnected(false)
        wsRef.current = null
        
        // Clear heartbeat
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current)
          heartbeatIntervalRef.current = null
        }
        
        // Attempt reconnection if not a normal closure
        if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++
          console.log(`Reconnecting in ${reconnectInterval}ms... (attempt ${reconnectAttemptsRef.current})`)
          setTimeout(connect, reconnectInterval)
        }
      }
    } catch (err) {
      console.error('Failed to connect WebSocket:', err)
      setError(err as Error)
    }
  }, [url, handleMessage, sendMessage, reconnectInterval, maxReconnectAttempts, heartbeatInterval])

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnect')
      wsRef.current = null
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current)
      heartbeatIntervalRef.current = null
    }
    setIsConnected(false)
    reconnectAttemptsRef.current = maxReconnectAttempts // Prevent auto-reconnect
  }, [maxReconnectAttempts])

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect && isAuthenticated) {
      connect()
    }
    
    return () => {
      disconnect()
    }
  }, [autoConnect, isAuthenticated, connect, disconnect])

  return {
    isConnected,
    lastMessage,
    error,
    sendMessage,
    subscribe,
    unsubscribe,
    connect,
    disconnect,
  }
}

// Hook for subscribing to token updates
export function useTokenUpdates(tokenAddress: string | undefined) {
  const ws = useWebSocket(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/ws')
  
  useEffect(() => {
    if (tokenAddress && ws.isConnected) {
      ws.subscribe(`token:${tokenAddress}`)
      
      return () => {
        ws.unsubscribe(`token:${tokenAddress}`)
      }
    }
  }, [tokenAddress, ws])
  
  return ws
}

// Hook for subscribing to platform-wide updates
export function usePlatformUpdates() {
  const ws = useWebSocket(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/ws')
  
  useEffect(() => {
    if (ws.isConnected) {
      ws.subscribe('platform:stats')
      ws.subscribe('platform:tokens')
      ws.subscribe('platform:trades')
      
      return () => {
        ws.unsubscribe('platform:stats')
        ws.unsubscribe('platform:tokens')
        ws.unsubscribe('platform:trades')
      }
    }
  }, [ws])
  
  return ws
}

// Hook for subscribing to user-specific updates
export function useUserUpdates() {
  const ws = useWebSocket(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/ws')
  const { user } = useAuth()
  
  useEffect(() => {
    if (user && ws.isConnected) {
      ws.subscribe(`user:${user.address}`)
      
      return () => {
        ws.unsubscribe(`user:${user.address}`)
      }
    }
  }, [user, ws])
  
  return ws
}