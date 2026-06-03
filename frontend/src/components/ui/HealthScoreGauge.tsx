// VoyageIQ AI — Maritime Intelligence Platform
// Copyright (c) 2024 Kartik Chaudhary. All Rights Reserved.
// Unauthorized copying or use of this file is strictly prohibited.
// Contact: 2512520007@geu.ac.in
import React, { useEffect, useRef, useState } from 'react'
import { motion, useSpring, useTransform } from 'framer-motion'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HealthScoreBreakdown {
  fuel_efficiency: number
  speed_compliance: number
  weather_handling: number
  operational: number
}

export interface HealthScoreGaugeProps {
  score: number // 0-100
  size?: 'sm' | 'md' | 'lg'
  showBreakdown?: boolean
  breakdown?: HealthScoreBreakdown
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGrade(score: number): { label: string; color: string; trackColor: string } {
  if (score >= 90) return { label: 'Excellent', color: '#10B981', trackColor: 'rgba(16,185,129,0.15)' }
  if (score >= 70) return { label: 'Good', color: '#14B8A6', trackColor: 'rgba(20,184,166,0.15)' }
  if (score >= 50) return { label: 'Average', color: '#F59E0B', trackColor: 'rgba(245,158,11,0.15)' }
  return { label: 'Poor', color: '#EF4444', trackColor: 'rgba(239,68,68,0.15)' }
}

const sizeMap = {
  sm: { svgSize: 120, cx: 60, cy: 60, r: 48, stroke: 8, textSize: 'text-xl', labelSize: 'text-xs' },
  md: { svgSize: 180, cx: 90, cy: 90, r: 72, stroke: 10, textSize: 'text-3xl', labelSize: 'text-sm' },
  lg: { svgSize: 240, cx: 120, cy: 120, r: 96, stroke: 12, textSize: 'text-5xl', labelSize: 'text-base' },
}

// Convert progress (0-1) to SVG arc dash offset
function dashOffset(progress: number, circumference: number, startAngle = -225, totalAngle = 270) {
  const fraction = (totalAngle / 360) * progress
  return circumference * (1 - fraction)
}

// ─── Mini Sub-Arc ─────────────────────────────────────────────────────────────

interface MiniArcProps {
  score: number
  label: string
  color: string
  size: number
  index: number
  total: number
}

function MiniArc({ score, label, color }: { score: number; label: string; color: string }) {
  const r = 22
  const circ = 2 * Math.PI * r
  // 270° arc starting from -225° (bottom-left)
  const arcLen = circ * (270 / 360)
  const filled = arcLen * (score / 100)

  return (
    <div className="flex flex-col items-center gap-1 min-w-0">
      <svg width={56} height={56} viewBox="0 0 56 56">
        {/* Track */}
        <circle
          cx={28} cy={28} r={r}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={5}
          strokeDasharray={`${arcLen} ${circ}`}
          strokeLinecap="round"
          transform="rotate(135 28 28)"
        />
        {/* Fill */}
        <motion.circle
          cx={28} cy={28} r={r}
          fill="none"
          stroke={color}
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={`${arcLen} ${circ}`}
          strokeDashoffset={arcLen - filled}
          transform="rotate(135 28 28)"
          initial={{ strokeDashoffset: arcLen }}
          animate={{ strokeDashoffset: arcLen - filled }}
          transition={{ duration: 1.2, delay: 0.6, ease: 'easeOut' }}
        />
        <text
          x={28} y={32}
          textAnchor="middle"
          fontSize={11}
          fontWeight="700"
          fill="white"
          fontFamily="Inter, sans-serif"
        >
          {score}
        </text>
      </svg>
      <span className="text-[10px] text-slate-400 text-center leading-tight max-w-[60px]">{label}</span>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function HealthScoreGauge({
  score,
  size = 'md',
  showBreakdown = false,
  breakdown,
}: HealthScoreGaugeProps) {
  const clampedScore = Math.min(100, Math.max(0, score))
  const { label, color, trackColor } = getGrade(clampedScore)
  const dims = sizeMap[size]
  const { svgSize, cx, cy, r, stroke } = dims

  const circumference = 2 * Math.PI * r
  const arcLength = circumference * (270 / 360)
  const filled = arcLength * (clampedScore / 100)
  const offset = arcLength - filled

  // Animated displayed score
  const spring = useSpring(0, { stiffness: 50, damping: 15 })
  const displayed = useTransform(spring, (v) => Math.round(v))
  const [displayNum, setDisplayNum] = useState(0)

  useEffect(() => {
    spring.set(clampedScore)
    const unsub = displayed.on('change', (v) => setDisplayNum(v))
    return unsub
  }, [clampedScore])

  const breakdownItems = breakdown
    ? [
        { label: 'Fuel Efficiency', score: breakdown.fuel_efficiency, color: '#14B8A6' },
        { label: 'Speed Compliance', score: breakdown.speed_compliance, color: '#0EA5E9' },
        { label: 'Weather Handling', score: breakdown.weather_handling, color: '#F59E0B' },
        { label: 'Operational', score: breakdown.operational, color: '#A855F7' },
      ]
    : []

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Main Gauge */}
      <div className="relative flex items-center justify-center">
        <svg
          width={svgSize}
          height={svgSize}
          viewBox={`0 0 ${svgSize} ${svgSize}`}
          style={{ overflow: 'visible' }}
        >
          {/* Outer glow ring */}
          <circle
            cx={cx} cy={cy} r={r + stroke / 2 + 2}
            fill="none"
            stroke={trackColor}
            strokeWidth={stroke + 8}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeLinecap="round"
            transform={`rotate(135 ${cx} ${cy})`}
          />
          {/* Track arc */}
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth={stroke}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeLinecap="round"
            transform={`rotate(135 ${cx} ${cy})`}
          />
          {/* Filled arc */}
          <motion.circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeDashoffset={offset}
            transform={`rotate(135 ${cx} ${cy})`}
            style={{
              filter: `drop-shadow(0 0 8px ${color})`,
            }}
            initial={{ strokeDashoffset: arcLength }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.4, ease: 'easeOut' }}
          />

          {/* Center score */}
          <text
            x={cx} y={cy - (size === 'sm' ? 4 : size === 'md' ? 6 : 8)}
            textAnchor="middle"
            fontSize={size === 'sm' ? 22 : size === 'md' ? 36 : 52}
            fontWeight="800"
            fill="white"
            fontFamily="Outfit, Inter, sans-serif"
          >
            {displayNum}
          </text>

          {/* /100 label */}
          <text
            x={cx} y={cy + (size === 'sm' ? 10 : size === 'md' ? 14 : 18)}
            textAnchor="middle"
            fontSize={size === 'sm' ? 9 : size === 'md' ? 11 : 14}
            fill="rgba(255,255,255,0.4)"
            fontFamily="Inter, sans-serif"
          >
            / 100
          </text>

          {/* Grade label */}
          <text
            x={cx} y={cy + (size === 'sm' ? 22 : size === 'md' ? 30 : 40)}
            textAnchor="middle"
            fontSize={size === 'sm' ? 9 : size === 'md' ? 12 : 15}
            fontWeight="600"
            fill={color}
            fontFamily="Inter, sans-serif"
          >
            {label}
          </text>

          {/* Min / Max labels */}
          <text
            x={cx - r * Math.cos((225 * Math.PI) / 180) - (size === 'sm' ? 2 : 4)}
            y={cy + r * Math.sin((225 * Math.PI) / 180) + (size === 'sm' ? 4 : 6)}
            textAnchor="middle"
            fontSize={size === 'sm' ? 8 : 10}
            fill="rgba(255,255,255,0.3)"
            fontFamily="Inter, sans-serif"
          >
            0
          </text>
          <text
            x={cx + r * Math.cos((45 * Math.PI) / 180) + (size === 'sm' ? 2 : 4)}
            y={cy + r * Math.sin((45 * Math.PI) / 180) + (size === 'sm' ? 4 : 6)}
            textAnchor="middle"
            fontSize={size === 'sm' ? 8 : 10}
            fill="rgba(255,255,255,0.3)"
            fontFamily="Inter, sans-serif"
          >
            100
          </text>
        </svg>
      </div>

      {/* Breakdown sub-arcs */}
      {showBreakdown && breakdown && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="flex items-start gap-4 flex-wrap justify-center"
        >
          {breakdownItems.map((item) => (
            <MiniArc
              key={item.label}
              label={item.label}
              score={item.score}
              color={item.color}
            />
          ))}
        </motion.div>
      )}
    </div>
  )
}
