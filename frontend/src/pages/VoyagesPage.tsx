// VoyageIQ AI — Maritime Intelligence Platform
// Copyright (c) 2024 Kartik Chaudhary. All Rights Reserved.
import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Navigation, Plus, X, Search, Ship, Calendar, MapPin, Loader, ChevronRight, Package } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { voyagesAPI, vesselsAPI } from '../services/api'
import { Voyage, Vessel } from '../types'
import toast from 'react-hot-toast'

const PORTS = ['Singapore','Rotterdam','Shanghai','Hong Kong','Busan','Dubai','Houston','New York','Santos','Cape Town',
  'Mumbai','Colombo','Port Klang','Piraeus','Antwerp','Hamburg','Los Angeles','Vancouver','Tokyo','Sydney',
  'Ras Tanura','Fujairah','Jeddah','Aden','Colombo','Chittagong','Karachi','Guangzhou','Tianjin','Qingdao']
const CARGO_TYPES = ['Iron Ore','Coal','Grain','Crude Oil','Refined Products','Chemicals','LNG','LPG','Containers (TEU)','General Cargo','Scrap Metal','Fertilizer','Cement','Bauxite']

const EMPTY_FORM = {
  vessel_id: '', voyage_number: '', status: 'in_progress',
  departure_port: 'Singapore', arrival_port: 'Rotterdam',
  etd: '', eta: '',
  cargo_type: 'Iron Ore', cargo_quantity: '', cargo_unit: 'MT',
  charterer: '', charter_party_speed: '', charter_party_consumption: '',
}

const STATUS_COLORS: Record<string, string> = {
  in_progress: 'bg-teal-500/15 text-teal-400',
  completed:   'bg-green-500/15 text-green-400',
  planned:     'bg-blue-500/15 text-blue-400',
  cancelled:   'bg-red-500/15 text-red-400',
}

