import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup } from 'react-leaflet'
import { ArrowLeft, Navigation2, Fuel, Package, AlertTriangle, Upload, Activity } from 'lucide-react'
import { voyagesAPI } from '../services/api'
import { Voyage, NoonReport, Claim } from '../types'

export default function VoyageDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [voyage, setVoyage] = useState<Voyage | null>(null)
  const [reports, setReports] = useState<NoonReport[]>([])
  const [claims, setClaims] = useState<Claim[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    Promise.allSettled([
      voyagesAPI.get(id),
      voyagesAPI.getNoonReports(id),
      voyagesAPI.getClaims(id),
    ]).then(([vRes, rRes, cRes]) => {
      if (vRes.status === 'fulfilled') setVoyage(vRes.value.data)
      if (rRes.status === 'fulfilled') setReports(rRes.value.data.reports || rRes.value.data || [])
      if (cRes.status === 'fulfilled') setClaims(cRes.value.data.claims || cRes.value.data || [])
    }).finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-12 h-12 border-4 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" /></div>
  if (!voyage) return <div className="text-center py-20 text-navy-400">Voyage not found</div>

  const trackPoints: [number, number][] = reports.filter(r => r.latitude && r.longitude).map(r => [r.latitude, r.longitude])

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <button onClick={() => navigate(-1)} className="mt-1 p-2 rounded-xl bg-navy-800 hover:bg-navy-700 text-navy-300 transition-colors"><ArrowLeft size={18} /></button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-display font-bold text-white">Voyage {voyage.voyage_number}</h1>
            <span className={`text-xs px-2 py-1 rounded-full border ${voyage.status === 'in_progress' ? 'bg-teal-500/15 text-teal-400 border-teal-500/30' : 'bg-green-500/15 text-green-400 border-green-500/30'}`}>{voyage.status.replace('_', ' ')}</span>
          </div>
          <p className="text-navy-400 text-sm mt-1">{voyage.departure_port} → {voyage.arrival_port}</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Distance', value: voyage.total_distance_nm ? `${voyage.total_distance_nm.toFixed(0)} nm` : '—', icon: Navigation2, color: 'text-ocean-400' },
          { label: 'Fuel Consumed', value: voyage.total_fuel_consumed ? `${voyage.total_fuel_consumed.toFixed(0)} MT` : '—', icon: Fuel, color: 'text-amber-400' },
          { label: 'Avg Speed', value: voyage.avg_speed ? `${voyage.avg_speed.toFixed(1)} kts` : '—', icon: Activity, color: 'text-teal-400' },
          { label: 'Cargo', value: voyage.cargo_quantity ? `${(voyage.cargo_quantity / 1000).toFixed(0)}K MT` : '—', icon: Package, color: 'text-purple-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="glass-card p-4 rounded-2xl">
            <div className={`${color} mb-2`}><Icon size={16} /></div>
            <p className="text-lg font-bold text-white">{value}</p>
            <p className="text-xs text-navy-400">{label}</p>
          </div>
        ))}
      </div>

      {/* Voyage Track Map */}
      {trackPoints.length > 1 && (
        <div className="glass-card p-6 rounded-2xl">
          <h3 className="font-semibold text-white text-sm mb-4">Voyage Track ({trackPoints.length} positions)</h3>
          <div className="rounded-xl overflow-hidden" style={{ height: 320 }}>
            <MapContainer center={trackPoints[Math.floor(trackPoints.length / 2)]} zoom={3} className="h-full w-full">
              <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution="&copy; CartoDB" />
              <Polyline positions={trackPoints} color="#14B8A6" weight={2.5} opacity={0.9} />
              <CircleMarker center={trackPoints[0]} radius={7} color="#10B981" fillColor="#10B981" fillOpacity={0.9}><Popup>Departure: {voyage.departure_port}</Popup></CircleMarker>
              <CircleMarker center={trackPoints[trackPoints.length - 1]} radius={7} color="#0EA5E9" fillColor="#0EA5E9" fillOpacity={0.9}><Popup>Last position</Popup></CircleMarker>
            </MapContainer>
          </div>
        </div>
      )}

      {/* Noon Reports Table */}
      <div className="glass-card p-6 rounded-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white text-sm">Noon Reports ({reports.length})</h3>
          <button className="flex items-center gap-2 text-xs px-3 py-1.5 bg-teal-500/20 text-teal-400 rounded-lg hover:bg-teal-500/30 transition-colors">
            <Upload size={12} /> Upload Report
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/5">
                {['Date', 'Position', 'Speed (kts)', 'Distance (nm)', 'Wind Bft', 'Wave (m)', 'Fuel (MT)', 'ROB LSFO', 'Efficiency'].map(h => (
                  <th key={h} className="text-left py-2 px-2 text-navy-500 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reports.slice(0, 20).map((r, i) => (
                <motion.tr key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                  className="border-b border-white/3 hover:bg-white/2 transition-colors">
                  <td className="py-2 px-2 text-navy-300">{r.report_date}</td>
                  <td className="py-2 px-2 text-navy-400">{r.latitude?.toFixed(2)}°, {r.longitude?.toFixed(2)}°</td>
                  <td className={`py-2 px-2 font-medium ${r.speed_variance && r.speed_variance < -0.3 ? 'text-red-400' : 'text-white'}`}>{r.speed_over_ground?.toFixed(1) || '—'}</td>
                  <td className="py-2 px-2 text-navy-300">{r.distance_noon_to_noon?.toFixed(1) || '—'}</td>
                  <td className={`py-2 px-2 font-medium ${r.wind_force_bft && r.wind_force_bft > 5 ? 'text-orange-400' : 'text-teal-400'}`}>{r.wind_force_bft || '—'}</td>
                  <td className="py-2 px-2 text-navy-300">{r.wave_height?.toFixed(1) || '—'}</td>
                  <td className={`py-2 px-2 font-medium ${r.consumption_variance && r.consumption_variance > 2 ? 'text-red-400' : 'text-white'}`}>{r.total_fuel_consumption?.toFixed(2) || '—'}</td>
                  <td className="py-2 px-2 text-navy-400">{r.rob_lsfo?.toFixed(0) || '—'}</td>
                  <td className="py-2 px-2 text-teal-400">{r.fuel_efficiency?.toFixed(3) || '—'}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Claims */}
      {claims.length > 0 && (
        <div className="glass-card p-6 rounded-2xl border border-red-500/20">
          <h3 className="font-semibold text-white text-sm mb-4 flex items-center gap-2">
            <AlertTriangle size={14} className="text-red-400" /> Claims Detected ({claims.length})
          </h3>
          <div className="space-y-3">
            {claims.map(c => (
              <div key={c.id} className={`p-4 rounded-xl border ${c.severity === 'critical' ? 'border-red-500/30 bg-red-500/5' : 'border-orange-500/30 bg-orange-500/5'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-white capitalize">{c.claim_type.replace('_', ' ')}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${c.severity === 'critical' ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'}`}>{c.severity}</span>
                </div>
                <p className="text-sm text-navy-400 mt-1">{c.description}</p>
                {c.estimated_impact_usd && <p className="text-lg font-bold text-red-400 mt-2">${c.estimated_impact_usd.toLocaleString()} estimated impact</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
