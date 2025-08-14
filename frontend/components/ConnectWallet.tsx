'use client'

import React from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useWallet } from '@/providers/WalletProvider'
import { RefreshCw, AlertCircle, CheckCircle } from 'lucide-react'

export function ConnectWallet() {
  const { 
    isAuthenticated, 
    isAuthenticating, 
    authError,
    authenticate,
  } = useWallet()

  // Custom ConnectButton with authentication status
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        authenticationStatus,
        mounted,
      }) => {
        // Note: If you're using Next.js App Router, you don't need to check if mounted
        const ready = mounted
        const connected =
          ready &&
          account &&
          chain &&
          (!authenticationStatus ||
            authenticationStatus === 'authenticated')

        return (
          <div
            {...(!ready && {
              'aria-hidden': true,
              style: {
                opacity: 0,
                pointerEvents: 'none',
                userSelect: 'none',
              },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <button
                    onClick={openConnectModal}
                    className="inline-flex items-center justify-center rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
                  >
                    Connect Wallet
                  </button>
                )
              }

              if (chain.unsupported) {
                return (
                  <button
                    onClick={openChainModal}
                    className="inline-flex items-center justify-center rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors"
                  >
                    <AlertCircle className="w-4 h-4 mr-2" />
                    Wrong network
                  </button>
                )
              }

              // Connected - show account with authentication status
              return (
                <div className="flex items-center gap-2">
                  {/* Authentication status indicator */}
                  {!isAuthenticated && !isAuthenticating && (
                    <button
                      onClick={authenticate}
                      className="inline-flex items-center justify-center rounded-lg bg-yellow-600 px-3 py-2 text-sm font-medium text-white hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 transition-colors"
                      title={authError || "Click to authenticate"}
                    >
                      <AlertCircle className="w-4 h-4 mr-1" />
                      Sign In
                    </button>
                  )}
                  
                  {isAuthenticating && (
                    <div className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white">
                      <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                      Signing...
                    </div>
                  )}

                  {/* Account button with chain switcher */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={openChainModal}
                      className="inline-flex items-center justify-center rounded-l-lg bg-gray-800 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                    >
                      {chain.hasIcon && (
                        <div
                          className="w-4 h-4 mr-2 rounded-full overflow-hidden"
                          style={{
                            background: chain.iconBackground,
                          }}
                        >
                          {chain.iconUrl && (
                            <img
                              alt={chain.name ?? 'Chain icon'}
                              src={chain.iconUrl}
                              className="w-4 h-4"
                            />
                          )}
                        </div>
                      )}
                      {chain.name}
                    </button>
                    
                    <button
                      onClick={openAccountModal}
                      className="inline-flex items-center justify-center rounded-r-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                    >
                      {isAuthenticated && (
                        <CheckCircle className="w-4 h-4 mr-2 text-green-400" />
                      )}
                      {account.displayName}
                      {account.displayBalance
                        ? ` (${account.displayBalance})`
                        : ''}
                    </button>
                  </div>
                </div>
              )
            })()}
          </div>
        )
      }}
    </ConnectButton.Custom>
  )
}