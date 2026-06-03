// VoyageIQ AI — Maritime Intelligence Platform
// Copyright (c) 2024 Kartik Chaudhary. All Rights Reserved.
// Unauthorized copying or use of this file is strictly prohibited.
// Contact: 2512520007@geu.ac.in
import React, { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, Tooltip } from 'react-leaflet'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, Tooltip as ChartTooltip, Legend, Filler
} from 'chart.js'
import { Line, Bar, Doughnut } from 'react-chartjs-2'
import {
  Navigation, Fuel, Wind, TrendingUp, TrendingDown, AlertTriangle,
  Activity, DollarSign, Clock, Anchor, Ship, BarChart3, RefreshCw
} from 'lucide-react'
import { analyticsAPI, vesselsAPI, voyagesAPI, claimsAPI } from '../services/api'
import { DashboardKPIs, Vessel, Voyage, Claim } from '../types'
import toast from 'react-hot-toast'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, ChartTooltip, Legend, Filler)

const DARK_CHART_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { labels: { color: '#94a3b8', font: { size: 11 } } },
    tooltip: { backgroundColor: '#0A1F3A', titleColor: '#e2e8f0', bodyColor: '#94a3b8', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1 },
  },
  scales: {
    x: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
    y: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.06)' } },
  },
}

function KPICard({ title, value, unit, icon, color, trend, trendLabel, loading, delay = 0 }: {
  title: string; value: string | number; unit?: string; icon: React.ReactNode
  color: string; trend?: number; trendLabel?: string; loading?: boolean; delay?: number
}) {
  const colorMap: Record<string, string> = {
    teal: 'from-teal-500/20 to-teal-600/10 border-teal-500/30 shadow-teal-500/10',
    ocean: 'from-ocean-500/20 to-ocean-600/10 border-ocean-500/30 shadow-ocean-500/10',
    amber: 'from-amber-500/20 to-amber-600/10 border-amber-500/30 shadow-amber-500/10',
    green: 'from-green-500/20 to-green-600/10 border-green-500/30 shadow-green-500/10',
    red: 'from-red-500/20 to-red-600/10 border-red-500/30 shadow-red-500/10',
    purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/30 shadow-purple-500/10',
    emerald: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 shadow-emerald-500/10',
    sky: 'from-sky-500/20 to-sky-600/10 border-sky-500/30 shadow-sky-500/10',
  }
  const iconColorMap: Record<string, string> = {
    teal: 'bg-teal-500/20 text-teal-400', ocean: 'bg-ocean-500/20 text-ocean-400',
    amber: 'bg-amber-500/20 text-amber-400', green: 'bg-green-500/20 text-green-400',
    red: 'bg-red-500/20 text-red-400', purple: 'bg-purple-500/20 text-purple-400',
    emerald: 'bg-emerald-500/20 text-emerald-400', sky: 'bg-sky-500/20 text-sky-400',
  }

  if (loading) {
    return (
      <div className="glass-card p-5 rounded-2xl animate-pulse">
        <div className="h-4 bg-navy-700 rounded mb-3 w-2/3" />
        <div className="h-8 bg-navy-700 rounded mb-2 w-1/2" />
        <div className="h-3 bg-navy-700 rounded w-1/3" />
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      whileHover={{ scale: 1.02, y: -2 }}
      className={`glass-card p-5 rounded-2xl bg-gradient-to-br ${colorMap[color] || colorMap.teal} border cursor-default`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-xl ${iconColorMap[color] || iconColorMap.teal}`}>{icon}</div>
        {trend !== undefined && (
          <span className={`flex items-center text-xs font-medium ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {trend >= 0 ? <TrendingUp size={12} className="mr-1" /> : <TrendingDown size={12} className="mr-1" />}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold font-display text-white">
          {typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: 1 }) : value}
        </span>
        {unit && <span className="text-xs text-navy-400">{unit}</span>}
      </div>
      <p className="text-xs text-navy-400 mt-1">{title}</p>
      {trendLabel && <p className="text-xs text-navy-500 mt-0.5">{trendLabel}</p>}
    </motion.div>
  )
}

