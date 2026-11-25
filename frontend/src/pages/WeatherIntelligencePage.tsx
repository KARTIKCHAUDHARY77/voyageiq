import React, { useEffect, useMemo, useState } from 'react'
import { Bar } from 'react-chartjs-2'
import '../design/registerCharts'
import { baseChartOptions, chartColors } from '../design/chartTheme'
import {
  Badge, Button, DataTable, EmptyState, ErrorState, Field, Input, PageHeader, Panel, Select, Skeleton, Stat,
} from '../components/kit'
import type { Column, Tone } from '../components/kit'
import { analyticsAPI, vesselsAPI, weatherAPI } from '../services/api'
import { useApi } from '../lib/useApi'
import { num } from '../lib/format'

// Standard Beaufort scale (WMO). Reference values, not measurements.
const BEAUFORT: Array<{ force: number; name: string; wind: string; waves: string }> = [
  { force: 0, name: 'Calm', wind: '< 1 kn', waves: '0 m' },
  { force: 1, name: 'Light air', wind: '1–3 kn', waves: '0.1 m' },
  { force: 2, name: 'Light breeze', wind: '4–6 kn', waves: '0.2–0.3 m' },
  { force: 3, name: 'Gentle breeze', wind: '7–10 kn', waves: '0.6–1 m' },
  { force: 4, name: 'Moderate breeze', wind: '11–16 kn', waves: '1–1.5 m' },
  { force: 5, name: 'Fresh breeze', wind: '17–21 kn', waves: '2–2.5 m' },
  { force: 6, name: 'Strong breeze', wind: '22–27 kn', waves: '3–4 m' },
  { force: 7, name: 'Near gale', wind: '28–33 kn', waves: '4–5.5 m' },
  { force: 8, name: 'Gale', wind: '34–40 kn', waves: '5.5–7.5 m' },
  { force: 9, name: 'Strong gale', wind: '41–47 kn', waves: '7–10 m' },
  { force: 10, name: 'Storm', wind: '48–55 kn', waves: '9–12.5 m' },
  { force: 11, name: 'Violent storm', wind: '56–63 kn', waves: '11.5–16 m' },
  { force: 12, name: 'Hurricane', wind: '≥ 64 kn', waves: '14 m +' },
]

const RISK_TONE: Record<string, Tone> = { LOW: 'ok', MODERATE: 'warn', HIGH: 'alert', SEVERE: 'alert', EXTREME: 'alert' }

interface Scenario { windSpeed: string; windDir: 'head' | 'tail' | 'cross'; wave: string; swell: string; current: string; favourable: boolean; baseSpeed: string; baseFuel: string }
const DEFAULT: Scenario = { windSpeed: '20', windDir: 'head', wave: '2', swell: '1', current: '0', favourable: false, baseSpeed: '14', baseFuel: '28' }

