import { useCallback, useEffect, useRef, useState } from 'react'

export interface ApiState<T> {
  data: T | null
  loading: boolean
  error: boolean
  reload: () => void
}

/**
 * Loads data and keeps three honest states apart: loading, failed, and loaded.
 * A failed request leaves `data` null, so a screen can show an error with a retry
 * and never falls back to stand-in values. Stale responses are ignored.
 */
export function useApi<T>(load: () => Promise<T>, deps: unknown[]): ApiState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [tick, setTick] = useState(0)
  const latest = useRef(0)

  useEffect(() => {
    const id = ++latest.current
    setLoading(true)
    setError(false)
    load()
      .then(result => { if (id === latest.current) setData(result) })
      .catch(() => { if (id === latest.current) { setError(true); setData(null) } })
      .finally(() => { if (id === latest.current) setLoading(false) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  const reload = useCallback(() => setTick(t => t + 1), [])
  return { data, loading, error, reload }
}
