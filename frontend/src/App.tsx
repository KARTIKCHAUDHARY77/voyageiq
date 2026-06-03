import React, { useEffect, useState, useCallback } from 'react'
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  NavLink,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Toaster } from 'react-hot-toast'
import {
  LayoutDashboard,
  Ship,
  Navigation,
  Fuel,
  Map,
  AlertTriangle,
  Bot,
  FileBarChart2,
  Anchor,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Settings,
  Bell,
  User as UserIcon,
  Activity,
  Waves,
  CloudLightning,
  ClipboardList,
} from 'lucide-react'
import { useAuthStore } from './store/authStore'

// ─── Lazy-loaded page components ─────────────────────────────────────────────
const LoginPage = React.lazy(() => import('./pages/LoginPage'))
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'))
const VesselsPage = React.lazy(() => import('./pages/VesselsPage'))
const VesselDetailPage = React.lazy(() => import('./pages/VesselDetailPage'))
const VoyagesPage = React.lazy(() => import('./pages/VoyagesPage'))
const VoyageDetailPage = React.lazy(() => import('./pages/VoyageDetailPage'))
const FuelAnalyticsPage = React.lazy(() => import('./pages/FuelAnalyticsPage'))
const VoyageOptimizerPage = React.lazy(() => import('./pages/VoyageOptimizerPage'))
const ClaimsPage = React.lazy(() => import('./pages/ClaimsPage'))
const CopilotPage = React.lazy(() => import('./pages/CopilotPage'))
const ReportsPage = React.lazy(() => import('./pages/ReportsPage'))
const WeatherIntelligencePage = React.lazy(() => import('./pages/WeatherIntelligencePage'))
const NoonReportPage = React.lazy(() => import('./pages/NoonReportPage'))

// ─── Nav Items ────────────────────────────────────────────────────────────────
interface NavItem {
  path: string
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  badge?: number
}

const NAV_ITEMS: NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/vessels', label: 'Vessels', icon: Ship },
  { path: '/voyages', label: 'Voyages', icon: Navigation },
  { path: '/fuel-analytics', label: 'Fuel Analytics', icon: Fuel },
  { path: '/voyage-optimizer', label: 'Voyage Optimizer', icon: Map },
  { path: '/weather', label: 'Weather Intel', icon: CloudLightning },
  { path: '/claims', label: 'Claim Detector', icon: AlertTriangle },
  { path: '/copilot', label: 'AI Copilot', icon: Bot },
  { path: '/reports', label: 'Reports', icon: FileBarChart2 },
  { path: '/noon-reports', label: 'Noon Reports', icon: ClipboardList },
]

// ─── Page Transition Wrapper ──────────────────────────────────────────────────
const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.2, ease: [0.4, 0, 1, 1] },
  },
}

function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="h-full"
    >
      {children}
    </motion.div>
  )
}

// ─── Loading Spinner ──────────────────────────────────────────────────────────
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-full min-h-[400px]">
      <div className="relative">
        <div className="w-12 h-12 rounded-full border-2 border-white/10 border-t-teal-400 animate-spin" />
        <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-transparent border-b-ocean-400 animate-spin"
          style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
        <Waves className="absolute inset-0 m-auto w-4 h-4 text-teal-400/60" />
      </div>
    </div>
  )
}

