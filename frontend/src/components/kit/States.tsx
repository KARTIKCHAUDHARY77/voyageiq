import React from 'react'
import { AlertCircle, Inbox } from 'lucide-react'
import { Button } from './Button'

/** Shown when a query succeeded but there is nothing to display. Say what is missing and how to fix it. */
export function EmptyState({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center py-12 px-6" role="status">
      <Inbox size={20} className="text-fg-subtle mb-3" aria-hidden />
      <p className="text-body font-medium text-fg">{title}</p>
      {children && <p className="text-body text-fg-muted mt-1 max-w-sm">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/** Shown when a request failed. Always offers a retry, and never shows stand-in data. */
export function ErrorState({ title = 'Could not load this', onRetry }: { title?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center text-center py-12 px-6" role="alert">
      <AlertCircle size={20} className="text-signal-port mb-3" aria-hidden />
      <p className="text-body font-medium text-fg">{title}</p>
      <p className="text-body text-fg-muted mt-1">Check your connection and try again.</p>
      {onRetry && <div className="mt-4"><Button onClick={onRetry}>Retry</Button></div>}
    </div>
  )
}

/** A neutral placeholder block. It pulses slowly because it signals "waiting", which is a purpose. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`rounded bg-fg/10 animate-pulse ${className}`} aria-hidden />
}
