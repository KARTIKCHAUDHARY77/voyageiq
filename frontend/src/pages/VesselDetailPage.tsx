import React from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Badge, DataTable, EmptyState, ErrorState, PageHeader, Panel, Skeleton, Stat,
} from '../components/kit'
import type { Column } from '../components/kit'
import { TrackMap } from '../components/kit/TrackMap'
import { vesselsAPI } from '../services/api'
import { useApi } from '../lib/useApi'
import { longDate, num } from '../lib/format'
import { healthBadge } from './VesselsPage'

const HEALTH_PARTS: Array<[string, string]> = [
  ['fuel_efficiency', 'Fuel efficiency'],
  ['speed_compliance', 'Speed compliance'],
  ['weather_handling', 'Weather handling'],
  ['operational', 'Report completeness'],
]

function delta(actual: number | null | undefined, warranted: number | null | undefined, unit: string, higherIsBetter: boolean) {
  if (actual == null || warranted == null) return undefined
  const diff = actual - warranted
  const good = higherIsBetter ? diff >= 0 : diff <= 0
  return { value: `${diff > 0 ? '+' : ''}${diff.toFixed(1)} ${unit}`, tone: (good ? 'good' : 'bad') as 'good' | 'bad', label: `vs ${warranted.toFixed(1)} warranted` }
}

