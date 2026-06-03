import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend } from 'chart.js'
import { Bar, Doughnut } from 'react-chartjs-2'
import { Wind, Waves, ArrowUp, ArrowDown, ArrowRight, Navigation2, Fuel, Clock, AlertTriangle, TrendingUp, TrendingDown, Zap } from 'lucide-react'
import { analyticsAPI } from '../services/api'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend)

const BEAUFORT = [
  { scale: 0, label: 'Calm', speed: '< 1 kts', desc: 'Sea like mirror', severity: 'low', wave: '0 m' },
  { scale: 1, label: 'Light Air', speed: '1-3 kts', desc: 'Ripples without crests', severity: 'low', wave: '0.1 m' },
  { scale: 2, label: 'Light Breeze', speed: '4-6 kts', desc: 'Small wavelets', severity: 'low', wave: '0.2 m' },
  { scale: 3, label: 'Gentle Breeze', speed: '7-10 kts', desc: 'Large wavelets, scattered whitecaps', severity: 'low', wave: '0.6 m' },
  { scale: 4, label: 'Moderate Breeze', speed: '11-16 kts', desc: 'Small waves, frequent whitecaps', severity: 'moderate', wave: '1 m' },
  { scale: 5, label: 'Fresh Breeze', speed: '17-21 kts', desc: 'Moderate waves, many whitecaps', severity: 'moderate', wave: '2 m' },
  { scale: 6, label: 'Strong Breeze', speed: '22-27 kts', desc: 'Large waves, whitecaps everywhere', severity: 'high', wave: '3 m' },
  { scale: 7, label: 'Near Gale', speed: '28-33 kts', desc: 'Sea heaps up, foam streaks', severity: 'high', wave: '4 m' },
  { scale: 8, label: 'Gale', speed: '34-40 kts', desc: 'High waves, crests break', severity: 'critical', wave: '5.5 m' },
  { scale: 9, label: 'Strong Gale', speed: '41-47 kts', desc: 'Very high waves, dense foam', severity: 'critical', wave: '7 m' },
  { scale: 10, label: 'Storm', speed: '48-55 kts', desc: 'Exceptionally high waves', severity: 'critical', wave: '9 m' },
  { scale: 11, label: 'Violent Storm', speed: '56-63 kts', desc: 'Exceptionally high waves', severity: 'critical', wave: '11.5 m' },
  { scale: 12, label: 'Hurricane', speed: '> 64 kts', desc: 'Air filled with foam/spray', severity: 'critical', wave: '14+ m' },
]

const SEVERITY_COLOR: Record<string, string> = {
  low: 'bg-green-500/20 text-green-400 border-green-500/30',
  moderate: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
}

interface WeatherScenario {
  windSpeed: number
  windDir: 'head' | 'tail' | 'cross'
  waveHeight: number
  currentSpeed: number
  currentFavorable: boolean
  baseSpeed: number
  baseFuel: number
}

