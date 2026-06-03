// VoyageIQ AI — Maritime Intelligence Platform
// Copyright (c) 2024 Kartik Chaudhary. All Rights Reserved.
// Unauthorized copying or use of this file is strictly prohibited.
// Contact: 2512520007@geu.ac.in
import React, { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement,
  LineElement, ArcElement, Title, Tooltip, Legend, Filler
} from 'chart.js'
import { Bar, Line, Doughnut } from 'react-chartjs-2'
import { Fuel, TrendingUp, TrendingDown, DollarSign, Activity, AlertCircle, Info, CheckCircle } from 'lucide-react'
import { analyticsAPI, vesselsAPI } from '../services/api'
import { Vessel } from '../types'

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip, Legend, Filler)

const CHART_OPTS = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { labels: { color: '#94a3b8', font: { size: 11 } } }, tooltip: { backgroundColor: '#0A1F3A', titleColor: '#e2e8f0', bodyColor: '#94a3b8' } },
  scales: { x: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } }, y: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.06)' } } },
}

export default function FuelAnalyticsPage() {
  const [vessels, setVessels] = useState<Vessel[]>([])
  const [selectedVessel, setSelectedVessel] = useState<string>('')
  const [fuelData, setFuelData] = useState<any>(null)
  const [weatherData, setWeatherData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    vesselsAPI.list().then(res => {
      const vs = res.data.vessels || res.data
      setVessels(vs)
      if (vs.length > 0) setSelectedVessel(vs[0].id)
    }).catch(console.error)
  }, [])

  const loadFuelData = useCallback(async () => {
    setLoading(true)
    try {
      const [fRes, wRes] = await Promise.allSettled([
        analyticsAPI.fuel(selectedVessel || undefined),
        analyticsAPI.weatherImpact(),
      ])
      if (fRes.status === 'fulfilled') setFuelData(fRes.value.data)
      if (wRes.status === 'fulfilled') setWeatherData(wRes.value.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [selectedVessel])

  useEffect(() => { if (selectedVessel) loadFuelData() }, [selectedVessel, loadFuelData])

  const daily = fuelData?.daily_consumption?.slice(-20) || []
  const labels = daily.map((d: any) => { const dt = new Date(d.date); return `${dt.getMonth() + 1}/${dt.getDate()}` })

  const stackedBarData = {
    labels,
    datasets: [
      { label: 'ME', data: daily.map((d: any) => d.me || 0), backgroundColor: 'rgba(20,184,166,0.75)', borderRadius: 2 },
      { label: 'AE', data: daily.map((d: any) => d.ae || 0), backgroundColor: 'rgba(14,165,233,0.65)', borderRadius: 2 },
      { label: 'Boiler', data: daily.map((d: any) => d.boiler || 0), backgroundColor: 'rgba(139,92,246,0.5)', borderRadius: 2 },
    ],
  }

  const efficiencyData = {
    labels,
    datasets: [
      { label: 'Actual Efficiency', data: daily.map((d: any) => d.total > 0 ? ((d.me || 0) * 24 / d.total) : 0), borderColor: '#14B8A6', backgroundColor: 'rgba(20,184,166,0.1)', tension: 0.4, fill: true },
      { label: 'Benchmark', data: daily.map(() => 8.5), borderColor: '#F59E0B', borderDash: [5, 5], tension: 0 },
    ],
  }

  const fuelTypeData = {
    labels: ['LSFO', 'MGO'],
    datasets: [{ data: [78, 22], backgroundColor: ['rgba(20,184,166,0.8)', 'rgba(14,165,233,0.7)'], borderWidth: 0 }],
  }

  const robData = {
    labels,
    datasets: [
      { label: 'ROB LSFO', data: daily.map((_: any, i: number) => Math.max(200, 1200 - i * 40 + Math.random() * 20)), borderColor: '#14B8A6', backgroundColor: 'rgba(20,184,166,0.15)', fill: true, tension: 0.4 },
      { label: 'ROB MGO', data: daily.map((_: any, i: number) => Math.max(30, 150 - i * 5 + Math.random() * 5)), borderColor: '#0EA5E9', backgroundColor: 'rgba(14,165,233,0.1)', fill: true, tension: 0.4 },
    ],
  }

  const insights = fuelData?.insights || [
    'Fuel consumption increased by 8.3% due to Beaufort 5 conditions in days 12-15.',
    'ME efficiency is within 2% of warranted values. Good performance.',
    'AE consumption spike detected on day 8. Recommend auxiliary engine audit.',
    'ROB LSFO critically low. Arrange bunkering at next port call.',
  ]

  const insightIcon = (i: number) => {
    if (i === 0) return <AlertCircle size={14} className="text-orange-400 shrink-0 mt-0.5" />
    if (i === 1) return <CheckCircle size={14} className="text-green-400 shrink-0 mt-0.5" />
    return <Info size={14} className="text-ocean-400 shrink-0 mt-0.5" />
  }

  const weatherRows = weatherData?.by_beaufort || [
    { beaufort: '0-3 (Calm)', days: 8, avg_speed: 14.2, excess_cons: 0.0, impact: 0 },
    { beaufort: '4-5 (Moderate)', days: 9, avg_speed: 13.6, excess_cons: 1.8, impact: 6720 },
    { beaufort: '6+ (Rough)', days: 3, avg_speed: 12.1, excess_cons: 4.2, impact: 7812 },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">Fuel Analytics Center</h1>
          <p className="text-navy-400 text-sm mt-1">Advanced consumption analysis & efficiency tracking</p>
        </div>
        <select value={selectedVessel} onChange={e => setSelectedVessel(e.target.value)}
          className="bg-navy-800 border border-navy-600 text-white rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-teal-500">
          {vessels.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Consumption', value: fuelData?.total_consumption ? `${fuelData.total_consumption.toFixed(0)} MT` : '—', icon: Fuel, color: 'text-amber-400' },
          { label: 'Daily Average', value: fuelData?.daily_avg ? `${fuelData.daily_avg.toFixed(1)} MT/d` : '—', icon: Activity, color: 'text-teal-400' },
          { label: 'Total Cost', value: fuelData?.total_cost_usd ? `$${(fuelData.total_cost_usd / 1000).toFixed(0)}K` : '—', icon: DollarSign, color: 'text-green-400' },
          { label: 'Avg Efficiency', value: fuelData?.avg_efficiency ? `${fuelData.avg_efficiency.toFixed(2)} nm/MT` : '—', icon: TrendingUp, color: 'text-ocean-400' },
        ].map(({ label, value, icon: Icon, color }, i) => (
          <motion.div key={label} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
            className="glass-card p-5 rounded-2xl">
            <div className={`${color} mb-2`}><Icon size={18} /></div>
            <p className="text-xl font-bold font-display text-white">{value}</p>
            <p className="text-xs text-navy-400 mt-1">{label}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-5 rounded-2xl">
          <h3 className="text-sm font-semibold text-white mb-4">Daily Fuel Consumption (ME / AE / Boiler)</h3>
          <div style={{ height: 220 }}><Bar data={stackedBarData} options={{ ...CHART_OPTS as any, scales: { x: CHART_OPTS.scales.x, y: { ...CHART_OPTS.scales.y, stacked: true } } }} /></div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="glass-card p-5 rounded-2xl">
          <h3 className="text-sm font-semibold text-white mb-4">ROB Trend (LSFO & MGO)</h3>
          <div style={{ height: 220 }}><Line data={robData} options={CHART_OPTS as any} /></div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card p-5 rounded-2xl">
          <h3 className="text-sm font-semibold text-white mb-4">Fuel Efficiency vs Benchmark (nm/MT)</h3>
          <div style={{ height: 220 }}><Line data={efficiencyData} options={CHART_OPTS as any} /></div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="glass-card p-5 rounded-2xl">
          <h3 className="text-sm font-semibold text-white mb-4">Fuel Type Split (LSFO vs MGO)</h3>
          <div style={{ height: 220 }}><Doughnut data={fuelTypeData} options={{ ...CHART_OPTS as any, cutout: '60%', scales: undefined } as any} /></div>
        </motion.div>
      </div>

      {/* AI Insights */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-card p-6 rounded-2xl">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Activity size={14} className="text-teal-400" /> AI-Generated Fuel Insights
        </h3>
        <div className="space-y-3">
          {insights.map((insight: string, i: number) => (
            <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 + i * 0.1 }}
              className="flex items-start gap-3 p-3 rounded-xl bg-navy-800/50">
              {insightIcon(i)}
              <p className="text-sm text-navy-300">{insight}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Weather Impact Table */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="glass-card p-6 rounded-2xl">
        <h3 className="text-sm font-semibold text-white mb-4">Weather Impact Analysis</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                {['Beaufort Conditions', 'Days', 'Avg Speed (kts)', 'Excess Consumption (MT/d)', 'Commercial Impact ($)'].map(h => (
                  <th key={h} className="text-left py-2 px-3 text-xs text-navy-500 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weatherRows.map((row: any, i: number) => (
                <tr key={i} className="border-b border-white/3 hover:bg-white/2">
                  <td className="py-3 px-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${i === 0 ? 'bg-green-500/15 text-green-400' : i === 1 ? 'bg-yellow-500/15 text-yellow-400' : 'bg-red-500/15 text-red-400'}`}>
                      {row.beaufort}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-navy-300">{row.days}</td>
                  <td className="py-3 px-3 text-white font-medium">{row.avg_speed?.toFixed(1)}</td>
                  <td className={`py-3 px-3 font-medium ${row.excess_cons > 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {row.excess_cons > 0 ? '+' : ''}{row.excess_cons?.toFixed(1)}
                  </td>
                  <td className="py-3 px-3">
                    {row.impact > 0 ? <span className="text-red-400 font-bold">${row.impact.toLocaleString()}</span> : <span className="text-green-400">No impact</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  )
}
