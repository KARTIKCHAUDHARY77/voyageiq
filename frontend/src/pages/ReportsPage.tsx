import React, { useState } from 'react'
import toast from 'react-hot-toast'
import { Download, File, FileSpreadsheet, FileText } from 'lucide-react'
import { Button, EmptyState, ErrorState, Field, PageHeader, Panel, Select, Skeleton } from '../components/kit'
import { reportsAPI, voyagesAPI } from '../services/api'
import { useApi } from '../lib/useApi'

type Format = 'pdf' | 'excel' | 'csv'

const FORMATS: Array<{ id: Format; label: string; icon: typeof File; desc: string; ext: string }> = [
  { id: 'pdf', label: 'PDF', icon: FileText, desc: 'A formatted report to read or send.', ext: 'pdf' },
  { id: 'excel', label: 'Excel', icon: FileSpreadsheet, desc: 'Workbook with the reports and calculated sheets.', ext: 'xlsx' },
  { id: 'csv', label: 'CSV', icon: File, desc: 'Plain noon-report rows for your own analysis.', ext: 'csv' },
]

export default function ReportsPage() {
  const voyages = useApi<any[]>(() => voyagesAPI.list().then(r => r.data?.voyages ?? r.data ?? []), [])
  const templates = useApi<any[]>(() => reportsAPI.templates().then(r => r.data?.templates ?? []), [])
  const [voyageId, setVoyageId] = useState('')
  const [busy, setBusy] = useState<Format | null>(null)

  const list = voyages.data ?? []
  const active = voyageId || list[0]?.id || ''
  const voyage = list.find(v => v.id === active)
  const summary = (templates.data ?? []).find(t => t.id === 'voyage_summary')

  const download = async (format: Format, ext: string) => {
    setBusy(format)
    try {
      const res = await reportsAPI.generate(active, format)
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `VoyageIQ_${voyage?.vessel_name ?? 'vessel'}_${voyage?.voyage_number}.${ext}`.replace(/\s+/g, '_')
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`${format === 'excel' ? 'Excel' : format.toUpperCase()} downloaded`)
    } catch {
      toast.error('Could not create the report. The voyage needs noon reports first.')
    } finally { setBusy(null) }
  }

  return (
    <>
      <PageHeader title="Reports" description="Download a voyage's results as a document or spreadsheet." />

      {voyages.error ? <Panel><ErrorState title="Could not load voyages" onRetry={voyages.reload} /></Panel> :
       voyages.loading ? <Panel><Skeleton className="h-40" /></Panel> :
       list.length === 0 ? <Panel><EmptyState title="No voyages yet">Reports are created per voyage.</EmptyState></Panel> : (
        <div className="grid lg:grid-cols-3 gap-6">
          <Panel title="Voyage report" className="lg:col-span-2">
            <Field label="Voyage" className="max-w-md">
              {a => (
                <Select {...a} value={active} onChange={e => setVoyageId(e.target.value)}>
                  {list.map(v => <option key={v.id} value={v.id}>{v.voyage_number} · {v.vessel_name} ({v.report_count} reports)</option>)}
                </Select>
              )}
            </Field>
            {voyage && voyage.report_count === 0 && <p role="status" className="mt-3 text-body text-signal-caution">This voyage has no noon reports, so a report cannot be created yet.</p>}

            <div className="grid sm:grid-cols-3 gap-3 mt-5">
              {FORMATS.map(f => (
                <div key={f.id} className="rounded-panel border border-line p-4 flex flex-col">
                  <f.icon size={18} className="text-fg-subtle" aria-hidden />
                  <p className="mt-3 text-body font-medium text-fg">{f.label}</p>
                  <p className="mt-1 text-label text-fg-muted flex-1">{f.desc}</p>
                  <Button className="mt-4" size="sm" icon={<Download size={13} />} loading={busy === f.id} disabled={!voyage || voyage.report_count === 0 || busy !== null} onClick={() => download(f.id, f.ext)}>
                    Download
                  </Button>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="What is included">
            {templates.loading ? <Skeleton className="h-32" /> : summary ? (
              <>
                <p className="text-body text-fg-muted">{summary.description}</p>
                <ul className="mt-3 space-y-1.5">{summary.sections.map((s: string) => <li key={s} className="text-body text-fg-muted before:content-['–'] before:mr-2 before:text-fg-subtle">{s}</li>)}</ul>
                <p className="mt-4 text-label text-fg-subtle">CSV contains the noon-report rows only.</p>
              </>
            ) : <p className="text-body text-fg-muted">Not available.</p>}
          </Panel>
        </div>
      )}
    </>
  )
}
