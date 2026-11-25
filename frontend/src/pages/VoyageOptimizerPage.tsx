import React, { useState } from 'react'
import toast from 'react-hot-toast'
import {
  Badge, Button, DataTable, EmptyState, ErrorState, Field, Input, PageHeader, Panel, Select, Skeleton, Stat,
} from '../components/kit'
import type { Column, Tone } from '../components/kit'
import { optimizationAPI } from '../services/api'
import { useApi } from '../lib/useApi'
import { longDate, num, usd } from '../lib/format'

const VESSEL_TYPES = ['Bulk Carrier', 'VLCC Tanker', 'Suezmax Tanker', 'Aframax Tanker', 'Container (Large)', 'Container (Medium)', 'Container (Feeder)', 'Chemical Tanker', 'LNG Carrier', 'LPG Carrier', 'General Cargo', 'RoRo']
const FUEL_TYPES = ['VLSFO', 'MGO', 'LSMGO', 'LNG']
const CII_TONE: Record<string, Tone> = { A: 'ok', B: 'ok', C: 'warn', D: 'alert', E: 'alert' }

const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)

export default function VoyageOptimizerPage() {
  const ports = useApi<any[]>(() => optimizationAPI.getPorts().then(r => r.data?.ports ?? []), [])
  const [form, setForm] = useState({
    origin_port: '', destination_port: '', vessel_type: 'Bulk Carrier', dwt: '', cargo_weight: '', draft: '',
    target_speed: '', fuel_type: 'VLSFO', fuel_price_usd: '', departure_datetime: toLocalInput(new Date(Date.now() + 3_600_000)),
    use_live_weather: true,
  })
  const [result, setResult] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }))

  const run = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const need = ['origin_port', 'destination_port', 'dwt', 'cargo_weight', 'draft', 'target_speed', 'fuel_price_usd'] as const
    if (need.some(k => form[k] === '')) { setError('Fill in both ports, the vessel size, speed and fuel price.'); return }
    if (form.origin_port === form.destination_port) { setError('Origin and destination must be different.'); return }
    setBusy(true); setResult(null)
    try {
      const res = await optimizationAPI.calculate({
        ...form, dwt: Number(form.dwt), cargo_weight: Number(form.cargo_weight), draft: Number(form.draft),
        target_speed: Number(form.target_speed), fuel_price_usd: Number(form.fuel_price_usd), current_speed_kn: 0,
      })
      setResult(res.data)
    } catch (err: any) {
      const message = err?.response?.data?.error ?? 'The calculation failed.'
      setError(message); toast.error(message)
    } finally { setBusy(false) }
  }

  const c = result?.calculation
  const suggestions: Array<{ title: string; detail: string; saving_usd: number; type: string }> = result?.suggestions ?? []
  const samples: any[] = result?.weather_samples ?? []

  const sampleColumns: Column<any>[] = [
    { key: 'frac', header: 'Along route', numeric: true, render: s => `${num((s.frac ?? 0) * 100, 0)}%` },
    { key: 'wind_speed_kn', header: 'Wind (kn)', numeric: true, render: s => num(s.wind_speed_kn, 1) ?? '–' },
    { key: 'wave_height', header: 'Waves (m)', numeric: true, render: s => num(s.wave_height, 1) ?? '–' },
    { key: 'beaufort', header: 'Beaufort', numeric: true },
    { key: 'current_speed', header: 'Current (kn)', numeric: true, render: s => num(s.current_speed, 1) ?? '–' },
  ]

  return (
    <>
      <PageHeader title="Voyage optimizer" description="Estimate time, fuel, cost and emissions for a passage, and see what a slower speed would save." />

      <Panel title="Passage">
        <form onSubmit={run} noValidate className="space-y-5">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Field label="From *">{a => <Select {...a} value={form.origin_port} onChange={set('origin_port')} disabled={ports.loading}><option value="">Select a port…</option>{(ports.data ?? []).map(p => <option key={p.name}>{p.name}</option>)}</Select>}</Field>
            <Field label="To *">{a => <Select {...a} value={form.destination_port} onChange={set('destination_port')} disabled={ports.loading}><option value="">Select a port…</option>{(ports.data ?? []).map(p => <option key={p.name}>{p.name}</option>)}</Select>}</Field>
            <Field label="Departure">{a => <Input {...a} type="datetime-local" value={form.departure_datetime} onChange={set('departure_datetime')} />}</Field>
            <Field label="Weather along the route">{a => <Select {...a} value={form.use_live_weather ? 'live' : 'none'} onChange={e => setForm(f => ({ ...f, use_live_weather: e.target.value === 'live' }))}><option value="live">Live forecast (Open-Meteo)</option><option value="none">None (calm assumption)</option></Select>}</Field>
            <Field label="Vessel type">{a => <Select {...a} value={form.vessel_type} onChange={set('vessel_type')}>{VESSEL_TYPES.map(t => <option key={t}>{t}</option>)}</Select>}</Field>
            <Field label="Deadweight (DWT) *">{a => <Input {...a} type="number" min="0" inputMode="decimal" value={form.dwt} onChange={set('dwt')} />}</Field>
            <Field label="Cargo (MT) *">{a => <Input {...a} type="number" min="0" inputMode="decimal" value={form.cargo_weight} onChange={set('cargo_weight')} />}</Field>
            <Field label="Draft (m) *">{a => <Input {...a} type="number" min="0" step="0.1" inputMode="decimal" value={form.draft} onChange={set('draft')} />}</Field>
            <Field label="Target speed (kn) *">{a => <Input {...a} type="number" min="1" step="0.1" inputMode="decimal" value={form.target_speed} onChange={set('target_speed')} />}</Field>
            <Field label="Fuel">{a => <Select {...a} value={form.fuel_type} onChange={set('fuel_type')}>{FUEL_TYPES.map(t => <option key={t}>{t}</option>)}</Select>}</Field>
            <Field label="Fuel price (USD/MT) *">{a => <Input {...a} type="number" min="0" inputMode="decimal" value={form.fuel_price_usd} onChange={set('fuel_price_usd')} />}</Field>
          </div>
          {error && <p role="alert" className="text-body text-signal-port">{error}</p>}
          <div className="flex items-center gap-3">
            <Button type="submit" variant="primary" loading={busy}>Calculate</Button>
            <p className="text-label text-fg-subtle">Nothing is pre-filled except the departure time. Use your own vessel and price figures.</p>
          </div>
        </form>
      </Panel>

      {ports.error && <Panel className="mt-6"><ErrorState title="Could not load the port list" onRetry={ports.reload} /></Panel>}
      {busy && <div className="mt-6"><Skeleton className="h-40" /></div>}

      {!busy && !result && !error && (
        <Panel className="mt-6"><EmptyState title="No calculation yet">Choose two ports and your vessel details, then press Calculate.</EmptyState></Panel>
      )}

      {c && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
            <Stat label="Distance" value={num(c.distance_nm, 0)} unit="nm" />
            <Stat label="Passage time" value={num(c.duration_days, 1)} unit="days" />
            <Stat label="Fuel" value={num(c.total_fuel_mt, 0)} unit="MT" />
            <Stat label="Fuel cost" value={usd(c.fuel_cost_usd)} />
            <Stat label="Arrival" value={result.eta ? longDate(result.eta) : null} />
            <Stat label="Speed made good" value={num(c.effective_speed, 1)} unit="kn" delta={c.weather_penalty_pct > 0 ? { value: `−${num(c.weather_penalty_pct, 1)}%`, tone: 'bad', label: 'from weather' } : undefined} />
            <Stat label="CO₂" value={num(c.co2_total_mt, 0)} unit="MT" />
            <div className="bg-surface-1 border border-line rounded-panel p-4"><p className="text-label text-fg-muted">CII rating</p><p className="mt-2"><Badge tone={CII_TONE[c.cii_rating] ?? 'neutral'}>Rating {c.cii_rating}</Badge></p><p className="mt-1.5 font-mono text-label tabular-nums text-fg-subtle">attained {num(c.cii_attained, 2)}</p></div>
          </div>

          <div className="grid lg:grid-cols-3 gap-6 mt-6">
            <Panel title="Slow-steaming comparison">
              <dl className="space-y-3">
                <div className="flex justify-between"><dt className="text-body text-fg-muted">Target</dt><dd className="font-mono tabular-nums">{form.target_speed} kn · {num(c.total_fuel_mt, 0)} MT</dd></div>
                <div className="flex justify-between"><dt className="text-body text-fg-muted">Economical speed</dt><dd className="font-mono tabular-nums">{num(c.eco_speed, 1)} kn · {num(c.eco_fuel_mt, 0)} MT</dd></div>
                <div className="flex justify-between border-t border-line pt-3"><dt className="text-body text-fg">Saves</dt><dd className="font-mono tabular-nums text-signal-starboard">{num(c.eco_savings_fuel, 0)} MT · {usd(c.eco_savings_usd)}</dd></div>
                <div className="flex justify-between"><dt className="text-body text-fg-muted">Costs</dt><dd className="font-mono tabular-nums">{num(c.eco_time_penalty_hrs, 0)} more hours</dd></div>
              </dl>
              <p className="mt-4 text-label text-fg-subtle">Hire cost of the extra time is not included. Compare it with the fuel saving before changing speed.</p>
            </Panel>
            <Panel title="Findings" className="lg:col-span-2">
              {suggestions.length === 0 ? <p className="text-body text-fg-muted">Nothing to flag.</p> : (
                <ul className="space-y-3">
                  {suggestions.map((sg, i) => (
                    <li key={i} className="border-l-2 border-line-strong pl-3">
                      <p className="text-body font-medium text-fg">{sg.title}</p>
                      <p className="text-body text-fg-muted">{sg.detail}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          {samples.length > 0 && (
            <Panel title={`Weather along the route (${samples.length} samples)`} flush className="mt-6">
              <DataTable caption="Forecast weather sampled along the route" columns={sampleColumns} rows={samples} rowKey={s => `${s.frac}-${s.lat}`} />
            </Panel>
          )}
          <p className="mt-4 text-label text-fg-subtle">Estimate from a simplified performance model using the figures above. Not a substitute for a weather-routing service or the vessel's sea trial curves.</p>
        </>
      )}
    </>
  )
}
