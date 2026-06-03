import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup } from 'react-leaflet'
import { ArrowLeft, Ship, Activity, Fuel, Wind, TrendingUp, TrendingDown, AlertTriangle, Star } from 'lucide-react'
import { vesselsAPI } from '../services/api'
import { Vessel, VesselHealth, PerformanceMetrics } from '../types'

function HealthGaugeLarge({ score, grade, color }: { score: number; grade: string; color: string }) {
  const radius = 90, stroke = 12
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - score / 100)
  const c = { green: '#10B981', teal: '#14B8A6', yellow: '#F59E0B', red: '#EF4444' }[color] || '#14B8A6'
  return (
    <div className="flex flex-col items-center py-4">
      <div className="relative">
        <svg width="200" height="200" className="-rotate-90">
          <circle cx="100" cy="100" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
          <motion.circle cx="100" cy="100" r={radius} fill="none" stroke={c} strokeWidth={stroke}
            strokeDasharray={circumference} strokeLinecap="round"
            initial={{ strokeDashoffset: circumference }} animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.5, ease: 'easeOut' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center rotate-90">
          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
            className="text-5xl font-bold font-display" style={{ color: c }}>{score.toFixed(0)}</motion.span>
          <span className="text-sm font-medium mt-1" style={{ color: c }}>{grade}</span>
          <span className="text-xs text-navy-500 mt-0.5">Health Score</span>
        </div>
      </div>
    </div>
  )
}

