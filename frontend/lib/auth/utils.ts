import { Address } from 'viem'

/**
 * Generate a standardized message for wallet authentication
 */
export function generateAuthMessage(address: Address, timestamp?: number): string {
  const ts = timestamp || Date.now()
  const domain = typeof window !== 'undefined' ? window.location.origin : 'Abstract'
  const nonce = Math.random().toString(36).substring(2, 15)
  
  return `Welcome to ${domain}!

Click "Sign" to authenticate your wallet.

This request will not trigger a blockchain transaction or cost any gas fees.

Wallet address:
${address}

Timestamp: ${ts}
Nonce: ${nonce}`
}

/**
 * Token storage utilities
 */
export const tokenStorage = {
  getAccessToken(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('auth_token')
  },

  setAccessToken(token: string): void {
    if (typeof window === 'undefined') return
    localStorage.setItem('auth_token', token)
  },

  getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('refresh_token')
  },

  setRefreshToken(token: string): void {
    if (typeof window === 'undefined') return
    localStorage.setItem('refresh_token', token)
  },

  getWalletAddress(): Address | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('wallet_address') as Address | null
  },

  setWalletAddress(address: Address): void {
    if (typeof window === 'undefined') return
    localStorage.setItem('wallet_address', address)
  },

  getExpiresAt(): number | null {
    if (typeof window === 'undefined') return null
    const expiresAt = localStorage.getItem('auth_expires_at')
    return expiresAt ? parseInt(expiresAt) : null
  },

  setExpiresAt(expiresIn: number): void {
    if (typeof window === 'undefined') return
    const expiresAt = Date.now() + expiresIn * 1000
    localStorage.setItem('auth_expires_at', expiresAt.toString())
  },

  isExpired(): boolean {
    const expiresAt = this.getExpiresAt()
    if (!expiresAt) return true
    return Date.now() > expiresAt
  },

  clear(): void {
    if (typeof window === 'undefined') return
    localStorage.removeItem('auth_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('auth_expires_at')
    localStorage.removeItem('wallet_address')
  }
}

/**
 * Auth event emitter for cross-component communication
 */
export const authEvents = {
  emit(event: 'login' | 'logout' | 'refresh', data?: any): void {
    if (typeof window === 'undefined') return
    window.dispatchEvent(new CustomEvent(`auth:${event}`, { detail: data }))
  },

  on(event: 'login' | 'logout' | 'refresh', handler: (data?: any) => void): () => void {
    if (typeof window === 'undefined') return () => {}
    
    const listener = (e: Event) => {
      handler((e as CustomEvent).detail)
    }
    
    window.addEventListener(`auth:${event}`, listener)
    return () => window.removeEventListener(`auth:${event}`, listener)
  }
}

/**
 * Chain validation
 */
export const ABSTRACT_TESTNET_ID = 11124

export function isCorrectChain(chainId: number): boolean {
  return chainId === ABSTRACT_TESTNET_ID
}

export function getChainName(chainId: number): string {
  if (chainId === ABSTRACT_TESTNET_ID) return 'Abstract Testnet'
  return `Chain ${chainId}`
}