import React from 'react'
import { AlertTriangle, CheckCircle2, Circle, Info, XOctagon } from 'lucide-react'

export type Tone = 'ok' | 'warn' | 'alert' | 'info' | 'neutral'

const STYLE: Record<Tone, { cls: string; icon: React.ReactNode }> = {
  ok: { cls: 'text-signal-starboard bg-signal-starboard/10 border-signal-starboard/25', icon: <CheckCircle2 size={12} aria-hidden /> },
  warn: { cls: 'text-signal-caution bg-signal-caution/10 border-signal-caution/25', icon: <AlertTriangle size={12} aria-hidden /> },
  alert: { cls: 'text-signal-port bg-signal-port/10 border-signal-port/25', icon: <XOctagon size={12} aria-hidden /> },
  info: { cls: 'text-signal-depth bg-signal-depth/10 border-signal-depth/25', icon: <Info size={12} aria-hidden /> },
  neutral: { cls: 'text-fg-muted bg-fg/5 border-line-strong', icon: <Circle size={10} aria-hidden /> },
}

/** Status is always colour plus an icon plus text, so it survives colour-blindness and greyscale. */
export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: React.ReactNode }) {
  const s = STYLE[tone]
  return (
    <span className={`inline-flex items-center gap-1 h-5 px-1.5 rounded-ctl border text-meta font-medium ${s.cls}`}>
      {s.icon}
      {children}
    </span>
  )
}