export default function VesselDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [vessel, setVessel] = useState<Vessel | null>(null)
  const [health, setHealth] = useState<VesselHealth | null>(null)
  const [performance, setPerformance] = useState<PerformanceMetrics | null>(null)
  const [positions, setPositions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    Promise.allSettled([
      vesselsAPI.get(id),
      vesselsAPI.getHealth(id),
      vesselsAPI.getPerformance(id),
      vesselsAPI.getPositions(id),
    ]).then(([vRes, hRes, pRes, posRes]) => {
      if (vRes.status === 'fulfilled') setVessel(vRes.value.data)
      if (hRes.status === 'fulfilled') setHealth(hRes.value.data)
      if (pRes.status === 'fulfilled') setPerformance(pRes.value.data)
      if (posRes.status === 'fulfilled') setPositions(posRes.value.data.positions || posRes.value.data || [])
    }).finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-12 h-12 border-4 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" />
    </div>
  )
  if (!vessel) return <div className="text-center py-20 text-navy-400">Vessel not found</div>

  const posPoints: [number, number][] = positions.map((p: any) => [p.latitude as number, p.longitude as number] as [number, number]).filter(Boolean)

  const gradeColor = health?.grade_color || (health?.total_score && health.total_score >= 90 ? 'green' : health?.total_score && health.total_score >= 70 ? 'teal' : health?.total_score && health.total_score >= 50 ? 'yellow' : 'red') || 'teal'

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div className="flex items-start gap-4">
        <button onClick={() => navigate(-1)} className="mt-1 p-2 rounded-xl bg-navy-800 hover:bg-navy-700 text-navy-300 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-display font-bold text-white">{vessel.name}</h1>
            <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${vessel.status === 'active' ? 'bg-green-500/15 text-green-400 border-green-500/30' : 'bg-gray-500/15 text-gray-400 border-gray-500/30'}`}>
              {vessel.status}
            </span>
          </div>
          <p className="text-navy-400 text-sm mt-1">{vessel.imo_number} · {vessel.vessel_type} · {vessel.flag}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Health Score */}
        {health && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-6 rounded-2xl">
            <h3 className="font-semibold text-white text-sm mb-2 flex items-center gap-2"><Star size={14} className="text-yellow-400" /> AI Health Score</h3>
            <HealthGaugeLarge score={health.total_score} grade={health.grade} color={gradeColor} />
            <div className="space-y-2 mt-2">
              {Object.entries(health.breakdown || {}).map(([key, val]) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-xs text-navy-400 w-36 capitalize">{key.replace('_', ' ')}</span>
                  <div className="flex-1 bg-navy-800 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full bg-gradient-to-r from-teal-500 to-ocean-500" style={{ width: `${(Number(val) / 25) * 100}%` }} />
                  </div>
                  <span className="text-xs text-white w-8">{Number(val).toFixed(0)}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Vessel Specs */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-6 rounded-2xl">
          <h3 className="font-semibold text-white text-sm mb-4 flex items-center gap-2"><Ship size={14} className="text-ocean-400" /> Vessel Specifications</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              ['Built Year', vessel.built_year],
              ['Gross Tonnage', vessel.gross_tonnage ? `${vessel.gross_tonnage.toLocaleString()} GT` : '—'],
              ['DWT', vessel.deadweight_tonnage ? `${vessel.deadweight_tonnage.toLocaleString()} MT` : '—'],
              ['LOA', vessel.loa ? `${vessel.loa}m` : '—'],
              ['Beam', vessel.beam ? `${vessel.beam}m` : '—'],
              ['Draft', vessel.draft_design ? `${vessel.draft_design}m` : '—'],
              ['Main Engine', vessel.main_engine_type || '—'],
              ['Engine Power', vessel.main_engine_power ? `${vessel.main_engine_power.toLocaleString()} kW` : '—'],
              ['Design Speed', vessel.design_speed ? `${vessel.design_speed} kts` : '—'],
              ['Warranted Speed', vessel.warranted_speed ? `${vessel.warranted_speed} kts` : '—'],
              ['Warranted Cons.', vessel.warranted_consumption ? `${vessel.warranted_consumption} MT/d` : '—'],
              ['Classification', vessel.classification_society || '—'],
            ].map(([label, value]) => (
              <div key={String(label)} className="bg-navy-800/50 rounded-lg p-2">
                <p className="text-xs text-navy-500">{label}</p>
                <p className="text-sm text-white font-medium truncate">{String(value)}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Performance Metrics */}
        {performance && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-6 rounded-2xl">
            <h3 className="font-semibold text-white text-sm mb-4 flex items-center gap-2"><Activity size={14} className="text-teal-400" /> Performance Metrics</h3>
            <div className="space-y-4">
              {[
                { label: 'Speed Variance', value: performance.speed_variance, unit: 'kts', icon: performance.speed_variance >= 0 ? TrendingUp : TrendingDown, good: performance.speed_variance >= -0.3 },
                { label: 'Consumption Variance', value: performance.consumption_variance, unit: 'MT/d', icon: performance.consumption_variance <= 0 ? TrendingDown : TrendingUp, good: performance.consumption_variance <= 1 },
                { label: 'Fuel Efficiency', value: performance.fuel_efficiency, unit: 'nm/MT', icon: Fuel, good: true },
                { label: 'Compliance %', value: performance.performance_compliance, unit: '%', icon: Activity, good: performance.performance_compliance >= 95 },
              ].map(({ label, value, unit, icon: Icon, good }) => (
                <div key={label} className={`flex items-center justify-between p-3 rounded-xl border ${good ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                  <div className="flex items-center gap-2">
                    <Icon size={14} className={good ? 'text-green-400' : 'text-red-400'} />
                    <span className="text-sm text-navy-300">{label}</span>
                  </div>
                  <span className={`font-bold text-sm ${good ? 'text-green-400' : 'text-red-400'}`}>
                    {value >= 0 ? '+' : ''}{Number(value).toFixed(2)} {unit}
                  </span>
                </div>
              ))}
              <div className="pt-2 border-t border-white/5">
                <p className="text-xs text-navy-500">Based on {performance.days_analyzed} days</p>
                {performance.is_underperforming && (
                  <div className="mt-2 flex items-start gap-2 text-xs text-orange-400 bg-orange-500/10 rounded-lg p-2">
                    <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                    {performance.underperformance_reason}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Recommendations */}
      {health?.recommendations && health.recommendations.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card p-6 rounded-2xl">
          <h3 className="font-semibold text-white text-sm mb-4 flex items-center gap-2"><Star size={14} className="text-teal-400" /> AI Recommendations</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {health.recommendations.map((rec, i) => (
              <div key={i} className="flex items-start gap-3 p-4 bg-teal-500/5 border border-teal-500/15 rounded-xl">
                <div className="w-6 h-6 rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</div>
                <p className="text-sm text-navy-300">{rec}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Position Track Map */}
      {posPoints.length > 1 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-card p-6 rounded-2xl">
          <h3 className="font-semibold text-white text-sm mb-4">Voyage Track</h3>
          <div className="rounded-xl overflow-hidden" style={{ height: 320 }}>
            <MapContainer center={posPoints[Math.floor(posPoints.length / 2)] || [0, 0]} zoom={4} className="h-full w-full">
              <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution="&copy; CartoDB" />
              <Polyline positions={posPoints} color="#14B8A6" weight={3} opacity={0.9} />
              {posPoints[0] && <CircleMarker center={posPoints[0]} radius={7} color="#10B981" fillColor="#10B981" fillOpacity={0.9}><Popup>Departure</Popup></CircleMarker>}
              {posPoints[posPoints.length - 1] && <CircleMarker center={posPoints[posPoints.length - 1]} radius={7} color="#0EA5E9" fillColor="#0EA5E9" fillOpacity={0.9}><Popup>Last Position</Popup></CircleMarker>}
            </MapContainer>
          </div>
        </motion.div>
      )}
    </div>
  )
}
