import React, { useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Download, Upload } from 'lucide-react'
import {
  Badge, Button, DataTable, EmptyState, ErrorState, Field, Input, PageHeader, Panel, Select, Skeleton, Tabs,
} from '../components/kit'
import type { Column } from '../components/kit'
import { reportsAPI, uploadsAPI, voyagesAPI } from '../services/api'
import { useApi } from '../lib/useApi'
import { longDate, num } from '../lib/format'

type FieldErrors = Record<string, string>

interface FieldDef { name: string; label: string; unit?: string; step?: string; hint?: string; required?: boolean; type?: string }

const GROUPS: Array<{ title: string; fields: FieldDef[] }> = [
  {
    title: 'Date and position',
    fields: [
      { name: 'report_date', label: 'Date', type: 'date', required: true },
      { name: 'report_time', label: 'Time (UTC)', type: 'time' },
      { name: 'latitude', label: 'Latitude', unit: '°', step: 'any', required: true, hint: 'Decimal degrees, south negative' },
      { name: 'longitude', label: 'Longitude', unit: '°', step: 'any', required: true, hint: 'Decimal degrees, west negative' },
    ],
  },
  {
    title: 'Navigation',
    fields: [
      { name: 'speed_over_ground', label: 'Speed over ground', unit: 'kn', step: '0.1' },
      { name: 'speed_through_water', label: 'Speed through water', unit: 'kn', step: '0.1' },
      { name: 'distance_noon_to_noon', label: 'Distance run', unit: 'nm', step: '0.1' },
      { name: 'distance_to_go', label: 'Distance to go', unit: 'nm', step: '0.1' },
      { name: 'rpm', label: 'Engine RPM', step: '0.1' },
      { name: 'course', label: 'Course', unit: '°', step: '1' },
    ],
  },
  {
    title: 'Weather',
    fields: [
      { name: 'wind_force_bft', label: 'Wind force', unit: 'Bft', step: '1' },
      { name: 'wind_direction', label: 'Wind direction', type: 'text', hint: 'e.g. SW' },
      { name: 'wind_speed_knots', label: 'Wind speed', unit: 'kn', step: '0.1' },
      { name: 'wave_height', label: 'Wave height', unit: 'm', step: '0.1' },
      { name: 'swell_height', label: 'Swell height', unit: 'm', step: '0.1' },
    ],
  },
  {
    title: 'Fuel consumed in 24 h',
    fields: [
      { name: 'me_lsfo', label: 'Main engine LSFO', unit: 'MT', step: '0.01' },
      { name: 'me_mgo', label: 'Main engine MGO', unit: 'MT', step: '0.01' },
      { name: 'ae_lsfo', label: 'Auxiliary LSFO', unit: 'MT', step: '0.01' },
      { name: 'ae_mgo', label: 'Auxiliary MGO', unit: 'MT', step: '0.01' },
      { name: 'boiler_lsfo', label: 'Boiler LSFO', unit: 'MT', step: '0.01' },
      { name: 'boiler_mgo', label: 'Boiler MGO', unit: 'MT', step: '0.01' },
    ],
  },
  {
    title: 'Remaining on board and cargo',
    fields: [
      { name: 'rob_lsfo', label: 'ROB LSFO', unit: 'MT', step: '0.1' },
      { name: 'rob_mgo', label: 'ROB MGO', unit: 'MT', step: '0.1' },
      { name: 'cargo_quantity', label: 'Cargo', unit: 'MT', step: '1' },
      { name: 'draft_fore', label: 'Draft fore', unit: 'm', step: '0.01' },
      { name: 'draft_aft', label: 'Draft aft', unit: 'm', step: '0.01' },
    ],
  },
]

const NUMERIC = GROUPS.flatMap(g => g.fields).filter(f => f.step).map(f => f.name)
const today = () => new Date().toISOString().slice(0, 10)
const blank = (date = today()): Record<string, string> => ({
  ...Object.fromEntries(GROUPS.flatMap(g => g.fields).map(f => [f.name, ''])),
  report_date: date,
  report_time: '12:00',
})

