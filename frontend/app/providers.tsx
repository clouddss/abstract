'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { RainbowKitProvider, darkTheme, Theme } from '@rainbow-me/rainbowkit'
import '@rainbow-me/rainbowkit/styles.css'
import { config } from '../lib/wagmi'
import { WalletProvider } from '../providers/WalletProvider'
import { useState } from 'react'

// Custom Abstract theme for RainbowKit
const abstractTheme: Theme = darkTheme({
  accentColor: '#00D632', // Abstract accent green
  accentColorForeground: 'white',
  borderRadius: 'medium',
  fontStack: 'system',
  overlayBlur: 'small',
})

// Override specific theme properties for Abstract branding
abstractTheme.colors.modalBackground = '#0D1F0F' // Dark green background
abstractTheme.colors.modalText = 'white'
abstractTheme.colors.modalTextDim = 'rgba(255, 255, 255, 0.6)'
abstractTheme.colors.modalTextSecondary = 'rgba(255, 255, 255, 0.8)'
abstractTheme.colors.closeButton = 'rgba(255, 255, 255, 0.7)'
abstractTheme.colors.closeButtonBackground = 'rgba(255, 255, 255, 0.1)'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5, // 5 minutes
        refetchOnWindowFocus: false,
      },
    },
  }))

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider 
          theme={abstractTheme}
          modalSize="compact"
          appInfo={{
            appName: 'Abstract',
            disclaimer: ({ Text, Link }) => (
              <Text>
                By connecting your wallet, you agree to the{' '}
                <Link href="/terms">Terms of Service</Link> and acknowledge that you have read and understand the{' '}
                <Link href="/privacy">Privacy Policy</Link>.
              </Text>
            ),
          }}
        >
          <WalletProvider>
            {children}
          </WalletProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}