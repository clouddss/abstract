import React from 'react'

interface StatsCardProps {
  title: string
  value: string
  change: string
  icon: React.ReactNode
  loading?: boolean
}

export function StatsCard({ title, value, change, icon, loading }: StatsCardProps) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md animate-pulse">
        <div className="flex items-center justify-between mb-4">
          <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="w-16 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
        <div className="w-24 h-8 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
        <div className="w-16 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>
    )
  }

  const isPositive = change.startsWith('+')

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
      <div className="flex items-center justify-between mb-4">
        <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-purple-600 dark:text-purple-400">
          {icon}
        </div>
        <span className={`text-sm font-medium ${
          isPositive ? 'text-green-600' : 'text-red-600'
        }`}>
          {change}
        </span>
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
          {value}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {title}
        </p>
      </div>
    </div>
  )
}