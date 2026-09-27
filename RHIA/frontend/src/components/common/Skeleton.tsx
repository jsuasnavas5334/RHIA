import React from 'react'

interface SkeletonProps {
  /** Tailwind class (e.g. "w-1/2") or any CSS length (e.g. "100px") */
  width?: string
  /** Tailwind class (e.g. "h-4") or any CSS length (e.g. "50px") */
  height?: string
  className?: string
  count?: number
  rounded?: boolean
}

const isTailwind = (value: string, prefix: 'w-' | 'h-') => value.startsWith(prefix)

export const Skeleton: React.FC<SkeletonProps> = ({
  width = 'w-full',
  height = 'h-4',
  className = '',
  count = 1,
  rounded = false,
}) => {
  const widthClass = isTailwind(width, 'w-') ? width : ''
  const heightClass = isTailwind(height, 'h-') ? height : ''
  const style: React.CSSProperties = {}
  if (!widthClass) style.width = width
  if (!heightClass) style.height = height

  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={style}
          className={`${widthClass} ${heightClass} bg-gray-200 dark:bg-gray-700 ${rounded ? 'rounded-full' : 'rounded'} animate-pulse-subtle mb-2 ${className}`}
        />
      ))}
    </>
  )
}

interface SkeletonTextProps {
  lines?: number
  className?: string
}

export const SkeletonText: React.FC<SkeletonTextProps> = ({ lines = 2, className = '' }) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={i === lines - 1 && lines > 1 ? 'w-2/3' : 'w-full'} className="mb-0" />
      ))}
    </div>
  )
}

interface SkeletonCardProps {
  count?: number
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({ count = 1 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white dark:bg-slate-900 rounded-lg shadow-md p-6 mb-4 border border-gray-200 dark:border-gray-700"
        >
          <Skeleton width="w-2/3" height="h-6" className="mb-4" />
          <Skeleton width="w-full" height="h-4" count={3} />
        </div>
      ))}
    </>
  )
}

interface SkeletonTableProps {
  rows?: number
  columns?: number
}

export const SkeletonTable: React.FC<SkeletonTableProps> = ({ rows = 5, columns = 4 }) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="px-6 py-3">
                <Skeleton width="w-full" height="h-4" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowI) => (
            <tr key={rowI} className="border-b border-gray-200 dark:border-gray-700">
              {Array.from({ length: columns }).map((_, colI) => (
                <td key={colI} className="px-6 py-4">
                  <Skeleton width="w-full" height="h-4" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
