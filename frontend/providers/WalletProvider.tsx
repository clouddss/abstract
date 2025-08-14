'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useAccount, useSignMessage, useDisconnect, useChainId, useSwitchChain } from 'wagmi'
import { Address } from 'viem'
import { authService } from '@/lib/api/services/auth.service'
import { generateAuthMessage, tokenStorage, authEvents, ABSTRACT_TESTNET_ID } from '@/lib/auth/utils'
import { useQueryClient } from '@tanstack/react-query'
import { LoginResponse } from '@/lib/api/types/auth.types'

interface WalletContextValue {
  // Wallet state
  address: Address | undefined
  isConnected: boolean
  isConnecting: boolean
  chainId: number | undefined
  
  // Auth state
  isAuthenticated: boolean
  isAuthenticating: boolean
  authError: string | null
  
  // Actions
  authenticate: () => Promise<void>
  disconnect: () => Promise<void>
  switchToAbstract: () => Promise<void>
}

const WalletContext = createContext<WalletContextValue | undefined>(undefined)

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const { address, isConnected, isConnecting } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const { disconnectAsync } = useDisconnect()
  const chainId = useChainId()
  const { switchChainAsync } = useSwitchChain()
  
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  // Initialize auth state from storage
  useEffect(() => {
    const initAuth = async () => {
      if (!address) {
        setIsAuthenticated(false)
        return
      }

      const storedAddress = tokenStorage.getWalletAddress()
      const token = tokenStorage.getAccessToken()
      
      // Check if we have stored auth for this address
      if (storedAddress === address && token && !tokenStorage.isExpired()) {
        setIsAuthenticated(true)
        
        // Verify with backend
        try {
          await authService.getProfile()
        } catch (error) {
          // Token invalid, clear auth
          tokenStorage.clear()
          setIsAuthenticated(false)
        }
      } else if (storedAddress !== address) {
        // Different address connected, clear old auth
        tokenStorage.clear()
        setIsAuthenticated(false)
      }
    }

    initAuth()
  }, [address])

  // Auto-authenticate when wallet connects
  useEffect(() => {
    if (isConnected && address && !isAuthenticated && !isAuthenticating) {
      // Give user a moment to see they're connected before prompting to sign
      const timer = setTimeout(() => {
        authenticate()
      }, 500)
      
      return () => clearTimeout(timer)
    }
  }, [isConnected, address, isAuthenticated, isAuthenticating])

  // Handle wallet disconnection
  useEffect(() => {
    if (!isConnected && !address) {
      // Wallet was disconnected, clear auth state
      disconnect()
    }
  }, [isConnected, address, disconnect])

  // Listen for auth events
  useEffect(() => {
    const unsubscribeLogout = authEvents.on('logout', () => {
      setIsAuthenticated(false)
      tokenStorage.clear()
    })

    const unsubscribeLogin = authEvents.on('login', () => {
      setIsAuthenticated(true)
    })

    return () => {
      unsubscribeLogout()
      unsubscribeLogin()
    }
  }, [])

  const authenticate = useCallback(async () => {
    if (!address || !signMessageAsync) {
      setAuthError('No wallet connected')
      return
    }

    setIsAuthenticating(true)
    setAuthError(null)

    try {
      // Check if on correct chain
      if (chainId !== ABSTRACT_TESTNET_ID) {
        await switchToAbstract()
      }

      const timestamp = Date.now()
      const message = generateAuthMessage(address, timestamp)

      // Request signature
      const signature = await signMessageAsync({
        message,
      })

      // Login with backend
      const response: LoginResponse = await authService.login({
        address,
        signature,
        message,
        timestamp,
      })

      // Store tokens
      if (response.accessToken) {
        tokenStorage.setAccessToken(response.accessToken)
      }
      if (response.refreshToken) {
        tokenStorage.setRefreshToken(response.refreshToken)
      }
      if (response.expiresIn) {
        tokenStorage.setExpiresAt(response.expiresIn)
      }
      tokenStorage.setWalletAddress(address)

      // Update state
      setIsAuthenticated(true)
      
      // Invalidate queries to refetch with auth
      queryClient.invalidateQueries()
      
      // Emit auth event
      authEvents.emit('login', { address, user: response.user })
      
    } catch (error: any) {
      console.error('Authentication error:', error)
      
      if (error?.message?.includes('User rejected')) {
        setAuthError('Authentication cancelled')
      } else if (error?.message?.includes('Chain')) {
        setAuthError('Please switch to Abstract Testnet')
      } else {
        setAuthError(error?.message || 'Failed to authenticate')
      }
      
      setIsAuthenticated(false)
    } finally {
      setIsAuthenticating(false)
    }
  }, [address, signMessageAsync, chainId, queryClient])

  const disconnect = useCallback(async () => {
    try {
      // Logout from backend
      await authService.logout()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      // Always clear local state
      tokenStorage.clear()
      setIsAuthenticated(false)
      setAuthError(null)
      
      // Note: With RainbowKit, disconnection is handled through the ConnectButton
      // We don't need to manually call disconnectAsync here
      
      // Clear all cached data
      queryClient.clear()
      
      // Emit logout event
      authEvents.emit('logout')
    }
  }, [queryClient])

  const switchToAbstract = useCallback(async () => {
    if (!switchChainAsync) return
    
    try {
      await switchChainAsync({ chainId: ABSTRACT_TESTNET_ID })
    } catch (error: any) {
      console.error('Failed to switch chain:', error)
      throw new Error('Please switch to Abstract Testnet in your wallet')
    }
  }, [switchChainAsync])

  const value: WalletContextValue = {
    // Wallet state
    address,
    isConnected: !!isConnected,
    isConnecting: !!isConnecting,
    chainId,
    
    // Auth state
    isAuthenticated,
    isAuthenticating,
    authError,
    
    // Actions
    authenticate,
    disconnect,
    switchToAbstract,
  }

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  const context = useContext(WalletContext)
  if (!context) {
    throw new Error('useWallet must be used within WalletProvider')
  }
  return context
}