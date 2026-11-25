import React from 'react'

interface PanelProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  title?: React.ReactNode
  /** Small controls aligned to the right of the title (a select, a button). */
  actions?: React.ReactNode
  /** Remove body padding, for tables and charts that run edge to edge. */
  flush?: boolean
}

/** The one surface used for grouped content: flat fill, hairline border, no shadow. */
export function Panel({ title, actions, flush = false, className = '', children, ...rest }: PanelProps) {
  return (
    <section className={`bg-surface-1 border border-line rounded-panel ${className}`} {...rest}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 px-4 h-11 border-b border-line">
          {title && <h2 className="text-body font-semibold text-fg">{title}</h2>}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={flush ? '' : 'p-4'}>{children}</div>
    </section>
  )
}
