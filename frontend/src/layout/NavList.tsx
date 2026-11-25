import React from 'react'
import { NavLink } from 'react-router-dom'
import { NAV_GROUPS } from './nav'

/**
 * The grouped navigation. Used in the desktop sidebar and inside the mobile drawer.
 * The active page is marked with an accent rule plus aria-current, not by colour alone.
 */
export function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="px-3 py-4 space-y-5 overflow-y-auto">
      {NAV_GROUPS.map(group => (
        <div key={group.label}>
          <p className="px-3 mb-1.5 text-meta uppercase text-fg-subtle">{group.label}</p>
          <ul className="space-y-0.5">
            {group.items.map(item => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    [
                      'relative flex items-center gap-3 h-9 px-3 rounded-ctl text-body font-medium',
                      'transition-colors duration-[120ms] ease-out',
                      'focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
                      isActive
                        ? 'bg-accent/10 text-fg before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:rounded-full before:bg-accent'
                        : 'text-fg-muted [@media(hover:hover)]:hover:bg-fg/5 [@media(hover:hover)]:hover:text-fg',
                    ].join(' ')
                  }
                >
                  <item.icon size={16} aria-hidden className="shrink-0" />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}
