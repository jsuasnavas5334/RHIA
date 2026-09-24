import React from 'react'
import { LeadStatus } from '../../types'

interface BadgeProps {
  status: LeadStatus | string
  className?: string
}

const statusColorMap: Record<string, { bg: string; text: string }> = {
  nuevo: { bg: 'bg-blue-100 dark:bg-blue-900', text: 'text-blue-800 dark:text-blue-200' },
  contactado: { bg: 'bg-yellow-100 dark:bg-yellow-900', text: 'text-yellow-800 dark:text-yellow-200' },
  respondio: { bg: 'bg-purple-100 dark:bg-purple-900', text: 'text-purple-800 dark:text-purple-200' },
  ganado: { bg: 'bg-green-100 dark:bg-green-900', text: 'text-green-800 dark:text-green-200' },
  perdido: { bg: 'bg-red-100 dark:bg-red-900', text: 'text-red-800 dark:text-red-200' },
}

const statusLabelMap: Record<string, string> = {
  nuevo: 'New',
  contactado: 'Contacted',
  respondio: 'Responded',
  ganado: 'Won',
  perdido: 'Lost',
}

export const Badge: React.FC<BadgeProps> = ({ status, className = '' }) => {
  const colors = statusColorMap[status] || statusColorMap.nuevo
  const label = statusLabelMap[status] || status

  return (
    <span
      className={`
        inline-flex items-center px-3 py-1
        rounded-full text-sm font-medium
        ${colors.bg} ${colors.text}
        ${className}
      `}
    >
      {label}
    </span>
  )
}

interface LoaderProps {
  size?: 'sm' | 'md' | 'lg'
  message?: string
}

export const Loader: React.FC<LoaderProps> = ({ size = 'md', message = 'Loading...' }) => {
  const sizeMap = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className={`${sizeMap[size]} animate-spin`}>
        <div className="h-full w-full border-4 border-blue-200 border-t-blue-600 rounded-full"></div>
      </div>
      {message && <p className="text-gray-600 dark:text-gray-400">{message}</p>}
    </div>
  )
}
