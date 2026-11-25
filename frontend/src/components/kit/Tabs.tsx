import React, { useRef } from 'react'

export interface TabItem { key: string; label: string }

interface TabsProps {
  items: TabItem[]
  value: string
  onChange: (key: string) => void
  label: string
}

/** Underline tabs with arrow-key navigation (roving tabindex), per the WAI-ARIA tabs pattern. */
export function Tabs({ items, value, onChange, label }: TabsProps) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    let next = -1
    if (e.key === 'ArrowRight') next = (index + 1) % items.length
    if (e.key === 'ArrowLeft') next = (index - 1 + items.length) % items.length
    if (e.key === 'Home') next = 0
    if (e.key === 'End') next = items.length - 1
    if (next >= 0) {
      e.preventDefault()
      onChange(items[next].key)
      refs.current[items[next].key]?.focus()
    }
  }

  return (
    <div role="tablist" aria-label={label} className="flex gap-1 border-b border-line overflow-x-auto">
      {items.map((t, i) => {
        const active = t.key === value
        return (
          <button
            key={t.key}
            ref={el => { refs.current[t.key] = el }}
            role="tab"
            id={`tab-${t.key}`}
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.key)}
            onKeyDown={e => onKeyDown(e, i)}
            className={[
              'relative h-10 px-3 text-body whitespace-nowrap font-medium transition-colors duration-[150ms] ease-out',
              'focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
              active ? 'text-fg' : 'text-fg-muted hover:text-fg',
              // The underline is a pseudo-element so it can be coloured without affecting layout.
              "after:content-[''] after:absolute after:left-2 after:right-2 after:-bottom-px after:h-0.5 after:rounded-full",
              active ? 'after:bg-accent' : 'after:bg-transparent',
            ].join(' ')}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}
