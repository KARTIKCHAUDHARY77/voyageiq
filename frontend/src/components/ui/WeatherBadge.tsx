import React from 'react'
import { motion } from 'framer-motion'
import { Wind, Waves } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WeatherBadgeProps {
  beaufort: number       // 0-12
  windSpeedKnots?: number
  waveHeightM?: number
  windDirection?: number // degrees (0=N, 90=E, 180=S, 270=W)
  compact?: boolean
}

// ─── Beaufort Scale Data ──────────────────────────────────────────────────────

const BEAUFORT_SCALE: Record<number, { description: string; sea: string }> = {
  0: { description: 'Calm', sea: 'Mirror-like' },
  1: { description: 'Light Air', sea: 'Ripples' },
  2: { description: 'Light Breeze', sea: 'Small wavelets' },
  3: { description: 'Gentle Breeze', sea: 'Large wavelets' },
  4: { description: 'Moderate Breeze', sea: 'Small waves' },
  5: { description: 'Fresh Breeze', sea: 'Moderate waves' },
  6: { description: 'Strong Breeze', sea: 'Large waves' },
  7: { description: 'High Wind', sea: 'White foam streaks' },
  8: { description: 'Gale', sea: 'Moderately high waves' },
  9: { description: 'Strong Gale', sea: 'High waves' },
  10: { description: 'Storm', sea: 'Very high waves' },
  11: { description: 'Violent Storm', sea: 'Extremely high waves' },
  12: { description: 'Hurricane', sea: 'Air filled with foam' },
}

// ─── Color scheme ─────────────────────────────────────────────────────────────

function getBeaufortColor(bf: number): {
  bg: string
  border: string
  text: string
  glow: string
  label: string
} {
  if (bf <= 3)
    return {
      bg: 'rgba(16,185,129,0.12)',
      border: 'rgba(16,185,129,0.4)',
      text: '#10B981',
      glow: 'rgba(16,185,129,0.25)',
      label: 'Safe',
    }
  if (bf <= 5)
    return {
      bg: 'rgba(234,179,8,0.12)',
      border: 'rgba(234,179,8,0.4)',
      text: '#EAB308',
      glow: 'rgba(234,179,8,0.2)',
      label: 'Caution',
    }
  if (bf <= 7)
    return {
      bg: 'rgba(249,115,22,0.12)',
      border: 'rgba(249,115,22,0.4)',
      text: '#F97316',
      glow: 'rgba(249,115,22,0.25)',
      label: 'Warning',
    }
  return {
    bg: 'rgba(239,68,68,0.12)',
    border: 'rgba(239,68,68,0.4)',
    text: '#EF4444',
    glow: 'rgba(239,68,68,0.3)',
    label: 'Danger',
  }
}

function compassLabel(deg: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
  const idx = Math.round(deg / 22.5) % 16
  return dirs[idx]
}

// ─── Compact variant ──────────────────────────────────────────────────────────

function CompactBadge({ beaufort, windSpeedKnots, windDirection }: WeatherBadgeProps) {
  const bf = Math.min(12, Math.max(0, Math.round(beaufort)))
  const colors = getBeaufortColor(bf)
  const info = BEAUFORT_SCALE[bf]

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border"
      style={{
        background: colors.bg,
        borderColor: colors.border,
        boxShadow: `0 0 12px ${colors.glow}`,
      }}
    >
      {/* Wind direction arrow */}
      {windDirection !== undefined && (
        <motion.div
          animate={{ rotate: windDirection }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          style={{ color: colors.text }}
        >
          <Wind className="w-3.5 h-3.5" />
        </motion.div>
      )}

      <span className="text-xs font-bold tabular-nums" style={{ color: colors.text }}>
        BF {bf}
      </span>
      <span className="text-xs text-slate-400">{info.description}</span>
      {windSpeedKnots !== undefined && (
        <span className="text-xs font-semibold text-slate-300 tabular-nums">{windSpeedKnots} kn</span>
      )}
    </motion.div>
  )
}

