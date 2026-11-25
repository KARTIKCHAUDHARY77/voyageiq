import React from 'react'

export interface Column<T> {
  key: string
  header: string
  /** Right-align and use monospaced tabular figures. */
  numeric?: boolean
  render?: (row: T) => React.ReactNode
  /** Tailwind width class, e.g. 'w-32'. */
  width?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  caption: string
  empty?: React.ReactNode
  onRowClick?: (row: T) => void
}

/**
 * Dense, scannable table. Header stays visible while the body scrolls, numbers align on the
 * decimal point, and the whole table scrolls sideways inside its container on narrow screens.
 */
export function DataTable<T>({ columns, rows, rowKey, caption, empty, onRowClick }: DataTableProps<T>) {
  return (
    <div className="overflow-auto max-h-[28rem]" tabIndex={0} role="region" aria-label={caption}>
      <table className="w-full text-body border-separate border-spacing-0">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map(c => (
              <th
                key={c.key}
                scope="col"
                className={`sticky top-0 z-10 bg-surface-1 border-b border-line px-4 h-9 text-label font-medium text-fg-muted whitespace-nowrap ${c.numeric ? 'text-right' : 'text-left'} ${c.width ?? ''}`}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`group ${onRowClick ? 'cursor-pointer' : ''}`}
            >
              {columns.map(c => (
                <td
                  key={c.key}
                  className={`px-4 h-10 whitespace-nowrap border-b border-line text-fg transition-colors duration-[120ms] group-hover:bg-fg/[0.03] ${c.numeric ? 'text-right font-mono tabular-nums' : ''}`}
                >
                  {c.render ? c.render(row) : ((row as Record<string, unknown>)[c.key] as React.ReactNode) ?? <span className="text-fg-subtle">–</span>}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-fg-subtle">{empty ?? 'Nothing to show.'}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
