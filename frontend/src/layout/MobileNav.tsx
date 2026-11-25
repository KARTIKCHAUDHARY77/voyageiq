import React, { useEffect, useRef } from 'react'
import { NavLink } from 'react-router-dom'
import { Ellipsis, X } from 'lucide-react'
import { ALL_NAV, PRIMARY_MOBILE } from './nav'
import { Brand } from './Sidebar'
import { NavList } from './NavList'

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'

/** Slide-over navigation for phones and tablets. Traps focus, closes on Esc, and restores focus. */
export function Drawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null)
  const opener = useRef<Element | null>(null)

  useEffect(() => {
    if (!open) return
    opener.current = document.activeElement
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panel.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key !== 'Tab' || !panel.current) return
      const items = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (items.length === 0) return
      const first = items[0], last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      ;(opener.current as HTMLElement | null)?.focus?.()
    }
  }, [open, onClose])

  return (
    <div className={`lg:hidden fixed inset-0 z-50 ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/60 transition-opacity duration-[200ms] ease-out ${open ? 'opacity-100' : 'opacity-0'}`}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        // `inert` keeps the closed drawer out of the tab order and the accessibility tree.
        {...(!open ? { inert: '' as unknown as boolean } : {})}
        className={`absolute inset-y-0 left-0 w-72 max-w-[85vw] flex flex-col bg-base border-r border-line
          transition-transform duration-[280ms] ease-[cubic-bezier(0.32,0.72,0,1)]
          ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex items-center justify-between pr-2 border-b border-line">
          <Brand bare />
          <button
            onClick={onClose}
            aria-label="Close navigation"
            className="w-10 h-10 grid place-items-center rounded-ctl text-fg-muted hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto"><NavList onNavigate={onClose} /></div>
      </div>
    </div>
  )
}

/** Four primary destinations plus "More". Large tap targets, clear of the home indicator. */
export function BottomBar({ onMore }: { onMore: () => void }) {
  const items = ALL_NAV.filter(i => PRIMARY_MOBILE.includes(i.path))
  return (
    <nav
      aria-label="Primary"
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-base/95 border-t border-line grid grid-cols-5 pb-[env(safe-area-inset-bottom)]"
    >
      {items.map(item => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-0.5 h-14 text-meta normal-case tracking-normal transition-colors duration-[120ms]
             focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent
             ${isActive ? 'text-accent' : 'text-fg-muted'}`
          }
        >
          <item.icon size={20} aria-hidden />
          <span>{item.label.replace(' Reports', '')}</span>
        </NavLink>
      ))}
      <button
        onClick={onMore}
        className="flex flex-col items-center justify-center gap-0.5 h-14 text-meta normal-case tracking-normal text-fg-muted
                   focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
      >
        <Ellipsis size={20} aria-hidden />
        <span>More</span>
      </button>
    </nav>
  )
}
