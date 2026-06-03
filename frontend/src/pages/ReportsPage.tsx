// VoyageIQ AI — Maritime Intelligence Platform
// Copyright (c) 2024 Kartik Chaudhary. All Rights Reserved.
import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FileText, Download, FileSpreadsheet, File, CheckCircle, Loader, Ship, Calendar, AlertCircle } from 'lucide-react'
import { voyagesAPI, reportsAPI } from '../services/api'
import { Voyage } from '../types'
import toast from 'react-hot-toast'

const FORMATS = [
  { id: 'pdf',   label: 'PDF Report',   icon: FileText,        color: 'text-red-400',   bg: 'bg-red-500/10 border-red-500/20',   desc: 'Printable executive report with charts' },
  { id: 'excel', label: 'Excel Report', icon: FileSpreadsheet, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20', desc: 'Multi-sheet workbook with raw data' },
  { id: 'csv',   label: 'CSV Export',   icon: File,            color: 'text-blue-400',  bg: 'bg-blue-500/10 border-blue-500/20',  desc: 'Raw noon report data for analysis' },
] as const

type Format = 'pdf' | 'excel' | 'csv'

export default function ReportsPage() {
  const [voyages, setVoyages]           = useState<Voyage[]>([])
  const [selectedVoyage, setSelected]   = useState<Voyage | null>(null)
  const [format, setFormat]             = useState<Format>('pdf')
  const [loading, setLoading]           = useState(false)
  const [fetchingVoyages, setFetching]  = useState(true)
  const [recentReports, setRecentReports] = useState<{name:string,fmt:string,date:string,voyageId:string}[]>([])

  useEffect(() => { fetchVoyages() }, [])

  const fetchVoyages = async () => {
    setFetching(true)
    try {
      const res = await voyagesAPI.list()
      const list: Voyage[] = res.data?.voyages || res.data || []
      setVoyages(list)
      if (list.length > 0) setSelected(list[0])
    } catch { toast.error('Could not load voyages') }
    finally { setFetching(false) }
  }

  const handleDownload = async () => {
    if (!selectedVoyage) return toast.error('Please select a voyage first')
    setLoading(true)
    const tid = toast.loading(`Generating ${format.toUpperCase()} report…`)
    try {
      const res = await reportsAPI.generate(selectedVoyage.id, format)
      // Create blob download
      const blob = new Blob([res.data], {
        type: format === 'pdf'
          ? 'application/pdf'
          : format === 'excel'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'text/csv',
      })
      const url  = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const ext  = format === 'excel' ? 'xlsx' : format
      const filename = `VoyageIQ_${selectedVoyage.vessel_name || 'vessel'}_${selectedVoyage.voyage_number}.${ext}`
      link.href = url
      link.download = filename
      link.click()
      URL.revokeObjectURL(url)
      toast.success(`${format.toUpperCase()} downloaded!`, { id: tid })
      // Track in recent
      setRecentReports(prev => [
        { name: `${selectedVoyage.voyage_number} — ${selectedVoyage.departure_port}→${selectedVoyage.arrival_port}`,
          fmt: format.toUpperCase(), date: new Date().toLocaleDateString(), voyageId: selectedVoyage.id },
        ...prev.slice(0, 9)
      ])
    } catch (err: any) {
      toast.error('Report generation failed. Make sure the voyage has noon reports.', { id: tid })
    } finally {
      setLoading(false)
    }
  }

  const fmtIcon = (fmt: string) => {
    const F = FORMATS.find(f => f.id === fmt || f.label.toLowerCase().startsWith(fmt.toLowerCase()))
    return F ? <F.icon size={14} /> : <FileText size={14} />
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-white font-display flex items-center gap-3">
          <FileText className="text-teal-400" size={28} /> Report Generator
        </h1>
        <p className="text-white/40 text-sm mt-1">Generate and download PDF, Excel, or CSV voyage reports</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — Config panel */}
        <div className="lg:col-span-2 space-y-5">

          {/* Step 1 — Select Voyage */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="glass-card p-5 rounded-2xl">
            <h2 className="text-sm font-semibold text-white/80 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-teal-500/20 text-teal-400 text-xs flex items-center justify-center font-bold">1</span>
              Select Voyage
            </h2>
            {fetchingVoyages ? (
              <div className="flex items-center gap-2 text-white/40 text-sm"><Loader size={14} className="animate-spin" /> Loading voyages…</div>
            ) : voyages.length === 0 ? (
              <div className="text-center py-6">
                <AlertCircle className="mx-auto mb-2 text-yellow-400" size={28} />
                <p className="text-white/50 text-sm">No voyages found.</p>
                <p className="text-white/30 text-xs mt-1">Add a voyage first using the Voyages page.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                {voyages.map(v => (
                  <button key={v.id} onClick={() => setSelected(v)}
                    className={`text-left p-3 rounded-xl border transition-all ${selectedVoyage?.id === v.id
                      ? 'bg-teal-500/15 border-teal-500/40'
                      : 'bg-white/3 border-white/8 hover:border-white/20'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Ship size={13} className="text-teal-400 flex-shrink-0" />
                      <p className="text-white text-sm font-medium truncate">{v.voyage_number}</p>
                      {selectedVoyage?.id === v.id && <CheckCircle size={13} className="text-teal-400 ml-auto flex-shrink-0" />}
                    </div>
                    <p className="text-white/50 text-xs truncate">{v.departure_port} → {v.arrival_port}</p>
                    <p className="text-white/30 text-xs mt-0.5">{v.vessel_name || 'Unknown vessel'} · {v.status}</p>
                  </button>
                ))}
              </div>
            )}
          </motion.div>

          {/* Step 2 — Select Format */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="glass-card p-5 rounded-2xl">
            <h2 className="text-sm font-semibold text-white/80 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-teal-500/20 text-teal-400 text-xs flex items-center justify-center font-bold">2</span>
              Choose Format
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {FORMATS.map(f => (
                <button key={f.id} onClick={() => setFormat(f.id as Format)}
                  className={`p-4 rounded-xl border text-left transition-all ${format === f.id ? f.bg : 'bg-white/3 border-white/8 hover:border-white/20'}`}>
                  <f.icon size={20} className={f.color} />
                  <p className="text-white text-sm font-semibold mt-2">{f.label}</p>
                  <p className="text-white/40 text-xs mt-1 leading-relaxed">{f.desc}</p>
                </button>
              ))}
            </div>
          </motion.div>

          {/* Step 3 — Generate */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="glass-card p-5 rounded-2xl">
            <h2 className="text-sm font-semibold text-white/80 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-teal-500/20 text-teal-400 text-xs flex items-center justify-center font-bold">3</span>
              Generate & Download
            </h2>
            <button onClick={handleDownload} disabled={loading || !selectedVoyage}
              className="w-full py-4 bg-gradient-to-r from-teal-500 to-ocean-500 hover:from-teal-400 hover:to-ocean-400
                         disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-white font-bold text-base
                         flex items-center justify-center gap-3 transition-all shadow-glow-teal">
              {loading ? <Loader size={20} className="animate-spin" /> : <Download size={20} />}
              {loading ? 'Generating Report…' : `Download ${format.toUpperCase()} Report`}
            </button>
            {selectedVoyage && (
              <p className="text-white/30 text-xs text-center mt-2">
                {selectedVoyage.voyage_number} · {selectedVoyage.departure_port} → {selectedVoyage.arrival_port}
              </p>
            )}
          </motion.div>
        </div>

        {/* Right — Preview + Recent */}
        <div className="space-y-5">
          {/* Preview card */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            className="glass-card p-5 rounded-2xl">
            <h3 className="text-sm font-semibold text-white mb-4">Report Preview</h3>
            <div className="bg-navy-900 rounded-xl p-4 border border-white/5 font-mono text-xs space-y-2">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <div>
                  <p className="text-white font-bold text-sm font-display">VoyageIQ AI</p>
                  <p className="text-teal-400 text-xs">Voyage Performance Report</p>
                </div>
                <div className="text-right text-white/30">
                  <p>{new Date().toLocaleDateString()}</p>
                  <p className="text-xs">Confidential</p>
                </div>
              </div>
              {selectedVoyage ? (
                <div className="space-y-1 text-white/50">
                  <p><span className="text-white/30">Voyage:</span> {selectedVoyage.voyage_number}</p>
                  <p><span className="text-white/30">Route:</span> {selectedVoyage.departure_port} → {selectedVoyage.arrival_port}</p>
                  <p><span className="text-white/30">Status:</span> <span className="text-teal-400">{selectedVoyage.status}</span></p>
                  {selectedVoyage.total_distance_nm && <p><span className="text-white/30">Distance:</span> {Number(selectedVoyage.total_distance_nm).toFixed(0)} nm</p>}
                  {selectedVoyage.performance_score && <p><span className="text-white/30">Performance:</span> <span className="text-yellow-400">{Number(selectedVoyage.performance_score).toFixed(1)}%</span></p>}
                </div>
              ) : (
                <p className="text-white/25 text-xs italic">Select a voyage above…</p>
              )}
              <div className="pt-2 border-t border-white/5">
                <p className="text-white/25 mb-1">Sections included:</p>
                {['Cover Page', 'Executive Summary', 'Daily Performance', 'Fuel Analysis', 'Claims Summary', 'Recommendations'].map(s => (
                  <span key={s} className="inline-block mr-1 mb-1 px-1.5 py-0.5 bg-teal-500/10 text-teal-400/70 rounded text-xs">{s}</span>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Recent reports */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="glass-card p-5 rounded-2xl">
            <h3 className="text-sm font-semibold text-white mb-3">Recent Downloads</h3>
            {recentReports.length === 0 ? (
              <p className="text-white/30 text-xs text-center py-4">No reports downloaded yet</p>
            ) : (
              <div className="space-y-2">
                {recentReports.map((r, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 bg-navy-800/50 rounded-xl">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0
                        ${r.fmt === 'PDF' ? 'bg-red-500/20 text-red-400' : r.fmt === 'EXCEL' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}`}>
                        {r.fmt === 'EXCEL' ? 'XLS' : r.fmt}
                      </div>
                      <div className="min-w-0">
                        <p className="text-white/80 text-xs truncate">{r.name}</p>
                        <p className="text-white/30 text-xs">{r.date}</p>
                      </div>
                    </div>
                    <button onClick={() => { setSelected(voyages.find(v => v.id === r.voyageId) || null); setFormat(r.fmt.toLowerCase() === 'excel' ? 'excel' : r.fmt.toLowerCase() as Format) }}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-teal-400 transition-colors flex-shrink-0 ml-2">
                      <Download size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  )
}
