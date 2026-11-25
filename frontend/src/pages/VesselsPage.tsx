import React, { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Plus, Search } from 'lucide-react'
import {
  Badge, Button, DataTable, EmptyState, ErrorState, Field, Input, PageHeader, Panel, Select, Skeleton,
} from '../components/kit'
import type { Column, Tone } from '../components/kit'
import { vesselsAPI } from '../services/api'
import { useApi } from '../lib/useApi'
import { useAuthStore } from '../store/authStore'
import { num } from '../lib/format'

const VESSEL_TYPES = ['Bulk Carrier', 'Tanker', 'Container', 'General Cargo', 'LNG Carrier', 'LPG Carrier', 'Chemical Tanker', 'VLCC', 'Suezmax', 'Aframax', 'Panamax']
const CAN_EDIT = new Set(['admin', 'manager'])

const SPEC_FIELDS: Array<{ name: string; label: string; unit?: string; step?: string; hint?: string }> = [
  { name: 'built_year', label: 'Year built', step: '1' },
  { name: 'gross_tonnage', label: 'Gross tonnage', unit: 'GT', step: '1' },
  { name: 'deadweight_tonnage', label: 'Deadweight', unit: 'DWT', step: '1' },
  { name: 'loa', label: 'Length overall', unit: 'm', step: '0.1' },
  { name: 'beam', label: 'Beam', unit: 'm', step: '0.1' },
  { name: 'draft_design', label: 'Design draft', unit: 'm', step: '0.1' },
  { name: 'main_engine_power', label: 'Main engine power', unit: 'kW', step: '1' },
  { name: 'design_speed', label: 'Design speed', unit: 'kn', step: '0.1' },
  { name: 'warranted_speed', label: 'Warranted speed', unit: 'kn', step: '0.1', hint: 'Used to judge performance' },
  { name: 'warranted_consumption', label: 'Warranted consumption', unit: 'MT/day', step: '0.1', hint: 'Used to judge performance' },
]

const EMPTY: Record<string, string> = {
  imo_number: '', name: '', vessel_type: 'Bulk Carrier', flag: '', main_engine_type: '', classification_society: '',
  ...Object.fromEntries(SPEC_FIELDS.map(f => [f.name, ''])),
}

export function healthBadge(score: number | null | undefined) {
  if (score == null) return <Badge tone="neutral">No data</Badge>
  const tone: Tone = score >= 85 ? 'ok' : score >= 70 ? 'info' : score >= 50 ? 'warn' : 'alert'
  const label = score >= 85 ? 'Excellent' : score >= 70 ? 'Good' : score >= 50 ? 'Average' : 'Poor'
  return <Badge tone={tone}>{label}</Badge>
}

