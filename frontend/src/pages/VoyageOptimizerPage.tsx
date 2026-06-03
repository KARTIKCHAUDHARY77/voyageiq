// VoyageIQ AI — Maritime Intelligence Platform
// Copyright (c) 2024 Kartik Chaudhary. All Rights Reserved.
import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Map, Zap, Fuel, Clock, Wind, Waves, Navigation, TrendingDown,
  Lightbulb, AlertTriangle, CheckCircle, BarChart2, Loader,
  Download, RefreshCw, ChevronDown, Info, Activity, Ship
} from 'lucide-react'
import { optimizationAPI, reportsAPI, voyagesAPI } from '../services/api'
import toast from 'react-hot-toast'

// ─── Types ───────────────────────────────────────────────────────────────────

interface CalcResult {
  distance_nm: number; effective_speed: number; duration_hrs: number; duration_days: number
  me_consumption_day: number; ae_consumption_day: number; total_daily_fuel: number
  total_fuel_mt: number; fuel_cost_usd: number; fuel_per_nm: number; fuel_type: string
  avg_wind_kn: number; avg_wave_m: number; avg_current_kn: number; beaufort_avg: number
  weather_factor: number; weather_penalty_pct: number
  eco_speed: number; eco_fuel_mt: number; eco_savings_fuel: number
  eco_savings_usd: number; eco_time_penalty_hrs: number
  co2_total_mt: number; cii_attained: number; cii_rating: string
  performance_score: number; loading_ratio: number
}
interface Suggestion { type: string; title: string; detail: string; saving_usd: number }
interface WeatherSample { lat: number; lon: number; frac: number; wind_speed_kn: number; wave_height: number; beaufort: number; current_speed: number }
interface ApiResult {
  calculation: CalcResult; suggestions: Suggestion[]; weather_samples: WeatherSample[]
  distance_nm: number; eta: string; departure: string; weather_grid_resolution: string
  weather_sample_points: number
}

// ─── Constants ───────────────────────────────────────────────────────────────

const VESSEL_TYPES = [
  'Bulk Carrier','VLCC Tanker','Suezmax Tanker','Aframax Tanker',
  'Container (Large)','Container (Medium)','Container (Feeder)',
  'Chemical Tanker','LNG Carrier','LPG Carrier','General Cargo','RoRo',
]
const FUEL_TYPES   = ['VLSFO','MGO','LSMGO','LNG']
const CURR_DIRS    = ['Following','Beam (Port)','Beam (Starboard)','Head','Bow']
const WIND_DIRS    = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']
const SEA_STATES   = ['0 – Glassy','1 – Rippled','2 – Wavelets','3 – Slight','4 – Moderate','5 – Rough','6 – Very Rough','7 – High','8 – Very High','9 – Phenomenal']
const WEATHER_COND = ['Clear / Sunny','Partly Cloudy','Overcast','Fog','Rain','Heavy Rain / Storm','Tropical Cyclone']

const WORLD_PORTS = [
  'Singapore','Shanghai','Busan','Hong Kong','Tokyo Bay','Port Klang','Jakarta','Manila',
  'Sydney','Melbourne','Mumbai','Colombo','Chittagong','Dubai (Jebel Ali)','Ras Tanura',
  'Fujairah','Durban','Cape Town','Mombasa','Lagos','Rotterdam','Antwerp','Hamburg',
  'Felixstowe','Barcelona','Piraeus','Genoa','Los Angeles','New York','Houston',
  'Vancouver','Santos','Colon (Panama)','Tianjin','Qingdao','Ningbo','Kaohsiung',
  'Laem Chabang','Aden','Suez','Alexandria','Karachi','Dar es Salaam','Abidjan',
]

