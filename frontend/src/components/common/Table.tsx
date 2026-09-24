import React from 'react'

interface TableColumn<T> {
  key: keyof T | string
  header: string
  render?: (value: any, row: T, index: number) => React.ReactNode
  width?: string
  align?: 'left' | 'center' | 'right'
}

interface TableProps<T> {
  data: T[]
  columns: TableColumn<T>[]
  loading?: boolean
  empty?: string
  onRowClick?: (row: T) => void
  rowKey: keyof T
}

export const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement> & TableProps<any>
>(({ data, columns, loading = false, empty = 'No hay datos', onRowClick, rowKey, ...props }, ref) => {
  if (loading) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        Cargando...
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        {empty}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table
        ref={ref}
        className="w-full border-collapse"
        {...props}
      >
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-800">
            {columns.map((col) => (
              <th
                key={String(col.key)}
                className={`px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider ${
                  col.align === 'center'
                    ? 'text-center'
                    : col.align === 'right'
                      ? 'text-right'
                      : 'text-left'
                }`}
                style={{ width: col.width }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr
              key={String(row[rowKey])}
              className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((col) => (
                <td
                  key={`${String(row[rowKey])}-${String(col.key)}`}
                  className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white ${
                    col.align === 'center'
                      ? 'text-center'
                      : col.align === 'right'
                        ? 'text-right'
                        : 'text-left'
                  }`}
                  style={{ width: col.width }}
                >
                  {col.render
                    ? col.render(row[col.key as keyof typeof row], row, rowIndex)
                    : String(row[col.key as keyof typeof row] || '-')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
})

Table.displayName = 'Table'
