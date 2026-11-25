import React, { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Line } from 'react-chartjs-2'
import { RefreshCw } from 'lucide-react'
import '../design/registerCharts'
import { baseChartOptions, chartColors } from '../design/chartTheme'
import {
  Badge, Button, DataTable, EmptyState, ErrorState, PageHeader, Panel, Skeleton, Stat,
} from '../components/kit'
import type { Column, Tone } from '../components/kit'
import { analyticsAPI, claimsAPI, vesselsAPI } from '../services/api'
import { useApi } from '../lib/useApi'
import { longDate, num, shortDate, usd } from '../lib/format'
import type { DashboardKPIs } from '../types'

interface VesselRow {
  id: string
  name: string
  type: string
  status: string
  reports: number
  health: number | null
  compliance: number | null
}

const HEALTH_LABEL: Array<[number, string, Tone]> = [
  [85, 'Excellent', 'ok'],
  [70, 'Good', 'info'],
  [50, 'Average', 'warn'],
  [0, 'Poor', 'alert'],
]

function healthBadge(score: number | null) {
  if (score === null) return <Badge tone="neutral">No data</Badge>
  const [, label, tone] = HEALTH_LABEL.find(([min]) => score >= min) ?? HEALTH_LABEL[3]
  return <Badge tone={tone}>{label}</Badge>
}

const COMPONENTS: Array<[keyof DashboardKPIs['health_breakdown'], string]> = [
  ['fuel_efficiency', 'Fuel efficiency'],
  ['speed_compliance', 'Speed compliance'],
  ['weather_handling', 'Weather handling'],
  ['operational', 'Report completeness'],
]

