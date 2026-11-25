import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useAuthStore } from '../store/authStore'

function initials(name?: string, email?: string) {
  const source = (name || email || '?').trim()
  const parts = source.split(/\s+/)
  return ((parts[0]?.[0] ?? '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

/** Account menu. The popover grows from its trigger (top right) in 150ms; Esc or an outside click closes it. */
export function UserMenu() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <div ref={root} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="w-8 h-8 rounded-full grid place-items-center bg-surface-2 border border-line-strong text-label font-semibold text-fg
                   transition-[transform,border-color] duration-[140ms] ease-out active:scale-[0.96] hover:border-fg-subtle
                   focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {initials(user?.full_name, user?.email)}
      </button>

      <div
        role="menu"
        aria-hidden={!open}
        className={`absolute right-0 top-full mt-2 w-64 origin-top-right bg-surface-2 border border-line-strong rounded-panel p-1.5 z-50
          transition-[opacity,transform] duration-[150ms] ease-out
          ${open ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}
      >
        <div className="px-3 py-2">
          <p className="text-body font-medium text-fg truncate">{user?.full_name || 'Signed in'}</p>
          <p className="text-label text-fg-muted truncate">{user?.email}</p>
          <p className="text-meta text-fg-subtle mt-1 capitalize normal-case tracking-normal">
            {[user?.role, user?.company_name].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="h-px bg-line my-1" />
        <button
          role="menuitem"
          tabIndex={open ? 0 : -1}
          onClick={() => { setOpen(false); logout(); navigate('/login') }}
          className="w-full flex items-center gap-2 h-9 px-3 rounded-ctl text-body text-fg-muted hover:bg-fg/5 hover:text-fg
                     focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
        >
          <LogOut size={14} aria-hidden /> Sign out
        </button>
      </div>
    </div>
  )
}
