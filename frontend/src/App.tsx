import React, { useEffect } from 'react'
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './store/authStore'
import { AppShell } from './layout/AppShell'

const LoginPage = React.lazy(() => import('./pages/LoginPage'))
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'))
const VesselsPage = React.lazy(() => import('./pages/VesselsPage'))
const VesselDetailPage = React.lazy(() => import('./pages/VesselDetailPage'))
const VoyagesPage = React.lazy(() => import('./pages/VoyagesPage'))
const VoyageDetailPage = React.lazy(() => import('./pages/VoyageDetailPage'))
const FuelAnalyticsPage = React.lazy(() => import('./pages/FuelAnalyticsPage'))
const VoyageOptimizerPage = React.lazy(() => import('./pages/VoyageOptimizerPage'))
const ClaimsPage = React.lazy(() => import('./pages/ClaimDetectorPage'))
const CopilotPage = React.lazy(() => import('./pages/AICopilotPage'))
const ReportsPage = React.lazy(() => import('./pages/ReportsPage'))
const WeatherIntelligencePage = React.lazy(() => import('./pages/WeatherIntelligencePage'))
const NoonReportPage = React.lazy(() => import('./pages/NoonReportPage'))
// Component-kit reference, only available under `npm run dev`.
const UiKitPage = import.meta.env.DEV ? React.lazy(() => import('./pages/UiKitPage')) : null

/** Redirects to the login page when there is no token. The server still validates it on every request. */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuthStore(s => s.token)
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  const loadUser = useAuthStore(s => s.loadUser)
  useEffect(() => { loadUser() }, [loadUser])

  return (
    <Router>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'rgb(16 30 51)',
            color: 'rgb(230 237 246)',
            border: '1px solid rgba(148, 170, 200, 0.26)',
            borderRadius: '8px',
            fontSize: '13px',
          },
          success: { iconTheme: { primary: '#3fb67a', secondary: '#060e1a' } },
          error: { iconTheme: { primary: '#e5594f', secondary: '#060e1a' } },
        }}
      />
      <React.Suspense fallback={<div className="min-h-[100dvh] bg-base" />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth><AppShell /></RequireAuth>}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/vessels" element={<VesselsPage />} />
            <Route path="/vessels/:id" element={<VesselDetailPage />} />
            <Route path="/voyages" element={<VoyagesPage />} />
            <Route path="/voyages/:id" element={<VoyageDetailPage />} />
            <Route path="/noon-reports" element={<NoonReportPage />} />
            <Route path="/fuel-analytics" element={<FuelAnalyticsPage />} />
            <Route path="/weather" element={<WeatherIntelligencePage />} />
            <Route path="/claims" element={<ClaimsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/voyage-optimizer" element={<VoyageOptimizerPage />} />
            <Route path="/copilot" element={<CopilotPage />} />
            {UiKitPage && <Route path="/ui" element={<UiKitPage />} />}
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </React.Suspense>
    </Router>
  )
}