const TEMPLATE_HEADERS = GROUPS.flatMap(g => g.fields).map(f => f.name).join(',')

type Tab = 'history' | 'add' | 'import'

export default function NoonReportPage() {
  const voyages = useApi<any[]>(() => voyagesAPI.list().then(r => r.data?.voyages ?? r.data ?? []), [])
  const [voyageId, setVoyageId] = useState('')
  const [tab, setTab] = useState<Tab>('history')

  const list = voyages.data ?? []
  const active = voyageId || list[0]?.id || ''
  const voyage = list.find(v => v.id === active)

  const reports = useApi<any[]>(
    () => (active ? voyagesAPI.getNoonReports(active).then(r => r.data?.reports ?? r.data ?? []) : Promise.resolve([])),
    [active],
  )

  const columns: Column<any>[] = [
    { key: 'report_date', header: 'Date', render: r => longDate(r.report_date) },
    { key: 'speed_over_ground', header: 'Speed (kn)', numeric: true, render: r => num(r.speed_over_ground, 1) ?? '–' },
    { key: 'distance_noon_to_noon', header: 'Distance (nm)', numeric: true, render: r => num(r.distance_noon_to_noon, 0) ?? '–' },
    { key: 'total_fuel_consumption', header: 'Fuel (MT)', numeric: true, render: r => num(r.total_fuel_consumption, 1) ?? '–' },
    { key: 'rob_lsfo', header: 'ROB LSFO (MT)', numeric: true, render: r => num(r.rob_lsfo, 0) ?? '–' },
    { key: 'wind_force_bft', header: 'Wind', render: r => (r.wind_force_bft == null ? <span className="text-fg-subtle">–</span> : <Badge tone={r.wind_force_bft >= 6 ? 'warn' : 'ok'}>Bft {r.wind_force_bft}</Badge>) },
  ]

  const download = async (format: 'pdf' | 'excel' | 'csv') => {
    const id = toast.loading(`Preparing ${format.toUpperCase()}…`)
    try {
      const res = await reportsAPI.generate(active, format)
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `VoyageIQ_${voyage?.voyage_number ?? 'report'}.${format === 'excel' ? 'xlsx' : format}`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Downloaded', { id })
    } catch {
      toast.error('Could not create the report. Does the voyage have noon reports?', { id })
    }
  }

  return (
    <>
      <PageHeader title="Noon reports" description="Enter a day's report by hand or import a spreadsheet. Everything else in VoyageIQ is calculated from these." />

      <Field label="Voyage" className="w-full sm:w-96 mb-6">
        {a11y => (
          <Select {...a11y} value={active} onChange={e => setVoyageId(e.target.value)} disabled={list.length === 0}>
            {list.map(v => <option key={v.id} value={v.id}>{v.voyage_number} · {v.vessel_name} ({v.report_count} reports)</option>)}
          </Select>
        )}
      </Field>

      {voyages.error ? (
        <Panel><ErrorState title="Could not load voyages" onRetry={voyages.reload} /></Panel>
      ) : voyages.loading ? (
        <Panel><Skeleton className="h-40" /></Panel>
      ) : list.length === 0 ? (
        <Panel><EmptyState title="No voyages yet">Create a voyage first. Noon reports belong to a voyage.</EmptyState></Panel>
      ) : (
        <Panel flush>
          <div className="px-2">
            <Tabs
              label="Noon report actions"
              value={tab}
              onChange={k => setTab(k as Tab)}
              items={[{ key: 'history', label: `Reports${reports.data ? ` (${reports.data.length})` : ''}` }, { key: 'add', label: 'Add a report' }, { key: 'import', label: 'Import a file' }]}
            />
          </div>

          {tab === 'history' && (
            reports.error ? <ErrorState title="Could not load reports" onRetry={reports.reload} /> :
            reports.loading ? <div className="p-4"><Skeleton className="h-40" /></div> :
            (reports.data?.length ?? 0) === 0 ? (
              <EmptyState title="No reports for this voyage yet" action={<Button variant="primary" onClick={() => setTab('add')}>Add the first report</Button>}>
                You can also import a CSV or Excel file.
              </EmptyState>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-line">
                  <p className="text-label text-fg-muted">Export this voyage</p>
                  <div className="flex gap-2">
                    {(['pdf', 'excel', 'csv'] as const).map(f => <Button key={f} size="sm" icon={<Download size={13} />} onClick={() => download(f)}>{f === 'excel' ? 'Excel' : f.toUpperCase()}</Button>)}
                  </div>
                </div>
                <DataTable caption="Noon reports for the selected voyage" columns={columns} rows={reports.data ?? []} rowKey={r => r.id} />
              </>
            )
          )}

          {tab === 'add' && <AddReport voyageId={active} onSaved={() => { reports.reload(); voyages.reload() }} />}
          {tab === 'import' && <ImportFile voyage={voyage} onDone={() => { reports.reload(); voyages.reload(); setTab('history') }} />}
        </Panel>
      )}
    </>
  )
}

