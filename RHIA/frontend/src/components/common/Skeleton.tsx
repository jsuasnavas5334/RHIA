import React from 'react'

interface SkeletonProps {
  width?: string
  height?: string
  className?: string
  count?: number
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = 'w-full',
  height = 'h-4',
  className = '',
  count = 1,
}) => {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`${width} ${height} bg-gray-200 dark:bg-gray-700 rounded animate-pulse-subtle mb-2 ${className}`}
        />
      ))}
    </>
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