export default function VesselDetailPage() {
  const { id = '' } = useParams()
  const vessel = useApi<any>(() => vesselsAPI.get(id).then(r => r.data), [id])
  const positions = useApi<any>(() => vesselsAPI.getPositions(id).then(r => r.data), [id])

  const v = vessel.data
  const perf = v?.performance
  const health = v?.health
  const points = (positions.data?.positions ?? []).map((p: any) => ({ lat: Number(p.lat ?? p.latitude), lon: Number(p.lon ?? p.longitude), label: p.timestamp ? longDate(p.timestamp) : undefined }))

  if (vessel.error) return (<><PageHeader title="Vessel" /><Panel><ErrorState title="Could not load this vessel" onRetry={vessel.reload} /></Panel></>)

  const voyageColumns: Column<any>[] = [
    { key: 'voyage_number', header: 'Voyage', render: r => <Link to={`/voyages/${r.id}`} className="font-medium text-fg hover:text-accent">{r.voyage_number}</Link> },
    { key: 'route', header: 'Route', render: r => `${r.departure_port} → ${r.arrival_port}` },
    { key: 'status', header: 'Status', render: r => <Badge tone={r.status === 'completed' ? 'ok' : r.status === 'planned' ? 'neutral' : 'info'}>{String(r.status).replace(/_/g, ' ')}</Badge> },
    { key: 'etd', header: 'Departure', render: r => longDate(r.etd ?? r.atd) },
  ]

  const specs: Array<[string, string | null]> = v ? [
    ['IMO', v.imo_number], ['Type', v.vessel_type], ['Flag', v.flag], ['Built', v.built_year ? String(v.built_year) : null],
    ['Deadweight', v.deadweight_tonnage ? `${num(v.deadweight_tonnage, 0)} DWT` : null], ['Gross tonnage', v.gross_tonnage ? `${num(v.gross_tonnage, 0)} GT` : null],
    ['Length overall', v.loa ? `${v.loa} m` : null], ['Beam', v.beam ? `${v.beam} m` : null],
    ['Main engine', v.main_engine_type || null], ['Engine power', v.main_engine_power ? `${num(v.main_engine_power, 0)} kW` : null],
    ['Class', v.classification_society || null],
  ] : []

  return (
    <>
      <PageHeader
        title={v?.name ?? 'Vessel'}
        description={v ? `${v.vessel_type ?? ''}${v.flag ? ` · ${v.flag}` : ''} · IMO ${v.imo_number}` : undefined}
        actions={v ? <Badge tone={v.status === 'active' ? 'ok' : 'neutral'}>{v.status}</Badge> : undefined}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat loading={vessel.loading} label="Health score" value={health?.total ?? null} unit="/ 100" />
        <Stat loading={vessel.loading} label="Average speed" value={num(perf?.avg_speed, 1)} unit="kn" delta={delta(perf?.avg_speed, perf?.avg_speed != null && perf?.speed_variance != null ? perf.avg_speed - perf.speed_variance : null, 'kn', true)} />
        <Stat loading={vessel.loading} label="ME consumption" value={num(perf?.avg_consumption, 1)} unit="MT/day" delta={delta(perf?.avg_consumption, perf?.avg_consumption != null && perf?.consumption_variance != null ? perf.avg_consumption - perf.consumption_variance : null, 'MT', false)} />
        <Stat loading={vessel.loading} label="Days on speed" value={num(perf?.compliance_pct, 0)} unit={perf?.report_count ? `% of ${perf.report_count} reports` : undefined} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mt-6">
        <Panel title="Track from noon reports" className="lg:col-span-2" actions={points.length > 1 ? <span className="text-label text-fg-subtle">{points.length} positions</span> : undefined}>
          {positions.loading ? <Skeleton className="h-72" /> : points.length === 0 ? (
            <EmptyState title="No positions yet">The track is drawn from the latitude and longitude in this vessel's noon reports.</EmptyState>
          ) : (
            <>
              <TrackMap points={points} label={`Map of ${v?.name ?? 'vessel'} positions from noon reports`} />
              <p className="mt-3 text-label text-fg-subtle">Reported positions joined in date order. The line is not a navigated route.</p>
            </>
          )}
        </Panel>

        <Panel title="Health">
          {vessel.loading ? <Skeleton className="h-48" /> : health?.total == null ? (
            <p className="text-body text-fg-muted">A health score needs noon reports for this vessel.</p>
          ) : (
            <>
              <div className="flex items-center gap-3">{healthBadge(health.total)}<span className="font-mono text-[26px] tabular-nums text-fg">{health.total}</span></div>
              <ul className="mt-4 space-y-3">
                {HEALTH_PARTS.map(([key, label]) => {
                  const score = health.breakdown?.[key]
                  return (
                    <li key={key}>
                      <div className="flex justify-between text-label"><span className="text-fg-muted">{label}</span><span className="font-mono tabular-nums text-fg">{score != null ? `${num((score / 25) * 100, 0)}%` : '–'}</span></div>
                      <div className="mt-1.5 h-1.5 rounded-full bg-fg/10" aria-hidden><div className="h-1.5 rounded-full bg-accent" style={{ width: `${score != null ? (score / 25) * 100 : 0}%` }} /></div>
                    </li>
                  )
                })}
              </ul>
              {health.recommendations?.length > 0 && (
                <ul className="mt-5 space-y-2 border-t border-line pt-4">
                  {health.recommendations.map((r: string, i: number) => <li key={i} className="text-body text-fg-muted">{r}</li>)}
                </ul>
              )}
            </>
          )}
        </Panel>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mt-6">
        <Panel title="Voyages" flush className="lg:col-span-2">
          <DataTable caption="Voyages for this vessel" columns={voyageColumns} rows={v?.voyages ?? []} rowKey={r => r.id} empty="No voyages recorded for this vessel." />
        </Panel>
        <Panel title="Specifications">
          {vessel.loading ? <Skeleton className="h-40" /> : (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              {specs.map(([k, val]) => (
                <div key={k}><dt className="text-label text-fg-muted">{k}</dt><dd className="text-body text-fg">{val ?? <span className="text-fg-subtle">–</span>}</dd></div>
              ))}
              <div><dt className="text-label text-fg-muted">Warranted speed</dt><dd className="font-mono text-body tabular-nums">{v?.warranted_speed ? `${v.warranted_speed} kn` : <span className="text-fg-subtle">Not set</span>}</dd></div>
              <div><dt className="text-label text-fg-muted">Warranted burn</dt><dd className="font-mono text-body tabular-nums">{v?.warranted_consumption ? `${v.warranted_consumption} MT/day` : <span className="text-fg-subtle">Not set</span>}</dd></div>
            </dl>
          )}
        </Panel>
      </div>
    </>
  )
}
