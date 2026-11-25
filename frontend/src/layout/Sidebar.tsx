import React from 'react'
import { Link } from 'react-router-dom'
import { BRAND_ICON } from './nav'
import { NavList } from './NavList'

export function Brand({ bare = false }: { bare?: boolean }) {
  const Icon = BRAND_ICON
  return (
    <Link
      to="/dashboard"
      className={`flex items-center gap-2.5 h-14 px-5 ${bare ? '' : 'border-b border-line'} focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent`}
    >
      <span className="flex items-center justify-center w-7 h-7 rounded-ctl bg-accent text-base" aria-hidden>
        <Icon size={15} />
      </span>
      <span className="text-lead font-semibold text-fg tracking-tight">VoyageIQ</span>
    </Link>
  )
}

/** Fixed rail on large screens. Below `lg` it is replaced by the drawer and bottom bar. */
export function Sidebar() {
  return (
    <aside aria-label="Sidebar" className="hidden lg:flex fixed inset-y-0 left-0 w-60 flex-col bg-base border-r border-line z-30">
      <Brand />
      <div className="flex-1 min-h-0 overflow-y-auto"><NavList /></div>
    </aside>
  )
}
