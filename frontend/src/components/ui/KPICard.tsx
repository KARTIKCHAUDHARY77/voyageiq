import React, { useEffect, useRef, useState } from 'react'
import { motion, useSpring, useTransform, MotionValue } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

export type KPIColor = 'teal' | 'ocean' | 'amber' | 'green' | 'red' | 'purple'

export interface KPICardProps {
  title: string
  value: string | number
  unit?: string
  change?: number
  changeLabel?: string
  icon: React.ReactNode
  color: KPIColor
  loading?: boolean
  onClick?: () => void
}

// ─── Color Maps ───────────────────────────────────────────────────────────────

const colorMap: Record<KPIColor, {
  glow: string
  iconBg: string
  iconRing: string
  text: string
  badgeUp: string
  badgeDown: string
  glowShadow: string
}> = {
  teal: {
    glow: 'rgba(20,184,166,0.18)',
    iconBg: 'rgba(20,184,166,0.15)',
    iconRing: 'rgba(20,184,166,0.35)',
    text: '#14B8A6',
    badgeUp: 'bg-teal-500/20 text-teal-400',
    badgeDown: 'bg-red-500/20 text-red-400',
    glowShadow: '0 0 40px rgba(20,184,166,0.25)',
  },
  ocean: {
    glow: 'rgba(14,165,233,0.18)',
    iconBg: 'rgba(14,165,233,0.15)',
    iconRing: 'rgba(14,165,233,0.35)',
    text: '#0EA5E9',
    badgeUp: 'bg-ocean-500/20 text-ocean-400',
    badgeDown: 'bg-red-500/20 text-red-400',
    glowShadow: '0 0 40px rgba(14,165,233,0.25)',
  },
  amber: {
    glow: 'rgba(245,158,11,0.18)',
    iconBg: 'rgba(245,158,11,0.15)',
    iconRing: 'rgba(245,158,11,0.35)',
    text: '#F59E0B',
    badgeUp: 'bg-amber-500/20 text-amber-400',
    badgeDown: 'bg-red-500/20 text-red-400',
    glowShadow: '0 0 40px rgba(245,158,11,0.2)',
  },
  green: {
    glow: 'rgba(16,185,129,0.18)',
    iconBg: 'rgba(16,185,129,0.15)',
    iconRing: 'rgba(16,185,129,0.35)',
    text: '#10B981',
    badgeUp: 'bg-emerald-500/20 text-emerald-400',
    badgeDown: 'bg-red-500/20 text-red-400',
    glowShadow: '0 0 40px rgba(16,185,129,0.25)',
  },
  red: {
    glow: 'rgba(239,68,68,0.18)',
    iconBg: 'rgba(239,68,68,0.15)',
    iconRing: 'rgba(239,68,68,0.35)',
    text: '#EF4444',
    badgeUp: 'bg-green-500/20 text-green-400',
    badgeDown: 'bg-red-500/20 text-red-400',
    glowShadow: '0 0 40px rgba(239,68,68,0.25)',
  },
  purple: {
    glow: 'rgba(168,85,247,0.18)',
    iconBg: 'rgba(168,85,247,0.15)',
    iconRing: 'rgba(168,85,247,0.35)',
    text: '#A855F7',
    badgeUp: 'bg-purple-500/20 text-purple-400',
    badgeDown: 'bg-red-500/20 text-red-400',
    glowShadow: '0 0 40px rgba(168,85,247,0.25)',
  },
}

// ─── Animated Number ──────────────────────────────────────────────────────────

function AnimatedNumber({ value }: { value: number }) {
  const spring = useSpring(0, { stiffness: 60, damping: 15 })
  const display = useTransform(spring, (v) => v.toFixed(Number.isInteger(value) ? 0 : 1))

  useEffect(() => {
    spring.set(value)
  }, [value, spring])

  return <motion.span>{display}</motion.span>
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-lg bg-white/5 ${className}`}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.6s linear infinite',
        }}
      />
    </div>
  )
}

// ─── KPICard ─────────────────────────────────────────────────────────────────

export default function KPICard({
  title,
  value,
  unit,
  change,
  changeLabel,
  icon,
  color,
  loading = false,
  onClick,
}: KPICardProps) {
  const [hovered, setHovered] = useState(false)
  const palette = colorMap[color]
  const numericValue = typeof value === 'number' ? value : parseFloat(value)
  const isNumeric = !isNaN(numericValue)

  const TrendIcon =
    change === undefined || change === 0
      ? Minus
      : change > 0
      ? TrendingUp
      : TrendingDown

  const trendColor =
    change === undefined || change === 0
      ? 'text-slate-400'
      : change > 0
      ? 'text-emerald-400'
      : 'text-red-400'

  const trendBadge =
    change === undefined || change === 0
      ? 'bg-slate-500/20 text-slate-400'
      : change > 0
      ? palette.badgeUp
      : palette.badgeDown

  if (loading) {
    return (
      <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 shadow-card">
        <div className="flex items-start justify-between mb-4">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-11 w-11 rounded-full" />
        </div>
        <Skeleton className="h-8 w-32 mb-2" />
        <Skeleton className="h-4 w-20" />
      </div>
    )
  }

  return (
    <motion.div
      whileHover={{ scale: 1.025 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      onClick={onClick}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        boxShadow: hovered ? palette.glowShadow : '0 4px 24px rgba(0,0,0,0.4)',
      }}
      className="relative bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 overflow-hidden transition-shadow duration-300"
    >
      {/* Background glow blob */}
      <motion.div
        animate={{ opacity: hovered ? 1 : 0 }}
        transition={{ duration: 0.3 }}
        className="absolute -top-8 -right-8 w-32 h-32 rounded-full blur-3xl pointer-events-none"
        style={{ background: palette.glow }}
      />

      {/* Top row: title + icon */}
      <div className="relative flex items-start justify-between mb-4">
        <p className="text-sm font-medium text-slate-400 leading-tight pr-2">{title}</p>

        {/* Icon circle */}
        <motion.div
          animate={{ boxShadow: hovered ? `0 0 18px ${palette.iconRing}` : `0 0 0px transparent` }}
          transition={{ duration: 0.3 }}
          className="flex-shrink-0 flex items-center justify-center w-11 h-11 rounded-full"
          style={{
            background: palette.iconBg,
            border: `1px solid ${palette.iconRing}`,
          }}
        >
          <span style={{ color: palette.text }} className="w-5 h-5 [&>svg]:w-5 [&>svg]:h-5">
            {icon}
          </span>
        </motion.div>
      </div>

      {/* Value row */}
      <div className="relative flex items-end gap-1 mb-2">
        <span className="text-3xl font-bold text-white font-display leading-none tracking-tight">
          {isNumeric ? <AnimatedNumber value={numericValue} /> : value}
        </span>
        {unit && (
          <span className="text-base font-medium text-slate-400 mb-0.5">{unit}</span>
        )}
      </div>

      {/* Change badge */}
      {change !== undefined && (
        <div className="relative flex items-center gap-2 mt-1">
          <span
            className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${trendBadge}`}
          >
            <TrendIcon className="w-3 h-3" />
            {Math.abs(change)}%
          </span>
          {changeLabel && (
            <span className="text-xs text-slate-500">{changeLabel}</span>
          )}
        </div>
      )}
    </motion.div>
  )
}
