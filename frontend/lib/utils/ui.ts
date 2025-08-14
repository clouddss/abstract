import { ReactNode } from 'react'

// Empty state component props
export interface EmptyStateProps {
  title: string
  description?: string
  icon?: ReactNode
  action?: {
    label: string
    onClick: () => void
  }
}

// Error state component props
export interface ErrorStateProps {
  title?: string
  message: string
  retry?: () => void
}

// Get error message from various error types
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  
  if (typeof error === 'string') {
    return error
  }
  
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message)
  }
  
  return 'An unexpected error occurred'
}

// Debounce function for search inputs
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    
    timeout = setTimeout(() => {
      func(...args)
    }, wait)
  }
}

// Throttle function for scroll events
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      
      setTimeout(() => {
        inThrottle = false
      }, limit)
    }
  }
}

// Copy to clipboard
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      textArea.style.top = '-999999px'
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      
      const successful = document.execCommand('copy')
      document.body.removeChild(textArea)
      
      return successful
    }
  } catch {
    return false
  }
}

// Get relative time string
export function getRelativeTime(date: Date | string | number): string {
  const now = new Date()
  const past = new Date(date)
  const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000)
  
  if (diffInSeconds < 60) return 'just now'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`
  
  return past.toLocaleDateString()
}

// Truncate text with ellipsis
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 3) + '...'
}

// Generate gradient colors for progress
export function getProgressGradient(progress: number): string {
  if (progress < 25) return 'from-red-500 to-orange-500'
  if (progress < 50) return 'from-orange-500 to-yellow-500'
  if (progress < 75) return 'from-yellow-500 to-green-500'
  return 'from-green-500 to-emerald-500'
}

// Check if wallet is connected
export function isWalletConnected(): boolean {
  if (typeof window === 'undefined') return false
  
  const address = localStorage.getItem('wallet_address')
  const token = localStorage.getItem('auth_token')
  
  return !!(address && token)
}

// Format error for display
export function formatError(error: unknown): string {
  const message = getErrorMessage(error)
  
  // Handle common blockchain errors
  if (message.includes('insufficient funds')) {
    return 'Insufficient funds in your wallet'
  }
  
  if (message.includes('user rejected') || message.includes('user denied')) {
    return 'Transaction cancelled by user'
  }
  
  if (message.includes('network') || message.includes('connection')) {
    return 'Network error. Please check your connection and try again'
  }
  
  if (message.includes('gas')) {
    return 'Gas estimation failed. Please try again'
  }
  
  // Clean up technical messages
  if (message.length > 100) {
    return 'An error occurred. Please try again'
  }
  
  return message
}

// Generate unique ID
export function generateId(prefix: string = 'id'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// Check if element is in viewport
export function isInViewport(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect()
  
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  )
}

// Smooth scroll to element
export function scrollToElement(elementId: string, offset: number = 80): void {
  const element = document.getElementById(elementId)
  if (!element) return
  
  const elementPosition = element.getBoundingClientRect().top
  const offsetPosition = elementPosition + window.pageYOffset - offset
  
  window.scrollTo({
    top: offsetPosition,
    behavior: 'smooth'
  })
}