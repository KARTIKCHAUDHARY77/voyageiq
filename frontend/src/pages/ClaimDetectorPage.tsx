import React, { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Search } from 'lucide-react'
import {
  Badge, Button, DataTable, EmptyState, ErrorState, Field, Input, PageHeader, Panel, Select, Skeleton, Stat, Tabs,
} from '../components/kit'
import type { Column, Tone } from '../components/kit'
import { claimsAPI, voyagesAPI } from '../services/api'
import { useApi } from '../lib/useApi'
import { longDate, num, usd } from '../lib/format'

interface Claim {
  id: string
  voyage_id: string
  vessel_name: string | null
  voyage_number: string | null
  claim_type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  status: 'open' | 'acknowledged' | 'disputed' | 'resolved' | 'closed'
  description: string | null
  expected_value: number | null
  actual_value: number | null
  variance: number | null
  unit: string | null
  estimated_impact_usd: number | null
  period_start: string | null
  period_end: string | null
  detected_date: string | null
  notes: string | null
  supporting_data: { basis?: string; calculation?: string; reports_used?: number; days_lost?: number; excess_mt?: number } | null
  hire_rate_usd: number | null
  bunker_price_usd: number | null
}

const STATUSES: Claim['status'][] = ['open', 'acknowledged', 'disputed', 'resolved', 'closed']
const SEVERITY_TONE: Record<Claim['severity'], Tone> = { low: 'neutral', medium: 'info', high: 'warn', critical: 'alert' }
const STATUS_TONE: Record<Claim['status'], Tone> = { open: 'warn', acknowledged: 'info', disputed: 'alert', resolved: 'ok', closed: 'neutral' }
const label = (s: string) => s.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())

type Filter = 'all' | Claim['status']

export default function ClaimDetectorPage() {
  const claims = useApi<{ claims: Claim[]; open_exposure_usd: number; total: number }>(() => claimsAPI.list({ per_page: 100 }).then(r => r.data), [])
  const voyages = useApi<any[]>(() => voyagesAPI.list().then(r => r.data?.voyages ?? r.data ?? []), [])

  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [voyageId, setVoyageId] = useState('')
  const [detecting, setDetecting] = useState(false)
  const [detectNotes, setDetectNotes] = useState<string[] | null>(null)

  const all = claims.data?.claims ?? []
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: all.length }
    STATUSES.forEach(s => { c[s] = all.filter(x => x.status === s).length })
    return c
  }, [all])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return all.filter(c =>
      (filter === 'all' || c.status === filter) &&
      (!q || `${c.vessel_name} ${c.voyage_number} ${c.claim_type} ${c.description}`.toLowerCase().includes(q)))
  }, [all, filter, query])

  const selected = all.find(c => c.id === selectedId) ?? null
  const attention = all.filter(c => c.status === 'open' && (c.severity === 'high' || c.severity === 'critical')).length

  const runDetection = async () => {
    if (!voyageId) return
    setDetecting(true)
    setDetectNotes(null)
    try {
      const res = await claimsAPI.detect(voyageId)
      const d = res.data
      setDetectNotes(d.notes ?? [])
      toast.success(d.detected_claims?.length ? `${d.detected_claims.length} finding(s): ${d.new_claims_created} new` : 'No shortfall found for this voyage')
      claims.reload()
    } catch (err: any) {
      toast.error(err?.response?.status === 403 ? 'Your role cannot run detection.' : 'Detection failed. Try again.')
    } finally {
      setDetecting(false)
    }
  }

  const columns: Column<Claim>[] = [
    { key: 'vessel', header: 'Vessel / voyage', render: c => (<div><p className="text-fg font-medium">{c.vessel_name ?? '–'}</p><p className="text-label text-fg-subtle">{c.voyage_number}</p></div>) },
    { key: 'type', header: 'Type', render: c => label(c.claim_type) },
    { key: 'severity', header: 'Severity', render: c => <Badge tone={SEVERITY_TONE[c.severity]}>{label(c.severity)}</Badge> },
    { key: 'status', header: 'Status', render: c => <Badge tone={STATUS_TONE[c.status]}>{label(c.status)}</Badge> },
    { key: 'variance', header: 'Actual vs warranted', numeric: true, render: c => c.actual_value != null && c.expected_value != null ? `${num(c.actual_value, 1)} / ${num(c.expected_value, 1)} ${c.unit ?? ''}` : '–' },
    { key: 'impact', header: 'Est. impact', numeric: true, render: c => usd(c.estimated_impact_usd) ?? '–' },
  ]

  if (claims.error) return (<><PageHeader title="Claims" /><Panel><ErrorState title="Could not load claims" onRetry={claims.reload} /></Panel></>)

  return (
    <>
      <PageHeader title="Claims" description="Speed and consumption shortfalls against the warranted figures, calculated from good-weather noon reports." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat loading={claims.loading} label="Open claims" value={counts.open ?? 0} />
        <Stat loading={claims.loading} label="Open exposure" value={usd(claims.data?.open_exposure_usd ?? null)} unit="estimated" />
        <Stat loading={claims.loading} label="High or critical" value={attention} unit="open" />
        <Stat loading={claims.loading} label="All claims" value={counts.all} />
      </div>

      <Panel title="Check a voyage" className="mt-6">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Voyage" className="w-full sm:w-80">
            {a11y => (
              <Select {...a11y} value={voyageId} onChange={e => setVoyageId(e.target.value)}>
                <option value="">Select a voyage…</option>
                {(voyages.data ?? []).map(v => <option key={v.id} value={v.id}>{v.voyage_number} · {v.vessel_name}</option>)}
              </Select>
            )}
          </Field>
          <Button variant="primary" onClick={runDetection} loading={detecting} disabled={!voyageId}>Run detection</Button>
        </div>
        <p className="mt-3 text-label text-fg-subtle">
          Uses reports at Beaufort 4 or below (at least 3). Dollar figures assume a hire rate and bunker price, shown on each claim.
        </p>
        {detectNotes && detectNotes.length > 0 && (
          <ul className="mt-3 space-y-1" role="status">{detectNotes.map((n, i) => <li key={i} className="text-body text-fg-muted">{n}</li>)}</ul>
        )}
      </Panel>

      <Panel title="Claims" flush className="mt-6" actions={
        <div className="relative w-44 sm:w-60">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle" aria-hidden />
          <Input aria-label="Search claims" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search" className="h-8 pl-8" />
        </div>
      }>
        <div className="px-2">
          <Tabs
            label="Filter by status"
            value={filter}
            onChange={k => setFilter(k as Filter)}
            items={[{ key: 'all', label: `All (${counts.all})` }, ...STATUSES.map(s => ({ key: s, label: `${label(s)} (${counts[s]})` }))]}
          />
        </div>
        {claims.loading ? <div className="p-4"><Skeleton className="h-32" /></div> : all.length === 0 ? (
          <EmptyState title="No claims yet">Run detection on a voyage above. Claims appear here when performance falls short of the warranted figures.</EmptyState>
        ) : (
          <DataTable caption="Claims" columns={columns} rows={visible} rowKey={c => c.id} onRowClick={c => setSelectedId(c.id)} empty="No claims match this filter." />
        )}
      </Panel>

      {selected && <ClaimDetail key={selected.id} claim={selected} onSaved={claims.reload} onClose={() => setSelectedId(null)} />}
    </>
  )
}

