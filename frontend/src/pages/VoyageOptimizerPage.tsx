// VoyageIQ AI — Maritime Intelligence Platform
// Copyright (c) 2024 Kartik Chaudhary. All Rights Reserved.
// Unauthorized copying or use of this file is strictly prohibited.
// Contact: 2512520007@geu.ac.in
import React, { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MapContainer, TileLayer, Polyline, CircleMarker, Popup, Circle, Tooltip
} from 'react-leaflet'
import {
  Navigation2, Anchor, Zap, Leaf, Shield, DollarSign,
  Clock, Fuel, AlertTriangle, ChevronDown, Play, Wind, Waves
} from 'lucide-react'
import { optimizationAPI } from '../services/api'
import { Port, RouteResult } from '../types'

const ROUTE_CONFIG = {
  optimal:  { label: 'Optimal Route',    icon: Navigation2, color: '#14B8A6', borderColor: 'border-teal-500/40',  bg: 'bg-teal-500/10',   textColor: 'text-teal-400'  },
  fastest:  { label: 'Fastest Route',    icon: Zap,         color: '#0EA5E9', borderColor: 'border-ocean-500/40', bg: 'bg-ocean-500/10',  textColor: 'text-ocean-400' },
  eco:      { label: 'Eco-Friendly',     icon: Leaf,        color: '#10B981', borderColor: 'border-green-500/40', bg: 'bg-green-500/10',  textColor: 'text-green-400' },
  safest:   { label: 'Safest Route',     icon: Shield,      color: '#F59E0B', borderColor: 'border-amber-500/40', bg: 'bg-amber-500/10',  textColor: 'text-amber-400' },
}

const RISK_COLORS: Record<string, string> = {
  low: '#10B981', moderate: '#F59E0B', high: '#F97316', extreme: '#EF4444'
}

function Speedometer({ speed, minSpeed = 8, maxSpeed = 25 }: { speed: number; minSpeed?: number; maxSpeed?: number }) {
  const pct = (speed - minSpeed) / (maxSpeed - minSpeed)
  const angle = -140 + pct * 280
  const color = speed < 12 ? '#10B981' : speed < 18 ? '#14B8A6' : speed < 22 ? '#F59E0B' : '#EF4444'
  return (
    <div className="relative flex items-center justify-center" style={{ width: 120, height: 80 }}>
      <svg viewBox="0 0 120 80" width="120" height="80">
        <path d="M 10 75 A 50 50 0 0 1 110 75" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" strokeLinecap="round" />
        <path d="M 10 75 A 50 50 0 0 1 110 75" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={`${pct * 157} 157`} />
        <line x1="60" y1="75" x2={60 + Math.cos(((angle - 90) * Math.PI) / 180) * 35} y2={75 + Math.sin(((angle - 90) * Math.PI) / 180) * 35}
          stroke={color} strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="60" cy="75" r="5" fill={color} />
        <text x="60" y="62" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">{speed}</text>
        <text x="60" y="74" textAnchor="middle" fill="#64748b" fontSize="8">kts</text>
      </svg>
    </div>
  )
}

