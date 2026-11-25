import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { findNav } from './nav'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { BottomBar, Drawer } from './MobileNav'
import { CommandPalette } from './CommandPalette'
import { Skeleton } from '../components/kit'

function PageFallback() {
  return (
    <div className="grid gap-4" aria-busy="true" aria-label="Loading page">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-4 w-80" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}</div>
    </div>
  )
}

/**
 * Layout for every signed-in page: fixed sidebar on large screens, drawer and bottom bar on small ones.
 * Route changes are instant (no exit/enter animation); focus moves to the page so keyboard and
 * screen-reader users land at the top of new content.
 */
export function AppShell() {
  const [drawer, setDrawer] = useState(false)
  const [palette, setPalette] = useState(false)
  const { pathname } = useLocation()
  const main = useRef<HTMLElement>(null)
  const first = useRef(true)

  const closeDrawer = useCallback(() => setDrawer(false), [])
  const closePalette = useCallback(() => setPalette(false), [])

  // Every page gets a tab title from the navigation. This is a layout effect so that a page's own
  // PageHeader (a normal effect, which runs afterwards) can refine it.
  useLayoutEffect(() => {
    const here = findNav(pathname)
    document.title = here ? `${here.item.label} · VoyageIQ` : 'VoyageIQ'
  }, [pathname])

  useEffect(() => {
    setDrawer(false)
    if (first.current) { first.current = false; return }
    window.scrollTo({ top: 0 })
    main.current?.focus({ preventScroll: true })
  }, [pathname])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette(p => !p) }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="min-h-[100dvh] bg-base text-fg">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[70] focus:px-3 focus:py-2 focus:rounded-ctl focus:bg-accent focus:text-base focus:text-body focus:font-medium"
      >
        Skip to content
      </a>

      <Sidebar />
      <Drawer open={drawer} onClose={closeDrawer} />
      <CommandPalette open={palette} onClose={closePalette} />

      <div className="lg:pl-60 min-h-[100dvh] flex flex-col">
        <TopBar onMenu={() => setDrawer(true)} onSearch={() => setPalette(true)} />
        <main
          id="main"
          ref={main}
          tabIndex={-1}
          className="flex-1 w-full max-w-[1440px] mx-auto px-4 md:px-6 lg:px-8 py-6 pb-24 lg:pb-8 outline-none"
        >
          <React.Suspense fallback={<PageFallback />}>
            <Outlet />
          </React.Suspense>
        </main>
      </div>

      <BottomBar onMore={() => setDrawer(true)} />
    </div>
  )
}
