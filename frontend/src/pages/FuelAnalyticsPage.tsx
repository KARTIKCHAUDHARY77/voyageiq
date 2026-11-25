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
        analyticsAPI.weatherImpact(selectedVessel || undefined),
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

  const warranted = fuelData?.warranted
  const warrantedNmPerMt = warranted?.speed && warranted?.consumption ? (warranted.speed * 24) / warranted.consumption : null

  const efficiencyData = {
    labels,
    datasets: [
      { label: 'Actual (nm/MT)', data: daily.map((d: any) => d.total > 0 && d.distance > 0 ? d.distance / d.total : null), borderColor: '#14B8A6', backgroundColor: 'rgba(20,184,166,0.1)', tension: 0.3, spanGaps: true },
      ...(warrantedNmPerMt ? [{ label: 'Warranted (nm/MT)', data: daily.map(() => warrantedNmPerMt), borderColor: '#F59E0B', borderDash: [5, 5], pointRadius: 0, tension: 0 }] : []),
    ],
  }

  const split = fuelData?.fuel_type_split || { lsfo: 0, mgo: 0 }
  const fuelTypeData = {
    labels: ['LSFO', 'MGO'],
    datasets: [{ data: [split.lsfo, split.mgo], backgroundColor: ['rgba(20,184,166,0.8)', 'rgba(14,165,233,0.7)'], borderWidth: 0 }],
  }

  const robData = {
    labels,
    datasets: [
      { label: 'ROB LSFO (MT)', data: daily.map((d: any) => d.rob_lsfo), borderColor: '#14B8A6', backgroundColor: 'rgba(20,184,166,0.15)', fill: true, tension: 0.3, spanGaps: true },
      { label: 'ROB MGO (MT)', data: daily.map((d: any) => d.rob_mgo), borderColor: '#0EA5E9', backgroundColor: 'rgba(14,165,233,0.1)', fill: true, tension: 0.3, spanGaps: true },
    ],
  }

  const insights: string[] = [...(fuelData?.insights || []), ...(weatherData?.insights || [])]
  const noData = !loading && fuelData?.data_source === 'none'

  const BAND_LABELS: Record<string, string> = { calm_0_3: 'Beaufort 0-3', moderate_4_5: 'Beaufort 4-5', rough_6_7: 'Beaufort 6-7', severe_8_plus: 'Beaufort 8+' }
  const weatherRows = Object.entries(weatherData?.weather_bands || {})
    .map(([key, v]: [string, any]) => ({ key, label: BAND_LABELS[key] || key, ...v }))
    .filter((r: any) => r.report_count > 0)

  const insightIcon = (i: number) => {
    if (i === 0) return <AlertCircle size={14} className="text-orange-400 shrink-0 mt-0.5" />
    if (i === 1) return <CheckCircle size={14} className="text-green-400 shrink-0 mt-0.5" />
    return <Info size={14} className="text-ocean-400 shrink-0 mt-0.5" />
  }


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

      {noData && (
        <div role="status" className="glass-card p-5 text-sm text-navy-300">
          No noon reports for this vessel yet. Add or upload reports and the charts below will fill in.
        </div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Consumption', value: fuelData?.total_consumed_mt != null ? `${fuelData.total_consumed_mt.toFixed(0)} MT` : '—', icon: Fuel, color: 'text-amber-400' },
          { label: 'Daily Average', value: fuelData?.total_consumed_mt != null && daily.length ? `${(fuelData.total_consumed_mt / (fuelData.daily_consumption.length || 1)).toFixed(1)} MT/d` : '—', icon: Activity, color: 'text-teal-400' },
          { label: `Cost at $${fuelData?.bunker_price_per_mt ?? '—'}/MT (assumed)`, value: fuelData?.total_cost_usd != null ? `$${(fuelData.total_cost_usd / 1000).toFixed(0)}K` : '—', icon: DollarSign, color: 'text-green-400' },
          { label: 'Avg Efficiency', value: fuelData?.avg_efficiency != null ? `${fuelData.avg_efficiency.toFixed(2)} nm/MT` : '—', icon: TrendingUp, color: 'text-ocean-400' },
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
          <h3 className="text-sm font-semibold text-white mb-4">Fuel Efficiency vs Warranted (nm/MT)</h3>
          <div style={{ height: 220 }}><Line data={efficiencyData} options={CHART_OPTS as any} /></div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="glass-card p-5 rounded-2xl">
          <h3 className="text-sm font-semibold text-white mb-4">Fuel Type Split (LSFO vs MGO)</h3>
          <div style={{ height: 220 }}><Doughnut data={fuelTypeData} options={{ ...CHART_OPTS as any, cutout: '60%', scales: undefined } as any} /></div>
        </motion.div>
      </div>

      {/* Findings */}
      {insights.length > 0 && <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-card p-6 rounded-2xl">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Activity size={14} className="text-teal-400" /> Findings from the data
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
      </motion.div>}

      {/* Weather Impact Table */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="glass-card p-6 rounded-2xl">
        <h3 className="text-sm font-semibold text-white mb-4">Weather Impact Analysis</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                {['Beaufort Conditions', 'Report days', 'Speed loss vs warranted (kn)', 'Excess ME burn (MT/d)'].map(h => (
                  <th key={h} className="text-left py-2 px-3 text-xs text-navy-500 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weatherRows.map((row: any) => (
                <tr key={row.key} className="border-b border-white/3">
                  <td className="py-3 px-3 text-navy-300">{row.label}</td>
                  <td className="py-3 px-3 text-navy-300 tabular-nums">{row.report_count}</td>
                  <td className="py-3 px-3 text-white tabular-nums">{row.avg_speed_loss_kn != null ? row.avg_speed_loss_kn.toFixed(2) : '—'}</td>
                  <td className="py-3 px-3 text-white tabular-nums">{row.avg_excess_consumption_mt != null ? `${row.avg_excess_consumption_mt > 0 ? '+' : ''}${row.avg_excess_consumption_mt.toFixed(1)}` : '—'}</td>
                </tr>
              ))}
              {weatherRows.length === 0 && (
                <tr><td colSpan={4} className="py-6 px-3 text-navy-400">No reports with a recorded wind force yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  )
}
