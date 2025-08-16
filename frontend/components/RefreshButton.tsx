'use client'

import React from 'react'

interface RefreshButtonProps {
  onRefresh?: () => void
  children: React.ReactNode
  className?: string
}

export function RefreshButton({ onRefresh, children, className }: RefreshButtonProps) {
  const handleClick = () => {
    if (onRefresh) {
      onRefresh()
    } else {
      window.location.reload()
    }
  }

  return (
    <button onClick={handleClick} className={className}>
      {children}
    </button>
  )
}