// ─── Manual entry ───────────────────────────────────────────────────────────────

function AddReport({ voyageId, onSaved }: { voyageId: string; onSaved: () => void }) {
  const [form, setForm] = useState(blank())
  const [errors, setErrors] = useState<FieldErrors>({})
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    const payload: Record<string, unknown> = { ...form, report_time: form.report_time ? `${form.report_time}:00` : undefined }
    NUMERIC.forEach(k => { payload[k] = form[k] === '' ? undefined : Number(form[k]) })
    setSaving(true)
    try {
      await voyagesAPI.addNoonReport(voyageId, payload)
      toast.success(`Report for ${longDate(form.report_date)} saved`)
      // Ready for the next day: keep nothing but the following date.
      const next = new Date(`${form.report_date}T00:00:00`)
      next.setDate(next.getDate() + 1)
      setForm(blank(next.toISOString().slice(0, 10)))
      onSaved()
    } catch (err: any) {
      const body = err?.response?.data
      if (body?.fields) { setErrors(body.fields); toast.error(body.error ?? 'Please fix the highlighted fields') }
      else toast.error(body?.error ?? 'Could not save the report')
    } finally { setSaving(false) }
  }

  return (
    <form onSubmit={submit} noValidate className="p-4 space-y-8">
      {GROUPS.map(group => (
        <fieldset key={group.title}>
          <legend className="text-body font-semibold text-fg mb-3">{group.title}</legend>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            {group.fields.map(f => (
              <Field key={f.name} label={`${f.label}${f.unit ? ` (${f.unit})` : ''}${f.required ? ' *' : ''}`} hint={f.hint} error={errors[f.name]}>
                {a11y => (
                  <Input
                    {...a11y}
                    name={f.name}
                    type={f.type ?? 'number'}
                    step={f.step}
                    inputMode={f.type ? undefined : 'decimal'}
                    value={form[f.name]}
                    onChange={e => setForm(s => ({ ...s, [f.name]: e.target.value }))}
                  />
                )}
              </Field>
            ))}
          </div>
        </fieldset>
      ))}
      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" loading={saving}>Save report</Button>
        <p className="text-label text-fg-subtle">* required. Leave a field empty if it was not reported; nothing is filled in for you.</p>
      </div>
    </form>
  )
}

// ─── Import ───────────────────────────────────────────────────────────────────────

interface ParsedUpload { upload_id: string; records_parsed: number; preview: Record<string, unknown>[]; parsed_fields: string[]; errors: string[] }

