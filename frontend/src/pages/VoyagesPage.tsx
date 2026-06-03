import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Navigation2, ArrowRight, Clock, Fuel, Package, ChevronRight } from 'lucide-react'
import { voyagesAPI } from '../services/api'
import { Voyage } from '../types'

const statusConfig: Record<string, { color: string; label: string }> = {
  in_progress: { color: 'bg-teal-500/15 text-teal-400 border-teal-500/30', label: 'In Progress' },
  completed: { color: 'bg-green-500/15 text-green-400 border-green-500/30', label: 'Completed' },
  planned: { color: 'bg-blue-500/15 text-blue-400 border-blue-500/30', label: 'Planned' },
  cancelled: { color: 'bg-red-500/15 text-red-400 border-red-500/30', label: 'Cancelled' },
}

export default function VoyagesPage() {
  const navigate = useNavigate()
  const [voyages, setVoyages] = useState<Voyage[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')

  useEffect(() => {
    voyagesAPI.list()
      .then(res => setVoyages(res.data.voyages || res.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const tabs = ['all', 'in_progress', 'completed', 'planned']
  const filtered = activeTab === 'all' ? voyages : voyages.filter(v => v.status === activeTab)

  const daysAgo = (dateStr?: string) => {
    if (!dateStr) return null
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
    return diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : `${diff}d ago`
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-white">Voyage Management</h1>
        <p className="text-navy-400 text-sm mt-1">{voyages.length} voyages tracked</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-navy-800/50 rounded-xl p-1 w-fit">
        {tabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all capitalize ${activeTab === tab ? 'bg-teal-500/20 text-teal-400 shadow' : 'text-navy-400 hover:text-white'}`}>
            {tab.replace('_', ' ')}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="glass-card p-6 rounded-2xl h-32 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-navy-400">No voyages found</div>
      ) : (
        <div className="space-y-4">
          {filtered.map((v, i) => {
            const sc = statusConfig[v.status] || statusConfig.planned
            const perfScore = v.performance_score || 0
            return (
              <motion.div key={v.id}
                initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                whileHover={{ x: 4 }}
                onClick={() => navigate(`/voyages/${v.id}`)}
                className="glass-card p-5 rounded-2xl cursor-pointer hover:border-teal-500/20 border border-transparent transition-all"
              >
                <div className="flex items-start gap-4">
                  {/* Route visual */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs font-mono text-navy-500 bg-navy-800 px-2 py-0.5 rounded">{v.voyage_number}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${sc.color}`}>{sc.label}</span>
                      {v.charterer && <span className="text-xs text-navy-500">{v.charterer}</span>}
                    </div>

                    <div className="flex items-center gap-3 mb-3">
                      <div>
                        <p className="font-bold text-white">{v.departure_port}</p>
                        <p className="text-xs text-navy-500">{daysAgo(v.atd)}</p>
                      </div>
                      <div className="flex-1 flex items-center gap-1">
                        <div className="flex-1 h-px bg-gradient-to-r from-teal-500/50 to-ocean-500/50" />
                        <ArrowRight size={14} className="text-teal-400" />
                        <div className="flex-1 h-px bg-gradient-to-r from-ocean-500/50 to-teal-500/50" />
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-white">{v.arrival_port}</p>
                        <p className="text-xs text-navy-500">ETA: {v.eta ? new Date(v.eta).toLocaleDateString() : '—'}</p>
                      </div>
                    </div>

                    {/* Progress bar */}
                    {v.status === 'in_progress' && v.total_distance_nm && (
                      <div className="mb-3">
                        <div className="flex justify-between text-xs text-navy-500 mb-1">
                          <span>Voyage Progress</span>
                          <span>{v.total_distance_nm.toFixed(0)} nm total</span>
                        </div>
                        <div className="h-1.5 bg-navy-800 rounded-full">
                          <div className="h-1.5 rounded-full bg-gradient-to-r from-teal-500 to-ocean-500" style={{ width: '55%' }} />
                        </div>
                      </div>
                    )}

                    {/* Stats */}
                    <div className="flex items-center gap-4 text-xs text-navy-400">
                      {v.cargo_type && (
                        <span className="flex items-center gap-1"><Package size={11} />{v.cargo_type}{v.cargo_quantity ? ` · ${(v.cargo_quantity / 1000).toFixed(0)}K MT` : ''}</span>
                      )}
                      {v.avg_speed && <span className="flex items-center gap-1"><Navigation2 size={11} />{v.avg_speed.toFixed(1)} kts avg</span>}
                      {v.total_fuel_consumed && <span className="flex items-center gap-1"><Fuel size={11} />{v.total_fuel_consumed.toFixed(0)} MT fuel</span>}
                    </div>
                  </div>

                  {/* Performance + ETA */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className={`text-lg font-bold font-display ${perfScore >= 85 ? 'text-green-400' : perfScore >= 70 ? 'text-teal-400' : 'text-yellow-400'}`}>
                      {perfScore.toFixed(0)}%
                    </div>
                    <span className="text-xs text-navy-500">Performance</span>
                    <ChevronRight size={16} className="text-navy-600 mt-2" />
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
