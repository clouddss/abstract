import { apiClient } from '../client';
import { Address } from '../types/common.types';
import {
  UserProfile,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  VerifyRequest,
  VerifyResponse,
  RefreshRequest,
  RefreshResponse,
  LogoutRequest,
  LogoutResponse
} from '../types/auth.types';

export class AuthService {
  private static instance: AuthService;
  
  private constructor() {}

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Generate authentication message for wallet signing
   */
  generateAuthMessage(address: Address, timestamp: number = Date.now()): string {
    const domain = typeof window !== 'undefined' ? window.location.origin : 'Abstract';
    return `Welcome to ${domain}!\n\nPlease sign this message to authenticate your wallet.\n\nWallet: ${address}\nTimestamp: ${timestamp}\nNonce: ${Math.random().toString(36).substring(2)}`;
  }

  /**
   * Login with wallet signature
   */
  async login(data: LoginRequest): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>('/auth/login', data);
    
    // Store auth tokens
    if (response.accessToken) {
      apiClient.setAuthToken(response.accessToken);
      if (typeof window !== 'undefined') {
        localStorage.setItem('auth_token', response.accessToken);
      }
    }
    
    if (response.refreshToken && typeof window !== 'undefined') {
      localStorage.setItem('refresh_token', response.refreshToken);
    }
    
    // Store user info
    if (response.user) {
      apiClient.setWalletAddress(response.user.address as Address);
      if (typeof window !== 'undefined') {
        localStorage.setItem('wallet_address', response.user.address);
      }
    }
    
    // Store expiration
    if (typeof window !== 'undefined' && response.expiresIn) {
      const expiresAt = Date.now() + response.expiresIn * 1000;
      localStorage.setItem('auth_expires_at', expiresAt.toString());
    }
    
    return response;
  }

  /**
   * Register a new user
   */
  async register(data: RegisterRequest): Promise<RegisterResponse> {
    return apiClient.post<RegisterResponse>('/auth/register', data);
  }

  /**
   * Verify email or phone
   */
  async verify(data: VerifyRequest): Promise<VerifyResponse> {
    return apiClient.post<VerifyResponse>('/auth/verify', data);
  }

  /**
   * Get current user profile
   */
  async getProfile(): Promise<UserProfile> {
    return apiClient.get<UserProfile>('/auth/profile');
  }

  /**
   * Update user profile
   */
  async updateProfile(data: Partial<UserProfile>): Promise<UserProfile> {
    return apiClient.patch<UserProfile>('/auth/profile', data);
  }

  /**
   * Refresh access token
   */
  async refresh(): Promise<RefreshResponse> {
    const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null;
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }
    
    const response = await apiClient.post<RefreshResponse>('/auth/refresh', { refreshToken });
    
    // Update tokens
    if (response.accessToken) {
      apiClient.setAuthToken(response.accessToken);
      if (typeof window !== 'undefined') {
        localStorage.setItem('auth_token', response.accessToken);
      }
    }
    
    if (response.refreshToken && typeof window !== 'undefined') {
      localStorage.setItem('refresh_token', response.refreshToken);
    }
    
    return response;
  }

  /**
   * Logout and clear authentication
   */
  async logout(): Promise<LogoutResponse> {
    const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null;
    
    try {
      const response = await apiClient.post<LogoutResponse>('/auth/logout', { refreshToken });
      return response;
    } catch (error) {
      // Return success even if API call fails
      return { success: true, message: 'Logged out locally' };
    } finally {
      // Clear auth data
      apiClient.setAuthToken(null);
      apiClient.setWalletAddress(null);
      
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('auth_expires_at');
        localStorage.removeItem('wallet_address');
        window.dispatchEvent(new CustomEvent('auth:logout'));
      }
    }
  }

  /**
   * Check if authentication is expired
   */
  isAuthExpired(): boolean {
    if (typeof window === 'undefined') return true;
    
    const expiresAt = localStorage.getItem('auth_expires_at');
    if (!expiresAt) return true;
    
    return Date.now() > parseInt(expiresAt);
  }

  /**
   * Get current authenticated address
   */
  getCurrentAddress(): Address | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('wallet_address') as Address | null;
  }

  /**
   * Initialize authentication from stored token
   */
  async initializeAuth(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    
    const token = localStorage.getItem('auth_token');
    const address = localStorage.getItem('wallet_address') as Address | null;
    
    if (!token || !address) {
      return false;
    }
    
    // Check if expired and try to refresh
    if (this.isAuthExpired()) {
      try {
        await this.refresh();
      } catch (error) {
        await this.logout();
        return false;
      }
    }
    
    // Set token and verify by getting profile
    apiClient.setAuthToken(token);
    apiClient.setWalletAddress(address);
    
    try {
      await this.getProfile();
      return true;
    } catch (error) {
      await this.logout();
      return false;
    }
  }

  /**
   * Request signature from wallet
   * This is a placeholder - actual implementation depends on wallet integration
   */
  async requestSignature(message: string, address: Address): Promise<string> {
    // This would typically use ethers.js or viem with the wallet provider
    throw new Error('Signature request not implemented. This should be handled by the wallet integration.');
  }

  /**
   * Complete authentication flow
   */
  async authenticateWallet(address: Address): Promise<LoginResponse> {
    const timestamp = Date.now();
    const message = this.generateAuthMessage(address, timestamp);
    
    // Request signature from wallet
    const signature = await this.requestSignature(message, address);
    
    // Login with backend
    return this.login({
      address,
      signature,
      message,
      timestamp,
    });
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    if (typeof window === 'undefined') return false;
    
    const token = localStorage.getItem('auth_token');
    const address = localStorage.getItem('wallet_address');
    
    return !!token && !!address && !this.isAuthExpired();
  }
}

// Export singleton instance
export const authService = AuthService.getInstance();