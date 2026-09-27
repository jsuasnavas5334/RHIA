import React from 'react'

interface CardProps {
  children: React.ReactNode
  className?: string
  title?: string
  subtitle?: string
  onClick?: () => void
  hoverable?: boolean
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  title,
  subtitle,
  onClick,
  hoverable = false,
}) => {
  return (
    <div
      className={`
        bg-white dark:bg-slate-900
        rounded-lg shadow-md
        p-6
        border border-gray-200 dark:border-gray-700
        ${hoverable ? 'hover:shadow-lg hover:border-blue-300 cursor-pointer transition-all duration-200' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      {(title || subtitle) && (
        <div className="mb-4">
          {title && <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>}
          {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  )
}

interface StatCardProps {
  label: string
  value: string | number
  trend?: 'up' | 'down'
  trendValue?: string
  icon?: React.ReactNode
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  trend,
  trendValue,
  icon,
}) => {
  return (
    <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">{label}</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{value}</p>
          {trend && trendValue && (
            <p className={`text-sm mt-2 ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
              {trend === 'up' ? '↑' : '↓'} {trendValue}
            </p>
          )}
        </div>
        {icon && <div className="text-4xl opacity-20">{icon}</div>}
      </div>
    </Card>
  )
}

export default Card
