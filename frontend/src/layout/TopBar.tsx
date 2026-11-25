import React from 'react'
import { useLocation } from 'react-router-dom'
import { Menu, Search } from 'lucide-react'
import { findNav } from './nav'
import { UserMenu } from './UserMenu'

interface TopBarProps {
  onMenu: () => void
  onSearch: () => void
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

export function TopBar({ onMenu, onSearch }: TopBarProps) {
  const { pathname } = useLocation()
  const here = findNav(pathname)

  return (
    <header className="sticky top-0 z-20 h-14 flex items-center gap-3 px-4 md:px-6 lg:px-8 bg-base/90 backdrop-blur-[2px] border-b border-line">
      <button
        onClick={onMenu}
        aria-label="Open navigation"
        className="lg:hidden -ml-2 w-10 h-10 grid place-items-center rounded-ctl text-fg-muted hover:text-fg
                   focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        <Menu size={20} />
      </button>

      {/* Where am I: section / page. The page itself carries the H1. */}
      <p className="text-body text-fg-subtle truncate">
        {here ? (<><span>{here.group.label}</span><span className="mx-2" aria-hidden>/</span><span className="text-fg-muted">{here.item.label}</span></>) : null}
      </p>

      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={onSearch}
          aria-label="Go to page (search)"
          className="flex items-center gap-2 h-8 px-2.5 rounded-ctl border border-line-strong text-label text-fg-muted bg-surface-1
                     transition-[border-color,color,transform] duration-[140ms] ease-out active:scale-[0.97]
                     [@media(hover:hover)]:hover:border-fg-subtle [@media(hover:hover)]:hover:text-fg
                     focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <Search size={14} aria-hidden />
          <span className="hidden sm:inline">Go to…</span>
          <kbd className="hidden md:inline text-meta text-fg-subtle border border-line-strong rounded px-1 normal-case tracking-normal">{isMac ? '⌘K' : 'Ctrl K'}</kbd>
        </button>
        <UserMenu />
      </div>
    </header>
  )
}
