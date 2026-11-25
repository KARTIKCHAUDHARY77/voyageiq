import {
  Anchor, Bot, ClipboardList, CloudLightning, FileBarChart2, Fuel, LayoutDashboard, Map, Navigation, Ship, TriangleAlert,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  path: string
  label: string
  icon: LucideIcon
  /** Words the command palette also matches. */
  keywords?: string
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

/** One source of truth for the sidebar, the mobile bar, the command palette and the top-bar breadcrumb. */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Operate',
    items: [
      { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, keywords: 'overview fleet kpi home' },
      { path: '/vessels', label: 'Vessels', icon: Ship, keywords: 'ships fleet imo' },
      { path: '/voyages', label: 'Voyages', icon: Navigation, keywords: 'trips routes' },
      { path: '/noon-reports', label: 'Noon Reports', icon: ClipboardList, keywords: 'upload csv daily' },
    ],
  },
  {
    label: 'Analyse',
    items: [
      { path: '/fuel-analytics', label: 'Fuel Analytics', icon: Fuel, keywords: 'consumption bunker efficiency' },
      { path: '/weather', label: 'Weather Intelligence', icon: CloudLightning, keywords: 'wind waves beaufort' },
      { path: '/claims', label: 'Claim Detector', icon: TriangleAlert, keywords: 'charter performance speed' },
      { path: '/reports', label: 'Reports', icon: FileBarChart2, keywords: 'pdf excel export' },
    ],
  },
  {
    label: 'Plan',
    items: [
      { path: '/voyage-optimizer', label: 'Voyage Optimizer', icon: Map, keywords: 'route speed simulate' },
      { path: '/copilot', label: 'AI Copilot', icon: Bot, keywords: 'assistant chat ask' },
    ],
  },
]

export const ALL_NAV: NavItem[] = NAV_GROUPS.flatMap(g => g.items)

/** The four destinations shown in the mobile bottom bar. Everything else is behind "More". */
export const PRIMARY_MOBILE: string[] = ['/dashboard', '/vessels', '/voyages', '/noon-reports']

export function findNav(pathname: string): { group: NavGroup; item: NavItem } | null {
  for (const group of NAV_GROUPS) {
    const item = group.items.find(i => pathname === i.path || pathname.startsWith(i.path + '/'))
    if (item) return { group, item }
  }
  return null
}

export const BRAND_ICON = Anchor
