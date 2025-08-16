'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ConnectWallet } from '@/components/ConnectWallet'
import { WalletErrorBoundary } from '@/components/ErrorBoundary'
import { 
  Rocket, 
  Menu, 
  X, 
  Home, 
  Coins, 
  Gift, 
  Trophy,
  Zap
} from 'lucide-react'

const navLinks = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/tokens', label: 'Tokens', icon: Coins },
  { href: '/launch', label: 'Launch', icon: Rocket },
  { href: '/rewards', label: 'Rewards', icon: Gift },
  { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
]

export function Navigation() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === href
    }
    return pathname.startsWith(href)
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-6 lg:px-8 pt-4">
      <div className="max-w-7xl mx-auto">
        <div className="glass-morphism rounded-[24px] sm:rounded-[28px] px-4 sm:px-6 shadow-lg">
          <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="relative">
              <svg viewBox="0 0 24 22" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-primary transition-transform group-hover:scale-110">
                <path d="M15.821 14.984L20.642 19.759L18.38 21.999L13.56 17.225C13.146 16.815 12.602 16.592 12.015 16.592C11.429 16.592 10.884 16.815 10.471 17.225L5.651 21.999L3.389 19.759L8.209 14.984H15.818H15.821Z" fill="currentColor"></path>
                <path d="M16.626 13.608L23.209 15.353L24.036 12.29L17.453 10.545C16.889 10.396 16.42 10.038 16.127 9.536C15.834 9.037 15.758 8.453 15.909 7.895L17.671 1.374L14.579 0.556L12.816 7.076L16.623 13.604L16.626 13.608Z" fill="currentColor"></path>
                <path d="M7.409 13.608L0.827 15.353L0 12.29L6.583 10.545C7.146 10.396 7.616 10.038 7.909 9.536C8.202 9.037 8.277 8.453 8.127 7.895L6.365 1.374L9.457 0.556L11.219 7.076L7.413 13.604L7.409 13.608Z" fill="currentColor"></path>
              </svg>
            </div>
            <span className="text-xl font-bold text-gray-900">
              
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1">
            {navLinks.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`
                  relative px-4 py-2 rounded-full transition-all duration-200 border
                  ${isActive(href) 
                    ? 'text-primary bg-white border-gray-200 shadow-md' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/70 border-transparent'
                  }
                `}
              >
                <div className="flex items-center space-x-2">
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </div>
              </Link>
            ))}
          </nav>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center space-x-4">
            <WalletErrorBoundary>
              <ConnectWallet />
            </WalletErrorBoundary>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-black/5 transition-colors"
          >
            {isOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isOpen && (
        <div className="md:hidden mt-4">
          <div className="glass-morphism rounded-[24px] sm:rounded-[28px] px-4 py-4 space-y-2 shadow-lg">
            {navLinks.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setIsOpen(false)}
                className={`
                  flex items-center space-x-3 px-4 py-3 rounded-full transition-all duration-200 border
                  ${isActive(href) 
                    ? 'text-primary bg-white border-gray-200 shadow-md' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/70 border-transparent'
                  }
                `}
              >
                <Icon className="h-5 w-5" />
                <span className="font-medium">{label}</span>
              </Link>
            ))}
            <div className="pt-4 border-t border-gray-200">
              <WalletErrorBoundary>
                <ConnectWallet />
              </WalletErrorBoundary>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}