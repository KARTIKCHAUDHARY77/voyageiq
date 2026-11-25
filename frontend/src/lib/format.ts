/** Number formatting for display. Every function returns null for missing values so <Stat> shows a dash. */

export function num(value: number | null | undefined, digits = 0): string | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null
  return value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

export function usd(value: number | null | undefined): string | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (abs >= 10_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

export function pct(value: number | null | undefined, digits = 0): string | null {
  const n = num(value, digits)
  return n === null ? null : n
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return '–'
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso)
  return Number.isNaN(d.getTime()) ? '–' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function longDate(iso: string | null | undefined): string {
  if (!iso) return '–'
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso)
  return Number.isNaN(d.getTime()) ? '–' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
