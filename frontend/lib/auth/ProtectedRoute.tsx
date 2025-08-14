'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useWallet } from '@/providers/WalletProvider'
import { RefreshCw } from 'lucide-react'

interface ProtectedRouteProps {
  children: React.ReactNode
  redirectTo?: string
  requireAuth?: boolean
}

export function ProtectedRoute({ 
  children, 
  redirectTo = '/',
  requireAuth = true 
}: ProtectedRouteProps) {
  const router = useRouter()
  const { isConnected, isAuthenticated, isAuthenticating } = useWallet()
  
  useEffect(() => {
    // If authentication is required but wallet is not connected or authenticated
    if (requireAuth && !isConnected && !isAuthenticating) {
      // Store the current path for redirect after login
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('redirectAfterAuth', window.location.pathname)
      }
      router.push(redirectTo)
    }
  }, [isConnected, isAuthenticated, isAuthenticating, requireAuth, router, redirectTo])

  // Show loading state while checking authentication
  if (requireAuth && (!isConnected || (isConnected && !isAuthenticated && !isAuthenticating))) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-gray-500" />
          <p className="text-gray-600 dark:text-gray-400">Checking authentication...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

// Hook version for use in components
export function useProtectedRoute(redirectTo: string = '/') {
  const router = useRouter()
  const { isConnected, isAuthenticated } = useWallet()
  
  useEffect(() => {
    if (!isConnected || !isAuthenticated) {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('redirectAfterAuth', window.location.pathname)
      }
      router.push(redirectTo)
    }
  }, [isConnected, isAuthenticated, router, redirectTo])
  
  return { isConnected, isAuthenticated }
}