// ─── Protected Route ──────────────────────────────────────────────────────────
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuthStore()
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [hoveredPath, setHoveredPath] = useState<string | null>(null)

  const handleLogout = useCallback(() => {
    logout()
    navigate('/login')
  }, [logout, navigate])

  const sidebarWidth = collapsed ? 72 : 256

  return (
    <motion.aside
      animate={{ width: sidebarWidth }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="fixed top-0 left-0 h-full z-50 flex flex-col glass-sidebar"
      style={{ width: sidebarWidth }}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-3 overflow-hidden">
          {/* Anchor Icon */}
          <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-teal-400/20 to-ocean-500/20 border border-teal-400/20 flex items-center justify-center glow-teal-sm">
            <Anchor className="w-5 h-5 text-teal-400" />
          </div>
          <AnimatePresence mode="wait">
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
              >
                <span className="font-bold text-lg gradient-text-teal whitespace-nowrap glow-text-teal">
                  VoyageIQ
                </span>
                <p className="text-[10px] text-white/30 -mt-0.5 whitespace-nowrap">
                  Maritime Intelligence
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Toggle Button */}
        <button
          onClick={onToggle}
          className="flex-shrink-0 w-7 h-7 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center text-white/40 hover:text-teal-400 hover:bg-teal-400/10 hover:border-teal-400/20 transition-all duration-200"
        >
          {collapsed ? (
            <ChevronRight className="w-3.5 h-3.5" />
          ) : (
            <ChevronLeft className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Online Status Pill */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mx-4 mt-3 mb-1 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/15 flex items-center gap-2"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-blink" />
            <span className="text-[11px] text-green-400/80 font-medium">Fleet Online</span>
            <span className="ml-auto text-[10px] text-white/30">Live</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2 px-2 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.path ||
            (item.path !== '/dashboard' && location.pathname.startsWith(item.path))
          const isHovered = hoveredPath === item.path

          return (
            <NavLink
              key={item.path}
              to={item.path}
              onMouseEnter={() => setHoveredPath(item.path)}
              onMouseLeave={() => setHoveredPath(null)}
            >
              <motion.div
                className={`
                  relative flex items-center gap-3 rounded-xl px-3 py-2.5 cursor-pointer
                  transition-colors duration-200 group
                  ${isActive
                    ? 'bg-gradient-to-r from-teal-400/15 to-ocean-500/10 text-teal-400'
                    : 'text-white/50 hover:text-white/85 hover:bg-white/[0.04]'
                  }
                `}
                whileTap={{ scale: 0.97 }}
              >
                {/* Active left border */}
                <motion.div
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 rounded-full bg-teal-400"
                  animate={{ height: isActive ? '60%' : '0%', opacity: isActive ? 1 : 0 }}
                  transition={{ duration: 0.2 }}
                />

                {/* Active background glow */}
                {isActive && (
                  <motion.div
                    layoutId="nav-glow"
                    className="absolute inset-0 rounded-xl"
                    style={{
                      background: 'radial-gradient(ellipse at left, rgba(45,212,191,0.06) 0%, transparent 70%)',
                    }}
                  />
                )}

                {/* Icon */}
                <div className="relative flex-shrink-0">
                  <Icon
                    size={18}
                    className={`transition-all duration-200 ${isActive ? 'text-teal-400' : ''} ${isHovered && !isActive ? 'text-white/80' : ''}`}
                  />
                  {item.badge && (
                    <span className="notification-badge">{item.badge}</span>
                  )}
                </div>

                {/* Label */}
                <AnimatePresence mode="wait">
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -6 }}
                      transition={{ duration: 0.15 }}
                      className="text-sm font-medium whitespace-nowrap flex-1"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>

                {/* Tooltip for collapsed state */}
                {collapsed && isHovered && (
                  <motion.div
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="absolute left-full ml-3 px-3 py-1.5 rounded-lg bg-navy-900 border border-white/10 text-white text-xs font-medium whitespace-nowrap z-50 shadow-xl maritime-tooltip"
                  >
                    {item.label}
                  </motion.div>
                )}
              </motion.div>
            </NavLink>
          )
        })}
      </nav>

      {/* Divider */}
      <div className="mx-4 divider" />

      {/* Bottom Actions */}
      <div className="p-2 space-y-0.5">
        {/* Notifications */}
        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/40 hover:text-white/75 hover:bg-white/[0.04] transition-all duration-200">
          <div className="relative flex-shrink-0">
            <Bell size={18} />
            <span className="notification-badge" style={{ background: '#ef4444' }}>3</span>
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-sm font-medium"
              >
                Notifications
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        {/* Settings */}
        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/40 hover:text-white/75 hover:bg-white/[0.04] transition-all duration-200">
          <Settings size={18} className="flex-shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-sm font-medium"
              >
                Settings
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>

      {/* User Profile */}
      <div className="p-3 border-t border-white/[0.06]">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="flex-shrink-0 w-9 h-9 rounded-xl overflow-hidden border border-teal-400/20 bg-gradient-to-br from-teal-400/20 to-ocean-500/20 flex items-center justify-center">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt={user.full_name} className="w-full h-full object-cover" />
            ) : (
              <UserIcon className="w-4 h-4 text-teal-400/70" />
            )}
          </div>

          {/* User Info */}
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.2 }}
                className="flex-1 min-w-0"
              >
                <p className="text-sm font-medium text-white/85 truncate">
                  {user?.full_name || 'Guest User'}
                </p>
                <p className="text-[11px] text-white/35 truncate capitalize">
                  {user?.role || 'operator'}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Logout */}
          <AnimatePresence>
            {!collapsed && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleLogout}
                className="flex-shrink-0 w-7 h-7 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center text-white/30 hover:text-red-400 hover:bg-red-400/10 hover:border-red-400/20 transition-all duration-200"
                title="Logout"
              >
                <LogOut className="w-3.5 h-3.5" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Role Badge */}
        <AnimatePresence>
          {!collapsed && user && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-2 flex items-center gap-2"
            >
              <Activity className="w-3 h-3 text-teal-400/50" />
              <span className="text-[10px] text-white/25 truncate">{user.company_name || 'VoyageIQ Platform'}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.aside>
  )
}

