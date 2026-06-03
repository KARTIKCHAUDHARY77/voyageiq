// VoyageIQ AI — Maritime Intelligence Platform
// Copyright (c) 2024 Kartik Chaudhary. All Rights Reserved.
import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ClipboardList, Plus, Upload, Loader, CheckCircle, Ship, Wind, Fuel,
  Navigation, AlertCircle, FileText, Table, Eye, Trash2, Download
} from 'lucide-react'
import { voyagesAPI, uploadsAPI, reportsAPI } from '../services/api'
import { Voyage } from '../types'
import toast from 'react-hot-toast'

const DIRECTIONS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']

const EMPTY_REPORT = {
  report_date: new Date().toISOString().split('T')[0],
  report_time: '12:00', report_type: 'noon',
  latitude: '', longitude: '',
  speed_over_ground: '', speed_through_water: '', distance_noon_to_noon: '', distance_to_go: '',
  rpm: '', course: '',
  wind_force_bft: '', wind_direction: 'SW', wind_speed_knots: '', wave_height: '', swell_height: '',
  me_lsfo: '', me_mgo: '', ae_lsfo: '', ae_mgo: '', boiler_lsfo: '', boiler_mgo: '',
  rob_lsfo: '', rob_mgo: '',
  cargo_quantity: '', draft_fore: '', draft_aft: '',
}

// ─── CSV Parser (client-side preview) ────────────────────────────────────────
function parseCSVPreview(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.trim().split('\n').filter(l => l.trim())
  if (lines.length < 2) return { headers: [], rows: [] }
  const sep = lines[0].includes('\t') ? '\t' : ','
  const headers = lines[0].split(sep).map(h => h.trim().replace(/"/g,''))
  const rows = lines.slice(1, 6).map(line => {
    const vals = line.split(sep).map(v => v.trim().replace(/"/g,''))
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] || '']))
  })
  return { headers, rows }
}

