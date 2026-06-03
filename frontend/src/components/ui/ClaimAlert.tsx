import React from 'react'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  Fuel,
  Anchor,
  Wind,
  FileText,
  ChevronRight,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  TrendingDown,
  Eye,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ClaimSeverity = 'critical' | 'high' | 'medium' | 'low'
export type ClaimStatus =
  | 'open'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'pending'

export type ClaimType =
  | 'fuel_overconsumption'
  | 'speed_deviation'
  | 'weather_damage'
  | 'cargo_damage'
  | 'off_route'
  | 'delay'
  | 'other'

export interface ClaimAlertProps {
  id: string
  type: ClaimType
  title: string
  description?: string
  severity: ClaimSeverity
  status: ClaimStatus
  impactUSD: number
  expected?: string | number
  actual?: string | number
  comparisonUnit?: string
  vesselName?: string
  voyageId?: string
  timestamp?: string
  onView?: (id: string) => void
  onApprove?: (id: string) => void
  onDismiss?: (id: string) => void
  index?: number
}

// ─── Maps ─────────────────────────────────────────────────────────────────────

const severityMap: Record<ClaimSeverity, { border: string; glow: string; badge: string; label: string }> = {
  critical: {
    border: 'border-l-red-500',
    glow: 'rgba(239,68,68,0.08)',
    badge: 'bg-red-500/20 text-red-400 border-red-500/30',
    label: 'Critical',
  },
  high: {
    border: 'border-l-orange-500',
    glow: 'rgba(249,115,22,0.08)',
    badge: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    label: 'High',
  },
  medium: {
    border: 'border-l-yellow-500',
    glow: 'rgba(234,179,8,0.08)',
    badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    label: 'Medium',
  },
  low: {
    border: 'border-l-teal-500',
    glow: 'rgba(20,184,166,0.08)',
    badge: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
    label: 'Low',
  },
}

const statusMap: Record<ClaimStatus, { icon: React.ReactNode; class: string; label: string }> = {
  open: {
    icon: <AlertCircle className="w-3 h-3" />,
    class: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    label: 'Open',
  },
  under_review: {
    icon: <Clock className="w-3 h-3" />,
    class: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    label: 'Under Review',
  },
  approved: {
    icon: <CheckCircle2 className="w-3 h-3" />,
    class: 'bg-green-500/20 text-green-400 border-green-500/30',
    label: 'Approved',
  },
  rejected: {
    icon: <XCircle className="w-3 h-3" />,
    class: 'bg-red-500/20 text-red-400 border-red-500/30',
    label: 'Rejected',
  },
  pending: {
    icon: <Clock className="w-3 h-3" />,
    class: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    label: 'Pending',
  },
}

const typeIconMap: Record<ClaimType, React.ReactNode> = {
  fuel_overconsumption: <Fuel className="w-5 h-5" />,
  speed_deviation: <TrendingDown className="w-5 h-5" />,
  weather_damage: <Wind className="w-5 h-5" />,
  cargo_damage: <AlertTriangle className="w-5 h-5" />,
  off_route: <Anchor className="w-5 h-5" />,
  delay: <Clock className="w-5 h-5" />,
  other: <FileText className="w-5 h-5" />,
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ClaimAlert({
  id,
  type,
  title,
  description,
  severity,
  status,
  impactUSD,
  expected,
  actual,
  comparisonUnit = '',
  vesselName,
  voyageId,
  timestamp,
  onView,
  onApprove,
  onDismiss,
  index = 0,
}: ClaimAlertProps) {
  const sev = severityMap[severity]
  const sta = statusMap[status]
  const TypeIcon = typeIconMap[type]

  const formattedImpact = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(impactUSD)

  return (
    <motion.div
      initial={{ opacity: 0, x: 60 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 60 }}
      transition={{ duration: 0.4, delay: index * 0.07, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={`relative bg-white/5 backdrop-blur-md border border-white/10 border-l-4 ${sev.border} rounded-2xl overflow-hidden shadow-card`}
      style={{ background: `linear-gradient(135deg, ${sev.glow} 0%, transparent 60%)` }}
    >
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          {/* Icon + title */}
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: sev.glow, border: `1px solid ${sev.badge.split(' ')[0].replace('bg-', '').replace('/20', '')}33` }}
            >
              <span className={sev.badge.split(' ')[1]}>{TypeIcon}</span>
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-white truncate leading-tight">{title}</h3>
              {(vesselName || voyageId) && (
                <p className="text-xs text-slate-400 mt-0.5 truncate">
                  {vesselName && <span>{vesselName}</span>}
                  {vesselName && voyageId && <span className="mx-1">·</span>}
                  {voyageId && <span>{voyageId}</span>}
                </p>
              )}
            </div>
          </div>

          {/* Badges */}
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${sev.badge}`}>
              {sev.label}
            </span>
            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${sta.class}`}>
              {sta.icon}
              {sta.label}
            </span>
          </div>
        </div>

        {/* Description */}
        {description && (
          <p className="text-xs text-slate-400 mb-3 leading-relaxed line-clamp-2">{description}</p>
        )}

        {/* Expected vs Actual comparison */}
        {(expected !== undefined || actual !== undefined) && (
          <div className="flex items-center gap-3 mb-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            {expected !== undefined && (
              <div className="flex-1 text-center">
                <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-0.5">Expected</p>
                <p className="text-sm font-semibold text-slate-200">
                  {expected}
                  {comparisonUnit && <span className="text-xs text-slate-400 ml-0.5">{comparisonUnit}</span>}
                </p>
              </div>
            )}
            {expected !== undefined && actual !== undefined && (
              <div className="h-8 w-px bg-white/10" />
            )}
            {actual !== undefined && (
              <div className="flex-1 text-center">
                <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-0.5">Actual</p>
                <p className="text-sm font-semibold text-red-400">
                  {actual}
                  {comparisonUnit && <span className="text-xs text-red-400/70 ml-0.5">{comparisonUnit}</span>}
                </p>
              </div>
            )}
            <div className="h-8 w-px bg-white/10" />
            <div className="flex-1 text-center">
              <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-0.5">Impact</p>
              <p className="text-sm font-bold text-red-400 tabular-nums">{formattedImpact}</p>
            </div>
          </div>
        )}

        {/* Impact (if no comparison shown) */}
        {expected === undefined && actual === undefined && (
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-slate-500">Financial Impact:</span>
            <span className="text-lg font-bold text-red-400 tabular-nums leading-none">{formattedImpact}</span>
          </div>
        )}

        {/* Footer row */}
        <div className="flex items-center justify-between pt-1">
          {timestamp && (
            <span className="text-[10px] text-slate-500 font-mono">{timestamp}</span>
          )}
          {!timestamp && <div />}

          {/* Actions */}
          <div className="flex items-center gap-2">
            {onDismiss && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onDismiss(id)}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
              >
                Dismiss
              </motion.button>
            )}
            {onApprove && status === 'under_review' && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onApprove(id)}
                className="text-xs font-semibold text-green-400 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 px-3 py-1 rounded-lg transition-colors"
              >
                Approve
              </motion.button>
            )}
            {onView && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onView(id)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-teal-400 bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/20 px-3 py-1 rounded-lg transition-colors"
              >
                <Eye className="w-3 h-3" />
                View
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
