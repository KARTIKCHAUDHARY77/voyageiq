// VoyageIQ AI — Maritime Intelligence Platform
// Copyright (c) 2024 Kartik Chaudhary. All Rights Reserved.
import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ClipboardList, Plus, Upload, Loader, CheckCircle, Ship, Wind, Fuel, Navigation, AlertCircle } from 'lucide-react'
import { voyagesAPI, vesselsAPI, uploadsAPI } from '../services/api'
import { Voyage, Vessel } from '../types'
import toast from 'react-hot-toast'

const EMPTY_REPORT = {
  report_date: new Date().toISOString().split('T')[0],
  report_time: '12:00',
  report_type: 'noon',
  latitude: '', longitude: '',
  speed_over_ground: '', speed_through_water: '', distance_noon_to_noon: '', distance_to_go: '',
  rpm: '', course: '',
  wind_force_bft: '', wind_direction: 'N', wind_speed_knots: '', wave_height: '', swell_height: '',
  me_lsfo: '', me_mgo: '', ae_lsfo: '', ae_mgo: '', boiler_lsfo: '', boiler_mgo: '',
  rob_lsfo: '', rob_mgo: '',
  cargo_quantity: '', draft_fore: '', draft_aft: '',
}

const DIRECTIONS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']

export default function NoonReportPage() {
  const [voyages, setVoyages]         = useState<Voyage[]>([])
  const [vessels, setVessels]         = useState<Vessel[]>([])
  const [selectedVoyage, setSelected] = useState<string>('')
  const [form, setForm]               = useState({ ...EMPTY_REPORT })
  const [saving, setSaving]           = useState(false)
  const [loading, setLoading]         = useState(true)
  const [submitted, setSubmitted]     = useState<string[]>([])
  const [tab, setTab]                 = useState<'manual'|'upload'>('manual')
  const [uploadFile, setUploadFile]   = useState<File | null>(null)
  const [uploading, setUploading]     = useState(false)

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [vResp, vesResp] = await Promise.all([voyagesAPI.list(), vesselsAPI.list()])
      const vlist: Voyage[] = vResp.data?.voyages || vResp.data || []
      const veslist: Vessel[] = vesResp.data?.vessels || vesResp.data || []
      setVoyages(vlist)
      setVessels(veslist)
      if (vlist.length > 0) setSelected(vlist[0].id)
    } catch { toast.error('Could not load voyages') }
    finally { setLoading(false) }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedVoyage) return toast.error('Select a voyage first')
    if (!form.latitude || !form.longitude) return toast.error('Position (lat/lon) is required')
    setSaving(true)
    try {
      const payload = {
        ...form,
        report_time: form.report_time + ':00',
        latitude: Number(form.latitude), longitude: Number(form.longitude),
        speed_over_ground: form.speed_over_ground ? Number(form.speed_over_ground) : undefined,
        speed_through_water: form.speed_through_water ? Number(form.speed_through_water) : undefined,
        distance_noon_to_noon: form.distance_noon_to_noon ? Number(form.distance_noon_to_noon) : undefined,
        distance_to_go: form.distance_to_go ? Number(form.distance_to_go) : undefined,
        rpm: form.rpm ? Number(form.rpm) : undefined,
        course: form.course ? Number(form.course) : undefined,
        wind_force_bft: form.wind_force_bft ? Number(form.wind_force_bft) : undefined,
        wind_speed_knots: form.wind_speed_knots ? Number(form.wind_speed_knots) : undefined,
        wave_height: form.wave_height ? Number(form.wave_height) : undefined,
        swell_height: form.swell_height ? Number(form.swell_height) : undefined,
        me_lsfo: form.me_lsfo ? Number(form.me_lsfo) : undefined,
        me_mgo: form.me_mgo ? Number(form.me_mgo) : undefined,
        ae_lsfo: form.ae_lsfo ? Number(form.ae_lsfo) : undefined,
        ae_mgo: form.ae_mgo ? Number(form.ae_mgo) : undefined,
        boiler_lsfo: form.boiler_lsfo ? Number(form.boiler_lsfo) : undefined,
        boiler_mgo: form.boiler_mgo ? Number(form.boiler_mgo) : undefined,
        rob_lsfo: form.rob_lsfo ? Number(form.rob_lsfo) : undefined,
        rob_mgo: form.rob_mgo ? Number(form.rob_mgo) : undefined,
        cargo_quantity: form.cargo_quantity ? Number(form.cargo_quantity) : undefined,
        draft_fore: form.draft_fore ? Number(form.draft_fore) : undefined,
        draft_aft: form.draft_aft ? Number(form.draft_aft) : undefined,
      }
      await voyagesAPI.addNoonReport(selectedVoyage, payload)
      toast.success(`Noon report for ${form.report_date} saved!`)
      setSubmitted(s => [form.report_date, ...s])
      // Advance date by 1 day for next entry
      const next = new Date(form.report_date)
      next.setDate(next.getDate() + 1)
      setForm(f => ({ ...f, report_date: next.toISOString().split('T')[0] }))
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to save report')
    } finally { setSaving(false) }
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
      if (voy) fd.append('vessel_id', voy.vessel_id || '')
      const res = await uploadsAPI.uploadReport(fd)
      const uploadId = res.data?.upload_id
      if (uploadId) {
        await uploadsAPI.confirmUpload(uploadId)
        toast.success(`File parsed & saved — ${res.data?.parsed_records || '?'} records imported!`, { id: tid })
        setUploadFile(null)
      } else {
        toast.success('File uploaded!', { id: tid })
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Upload failed', { id: tid })
    } finally { setUploading(false) }
  }

  const selectedVoy = voyages.find(v => v.id === selectedVoyage)

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader size={28} className="animate-spin text-teal-400" />
    </div>
  )

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-white font-display flex items-center gap-3">
          <ClipboardList className="text-teal-400" size={28} /> Noon Report Entry
        </h1>
        <p className="text-white/40 text-sm mt-1">Enter daily noon reports manually or upload a CSV/Excel file</p>
      </motion.div>

      {/* Voyage Selector */}
      <div className="glass-card p-4 rounded-2xl flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-white/60 text-sm flex-shrink-0">
          <Ship size={15} className="text-teal-400" /> Active Voyage:
        </div>
        <select value={selectedVoyage} onChange={e => setSelected(e.target.value)}
          className="maritime-select flex-1 min-w-48">
          <option value="">— Select a voyage —</option>
          {voyages.map(v => (
            <option key={v.id} value={v.id}>
              {v.voyage_number} — {v.departure_port} → {v.arrival_port}
            </option>
          ))}
        </select>
        {selectedVoy && (
          <span className="text-teal-400 text-xs px-2 py-1 bg-teal-500/10 rounded-full">
            {selectedVoy.vessel_name || 'Unknown vessel'} · CP Speed: {selectedVoy.charter_party_speed || '—'} kn
          </span>
        )}
      </div>

      {voyages.length === 0 && (
        <div className="glass-card p-6 rounded-2xl text-center">
          <AlertCircle size={32} className="mx-auto mb-2 text-yellow-400" />
          <p className="text-white/60">No voyages found. Please create a voyage first.</p>
        </div>
      )}

      {/* Tab */}
      <div className="flex gap-2">
        {(['manual', 'upload'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab === t
              ? 'bg-teal-500/20 border border-teal-500/40 text-teal-300'
              : 'bg-white/5 border border-white/10 text-white/50 hover:text-white'}`}>
            {t === 'manual' ? '📝 Manual Entry' : '📁 Upload File'}
          </button>
        ))}
      </div>

      {/* Submitted badges */}
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
        /* Upload Tab */
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-6 rounded-2xl space-y-4">
          <h2 className="text-white font-semibold flex items-center gap-2"><Upload size={16} className="text-teal-400" /> Upload Noon Report File</h2>
          <p className="text-white/50 text-sm">Supported formats: <span className="text-teal-400">CSV, Excel (.xlsx, .xls)</span></p>
          <p className="text-white/30 text-xs">Columns needed: DATE, LAT, LON, SOG, DISTANCE, RPM, WIND, WAVE, LSFO_CONS, MGO_CONS, ROB_LSFO, ROB_MGO</p>

          <label className="block">
            <div className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
              ${uploadFile ? 'border-teal-500/50 bg-teal-500/5' : 'border-white/10 hover:border-white/30'}`}>
              <Upload size={28} className="mx-auto mb-2 text-white/30" />
              {uploadFile ? (
                <div>
                  <p className="text-teal-400 font-semibold">{uploadFile.name}</p>
                  <p className="text-white/30 text-xs mt-1">{(uploadFile.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <div>
                  <p className="text-white/60">Drop your CSV or Excel file here</p>
                  <p className="text-white/30 text-xs mt-1">or click to browse</p>
                </div>
              )}
            </div>
            <input type="file" accept=".csv,.xlsx,.xls" className="hidden"
              onChange={e => setUploadFile(e.target.files?.[0] || null)} />
          </label>

          <button onClick={handleUpload} disabled={!uploadFile || uploading || !selectedVoyage}
            className="w-full py-3 bg-gradient-to-r from-teal-500 to-ocean-500 rounded-xl text-white font-bold flex items-center justify-center gap-2 disabled:opacity-40 hover:opacity-90 transition-all">
            {uploading ? <Loader size={16} className="animate-spin" /> : <Upload size={16} />}
            {uploading ? 'Processing…' : 'Upload & Import Records'}
          </button>
        </motion.div>
      ) : (
        /* Manual Entry Form */
        <motion.form initial={{ opacity: 0 }} animate={{ opacity: 1 }} onSubmit={handleSubmit} className="space-y-5">

          {/* Date & Position */}
          <div className="glass-card p-5 rounded-2xl">
            <h3 className="text-teal-400 text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">
              <Navigation size={13} /> Date, Time & Position
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-white/50 text-xs mb-1 block">Report Date *</label>
                <input name="report_date" type="date" value={form.report_date} onChange={handleChange} required className="maritime-input" />
              </div>
              <div>
                <label className="text-white/50 text-xs mb-1 block">Report Time</label>
                <input name="report_time" type="time" value={form.report_time} onChange={handleChange} className="maritime-input" />
              </div>
              <div>
                <label className="text-white/50 text-xs mb-1 block">Latitude * (e.g. 12.5678)</label>
                <input name="latitude" type="number" step="0.000001" value={form.latitude} onChange={handleChange}
                  required placeholder="12.5678" className="maritime-input" />
              </div>
              <div>
                <label className="text-white/50 text-xs mb-1 block">Longitude * (e.g. 55.1234)</label>
                <input name="longitude" type="number" step="0.000001" value={form.longitude} onChange={handleChange}
                  required placeholder="55.1234" className="maritime-input" />
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="glass-card p-5 rounded-2xl">
            <h3 className="text-teal-400 text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">
              <Navigation size={13} /> Navigation Data
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { name: 'speed_over_ground', label: 'Speed Over Ground (knots)', placeholder: '13.5' },
                { name: 'speed_through_water', label: 'Speed Thru Water (knots)', placeholder: '13.2' },
                { name: 'distance_noon_to_noon', label: 'Distance (nm)', placeholder: '324' },
                { name: 'distance_to_go', label: 'Distance to Go (nm)', placeholder: '2450' },
                { name: 'rpm', label: 'RPM', placeholder: '105' },
                { name: 'course', label: 'Course (°)', placeholder: '275' },
              ].map(f => (
                <div key={f.name}>
                  <label className="text-white/50 text-xs mb-1 block">{f.label}</label>
                  <input name={f.name} type="number" step="0.1" value={(form as any)[f.name]}
                    onChange={handleChange} placeholder={f.placeholder} className="maritime-input" />
                </div>
              ))}
            </div>
          </div>

          {/* Weather */}
          <div className="glass-card p-5 rounded-2xl">
            <h3 className="text-teal-400 text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">
              <Wind size={13} /> Weather Conditions
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-white/50 text-xs mb-1 block">Wind Force (Beaufort 0-12)</label>
                <input name="wind_force_bft" type="number" min="0" max="12" value={form.wind_force_bft}
                  onChange={handleChange} placeholder="4" className="maritime-input" />
              </div>
              <div>
                <label className="text-white/50 text-xs mb-1 block">Wind Direction</label>
                <select name="wind_direction" value={form.wind_direction} onChange={handleChange} className="maritime-select">
                  {DIRECTIONS.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="text-white/50 text-xs mb-1 block">Wind Speed (knots)</label>
                <input name="wind_speed_knots" type="number" step="0.1" value={form.wind_speed_knots}
                  onChange={handleChange} placeholder="18.0" className="maritime-input" />
              </div>
              <div>
                <label className="text-white/50 text-xs mb-1 block">Wave Height (m)</label>
                <input name="wave_height" type="number" step="0.1" value={form.wave_height}
                  onChange={handleChange} placeholder="1.5" className="maritime-input" />
              </div>
              <div>
                <label className="text-white/50 text-xs mb-1 block">Swell Height (m)</label>
                <input name="swell_height" type="number" step="0.1" value={form.swell_height}
                  onChange={handleChange} placeholder="2.0" className="maritime-input" />
              </div>
            </div>
          </div>

          {/* Fuel Consumption */}
          <div className="glass-card p-5 rounded-2xl">
            <h3 className="text-teal-400 text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">
              <Fuel size={13} /> Fuel Consumption (MT)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { name: 'me_lsfo',     label: 'ME LSFO (MT)',     placeholder: '26.5' },
                { name: 'me_mgo',      label: 'ME MGO (MT)',      placeholder: '0.0'  },
                { name: 'ae_lsfo',     label: 'AE LSFO (MT)',     placeholder: '0.0'  },
                { name: 'ae_mgo',      label: 'AE MGO (MT)',      placeholder: '2.1'  },
                { name: 'boiler_lsfo', label: 'Boiler LSFO (MT)', placeholder: '0.5'  },
                { name: 'boiler_mgo',  label: 'Boiler MGO (MT)',  placeholder: '0.0'  },
              ].map(f => (
                <div key={f.name}>
                  <label className="text-white/50 text-xs mb-1 block">{f.label}</label>
                  <input name={f.name} type="number" step="0.001" value={(form as any)[f.name]}
                    onChange={handleChange} placeholder={f.placeholder} className="maritime-input" />
                </div>
              ))}
            </div>
          </div>

          {/* ROB */}
          <div className="glass-card p-5 rounded-2xl">
            <h3 className="text-teal-400 text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">
              <Fuel size={13} /> Remaining on Board (ROB)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-white/50 text-xs mb-1 block">ROB LSFO (MT)</label>
                <input name="rob_lsfo" type="number" step="0.1" value={form.rob_lsfo}
                  onChange={handleChange} placeholder="1850.0" className="maritime-input" />
              </div>
              <div>
                <label className="text-white/50 text-xs mb-1 block">ROB MGO (MT)</label>
                <input name="rob_mgo" type="number" step="0.1" value={form.rob_mgo}
                  onChange={handleChange} placeholder="145.0" className="maritime-input" />
              </div>
              <div>
                <label className="text-white/50 text-xs mb-1 block">Draft Fore (m)</label>
                <input name="draft_fore" type="number" step="0.01" value={form.draft_fore}
                  onChange={handleChange} placeholder="13.20" className="maritime-input" />
              </div>
              <div>
                <label className="text-white/50 text-xs mb-1 block">Draft Aft (m)</label>
                <input name="draft_aft" type="number" step="0.01" value={form.draft_aft}
                  onChange={handleChange} placeholder="13.80" className="maritime-input" />
              </div>
            </div>
          </div>

          <button type="submit" disabled={saving || !selectedVoyage}
            className="w-full py-4 bg-gradient-to-r from-teal-500 to-ocean-500 rounded-xl text-white font-bold text-base flex items-center justify-center gap-3 disabled:opacity-40 hover:opacity-90 transition-all shadow-glow-teal">
            {saving ? <Loader size={20} className="animate-spin" /> : <Plus size={20} />}
            {saving ? 'Saving Report…' : 'Save Noon Report'}
          </button>
          <p className="text-white/25 text-xs text-center">After saving, date will advance by 1 day for the next entry</p>
        </motion.form>
      )}
    </div>
  )
}
