// VoyageIQ AI — Maritime Intelligence Platform
// Copyright (c) 2024 Kartik Chaudhary. All Rights Reserved.
import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Ship, Plus, X, Search, Anchor, Zap, Activity, ChevronRight, Loader } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { vesselsAPI } from '../services/api'
import { Vessel } from '../types'
import toast from 'react-hot-toast'

const VESSEL_TYPES = ['Bulk Carrier','Tanker','Container','General Cargo','LNG Carrier','LPG Carrier','Chemical Tanker','VLCC','Suezmax','Aframax','Panamax']
const FLAGS = ['Panama','Marshall Islands','Liberia','Bahamas','Malta','Cyprus','Singapore','Greece','Norway','Japan','China','India']

const EMPTY_FORM = {
  imo_number: '', name: '', vessel_type: 'Bulk Carrier', flag: 'Panama',
  built_year: new Date().getFullYear(), gross_tonnage: '', deadweight_tonnage: '',
  loa: '', beam: '', draft_design: '', main_engine_type: '', main_engine_power: '',
  design_speed: '', warranted_speed: '', warranted_consumption: '', classification_society: 'DNV GL',
}

export default function VesselsPage() {
  const navigate = useNavigate()
  const [vessels, setVessels]   = useState<Vessel[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [search, setSearch]     = useState('')
  const [form, setForm]         = useState({ ...EMPTY_FORM })

  useEffect(() => { fetchVessels() }, [])

  const fetchVessels = async () => {
    setLoading(true)
    try {
      const res = await vesselsAPI.list()
      setVessels(res.data?.vessels || res.data || [])
    } catch { toast.error('Could not load vessels') }
    finally { setLoading(false) }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.imo_number || !form.name) return toast.error('IMO Number and Name are required')
    setSaving(true)
    try {
      await vesselsAPI.create({
        ...form,
        built_year: Number(form.built_year),
        gross_tonnage: Number(form.gross_tonnage),
        deadweight_tonnage: Number(form.deadweight_tonnage),
        loa: Number(form.loa), beam: Number(form.beam), draft_design: Number(form.draft_design),
        main_engine_power: Number(form.main_engine_power),
        design_speed: Number(form.design_speed),
        warranted_speed: Number(form.warranted_speed),
        warranted_consumption: Number(form.warranted_consumption),
      })
      toast.success(`${form.name} added successfully!`)
      setShowForm(false)
      setForm({ ...EMPTY_FORM })
      fetchVessels()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to add vessel')
    } finally { setSaving(false) }
  }

  const filtered = vessels.filter(v =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.imo_number?.toLowerCase().includes(search.toLowerCase()) ||
    v.vessel_type?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white font-display flex items-center gap-3">
            <Ship className="text-teal-400" size={28} /> Fleet Management
          </h1>
          <p className="text-white/40 text-sm mt-1">{vessels.length} vessels registered</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-teal-500 to-ocean-500 rounded-xl text-white font-semibold text-sm shadow-glow-teal hover:opacity-90 transition-all">
          <Plus size={16} /> Add Vessel
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, IMO, or type…"
          className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-white/25 focus:outline-none focus:border-teal-500/50" />
      </div>

      {/* Vessel Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader size={28} className="animate-spin text-teal-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Ship size={48} className="mx-auto mb-3 text-white/10" />
          <p className="text-white/40">{search ? 'No vessels match your search' : 'No vessels yet. Add your first vessel!'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((v, i) => (
            <motion.div key={v.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              onClick={() => navigate(`/vessels/${v.id}`)}
              className="glass-card p-5 rounded-2xl cursor-pointer hover:border-teal-500/30 transition-all group">
              {/* Top row */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-white font-semibold text-base group-hover:text-teal-300 transition-colors">{v.name}</p>
                  <p className="text-white/40 text-xs mt-0.5">IMO {v.imo_number}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  v.status === 'active' ? 'bg-green-500/15 text-green-400' :
                  v.status === 'dry_dock' ? 'bg-yellow-500/15 text-yellow-400' : 'bg-white/10 text-white/40'}`}>
                  {v.status}
                </span>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                <span className="px-2 py-0.5 bg-teal-500/10 text-teal-400 text-xs rounded-full">{v.vessel_type}</span>
                <span className="px-2 py-0.5 bg-white/5 text-white/40 text-xs rounded-full">{v.flag}</span>
                {v.built_year && <span className="px-2 py-0.5 bg-white/5 text-white/40 text-xs rounded-full">Built {v.built_year}</span>}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { icon: Anchor, label: 'DWT', val: v.deadweight_tonnage ? `${(Number(v.deadweight_tonnage)/1000).toFixed(0)}k` : '—' },
                  { icon: Zap, label: 'Speed', val: v.warranted_speed ? `${v.warranted_speed} kn` : '—' },
                  { icon: Activity, label: 'Health', val: v.health_score ? `${v.health_score}%` : '—' },
                ].map(({ icon: Icon, label, val }) => (
                  <div key={label} className="bg-white/3 rounded-lg p-2 text-center">
                    <Icon size={12} className="mx-auto mb-1 text-white/30" />
                    <p className="text-white font-semibold text-sm">{val}</p>
                    <p className="text-white/30 text-xs">{label}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between text-xs text-white/30 pt-3 border-t border-white/5">
                <span>{v.classification_society || 'N/A'}</span>
                <span className="flex items-center gap-1 group-hover:text-teal-400 transition-colors">
                  View Details <ChevronRight size={12} />
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add Vessel Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-navy-900 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-5 border-b border-white/10">
                <h2 className="text-white font-bold font-display text-lg flex items-center gap-2">
                  <Ship size={20} className="text-teal-400" /> Add New Vessel
                </h2>
                <button onClick={() => setShowForm(false)} className="text-white/40 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-5 space-y-5">
                {/* Basic Info */}
                <div>
                  <p className="text-teal-400 text-xs font-semibold uppercase tracking-wider mb-3">Basic Information</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-white/50 text-xs mb-1 block">IMO Number *</label>
                      <input name="imo_number" value={form.imo_number} onChange={handleChange} required
                        placeholder="IMO9876543" className="maritime-input" />
                    </div>
                    <div>
                      <label className="text-white/50 text-xs mb-1 block">Vessel Name *</label>
                      <input name="name" value={form.name} onChange={handleChange} required
                        placeholder="MV Pacific Star" className="maritime-input" />
                    </div>
                    <div>
                      <label className="text-white/50 text-xs mb-1 block">Vessel Type</label>
                      <select name="vessel_type" value={form.vessel_type} onChange={handleChange} className="maritime-select">
                        {VESSEL_TYPES.map(t => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-white/50 text-xs mb-1 block">Flag State</label>
                      <select name="flag" value={form.flag} onChange={handleChange} className="maritime-select">
                        {FLAGS.map(f => <option key={f}>{f}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-white/50 text-xs mb-1 block">Year Built</label>
                      <input name="built_year" type="number" value={form.built_year} onChange={handleChange}
                        min="1970" max={new Date().getFullYear()} className="maritime-input" />
                    </div>
                    <div>
                      <label className="text-white/50 text-xs mb-1 block">Classification Society</label>
                      <select name="classification_society" value={form.classification_society} onChange={handleChange} className="maritime-select">
                        {['DNV GL','Bureau Veritas','Lloyd\'s Register','ABS','ClassNK','RINA','KR'].map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Dimensions */}
                <div>
                  <p className="text-teal-400 text-xs font-semibold uppercase tracking-wider mb-3">Dimensions & Tonnage</p>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { name: 'gross_tonnage', label: 'Gross Tonnage (GT)', placeholder: '43500' },
                      { name: 'deadweight_tonnage', label: 'Deadweight (DWT)', placeholder: '81000' },
                      { name: 'loa', label: 'LOA (m)', placeholder: '229.0' },
                      { name: 'beam', label: 'Beam (m)', placeholder: '32.26' },
                      { name: 'draft_design', label: 'Design Draft (m)', placeholder: '14.5' },
                    ].map(f => (
                      <div key={f.name}>
                        <label className="text-white/50 text-xs mb-1 block">{f.label}</label>
                        <input name={f.name} type="number" step="0.01"
                          value={(form as any)[f.name]} onChange={handleChange}
                          placeholder={f.placeholder} className="maritime-input" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Performance */}
                <div>
                  <p className="text-teal-400 text-xs font-semibold uppercase tracking-wider mb-3">Engine & Performance</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-white/50 text-xs mb-1 block">Main Engine Type</label>
                      <input name="main_engine_type" value={form.main_engine_type} onChange={handleChange}
                        placeholder="MAN B&W 6S60ME-C" className="maritime-input" />
                    </div>
                    <div>
                      <label className="text-white/50 text-xs mb-1 block">Engine Power (kW)</label>
                      <input name="main_engine_power" type="number" value={form.main_engine_power} onChange={handleChange}
                        placeholder="11060" className="maritime-input" />
                    </div>
                    <div>
                      <label className="text-white/50 text-xs mb-1 block">Design Speed (knots)</label>
                      <input name="design_speed" type="number" step="0.1" value={form.design_speed} onChange={handleChange}
                        placeholder="14.5" className="maritime-input" />
                    </div>
                    <div>
                      <label className="text-white/50 text-xs mb-1 block">Warranted Speed (knots)</label>
                      <input name="warranted_speed" type="number" step="0.1" value={form.warranted_speed} onChange={handleChange}
                        placeholder="14.0" className="maritime-input" />
                    </div>
                    <div>
                      <label className="text-white/50 text-xs mb-1 block">Warranted Consumption (MT/day)</label>
                      <input name="warranted_consumption" type="number" step="0.1" value={form.warranted_consumption} onChange={handleChange}
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
                    className="flex-1 py-3 bg-gradient-to-r from-teal-500 to-ocean-500 rounded-xl text-white font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50">
                    {saving ? <Loader size={16} className="animate-spin" /> : <Plus size={16} />}
                    {saving ? 'Adding…' : 'Add Vessel'}
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
