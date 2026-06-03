// VoyageIQ AI — Maritime Intelligence Platform
// Copyright (c) 2024 Kartik Chaudhary. All Rights Reserved.
// Unauthorized copying or use of this file is strictly prohibited.
// Contact: 2512520007@geu.ac.in
import React, { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Polyline, Circle, Marker, Popup, useMap, LayersControl } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VesselPosition {
  lat: number
  lon: number
  timestamp?: string
  speed?: number
}

export interface RouteLayer {
  points: [number, number][]
  color: string
  type: string
}

export interface RiskZone {
  center: [number, number]
  radius: number  // metres
  color: string
  level: string
}

export interface VesselMarker {
  id: string
  name: string
  lat: number
  lon: number
  speed?: number
  heading?: number
}

export interface VoyageMapProps {
  positions?: VesselPosition[]
  routes?: RouteLayer[]
  riskZones?: RiskZone[]
  vessels?: VesselMarker[]
  height?: string
  showControls?: boolean
}

// ─── SVG Ship Icon Factory ────────────────────────────────────────────────────

function createVesselIcon(heading = 0) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <g transform="translate(16,16) rotate(${heading})">
        <!-- Glow backdrop -->
        <circle cx="0" cy="0" r="14" fill="rgba(20,184,166,0.15)" stroke="rgba(20,184,166,0.4)" stroke-width="1"/>
        <!-- Ship body -->
        <path d="M0,-10 L5,6 L0,4 L-5,6 Z" fill="#14B8A6" stroke="#0D9488" stroke-width="1" stroke-linejoin="round"/>
        <!-- Bow detail -->
        <circle cx="0" cy="-10" r="1.5" fill="#2DD4BF"/>
      </g>
    </svg>`

  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  })
}

// ─── Bounds Fitter ────────────────────────────────────────────────────────────

function FitBounds({
  positions,
  vessels,
}: {
  positions: VesselPosition[]
  vessels: VesselMarker[]
}) {
  const map = useMap()

  useEffect(() => {
    const allPoints: [number, number][] = [
      ...positions.map((p) => [p.lat, p.lon] as [number, number]),
      ...vessels.map((v) => [v.lat, v.lon] as [number, number]),
    ]
    if (allPoints.length > 0) {
      const bounds = L.latLngBounds(allPoints)
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 10 })
    }
  }, [positions, vessels, map])

  return null
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function VoyageMap({
  positions = [],
  routes = [],
  riskZones = [],
  vessels = [],
  height = '480px',
  showControls = true,
}: VoyageMapProps) {
  const trackPoints: [number, number][] = positions.map((p) => [p.lat, p.lon])

  const defaultCenter: [number, number] =
    positions.length > 0
      ? [positions[Math.floor(positions.length / 2)].lat, positions[Math.floor(positions.length / 2)].lon]
      : vessels.length > 0
      ? [vessels[0].lat, vessels[0].lon]
      : [20, 0]

  const riskColorMap: Record<string, { fill: string; stroke: string }> = {
    high: { fill: 'rgba(239,68,68,0.12)', stroke: '#EF4444' },
    medium: { fill: 'rgba(245,158,11,0.12)', stroke: '#F59E0B' },
    low: { fill: 'rgba(20,184,166,0.12)', stroke: '#14B8A6' },
    storm: { fill: 'rgba(168,85,247,0.12)', stroke: '#A855F7' },
  }

  return (
    <div
      className="relative rounded-2xl overflow-hidden border border-white/10 shadow-card"
      style={{ height }}
    >
      {/* Map overlay gradient */}
      <div className="absolute top-0 left-0 right-0 h-12 z-10 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, rgba(2,11,24,0.6), transparent)' }}
      />

      <MapContainer
        center={defaultCenter}
        zoom={4}
        style={{ height: '100%', width: '100%', background: '#020B18' }}
        zoomControl={showControls}
        attributionControl={false}
      >
        {/* Dark CartoDB basemap */}
        {showControls ? (
          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="Dark (Maritime)">
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                subdomains="abcd"
                maxZoom={19}
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Nautical">
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
                subdomains="abcd"
                maxZoom={19}
              />
            </LayersControl.BaseLayer>

            {/* Risk Zones overlay toggle */}
            {riskZones.length > 0 && (
              <LayersControl.Overlay checked name="Risk Zones">
                <>
                  {riskZones.map((zone, i) => {
                    const colors = riskColorMap[zone.level] ?? { fill: 'rgba(239,68,68,0.12)', stroke: '#EF4444' }
                    return (
                      <Circle
                        key={i}
                        center={zone.center}
                        radius={zone.radius}
                        pathOptions={{
                          fillColor: colors.fill,
                          fillOpacity: 1,
                          color: colors.stroke,
                          weight: 1.5,
                          opacity: 0.8,
                          dashArray: '5 4',
                        }}
                      >
                        <Popup>
                          <div className="text-xs">
                            <strong>Risk Zone</strong><br />
                            Level: <span style={{ color: colors.stroke }}>{zone.level.toUpperCase()}</span><br />
                            Radius: {(zone.radius / 1000).toFixed(0)} km
                          </div>
                        </Popup>
                      </Circle>
                    )
                  })}
                </>
              </LayersControl.Overlay>
            )}

            {/* Vessel Track overlay toggle */}
            {trackPoints.length > 1 && (
              <LayersControl.Overlay checked name="Vessel Track">
                <Polyline
                  positions={trackPoints}
                  pathOptions={{
                    color: '#14B8A6',
                    weight: 2.5,
                    opacity: 0.85,
                    dashArray: undefined,
                  }}
                />
              </LayersControl.Overlay>
            )}
          </LayersControl>
        ) : (
          <>
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              subdomains="abcd"
              maxZoom={19}
            />
            {riskZones.map((zone, i) => {
              const colors = riskColorMap[zone.level] ?? { fill: 'rgba(239,68,68,0.12)', stroke: '#EF4444' }
              return (
                <Circle
                  key={i}
                  center={zone.center}
                  radius={zone.radius}
                  pathOptions={{
                    fillColor: colors.fill,
                    fillOpacity: 1,
                    color: colors.stroke,
                    weight: 1.5,
                    opacity: 0.8,
                    dashArray: '5 4',
                  }}
                />
              )
            })}
            {trackPoints.length > 1 && (
              <Polyline
                positions={trackPoints}
                pathOptions={{ color: '#14B8A6', weight: 2.5, opacity: 0.85 }}
              />
            )}
          </>
        )}

        {/* Additional route layers */}
        {routes.map((route, i) => (
          <Polyline
            key={`route-${i}`}
            positions={route.points}
            pathOptions={{
              color: route.color,
              weight: 2,
              opacity: 0.7,
              dashArray: '8 5',
            }}
          />
        ))}

        {/* Start marker (first position) */}
        {trackPoints.length > 0 && (
          <Marker
            position={trackPoints[0]}
            icon={L.divIcon({
              html: `<div style="width:10px;height:10px;border-radius:50%;background:#10B981;border:2px solid #fff;box-shadow:0 0 8px rgba(16,185,129,0.8)"></div>`,
              className: '',
              iconSize: [10, 10],
              iconAnchor: [5, 5],
            })}
          >
            <Popup>
              <span className="text-xs font-medium">Departure Point</span>
              {positions[0]?.timestamp && <><br /><span className="text-xs text-slate-400">{positions[0].timestamp}</span></>}
            </Popup>
          </Marker>
        )}

        {/* End marker (last position) */}
        {trackPoints.length > 1 && (
          <Marker
            position={trackPoints[trackPoints.length - 1]}
            icon={L.divIcon({
              html: `<div style="width:10px;height:10px;border-radius:50%;background:#EF4444;border:2px solid #fff;box-shadow:0 0 8px rgba(239,68,68,0.8)"></div>`,
              className: '',
              iconSize: [10, 10],
              iconAnchor: [5, 5],
            })}
          >
            <Popup>
              <span className="text-xs font-medium">Arrival Point</span>
            </Popup>
          </Marker>
        )}

        {/* Vessel markers */}
        {vessels.map((vessel) => (
          <Marker
            key={vessel.id}
            position={[vessel.lat, vessel.lon]}
            icon={createVesselIcon(vessel.heading ?? 0)}
          >
            <Popup>
              <div style={{ minWidth: 150 }}>
                <p style={{ fontWeight: 700, marginBottom: 4, color: '#14B8A6' }}>{vessel.name}</p>
                <p style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>ID: {vessel.id}</p>
                {vessel.speed !== undefined && (
                  <p style={{ fontSize: 11, color: '#94a3b8' }}>Speed: <strong style={{ color: '#e2e8f0' }}>{vessel.speed} kn</strong></p>
                )}
                <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                  {vessel.lat.toFixed(4)}°N / {vessel.lon.toFixed(4)}°E
                </p>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Auto-fit bounds */}
        <FitBounds positions={positions} vessels={vessels} />
      </MapContainer>

      {/* Legend */}
      {riskZones.length > 0 && (
        <div className="absolute bottom-4 left-4 z-20 bg-navy-900/90 backdrop-blur-sm border border-white/10 rounded-xl p-3 text-xs space-y-1.5">
          <p className="font-semibold text-slate-300 mb-2">Legend</p>
          {trackPoints.length > 1 && (
            <div className="flex items-center gap-2">
              <div className="w-6 h-0.5 bg-teal-500" />
              <span className="text-slate-400">Vessel Track</span>
            </div>
          )}
          {Object.entries({ high: '#EF4444', medium: '#F59E0B', low: '#14B8A6', storm: '#A855F7' }).map(([level, color]) => (
            riskZones.some(z => z.level === level) && (
              <div key={level} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm border" style={{ background: `${color}20`, borderColor: color }} />
                <span className="text-slate-400 capitalize">{level} risk</span>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  )
}