// ─── Full card variant ────────────────────────────────────────────────────────

export default function WeatherBadge({
  beaufort,
  windSpeedKnots,
  waveHeightM,
  windDirection,
  compact = false,
}: WeatherBadgeProps) {
  const bf = Math.min(12, Math.max(0, Math.round(beaufort)))
  const colors = getBeaufortColor(bf)
  const info = BEAUFORT_SCALE[bf]

  if (compact) {
    return (
      <CompactBadge
        beaufort={beaufort}
        windSpeedKnots={windSpeedKnots}
        windDirection={windDirection}
      />
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden p-4"
      style={{ boxShadow: `0 4px 24px rgba(0,0,0,0.4), 0 0 30px ${colors.glow}` }}
    >
      {/* Glow backdrop */}
      <div
        className="absolute inset-0 pointer-events-none rounded-2xl"
        style={{ background: `radial-gradient(ellipse at top right, ${colors.bg} 0%, transparent 70%)` }}
      />

      {/* Header: BF number + status */}
      <div className="relative flex items-start justify-between mb-3">
        <div>
          <div className="flex items-baseline gap-2">
            <span
              className="text-4xl font-black font-display leading-none"
              style={{ color: colors.text, textShadow: `0 0 20px ${colors.glow}` }}
            >
              {bf}
            </span>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider leading-tight">
                Beaufort
              </p>
              <p className="text-sm font-bold text-white leading-tight">{info.description}</p>
            </div>
          </div>
        </div>

        {/* Risk label pill */}
        <span
          className="text-xs font-bold px-3 py-1 rounded-full"
          style={{
            background: colors.bg,
            color: colors.text,
            border: `1px solid ${colors.border}`,
          }}
        >
          {colors.label}
        </span>
      </div>

      {/* Sea state */}
      <p className="relative text-xs text-slate-400 mb-3 italic">{info.sea}</p>

      {/* Stats row */}
      <div className="relative flex items-center gap-4">
        {/* Wind */}
        <div className="flex items-center gap-2 flex-1">
          <motion.div
            animate={{ rotate: windDirection ?? 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: colors.bg, border: `1px solid ${colors.border}` }}
          >
            <Wind className="w-4 h-4" style={{ color: colors.text }} />
          </motion.div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider leading-tight">Wind</p>
            <p className="text-sm font-bold text-white leading-tight tabular-nums">
              {windSpeedKnots !== undefined ? `${windSpeedKnots} kn` : '—'}
            </p>
            {windDirection !== undefined && (
              <p className="text-[10px] text-slate-400">{compassLabel(windDirection)} ({windDirection}°)</p>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="h-12 w-px bg-white/10" />

        {/* Wave height */}
        <div className="flex items-center gap-2 flex-1">
          <div
            className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(14,165,233,0.12)', border: '1px solid rgba(14,165,233,0.3)' }}
          >
            <Waves className="w-4 h-4 text-ocean-400" />
          </div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider leading-tight">Wave Height</p>
            <p className="text-sm font-bold text-white leading-tight tabular-nums">
              {waveHeightM !== undefined ? `${waveHeightM.toFixed(1)} m` : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Beaufort scale mini-bar */}
      <div className="relative mt-3 pt-3 border-t border-white/5">
        <div className="flex items-center gap-0.5">
          {Array.from({ length: 13 }, (_, i) => (
            <div
              key={i}
              className="flex-1 h-1.5 rounded-full transition-all duration-500"
              style={{
                background: i <= bf
                  ? i <= 3 ? '#10B981' : i <= 5 ? '#EAB308' : i <= 7 ? '#F97316' : '#EF4444'
                  : 'rgba(255,255,255,0.08)',
                transform: i === bf ? 'scaleY(1.8)' : 'scaleY(1)',
              }}
            />
          ))}
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[9px] text-slate-600">0</span>
          <span className="text-[9px] text-slate-600">12</span>
        </div>
      </div>
    </motion.div>
  )
}
