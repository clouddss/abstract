# Wallet Authentication System

This directory contains the wallet connection and authentication system for the Abstract frontend.

## Overview

The authentication system integrates wallet connections (via wagmi/viem) with backend API authentication using message signing.

## Key Components

### `WalletProvider` (`/providers/WalletProvider.tsx`)
- Manages wallet connection state
- Handles authentication flow with backend
- Persists authentication tokens
- Auto-reconnects on page refresh
- Manages chain switching to Abstract testnet

### `ConnectWallet` Component (`/components/ConnectWallet.tsx`)
- UI component for wallet connection
- Shows connection status and authentication state
- Supports MetaMask, WalletConnect, and Coinbase Wallet
- Handles chain switching and error states

### Authentication Utilities (`/lib/auth/utils.ts`)
- `generateAuthMessage()`: Creates standardized signing messages
- `tokenStorage`: Manages auth token persistence
- `authEvents`: Cross-component event communication
- Chain validation utilities

### Protected Routes (`/lib/auth/ProtectedRoute.tsx`)
- `ProtectedRoute` component for wrapping authenticated pages
- `useProtectedRoute` hook for component-level protection

## Authentication Flow

1. **Wallet Connection**: User connects wallet via wagmi
2. **Message Generation**: System generates a unique message with timestamp and nonce
3. **Signature Request**: User signs the message in their wallet
4. **Backend Verification**: Signed message sent to `/api/auth/login`
5. **Token Storage**: Access and refresh tokens stored in localStorage
6. **Auto-refresh**: Tokens automatically refreshed before expiration

## Usage

### Basic Wallet Connection
```tsx
import { ConnectWallet } from '@/components/ConnectWallet'

function Header() {
  return <ConnectWallet />
}
```

### Using Wallet State
```tsx
import { useWallet } from '@/providers/WalletProvider'

function MyComponent() {
  const { 
    address, 
    isAuthenticated, 
    authenticate, 
    disconnect 
  } = useWallet()
  
  // Component logic
}
```

### Protected Routes
```tsx
import { ProtectedRoute } from '@/lib/auth'

function ProtectedPage() {
  return (
    <ProtectedRoute>
      {/* Protected content */}
    </ProtectedRoute>
  )
}
```

### API Calls with Authentication
The API client automatically includes authentication headers:
```tsx
import { tokensService } from '@/lib/api'

// Headers automatically included
const tokens = await tokensService.getTokens()
```

## Environment Variables

Add to `.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_RPC_URL=https://api.testnet.abs.xyz
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
```

## Chain Configuration

The system is configured for Abstract Testnet (Chain ID: 11124). Update in `/lib/wagmi.ts` if needed.

## Token Management

- **Access Token**: Short-lived JWT for API requests
- **Refresh Token**: Long-lived token for obtaining new access tokens
- **Auto-refresh**: Tokens refreshed automatically on 401 responses
- **Expiration**: Stored and checked before API calls

## Events

The system emits events for cross-component communication:
- `auth:login`: Emitted on successful authentication
- `auth:logout`: Emitted on logout or token expiration
- `auth:refresh`: Emitted on token refresh