// ─── App Shell (with sidebar + content) ──────────────────────────────────────
function AppShell() {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()

  const sidebarWidth = collapsed ? 72 : 256

  return (
    <div className="maritime-bg min-h-screen flex">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

      {/* Main content */}
      <motion.main
        animate={{ marginLeft: sidebarWidth }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="flex-1 min-h-screen overflow-auto"
      >
        <React.Suspense fallback={<LoadingSpinner />}>
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <PageWrapper>
                    <DashboardPage />
                  </PageWrapper>
                </ProtectedRoute>
              } />
              <Route path="/vessels" element={
                <ProtectedRoute>
                  <PageWrapper>
                    <VesselsPage />
                  </PageWrapper>
                </ProtectedRoute>
              } />
              <Route path="/vessels/:id" element={
                <ProtectedRoute>
                  <PageWrapper>
                    <VesselDetailPage />
                  </PageWrapper>
                </ProtectedRoute>
              } />
              <Route path="/voyages" element={
                <ProtectedRoute>
                  <PageWrapper>
                    <VoyagesPage />
                  </PageWrapper>
                </ProtectedRoute>
              } />
              <Route path="/voyages/:id" element={
                <ProtectedRoute>
                  <PageWrapper>
                    <VoyageDetailPage />
                  </PageWrapper>
                </ProtectedRoute>
              } />
              <Route path="/fuel-analytics" element={
                <ProtectedRoute>
                  <PageWrapper>
                    <FuelAnalyticsPage />
                  </PageWrapper>
                </ProtectedRoute>
              } />
              <Route path="/voyage-optimizer" element={
                <ProtectedRoute>
                  <PageWrapper>
                    <VoyageOptimizerPage />
                  </PageWrapper>
                </ProtectedRoute>
              } />
              <Route path="/claims" element={
                <ProtectedRoute>
                  <PageWrapper>
                    <ClaimsPage />
                  </PageWrapper>
                </ProtectedRoute>
              } />
              <Route path="/copilot" element={
                <ProtectedRoute>
                  <PageWrapper>
                    <CopilotPage />
                  </PageWrapper>
                </ProtectedRoute>
              } />
              <Route path="/reports" element={
                <ProtectedRoute>
                  <PageWrapper>
                    <ReportsPage />
                  </PageWrapper>
                </ProtectedRoute>
              } />
              <Route path="/weather" element={
                <ProtectedRoute>
                  <PageWrapper>
                    <WeatherIntelligencePage />
                  </PageWrapper>
                </ProtectedRoute>
              } />
              <Route path="/noon-reports" element={
                <ProtectedRoute>
                  <PageWrapper>
                    <NoonReportPage />
                  </PageWrapper>
                </ProtectedRoute>
              } />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </AnimatePresence>
        </React.Suspense>
      </motion.main>
    </div>
  )
}

// ─── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  const { loadUser } = useAuthStore()

  useEffect(() => {
    loadUser()
  }, [loadUser])

  return (
    <Router>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'rgba(5, 15, 32, 0.95)',
            color: '#e2e8f0',
            border: '1px solid rgba(45, 212, 191, 0.2)',
            borderRadius: '12px',
            backdropFilter: 'blur(16px)',
            fontSize: '13px',
          },
          success: {
            iconTheme: { primary: '#2dd4bf', secondary: '#020b18' },
          },
          error: {
            iconTheme: { primary: '#f87171', secondary: '#020b18' },
          },
          duration: 4000,
        }}
      />
      <React.Suspense fallback={
        <div className="maritime-bg min-h-screen flex items-center justify-center">
          <LoadingSpinner />
        </div>
      }>
        <AnimatePresence mode="wait">
          <Routes>
            <Route path="/login" element={
              <PageWrapper>
                <LoginPage />
              </PageWrapper>
            } />
            <Route path="/*" element={<AppShell />} />
          </Routes>
        </AnimatePresence>
      </React.Suspense>
    </Router>
  )
}