export default function DashboardPage() {
  const navigate = useNavigate()

  const kpis = useApi<DashboardKPIs>(() => analyticsAPI.dashboard().then(r => r.data), [])
  const fuel = useApi<any>(() => analyticsAPI.fuel(undefined, 30).then(r => r.data), [])
  const vessels = useApi<any[]>(() => vesselsAPI.list().then(r => r.data?.vessels ?? r.data ?? []), [])
  const claims = useApi<any>(() => claimsAPI.list({ status: 'open', per_page: 5 }).then(r => r.data), [])

  const k = kpis.data
  const hasData = !!k && k.report_count > 0
  const loading = kpis.loading

  const reload = () => { kpis.reload(); fuel.reload(); vessels.reload(); claims.reload() }

  const rows: VesselRow[] = useMemo(() => {
    const metrics = new Map((k?.by_vessel ?? []).map(v => [v.id, v]))
    return (vessels.data ?? []).map(v => ({
      id: v.id, name: v.name, type: v.vessel_type, status: v.status,
      reports: metrics.get(v.id)?.report_count ?? 0,
      health: metrics.get(v.id)?.health ?? null,
      compliance: metrics.get(v.id)?.speed_compliance_pct ?? null,
    }))
  }, [k, vessels.data])

  const columns: Column<VesselRow>[] = [
    { key: 'name', header: 'Vessel', render: r => <Link to={`/vessels/${r.id}`} className="text-fg font-medium hover:text-accent" onClick={e => e.stopPropagation()}>{r.name}</Link> },
    { key: 'type', header: 'Type', render: r => <span className="text-fg-muted">{r.type}</span> },
    { key: 'reports', header: 'Reports', numeric: true, render: r => r.reports || <span className="text-fg-subtle">–</span> },
    { key: 'compliance', header: 'On speed', numeric: true, render: r => r.compliance !== null ? `${num(r.compliance, 0)}%` : <span className="text-fg-subtle">–</span> },
    { key: 'health', header: 'Health', numeric: true, render: r => r.health !== null ? num(r.health, 0) : <span className="text-fg-subtle">–</span> },
    { key: 'grade', header: 'Status', render: r => healthBadge(r.health) },
  ]

  // Fleet burn per day from the stored reports; the series simply ends where the data ends.
  const burn = useMemo(() => {
    const c = chartColors()
    const daily: any[] = fuel.data?.daily_consumption ?? []
    return {
      empty: daily.length === 0,
      data: {
        labels: daily.map(d => shortDate(d.date)),
        datasets: [
          { label: 'Main engine', data: daily.map(d => d.me), borderColor: c.accent, backgroundColor: c.accent, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.2 },
          { label: 'Auxiliary + boiler', data: daily.map(d => d.ae + d.boiler), borderColor: c.depth, backgroundColor: c.depth, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.2 },
        ],
      },
      options: { ...baseChartOptions({ unit: 'MT' }), scales: { x: { ...baseChartOptions().scales!.x, ticks: { ...baseChartOptions().scales!.x!.ticks, maxTicksLimit: 8 } }, y: baseChartOptions().scales!.y } },
    }
  }, [fuel.data])

  const mix = k?.weather_mix
  const exposure = claims.data

  if (kpis.error) {
    return (<><PageHeader title="Fleet overview" /><Panel><ErrorState title="Could not load the fleet overview" onRetry={reload} /></Panel></>)
  }

  return (
    <>
      <PageHeader
        title="Fleet overview"
        description={hasData ? `Noon reports for the 30 days to ${longDate(k!.period_end)}` : loading ? 'Loading…' : 'No noon reports have been entered yet.'}
        actions={<Button size="sm" icon={<RefreshCw size={14} />} onClick={reload}>Refresh</Button>}
      />

      {!loading && !hasData && (
        <Panel className="mb-6">
          <EmptyState title="Nothing to analyse yet" action={<Button variant="primary" onClick={() => navigate('/noon-reports')}>Add noon reports</Button>}>
            Add noon reports by hand or upload a CSV, and distance, fuel and performance figures will appear here.
          </EmptyState>
        </Panel>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat loading={loading} label="Distance" value={num(k?.total_distance_nm, 0)} unit="nm" />
        <Stat loading={loading} label="Average speed" value={num(k?.avg_speed, 1)} unit="kn" />
        <Stat loading={loading} label="Fuel burned" value={num(k?.total_fuel_consumed, 0)} unit="MT" />
        <Stat loading={loading} label="Fuel efficiency" value={num(k?.fuel_efficiency, 2)} unit="nm/MT" />
        <Stat loading={loading} label="Days on speed" value={num(k?.performance_score, 0)} unit="% within 0.5 kn" />
        <Stat loading={loading} label="Rough-weather days" value={num(k?.weather_risk_score, 0)} unit="% at Bft 6+" />
        <Stat loading={loading} label="Idle days" value={num(k?.idle_days, 0)} unit="under 1 kn" />
        <Stat loading={loading} label="Burn above warranted" value={usd(k?.excess_fuel_cost_usd)} unit={k ? `at $${k.assumptions.bunker_price_usd_mt}/MT` : undefined} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mt-6">
        <Panel title="Fleet fuel burned per day" className="lg:col-span-2">
          {fuel.loading ? <Skeleton className="h-64" /> : burn.empty ? (
            <EmptyState title="No consumption data">Fuel figures appear once noon reports include main-engine consumption.</EmptyState>
          ) : (
            <>
              <div className="relative w-full min-w-0 h-64" role="img" aria-label="Line chart of fleet fuel burned per day in metric tonnes">
                <Line data={burn.data} options={burn.options as any} />
              </div>
              <p className="mt-3 text-label text-fg-subtle">Total across the vessels that filed a report each day, so it rises and falls with how many reported.</p>
            </>
          )}
        </Panel>

        <Panel title="Fleet health">
          {loading ? <Skeleton className="h-64" /> : k?.fleet_health_score == null ? (
            <EmptyState title="No score yet">A score needs noon reports for at least one vessel.</EmptyState>
          ) : (
            <>
              <p className="flex items-baseline gap-2">
                <span className="font-mono text-[44px] leading-none font-medium tabular-nums text-fg">{num(k.fleet_health_score, 0)}</span>
                <span className="text-label text-fg-subtle">out of 100</span>
              </p>
              <dl className="mt-5 space-y-3">
                {COMPONENTS.map(([key, label]) => {
                  const v = k.health_breakdown?.[key]
                  return (
                    <div key={key}>
                      <div className="flex justify-between text-label"><dt className="text-fg-muted">{label}</dt><dd className="font-mono tabular-nums text-fg">{v != null ? `${num(v, 0)}%` : '–'}</dd></div>
                      <div className="mt-1.5 h-1.5 rounded-full bg-fg/10" aria-hidden><div className="h-1.5 rounded-full bg-accent" style={{ width: `${v ?? 0}%` }} /></div>
                    </div>
                  )
                })}
              </dl>
            </>
          )}
        </Panel>
      </div>

      <div className="grid gap-6 mt-6">
        <Panel title="Vessels" flush>
          {vessels.error ? <ErrorState title="Could not load vessels" onRetry={vessels.reload} /> : (
            <DataTable
              caption="Vessels with health and speed compliance over the last 30 days"
              columns={columns}
              rows={rows}
              rowKey={r => r.id}
              onRowClick={r => navigate(`/vessels/${r.id}`)}
              empty="No vessels registered."
            />
          )}
        </Panel>

        <div className="grid md:grid-cols-2 gap-6 items-start">
          <Panel title="Open claims" actions={<Link to="/claims" className="text-label text-accent hover:text-accent-strong">View all</Link>}>
            {claims.loading ? <Skeleton className="h-16" /> : claims.error ? <ErrorState title="Could not load claims" onRetry={claims.reload} /> : (exposure?.claims?.length ?? 0) === 0 ? (
              <p className="text-body text-fg-muted">No open claims.</p>
            ) : (
              <>
                <p className="text-label text-fg-muted">Estimated exposure</p>
                <p className="font-mono text-[26px] leading-8 tabular-nums text-fg">{usd(exposure.open_exposure_usd)}</p>
                <ul className="mt-3 divide-y divide-line">
                  {exposure.claims.map((c: any) => (
                    <li key={c.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-body text-fg truncate">{c.vessel_name ?? 'Vessel'} · {c.voyage_number}</p>
                        <p className="text-label text-fg-subtle capitalize">{String(c.claim_type).replace(/_/g, ' ')}</p>
                      </div>
                      <span className="font-mono tabular-nums text-body text-fg">{usd(c.estimated_impact_usd) ?? '–'}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Panel>

          <Panel title="Weather exposure">
            {loading ? <Skeleton className="h-14" /> : !mix ? (
              <p className="text-body text-fg-muted">No reports with a recorded wind force.</p>
            ) : (
              <>
                <div className="flex h-2.5 rounded-full overflow-hidden bg-fg/10" role="img" aria-label={`Report days: ${mix.calm}% calm, ${mix.moderate}% moderate, ${mix.rough}% rough`}>
                  <div className="bg-signal-starboard" style={{ width: `${mix.calm}%` }} />
                  <div className="bg-signal-caution" style={{ width: `${mix.moderate}%` }} />
                  <div className="bg-signal-port" style={{ width: `${mix.rough}%` }} />
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-2 text-label">
                  {[['Beaufort 0–3', mix.calm, 'bg-signal-starboard'], ['Beaufort 4–5', mix.moderate, 'bg-signal-caution'], ['Beaufort 6+', mix.rough, 'bg-signal-port']].map(([label, v, dot]) => (
                    <div key={label as string}>
                      <dt className="flex items-center gap-1.5 text-fg-muted"><span className={`w-2 h-2 rounded-full ${dot}`} aria-hidden />{label}</dt>
                      <dd className="mt-0.5 font-mono tabular-nums text-fg">{num(v as number, 0)}%</dd>
                    </div>
                  ))}
                </dl>
              </>
            )}
          </Panel>
        </div>
      </div>
    </>
  )
}
