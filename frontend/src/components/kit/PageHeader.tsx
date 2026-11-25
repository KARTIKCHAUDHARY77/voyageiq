import React, { useEffect } from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
}

/** Every page uses this, so titles look the same and the browser tab names the page. */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  useEffect(() => {
    document.title = `${title} · VoyageIQ`
  }, [title])

  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
      <div className="min-w-0">
        <h1 className="text-title font-semibold text-fg">{title}</h1>
        {description && <p className="text-body text-fg-muted mt-1 max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
