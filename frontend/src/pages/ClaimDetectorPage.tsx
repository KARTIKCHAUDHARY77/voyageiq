import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  Gauge,
  Fuel,
  TrendingDown,
  DollarSign,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Zap,
  BarChart2,
  Filter,
  RefreshCw,
  Eye,
} from 'lucide-react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js'
import { Bar, Doughnut } from 'react-chartjs-2'
import { claimsAPI, voyagesAPI } from '../services/api'
import { Claim, Voyage, ClaimSeverity, ClaimStatus, ClaimType } from '../types'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement)

// ── Helpers ──────────────────────────────────────────────────────────────────

const severityConfig: Record<ClaimSeverity, { label: string; bg: string; text: string; border: string; dot: string }> = {
  critical: { label: 'Critical', bg: 'bg-danger-500/20', text: 'text-danger-400', border: 'border-danger-500/40', dot: 'bg-danger-500' },
  high:     { label: 'High',     bg: 'bg-warning-500/20', text: 'text-warning-400', border: 'border-warning-500/40', dot: 'bg-warning-500' },
  medium:   { label: 'Medium',  bg: 'bg-yellow-500/20',  text: 'text-yellow-400',  border: 'border-yellow-500/40',  dot: 'bg-yellow-500'  },
  low:      { label: 'Low',     bg: 'bg-white/10',       text: 'text-white/50',    border: 'border-white/10',       dot: 'bg-white/40'    },
}

const claimTypeConfig: Record<ClaimType, { label: string; icon: React.ReactNode }> = {
  speed_loss:         { label: 'Speed Loss',          icon: <Gauge className="w-4 h-4" /> },
  excess_consumption: { label: 'Excess Consumption',  icon: <Fuel className="w-4 h-4" /> },
  underperformance:   { label: 'Underperformance',    icon: <TrendingDown className="w-4 h-4" /> },
  weather_deviation:  { label: 'Weather Deviation',   icon: <AlertTriangle className="w-4 h-4" /> },
  off_hire:           { label: 'Off-Hire',            icon: <Clock className="w-4 h-4" /> },
}