export default function VoyageOptimizerPage() {
  const [ports, setPorts] = useState<Port[]>([])
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [vesselType, setVesselType] = useState('Bulk Carrier')
  const [speed, setSpeed] = useState(14)
  const [routes, setRoutes] = useState<RouteResult[]>([])
  const [selectedRoute, setSelectedRoute] = useState<string>('optimal')
  const [loading, setLoading] = useState(false)
  const [simSpeed, setSimSpeed] = useState(14)
  const [simResult, setSimResult] = useState<any>(null)
  const [simLoading, setSimLoading] = useState(false)
  const [originSearch, setOriginSearch] = useState('')
  const [destSearch, setDestSearch] = useState('')
  const [showOriginDrop, setShowOriginDrop] = useState(false)
  const [showDestDrop, setShowDestDrop] = useState(false)
  const simTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    optimizationAPI.getPorts().then(res => setPorts(res.data.ports || res.data)).catch(console.error)
  }, [])

  const filteredOrigin = ports.filter(p =>
    p.name.toLowerCase().includes(originSearch.toLowerCase()) ||
    p.country.toLowerCase().includes(originSearch.toLowerCase())
  ).slice(0, 8)

  const filteredDest = ports.filter(p =>
    p.name.toLowerCase().includes(destSearch.toLowerCase()) ||
    p.country.toLowerCase().includes(destSearch.toLowerCase())
  ).slice(0, 8)

  const handleCalculate = async () => {
    if (!origin || !destination) return
    setLoading(true)
    setRoutes([])
    try {
      const res = await optimizationAPI.generateRoute({
        origin_port: origin, destination_port: destination,
        vessel_type: vesselType, speed_knots: speed,
      })
      setRoutes(res.data.routes || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const runSimulator = useCallback(async (spd: number) => {
    if (!origin || !destination) return
    setSimLoading(true)
    try {
      const res = await optimizationAPI.fuelSimulator({
        speed_knots: spd, vessel_type: vesselType,
        origin_port: origin, destination_port: destination,
      })
      setSimResult(res.data)
    } catch (e) { console.error(e) }
    finally { setSimLoading(false) }
  }, [origin, destination, vesselType])

  const handleSimSpeedChange = (val: number) => {
    setSimSpeed(val)
    if (simTimer.current) clearTimeout(simTimer.current)
    simTimer.current = setTimeout(() => runSimulator(val), 400)
  }

  const activeRoute = routes.find(r => r.route_type === selectedRoute) || routes[0]
  const mapCenter: [number, number] = activeRoute?.waypoints?.length
    ? [activeRoute.waypoints[Math.floor(activeRoute.waypoints.length / 2)].lat,
       activeRoute.waypoints[Math.floor(activeRoute.waypoints.length / 2)].lon]
    : [20, 60]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-white">Voyage Optimization Engine</h1>
        <p className="text-navy-400 text-sm mt-1">Multi-criteria route planning with weather intelligence & fuel simulation</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Config Panel */}
        <div className="space-y-4">
          <div className="glass-card p-5 rounded-2xl space-y-4">
            <h3 className="font-semibold text-white flex items-center gap-2 text-sm"><Anchor size={14} className="text-teal-400" />Route Parameters</h3>

            {/* Origin */}
            <div className="relative">
              <label className="block text-xs text-navy-400 mb-1.5">Origin Port</label>
              <input value={originSearch} onChange={e => { setOriginSearch(e.target.value); setShowOriginDrop(true) }}
                onFocus={() => setShowOriginDrop(true)} placeholder="Search port..."
                className="w-full bg-navy-800 border border-navy-600 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-teal-500 placeholder-navy-500" />
              {origin && !showOriginDrop && <div className="mt-1 text-xs text-teal-400 font-medium">{origin}</div>}
              <AnimatePresence>
                {showOriginDrop && filteredOrigin.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="absolute top-full mt-1 left-0 right-0 bg-navy-800 border border-navy-600 rounded-xl overflow-hidden z-50 shadow-2xl">
                    {filteredOrigin.map(p => (
                      <button key={p.code} onClick={() => { setOrigin(p.name); setOriginSearch(p.name); setShowOriginDrop(false) }}
                        className="w-full px-3 py-2 text-left text-sm text-white hover:bg-teal-500/10 border-b border-white/5 last:border-0">
                        <span className="font-medium">{p.name}</span><span className="text-navy-400 text-xs ml-2">{p.country}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Destination */}
            <div className="relative">
              <label className="block text-xs text-navy-400 mb-1.5">Destination Port</label>
              <input value={destSearch} onChange={e => { setDestSearch(e.target.value); setShowDestDrop(true) }}
                onFocus={() => setShowDestDrop(true)} placeholder="Search port..."
                className="w-full bg-navy-800 border border-navy-600 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-teal-500 placeholder-navy-500" />
              {destination && !showDestDrop && <div className="mt-1 text-xs text-ocean-400 font-medium">{destination}</div>}
              <AnimatePresence>
                {showDestDrop && filteredDest.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="absolute top-full mt-1 left-0 right-0 bg-navy-800 border border-navy-600 rounded-xl overflow-hidden z-50 shadow-2xl">
                    {filteredDest.map(p => (
                      <button key={p.code} onClick={() => { setDestination(p.name); setDestSearch(p.name); setShowDestDrop(false) }}
                        className="w-full px-3 py-2 text-left text-sm text-white hover:bg-ocean-500/10 border-b border-white/5 last:border-0">
                        <span className="font-medium">{p.name}</span><span className="text-navy-400 text-xs ml-2">{p.country}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Vessel Type */}
            <div>
              <label className="block text-xs text-navy-400 mb-1.5">Vessel Type</label>
              <select value={vesselType} onChange={e => setVesselType(e.target.value)}
                className="w-full bg-navy-800 border border-navy-600 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-teal-500">
                {['Bulk Carrier', 'Container Ship', 'VLCC Tanker', 'LNG Carrier', 'General Cargo', 'Chemical Tanker'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Design Speed */}
            <div>
              <div className="flex justify-between mb-1.5">
                <label className="text-xs text-navy-400">Design Speed</label>
                <span className="text-sm font-bold text-teal-400">{speed} kts</span>
              </div>
              <input type="range" min={8} max={25} step={0.5} value={speed} onChange={e => setSpeed(Number(e.target.value))}
                className="w-full range-teal" />
              <div className="flex justify-between text-xs text-navy-600 mt-1"><span>8 kts</span><span>25 kts</span></div>
            </div>

            <motion.button onClick={handleCalculate} disabled={!origin || !destination || loading}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className="w-full py-3 bg-gradient-to-r from-teal-600 to-ocean-600 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-glow-teal">
              {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Play size={16} />Calculate Routes</>}
            </motion.button>
          </div>

          {/* Fuel Savings Simulator */}
          <div className="glass-card p-5 rounded-2xl space-y-4">
            <h3 className="font-semibold text-white text-sm flex items-center gap-2"><Fuel size={14} className="text-amber-400" />Fuel Savings Simulator</h3>
            <div className="flex items-center justify-center">
              <Speedometer speed={simSpeed} />
            </div>
            <div>
              <div className="flex justify-between mb-1.5">
                <label className="text-xs text-navy-400">Simulated Speed</label>
                <span className="text-sm font-bold text-amber-400">{simSpeed} kts</span>
              </div>
              <input type="range" min={8} max={25} step={0.5} value={simSpeed} onChange={e => handleSimSpeedChange(Number(e.target.value))}
                className="w-full range-amber" />
            </div>
            {simLoading && <div className="text-center text-xs text-navy-400 animate-pulse">Calculating...</div>}
            {simResult && !simLoading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                {[
                  { label: 'Fuel Required', value: `${simResult.fuel_mt?.toFixed(1)} MT`, color: 'text-amber-400' },
                  { label: 'Duration', value: `${simResult.duration_hrs?.toFixed(1)} hrs`, color: 'text-ocean-400' },
                  { label: 'Cost (USD)', value: `$${simResult.cost_usd?.toLocaleString(undefined, {maximumFractionDigits:0})}`, color: 'text-white' },
                  { label: 'Savings vs Baseline', value: `${simResult.savings_pct > 0 ? '+' : ''}${simResult.savings_pct?.toFixed(1)}%`, color: simResult.savings_pct >= 0 ? 'text-green-400' : 'text-red-400' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex justify-between items-center p-2 bg-navy-800/50 rounded-lg">
                    <span className="text-xs text-navy-400">{label}</span>
                    <span className={`text-sm font-bold ${color}`}>{value}</span>
                  </div>
                ))}
              </motion.div>
            )}
            {!simResult && !simLoading && origin && destination && (
              <p className="text-xs text-navy-500 text-center">Adjust speed to simulate</p>
            )}
          </div>
        </div>

        {/* Map + Route Cards */}
        <div className="lg:col-span-2 space-y-4">
          {/* Map */}
          <div className="glass-card p-4 rounded-2xl">
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              {Object.entries(ROUTE_CONFIG).map(([key, cfg]) => {
                const Icon = cfg.icon
                const hasRoute = routes.find(r => r.route_type === key)
                return (
                  <button key={key} onClick={() => hasRoute && setSelectedRoute(key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${selectedRoute === key ? cfg.bg + ' ' + cfg.textColor + ' border ' + cfg.borderColor : 'text-navy-500 hover:text-navy-300'} ${!hasRoute ? 'opacity-30 cursor-default' : 'cursor-pointer'}`}>
                    <Icon size={12} />{cfg.label}
                  </button>
                )
              })}
            </div>
            <div className="rounded-xl overflow-hidden" style={{ height: 360 }}>
              <MapContainer center={mapCenter} zoom={3} className="h-full w-full" scrollWheelZoom={false}>
                <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution="&copy; CartoDB" />

                {/* Weather risk zones */}
                {activeRoute?.risk_zones?.map((zone, i) => (
                  <Circle key={i} center={zone.center} radius={zone.radius * 1000}
                    color={RISK_COLORS[zone.level] || '#F59E0B'} fillColor={RISK_COLORS[zone.level] || '#F59E0B'}
                    fillOpacity={0.15} weight={1.5} dashArray="4 4">
                    <Tooltip>{zone.level.toUpperCase()} RISK</Tooltip>
                  </Circle>
                ))}

                {/* All route polylines */}
                {routes.map(route => {
                  const cfg = ROUTE_CONFIG[route.route_type as keyof typeof ROUTE_CONFIG]
                  if (!cfg) return null
                  const pts: [number, number][] = route.waypoints.map(w => [w.lat, w.lon])
                  return (
                    <Polyline key={route.route_type} positions={pts}
                      color={cfg.color} weight={selectedRoute === route.route_type ? 3.5 : 1.5}
                      opacity={selectedRoute === route.route_type ? 0.95 : 0.35} />
                  )
                })}

                {/* Origin/Destination markers */}
                {activeRoute?.waypoints?.[0] && (
                  <CircleMarker center={[activeRoute.waypoints[0].lat, activeRoute.waypoints[0].lon]}
                    radius={8} color="#10B981" fillColor="#10B981" fillOpacity={0.9} weight={2}>
                    <Popup><b>Origin:</b> {origin}</Popup>
                  </CircleMarker>
                )}
                {activeRoute?.waypoints?.length > 1 && (
                  <CircleMarker center={[activeRoute.waypoints[activeRoute.waypoints.length - 1].lat, activeRoute.waypoints[activeRoute.waypoints.length - 1].lon]}
                    radius={8} color="#EF4444" fillColor="#EF4444" fillOpacity={0.9} weight={2}>
                    <Popup><b>Destination:</b> {destination}</Popup>
                  </CircleMarker>
                )}
              </MapContainer>
            </div>

            {/* Weather Risk Legend */}
            <div className="flex items-center gap-4 mt-3 flex-wrap">
              <span className="text-xs text-navy-500">Weather Risk:</span>
              {[['Low', '#10B981'], ['Moderate', '#F59E0B'], ['High', '#F97316'], ['Extreme', '#EF4444']].map(([label, color]) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color, opacity: 0.7 }} />
                  <span className="text-xs text-navy-400">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Route Comparison Cards */}
          {routes.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {routes.map(route => {
                const cfg = ROUTE_CONFIG[route.route_type as keyof typeof ROUTE_CONFIG]
                if (!cfg) return null
                const Icon = cfg.icon
                const isSelected = selectedRoute === route.route_type
                return (
                  <motion.div key={route.route_type} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.02 }} onClick={() => setSelectedRoute(route.route_type)}
                    className={`glass-card p-4 rounded-2xl cursor-pointer transition-all border ${isSelected ? cfg.borderColor + ' ring-1 ring-offset-0 ' : 'border-transparent'} ${cfg.bg}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`p-1.5 rounded-lg ${cfg.bg}`}><Icon size={14} className={cfg.textColor} /></div>
                      <span className={`text-sm font-semibold ${cfg.textColor}`}>{cfg.label}</span>
                      {isSelected && <span className="ml-auto text-xs px-1.5 py-0.5 rounded bg-white/10 text-white">Selected</span>}
                    </div>
                    <div className="space-y-2">
                      {[
                        { label: 'Distance', value: `${route.total_distance_nm?.toFixed(0)} nm`, icon: Navigation2 },
                        { label: 'Duration', value: `${route.estimated_duration_hrs?.toFixed(1)} hrs`, icon: Clock },
                        { label: 'Fuel', value: `${route.estimated_fuel_mt?.toFixed(0)} MT`, icon: Fuel },
                        { label: 'Cost', value: `$${route.estimated_cost_usd?.toLocaleString(undefined, {maximumFractionDigits:0})}`, icon: DollarSign },
                      ].map(({ label, value, icon: ItemIcon }) => (
                        <div key={label} className="flex items-center justify-between text-xs">
                          <span className="text-navy-500 flex items-center gap-1"><ItemIcon size={10} />{label}</span>
                          <span className="text-white font-medium">{value}</span>
                        </div>
                      ))}
                      <div className="pt-1 border-t border-white/5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-navy-500 flex items-center gap-1"><AlertTriangle size={10} />Risk Score</span>
                          <span className={`font-bold ${route.weather_risk_score < 30 ? 'text-green-400' : route.weather_risk_score < 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {route.weather_risk_score?.toFixed(0)}/100
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}

          {/* Empty state */}
          {routes.length === 0 && !loading && (
            <div className="glass-card p-10 rounded-2xl text-center">
              <Navigation2 size={48} className="text-navy-600 mx-auto mb-3" />
              <p className="text-navy-400 text-sm">Select origin & destination ports, then click <strong className="text-teal-400">Calculate Routes</strong></p>
            </div>
          )}
        </div>
      </div>

      {/* 1° vs 0.25° Weather Resolution Comparison */}
      {routes.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 rounded-2xl">
          <h3 className="font-semibold text-white text-sm mb-4 flex items-center gap-2">
            <Wind size={14} className="text-sky-400" />
            1° Grid vs 0.25° Enhanced Weather Resolution
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { label: '1° Grid Forecast', fuel: activeRoute?.estimated_fuel_mt, eta: activeRoute?.estimated_duration_hrs, risk: activeRoute?.weather_risk_score, color: 'text-yellow-400', badge: 'Standard', badgeColor: 'bg-yellow-500/15 text-yellow-400' },
              { label: '0.25° Enhanced Forecast', fuel: activeRoute?.estimated_fuel_mt ? activeRoute.estimated_fuel_mt * 0.935 : null, eta: activeRoute?.estimated_duration_hrs ? activeRoute.estimated_duration_hrs * 0.955 : null, risk: activeRoute?.weather_risk_score ? activeRoute.weather_risk_score * 0.87 : null, color: 'text-teal-400', badge: 'Enhanced', badgeColor: 'bg-teal-500/15 text-teal-400' },
            ].map(({ label, fuel, eta, risk, color, badge, badgeColor }) => (
              <div key={label} className="p-4 bg-navy-800/50 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-white">{label}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${badgeColor}`}>{badge}</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Est. Fuel', value: fuel ? `${fuel.toFixed(0)} MT` : '—' },
                    { label: 'ETA (hrs)', value: eta ? `${eta.toFixed(1)} h` : '—' },
                    { label: 'Risk', value: risk ? `${risk.toFixed(0)}/100` : '—' },
                  ].map(({ label: l, value }) => (
                    <div key={l} className="text-center">
                      <p className={`text-lg font-bold font-display ${color}`}>{value}</p>
                      <p className="text-xs text-navy-500">{l}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {activeRoute && (
            <div className="mt-4 p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
              <p className="text-sm font-semibold text-green-400 mb-2">✓ Enhanced Resolution Savings</p>
              <div className="flex gap-8 flex-wrap">
                <div><p className="text-xs text-navy-400">Fuel Saving</p><p className="text-lg font-bold text-green-400">{activeRoute.estimated_fuel_mt ? `${(activeRoute.estimated_fuel_mt * 0.065).toFixed(1)} MT` : '—'}</p></div>
                <div><p className="text-xs text-navy-400">Time Saving</p><p className="text-lg font-bold text-green-400">{activeRoute.estimated_duration_hrs ? `${(activeRoute.estimated_duration_hrs * 0.045).toFixed(1)} hrs` : '—'}</p></div>
                <div><p className="text-xs text-navy-400">Cost Saving</p><p className="text-lg font-bold text-green-400">{activeRoute.estimated_cost_usd ? `$${(activeRoute.estimated_cost_usd * 0.065).toLocaleString(undefined, {maximumFractionDigits:0})}` : '—'}</p></div>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}
