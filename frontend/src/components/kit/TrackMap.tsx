import React, { useEffect } from 'react'
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'
import type { LatLngBoundsExpression } from 'leaflet'

export interface TrackPoint { lat: number; lon: number; label?: string }

function Fit({ bounds }: { bounds: LatLngBoundsExpression }) {
  const map = useMap()
  useEffect(() => { map.fitBounds(bounds, { padding: [28, 28], maxZoom: 7 }) }, [map, bounds])
  return null
}

/**
 * A vessel track drawn from reported noon positions. Points are joined in report order, so the line is
 * the path between reports, not a navigated route. Open circle = first report, filled = latest.
 */
export function TrackMap({ points, label, className = 'h-72' }: { points: TrackPoint[]; label: string; className?: string }) {
  const valid = points.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon))
  if (valid.length === 0) return null
  const path = valid.map(p => [p.lat, p.lon] as [number, number])
  const first = valid[0]
  const last = valid[valid.length - 1]
  const bounds = path as LatLngBoundsExpression

  return (
    <div className={`relative w-full min-w-0 overflow-hidden rounded-ctl border border-line track-map ${className}`} role="img" aria-label={label}>
      <MapContainer center={[last.lat, last.lon]} zoom={4} scrollWheelZoom={false} className="h-full w-full" attributionControl>
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
          maxZoom={18}
        />
        <Fit bounds={bounds} />
        {path.length > 1 && <Polyline positions={path} pathOptions={{ color: '#2bb3a3', weight: 2.5, opacity: 0.9 }} />}
        {path.map((p, i) => (
          <CircleMarker key={i} center={p} radius={i === path.length - 1 ? 6 : 2.5}
            pathOptions={{ color: '#2bb3a3', weight: i === 0 || i === path.length - 1 ? 2 : 1, fillColor: i === 0 ? '#0b1626' : '#2bb3a3', fillOpacity: 1 }}>
            {valid[i].label && (i === 0 || i === path.length - 1) && <Tooltip direction="top">{valid[i].label}</Tooltip>}
          </CircleMarker>
        ))}
        <CircleMarker center={[first.lat, first.lon]} radius={0} pathOptions={{ opacity: 0 }} />
      </MapContainer>
    </div>
  )
}