export default function WeatherIntelligencePage() {
  const [s, setS] = useState<Scenario>(DEFAULT)
  const [result, setResult] = useState<any>(null)
  const [modelError, setModelError] = useState(false)

  const stored = useApi<any>(() => analyticsAPI.weatherImpact(undefined, 365).then(r => r.data), [])
  const vessels = useApi<any[]>(() => vesselsAPI.list().then(r => r.data?.vessels ?? r.data ?? []), [])

  const set = (k: keyof Scenario) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setS(v => ({ ...v, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }) as Scenario)

  // Debounced call to the model. Empty or invalid inputs are simply not sent.
  useEffect(() => {
    const n = (x: string) => Number(x)
    const valid = [s.windSpeed, s.wave, s.swell, s.current, s.baseSpeed, s.baseFuel].every(x => x !== '' && Number.isFinite(n(x)) && n(x) >= 0) && n(s.baseSpeed) > 0
    if (!valid) return
    const t = setTimeout(() => {
      weatherAPI.windImpact({
        wind_speed_knots: n(s.windSpeed), wind_direction: s.windDir, wave_height_m: n(s.wave), swell_height_m: n(s.swell),
        current_speed_knots: n(s.current), current_favorable: s.favourable, base_speed: n(s.baseSpeed), base_fuel_mt_day: n(s.baseFuel), distance_nm: 1000,
      }).then(r => { setResult(r.data); setModelError(false) }).catch(() => setModelError(true))
    }, 300)
    return () => clearTimeout(t)
  }, [s])

  const wind = result?.wind
  const attribution = result?.attribution

  const attrRows = useMemo(() => {
    const a = attribution?.attribution
    if (!a) return []
    return [['Normal consumption', a.normal_consumption], ['Wind', a.wind_impact], ['Waves', a.wave_impact], ['Current', a.current_impact], ['Swell', a.swell_impact]]
      .map(([label, v]: any) => ({ label, mt: v.mt_day, pct: v.pct }))
  }, [attribution])

  const attrChart = useMemo(() => {
    const c = chartColors()
    const colors = [c.accent, c.port, c.caution, c.depth, c.muted]
    return {
      data: { labels: attrRows.map(r => r.label), datasets: [{ data: attrRows.map(r => r.mt), backgroundColor: colors, borderRadius: 2 }] },
      options: { ...baseChartOptions({ unit: 'MT/day', legend: false }), indexAxis: 'y' as const } as any,
    }
  }, [attrRows])

  const histogram: number[] = stored.data?.beaufort_histogram ?? []
  const histTotal = histogram.reduce((a, b) => a + b, 0)
  const histChart = useMemo(() => {
    const c = chartColors()
    return {
      data: { labels: histogram.slice(0, 10).map((_, i) => `Bft ${i}`), datasets: [{ label: 'Report days', data: histogram.slice(0, 10), backgroundColor: histogram.slice(0, 10).map((_, i) => (i <= 3 ? c.starboard : i <= 5 ? c.caution : c.port)), borderRadius: 2 }] },
      options: baseChartOptions({ legend: false }) as any,
    }
  }, [histogram])

  const beaufortColumns: Column<(typeof BEAUFORT)[number]>[] = [
    { key: 'force', header: 'Force', numeric: true },
    { key: 'name', header: 'Description' },
    { key: 'wind', header: 'Wind speed' },
    { key: 'waves', header: 'Wave height' },
  ]

  return (
    <>
      <PageHeader title="Weather intelligence" description="Estimate how wind, waves and current change a vessel's speed and fuel burn, and look up conditions at a position." />

      <Panel title="Scenario" className="mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-4">
          <Field label="Wind (kn)">{a => <Input {...a} type="number" min="0" step="1" value={s.windSpeed} onChange={set('windSpeed')} />}</Field>
          <Field label="Wind from">{a => <Select {...a} value={s.windDir} onChange={set('windDir')}><option value="head">Ahead (head)</option><option value="tail">Astern (tail)</option><option value="cross">Abeam (cross)</option></Select>}</Field>
          <Field label="Waves (m)">{a => <Input {...a} type="number" min="0" step="0.1" value={s.wave} onChange={set('wave')} />}</Field>
          <Field label="Swell (m)">{a => <Input {...a} type="number" min="0" step="0.1" value={s.swell} onChange={set('swell')} />}</Field>
          <Field label="Current (kn)">{a => <Input {...a} type="number" min="0" step="0.1" value={s.current} onChange={set('current')} />}</Field>
          <Field label="Current is">{a => <Select {...a} value={s.favourable ? 'fav' : 'adv'} onChange={e => setS(v => ({ ...v, favourable: e.target.value === 'fav' }))}><option value="adv">Adverse</option><option value="fav">Favourable</option></Select>}</Field>
          <Field label="Calm-water speed (kn)">{a => <Input {...a} type="number" min="1" step="0.1" value={s.baseSpeed} onChange={set('baseSpeed')} />}</Field>
          <Field label="Calm-water burn (MT/day)">{a => <Input {...a} type="number" min="0" step="0.1" value={s.baseFuel} onChange={set('baseFuel')} />}</Field>
        </div>
        <p className="mt-3 text-label text-fg-subtle">These figures come from a simple resistance model, not from your noon reports. Use them to compare options, and check against measured results below.</p>
      </Panel>

      {modelError ? <Panel><ErrorState title="Could not run the model" onRetry={() => setS({ ...s })} /></Panel> : !result ? <Skeleton className="h-40" /> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Wind force" value={wind?.beaufort_scale} unit="Beaufort" />
            <Stat label="Speed lost to wind" value={num(wind?.speed_loss_knots, 2)} unit={`kn (${num(wind?.speed_loss_pct, 1)}%)`} />
            <Stat label="Extra fuel from wind" value={num(wind?.fuel_penalty_mt_day, 2)} unit="MT/day" />
            <Stat label="Total weather penalty" value={num(attribution?.weather_excess_pct, 1)} unit="% of calm burn" />
          </div>

          <div className="grid lg:grid-cols-2 gap-6 mt-6">
            <Panel title="Where the fuel goes" actions={wind?.severity ? <Badge tone={RISK_TONE[wind.severity] ?? 'neutral'}>{wind.severity}</Badge> : undefined}>
              <div className="relative w-full min-w-0 h-56"><Bar role="img" aria-label="Bar chart of fuel burned per day by cause" data={attrChart.data} options={attrChart.options} />
              </div>
              <p className="mt-3 text-label text-fg-subtle">Total <span className="font-mono tabular-nums text-fg-muted">{num(attribution?.total_fuel_mt_day, 1)}</span> MT/day against a calm-water <span className="font-mono tabular-nums text-fg-muted">{s.baseFuel}</span>.</p>
            </Panel>
            <Panel title="Notes from the model">
              <ul className="space-y-2.5">
                {[...(wind?.recommendations ?? []), ...(result?.current?.recommendations ?? [])].map((r: string, i: number) => <li key={i} className="text-body text-fg-muted border-l-2 border-line-strong pl-3">{r}</li>)}
              </ul>
              {wind?.eta_delay_hours != null && <p className="mt-4 text-label text-fg-subtle">Over 1,000 nm the wind alone adds about {num(wind.eta_delay_hours, 1)} hours to the passage.</p>}
            </Panel>
          </div>
        </>
      )}

      <div className="grid lg:grid-cols-2 gap-6 mt-6">
        <ConditionsPanel vessels={vessels.data ?? []} />
        <Panel title="Beaufort days in your reports">
          {stored.loading ? <Skeleton className="h-52" /> : histTotal === 0 ? (
            <EmptyState title="No wind data yet">Report days by Beaufort force appear once noon reports include a wind force.</EmptyState>
          ) : (
            <div className="relative w-full min-w-0 h-52"><Bar role="img" aria-label="Bar chart of report days by Beaufort force" data={histChart.data} options={histChart.options} /></div>
          )}
        </Panel>
      </div>

      <Panel title="Beaufort scale reference" flush className="mt-6">
        <DataTable caption="Beaufort scale" columns={beaufortColumns} rows={BEAUFORT} rowKey={r => String(r.force)} />
      </Panel>
    </>
  )
}