function WindImpactCard({ scenario }: { scenario: WeatherScenario }) {
  const { windSpeed, windDir, waveHeight, currentSpeed, currentFavorable, baseSpeed, baseFuel } = scenario

  // Calculations
  const beaufort = windSpeed < 1 ? 0 : windSpeed < 4 ? 1 : windSpeed < 7 ? 2 : windSpeed < 11 ? 3
    : windSpeed < 17 ? 4 : windSpeed < 22 ? 5 : windSpeed < 28 ? 6 : windSpeed < 34 ? 7
    : windSpeed < 41 ? 8 : windSpeed < 48 ? 9 : 10

  const headwindSpeedLoss = windDir === 'head' ? (windSpeed / 40) ** 2 * baseSpeed * 0.15 : 0
  const tailwindSpeedGain = windDir === 'tail' ? (windSpeed / 60) * baseSpeed * 0.08 : 0
  const crosswindPenalty = windDir === 'cross' ? (windSpeed / 50) ** 2 * baseSpeed * 0.05 : 0
  const wavePenalty = waveHeight > 1 ? (waveHeight - 1) * 0.4 : 0
  const currentEffect = currentFavorable ? currentSpeed * 0.8 : -currentSpeed * 0.8

  const adjustedSpeed = Math.max(3, baseSpeed - headwindSpeedLoss - crosswindPenalty - wavePenalty + currentEffect + tailwindSpeedGain)
  const windFuelPenalty = windDir === 'head' ? baseFuel * (windSpeed / 100) ** 2 * 0.6 : windDir === 'cross' ? baseFuel * (windSpeed / 120) ** 2 * 0.3 : -baseFuel * (windSpeed / 150)
  const waveFuelPenalty = waveHeight > 1 ? baseFuel * (waveHeight / 10) : 0
  const currentFuelImpact = currentFavorable ? -baseFuel * (currentSpeed / 20) : baseFuel * (currentSpeed / 15)
  const totalFuel = baseFuel + windFuelPenalty + waveFuelPenalty + currentFuelImpact
  const fuelChange = totalFuel - baseFuel

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className={`p-3 rounded-xl border ${windFuelPenalty > 0 ? 'bg-red-500/5 border-red-500/20' : 'bg-green-500/5 border-green-500/20'}`}>
          <div className="flex items-center gap-2 mb-1">
            <Wind size={14} className={windFuelPenalty > 0 ? 'text-red-400' : 'text-green-400'} />
            <span className="text-xs text-navy-400">Wind Impact</span>
          </div>
          <p className={`text-lg font-bold ${windFuelPenalty > 0 ? 'text-red-400' : 'text-green-400'}`}>
            {windFuelPenalty > 0 ? '+' : ''}{windFuelPenalty.toFixed(2)} MT/d
          </p>
          <p className="text-xs text-navy-500 mt-0.5">Beaufort {beaufort}</p>
        </div>

        <div className={`p-3 rounded-xl border ${waveFuelPenalty > 0 ? 'bg-orange-500/5 border-orange-500/20' : 'bg-green-500/5 border-green-500/20'}`}>
          <div className="flex items-center gap-2 mb-1">
            <Waves size={14} className={waveFuelPenalty > 0 ? 'text-orange-400' : 'text-teal-400'} />
            <span className="text-xs text-navy-400">Wave Impact</span>
          </div>
          <p className={`text-lg font-bold ${waveFuelPenalty > 0 ? 'text-orange-400' : 'text-teal-400'}`}>
            {waveFuelPenalty > 0 ? '+' : ''}{waveFuelPenalty.toFixed(2)} MT/d
          </p>
          <p className="text-xs text-navy-500 mt-0.5">H={waveHeight}m</p>
        </div>

        <div className={`p-3 rounded-xl border ${currentFuelImpact > 0 ? 'bg-yellow-500/5 border-yellow-500/20' : 'bg-teal-500/5 border-teal-500/20'}`}>
          <div className="flex items-center gap-2 mb-1">
            <Navigation2 size={14} className={currentFuelImpact > 0 ? 'text-yellow-400' : 'text-teal-400'} />
            <span className="text-xs text-navy-400">Current Impact</span>
          </div>
          <p className={`text-lg font-bold ${currentFuelImpact > 0 ? 'text-yellow-400' : 'text-teal-400'}`}>
            {currentFuelImpact > 0 ? '+' : ''}{currentFuelImpact.toFixed(2)} MT/d
          </p>
          <p className="text-xs text-navy-500 mt-0.5">{currentFavorable ? '↓ Favorable' : '↑ Against'} {currentSpeed} kts</p>
        </div>

        <div className={`p-3 rounded-xl border ${fuelChange > 0 ? 'bg-red-500/5 border-red-500/20' : 'bg-green-500/5 border-green-500/20'}`}>
          <div className="flex items-center gap-2 mb-1">
            <Fuel size={14} className={fuelChange > 0 ? 'text-red-400' : 'text-green-400'} />
            <span className="text-xs text-navy-400">Net Fuel Change</span>
          </div>
          <p className={`text-lg font-bold ${fuelChange > 0 ? 'text-red-400' : 'text-green-400'}`}>
            {fuelChange > 0 ? '+' : ''}{fuelChange.toFixed(2)} MT/d
          </p>
          <p className="text-xs text-navy-500 mt-0.5">{totalFuel.toFixed(1)} MT/d total</p>
        </div>
      </div>

      {/* Speed summary */}
      <div className="p-3 bg-navy-800/60 rounded-xl">
        <div className="flex items-center justify-between">
          <div className="text-center">
            <p className="text-xs text-navy-400">Base Speed</p>
            <p className="text-xl font-bold text-white">{baseSpeed} kts</p>
          </div>
          <div className="flex-1 flex items-center justify-center gap-2">
            {headwindSpeedLoss > 0 && <div className="text-xs text-red-400">-{headwindSpeedLoss.toFixed(1)} kts wind</div>}
            {tailwindSpeedGain > 0 && <div className="text-xs text-green-400">+{tailwindSpeedGain.toFixed(1)} kts wind</div>}
            {wavePenalty > 0 && <div className="text-xs text-orange-400">-{wavePenalty.toFixed(1)} kts wave</div>}
            {currentEffect !== 0 && <div className={`text-xs ${currentEffect > 0 ? 'text-teal-400' : 'text-yellow-400'}`}>{currentEffect > 0 ? '+' : ''}{currentEffect.toFixed(1)} kts cur</div>}
          </div>
          <div className="text-center">
            <p className="text-xs text-navy-400">Effective Speed</p>
            <p className={`text-xl font-bold ${adjustedSpeed < baseSpeed * 0.9 ? 'text-red-400' : adjustedSpeed > baseSpeed ? 'text-green-400' : 'text-teal-400'}`}>{adjustedSpeed.toFixed(1)} kts</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function WeatherIntelligencePage() {
  const [weatherData, setWeatherData] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'headwind' | 'tailwind' | 'crosswind' | 'current' | 'beaufort' | 'attribution'>('headwind')
  const [scenario, setScenario] = useState<WeatherScenario>({
    windSpeed: 20, windDir: 'head', waveHeight: 2.5, currentSpeed: 1.0,
    currentFavorable: false, baseSpeed: 14, baseFuel: 28.5,
  })

  useEffect(() => {
    analyticsAPI.weatherImpact().then(res => setWeatherData(res.data)).catch(console.error)
  }, [])

  const tabs = [
    { key: 'headwind', label: 'Headwind', icon: ArrowUp },
    { key: 'tailwind', label: 'Tailwind', icon: ArrowDown },
    { key: 'crosswind', label: 'Crosswind', icon: ArrowRight },
    { key: 'current', label: 'Current', icon: Navigation2 },
    { key: 'beaufort', label: 'Beaufort Scale', icon: Wind },
    { key: 'attribution', label: 'Attribution', icon: Fuel },
  ]

  const windDirMap: Record<string, 'head' | 'tail' | 'cross'> = {
    headwind: 'head', tailwind: 'tail', crosswind: 'cross', current: 'cross', beaufort: 'head', attribution: 'head'
  }

  // Attribution chart data (fuel breakdown by cause)
  const attributionData = {
    labels: ['Normal Consumption', 'Wind Impact', 'Wave Impact', 'Current Impact', 'Swell Impact'],
    datasets: [{
      data: [62, 14, 10, 8, 6],
      backgroundColor: ['rgba(20,184,166,0.8)', 'rgba(239,68,68,0.75)', 'rgba(245,158,11,0.75)', 'rgba(14,165,233,0.75)', 'rgba(139,92,246,0.7)'],
      borderWidth: 0,
    }],
  }

  const beaufortDistData = {
    labels: BEAUFORT.slice(0, 10).map(b => `Bft ${b.scale}`),
    datasets: [{
      label: 'Days at Scale',
      data: [3, 4, 5, 4, 4, 3, 2, 1, 1, 0],
      backgroundColor: BEAUFORT.slice(0, 10).map(b =>
        b.severity === 'low' ? 'rgba(16,185,129,0.7)' : b.severity === 'moderate' ? 'rgba(245,158,11,0.7)' : b.severity === 'high' ? 'rgba(249,115,22,0.7)' : 'rgba(239,68,68,0.7)'
      ),
      borderRadius: 4,
    }],
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-white">Advanced Weather Intelligence</h1>
        <p className="text-navy-400 text-sm mt-1">Headwind / tailwind / crosswind / current / wave impact analysis & fuel attribution</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 flex-wrap bg-navy-800/50 rounded-xl p-1 w-fit">
        {tabs.map(t => {
          const Icon = t.icon
          return (
            <button key={t.key} onClick={() => { setActiveTab(t.key as any); if (windDirMap[t.key]) setScenario(s => ({ ...s, windDir: windDirMap[t.key] })) }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${activeTab === t.key ? 'bg-teal-500/20 text-teal-400' : 'text-navy-400 hover:text-white'}`}>
              <Icon size={12} />{t.label}
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls Panel */}
        {activeTab !== 'beaufort' && activeTab !== 'attribution' && (
          <div className="glass-card p-5 rounded-2xl space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              {activeTab === 'headwind' && <><ArrowUp size={14} className="text-red-400" />Headwind Analysis</>}
              {activeTab === 'tailwind' && <><ArrowDown size={14} className="text-green-400" />Tailwind Analysis</>}
              {activeTab === 'crosswind' && <><ArrowRight size={14} className="text-yellow-400" />Crosswind Analysis</>}
              {activeTab === 'current' && <><Navigation2 size={14} className="text-ocean-400" />Current Impact</>}
            </h3>

            {(activeTab === 'headwind' || activeTab === 'tailwind' || activeTab === 'crosswind') && (
              <div>
                <div className="flex justify-between mb-1.5"><label className="text-xs text-navy-400">Wind Speed</label><span className="text-sm font-bold text-sky-400">{scenario.windSpeed} kts</span></div>
                <input type="range" min={0} max={60} value={scenario.windSpeed} onChange={e => setScenario(s => ({ ...s, windSpeed: Number(e.target.value) }))} className="w-full range-teal" />
                <div className="flex justify-between text-xs text-navy-600 mt-1"><span>0 kts (Calm)</span><span>60 kts (Storm)</span></div>
              </div>
            )}

            {activeTab === 'current' && (
              <div>
                <div className="flex justify-between mb-1.5"><label className="text-xs text-navy-400">Current Speed</label><span className="text-sm font-bold text-ocean-400">{scenario.currentSpeed.toFixed(1)} kts</span></div>
                <input type="range" min={0} max={4} step={0.1} value={scenario.currentSpeed} onChange={e => setScenario(s => ({ ...s, currentSpeed: Number(e.target.value) }))} className="w-full range-teal" />
                <div className="mt-3">
                  <label className="text-xs text-navy-400 block mb-2">Current Direction</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setScenario(s => ({ ...s, currentFavorable: true }))}
                      className={`py-2 rounded-xl text-xs font-medium transition-all ${scenario.currentFavorable ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-navy-800 text-navy-400 border border-transparent'}`}>
                      ↓ Favorable
                    </button>
                    <button onClick={() => setScenario(s => ({ ...s, currentFavorable: false }))}
                      className={`py-2 rounded-xl text-xs font-medium transition-all ${!scenario.currentFavorable ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-navy-800 text-navy-400 border border-transparent'}`}>
                      ↑ Against
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div>
              <div className="flex justify-between mb-1.5"><label className="text-xs text-navy-400">Wave Height</label><span className="text-sm font-bold text-blue-400">{scenario.waveHeight.toFixed(1)} m</span></div>
              <input type="range" min={0} max={8} step={0.1} value={scenario.waveHeight} onChange={e => setScenario(s => ({ ...s, waveHeight: Number(e.target.value) }))} className="w-full range-teal" />
            </div>

            <div>
              <div className="flex justify-between mb-1.5"><label className="text-xs text-navy-400">Base Speed</label><span className="text-sm font-bold text-teal-400">{scenario.baseSpeed} kts</span></div>
              <input type="range" min={8} max={24} step={0.5} value={scenario.baseSpeed} onChange={e => setScenario(s => ({ ...s, baseSpeed: Number(e.target.value) }))} className="w-full range-teal" />
            </div>

            <div>
              <div className="flex justify-between mb-1.5"><label className="text-xs text-navy-400">Base Fuel</label><span className="text-sm font-bold text-amber-400">{scenario.baseFuel} MT/d</span></div>
              <input type="range" min={10} max={200} value={scenario.baseFuel} onChange={e => setScenario(s => ({ ...s, baseFuel: Number(e.target.value) }))} className="w-full range-teal" />
            </div>
          </div>
        )}

        {/* Results */}
        <div className={activeTab === 'beaufort' || activeTab === 'attribution' ? 'lg:col-span-3' : 'lg:col-span-2'}>
          {/* Headwind/Tailwind/Crosswind/Current */}
          {['headwind', 'tailwind', 'crosswind', 'current'].includes(activeTab) && (
            <div className="glass-card p-5 rounded-2xl space-y-4">
              <div className="flex items-center gap-3 mb-4">
                {activeTab === 'headwind' && (
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-red-500/15 text-red-400"><ArrowUp size={20} /></div>
                    <div>
                      <h3 className="font-semibold text-white">Headwind Impact Analysis</h3>
                      <p className="text-xs text-navy-400">Wind opposing vessel direction — increases resistance and fuel burn</p>
                    </div>
                  </div>
                )}
                {activeTab === 'tailwind' && (
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-green-500/15 text-green-400"><ArrowDown size={20} /></div>
                    <div>
                      <h3 className="font-semibold text-white">Tailwind Impact Analysis</h3>
                      <p className="text-xs text-navy-400">Wind assisting vessel direction — reduces resistance and fuel burn</p>
                    </div>
                  </div>
                )}
                {activeTab === 'crosswind' && (
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-yellow-500/15 text-yellow-400"><ArrowRight size={20} /></div>
                    <div>
                      <h3 className="font-semibold text-white">Crosswind Impact Analysis</h3>
                      <p className="text-xs text-navy-400">Beam wind — causes leeway, increased rudder corrections and resistance</p>
                    </div>
                  </div>
                )}
                {activeTab === 'current' && (
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-ocean-500/15 text-ocean-400"><Navigation2 size={20} /></div>
                    <div>
                      <h3 className="font-semibold text-white">Ocean Current Analysis</h3>
                      <p className="text-xs text-navy-400">Current direction & speed effect on effective speed and fuel consumption</p>
                    </div>
                  </div>
                )}
              </div>
              <WindImpactCard scenario={{ ...scenario, windDir: windDirMap[activeTab] || 'head' }} />

              {/* Explanation box */}
              <div className="p-4 bg-navy-800/50 rounded-xl text-sm text-navy-300 space-y-2">
                {activeTab === 'headwind' && <>
                  <p className="font-semibold text-white">How headwind affects your vessel:</p>
                  <p>A {scenario.windSpeed} knot headwind (Beaufort {Math.min(12, Math.floor(scenario.windSpeed / 6))}) increases hull resistance significantly.</p>
                  <p>The additional resistance follows a <strong className="text-teal-400">square law</strong> — doubling wind speed quadruples the resistance.</p>
                  <p className="text-teal-400 font-medium">💡 Recommendation: Consider reducing speed by 1-2 knots to maintain fuel budget, or route to avoid the headwind.</p>
                </>}
                {activeTab === 'tailwind' && <>
                  <p className="font-semibold text-white">How tailwind benefits your vessel:</p>
                  <p>A {scenario.windSpeed} knot tailwind reduces effective resistance, allowing either <strong className="text-green-400">higher speed at same fuel</strong> or <strong className="text-green-400">same speed with less fuel</strong>.</p>
                  <p className="text-green-400 font-medium">💡 Recommendation: Capitalize on favorable winds by reducing engine output to save fuel while maintaining ETA.</p>
                </>}
                {activeTab === 'crosswind' && <>
                  <p className="font-semibold text-white">How crosswind affects your vessel:</p>
                  <p>Beam winds cause leeway drift, requiring constant rudder correction. This increases drag and fuel consumption.</p>
                  <p>Crosswind also causes rolling, which increases crew discomfort and cargo movement risk.</p>
                  <p className="text-yellow-400 font-medium">💡 Recommendation: Consider slight course deviation to take wind more on bow (quartering sea) to reduce beam impact.</p>
                </>}
                {activeTab === 'current' && <>
                  <p className="font-semibold text-white">Ocean current effect on vessel performance:</p>
                  <p>Vessel Speed: {scenario.baseSpeed} kts | Current: {scenario.currentFavorable ? '+' : '-'}{scenario.currentSpeed} kts</p>
                  <p>Effective Speed Over Ground: <strong className="text-teal-400">{Math.max(0, scenario.baseSpeed + (scenario.currentFavorable ? scenario.currentSpeed * 0.8 : -scenario.currentSpeed * 0.8)).toFixed(1)} kts</strong></p>
                  <p className={`font-medium ${scenario.currentFavorable ? 'text-green-400' : 'text-red-400'}`}>
                    💡 {scenario.currentFavorable ? 'Favorable current — consider reducing engine power to save fuel while maintaining ETA.' : 'Adverse current — vessel working harder. Monitor fuel ROB carefully.'}
                  </p>
                </>}
              </div>
            </div>
          )}

          {/* Beaufort Scale Table */}
          {activeTab === 'beaufort' && (
            <div className="space-y-5">
              <div className="glass-card p-5 rounded-2xl">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><Wind size={14} className="text-sky-400" />Beaufort Scale Reference & Performance Impact</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/5">
                        {['Bft', 'Label', 'Wind Speed', 'Wave Height', 'Description', 'Severity', 'Speed Loss', 'Fuel Penalty'].map(h => (
                          <th key={h} className="py-2 px-2 text-left text-navy-500 font-medium whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {BEAUFORT.map(b => {
                        const speedLoss = b.scale < 3 ? 0 : (b.scale / 12) ** 2 * 15
                        const fuelPen = b.scale < 3 ? 0 : (b.scale / 12) ** 2 * 20
                        return (
                          <tr key={b.scale} className="border-b border-white/3 hover:bg-white/2">
                            <td className="py-2 px-2 font-bold text-white">{b.scale}</td>
                            <td className="py-2 px-2 text-navy-300 whitespace-nowrap">{b.label}</td>
                            <td className="py-2 px-2 text-sky-400 font-medium">{b.speed}</td>
                            <td className="py-2 px-2 text-ocean-400">{b.wave}</td>
                            <td className="py-2 px-2 text-navy-400 max-w-xs">{b.desc}</td>
                            <td className="py-2 px-2">
                              <span className={`px-2 py-0.5 rounded-full text-xs border capitalize ${SEVERITY_COLOR[b.severity]}`}>{b.severity}</span>
                            </td>
                            <td className={`py-2 px-2 font-medium ${speedLoss > 0 ? 'text-red-400' : 'text-green-400'}`}>{speedLoss > 0 ? `-${speedLoss.toFixed(1)}%` : '—'}</td>
                            <td className={`py-2 px-2 font-medium ${fuelPen > 0 ? 'text-red-400' : 'text-green-400'}`}>{fuelPen > 0 ? `+${fuelPen.toFixed(1)}%` : '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="glass-card p-5 rounded-2xl">
                <h3 className="text-sm font-semibold text-white mb-4">Beaufort Distribution (Current Voyage)</h3>
                <div style={{ height: 200 }}>
                  <Bar data={beaufortDistData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#64748b', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.04)' } }, y: { ticks: { color: '#64748b', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.06)' } } } } as any} />
                </div>
              </div>
            </div>
          )}

          {/* Attribution */}
          {activeTab === 'attribution' && (
            <div className="space-y-5">
              <div className="glass-card p-6 rounded-2xl">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><Fuel size={14} className="text-amber-400" />Fuel Consumption Attribution Analysis</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div style={{ height: 260 }}>
                      <Doughnut data={attributionData} options={{ responsive: true, maintainAspectRatio: false, cutout: '55%', plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11 }, padding: 12 } }, tooltip: { backgroundColor: '#0A1F3A', titleColor: '#e2e8f0', bodyColor: '#94a3b8' } } } as any} />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <p className="text-xs text-navy-400 mb-3">Total Fuel: <span className="text-white font-bold">52 MT</span> per day</p>
                    {[
                      { label: 'Normal Consumption', value: 32.2, pct: 62, color: 'bg-teal-500', textColor: 'text-teal-400' },
                      { label: 'Wind Impact', value: 7.3, pct: 14, color: 'bg-red-500', textColor: 'text-red-400' },
                      { label: 'Wave Resistance', value: 5.2, pct: 10, color: 'bg-amber-500', textColor: 'text-amber-400' },
                      { label: 'Current Penalty', value: 4.2, pct: 8, color: 'bg-ocean-500', textColor: 'text-ocean-400' },
                      { label: 'Swell Impact', value: 3.1, pct: 6, color: 'bg-purple-500', textColor: 'text-purple-400' },
                    ].map(({ label, value, pct, color, textColor }) => (
                      <div key={label}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-navy-300">{label}</span>
                          <span className={`font-bold ${textColor}`}>{value} MT ({pct}%)</span>
                        </div>
                        <div className="h-1.5 bg-navy-800 rounded-full">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, delay: 0.1 }}
                            className={`h-1.5 rounded-full ${color}`} />
                        </div>
                      </div>
                    ))}
                    <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                      <p className="text-xs text-amber-400 font-semibold mb-1">⚡ Attribution Insight</p>
                      <p className="text-xs text-navy-300">38% of fuel (19.8 MT/d) is caused by adverse weather conditions. Optimal weather routing could save <strong className="text-green-400">$8,600/voyage</strong>.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Detailed attribution table */}
              <div className="glass-card p-5 rounded-2xl">
                <h3 className="text-sm font-semibold text-white mb-4">Voyage Day-by-Day Attribution Breakdown</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/5">
                        {['Day', 'Total Fuel', 'Normal', 'Wind +', 'Wave +', 'Current +', 'Swell +', 'Beaufort', 'Net Impact'].map(h => (
                          <th key={h} className="py-2 px-2 text-left text-navy-500 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: 10 }, (_, i) => {
                        const base = 28.5 + Math.random() * 3
                        const wind = Math.random() * 4
                        const wave = Math.random() * 2
                        const current = (Math.random() - 0.4) * 2
                        const swell = Math.random() * 1.5
                        const bft = Math.floor(Math.random() * 7)
                        const total = base + wind + wave + current + swell
                        return (
                          <tr key={i} className="border-b border-white/3 hover:bg-white/2">
                            <td className="py-2 px-2 text-navy-400">Day {i + 1}</td>
                            <td className="py-2 px-2 font-bold text-white">{total.toFixed(1)}</td>
                            <td className="py-2 px-2 text-teal-400">{base.toFixed(1)}</td>
                            <td className={`py-2 px-2 ${wind > 2 ? 'text-red-400' : 'text-orange-400'}`}>+{wind.toFixed(1)}</td>
                            <td className={`py-2 px-2 ${wave > 1 ? 'text-orange-400' : 'text-yellow-400'}`}>+{wave.toFixed(1)}</td>
                            <td className={`py-2 px-2 ${current > 0 ? 'text-red-400' : 'text-green-400'}`}>{current > 0 ? '+' : ''}{current.toFixed(1)}</td>
                            <td className="py-2 px-2 text-purple-400">+{swell.toFixed(1)}</td>
                            <td className="py-2 px-2"><span className={`px-1.5 py-0.5 rounded text-xs ${bft <= 3 ? 'bg-green-500/15 text-green-400' : bft <= 5 ? 'bg-yellow-500/15 text-yellow-400' : 'bg-red-500/15 text-red-400'}`}>Bft {bft}</span></td>
                            <td className={`py-2 px-2 font-bold ${(total - base) > 3 ? 'text-red-400' : 'text-orange-400'}`}>+{(total - base).toFixed(1)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
