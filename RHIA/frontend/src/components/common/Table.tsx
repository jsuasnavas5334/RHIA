import React from 'react'

export interface Column<T> {
  key: keyof T | string
  /** Texto del encabezado (alias: `label`) */
  header?: string
  label?: string
  render?: (value: any, row: T, index: number) => React.ReactNode
  width?: string
  align?: 'left' | 'center' | 'right'
}

/** @deprecated usar `Column` */
export type TableColumn<T> = Column<T>

export interface TableProps<T> {
  data: T[]
  columns: Column<T>[]
  loading?: boolean
  /** Mensaje cuando no hay datos (alias: `emptyMessage`) */
  empty?: string
  emptyMessage?: string
  onRowClick?: (row: T) => void
  /** Campo único por fila; por defecto `id`, o el índice si no existe */
  rowKey?: keyof T
  striped?: boolean
  hover?: boolean
}

const alignClass = (align?: 'left' | 'center' | 'right') =>
  align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'

export const Table = React.forwardRef<
  HTMLTableElement,
  Omit<React.HTMLAttributes<HTMLTableElement>, 'onClick'> & TableProps<any>
>(
  (
    {
      data,
      columns,
      loading = false,
      empty,
      emptyMessage,
      onRowClick,
      rowKey,
      striped = false,
      hover = true,
      className = '',
      ...props
    },
    ref
  ) => {
    if (loading) {
      return (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">Cargando...</div>
      )
    }

    if (data.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          {emptyMessage ?? empty ?? 'No hay datos'}
        </div>
      )
    }

    const getKey = (row: any, index: number) => {
      const k = rowKey ?? 'id'
      return row?.[k] !== undefined && row?.[k] !== null ? String(row[k]) : String(index)
    }

    return (
      <div className="overflow-x-auto">
        <table ref={ref} className={`w-full border-collapse ${className}`.trim()} {...props}>
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-800">
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  scope="col"
                  className={`px-6 py-3 text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider ${alignClass(col.align)}`}
                  style={{ width: col.width }}
                >
                  {col.header ?? col.label ?? String(col.key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIndex) => {
              const key = getKey(row, rowIndex)
              const rowClasses = [
                'border-b border-gray-200 dark:border-gray-700 transition-colors',
                striped && rowIndex % 2 === 1 ? 'bg-gray-50 dark:bg-slate-800/50' : '',
                hover ? 'hover:bg-gray-100 dark:hover:bg-slate-800' : '',
                onRowClick ? 'cursor-pointer' : '',
              ]
                .filter(Boolean)
                .join(' ')
              return (
                <tr
                  key={key}
                  className={rowClasses}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((col) => {
                    const value = row[col.key as keyof typeof row]
                    return (
                      <td
                        key={`${key}-${String(col.key)}`}
                        className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white ${alignClass(col.align)}`}
                        style={{ width: col.width }}
                      >
                        {col.render
                          ? col.render(value, row, rowIndex)
                          : value === undefined || value === null || value === ''
                            ? '-'
                            : String(value)}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }
)

Table.displayName = 'Table'

export default Table
