import React from 'react'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { Navigation } from '@/components/Navigation'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ErrorFallback } from '@/components/ErrorFallback'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Abstract Pump - Token Launch Platform',
  description: 'Launch and trade tokens on Abstract with bonding curves and rewards',
  keywords: ['defi', 'tokens', 'abstract', 'ethereum', 'bonding curve'],
  authors: [{ name: 'Abstract Pump Platform' }],
  creator: 'Abstract Pump Platform',
  publisher: 'Abstract Pump Platform',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://pump.abs.xyz',
    siteName: 'Abstract Pump',
    title: 'Abstract Pump - Token Launch Platform',
    description: 'Launch and trade tokens on Abstract with bonding curves and rewards',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Abstract Pump Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Abstract Pump - Token Launch Platform',
    description: 'Launch and trade tokens on Abstract with bonding curves and rewards',
    creator: '@AbstractChain',
    images: ['/og-image.png'],
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen bg-background text-foreground`}>
        <ErrorBoundary>
          <Providers>
            <ErrorBoundary fallback={<ErrorFallback />}>
              <div className="min-h-screen">
                <ErrorBoundary>
                  <Navigation />
                </ErrorBoundary>
                <main className="pt-16">
                  <ErrorBoundary>
                    {children}
                  </ErrorBoundary>
                </main>
              </div>
            </ErrorBoundary>
          </Providers>
        </ErrorBoundary>
      </body>
    </html>
  )
}