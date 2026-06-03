// VoyageIQ AI — Maritime Intelligence Platform
// Copyright (c) 2024 Kartik Chaudhary. All Rights Reserved.
// Unauthorized copying or use of this file is strictly prohibited.
// Contact: 2512520007@geu.ac.in
import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { FileText, Download, CheckSquare, Square, ChevronDown, Loader, FileBarChart2, FileSpreadsheet, Database } from 'lucide-react'
import { voyagesAPI, reportsAPI } from '../services/api'
import { Voyage } from '../types'
import toast from 'react-hot-toast'

const TEMPLATES = [
  { id: 'executive', label: 'Executive Summary', desc: 'High-level KPIs and voyage highlights', icon: FileBarChart2 },
  { id: 'full_voyage', label: 'Full Voyage Report', desc: 'Complete voyage analysis with all data', icon: FileText },
  { id: 'fuel_analysis', label: 'Fuel Analysis Report', desc: 'Detailed fuel consumption breakdown', icon: Database },
  { id: 'claims', label: 'Claims Report', desc: 'Performance claims with commercial impact', icon: FileText },
  { id: 'weather', label: 'Weather Analysis', desc: 'Weather impact attribution report', icon: FileBarChart2 },
]

const SECTIONS = [
  'Executive Summary', 'Performance Analysis', 'Fuel Analysis',
  'Weather Analysis', 'Headwind/Tailwind Analysis', 'Current Impact',
  'Wave & Swell Analysis', 'Weather Attribution', 'Claim Analysis',
  'Route Analysis', '1° vs 0.25° Comparison', 'AI Recommendations',
]