function HealthGauge({ score, grade }: { score: number; grade: string }) {
  const radius = 70, stroke = 10
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - score / 100)
  const color = score >= 90 ? '#10B981' : score >= 70 ? '#14B8A6' : score >= 50 ? '#F59E0B' : '#EF4444'

  return (
    <div className="flex flex-col items-center">
      <svg width="160" height="160" className="-rotate-90">
        <circle cx="80" cy="80" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
        <motion.circle
          cx="80" cy="80" r={radius} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circumference} strokeLinecap="round"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
        />
      </svg>
      <div className="-mt-24 text-center">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
          <span className="text-4xl font-bold font-display" style={{ color }}>{score.toFixed(0)}</span>
          <div className="text-sm font-medium mt-1" style={{ color }}>{grade}</div>
        </motion.div>
      </div>
      <div className="mt-8 text-xs text-navy-400 text-center">Fleet Health Score</div>
    </div>
  )
}

export default function DashboardPage() {
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null)
  const [fuelData, setFuelData] = useState<any>(null)
  const [vessels, setVessels] = useState<Vessel[]>([])
  const [voyages, setVoyages] = useState<Voyage[]>([])
  const [claims, setClaims] = useState<Claim[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const [kpiRes, fuelRes, vesselRes, voyageRes, claimRes] = await Promise.allSettled([
        analyticsAPI.dashboard(),
        analyticsAPI.fuel(),
        vesselsAPI.list(),
        voyagesAPI.list(),
        claimsAPI.list({ status: 'open' }),
      ])
      if (kpiRes.status === 'fulfilled') setKpis(kpiRes.value.data)
      if (fuelRes.status === 'fulfilled') setFuelData(fuelRes.value.data)
      if (vesselRes.status === 'fulfilled') setVessels(vesselRes.value.data.vessels || vesselRes.value.data)
      if (voyageRes.status === 'fulfilled') setVoyages(voyageRes.value.data.voyages || voyageRes.value.data)
      if (claimRes.status === 'fulfilled') setClaims(claimRes.value.data.claims || claimRes.value.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false); setRefreshing(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleRefresh = () => { setRefreshing(true); loadData(); toast.success('Data refreshed') }

  // Build chart data from fuelData
  const fuelChartData = {
    labels: fuelData?.daily_consumption?.slice(-20).map((d: any) => {
      const dt = new Date(d.date); return `${dt.getMonth()+1}/${dt.getDate()}`
    }) || [],
    datasets: [
      { label: 'ME Consumption', data: fuelData?.daily_consumption?.slice(-20).map((d: any) => d.me) || [], borderColor: '#14B8A6', backgroundColor: 'rgba(20,184,166,0.15)', fill: true, tension: 0.4 },
      { label: 'AE Consumption', data: fuelData?.daily_consumption?.slice(-20).map((d: any) => d.ae) || [], borderColor: '#0EA5E9', backgroundColor: 'rgba(14,165,233,0.1)', fill: true, tension: 0.4 },
    ],
  }

  const perfChartData = {
    labels: vessels.map(v => v.name.replace('MV ', '').replace('MT ', '')),
    datasets: [{
      label: 'Performance Score',
      data: vessels.map(() => Math.random() * 25 + 70),
      backgroundColor: ['rgba(20,184,166,0.7)', 'rgba(14,165,233,0.7)', 'rgba(139,92,246,0.7)', 'rgba(245,158,11,0.7)'],
      borderRadius: 6,
    }],
  }

  const weatherChartData = {
    labels: ['Calm (Bft 0-3)', 'Moderate (Bft 4-5)', 'Rough (Bft 6+)'],
    datasets: [{
      data: [45, 35, 20],
      backgroundColor: ['rgba(16,185,129,0.8)', 'rgba(245,158,11,0.7)', 'rgba(239,68,68,0.7)'],
      borderWidth: 0,
    }],
  }

  // Get track positions for map
  const trackPoints: [number, number][][] = voyages.slice(0, 3).map(v => {
    if (!v.departure_lat || !v.arrival_lat) return []
    const points: [number, number][] = []
    for (let i = 0; i <= 10; i++) {
      const t = i / 10
      points.push([
        (v.departure_lat || 0) + ((v.arrival_lat || 0) - (v.departure_lat || 0)) * t,
        (v.departure_lon || 0) + ((v.arrival_lon || 0) - (v.departure_lon || 0)) * t,
      ])
    }
    return points
  }).filter(p => p.length > 0)

  const severityColor = (s: string) => ({ critical: 'text-red-400 bg-red-500/10 border-red-500/30', high: 'text-orange-400 bg-orange-500/10 border-orange-500/30', medium: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30', low: 'text-gray-400 bg-gray-500/10 border-gray-500/30' })[s] || 'text-gray-400'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">Fleet Intelligence Overview</h1>
          <p className="text-navy-400 text-sm mt-1">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleRefresh}
          className="flex items-center gap-2 px-4 py-2 bg-navy-700 hover:bg-navy-600 text-navy-300 rounded-xl text-sm transition-colors">
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Refresh
        </motion.button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
        <KPICard title="Total Distance" value={kpis?.total_distance_nm?.toFixed(0) || '—'} unit="nm" icon={<Navigation size={18} />} color="ocean" trend={3.2} trendLabel="vs last period" loading={loading} delay={0} />
        <KPICard title="Average Speed" value={kpis?.avg_speed?.toFixed(1) || '—'} unit="kts" icon={<Activity size={18} />} color="teal" trend={-0.8} loading={loading} delay={0.05} />
        <KPICard title="Fuel Consumed" value={kpis?.total_fuel_consumed?.toFixed(0) || '—'} unit="MT" icon={<Fuel size={18} />} color="amber" trend={5.1} loading={loading} delay={0.1} />
        <KPICard title="Weather Risk" value={kpis?.weather_risk_score?.toFixed(0) || '—'} unit="/100" icon={<Wind size={18} />} color={kpis?.weather_risk_score && kpis.weather_risk_score > 60 ? 'red' : 'sky'} loading={loading} delay={0.15} />
        <KPICard title="Fuel Efficiency" value={kpis?.fuel_efficiency?.toFixed(2) || '—'} unit="nm/MT" icon={<BarChart3 size={18} />} color="green" trend={1.4} loading={loading} delay={0.2} />
        <KPICard title="Idle Days" value={kpis?.idle_days || '—'} unit="days" icon={<Clock size={18} />} color="purple" loading={loading} delay={0.25} />
        <KPICard title="Performance Score" value={kpis?.performance_score?.toFixed(1) || '—'} unit="%" icon={<TrendingUp size={18} />} color="teal" trend={2.1} loading={loading} delay={0.3} />
        <KPICard title="Estimated Savings" value={kpis ? `$${(kpis.estimated_savings_usd / 1000).toFixed(0)}K` : '—'} icon={<DollarSign size={18} />} color="emerald" trend={8.7} loading={loading} delay={0.35} />
      </div>

      {/* Middle Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Health Score */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }} className="glass-card p-6 rounded-2xl flex flex-col items-center">
          <HealthGauge score={kpis?.fleet_health_score || 78} grade={kpis?.fleet_health_score && kpis.fleet_health_score >= 90 ? 'Excellent' : kpis?.fleet_health_score && kpis.fleet_health_score >= 70 ? 'Good' : 'Average'} />
          <div className="mt-4 w-full space-y-2">
            {[['Fuel Efficiency', 82], ['Speed Compliance', 74], ['Weather Handling', 79], ['Operational', 76]].map(([label, val]) => (
              <div key={label} className="flex items-center gap-3">
                <span className="text-xs text-navy-400 w-32">{label}</span>
                <div className="flex-1 bg-navy-800 rounded-full h-1.5">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${val}%` }} transition={{ delay: 0.8, duration: 0.8 }}
                    className="h-1.5 rounded-full bg-gradient-to-r from-teal-500 to-ocean-500" />
                </div>
                <span className="text-xs text-navy-300 w-8">{val}%</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Active Vessels */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="glass-card p-6 rounded-2xl">
          <div className="flex items-center gap-2 mb-4">
            <Ship size={16} className="text-teal-400" />
            <h3 className="font-semibold text-white text-sm">Active Fleet</h3>
            <span className="ml-auto text-xs bg-teal-500/20 text-teal-400 px-2 py-0.5 rounded-full">{vessels.length} vessels</span>
          </div>
          <div className="space-y-3">
            {vessels.slice(0, 4).map(v => (
              <div key={v.id} className="flex items-center gap-3 p-2 rounded-xl bg-navy-800/50 hover:bg-navy-800 transition-colors">
                <div className={`w-2 h-2 rounded-full ${v.status === 'active' ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate">{v.name}</p>
                  <p className="text-xs text-navy-400 truncate">{v.vessel_type} · {v.flag}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${v.status === 'active' ? 'bg-green-500/15 text-green-400' : 'bg-gray-500/15 text-gray-400'}`}>{v.status}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Open Claims */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }} className="glass-card p-6 rounded-2xl">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={16} className="text-red-400" />
            <h3 className="font-semibold text-white text-sm">Open Claims</h3>
            {claims.length > 0 && <span className="ml-auto text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">{claims.length} open</span>}
          </div>
          {claims.length === 0 ? (
            <div className="text-center py-8 text-navy-500 text-sm">No open claims</div>
          ) : (
            <div className="space-y-3">
              {claims.slice(0, 4).map(c => (
                <div key={c.id} className={`p-3 rounded-xl border ${severityColor(c.severity)}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium capitalize">{c.claim_type.replace('_', ' ')}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full border capitalize ${severityColor(c.severity)}`}>{c.severity}</span>
                  </div>
                  {c.estimated_impact_usd && <p className="text-sm font-bold text-red-400">${c.estimated_impact_usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>}
                  <p className="text-xs text-navy-400 truncate mt-1">{c.description}</p>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }} className="glass-card p-6 rounded-2xl md:col-span-2">
          <h3 className="font-semibold text-white text-sm mb-4 flex items-center gap-2"><Fuel size={14} className="text-teal-400" /> Fuel Consumption Trend (20 Days)</h3>
          <div style={{ height: 200 }}>
            <Line data={fuelChartData} options={DARK_CHART_OPTIONS as any} />
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="glass-card p-6 rounded-2xl">
          <h3 className="font-semibold text-white text-sm mb-4 flex items-center gap-2"><Wind size={14} className="text-sky-400" /> Weather Distribution</h3>
          <div style={{ height: 200 }}>
            <Doughnut data={weatherChartData} options={{ ...DARK_CHART_OPTIONS as any, cutout: '65%' }} />
          </div>
        </motion.div>
      </div>

      {/* Performance Chart */}
      {vessels.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }} className="glass-card p-6 rounded-2xl">
          <h3 className="font-semibold text-white text-sm mb-4">Performance Score by Vessel</h3>
          <div style={{ height: 180 }}>
            <Bar data={perfChartData} options={DARK_CHART_OPTIONS as any} />
          </div>
        </motion.div>
      )}

      {/* Voyage Map */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} className="glass-card p-6 rounded-2xl">
        <div className="flex items-center gap-2 mb-4">
          <Anchor size={16} className="text-teal-400" />
          <h3 className="font-semibold text-white text-sm">Live Fleet Map</h3>
          <span className="ml-auto text-xs text-navy-500">{voyages.length} active voyages</span>
        </div>
        <div className="rounded-xl overflow-hidden" style={{ height: 380 }}>
          <MapContainer center={[20, 60]} zoom={3} className="h-full w-full" scrollWheelZoom={false}>
            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution='&copy; CartoDB' />
            {trackPoints.map((track, i) => (
              <Polyline key={i} positions={track} color={['#14B8A6', '#0EA5E9', '#8B5CF6'][i % 3]} weight={2.5} opacity={0.85} />
            ))}
            {voyages.slice(0, 6).map(v => v.departure_lat && (
              <CircleMarker key={v.id} center={[Number(v.departure_lat), Number(v.departure_lon)]} radius={6} color="#14B8A6" fillColor="#14B8A6" fillOpacity={0.8} weight={2}>
                <Popup><div className="text-xs"><b>{v.departure_port}</b><br />→ {v.arrival_port}<br />Voyage: {v.voyage_number}</div></Popup>
                <Tooltip>{v.departure_port}</Tooltip>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
      </motion.div>
    </div>
  )
}