const statusConfig: Record<ClaimStatus, { label: string; bg: string; text: string }> = {
  open:         { label: 'Open',         bg: 'bg-ocean-500/20',   text: 'text-ocean-400'   },
  acknowledged: { label: 'Acknowledged', bg: 'bg-teal-500/20',    text: 'text-teal-400'    },
  disputed:     { label: 'Disputed',     bg: 'bg-warning-500/20', text: 'text-warning-400' },
  resolved:     { label: 'Resolved',     bg: 'bg-success-500/20', text: 'text-success-400' },
  pending:      { label: 'Pending',      bg: 'bg-white/10',       text: 'text-white/50'    },
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: string | number
  icon: React.ReactNode
  color: string
  sub?: string
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, color, sub }) => (
  <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-4 flex items-center gap-4">
    <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center flex-shrink-0`}>
      {icon}
    </div>
    <div>
      <p className="text-white/50 text-xs font-medium uppercase tracking-wider">{label}</p>
      <p className="text-white text-xl font-bold font-display mt-0.5">{value}</p>
      {sub && <p className="text-white/40 text-xs mt-0.5">{sub}</p>}
    </div>
  </div>
)

interface ClaimCardProps {
  claim: Claim
  onUpdateStatus: (id: string, status: ClaimStatus) => void
}

const ClaimCard: React.FC<ClaimCardProps> = ({ claim, onUpdateStatus }) => {
  const [expanded, setExpanded] = useState(false)
  const sev = severityConfig[claim.severity]
  const typ = claimTypeConfig[claim.type] ?? { label: claim.type, icon: <AlertTriangle className="w-4 h-4" /> }
  const sta = statusConfig[claim.status]

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`bg-white/5 backdrop-blur-md border ${sev.border} rounded-xl overflow-hidden`}
    >
      {/* Card Header */}
      <div className="p-4 cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <div className="flex items-start gap-3">
          {/* Severity indicator */}
          <div className={`mt-0.5 w-2.5 h-2.5 rounded-full flex-shrink-0 ${sev.dot} shadow-lg`} />

          {/* Type icon + info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`flex items-center gap-1.5 text-sm font-semibold ${sev.text}`}>
                {typ.icon}
                {typ.label}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sev.bg} ${sev.text}`}>
                {sev.label}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sta.bg} ${sta.text}`}>
                {sta.label}
              </span>
            </div>

            <p className="text-white/60 text-xs mt-1">
              {claim.vessel_name} · {claim.voyage_number}
            </p>
            <p className="text-white/40 text-xs mt-0.5">
              {format(new Date(claim.period_start), 'MMM d')} – {format(new Date(claim.period_end), 'MMM d, yyyy')}
            </p>
          </div>

          {/* Financial impact */}
          <div className="text-right flex-shrink-0">
            <p className="text-danger-400 text-lg font-bold font-display">
              ${claim.estimated_impact_usd.toLocaleString()}
            </p>
            <p className="text-white/40 text-xs">Est. Impact</p>
          </div>

          {/* Expand toggle */}
          <button className="text-white/40 hover:text-white/70 transition-colors ml-2">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Key metrics row */}
        {claim.expected_value !== 0 && (
          <div className="mt-3 grid grid-cols-3 gap-3">
            <div className="bg-white/5 rounded-lg p-2 text-center">
              <p className="text-white/40 text-xs">Expected</p>
              <p className="text-white text-sm font-semibold">{claim.expected_value.toFixed(1)}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-2 text-center">
              <p className="text-white/40 text-xs">Actual</p>
              <p className="text-white text-sm font-semibold">{claim.actual_value.toFixed(1)}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-2 text-center">
              <p className="text-white/40 text-xs">Variance</p>
              <p className={`text-sm font-semibold ${claim.variance < 0 ? 'text-danger-400' : 'text-success-400'}`}>
                {claim.variance > 0 ? '+' : ''}{claim.variance.toFixed(1)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Expanded section */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/10 p-4">
              <p className="text-white/60 text-sm leading-relaxed mb-4">{claim.description}</p>

              {claim.supporting_data && (
                <div className="bg-navy-800/50 rounded-lg p-3 mb-4">
                  <p className="text-white/50 text-xs font-medium uppercase tracking-wider mb-2">Supporting Data</p>
                  <pre className="text-ocean-300 text-xs overflow-auto">
                    {JSON.stringify(claim.supporting_data, null, 2)}
                  </pre>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 flex-wrap">
                {claim.status === 'open' && (
                  <>
                    <button
                      onClick={() => onUpdateStatus(claim.id, 'acknowledged')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/30 text-teal-400 text-xs font-medium rounded-lg transition-[color,background-color,border-color,opacity,transform]"
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> Acknowledge
                    </button>
                    <button
                      onClick={() => onUpdateStatus(claim.id, 'disputed')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-warning-500/20 hover:bg-warning-500/30 border border-warning-500/30 text-warning-400 text-xs font-medium rounded-lg transition-[color,background-color,border-color,opacity,transform]"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Dispute
                    </button>
                  </>
                )}
                {(claim.status === 'open' || claim.status === 'acknowledged') && (
                  <button
                    onClick={() => onUpdateStatus(claim.id, 'resolved')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-success-500/20 hover:bg-success-500/30 border border-success-500/30 text-success-400 text-xs font-medium rounded-lg transition-[color,background-color,border-color,opacity,transform]"
                  >
                    <CheckCircle className="w-3.5 h-3.5" /> Resolve
                  </button>
                )}
                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 text-xs font-medium rounded-lg transition-[color,background-color,border-color,opacity,transform]">
                  <Eye className="w-3.5 h-3.5" /> View Details
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'open' | 'critical' | 'high' | 'acknowledged'

export default function ClaimDetectorPage() {
  const [claims, setClaims]             = useState<Claim[]>([])
  const [voyages, setVoyages]           = useState<Voyage[]>([])
  const [selectedVoyage, setSelectedVoyage] = useState<string>('')
  const [detecting, setDetecting]       = useState(false)
  const [loading, setLoading]           = useState(false)
  const [filterTab, setFilterTab]       = useState<FilterTab>('all')
  const [search, setSearch]             = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [claimsRes, voyagesRes] = await Promise.all([
        claimsAPI.list(),
        voyagesAPI.list(),
      ])
      setClaims(claimsRes.data?.claims ?? claimsRes.data ?? [])
      setVoyages(voyagesRes.data?.voyages ?? voyagesRes.data ?? [])
    } catch {
      toast.error('Could not load claims. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleDetect = useCallback(async () => {
    if (!selectedVoyage) { toast.error('Select a voyage first'); return }
    setDetecting(true)
    try {
      const res = await claimsAPI.detect(selectedVoyage)
      const detected: Claim[] = res.data?.detected_claims ?? []
      if (detected.length > 0) {
        setClaims(prev => {
          const ids = new Set(prev.map(c => c.id))
          return [...prev, ...detected.filter(c => !ids.has(c.id))]
        })
        toast.success(`Detected ${detected.length} claim(s)!`)
      } else {
        toast.success('No new claims detected for this voyage.')
      }
    } catch {
      toast.error('Detection failed. Try again.')
    } finally {
      setDetecting(false)
    }
  }, [selectedVoyage])

  const handleUpdateStatus = useCallback(async (id: string, status: ClaimStatus) => {
    try {
      await claimsAPI.updateStatus(id, status)
    } catch {
      // optimistic update anyway
    }
    setClaims(prev => prev.map(c => c.id === id ? { ...c, status } : c))
    toast.success(`Claim ${status}`)
  }, [])

  // Filtered claims
  const filtered = claims.filter(c => {
    const matchTab =
      filterTab === 'all'          ? true :
      filterTab === 'open'         ? c.status === 'open' :
      filterTab === 'critical'     ? c.severity === 'critical' :
      filterTab === 'high'         ? c.severity === 'high' :
      filterTab === 'acknowledged' ? c.status === 'acknowledged' :
      true
    const matchSearch = search === '' || c.vessel_name.toLowerCase().includes(search.toLowerCase()) || c.voyage_number.toLowerCase().includes(search.toLowerCase())
    return matchTab && matchSearch
  })

  // Stats
  const totalClaims   = claims.length
  const criticalCount = claims.filter(c => c.severity === 'critical').length
  const highCount     = claims.filter(c => c.severity === 'high').length
  const openValue     = claims.filter(c => c.status === 'open' || c.status === 'pending').reduce((s, c) => s + c.estimated_impact_usd, 0)

  // Chart data
  const claimsByType = [
    claims.filter(c => c.type === 'speed_loss').length,
    claims.filter(c => c.type === 'excess_consumption').length,
    claims.filter(c => c.type === 'underperformance').length,
    claims.filter(c => c.type === 'weather_deviation').length,
    claims.filter(c => c.type === 'off_hire').length,
  ]

  const barChartData = {
    labels: ['Speed Loss', 'Excess Fuel', 'Underperf.', 'Weather', 'Off-Hire'],
    datasets: [{
      label: 'Claims',
      data: claimsByType,
      backgroundColor: ['rgba(239,68,68,0.6)', 'rgba(245,158,11,0.6)', 'rgba(234,179,8,0.6)', 'rgba(14,165,233,0.6)', 'rgba(20,184,166,0.6)'],
      borderColor:     ['rgba(239,68,68,1)',    'rgba(245,158,11,1)',   'rgba(234,179,8,1)',   'rgba(14,165,233,1)',   'rgba(20,184,166,1)'  ],
      borderWidth: 1,
      borderRadius: 6,
    }],
  }

  const donutData = {
    labels: ['Critical', 'High', 'Medium', 'Low'],
    datasets: [{
      data: [
        claims.filter(c => c.severity === 'critical').length,
        claims.filter(c => c.severity === 'high').length,
        claims.filter(c => c.severity === 'medium').length,
        claims.filter(c => c.severity === 'low').length,
      ],
      backgroundColor: ['rgba(239,68,68,0.7)', 'rgba(245,158,11,0.7)', 'rgba(234,179,8,0.7)', 'rgba(255,255,255,0.15)'],
      borderColor: ['rgba(239,68,68,1)', 'rgba(245,158,11,1)', 'rgba(234,179,8,1)', 'rgba(255,255,255,0.3)'],
      borderWidth: 2,
    }],
  }

  const chartOptions = {
    responsive: true,
    plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(4,15,31,0.9)', titleColor: '#fff', bodyColor: 'rgba(255,255,255,0.7)', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1 } },
    scales: { x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 11 } } }, y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 11 } }, beginAtZero: true } },
  }

  const donutOptions = {
    responsive: true,
    cutout: '70%',
    plugins: { legend: { display: true, position: 'bottom' as const, labels: { color: 'rgba(255,255,255,0.6)', font: { size: 11 }, padding: 12, boxWidth: 12 } }, tooltip: { backgroundColor: 'rgba(4,15,31,0.9)', titleColor: '#fff', bodyColor: 'rgba(255,255,255,0.7)', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1 } },
  }

  const TABS: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all',          label: 'All',          count: claims.length },
    { key: 'open',         label: 'Open',         count: claims.filter(c => c.status === 'open').length },
    { key: 'critical',     label: 'Critical',     count: criticalCount },
    { key: 'high',         label: 'High',         count: highCount },
    { key: 'acknowledged', label: 'Acknowledged', count: claims.filter(c => c.status === 'acknowledged').length },
  ]

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-white flex items-center gap-2">
            <Zap className="w-6 h-6 text-teal-400" />
            Smart Claim Detector
          </h1>
          <p className="text-white/40 text-sm mt-1">AI-powered charter party claim detection & management</p>
        </div>
        <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 text-sm rounded-xl transition-[color,background-color,border-color,opacity,transform]">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </motion.div>

      {/* ── Stats Bar ── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Claims"   value={totalClaims}                        icon={<BarChart2 className="w-5 h-5 text-ocean-300" />}   color="bg-ocean-500/20"   />
        <StatCard label="Critical"       value={criticalCount}                      icon={<AlertTriangle className="w-5 h-5 text-danger-400" />} color="bg-danger-500/20" sub="Immediate action" />
        <StatCard label="High Priority"  value={highCount}                          icon={<TrendingDown className="w-5 h-5 text-warning-400" />} color="bg-warning-500/20" />
        <StatCard label="Open Exposure"  value={`$${(openValue / 1000).toFixed(0)}K`} icon={<DollarSign className="w-5 h-5 text-teal-400" />}   color="bg-teal-500/20"    sub="Total open value" />
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* ── Left: Detection + Claims List ── */}
        <div className="xl:col-span-2 space-y-4">
          {/* Detection Panel */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5">
            <h2 className="text-white font-semibold font-display flex items-center gap-2 mb-4">
              <Search className="w-4 h-4 text-teal-400" /> Run Claim Detection
            </h2>
            <div className="flex gap-3 flex-wrap">
              <select
                value={selectedVoyage}
                onChange={e => setSelectedVoyage(e.target.value)}
                className="flex-1 min-w-48 bg-navy-800/60 border border-white/10 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/30"
              >
                <option value="">Select a voyage…</option>
                {voyages.map(v => (
                  <option key={v.id} value={v.id}>{v.voyage_number} – {v.vessel_name}</option>
                ))}
              </select>
              <button
                onClick={handleDetect}
                disabled={detecting || !selectedVoyage}
                className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-[color,background-color,border-color,opacity,transform]"
              >
                {detecting ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> Detecting…</>
                ) : (
                  <><Zap className="w-4 h-4" /> Run Detection</>
                )}
              </button>
            </div>

            {/* Detection progress */}
            <AnimatePresence>
              {detecting && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-4">
                  <div className="flex items-center gap-3 text-teal-400 text-sm mb-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Analyzing noon reports and charter party data…
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                    <motion.div
                      className="h-full bg-teal-500 rounded-full"
                      animate={{ width: ['10%', '90%'] }}
                      transition={{ duration: 3, ease: 'easeInOut' }}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Filter + Search row */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 gap-1">
              {TABS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setFilterTab(tab.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-[color,background-color,border-color,opacity,transform] ${filterTab === tab.key ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30' : 'text-white/50 hover:text-white/70'}`}
                >
                  {tab.label}
                  <span className="ml-1.5 opacity-70">({tab.count})</span>
                </button>
              ))}
            </div>
            <div className="relative flex-1 min-w-40">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search claims…"
                className="w-full bg-white/5 border border-white/10 text-white/80 text-sm pl-9 pr-3 py-2 rounded-xl focus:outline-none focus:border-teal-500/40 placeholder-white/20"
              />
            </div>
            <div className="flex items-center gap-1.5 text-white/40 text-xs">
              <Filter className="w-3.5 h-3.5" />
              {filtered.length} result{filtered.length !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Claims list */}
          <AnimatePresence mode="popLayout">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-white/40">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading claims…
              </div>
            ) : filtered.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16 text-white/30">
                <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No claims match current filters</p>
              </motion.div>
            ) : (
              <div className="space-y-3">
                {filtered.map(claim => (
                  <ClaimCard key={claim.id} claim={claim} onUpdateStatus={handleUpdateStatus} />
                ))}
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Right: Analytics Sidebar ── */}
        <div className="space-y-4">
          {/* Claims by Type */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5">
            <h3 className="text-white font-semibold text-sm font-display mb-4 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-ocean-400" /> Claims by Type
            </h3>
            <Bar data={barChartData} options={chartOptions} />
          </motion.div>

          {/* Severity Breakdown */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }} className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5">
            <h3 className="text-white font-semibold text-sm font-display mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning-400" /> Severity Breakdown
            </h3>
            <div className="relative">
              <Doughnut data={donutData} options={donutOptions} />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ paddingBottom: '2.5rem' }}>
                <div className="text-center">
                  <p className="text-2xl font-bold text-white font-display">{totalClaims}</p>
                  <p className="text-white/40 text-xs">Total</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Financial Exposure */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5">
            <h3 className="text-white font-semibold text-sm font-display mb-4 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-danger-400" /> Financial Exposure
            </h3>
            <div className="space-y-3">
              {(['critical', 'high', 'medium', 'low'] as ClaimSeverity[]).map(sev => {
                const sevClaims = claims.filter(c => c.severity === sev)
                const exposure  = sevClaims.reduce((s, c) => s + c.estimated_impact_usd, 0)
                const pct       = totalClaims > 0 ? (sevClaims.length / totalClaims) * 100 : 0
                const cfg = severityConfig[sev]
                return (
                  <div key={sev}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-medium ${cfg.text}`}>{cfg.label}</span>
                      <span className="text-white/70 text-xs font-mono">${exposure.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ delay: 0.5, duration: 0.8 }}
                        className={`h-full rounded-full ${cfg.dot}`}
                      />
                    </div>
                  </div>
                )
              })}

              <div className="mt-4 pt-3 border-t border-white/10">
                <div className="flex justify-between items-center">
                  <span className="text-white/50 text-xs">Total Exposure</span>
                  <span className="text-danger-400 font-bold font-display text-lg">
                    ${claims.reduce((s, c) => s + c.estimated_impact_usd, 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
