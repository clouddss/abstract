import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { http } from 'wagmi'
import { Chain } from 'wagmi/chains'

// Define Abstract testnet chain
export const abstractTestnetChain: Chain = {
  id: 11124,
  name: 'Abstract Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_CHAIN_RPC_URL || 'https://api.testnet.abs.xyz'],
    },
    public: {
      http: [process.env.NEXT_PUBLIC_CHAIN_RPC_URL || 'https://api.testnet.abs.xyz'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Abstract Explorer',
      url: process.env.NEXT_PUBLIC_CHAIN_EXPLORER_URL || 'https://explorer.testnet.abs.xyz',
    },
  },
  testnet: true,
}

// RainbowKit configuration
export const config = getDefaultConfig({
  appName: 'Abstract',
  appDescription: 'Trade and launch tokens on Abstract',
  appUrl: typeof window !== 'undefined' ? window.location.origin : 'https://abstract.xyz',
  appIcon: 'https://abstract.xyz/icon.png',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID',
  chains: [abstractTestnetChain],
  transports: {
    [abstractTestnetChain.id]: http(process.env.NEXT_PUBLIC_CHAIN_RPC_URL || 'https://api.testnet.abs.xyz'),
  },
  ssr: true, // Enable SSR support
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}