export default function VoyagesPage() {
  const navigate = useNavigate()
  const [voyages, setVoyages]   = useState<Voyage[]>([])
  const [vessels, setVessels]   = useState<Vessel[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [search, setSearch]     = useState('')
  const [form, setForm]         = useState({ ...EMPTY_FORM })

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [vResp, vesResp] = await Promise.all([voyagesAPI.list(), vesselsAPI.list()])
      const vlist: Voyage[] = vResp.data?.voyages || vResp.data || []
      const veslist: Vessel[] = vesResp.data?.vessels || vesResp.data || []
      setVoyages(vlist)
      setVessels(veslist)
      if (veslist.length > 0 && !form.vessel_id) setForm(f => ({ ...f, vessel_id: veslist[0].id }))
    } catch { toast.error('Could not load data') }
    finally { setLoading(false) }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.vessel_id) return toast.error('Please select a vessel')
    if (!form.voyage_number) return toast.error('Voyage number is required')
    setSaving(true)
    try {
      await voyagesAPI.create({
        ...form,
        cargo_quantity: form.cargo_quantity ? Number(form.cargo_quantity) : undefined,
        charter_party_speed: form.charter_party_speed ? Number(form.charter_party_speed) : undefined,
        charter_party_consumption: form.charter_party_consumption ? Number(form.charter_party_consumption) : undefined,
      })
      toast.success(`Voyage ${form.voyage_number} created!`)
      setShowForm(false)
      setForm({ ...EMPTY_FORM, vessel_id: vessels[0]?.id || '' })
      fetchAll()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to create voyage')
    } finally { setSaving(false) }
  }

  const filtered = voyages.filter(v =>
    v.voyage_number?.toLowerCase().includes(search.toLowerCase()) ||
    v.departure_port?.toLowerCase().includes(search.toLowerCase()) ||
    v.arrival_port?.toLowerCase().includes(search.toLowerCase()) ||
    v.vessel_name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white font-display flex items-center gap-3">
            <Navigation className="text-teal-400" size={28} /> Voyage Management
          </h1>
          <p className="text-white/40 text-sm mt-1">{voyages.length} voyages total</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-teal-500 to-ocean-500 rounded-xl text-white font-semibold text-sm shadow-glow-teal hover:opacity-90 transition-all">
          <Plus size={16} /> New Voyage
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search voyages…"
          className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-white/25 focus:outline-none focus:border-teal-500/50" />
      </div>

      {/* Voyage List */}
      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader size={28} className="animate-spin text-teal-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Navigation size={48} className="mx-auto mb-3 text-white/10" />
          <p className="text-white/40">{search ? 'No voyages match your search' : 'No voyages yet. Create your first voyage!'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((v, i) => (
            <motion.div key={v.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
              onClick={() => navigate(`/voyages/${v.id}`)}
              className="glass-card p-4 rounded-2xl cursor-pointer hover:border-teal-500/30 transition-all group flex items-center gap-4">
              {/* Route indicator */}
              <div className="flex-shrink-0 hidden sm:flex flex-col items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-teal-400" />
                <div className="w-0.5 h-8 bg-gradient-to-b from-teal-400 to-ocean-400" />
                <div className="w-2 h-2 rounded-full bg-ocean-400" />
              </div>

              {/* Main info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-white font-semibold text-sm group-hover:text-teal-300 transition-colors">{v.voyage_number}</p>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[v.status] || 'bg-white/10 text-white/40'}`}>{v.status.replace('_',' ')}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <MapPin size={11} className="text-teal-400 flex-shrink-0" />
                  <p className="text-white/60 text-sm truncate">{v.departure_port} → {v.arrival_port}</p>
                </div>
                <div className="flex items-center gap-3 mt-1 text-white/30 text-xs flex-wrap">
                  {v.vessel_name && <span className="flex items-center gap-1"><Ship size={10} />{v.vessel_name}</span>}
                  {v.eta && <span className="flex items-center gap-1"><Calendar size={10} />ETA: {new Date(v.eta).toLocaleDateString()}</span>}
                  {v.cargo_type && <span className="flex items-center gap-1"><Package size={10} />{v.cargo_type}</span>}
                </div>
              </div>

              {/* Stats */}
              <div className="hidden md:flex gap-4 flex-shrink-0">
                {v.total_distance_nm && (
                  <div className="text-center">
                    <p className="text-white font-semibold text-sm">{Number(v.total_distance_nm).toFixed(0)}</p>
                    <p className="text-white/30 text-xs">nm</p>
                  </div>
                )}
                {v.performance_score && (
                  <div className="text-center">
                    <p className={`font-semibold text-sm ${Number(v.performance_score) >= 85 ? 'text-green-400' : 'text-yellow-400'}`}>
                      {Number(v.performance_score).toFixed(0)}%
                    </p>
                    <p className="text-white/30 text-xs">perf</p>
                  </div>
                )}
              </div>

              <ChevronRight size={16} className="text-white/20 group-hover:text-teal-400 transition-colors flex-shrink-0" />
            </motion.div>
          ))}
        </div>
      )}

      {/* Add Voyage Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-navy-900 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-5 border-b border-white/10">
                <h2 className="text-white font-bold font-display text-lg flex items-center gap-2">
                  <Navigation size={20} className="text-teal-400" /> Create New Voyage
                </h2>
                <button onClick={() => setShowForm(false)} className="text-white/40 hover:text-white"><X size={20} /></button>
              </div>

              <form onSubmit={handleSubmit} className="p-5 space-y-5">
                {/* Vessel & Voyage ID */}
                <div>
                  <p className="text-teal-400 text-xs font-semibold uppercase tracking-wider mb-3">Voyage Details</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="text-white/50 text-xs mb-1 block">Select Vessel *</label>
                      <select name="vessel_id" value={form.vessel_id} onChange={handleChange} required className="maritime-select">
                        <option value="">— Select a vessel —</option>
                        {vessels.map(v => <option key={v.id} value={v.id}>{v.name} (IMO {v.imo_number})</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-white/50 text-xs mb-1 block">Voyage Number *</label>
                      <input name="voyage_number" value={form.voyage_number} onChange={handleChange} required
                        placeholder="VYG-2024-001" className="maritime-input" />
                    </div>
                    <div>
                      <label className="text-white/50 text-xs mb-1 block">Status</label>
                      <select name="status" value={form.status} onChange={handleChange} className="maritime-select">
                        <option value="planned">Planned</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Ports & Dates */}
                <div>
                  <p className="text-teal-400 text-xs font-semibold uppercase tracking-wider mb-3">Route & Schedule</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-white/50 text-xs mb-1 block">Departure Port *</label>
                      <select name="departure_port" value={form.departure_port} onChange={handleChange} className="maritime-select">
                        {PORTS.map(p => <option key={p}>{p}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-white/50 text-xs mb-1 block">Arrival Port *</label>
                      <select name="arrival_port" value={form.arrival_port} onChange={handleChange} className="maritime-select">
                        {PORTS.map(p => <option key={p}>{p}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-white/50 text-xs mb-1 block">ETD (Estimated Time of Departure)</label>
                      <input name="etd" type="datetime-local" value={form.etd} onChange={handleChange} className="maritime-input" />
                    </div>
                    <div>
                      <label className="text-white/50 text-xs mb-1 block">ETA (Estimated Time of Arrival)</label>
                      <input name="eta" type="datetime-local" value={form.eta} onChange={handleChange} className="maritime-input" />
                    </div>
                  </div>
                </div>

                {/* Cargo */}
                <div>
                  <p className="text-teal-400 text-xs font-semibold uppercase tracking-wider mb-3">Cargo & Charter Party</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-white/50 text-xs mb-1 block">Cargo Type</label>
                      <select name="cargo_type" value={form.cargo_type} onChange={handleChange} className="maritime-select">
                        {CARGO_TYPES.map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-white/50 text-xs mb-1 block">Cargo Quantity (MT)</label>
                      <input name="cargo_quantity" type="number" value={form.cargo_quantity} onChange={handleChange}
                        placeholder="75000" className="maritime-input" />
                    </div>
                    <div>
                      <label className="text-white/50 text-xs mb-1 block">Charterer</label>
                      <input name="charterer" value={form.charterer} onChange={handleChange}
                        placeholder="Cargill International" className="maritime-input" />
                    </div>
                    <div>
                      <label className="text-white/50 text-xs mb-1 block">CP Speed (knots)</label>
                      <input name="charter_party_speed" type="number" step="0.1" value={form.charter_party_speed} onChange={handleChange}
                        placeholder="14.0" className="maritime-input" />
                    </div>
                    <div>
                      <label className="text-white/50 text-xs mb-1 block">CP Consumption (MT/day)</label>
                      <input name="charter_party_consumption" type="number" step="0.1" value={form.charter_party_consumption} onChange={handleChange}
                        placeholder="28.5" className="maritime-input" />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowForm(false)}
                    className="flex-1 py-3 bg-white/5 border border-white/10 rounded-xl text-white/70 font-semibold hover:bg-white/10 transition-all">
                    Cancel
                  </button>
                  <button type="submit" disabled={saving}
                    className="flex-1 py-3 bg-gradient-to-r from-teal-500 to-ocean-500 rounded-xl text-white font-bold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50">
                    {saving ? <Loader size={16} className="animate-spin" /> : <Plus size={16} />}
                    {saving ? 'Creating…' : 'Create Voyage'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