function ImportFile({ voyage, onDone }: { voyage: any; onDone: () => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [parsed, setParsed] = useState<ParsedUpload | null>(null)
  const [busy, setBusy] = useState<'parse' | 'confirm' | null>(null)
  const [result, setResult] = useState<{ saved: number; skipped: number; errors: string[] } | null>(null)
  const [dragging, setDragging] = useState(false)

  const pick = (f: File | undefined) => { if (f) { setFile(f); setParsed(null); setResult(null) } }

  const parse = async () => {
    if (!file || !voyage) return
    setBusy('parse')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('voyage_id', voyage.id)
      fd.append('vessel_id', voyage.vessel_id)
      const res = await uploadsAPI.uploadReport(fd)
      setParsed(res.data)
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Could not read that file')
    } finally { setBusy(null) }
  }

  const confirm = async () => {
    if (!parsed) return
    setBusy('confirm')
    try {
      const res = await uploadsAPI.confirmUpload(parsed.upload_id)
      setResult({ saved: res.data.saved_records, skipped: res.data.skipped_records, errors: res.data.errors ?? [] })
      setParsed(null); setFile(null)
      toast.success(`${res.data.saved_records} report(s) imported`)
      if (res.data.saved_records > 0) onDone()
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Import failed')
    } finally { setBusy(null) }
  }

  const template = () => {
    const url = URL.createObjectURL(new Blob([`${TEMPLATE_HEADERS}\n`], { type: 'text/csv' }))
    const a = document.createElement('a'); a.href = url; a.download = 'noon-report-template.csv'; a.click(); URL.revokeObjectURL(url)
  }

  const previewColumns: Column<Record<string, unknown>>[] = useMemo(
    () => (parsed?.parsed_fields ?? []).slice(0, 8).map(k => ({ key: k, header: k.replace(/_/g, ' '), render: (r: Record<string, unknown>) => String(r[k] ?? '–') })),
    [parsed],
  )

  return (
    <div className="p-4 space-y-5">
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files?.[0]) }}
        className={`rounded-panel border border-dashed px-6 py-8 text-center transition-colors duration-[150ms] ${dragging ? 'border-accent bg-accent/5' : 'border-line-strong'}`}
      >
        <Upload size={20} className="mx-auto text-fg-subtle mb-3" aria-hidden />
        <p className="text-body text-fg">{file ? file.name : 'Drop a CSV, Excel or PDF file here'}</p>
        <p className="text-label text-fg-subtle mt-1">Up to 10 MB. Each row needs a date and a position.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button onClick={() => input.current?.click()}>Choose file</Button>
          <Button variant="ghost" onClick={template}>Download CSV template</Button>
        </div>
        <input ref={input} type="file" accept=".csv,.xlsx,.xls,.pdf" className="sr-only" aria-label="Noon report file" onChange={e => pick(e.target.files?.[0])} />
      </div>

      {file && !parsed && <Button variant="primary" onClick={parse} loading={busy === 'parse'}>Read file</Button>}

      {parsed && (
        <div className="space-y-4">
          <p className="text-body text-fg">
            Found <span className="font-mono tabular-nums">{parsed.records_parsed}</span> row(s). Check the first few, then confirm to save them to <span className="text-fg font-medium">{voyage?.voyage_number}</span>.
          </p>
          {parsed.errors.length > 0 && <ul className="space-y-1" role="status">{parsed.errors.slice(0, 5).map((e, i) => <li key={i} className="text-label text-signal-caution">{e}</li>)}</ul>}
          <div className="border border-line rounded-panel overflow-hidden">
            <DataTable caption="Preview of the first rows found in the file" columns={previewColumns} rows={parsed.preview} rowKey={r => JSON.stringify(r)} empty="No rows could be read." />
          </div>
          <div className="flex gap-2">
            <Button variant="primary" onClick={confirm} loading={busy === 'confirm'} disabled={parsed.records_parsed === 0}>Confirm import</Button>
            <Button variant="ghost" onClick={() => { setParsed(null); setFile(null) }}>Cancel</Button>
          </div>
        </div>
      )}

      {result && (
        <div role="status" className="rounded-panel border border-line p-4 space-y-2">
          <p className="text-body text-fg"><span className="font-mono tabular-nums">{result.saved}</span> saved, <span className="font-mono tabular-nums">{result.skipped}</span> skipped.</p>
          {result.errors.slice(0, 10).map((e, i) => <p key={i} className="text-label text-fg-muted">{e}</p>)}
        </div>
      )}
    </div>
  )
}
