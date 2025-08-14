// Authentication types

export interface UserProfile {
  id: string
  address: string
  email?: string
  username?: string
  avatar?: string
  role?: 'user' | 'admin' | 'moderator'
  permissions?: string[]
  verified?: boolean
  createdAt: string
  updatedAt: string
}

export interface LoginRequest {
  address: string
  signature: string
  message: string
  timestamp: number
}

export interface LoginResponse {
  success: boolean
  user: UserProfile
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface RegisterRequest {
  address: string
  email?: string
  username?: string
  referralCode?: string
}

export interface RegisterResponse {
  success: boolean
  user?: UserProfile
  accessToken?: string
  refreshToken?: string
  requiresVerification?: boolean
  message?: string
}

export interface VerifyRequest {
  code: string
  type: 'email' | 'phone'
}

export interface VerifyResponse {
  success: boolean
  user: UserProfile
  message?: string
}

export interface RefreshRequest {
  refreshToken: string
}

export interface RefreshResponse {
  success: boolean
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface LogoutRequest {
  refreshToken?: string
}

export interface LogoutResponse {
  success: boolean
  message?: string
}