export default function VesselsPage() {
  const navigate = useNavigate()
  const role = useAuthStore(s => s.user?.role ?? '')
  const vessels = useApi<any[]>(() => vesselsAPI.list().then(r => r.data?.vessels ?? r.data ?? []), [])

  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ ...EMPTY })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (vessels.data ?? []).filter(v => !q || `${v.name} ${v.imo_number} ${v.vessel_type} ${v.flag}`.toLowerCase().includes(q))
  }, [vessels.data, query])

  const columns: Column<any>[] = [
    { key: 'name', header: 'Vessel', render: v => <Link to={`/vessels/${v.id}`} className="font-medium text-fg hover:text-accent" onClick={e => e.stopPropagation()}>{v.name}</Link> },
    { key: 'imo_number', header: 'IMO', render: v => <span className="font-mono text-fg-muted">{v.imo_number}</span> },
    { key: 'vessel_type', header: 'Type' },
    { key: 'flag', header: 'Flag' },
    { key: 'built_year', header: 'Built', numeric: true },
    { key: 'deadweight_tonnage', header: 'DWT', numeric: true, render: v => num(v.deadweight_tonnage, 0) ?? '–' },
    { key: 'warranted_speed', header: 'Warranted (kn)', numeric: true, render: v => num(v.warranted_speed, 1) ?? '–' },
    { key: 'health', header: 'Health', render: v => healthBadge(v.health_score) },
  ]

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (!form.imo_number.trim() || !form.name.trim()) { setFormError('IMO number and name are required.'); return }
    const payload: Record<string, unknown> = { ...form }
    SPEC_FIELDS.forEach(f => { payload[f.name] = form[f.name] === '' ? undefined : Number(form[f.name]) })
    setSaving(true)
    try {
      await vesselsAPI.create(payload)
      toast.success(`${form.name} added`)
      setAdding(false); setForm({ ...EMPTY }); vessels.reload()
    } catch (err: any) {
      const message = err?.response?.status === 403 ? 'Your role cannot add vessels.' : err?.response?.data?.error ?? 'Could not add the vessel.'
      setFormError(message)
    } finally { setSaving(false) }
  }

  const set = (name: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [name]: e.target.value }))

  return (
    <>
      <PageHeader
        title="Vessels"
        description="Registered vessels and how they are performing against their warranted figures."
        actions={CAN_EDIT.has(role) ? <Button variant="primary" icon={<Plus size={14} />} onClick={() => setAdding(a => !a)}>{adding ? 'Cancel' : 'Add vessel'}</Button> : undefined}
      />

      {adding && (
        <Panel title="New vessel" className="mb-6">
          <form onSubmit={submit} noValidate className="space-y-6">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Field label="IMO number *">{a11y => <Input {...a11y} value={form.imo_number} onChange={set('imo_number')} placeholder="9876543" />}</Field>
              <Field label="Name *">{a11y => <Input {...a11y} value={form.name} onChange={set('name')} />}</Field>
              <Field label="Type">{a11y => <Select {...a11y} value={form.vessel_type} onChange={set('vessel_type')}>{VESSEL_TYPES.map(t => <option key={t}>{t}</option>)}</Select>}</Field>
              <Field label="Flag">{a11y => <Input {...a11y} value={form.flag} onChange={set('flag')} />}</Field>
              <Field label="Main engine">{a11y => <Input {...a11y} value={form.main_engine_type} onChange={set('main_engine_type')} />}</Field>
              <Field label="Class society">{a11y => <Input {...a11y} value={form.classification_society} onChange={set('classification_society')} />}</Field>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {SPEC_FIELDS.map(f => (
                <Field key={f.name} label={`${f.label}${f.unit ? ` (${f.unit})` : ''}`} hint={f.hint}>
                  {a11y => <Input {...a11y} type="number" step={f.step} inputMode="decimal" value={form[f.name]} onChange={set(f.name)} />}
                </Field>
              ))}
            </div>
            {formError && <p role="alert" className="text-body text-signal-port">{formError}</p>}
            <div className="flex gap-2"><Button type="submit" variant="primary" loading={saving}>Add vessel</Button><p className="self-center text-label text-fg-subtle">Leave unknown values empty.</p></div>
          </form>
        </Panel>
      )}

      <Panel flush title={`${rows.length} vessel${rows.length === 1 ? '' : 's'}`} actions={
        <div className="relative w-44 sm:w-64">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle" aria-hidden />
          <Input aria-label="Search vessels" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, IMO, type" className="h-8 pl-8" />
        </div>
      }>
        {vessels.error ? <ErrorState title="Could not load vessels" onRetry={vessels.reload} /> :
         vessels.loading ? <div className="p-4"><Skeleton className="h-40" /></div> :
         (vessels.data?.length ?? 0) === 0 ? <EmptyState title="No vessels yet">Add a vessel to start tracking its performance.</EmptyState> :
         <DataTable caption="Vessels" columns={columns} rows={rows} rowKey={v => v.id} onRowClick={v => navigate(`/vessels/${v.id}`)} empty="No vessels match your search." />}
      </Panel>
    </>
  )
}