export default function NoonReportPage() {
  const [voyages, setVoyages]           = useState<Voyage[]>([])
  const [selectedVoyage, setSelected]   = useState<string>('')
  const [form, setForm]                 = useState({ ...EMPTY_REPORT })
  const [saving, setSaving]             = useState(false)
  const [loading, setLoading]           = useState(true)
  const [submitted, setSubmitted]       = useState<string[]>([])
  const [tab, setTab]                   = useState<'manual'|'upload'>('manual')

  // Upload state
  const [uploadFile, setUploadFile]     = useState<File | null>(null)
  const [uploading, setUploading]       = useState(false)
  const [preview, setPreview]           = useState<{ headers: string[]; rows: Record<string,string>[] } | null>(null)
  const [uploadDone, setUploadDone]     = useState<{ records: number; message: string } | null>(null)

  // Report history
  const [noonReports, setNoonReports]   = useState<any[]>([])
  const [loadingReports, setLR]         = useState(false)

  useEffect(() => { fetchVoyages() }, [])
  useEffect(() => { if (selectedVoyage) fetchNoonReports() }, [selectedVoyage])

  const fetchVoyages = async () => {
    setLoading(true)
    try {
      const res = await voyagesAPI.list()
      const list: Voyage[] = res.data?.voyages || res.data || []
      setVoyages(list)
      if (list.length > 0) setSelected(list[0].id)
    } catch { toast.error('Could not load voyages') }
    finally { setLoading(false) }
  }

  const fetchNoonReports = async () => {
    if (!selectedVoyage) return
    setLR(true)
    try {
      const res = await voyagesAPI.getNoonReports(selectedVoyage)
      setNoonReports(res.data?.reports || res.data || [])
    } catch { setNoonReports([]) }
    finally { setLR(false) }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedVoyage) return toast.error('Select a voyage first')
    if (!form.latitude || !form.longitude) return toast.error('Position (lat/lon) is required')
    setSaving(true)
    try {
      const n = (v: string) => v !== '' ? Number(v) : undefined
      await voyagesAPI.addNoonReport(selectedVoyage, {
        ...form,
        report_time: form.report_time + ':00',
        latitude: Number(form.latitude), longitude: Number(form.longitude),
        speed_over_ground: n(form.speed_over_ground), speed_through_water: n(form.speed_through_water),
        distance_noon_to_noon: n(form.distance_noon_to_noon), distance_to_go: n(form.distance_to_go),
        rpm: n(form.rpm), course: n(form.course),
        wind_force_bft: n(form.wind_force_bft), wind_speed_knots: n(form.wind_speed_knots),
        wave_height: n(form.wave_height), swell_height: n(form.swell_height),
        me_lsfo: n(form.me_lsfo), me_mgo: n(form.me_mgo),
        ae_lsfo: n(form.ae_lsfo), ae_mgo: n(form.ae_mgo),
        boiler_lsfo: n(form.boiler_lsfo), boiler_mgo: n(form.boiler_mgo),
        rob_lsfo: n(form.rob_lsfo), rob_mgo: n(form.rob_mgo),
        cargo_quantity: n(form.cargo_quantity), draft_fore: n(form.draft_fore), draft_aft: n(form.draft_aft),
      })
      toast.success(`Noon report for ${form.report_date} saved!`)
      setSubmitted(s => [form.report_date, ...s])
      const next = new Date(form.report_date)
      next.setDate(next.getDate() + 1)
      setForm(f => ({ ...EMPTY_REPORT, report_date: next.toISOString().split('T')[0] }))
      fetchNoonReports()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to save report')
    } finally { setSaving(false) }
  }

  const handleFileSelect = async (file: File) => {
    setUploadFile(file)
    setUploadDone(null)
    setPreview(null)
    if (file.name.endsWith('.csv')) {
      try {
        const text = await file.text()
        setPreview(parseCSVPreview(text))
      } catch {}
    } else {
      setPreview({ headers: ['Excel file selected'], rows: [{ 'Excel file selected': file.name }] })
    }
  }

  const handleUpload = async () => {
    if (!uploadFile) return toast.error('Please select a file')
    if (!selectedVoyage) return toast.error('Select a voyage first')
    setUploading(true)
    const tid = toast.loading('Uploading and parsing file…')
    try {
      const fd = new FormData()
      fd.append('file', uploadFile)
      fd.append('voyage_id', selectedVoyage)
      const voy = voyages.find(v => v.id === selectedVoyage)
      if (voy) fd.append('vessel_id', (voy as any).vessel_id || '')
      const res = await uploadsAPI.uploadReport(fd)
      const uploadId = res.data?.upload_id
      let records = res.data?.parsed_records || 0
      if (uploadId) {
        const cRes = await uploadsAPI.confirmUpload(uploadId)
        records = cRes.data?.saved_records || records
      }
      setUploadDone({ records, message: res.data?.message || 'Import complete' })
      toast.success(`${records} records imported successfully!`, { id: tid })
      setUploadFile(null)
      setPreview(null)
      fetchNoonReports()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Upload failed', { id: tid })
    } finally { setUploading(false) }
  }

  const handleDownloadReport = async (format: 'pdf' | 'excel' | 'csv') => {
    if (!selectedVoyage) return toast.error('Select a voyage first')
    const tid = toast.loading(`Generating ${format.toUpperCase()} report…`)
    try {
      const res = await reportsAPI.generate(selectedVoyage, format)
      const ext = format === 'excel' ? 'xlsx' : format
      const voy = voyages.find(v => v.id === selectedVoyage)
      const blob = new Blob([res.data], {
        type: format === 'pdf' ? 'application/pdf' :
              format === 'excel' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv'
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `VoyageIQ_${voy?.voyage_number || 'report'}.${ext}`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`${format.toUpperCase()} downloaded!`, { id: tid })
    } catch {
      toast.error('Report generation failed — add noon reports first', { id: tid })
    }
  }

  const selectedVoy = voyages.find(v => v.id === selectedVoyage)

  if (loading) return <div className="flex items-center justify-center h-64"><Loader size={28} className="animate-spin text-teal-400" /></div>

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-white font-display flex items-center gap-3">
          <ClipboardList className="text-teal-400" size={28} /> Noon Report Management
        </h1>
        <p className="text-white/40 text-sm mt-1">Enter daily noon reports manually or import CSV/Excel files — then download voyage reports</p>
      </motion.div>

      {/* Voyage Selector + Download */}
      <div className="glass-card p-4 rounded-2xl flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-white/60 text-sm flex-shrink-0">
          <Ship size={15} className="text-teal-400" /> Voyage:
        </div>
        <select value={selectedVoyage} onChange={e => setSelected(e.target.value)} className="maritime-select flex-1 min-w-48">
          <option value="">— Select a voyage —</option>
          {voyages.map(v => (
            <option key={v.id} value={v.id}>{v.voyage_number} — {v.departure_port} → {v.arrival_port}</option>
          ))}
        </select>
        {selectedVoy && (
          <span className="text-teal-400 text-xs px-2 py-1 bg-teal-500/10 rounded-full">
            {(selectedVoy as any).vessel_name || 'Vessel'} · {noonReports.length} reports
          </span>
        )}
        {/* Download buttons */}
        {selectedVoyage && (
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={() => handleDownloadReport('pdf')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/15 border border-red-500/25 text-red-400 text-xs rounded-xl hover:bg-red-500/25 transition-all">
              <Download size={12} /> PDF
            </button>
            <button onClick={() => handleDownloadReport('excel')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/15 border border-green-500/25 text-green-400 text-xs rounded-xl hover:bg-green-500/25 transition-all">
              <Download size={12} /> Excel
            </button>
            <button onClick={() => handleDownloadReport('csv')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/15 border border-blue-500/25 text-blue-400 text-xs rounded-xl hover:bg-blue-500/25 transition-all">
              <Download size={12} /> CSV
            </button>
          </div>
        )}
      </div>

      {voyages.length === 0 && (
        <div className="glass-card p-6 rounded-2xl text-center">
          <AlertCircle size={32} className="mx-auto mb-2 text-yellow-400" />
          <p className="text-white/60">No voyages found. Create a voyage first using the Voyages page.</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left — Form */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tabs */}
          <div className="flex gap-2">
            {(['manual','upload'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab === t
                  ? 'bg-teal-500/20 border border-teal-500/40 text-teal-300'
                  : 'bg-white/5 border border-white/10 text-white/50 hover:text-white'}`}>
                {t === 'manual' ? '📝 Manual Entry' : '📁 Import File'}
              </button>
            ))}
          </div>

          {submitted.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {submitted.map(d => (
                <span key={d} className="flex items-center gap-1 px-2 py-1 bg-green-500/10 border border-green-500/20 text-green-400 text-xs rounded-full">
                  <CheckCircle size={11} /> {d}
                </span>
              ))}
            </div>
          )}

          {tab === 'upload' ? (
            /* ── Upload Tab ── */
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div className="glass-card p-5 rounded-2xl space-y-4">
                <h2 className="text-white font-semibold flex items-center gap-2"><Upload size={16} className="text-teal-400" /> Import Noon Report File</h2>

                <div className="bg-navy-800/40 rounded-xl p-4 space-y-2 text-sm">
                  <p className="text-white/60 font-semibold flex items-center gap-2"><FileText size={13} className="text-teal-400" /> Supported Formats</p>
                  <ul className="text-white/40 text-xs space-y-1 ml-5 list-disc">
                    <li><span className="text-teal-400">CSV</span> — any delimiter (comma, tab, semicolon)</li>
                    <li><span className="text-green-400">Excel</span> (.xlsx, .xls) — first sheet used</li>
                    <li><span className="text-red-400">PDF</span> — noon report PDFs (text-based)</li>
                  </ul>
                  <p className="text-white/30 text-xs mt-2">Required columns (any naming): DATE, LAT, LON, SOG/SPEED, DIST/DISTANCE, RPM, WIND_FORCE, WAVE, LSFO_CONS, MGO_CONS, ROB_LSFO, ROB_MGO</p>
                </div>

                <label className="block cursor-pointer">
                  <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-all
                    ${uploadFile ? 'border-teal-500/50 bg-teal-500/5' : 'border-white/10 hover:border-white/30 hover:bg-white/2'}`}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f) }}>
                    <Upload size={28} className="mx-auto mb-2 text-white/30" />
                    {uploadFile ? (
                      <div>
                        <p className="text-teal-400 font-semibold">{uploadFile.name}</p>
                        <p className="text-white/30 text-xs mt-1">{(uploadFile.size / 1024).toFixed(1)} KB — ready to import</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-white/60">Drop your file here or click to browse</p>
                        <p className="text-white/30 text-xs mt-1">CSV, Excel (.xlsx), or PDF</p>
                      </div>
                    )}
                  </div>
                  <input type="file" accept=".csv,.xlsx,.xls,.pdf" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f) }} />
                </label>

                {/* Preview */}
                {preview && preview.headers.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-white/50 text-xs flex items-center gap-1"><Eye size={11} /> Preview (first 5 rows):</p>
                    <div className="overflow-x-auto rounded-lg border border-white/8">
                      <table className="w-full text-xs">
                        <thead className="bg-white/5">
                          <tr>{preview.headers.map(h => <th key={h} className="px-2 py-1.5 text-left text-white/50 whitespace-nowrap">{h}</th>)}</tr>
                        </thead>
                        <tbody>
                          {preview.rows.map((row, i) => (
                            <tr key={i} className="border-t border-white/5">
                              {preview.headers.map(h => <td key={h} className="px-2 py-1.5 text-white/70 whitespace-nowrap">{row[h]}</td>)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {uploadDone && (
                  <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/20 rounded-xl p-3">
                    <CheckCircle size={18} className="text-green-400 flex-shrink-0" />
                    <div>
                      <p className="text-green-400 font-semibold text-sm">{uploadDone.records} records imported successfully!</p>
                      <p className="text-white/40 text-xs">{uploadDone.message}</p>
                    </div>
                  </div>
                )}

                <button onClick={handleUpload} disabled={!uploadFile || uploading || !selectedVoyage}
                  className="w-full py-3 bg-gradient-to-r from-teal-500 to-ocean-500 rounded-xl text-white font-bold flex items-center justify-center gap-2 disabled:opacity-40 hover:opacity-90 transition-all">
                  {uploading ? <Loader size={16} className="animate-spin" /> : <Upload size={16} />}
                  {uploading ? 'Processing & Importing…' : 'Import Records'}
                </button>
              </div>
            </motion.div>
          ) : (
            /* ── Manual Entry Form ── */
            <motion.form initial={{ opacity: 0 }} animate={{ opacity: 1 }} onSubmit={handleSubmit} className="space-y-4">

              {/* Date & Position */}
              <div className="glass-card p-5 rounded-2xl">
                <h3 className="text-teal-400 text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2"><Navigation size={12} /> Date & Position</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div><label className="text-white/40 text-xs mb-1 block">Date *</label><input name="report_date" type="date" value={form.report_date} onChange={handleChange} required className="maritime-input" /></div>
                  <div><label className="text-white/40 text-xs mb-1 block">Time (UTC)</label><input name="report_time" type="time" value={form.report_time} onChange={handleChange} className="maritime-input" /></div>
                  <div><label className="text-white/40 text-xs mb-1 block">Latitude * (±90)</label><input name="latitude" type="number" step="0.0001" value={form.latitude} onChange={handleChange} required placeholder="12.5678" className="maritime-input" /></div>
                  <div><label className="text-white/40 text-xs mb-1 block">Longitude * (±180)</label><input name="longitude" type="number" step="0.0001" value={form.longitude} onChange={handleChange} required placeholder="55.1234" className="maritime-input" /></div>
                </div>
              </div>

              {/* Navigation */}
              <div className="glass-card p-5 rounded-2xl">
                <h3 className="text-teal-400 text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2"><Navigation size={12} /> Navigation</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { name:'speed_over_ground',      label:'SOG (kn)',         placeholder:'13.5' },
                    { name:'speed_through_water',    label:'STW (kn)',         placeholder:'13.2' },
                    { name:'distance_noon_to_noon',  label:'Distance (nm)',    placeholder:'324'  },
                    { name:'distance_to_go',         label:'Distance to Go (nm)', placeholder:'2450' },
                    { name:'rpm',                    label:'Main Engine RPM',  placeholder:'105'  },
                    { name:'course',                 label:'Course (°T)',      placeholder:'275'  },
                  ].map(f => (
                    <div key={f.name}><label className="text-white/40 text-xs mb-1 block">{f.label}</label>
                      <input name={f.name} type="number" step="0.1" value={(form as any)[f.name]} onChange={handleChange} placeholder={f.placeholder} className="maritime-input" /></div>
                  ))}
                </div>
              </div>

              {/* Weather */}
              <div className="glass-card p-5 rounded-2xl">
                <h3 className="text-teal-400 text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2"><Wind size={12} /> Weather</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div><label className="text-white/40 text-xs mb-1 block">Beaufort (0–12)</label><input name="wind_force_bft" type="number" min="0" max="12" value={form.wind_force_bft} onChange={handleChange} placeholder="4" className="maritime-input" /></div>
                  <div><label className="text-white/40 text-xs mb-1 block">Wind Direction</label><select name="wind_direction" value={form.wind_direction} onChange={handleChange} className="maritime-select">{DIRECTIONS.map(d => <option key={d}>{d}</option>)}</select></div>
                  <div><label className="text-white/40 text-xs mb-1 block">Wind Speed (kn)</label><input name="wind_speed_knots" type="number" step="0.1" value={form.wind_speed_knots} onChange={handleChange} placeholder="18.0" className="maritime-input" /></div>
                  <div><label className="text-white/40 text-xs mb-1 block">Wave Height (m)</label><input name="wave_height" type="number" step="0.1" value={form.wave_height} onChange={handleChange} placeholder="1.5" className="maritime-input" /></div>
                  <div><label className="text-white/40 text-xs mb-1 block">Swell Height (m)</label><input name="swell_height" type="number" step="0.1" value={form.swell_height} onChange={handleChange} placeholder="2.0" className="maritime-input" /></div>
                </div>
              </div>

              {/* Fuel */}
              <div className="glass-card p-5 rounded-2xl">
                <h3 className="text-teal-400 text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2"><Fuel size={12} /> Fuel Consumption (MT)</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { name:'me_lsfo',     label:'ME LSFO',     placeholder:'26.5' },
                    { name:'me_mgo',      label:'ME MGO',      placeholder:'0.0'  },
                    { name:'ae_lsfo',     label:'AE LSFO',     placeholder:'0.0'  },
                    { name:'ae_mgo',      label:'AE MGO',      placeholder:'2.1'  },
                    { name:'boiler_lsfo', label:'Boiler LSFO', placeholder:'0.5'  },
                    { name:'boiler_mgo',  label:'Boiler MGO',  placeholder:'0.0'  },
                  ].map(f => (
                    <div key={f.name}><label className="text-white/40 text-xs mb-1 block">{f.label}</label>
                      <input name={f.name} type="number" step="0.001" value={(form as any)[f.name]} onChange={handleChange} placeholder={f.placeholder} className="maritime-input" /></div>
                  ))}
                </div>
              </div>

              {/* ROB + Drafts */}
              <div className="glass-card p-5 rounded-2xl">
                <h3 className="text-teal-400 text-xs font-bold uppercase tracking-wider mb-3">ROB & Drafts</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div><label className="text-white/40 text-xs mb-1 block">ROB LSFO (MT)</label><input name="rob_lsfo" type="number" step="0.1" value={form.rob_lsfo} onChange={handleChange} placeholder="1850" className="maritime-input" /></div>
                  <div><label className="text-white/40 text-xs mb-1 block">ROB MGO (MT)</label><input name="rob_mgo" type="number" step="0.1" value={form.rob_mgo} onChange={handleChange} placeholder="145" className="maritime-input" /></div>
                  <div><label className="text-white/40 text-xs mb-1 block">Draft Fore (m)</label><input name="draft_fore" type="number" step="0.01" value={form.draft_fore} onChange={handleChange} placeholder="13.20" className="maritime-input" /></div>
                  <div><label className="text-white/40 text-xs mb-1 block">Draft Aft (m)</label><input name="draft_aft" type="number" step="0.01" value={form.draft_aft} onChange={handleChange} placeholder="13.80" className="maritime-input" /></div>
                </div>
              </div>

              <button type="submit" disabled={saving || !selectedVoyage}
                className="w-full py-4 bg-gradient-to-r from-teal-500 to-ocean-500 rounded-xl text-white font-bold text-base flex items-center justify-center gap-3 disabled:opacity-40 hover:opacity-90 transition-all shadow-glow-teal">
                {saving ? <Loader size={20} className="animate-spin" /> : <Plus size={20} />}
                {saving ? 'Saving…' : 'Save Noon Report'}
              </button>
              <p className="text-white/20 text-xs text-center">Date advances by 1 day after each save for faster entry</p>
            </motion.form>
          )}
        </div>

        {/* Right — Report History */}
        <div className="space-y-4">
          <div className="glass-card p-5 rounded-2xl">
            <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
              <Table size={14} className="text-teal-400" /> Noon Reports
              {loadingReports && <Loader size={12} className="animate-spin text-white/30 ml-1" />}
            </h3>
            {noonReports.length === 0 ? (
              <div className="text-center py-6 text-white/30 text-xs">
                <ClipboardList size={28} className="mx-auto mb-2 opacity-30" />
                No reports yet for this voyage
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {noonReports.map((r: any, i: number) => (
                  <div key={r.id || i} className="bg-white/3 border border-white/6 rounded-xl p-3 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white font-semibold">{r.report_date}</span>
                      <span className={`px-1.5 py-0.5 rounded text-xs ${r.wind_force_bft >= 6 ? 'bg-red-500/15 text-red-400' : r.wind_force_bft >= 4 ? 'bg-yellow-500/15 text-yellow-400' : 'bg-green-500/15 text-green-400'}`}>
                        BF {r.wind_force_bft || '?'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-white/40">
                      <span>SOG: <span className="text-white/70">{r.speed_over_ground || '—'} kn</span></span>
                      <span>Dist: <span className="text-white/70">{r.distance_noon_to_noon || '—'} nm</span></span>
                      <span>Fuel: <span className="text-teal-400">{r.total_fuel_consumption || '—'} MT</span></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Download card */}
          <div className="glass-card p-5 rounded-2xl">
            <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
              <Download size={14} className="text-teal-400" /> Download Report
            </h3>
            <p className="text-white/30 text-xs mb-3">Generate a full voyage report from the noon data you've entered</p>
            <div className="space-y-2">
              {(['pdf','excel','csv'] as const).map(fmt => (
                <button key={fmt} onClick={() => handleDownloadReport(fmt)} disabled={!selectedVoyage}
                  className={`w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-30
                    ${fmt === 'pdf'   ? 'bg-red-500/15 border border-red-500/25 text-red-400 hover:bg-red-500/25' :
                      fmt === 'excel' ? 'bg-green-500/15 border border-green-500/25 text-green-400 hover:bg-green-500/25' :
                                        'bg-blue-500/15 border border-blue-500/25 text-blue-400 hover:bg-blue-500/25'}`}>
                  <Download size={13} /> {fmt === 'excel' ? 'Excel (.xlsx)' : fmt === 'pdf' ? 'PDF Report' : 'CSV Export'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
