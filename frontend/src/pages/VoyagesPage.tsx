import React, { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Plus } from 'lucide-react'
import {
  Badge, Button, DataTable, EmptyState, ErrorState, Field, Input, PageHeader, Panel, Select, Skeleton,
} from '../components/kit'
import type { Column, Tone } from '../components/kit'
import { vesselsAPI, voyagesAPI } from '../services/api'
import { useApi } from '../lib/useApi'
import { longDate, num } from '../lib/format'

export const STATUS_TONE: Record<string, Tone> = { planned: 'neutral', in_progress: 'info', active: 'info', completed: 'ok', cancelled: 'alert' }
const STATUSES = ['all', 'planned', 'in_progress', 'completed', 'cancelled']
const label = (s: string) => s.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())

const EMPTY = { vessel_id: '', voyage_number: '', departure_port: '', arrival_port: '', etd: '', eta: '', cargo_type: '', cargo_quantity: '', charterer: '', charter_party_speed: '', charter_party_consumption: '' }

export default function VoyagesPage() {
  const navigate = useNavigate()
  const voyages = useApi<any[]>(() => voyagesAPI.list().then(r => r.data?.voyages ?? r.data ?? []), [])
  const vessels = useApi<any[]>(() => vesselsAPI.list().then(r => r.data?.vessels ?? r.data ?? []), [])

  const [status, setStatus] = useState('all')
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ ...EMPTY })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const rows = useMemo(() => (voyages.data ?? []).filter(v => status === 'all' || v.status === status), [voyages.data, status])
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  const columns: Column<any>[] = [
    { key: 'voyage_number', header: 'Voyage', render: v => <Link to={`/voyages/${v.id}`} className="font-medium text-fg hover:text-accent" onClick={e => e.stopPropagation()}>{v.voyage_number}</Link> },
    { key: 'vessel_name', header: 'Vessel' },
    { key: 'route', header: 'Route', render: v => <span className="whitespace-nowrap">{v.departure_port} → {v.arrival_port}</span> },
    { key: 'status', header: 'Status', render: v => <Badge tone={STATUS_TONE[v.status] ?? 'neutral'}>{label(v.status)}</Badge> },
    { key: 'etd', header: 'Departure', render: v => longDate(v.atd ?? v.etd) },
    { key: 'report_count', header: 'Reports', numeric: true },
    { key: 'total_distance_nm', header: 'Distance (nm)', numeric: true, render: v => num(v.total_distance_nm, 0) ?? '–' },
    { key: 'avg_speed', header: 'Avg speed (kn)', numeric: true, render: v => num(v.avg_speed, 1) ?? '–' },
  ]

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    const missing = (['vessel_id', 'voyage_number', 'departure_port', 'arrival_port'] as const).filter(k => !form[k].trim())
    if (missing.length) { setFormError('Vessel, voyage number and both ports are required.'); return }
    const num = (s: string) => (s === '' ? undefined : Number(s))
    setSaving(true)
    try {
      await voyagesAPI.create({
        ...form, etd: form.etd || undefined, eta: form.eta || undefined,
        cargo_quantity: num(form.cargo_quantity), charter_party_speed: num(form.charter_party_speed), charter_party_consumption: num(form.charter_party_consumption),
      })
      toast.success(`Voyage ${form.voyage_number} created`)
      setAdding(false); setForm({ ...EMPTY }); voyages.reload()
    } catch (err: any) {
      setFormError(err?.response?.data?.error ?? 'Could not create the voyage.')
    } finally { setSaving(false) }
  }

  return (
    <>
      <PageHeader
        title="Voyages"
        description="Each voyage groups the noon reports and claims for one passage."
        actions={<Button variant="primary" icon={<Plus size={14} />} onClick={() => setAdding(a => !a)}>{adding ? 'Cancel' : 'New voyage'}</Button>}
      />

      {adding && (
        <Panel title="New voyage" className="mb-6">
          <form onSubmit={submit} noValidate className="space-y-4">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Field label="Vessel *">{a11y => <Select {...a11y} value={form.vessel_id} onChange={set('vessel_id')}><option value="">Select…</option>{(vessels.data ?? []).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</Select>}</Field>
              <Field label="Voyage number *">{a11y => <Input {...a11y} value={form.voyage_number} onChange={set('voyage_number')} placeholder="PP-2025-003" />}</Field>
              <Field label="Departure port *">{a11y => <Input {...a11y} value={form.departure_port} onChange={set('departure_port')} />}</Field>
              <Field label="Arrival port *">{a11y => <Input {...a11y} value={form.arrival_port} onChange={set('arrival_port')} />}</Field>
              <Field label="Estimated departure">{a11y => <Input {...a11y} type="datetime-local" value={form.etd} onChange={set('etd')} />}</Field>
              <Field label="Estimated arrival">{a11y => <Input {...a11y} type="datetime-local" value={form.eta} onChange={set('eta')} />}</Field>
              <Field label="Cargo">{a11y => <Input {...a11y} value={form.cargo_type} onChange={set('cargo_type')} />}</Field>
              <Field label="Cargo quantity (MT)">{a11y => <Input {...a11y} type="number" step="1" inputMode="decimal" value={form.cargo_quantity} onChange={set('cargo_quantity')} />}</Field>
              <Field label="Charterer">{a11y => <Input {...a11y} value={form.charterer} onChange={set('charterer')} />}</Field>
              <Field label="Charter speed (kn)" hint="Falls back to the vessel's warranted speed">{a11y => <Input {...a11y} type="number" step="0.1" inputMode="decimal" value={form.charter_party_speed} onChange={set('charter_party_speed')} />}</Field>
              <Field label="Charter burn (MT/day)" hint="Falls back to the vessel's figure">{a11y => <Input {...a11y} type="number" step="0.1" inputMode="decimal" value={form.charter_party_consumption} onChange={set('charter_party_consumption')} />}</Field>
            </div>
            {formError && <p role="alert" className="text-body text-signal-port">{formError}</p>}
            <Button type="submit" variant="primary" loading={saving}>Create voyage</Button>
          </form>
        </Panel>
      )}

      <Panel flush title={`${rows.length} voyage${rows.length === 1 ? '' : 's'}`} actions={
        <Select aria-label="Filter by status" value={status} onChange={e => setStatus(e.target.value)} className="h-8 w-40">
          {STATUSES.map(s => <option key={s} value={s}>{s === 'all' ? 'All statuses' : label(s)}</option>)}
        </Select>
      }>
        {voyages.error ? <ErrorState title="Could not load voyages" onRetry={voyages.reload} /> :
         voyages.loading ? <div className="p-4"><Skeleton className="h-40" /></div> :
         (voyages.data?.length ?? 0) === 0 ? <EmptyState title="No voyages yet" action={<Button variant="primary" onClick={() => setAdding(true)}>Create a voyage</Button>}>Noon reports and claims belong to a voyage.</EmptyState> :
         <DataTable caption="Voyages" columns={columns} rows={rows} rowKey={v => v.id} onRowClick={v => navigate(`/voyages/${v.id}`)} empty="No voyages with this status." />}
      </Panel>
    </>
  )
}
