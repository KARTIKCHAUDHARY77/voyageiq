import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bar, Line } from 'react-chartjs-2'
import '../design/registerCharts'
import { baseChartOptions, chartColors, referenceLine } from '../design/chartTheme'
import {
  Button, DataTable, EmptyState, ErrorState, Field, PageHeader, Panel, Select, Skeleton, Stat,
} from '../components/kit'
import type { Column } from '../components/kit'
import { analyticsAPI, vesselsAPI } from '../services/api'
import { useApi } from '../lib/useApi'
import { num, shortDate, usd } from '../lib/format'

const PERIODS = [
  { value: 30, label: 'Last 30 days' },
  { value: 90, label: 'Last 90 days' },
  { value: 180, label: 'Last 180 days' },
]

const BAND_ORDER = ['calm_0_3', 'moderate_4_5', 'rough_6_7', 'severe_8_plus']

interface BandRow {
  key: string
  label: string
  report_count: number
  avg_speed_loss_kn: number | null
  avg_excess_consumption_mt: number | null
}

function ChartBox({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="relative w-full min-w-0 h-60" role="img" aria-label={label}>{children}</div>
}

export default function FuelAnalyticsPage() {
  const navigate = useNavigate()
  const [vesselId, setVesselId] = useState('')
  const [days, setDays] = useState(30)

  const vessels = useApi<any[]>(() => vesselsAPI.list().then(r => r.data?.vessels ?? r.data ?? []), [])

  // Start on a vessel that has reports, so the first view is not an empty chart.
  useEffect(() => {
    if (vesselId || !vessels.data?.length) return
    const withData = vessels.data.find(v => v.health_score != null)
    setVesselId((withData ?? vessels.data[0]).id)
  }, [vessels.data, vesselId])

  const fuel = useApi<any>(() => (vesselId ? analyticsAPI.fuel(vesselId, days).then(r => r.data) : Promise.resolve(null)), [vesselId, days])
  const weather = useApi<any>(() => (vesselId ? analyticsAPI.weatherImpact(vesselId, days).then(r => r.data) : Promise.resolve(null)), [vesselId, days])

  const f = fuel.data
  const daily: any[] = f?.daily_consumption ?? []
  const hasData = daily.length > 0
  const loading = fuel.loading || vessels.loading
  const warranted = f?.warranted
  const warrantedNmPerMt = warranted?.speed && warranted?.consumption ? (warranted.speed * 24) / warranted.consumption : null

  const efficiencyDelta = f?.avg_efficiency != null && warrantedNmPerMt
    ? ((f.avg_efficiency - warrantedNmPerMt) / warrantedNmPerMt) * 100
    : null

  const charts = useMemo(() => {
    const c = chartColors()
    const labels = daily.map(d => shortDate(d.date))
    const base = (opts?: Parameters<typeof baseChartOptions>[0]) => baseChartOptions(opts) as any
    return {
      consumption: {
        data: {
          labels,
          datasets: [
            { label: 'Main engine', data: daily.map(d => d.me), backgroundColor: c.accent, borderRadius: 2, stack: 's' },
            { label: 'Auxiliary', data: daily.map(d => d.ae), backgroundColor: c.depth, borderRadius: 2, stack: 's' },
            { label: 'Boiler', data: daily.map(d => d.boiler), backgroundColor: c.muted, borderRadius: 2, stack: 's' },
          ],
        },
        options: base({ unit: 'MT', stacked: true }),
      },
      efficiency: {
        data: {
          labels,
          datasets: [
            { label: 'Actual', data: daily.map(d => (d.total > 0 && d.distance > 0 ? d.distance / d.total : null)), borderColor: c.accent, backgroundColor: c.accentFill, borderWidth: 2, pointRadius: 2, tension: 0.25, spanGaps: true },
            ...(warrantedNmPerMt ? [referenceLine('Warranted', warrantedNmPerMt, labels.length)] : []),
          ],
        },
        options: base({ unit: 'nm/MT' }),
      },
      rob: {
        data: {
          labels,
          datasets: [
            { label: 'LSFO', data: daily.map(d => d.rob_lsfo), borderColor: c.accent, backgroundColor: c.accentFill, borderWidth: 2, pointRadius: 0, tension: 0.2, spanGaps: true },
            { label: 'MGO', data: daily.map(d => d.rob_mgo), borderColor: c.depth, backgroundColor: c.depthFill, borderWidth: 2, pointRadius: 0, tension: 0.2, spanGaps: true },
          ],
        },
        options: base({ unit: 'MT' }),
      },
    }
  }, [daily, warrantedNmPerMt])

  const bands: BandRow[] = BAND_ORDER
    .map(key => ({ key, ...(weather.data?.weather_bands?.[key] ?? {}) }))
    .filter((r: any) => r.report_count > 0)

  const bandColumns: Column<BandRow>[] = [
    { key: 'label', header: 'Conditions' },
    { key: 'report_count', header: 'Report days', numeric: true },
    { key: 'speed', header: 'Speed vs warranted (kn)', numeric: true, render: r => (r.avg_speed_loss_kn != null ? `${r.avg_speed_loss_kn > 0 ? '−' : '+'}${Math.abs(r.avg_speed_loss_kn).toFixed(2)}` : '–') },
    { key: 'burn', header: 'ME burn vs warranted (MT/day)', numeric: true, render: r => (r.avg_excess_consumption_mt != null ? `${r.avg_excess_consumption_mt > 0 ? '+' : ''}${r.avg_excess_consumption_mt.toFixed(1)}` : '–') },
  ]

  const split = f?.fuel_type_split
  const splitTotal = split ? split.lsfo + split.mgo : 0
  const insights: string[] = [...(f?.insights ?? []), ...(weather.data?.insights ?? [])]
  const vesselName = vessels.data?.find(v => v.id === vesselId)?.name

  return (
    <>
      <PageHeader
        title="Fuel analytics"
        description="Consumption and efficiency from noon reports, measured against the vessel's warranted figures."
      />

      <div className="flex flex-wrap gap-4 mb-6">
        <Field label="Vessel" className="w-full sm:w-64">
          {a11y => (
            <Select {...a11y} value={vesselId} onChange={e => setVesselId(e.target.value)} disabled={!vessels.data?.length}>
              {(vessels.data ?? []).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Period" className="w-full sm:w-48">
          {a11y => (
            <Select {...a11y} value={days} onChange={e => setDays(Number(e.target.value))}>
              {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </Select>
          )}
        </Field>
      </div>

      {fuel.error ? (
        <Panel><ErrorState title="Could not load fuel data" onRetry={fuel.reload} /></Panel>
      ) : !loading && !hasData ? (
        <Panel>
          <EmptyState
            title={`No noon reports for ${vesselName ?? 'this vessel'} in this period`}
            action={<Button variant="primary" onClick={() => navigate('/noon-reports')}>Add noon reports</Button>}
          >
            Pick another vessel or a longer period, or add reports to see consumption here.
          </EmptyState>
        </Panel>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat loading={loading} label="Fuel burned" value={num(f?.total_consumed_mt, 0)} unit="MT" />
            <Stat loading={loading} label="Average per day" value={num(hasData ? f.total_consumed_mt / daily.length : null, 1)} unit="MT/day" />
            <Stat loading={loading} label="Cost" value={usd(f?.total_cost_usd)} unit={f ? `at $${f.bunker_price_per_mt}/MT` : undefined} />
            <Stat
              loading={loading}
              label="Efficiency"
              value={num(f?.avg_efficiency, 2)}
              unit="nm/MT"
              delta={efficiencyDelta != null ? { value: `${efficiencyDelta > 0 ? '+' : ''}${efficiencyDelta.toFixed(1)}%`, tone: efficiencyDelta >= 0 ? 'good' : 'bad', label: `vs ${warrantedNmPerMt!.toFixed(2)} warranted` } : undefined}
            />
          </div>

          <div className="grid lg:grid-cols-2 gap-6 mt-6">
            <Panel title="Daily consumption">
              {loading ? <Skeleton className="h-60" /> : (
                <ChartBox label="Stacked bar chart of daily fuel burned by main engine, auxiliary and boiler">
                  <Bar data={charts.consumption.data} options={charts.consumption.options} />
                </ChartBox>
              )}
            </Panel>
            <Panel title="Efficiency against warranted">
              {loading ? <Skeleton className="h-60" /> : (
                <ChartBox label="Line chart of daily fuel efficiency in nautical miles per tonne against the warranted value">
                  <Line data={charts.efficiency.data} options={charts.efficiency.options} />
                </ChartBox>
              )}
            </Panel>
            <Panel title="Remaining on board">
              {loading ? <Skeleton className="h-60" /> : (
                <ChartBox label="Line chart of remaining on board LSFO and MGO in tonnes">
                  <Line data={charts.rob.data} options={charts.rob.options} />
                </ChartBox>
              )}
            </Panel>
            <Panel title="Fuel type">
              {loading || !split ? <Skeleton className="h-24" /> : splitTotal === 0 ? (
                <p className="text-body text-fg-muted">No fuel-type breakdown was reported.</p>
              ) : (
                <>
                  <div className="flex h-2.5 rounded-full overflow-hidden bg-fg/10" role="img" aria-label={`LSFO ${num(split.lsfo, 0)} tonnes, MGO ${num(split.mgo, 0)} tonnes`}>
                    <div className="bg-accent" style={{ width: `${(split.lsfo / splitTotal) * 100}%` }} />
                    <div className="bg-signal-depth" style={{ width: `${(split.mgo / splitTotal) * 100}%` }} />
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-4">
                    <div><dt className="flex items-center gap-1.5 text-label text-fg-muted"><span className="w-2 h-2 rounded-full bg-accent" aria-hidden />LSFO</dt><dd className="font-mono text-[22px] tabular-nums text-fg">{num(split.lsfo, 0)} <span className="text-label text-fg-subtle">MT</span></dd></div>
                    <div><dt className="flex items-center gap-1.5 text-label text-fg-muted"><span className="w-2 h-2 rounded-full bg-signal-depth" aria-hidden />MGO</dt><dd className="font-mono text-[22px] tabular-nums text-fg">{num(split.mgo, 0)} <span className="text-label text-fg-subtle">MT</span></dd></div>
                  </dl>
                </>
              )}
            </Panel>
          </div>

          <div className="grid gap-6 mt-6">
            {insights.length > 0 && (
              <Panel title="Findings">
                <ul className="grid md:grid-cols-2 gap-x-8 gap-y-3">
                  {insights.map((text, i) => <li key={i} className="text-body text-fg-muted border-l-2 border-line-strong pl-3">{text}</li>)}
                </ul>
              </Panel>
            )}
            <Panel title="Weather and performance" flush>
              {weather.error ? <ErrorState title="Could not load weather data" onRetry={weather.reload} /> : (
                <DataTable caption="Speed and fuel against warranted values by Beaufort band" columns={bandColumns} rows={bands} rowKey={r => r.key} empty="No reports with a recorded wind force." />
              )}
            </Panel>
          </div>
        </>
      )}
    </>
  )
}
