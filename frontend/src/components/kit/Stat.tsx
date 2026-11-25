import React from 'react'

interface StatProps {
  label: string
  /** Pass null when there is no data: the stat renders an en dash, never a guess. */
  value: string | number | null | undefined
  unit?: string
  /** Comparison against a real reference, e.g. the warranted value. Shown only when given. */
  delta?: { value: string; tone: 'good' | 'bad' | 'neutral'; label?: string }
  loading?: boolean
}

const TONE = { good: 'text-signal-starboard', bad: 'text-signal-port', neutral: 'text-fg-muted' }

/** A single measured figure. Numbers are tabular and monospaced so columns of stats line up. */
export function Stat({ label, value, unit, delta, loading }: StatProps) {
  const empty = value === null || value === undefined || value === ''
  return (
    <div className="bg-surface-1 border border-line rounded-panel p-4 min-w-0">
      <p className="text-label text-fg-muted truncate">{label}</p>
      {loading ? (
        <div className="mt-2 h-7 w-24 rounded bg-fg/10 animate-pulse" aria-hidden />
      ) : (
        <p className="mt-1 flex items-baseline gap-1.5">
          <span className={`font-mono text-[26px] leading-8 font-medium tabular-nums ${empty ? 'text-fg-subtle' : 'text-fg'}`}>
            {empty ? '–' : value}
          </span>
          {!empty && unit && <span className="text-label text-fg-subtle">{unit}</span>}
        </p>
      )}
      {delta && !loading && (
        <p className={`mt-1 text-label tabular-nums ${TONE[delta.tone]}`}>
          {delta.value}
          {delta.label && <span className="text-fg-subtle"> {delta.label}</span>}
        </p>
      )}
    </div>
  )
}
