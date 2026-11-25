/**
 * One chart theme for the whole app. Colours come from the CSS design tokens, so changing a
 * token in index.css changes every chart. Call these inside components (they read the DOM).
 */
import type { ChartOptions } from 'chart.js'

const read = (name: string, alpha = 1) => {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  const [r, g, b] = raw.split(/\s+/)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function chartColors() {
  return {
    accent: read('--c-accent'),
    accentFill: read('--c-accent', 0.12),
    depth: read('--c-depth'),
    depthFill: read('--c-depth', 0.1),
    caution: read('--c-caution'),
    port: read('--c-port'),
    starboard: read('--c-starboard'),
    text: read('--c-fg-subtle'),
    grid: read('--c-line', 0.1),
    surface: read('--c-surface-2'),
    fg: read('--c-fg'),
    muted: read('--c-fg-muted'),
  }
}

/** A dashed horizontal reference line dataset, e.g. the warranted value. */
export function referenceLine(label: string, value: number, length: number) {
  const c = chartColors()
  return {
    label,
    data: Array.from({ length }, () => value),
    borderColor: c.caution,
    borderDash: [6, 4],
    borderWidth: 1.5,
    pointRadius: 0,
    pointHoverRadius: 0,
    fill: false,
    tension: 0,
  }
}

/**
 * Shared options: no intro animation (the data should just be there), light gridlines,
 * tabular numerals, and a tooltip that reads like the rest of the interface.
 */
export function baseChartOptions(opts: { unit?: string; legend?: boolean; stacked?: boolean } = {}): ChartOptions<any> {
  const c = chartColors()
  const font = { family: "'IBM Plex Mono', ui-monospace, monospace", size: 11 }
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: opts.legend === false ? { display: false } : {
        position: 'bottom',
        align: 'start',
        labels: { color: c.muted, boxWidth: 10, boxHeight: 10, usePointStyle: true, font: { family: "'IBM Plex Sans', sans-serif", size: 12 } },
      },
      tooltip: {
        backgroundColor: c.surface,
        titleColor: c.fg,
        bodyColor: c.muted,
        borderColor: read('--c-line', 0.26),
        borderWidth: 1,
        padding: 10,
        cornerRadius: 6,
        titleFont: font,
        bodyFont: font,
        callbacks: opts.unit
          ? { label: (ctx: any) => `${ctx.dataset.label}: ${ctx.formattedValue} ${opts.unit}` }
          : undefined,
      },
    },
    scales: {
      x: { stacked: opts.stacked, ticks: { color: c.text, font }, grid: { display: false }, border: { color: c.grid } },
      y: { stacked: opts.stacked, ticks: { color: c.text, font }, grid: { color: c.grid }, border: { display: false } },
    },
  }
}
