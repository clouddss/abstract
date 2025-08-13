import { createConfig, http } from 'wagmi'
import { abstractTestnet } from 'wagmi/chains'

// Define Abstract testnet if not available in wagmi/chains
const abstractTestnetChain = {
  id: 11124,
  name: 'Abstract Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_RPC_URL || 'https://api.testnet.abs.xyz'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Abstract Explorer',
      url: process.env.NEXT_PUBLIC_EXPLORER_URL || 'https://explorer.testnet.abs.xyz',
    },
  },
  testnet: true,
} as const

export const config = createConfig({
  chains: [abstractTestnetChain],
  transports: {
    [abstractTestnetChain.id]: http(),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}