function ClaimDetail({ claim, onSaved, onClose }: { claim: Claim; onSaved: () => void; onClose: () => void }) {
  const [status, setStatus] = useState<Claim['status']>(claim.status)
  const [notes, setNotes] = useState(claim.notes ?? '')
  const [saving, setSaving] = useState(false)
  const ref = useRef<HTMLElement>(null)
  useEffect(() => { ref.current?.scrollIntoView({ block: 'nearest' }) }, [])
  const s = claim.supporting_data
  const dirty = status !== claim.status || notes !== (claim.notes ?? '')

  const save = async () => {
    setSaving(true)
    try {
      await claimsAPI.updateStatus(claim.id, status, notes)
      toast.success('Claim updated')
      onSaved()
    } catch (err: any) {
      toast.error(err?.response?.status === 403 ? 'Your role cannot change claims.' : 'Could not save. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Panel
      ref={ref}
      className="mt-6"
      title={`${claim.vessel_name ?? 'Vessel'} · ${claim.voyage_number ?? ''} · ${label(claim.claim_type)}`}
      actions={<Button size="sm" variant="ghost" onClick={onClose}>Close</Button>}
    >
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {claim.description && <p className="text-body text-fg">{claim.description}</p>}
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              ['Warranted', claim.expected_value != null ? `${num(claim.expected_value, 2)} ${claim.unit ?? ''}` : '–'],
              ['Actual', claim.actual_value != null ? `${num(claim.actual_value, 2)} ${claim.unit ?? ''}` : '–'],
              ['Difference', claim.variance != null ? `${claim.variance > 0 ? '+' : ''}${num(claim.variance, 2)} ${claim.unit ?? ''}` : '–'],
              ['Estimated impact', usd(claim.estimated_impact_usd) ?? '–'],
            ].map(([k, v]) => (
              <div key={k}><dt className="text-label text-fg-muted">{k}</dt><dd className="font-mono tabular-nums text-lead text-fg mt-0.5">{v}</dd></div>
            ))}
          </dl>
          <div className="rounded-ctl border border-line p-3 space-y-1.5">
            <p className="text-label font-medium text-fg-muted">How this was calculated</p>
            {s?.basis && <p className="text-body text-fg-muted">{s.basis}</p>}
            {s?.calculation && <p className="text-body text-fg-muted font-mono">{s.calculation}</p>}
            <p className="text-label text-fg-subtle">
              Period {longDate(claim.period_start)} to {longDate(claim.period_end)}
              {claim.hire_rate_usd ? ` · assumed hire $${num(claim.hire_rate_usd, 0)}/day` : ''}
              {claim.bunker_price_usd ? ` · assumed bunker $${num(claim.bunker_price_usd, 0)}/MT` : ''}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <Field label="Status">
            {a11y => <Select {...a11y} value={status} onChange={e => setStatus(e.target.value as Claim['status'])}>{STATUSES.map(x => <option key={x} value={x}>{label(x)}</option>)}</Select>}
          </Field>
          <Field label="Notes">
            {a11y => <textarea {...a11y} value={notes} onChange={e => setNotes(e.target.value)} rows={4}
              className="w-full px-3 py-2 rounded-ctl bg-surface-1 text-body text-fg border border-line-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent" />}
          </Field>
          <Button variant="primary" onClick={save} loading={saving} disabled={!dirty}>Save changes</Button>
        </div>
      </div>
    </Panel>
  )
}