function ConditionsPanel({ vessels }: { vessels: any[] }) {
  const [vesselId, setVesselId] = useState('')
  const [lat, setLat] = useState('')
  const [lon, setLon] = useState('')
  const [data, setData] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const pickVessel = async (id: string) => {
    setVesselId(id)
    if (!id) return
    try {
      const res = await vesselsAPI.getPositions(id)
      const last = (res.data?.positions ?? []).slice(-1)[0]
      if (last) { setLat(String(last.lat ?? last.latitude)); setLon(String(last.lon ?? last.longitude)) } else setError('That vessel has no reported positions.')
    } catch { setError('Could not load that vessel’s position.') }
  }

  const fetchNow = async () => {
    setError(''); setData(null)
    const la = Number(lat), lo = Number(lon)
    if (lat === '' || lon === '' || !(la >= -90 && la <= 90) || !(lo >= -180 && lo <= 180)) { setError('Enter a latitude between −90 and 90 and a longitude between −180 and 180.'); return }
    setBusy(true)
    try { setData((await weatherAPI.current(la, lo)).data) } catch { setError('Could not get weather for that position.') } finally { setBusy(false) }
  }

  return (
    <Panel title="Conditions at a position">
      <div className="grid sm:grid-cols-3 gap-3">
        <Field label="Use vessel position" className="sm:col-span-3">{a => <Select {...a} value={vesselId} onChange={e => { setError(''); pickVessel(e.target.value) }}><option value="">Enter coordinates…</option>{vessels.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</Select>}</Field>
        <Field label="Latitude">{a => <Input {...a} type="number" step="any" value={lat} onChange={e => setLat(e.target.value)} />}</Field>
        <Field label="Longitude">{a => <Input {...a} type="number" step="any" value={lon} onChange={e => setLon(e.target.value)} />}</Field>
        <div className="flex items-end"><Button variant="primary" onClick={fetchNow} loading={busy} className="w-full">Get weather</Button></div>
      </div>
      {error && <p role="alert" className="mt-3 text-body text-signal-port">{error}</p>}
      {data && (
        <div className="mt-4 space-y-3" aria-live="polite">
          <div className="flex items-center gap-2"><Badge tone={RISK_TONE[data.risk_level] ?? 'neutral'}>{data.risk_level}</Badge><span className="text-label text-fg-subtle">Open-Meteo, Beaufort {data.beaufort_scale}</span></div>
          <ul className="space-y-1.5">{(data.recommendations ?? []).map((r: string, i: number) => <li key={i} className="text-body text-fg-muted">{r}</li>)}</ul>
        </div>
      )}
    </Panel>
  )
}
