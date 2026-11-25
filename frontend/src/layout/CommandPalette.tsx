import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Search } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ALL_NAV } from './nav'
import { useAuthStore } from '../store/authStore'

interface Command { id: string; label: string; hint?: string; icon: LucideIcon; run: () => void }

/**
 * Jump-to-page palette (Ctrl/Cmd+K). It is used many times a day from the keyboard,
 * so it opens and closes instantly with no animation.
 */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const logout = useAuthStore(s => s.logout)
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const opener = useRef<Element | null>(null)

  const commands: Command[] = useMemo(() => [
    ...ALL_NAV.map(n => ({ id: n.path, label: n.label, hint: n.keywords, icon: n.icon, run: () => navigate(n.path) })),
    { id: 'logout', label: 'Sign out', hint: 'log out exit', icon: LogOut, run: () => { logout(); navigate('/login') } },
  ], [navigate, logout])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter(c => `${c.label} ${c.hint ?? ''}`.toLowerCase().includes(q))
  }, [commands, query])

  useEffect(() => {
    if (open) {
      opener.current = document.activeElement
      setQuery(''); setIndex(0)
      requestAnimationFrame(() => input.current?.focus())
    } else {
      ;(opener.current as HTMLElement | null)?.focus?.()
    }
  }, [open])

  useEffect(() => setIndex(0), [query])

  if (!open) return null

  const choose = (c?: Command) => { if (!c) return; onClose(); c.run() }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setIndex(i => Math.min(i + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIndex(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); choose(results[index]) }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[12vh] px-4" onKeyDown={onKeyDown}>
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="Go to" className="relative w-full max-w-lg bg-surface-2 border border-line-strong rounded-panel overflow-hidden">
        <div className="flex items-center gap-2 px-3 h-12 border-b border-line">
          <Search size={16} className="text-fg-subtle" aria-hidden />
          <input
            ref={input}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Go to a page…"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={results[index] ? `cmd-${results[index].id}` : undefined}
            className="flex-1 bg-transparent text-body text-fg placeholder:text-fg-subtle outline-none"
          />
          <kbd className="text-meta text-fg-subtle border border-line-strong rounded px-1.5 py-0.5">Esc</kbd>
        </div>
        <ul id="palette-list" role="listbox" className="max-h-80 overflow-y-auto p-1.5">
          {results.map((c, i) => (
            <li
              key={c.id}
              id={`cmd-${c.id}`}
              role="option"
              aria-selected={i === index}
              onMouseMove={() => setIndex(i)}
              onClick={() => choose(c)}
              className={`flex items-center gap-3 h-9 px-3 rounded-ctl text-body cursor-pointer ${i === index ? 'bg-accent/10 text-fg' : 'text-fg-muted'}`}
            >
              <c.icon size={16} aria-hidden />
              {c.label}
            </li>
          ))}
          {results.length === 0 && <li className="px-3 py-6 text-center text-body text-fg-subtle">No matches</li>}
        </ul>
      </div>
    </div>
  )
}
