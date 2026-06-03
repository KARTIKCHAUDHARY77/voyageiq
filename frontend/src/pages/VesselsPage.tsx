// VoyageIQ AI — Maritime Intelligence Platform
// Copyright (c) 2024 Kartik Chaudhary. All Rights Reserved.
// Unauthorized copying or use of this file is strictly prohibited.
// Contact: 2512520007@geu.ac.in
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Ship, Plus, Activity, Anchor, Filter } from 'lucide-react'
import { vesselsAPI } from '../services/api'
import { Vessel } from '../types'

const statusColors: Record<string, string> = {
  active: 'bg-green-500/15 text-green-400 border-green-500/30',
  dry_dock: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  laid_up: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
  scrapped: 'bg-red-500/15 text-red-400 border-red-500/30',
}

const vesselTypeIcon = (type: string) => {
  if (type.includes('Bulk')) return '⚓'
  if (type.includes('Container')) return '📦'
  if (type.includes('Tanker') || type.includes('VLCC')) return '🛢️'
  if (type.includes('LNG')) return '🔵'
  return '🚢'
}

export default function VesselsPage() {
  const navigate = useNavigate()
  const [vessels, setVessels] = useState<Vessel[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    vesselsAPI.list()
      .then(res => setVessels(res.data.vessels || res.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const filtered = filter === 'all' ? vessels : vessels.filter(v =>
    filter === 'active' ? v.status === 'active' : v.vessel_type.toLowerCase().includes(filter)
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">Fleet Management</h1>
          <p className="text-navy-400 text-sm mt-1">{vessels.length} vessels registered</p>
        </div>
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-600 to-ocean-600 text-white rounded-xl text-sm font-medium shadow-glow-teal">
          <Plus size={16} /> Add Vessel
        </motion.button>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={14} className="text-navy-400" />
        {['all', 'active', 'bulk', 'container', 'tanker', 'lng'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${filter === f ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30' : 'text-navy-400 hover:text-white hover:bg-navy-700'}`}>
            {f === 'all' ? 'All Vessels' : f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="glass-card p-6 rounded-2xl animate-pulse">
              <div className="h-5 bg-navy-700 rounded mb-3 w-3/4" />
              <div className="h-4 bg-navy-700 rounded mb-4 w-1/2" />
              <div className="space-y-2">
                {[1, 2, 3].map(j => <div key={j} className="h-3 bg-navy-700 rounded w-full" />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((v, i) => (
            <motion.div key={v.id}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              whileHover={{ scale: 1.02, y: -3 }}
              onClick={() => navigate(`/vessels/${v.id}`)}
              className="glass-card p-6 rounded-2xl cursor-pointer hover:border-teal-500/30 transition-all border border-transparent"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl">{vesselTypeIcon(v.vessel_type)}</span>
                    <div>
                      <h3 className="font-bold text-white">{v.name}</h3>
                      <p className="text-xs text-navy-400">{v.imo_number}</p>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${statusColors[v.status] || statusColors.active}`}>
                    {v.status === 'active' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 mr-1 animate-pulse" />}
                    {v.status.replace('_', ' ')}
                  </span>
                </div>
              </div>

              {/* Type + Flag */}
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs bg-navy-700 text-navy-300 px-2 py-0.5 rounded-lg">{v.vessel_type}</span>
                <span className="text-xs text-navy-400">🏴 {v.flag}</span>
                <span className="text-xs text-navy-500">{v.built_year}</span>
              </div>

              {/* Key specs */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { label: 'DWT', value: v.deadweight_tonnage ? `${(v.deadweight_tonnage / 1000).toFixed(0)}K MT` : '—' },
                  { label: 'LOA', value: v.loa ? `${v.loa}m` : '—' },
                  { label: 'Engine', value: v.main_engine_power ? `${(v.main_engine_power / 1000).toFixed(0)} MW` : '—' },
                  { label: 'Speed', value: v.warranted_speed ? `${v.warranted_speed} kts` : '—' },
                ].map(spec => (
                  <div key={spec.label} className="bg-navy-800/50 rounded-lg p-2">
                    <p className="text-xs text-navy-500">{spec.label}</p>
                    <p className="text-sm font-medium text-white">{spec.value}</p>
                  </div>
                ))}
              </div>

              {/* Classification */}
              <div className="flex items-center justify-between pt-3 border-t border-white/5">
                <span className="text-xs text-navy-500">{v.classification_society}</span>
                <div className="flex items-center gap-1 text-xs text-teal-400">
                  <Activity size={12} />
                  <span>View Details</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
