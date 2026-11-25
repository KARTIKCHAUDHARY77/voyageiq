import React, { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Bar, Line } from 'react-chartjs-2'
import '../design/registerCharts'
import { baseChartOptions, chartColors, referenceLine } from '../design/chartTheme'
import { Badge, Button, EmptyState, ErrorState, PageHeader, Panel, Skeleton, Stat } from '../components/kit'
import { TrackMap } from '../components/kit/TrackMap'
import { voyagesAPI } from '../services/api'
import { useApi } from '../lib/useApi'
import { longDate, num, shortDate, usd } from '../lib/format'
import { STATUS_TONE } from './VoyagesPage'

export default function VoyageDetailPage() {
  const { id = '' } = useParams()
  const voyage = useApi<any>(() => voyagesAPI.get(id).then(r => r.data), [id])
  const perf = useApi<any>(() => voyagesAPI.getPerformance(id).then(r => r.data), [id])
  const reports = useApi<any[]>(() => voyagesAPI.getNoonReports(id).then(r => r.data?.reports ?? r.data ?? []), [id])
  const claims = useApi<any>(() => voyagesAPI.getClaims(id).then(r => r.data), [id])

  const v = voyage.data
  const s = perf.data?.summary
  const daily: any[] = perf.data?.daily ?? []

  const points = useMemo(() => (reports.data ?? [])
    .filter(r => r.latitude != null && r.longitude != null)
    .sort((a, b) => String(a.report_date).localeCompare(String(b.report_date)))
    .map(r => ({ lat: Number(r.latitude), lon: Number(r.longitude), label: longDate(r.report_date) })), [reports.data])

  const charts = useMemo(() => {
    const c = chartColors()
    const labels = daily.map(d => shortDate(d.date))
    const base = (o?: Parameters<typeof baseChartOptions>[0]) => baseChartOptions(o) as any
    return {
      speed: {
        data: { labels, datasets: [
          { label: 'Speed', data: daily.map(d => d.avg_speed), borderColor: c.accent, backgroundColor: c.accentFill, borderWidth: 2, pointRadius: 2, tension: 0.25, spanGaps: true },
          ...(s?.cp_speed ? [referenceLine('Charter speed', s.cp_speed, labels.length)] : []),
        ] },
        options: base({ unit: 'kn' }),
      },
      fuel: {
        data: { labels, datasets: [
          { label: 'Fuel', data: daily.map(d => d.total_fuel_mt), backgroundColor: c.accent, borderRadius: 2 },
          ...(s?.cp_consumption ? [{ ...referenceLine('Charter burn', s.cp_consumption, labels.length), type: 'line' as const }] : []),
        ] },
        options: base({ unit: 'MT' }),
      },
    }
  }, [daily, s])

  if (voyage.error) return (<><PageHeader title="Voyage" /><Panel><ErrorState title="Could not load this voyage" onRetry={voyage.reload} /></Panel></>)

  const noReports = !perf.loading && !s
  const dSpeed = s?.speed_variance
  const dBurn = s?.consumption_variance_pct

  return (
    <>
      <PageHeader
        title={v ? `Voyage ${v.voyage_number}` : 'Voyage'}
        description={v ? `${v.vessel_name ?? ''} · ${v.departure_port} → ${v.arrival_port}${v.charterer ? ` · ${v.charterer}` : ''}` : undefined}
        actions={v ? <Badge tone={STATUS_TONE[v.status] ?? 'neutral'}>{String(v.status).replace(/_/g, ' ')}</Badge> : undefined}
      />

      {noReports ? (
        <Panel><EmptyState title="No noon reports for this voyage yet" action={<Link to="/noon-reports"><Button variant="primary">Add noon reports</Button></Link>}>Performance, the track and claims are calculated from noon reports.</EmptyState></Panel>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat loading={perf.loading} label="Distance" value={num(s?.total_distance_nm, 0)} unit="nm" />
            <Stat loading={perf.loading} label="Average speed" value={num(s?.avg_speed, 1)} unit="kn"
              delta={dSpeed != null ? { value: `${dSpeed > 0 ? '+' : ''}${dSpeed.toFixed(2)} kn`, tone: dSpeed >= 0 ? 'good' : 'bad', label: `vs ${s.cp_speed} charter` } : undefined} />
            <Stat loading={perf.loading} label="Fuel burned" value={num(s?.total_fuel_mt, 0)} unit="MT"
              delta={dBurn != null ? { value: `${dBurn > 0 ? '+' : ''}${dBurn.toFixed(1)}%`, tone: dBurn <= 0 ? 'good' : 'bad', label: `daily burn vs ${s.cp_consumption} charter` } : undefined} />
            <Stat loading={perf.loading} label="Efficiency" value={num(s?.fuel_efficiency_nm_mt, 2)} unit="nm/MT" />
          </div>

          <div className="grid lg:grid-cols-2 gap-6 mt-6">
            <Panel title="Speed against charter">
              {perf.loading ? <Skeleton className="h-60" /> : <div className="relative w-full min-w-0 h-60"><Line role="img" aria-label="Daily average speed against the charter-party speed" data={charts.speed.data} options={charts.speed.options} /></div>}
            </Panel>
            <Panel title="Daily fuel">
              {perf.loading ? <Skeleton className="h-60" /> : <div className="relative w-full min-w-0 h-60"><Bar role="img" aria-label="Daily fuel burned against the charter-party burn" data={charts.fuel.data as any} options={charts.fuel.options} /></div>}
            </Panel>
          </div>

          <div className="grid lg:grid-cols-3 gap-6 mt-6">
            <Panel title="Track from noon reports" className="lg:col-span-2">
              {reports.loading ? <Skeleton className="h-72" /> : points.length === 0 ? <p className="text-body text-fg-muted">No positions were reported.</p> : (
                <>
                  <TrackMap points={points} label={`Map of reported positions for voyage ${v?.voyage_number ?? ''}`} />
                  <p className="mt-3 text-label text-fg-subtle">Reported positions joined in date order. The line is not a navigated route.</p>
                </>
              )}
            </Panel>
            <Panel title="Claims" actions={<Link to="/claims" className="text-label text-accent hover:text-accent-strong">All claims</Link>}>
              {claims.loading ? <Skeleton className="h-24" /> : (claims.data?.claims?.length ?? 0) === 0 ? (
                <p className="text-body text-fg-muted">No claims for this voyage.</p>
              ) : (
                <>
                  <p className="text-label text-fg-muted">Estimated exposure</p>
                  <p className="font-mono text-[26px] leading-8 tabular-nums text-fg">{usd(claims.data.total_amount_usd)}</p>
                  <ul className="mt-3 divide-y divide-line">
                    {claims.data.claims.map((c: any) => (
                      <li key={c.id} className="py-2.5 flex items-center justify-between gap-3">
                        <span className="text-body text-fg capitalize">{String(c.claim_type).replace(/_/g, ' ')}</span>
                        <Badge tone={c.status === 'open' ? 'warn' : 'neutral'}>{c.status}</Badge>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Panel>
          </div>
        </>
      )}
    </>
  )
}