export default function ReportsPage() {
  const [voyages, setVoyages] = useState<Voyage[]>([])
  const [selectedVoyage, setSelectedVoyage] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState('full_voyage')
  const [format, setFormat] = useState<'pdf' | 'excel' | 'csv'>('pdf')
  const [sections, setSections] = useState<string[]>(SECTIONS)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    voyagesAPI.list().then(res => {
      const vs = res.data.voyages || res.data
      setVoyages(vs)
      if (vs.length > 0) setSelectedVoyage(vs[0].id)
    }).catch(console.error)
  }, [])

  const toggleSection = (s: string) => {
    setSections(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  const handleGenerate = async () => {
    if (!selectedVoyage) { toast.error('Select a voyage first'); return }
    setGenerating(true)
    try {
      const res = await reportsAPI.generate(selectedVoyage, format)
      const blob = new Blob([res.data], {
        type: format === 'pdf' ? 'application/pdf'
          : format === 'excel' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'text/csv'
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `VoyageIQ_Report_${selectedVoyage.slice(0, 8)}.${format === 'excel' ? 'xlsx' : format}`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Report downloaded successfully!')
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to generate report')
    } finally { setGenerating(false) }
  }

  const selectedV = voyages.find(v => v.id === selectedVoyage)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-white">Report Generation Center</h1>
        <p className="text-navy-400 text-sm mt-1">Generate professional maritime reports in PDF, Excel, or CSV formats</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Config */}
        <div className="space-y-5">
          {/* Voyage selector */}
          <div className="glass-card p-5 rounded-2xl space-y-4">
            <h3 className="text-sm font-semibold text-white">Report Configuration</h3>

            <div>
              <label className="text-xs text-navy-400 block mb-1.5">Select Voyage</label>
              <div className="relative">
                <select value={selectedVoyage} onChange={e => setSelectedVoyage(e.target.value)}
                  className="w-full bg-navy-800 border border-navy-600 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-teal-500 appearance-none pr-8">
                  {voyages.map(v => <option key={v.id} value={v.id}>{v.voyage_number} — {v.departure_port} → {v.arrival_port}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none" />
              </div>
              {selectedV && (
                <div className="mt-2 text-xs text-navy-500 space-y-0.5">
                  <p>Status: <span className="text-teal-400 capitalize">{selectedV.status.replace('_', ' ')}</span></p>
                  {selectedV.vessel_name && <p>Vessel: <span className="text-white">{selectedV.vessel_name}</span></p>}
                </div>
              )}
            </div>

            <div>
              <label className="text-xs text-navy-400 block mb-1.5">Report Format</label>
              <div className="grid grid-cols-3 gap-2">
                {(['pdf', 'excel', 'csv'] as const).map(f => (
                  <button key={f} onClick={() => setFormat(f)}
                    className={`py-2 rounded-xl text-sm font-medium transition-all flex flex-col items-center gap-1 ${format === f ? 'bg-teal-500/20 text-teal-400 border border-teal-500/40' : 'bg-navy-800 text-navy-400 hover:text-white border border-transparent'}`}>
                    {f === 'pdf' ? <FileText size={16} /> : f === 'excel' ? <FileSpreadsheet size={16} /> : <Database size={16} />}
                    {f.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <motion.button onClick={handleGenerate} disabled={!selectedVoyage || generating}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className="w-full py-3 bg-gradient-to-r from-teal-600 to-ocean-600 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40 shadow-glow-teal">
              {generating ? <><Loader size={16} className="animate-spin" />Generating...</> : <><Download size={16} />Generate & Download</>}
            </motion.button>
          </div>

          {/* Report Templates */}
          <div className="glass-card p-5 rounded-2xl space-y-3">
            <h3 className="text-sm font-semibold text-white">Report Templates</h3>
            {TEMPLATES.map(t => {
              const Icon = t.icon
              const isSelected = selectedTemplate === t.id
              return (
                <button key={t.id} onClick={() => setSelectedTemplate(t.id)}
                  className={`w-full flex items-start gap-3 p-3 rounded-xl text-left transition-all ${isSelected ? 'bg-teal-500/10 border border-teal-500/30' : 'hover:bg-navy-800 border border-transparent'}`}>
                  <Icon size={16} className={isSelected ? 'text-teal-400' : 'text-navy-500'} />
                  <div>
                    <p className={`text-sm font-medium ${isSelected ? 'text-teal-400' : 'text-white'}`}>{t.label}</p>
                    <p className="text-xs text-navy-500 mt-0.5">{t.desc}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Report Preview / Sections */}
        <div className="lg:col-span-2 space-y-5">
          {/* Section toggles */}
          <div className="glass-card p-5 rounded-2xl">
            <h3 className="text-sm font-semibold text-white mb-4">Report Sections</h3>
            <div className="grid grid-cols-2 gap-2">
              {SECTIONS.map(s => {
                const enabled = sections.includes(s)
                return (
                  <button key={s} onClick={() => toggleSection(s)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl text-left text-sm transition-all ${enabled ? 'bg-teal-500/10 border border-teal-500/20 text-teal-300' : 'text-navy-500 hover:bg-navy-800 border border-transparent'}`}>
                    {enabled ? <CheckSquare size={14} className="text-teal-400 shrink-0" /> : <Square size={14} className="shrink-0" />}
                    {s}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Report preview mockup */}
          <div className="glass-card p-5 rounded-2xl">
            <h3 className="text-sm font-semibold text-white mb-4">Report Preview</h3>
            <div className="bg-navy-900 rounded-xl p-5 border border-white/5 font-mono text-xs space-y-3">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div>
                  <p className="text-white font-bold text-base font-display">VoyageIQ AI</p>
                  <p className="text-teal-400 text-xs">Maritime Voyage Performance Report</p>
                </div>
                <div className="text-right text-navy-400">
                  <p>{new Date().toLocaleDateString()}</p>
                  <p className="text-xs">Confidential</p>
                </div>
              </div>
              {selectedV && (
                <div className="space-y-1 text-navy-300">
                  <p><span className="text-navy-500">Voyage:</span> {selectedV.voyage_number}</p>
                  <p><span className="text-navy-500">Route:</span> {selectedV.departure_port} → {selectedV.arrival_port}</p>
                  <p><span className="text-navy-500">Status:</span> <span className="text-teal-400">{selectedV.status}</span></p>
                  {selectedV.total_distance_nm && <p><span className="text-navy-500">Distance:</span> {selectedV.total_distance_nm.toFixed(0)} nm</p>}
                  {selectedV.performance_score && <p><span className="text-navy-500">Performance:</span> <span className={selectedV.performance_score >= 85 ? 'text-green-400' : 'text-yellow-400'}>{selectedV.performance_score.toFixed(1)}%</span></p>}
                </div>
              )}
              <div className="pt-2 border-t border-white/5">
                <p className="text-navy-500 mb-2">Included Sections ({sections.length}):</p>
                <div className="flex flex-wrap gap-1">
                  {sections.slice(0, 6).map(s => <span key={s} className="px-2 py-0.5 bg-teal-500/10 text-teal-400 rounded text-xs">{s}</span>)}
                  {sections.length > 6 && <span className="text-navy-500">+{sections.length - 6} more</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Recent reports table */}
          <div className="glass-card p-5 rounded-2xl">
            <h3 className="text-sm font-semibold text-white mb-4">Recent Reports</h3>
            <div className="space-y-2">
              {[
                { name: 'V2024001 — Singapore→Rotterdam', format: 'PDF', date: '2024-05-30', size: '2.4 MB' },
                { name: 'V2024002 — Shanghai→Los Angeles', format: 'Excel', date: '2024-05-28', size: '1.1 MB' },
                { name: 'V2024003 — Ras Tanura→Ulsan', format: 'PDF', date: '2024-05-25', size: '3.2 MB' },
              ].map((r, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-navy-800/50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${r.format === 'PDF' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>{r.format}</div>
                    <div>
                      <p className="text-sm text-white">{r.name}</p>
                      <p className="text-xs text-navy-500">{r.date} · {r.size}</p>
                    </div>
                  </div>
                  <button className="p-2 rounded-lg hover:bg-navy-700 text-navy-400 hover:text-teal-400 transition-colors">
                    <Download size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