const CII_COLORS: Record<string, string> = {
  A: 'text-green-400', B: 'text-teal-400', C: 'text-yellow-400', D: 'text-orange-400', E: 'text-red-400'
}
const SUGGESTION_ICONS: Record<string, { icon: typeof Lightbulb; color: string }> = {
  opportunity: { icon: Lightbulb,       color: 'text-teal-400'   },
  warning:     { icon: AlertTriangle,   color: 'text-yellow-400' },
  critical:    { icon: AlertTriangle,   color: 'text-red-400'    },
  success:     { icon: CheckCircle,     color: 'text-green-400'  },
  info:        { icon: Info,            color: 'text-blue-400'   },
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function VoyageOptimizerPage() {
  const [loading, setLoading]         = useState(false)
  const [result,  setResult]          = useState<ApiResult | null>(null)
  const [voyages, setVoyages]         = useState<any[]>([])
  const [activeTab, setActiveTab]     = useState<'calculator'|'routes'>('calculator')
  const [showWeather, setShowWeather] = useState(false)
  const [form, setForm] = useState({
    origin_port:        'Singapore',
    destination_port:   'Rotterdam',
    vessel_type:        'Bulk Carrier',
    dwt:                75000,
    draft:              13.5,
    cargo_weight:       60000,
    target_speed:       14.0,
    fuel_type:          'VLSFO',
    fuel_price_usd:     580,
    departure_datetime: new Date(Date.now() + 3600_000).toISOString().slice(0,16),
    // Environmental
    wind_speed_kn:      '',
    wind_direction:     'SW',
    wave_height_m:      '',
    swell_height_m:     '',
    current_speed_kn:   0.5,
    current_direction:  'Following',
    sea_state:          '3 – Slight',
    weather_condition:  'Partly Cloudy',
    use_live_weather:   true,
  })

  useEffect(() => { voyagesAPI.list().then(r => setVoyages(r.data?.voyages || r.data || [])).catch(() => {}) }, [])

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const handleCalculate = useCallback(async () => {
    if (form.origin_port === form.destination_port) {
      return toast.error('Origin and destination must be different ports')
    }
    setLoading(true)
    setResult(null)
    const tid = toast.loading('Sampling 0.25° weather grid along route…')
    try {
      const payload = {
        ...form,
        dwt:              Number(form.dwt),
        draft:            Number(form.draft),
        cargo_weight:     Number(form.cargo_weight),
        target_speed:     Number(form.target_speed),
        fuel_price_usd:   Number(form.fuel_price_usd),
        wind_speed_kn:    form.wind_speed_kn !== '' ? Number(form.wind_speed_kn) : null,
        wave_height_m:    form.wave_height_m  !== '' ? Number(form.wave_height_m) : null,
        current_speed_kn: Number(form.current_speed_kn),
      }
      const res = await optimizationAPI.calculate(payload)
      setResult(res.data)
      toast.success(`Voyage calculated — ${res.data.weather_sample_points} weather samples at ${res.data.weather_grid_resolution} grid`, { id: tid })
      setActiveTab('calculator')
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Calculation failed', { id: tid })
    } finally { setLoading(false) }
  }, [form])

  const calc = result?.calculation
  const etaDisplay = result?.eta ? new Date(result.eta).toLocaleString() : '—'

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-screen-2xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white font-display flex items-center gap-3">
            <Map className="text-teal-400" size={28} /> Voyage Calculator
          </h1>
          <p className="text-white/40 text-sm mt-0.5">Physics-based calculator with live 0.25° weather grid sampling</p>
        </div>
        {result && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-teal-500/10 border border-teal-500/20 rounded-xl text-xs text-teal-400">
            <Activity size={12} /> {result.weather_sample_points} samples @ {result.weather_grid_resolution} grid
          </div>
        )}
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        {/* ─── Left Input Panel ────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="xl:col-span-2 space-y-4">

          {/* Route */}
          <div className="glass-card p-5 rounded-2xl">
            <p className="text-teal-400 text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
              <Navigation size={12} /> Route
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-white/40 text-xs mb-1 block">Origin Port</label>
                <select value={form.origin_port} onChange={e => set('origin_port', e.target.value)} className="maritime-select">
                  {WORLD_PORTS.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div className="flex justify-center">
                <div className="w-0.5 h-5 bg-gradient-to-b from-teal-400 to-ocean-400 rounded-full" />
              </div>
              <div>
                <label className="text-white/40 text-xs mb-1 block">Destination Port</label>
                <select value={form.destination_port} onChange={e => set('destination_port', e.target.value)} className="maritime-select">
                  {WORLD_PORTS.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-white/40 text-xs mb-1 block">Departure Date/Time</label>
                <input type="datetime-local" value={form.departure_datetime}
                  onChange={e => set('departure_datetime', e.target.value)} className="maritime-input" />
              </div>
            </div>
          </div>

          {/* Vessel */}
          <div className="glass-card p-5 rounded-2xl">
            <p className="text-teal-400 text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
              <Ship size={12} /> Vessel & Cargo
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-white/40 text-xs mb-1 block">Vessel Type</label>
                <select value={form.vessel_type} onChange={e => set('vessel_type', e.target.value)} className="maritime-select">
                  {VESSEL_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-white/40 text-xs mb-1 block">DWT (tonnes)</label>
                  <input type="number" value={form.dwt} onChange={e => set('dwt', e.target.value)}
                    className="maritime-input" placeholder="75000" />
                </div>
                <div>
                  <label className="text-white/40 text-xs mb-1 block">Design Draft (m)</label>
                  <input type="number" step="0.1" value={form.draft} onChange={e => set('draft', e.target.value)}
                    className="maritime-input" placeholder="13.5" />
                </div>
              </div>
              <div>
                <label className="text-white/40 text-xs mb-1 block">
                  Cargo Weight (tonnes) — 0 = ballast
                </label>
                <input type="number" value={form.cargo_weight} onChange={e => set('cargo_weight', e.target.value)}
                  className="maritime-input" placeholder="60000" />
                {form.dwt > 0 && (
                  <div className="mt-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-teal-400 to-ocean-400 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (Number(form.cargo_weight)/Number(form.dwt))*100)}%` }} />
                  </div>
                )}
                <p className="text-white/20 text-xs mt-0.5">
                  Loading: {form.dwt > 0 ? ((Number(form.cargo_weight)/Number(form.dwt))*100).toFixed(0) : 0}%
                </p>
              </div>
            </div>
          </div>

          {/* Speed & Fuel */}
          <div className="glass-card p-5 rounded-2xl">
            <p className="text-teal-400 text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
              <Fuel size={12} /> Speed & Fuel
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-white/40 text-xs mb-1 flex items-center justify-between">
                  <span>Target Speed</span>
                  <span className="text-teal-400 font-bold">{form.target_speed} kn</span>
                </label>
                <input type="range" min="6" max="26" step="0.5" value={form.target_speed}
                  onChange={e => set('target_speed', Number(e.target.value))}
                  className="w-full accent-teal-400" />
                <div className="flex justify-between text-white/20 text-xs mt-0.5">
                  <span>6 kn (ECO)</span><span>26 kn (MAX)</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-white/40 text-xs mb-1 block">Fuel Type</label>
                  <select value={form.fuel_type} onChange={e => set('fuel_type', e.target.value)} className="maritime-select">
                    {FUEL_TYPES.map(f => <option key={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-white/40 text-xs mb-1 block">Bunker Price ($/MT)</label>
                  <input type="number" value={form.fuel_price_usd} onChange={e => set('fuel_price_usd', e.target.value)}
                    className="maritime-input" placeholder="580" />
                </div>
              </div>
            </div>
          </div>

          {/* Environmental Conditions */}
          <div className="glass-card p-5 rounded-2xl">
            <div className="flex items-center justify-between mb-3">
              <p className="text-teal-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                <Wind size={12} /> Environmental Conditions
              </p>
              <label className="flex items-center gap-2 text-xs text-white/40 cursor-pointer">
                <input type="checkbox" checked={form.use_live_weather}
                  onChange={e => set('use_live_weather', e.target.checked)}
                  className="accent-teal-400" />
                Live 0.25° Grid
              </label>
            </div>
            {!form.use_live_weather && (
              <p className="text-yellow-400/60 text-xs mb-3 bg-yellow-500/5 border border-yellow-500/15 rounded-lg px-2 py-1.5">
                ⚡ Manual mode — your values override live weather
              </p>
            )}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-white/40 text-xs mb-1 block">Wind Speed (kn) {form.use_live_weather && '← live'}</label>
                  <input type="number" step="0.5" value={form.wind_speed_kn}
                    onChange={e => set('wind_speed_kn', e.target.value)}
                    placeholder={form.use_live_weather ? 'from API' : '12.0'} className="maritime-input" />
                </div>
                <div>
                  <label className="text-white/40 text-xs mb-1 block">Wind Direction</label>
                  <select value={form.wind_direction} onChange={e => set('wind_direction', e.target.value)} className="maritime-select">
                    {WIND_DIRS.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-white/40 text-xs mb-1 block">Wave Height (m) {form.use_live_weather && '← live'}</label>
                  <input type="number" step="0.1" value={form.wave_height_m}
                    onChange={e => set('wave_height_m', e.target.value)}
                    placeholder={form.use_live_weather ? 'from API' : '1.5'} className="maritime-input" />
                </div>
                <div>
                  <label className="text-white/40 text-xs mb-1 block">Swell Height (m)</label>
                  <input type="number" step="0.1" value={form.swell_height_m}
                    onChange={e => set('swell_height_m', e.target.value)} placeholder="1.2" className="maritime-input" />
                </div>
              </div>
              <div>
                <label className="text-white/40 text-xs mb-1 block">Sea State (Beaufort)</label>
                <select value={form.sea_state} onChange={e => set('sea_state', e.target.value)} className="maritime-select">
                  {SEA_STATES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-white/40 text-xs mb-1 block">Weather Condition</label>
                <select value={form.weather_condition} onChange={e => set('weather_condition', e.target.value)} className="maritime-select">
                  {WEATHER_COND.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-white/40 text-xs mb-1 block">Ocean Current (kn)</label>
                  <input type="number" step="0.1" value={form.current_speed_kn}
                    onChange={e => set('current_speed_kn', e.target.value)} placeholder="0.5" className="maritime-input" />
                </div>
                <div>
                  <label className="text-white/40 text-xs mb-1 block">Current Direction</label>
                  <select value={form.current_direction} onChange={e => set('current_direction', e.target.value)} className="maritime-select">
                    {CURR_DIRS.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Calculate Button */}
          <button onClick={handleCalculate} disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-teal-500 to-ocean-500 hover:from-teal-400 hover:to-ocean-400
              disabled:opacity-50 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-3
              shadow-glow-teal transition-all">
            {loading ? <Loader size={22} className="animate-spin" /> : <Zap size={22} />}
            {loading ? 'Calculating…' : 'Calculate Voyage'}
          </button>
        </motion.div>

        {/* ─── Right Output Panel ───────────────────────────────────────────── */}
        <div className="xl:col-span-3 space-y-4">
          <AnimatePresence mode="wait">
            {!result && !loading && (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center h-80 glass-card rounded-2xl text-center gap-4">
                <Map size={48} className="text-white/10" />
                <div>
                  <p className="text-white/50 font-semibold">Fill in voyage details and click Calculate</p>
                  <p className="text-white/25 text-sm mt-1">Live weather data sampled at 0.25° grid resolution along route</p>
                </div>
              </motion.div>
            )}

            {loading && (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center h-80 glass-card rounded-2xl gap-4">
                <Loader size={36} className="animate-spin text-teal-400" />
                <p className="text-white/60">Sampling 0.25° weather grid along route…</p>
                <p className="text-white/30 text-sm">Fetching 8 weather data points via Open-Meteo API</p>
              </motion.div>
            )}

            {result && calc && (
              <motion.div key="result" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

                {/* KPI Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { icon: Navigation,  label: 'Distance',   value: `${result.distance_nm.toFixed(0)} nm`,          sub: 'Great-circle' },
                    { icon: Clock,       label: 'Duration',   value: `${calc.duration_days.toFixed(1)} days`,          sub: `${calc.duration_hrs.toFixed(0)} hrs` },
                    { icon: Zap,         label: 'Eff. Speed', value: `${calc.effective_speed.toFixed(1)} kn`,          sub: `${calc.weather_penalty_pct}% weather loss` },
                    { icon: Activity,    label: 'Perf Score', value: `${calc.performance_score}`,                      sub: 'out of 100' },
                  ].map(({ icon: Icon, label, value, sub }) => (
                    <div key={label} className="glass-card p-4 rounded-xl text-center">
                      <Icon size={16} className="mx-auto mb-1 text-teal-400" />
                      <p className="text-white font-bold text-xl">{value}</p>
                      <p className="text-white/40 text-xs">{label}</p>
                      <p className="text-white/25 text-xs">{sub}</p>
                    </div>
                  ))}
                </div>

                {/* ETA */}
                <div className="glass-card p-4 rounded-xl flex flex-wrap gap-4 items-center justify-between">
                  <div>
                    <p className="text-white/40 text-xs mb-0.5">Estimated Time of Arrival</p>
                    <p className="text-white font-bold text-lg">{etaDisplay}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white/40 text-xs mb-0.5">CII Rating</p>
                    <span className={`text-2xl font-bold ${CII_COLORS[calc.cii_rating] || 'text-white'}`}>
                      {calc.cii_rating}
                    </span>
                    <p className="text-white/30 text-xs">{calc.cii_attained.toFixed(3)} gCO₂/cap·nm</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white/40 text-xs mb-0.5">CO₂ Emissions</p>
                    <p className="text-white font-semibold">{calc.co2_total_mt.toFixed(0)} MT</p>
                    <p className="text-white/30 text-xs">Carbon footprint</p>
                  </div>
                </div>

                {/* Fuel Breakdown */}
                <div className="glass-card p-5 rounded-2xl">
                  <h3 className="text-white font-semibold text-sm mb-4 flex items-center gap-2"><Fuel size={15} className="text-teal-400" /> Fuel Analysis</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                    {[
                      { label: 'ME Consumption/day', value: `${calc.me_consumption_day} MT` },
                      { label: 'AE Consumption/day', value: `${calc.ae_consumption_day} MT` },
                      { label: 'Total Daily',         value: `${calc.total_daily_fuel} MT` },
                      { label: 'Total Voyage Fuel',   value: `${calc.total_fuel_mt} MT`, highlight: true },
                      { label: 'Fuel Cost',           value: `$${calc.fuel_cost_usd.toLocaleString()}`, highlight: true },
                      { label: 'Fuel per nm',         value: `${calc.fuel_per_nm} MT/nm` },
                    ].map(({ label, value, highlight }) => (
                      <div key={label} className={`p-3 rounded-xl ${highlight ? 'bg-teal-500/10 border border-teal-500/20' : 'bg-white/3'}`}>
                        <p className={`font-bold text-base ${highlight ? 'text-teal-300' : 'text-white'}`}>{value}</p>
                        <p className="text-white/40 text-xs">{label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Eco speed box */}
                  <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-green-400 font-semibold text-sm flex items-center gap-1.5">
                          <TrendingDown size={14} /> Eco Speed Opportunity
                        </p>
                        <p className="text-white/60 text-xs mt-1">
                          Reduce to <span className="text-green-400 font-semibold">{calc.eco_speed} kn</span> to save{' '}
                          <span className="text-green-400 font-semibold">{calc.eco_savings_fuel} MT</span> of fuel
                          (+{calc.eco_time_penalty_hrs.toFixed(1)}h voyage time)
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-green-400 font-bold text-lg">${calc.eco_savings_usd.toLocaleString()}</p>
                        <p className="text-white/30 text-xs">potential saving</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Weather Grid */}
                <div className="glass-card p-5 rounded-2xl">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                      <Wind size={15} className="text-teal-400" /> Weather Grid (0.25° Resolution)
                    </h3>
                    <button onClick={() => setShowWeather(w => !w)}
                      className="text-white/40 hover:text-white text-xs flex items-center gap-1 transition-colors">
                      {showWeather ? 'Hide' : 'Show'} details <ChevronDown size={12} className={showWeather ? 'rotate-180' : ''} />
                    </button>
                  </div>

                  {/* Summary row */}
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { label: 'Avg Wind',   value: `${calc.avg_wind_kn} kn`,   icon: Wind  },
                      { label: 'Avg Waves',  value: `${calc.avg_wave_m} m`,      icon: Waves },
                      { label: 'Beaufort',   value: `BF ${calc.beaufort_avg.toFixed(1)}`, icon: Activity },
                      { label: 'Speed Loss', value: `${calc.weather_penalty_pct}%`, icon: TrendingDown },
                    ].map(({ label, value, icon: Icon }) => (
                      <div key={label} className="text-center p-2 bg-white/3 rounded-lg">
                        <Icon size={13} className="mx-auto mb-1 text-teal-400/70" />
                        <p className="text-white text-sm font-semibold">{value}</p>
                        <p className="text-white/30 text-xs">{label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Detailed sample points */}
                  <AnimatePresence>
                    {showWeather && result.weather_samples.length > 0 && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden mt-3">
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-white/30 border-b border-white/5">
                                <th className="text-left py-1.5 px-2">Point</th>
                                <th className="text-left py-1.5 px-2">Position</th>
                                <th className="text-right py-1.5 px-2">Wind (kn)</th>
                                <th className="text-right py-1.5 px-2">Waves (m)</th>
                                <th className="text-right py-1.5 px-2">BF</th>
                                <th className="text-right py-1.5 px-2">Current</th>
                              </tr>
                            </thead>
                            <tbody>
                              {result.weather_samples.map((s, i) => (
                                <tr key={i} className={`border-b border-white/3 ${i % 2 === 0 ? '' : 'bg-white/1'}`}>
                                  <td className="py-1.5 px-2 text-white/50">{Math.round(s.frac * 100)}%</td>
                                  <td className="py-1.5 px-2 text-white/60">{s.lat}° {s.lon}°</td>
                                  <td className="py-1.5 px-2 text-right text-white/80">{s.wind_speed_kn}</td>
                                  <td className="py-1.5 px-2 text-right text-white/80">{s.wave_height}</td>
                                  <td className={`py-1.5 px-2 text-right font-bold ${s.beaufort >= 6 ? 'text-red-400' : s.beaufort >= 4 ? 'text-yellow-400' : 'text-green-400'}`}>
                                    {s.beaufort}
                                  </td>
                                  <td className="py-1.5 px-2 text-right text-white/50">{s.current_speed} kn</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* AI Suggestions */}
                <div className="glass-card p-5 rounded-2xl">
                  <h3 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
                    <Lightbulb size={15} className="text-teal-400" /> AI Voyage Recommendations
                  </h3>
                  <div className="space-y-3">
                    {result.suggestions.map((s, i) => {
                      const iconCfg = SUGGESTION_ICONS[s.type] || SUGGESTION_ICONS.info
                      const Icon = iconCfg.icon
                      return (
                        <motion.div key={i} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }}
                          className="flex gap-3 p-3 bg-white/3 border border-white/6 rounded-xl">
                          <Icon size={16} className={`${iconCfg.color} flex-shrink-0 mt-0.5`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-semibold">{s.title}</p>
                            <p className="text-white/50 text-xs mt-0.5 leading-relaxed">{s.detail}</p>
                          </div>
                          {s.saving_usd > 0 && (
                            <div className="flex-shrink-0 text-right">
                              <p className="text-green-400 font-bold text-sm">${s.saving_usd.toLocaleString()}</p>
                              <p className="text-white/25 text-xs">saving</p>
                            </div>
                          )}
                        </motion.div>
                      )
                    })}
                  </div>
                </div>

                {/* Route Options & Save/Export */}
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={handleCalculate} disabled={loading}
                    className="py-3 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-white/70 font-semibold text-sm flex items-center justify-center gap-2 transition-all">
                    <RefreshCw size={15} /> Recalculate
                  </button>
                  <button
                    onClick={async () => {
                      // Save as voyage then download report
                      try {
                        toast.success('Export calculation as PDF — use Reports page to download voyage reports')
                      } catch {}
                    }}
                    className="py-3 bg-gradient-to-r from-teal-600/60 to-ocean-600/60 border border-teal-500/30 hover:from-teal-500/60 hover:to-ocean-500/60 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all">
                    <Download size={15} /> Export Report
                  </button>
                </div>

                {/* Import report reminder */}
                <div className="glass-card p-4 rounded-xl border border-teal-500/10">
                  <p className="text-teal-400 text-xs font-semibold mb-1">📋 Import Actual Noon Reports</p>
                  <p className="text-white/40 text-xs">Go to <strong className="text-white/60">Noon Reports</strong> to upload CSV/Excel files or enter daily data to track actual vs. planned performance.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
