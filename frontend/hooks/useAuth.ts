import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authService } from '@/lib/api/services/auth.service'
import { 
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  VerifyRequest,
  VerifyResponse,
  RefreshResponse,
  UserProfile
} from '@/lib/api/types/auth.types'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

// Hook for user authentication state
export function useAuth() {
  const queryClient = useQueryClient()
  
  // Check if we have a stored token
  const hasToken = typeof window !== 'undefined' ? !!localStorage.getItem('auth_token') : false
  
  const { data: user, isLoading } = useQuery<UserProfile | null, Error>({
    queryKey: ['auth', 'user'],
    queryFn: async () => {
      try {
        return await authService.getProfile()
      } catch (error) {
        // If not authenticated, return null instead of throwing
        return null
      }
    },
    enabled: hasToken, // Only query if we have a token
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: false, // Don't retry auth checks
  })
  
  const isAuthenticated = !!user
  
  return {
    user,
    isAuthenticated,
    isLoading: hasToken ? isLoading : false,
  }
}

// Hook for login
export function useLogin() {
  const queryClient = useQueryClient()
  const router = useRouter()
  
  return useMutation<LoginResponse, Error, LoginRequest>({
    mutationFn: (data) => authService.login(data),
    onSuccess: (response) => {
      // Store tokens
      if (response.accessToken) {
        localStorage.setItem('accessToken', response.accessToken)
      }
      if (response.refreshToken) {
        localStorage.setItem('refreshToken', response.refreshToken)
      }
      
      // Set user data in cache
      queryClient.setQueryData(['auth', 'user'], response.user)
      
      // Invalidate all queries to refetch with new auth
      queryClient.invalidateQueries()
      
      // Redirect to dashboard or previous page
      const redirectTo = sessionStorage.getItem('redirectAfterLogin') || '/dashboard'
      sessionStorage.removeItem('redirectAfterLogin')
      router.push(redirectTo)
    },
  })
}

// Hook for registration
export function useRegister() {
  const queryClient = useQueryClient()
  const router = useRouter()
  
  return useMutation<RegisterResponse, Error, RegisterRequest>({
    mutationFn: (data) => authService.register(data),
    onSuccess: (response) => {
      // Store tokens if provided
      if (response.accessToken) {
        localStorage.setItem('accessToken', response.accessToken)
      }
      if (response.refreshToken) {
        localStorage.setItem('refreshToken', response.refreshToken)
      }
      
      // Set user data if available
      if (response.user) {
        queryClient.setQueryData(['auth', 'user'], response.user)
      }
      
      // Redirect to verification or dashboard
      if (response.requiresVerification) {
        router.push('/auth/verify')
      } else {
        router.push('/dashboard')
      }
    },
  })
}

// Hook for logout
export function useLogout() {
  const queryClient = useQueryClient()
  const router = useRouter()
  
  return useMutation({
    mutationFn: () => authService.logout(),
    onSuccess: () => {
      // Clear tokens
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      
      // Clear all cached data
      queryClient.clear()
      
      // Redirect to login
      router.push('/auth/login')
    },
    onError: () => {
      // Even if logout fails, clear local data
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      queryClient.clear()
      router.push('/auth/login')
    },
  })
}

// Hook for email verification
export function useVerifyEmail() {
  const queryClient = useQueryClient()
  const router = useRouter()
  
  return useMutation<VerifyResponse, Error, VerifyRequest>({
    mutationFn: (data) => authService.verify(data),
    onSuccess: (response) => {
      // Update user verification status
      if (response.user) {
        queryClient.setQueryData(['auth', 'user'], response.user)
      }
      
      // Redirect to dashboard
      router.push('/dashboard')
    },
  })
}

// Hook for refreshing tokens
export function useRefreshToken() {
  return useMutation<RefreshResponse, Error>({
    mutationFn: () => authService.refresh(),
    onSuccess: (response) => {
      // Update tokens
      if (response.accessToken) {
        localStorage.setItem('accessToken', response.accessToken)
      }
      if (response.refreshToken) {
        localStorage.setItem('refreshToken', response.refreshToken)
      }
    },
    retry: false,
  })
}

// Hook for updating user profile
export function useUpdateProfile() {
  const queryClient = useQueryClient()
  
  return useMutation<UserProfile, Error, Partial<UserProfile>>({
    mutationFn: (data) => authService.updateProfile(data),
    onSuccess: (updatedUser) => {
      // Update cached user data
      queryClient.setQueryData(['auth', 'user'], updatedUser)
    },
  })
}

// Hook for protected routes
export function useRequireAuth(redirectTo: string = '/auth/login') {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // Save current path for redirect after login
      sessionStorage.setItem('redirectAfterLogin', window.location.pathname)
      router.push(redirectTo)
    }
  }, [isAuthenticated, isLoading, router, redirectTo])
  
  return { isAuthenticated, isLoading }
}

// Hook for guest routes (redirect if authenticated)
export function useRequireGuest(redirectTo: string = '/dashboard') {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push(redirectTo)
    }
  }, [isAuthenticated, isLoading, router, redirectTo])
  
  return { isAuthenticated, isLoading }
}

// Hook for checking specific permissions
export function usePermission(permission: string) {
  const { user } = useAuth()
  
  const hasPermission = user?.permissions?.includes(permission) || false
  const isAdmin = user?.role === 'admin'
  
  return {
    hasPermission: isAdmin || hasPermission,
    isAdmin,
  }
}