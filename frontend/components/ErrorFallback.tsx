'use client'

import React from 'react'

interface ErrorFallbackProps {
  message?: string
  onRefresh?: () => void
}

export function ErrorFallback({ 
  message = "The application encountered an error. Please refresh the page.",
  onRefresh
}: ErrorFallbackProps) {
  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh()
    } else {
      window.location.reload()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-red-500 mb-4">Application Error</h1>
        <p className="text-gray-400 mb-4">{message}</p>
        <button 
          onClick={handleRefresh}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Refresh Page
        </button>
      </div>
    </div>
  )
}