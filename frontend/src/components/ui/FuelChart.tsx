// VoyageIQ AI — Maritime Intelligence Platform
// Copyright (c) 2024 Kartik Chaudhary. All Rights Reserved.
// Unauthorized copying or use of this file is strictly prohibited.
// Contact: 2512520007@geu.ac.in
import React, { useMemo } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartData,
  ChartOptions,
} from 'chart.js'
import { Line, Bar, Doughnut } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

// ─── Types ────────────────────────────────────────────────────────────────────

export type FuelChartType = 'line' | 'bar' | 'doughnut'

export interface FuelDataset {
  label: string
  data: number[]
  color?: string  // override palette
}

export interface FuelChartProps {
  labels: string[]
  datasets: FuelDataset[]
  type?: FuelChartType
  title?: string
  height?: number
  unit?: string
  showLegend?: boolean
  showGrid?: boolean
  fill?: boolean  // area fill under line
}

// ─── Maritime Colour Palette ──────────────────────────────────────────────────

const PALETTE = [
  { solid: '#14B8A6', area: 'rgba(20,184,166,0.15)' },   // teal-500
  { solid: '#0EA5E9', area: 'rgba(14,165,233,0.15)' },   // ocean-500
  { solid: '#A855F7', area: 'rgba(168,85,247,0.15)' },   // purple-500
  { solid: '#F59E0B', area: 'rgba(245,158,11,0.15)' },   // amber-500
  { solid: '#EF4444', area: 'rgba(239,68,68,0.15)' },    // red-500
  { solid: '#10B981', area: 'rgba(16,185,129,0.15)' },   // green-500
]

// ─── Common chart defaults ────────────────────────────────────────────────────

const darkText = 'rgba(148,163,184,1)'      // slate-400
const gridColor = 'rgba(255,255,255,0.06)'
const tooltipBg = 'rgba(4,15,31,0.95)'

function buildTooltipOptions() {
  return {
    backgroundColor: tooltipBg,
    borderColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    titleColor: '#fff',
    bodyColor: darkText,
    padding: 10,
    cornerRadius: 10,
    displayColors: true,
    boxPadding: 4,
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FuelChart({
  labels,
  datasets,
  type = 'line',
  title,
  height = 280,
  unit = 'MT',
  showLegend = true,
  showGrid = true,
  fill = true,
}: FuelChartProps) {
  // ── Line chart ──────────────────────────────────────────────────────────────
  const lineData: ChartData<'line'> = useMemo(() => ({
    labels,
    datasets: datasets.map((ds, i) => {
      const palette = PALETTE[i % PALETTE.length]
      const color = ds.color ?? palette.solid
      const areaColor = ds.color
        ? `${ds.color}26`
        : palette.area
      return {
        label: ds.label,
        data: ds.data,
        borderColor: color,
        backgroundColor: fill ? areaColor : 'transparent',
        pointBackgroundColor: color,
        pointBorderColor: 'rgba(2,11,24,0.8)',
        pointRadius: 3,
        pointHoverRadius: 6,
        borderWidth: 2.5,
        tension: 0.42,
        fill: fill,
      }
    }),
  }), [labels, datasets, fill])

  const lineOptions: ChartOptions<'line'> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        display: showLegend,
        position: 'top',
        labels: { color: darkText, boxWidth: 12, boxHeight: 12, padding: 16, font: { size: 12 } },
      },
      title: {
        display: !!title,
        text: title,
        color: '#e2e8f0',
        font: { size: 14, weight: 'bold' },
        padding: { bottom: 16 },
      },
      tooltip: buildTooltipOptions(),
    },
    scales: {
      x: {
        grid: { color: showGrid ? gridColor : 'transparent', drawTicks: false },
        border: { color: 'transparent' },
        ticks: { color: darkText, font: { size: 11 }, maxRotation: 0 },
      },
      y: {
        grid: { color: showGrid ? gridColor : 'transparent', drawTicks: false },
        border: { color: 'transparent' },
        ticks: {
          color: darkText,
          font: { size: 11 },
          callback: (val) => `${val} ${unit}`,
        },
      },
    },
  }), [showLegend, title, showGrid, unit])

  // ── Bar chart ───────────────────────────────────────────────────────────────
  const barData: ChartData<'bar'> = useMemo(() => ({
    labels,
    datasets: datasets.map((ds, i) => {
      const palette = PALETTE[i % PALETTE.length]
      const color = ds.color ?? palette.solid
      return {
        label: ds.label,
        data: ds.data,
        backgroundColor: `${color}99`,
        borderColor: color,
        borderWidth: 1.5,
        borderRadius: 6,
        borderSkipped: false,
        hoverBackgroundColor: color,
      }
    }),
  }), [labels, datasets])

  const barOptions: ChartOptions<'bar'> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        display: showLegend,
        position: 'top',
        labels: { color: darkText, boxWidth: 12, boxHeight: 12, padding: 16, font: { size: 12 } },
      },
      title: {
        display: !!title,
        text: title,
        color: '#e2e8f0',
        font: { size: 14, weight: 'bold' },
        padding: { bottom: 16 },
      },
      tooltip: buildTooltipOptions(),
    },
    scales: {
      x: {
        grid: { color: 'transparent' },
        border: { color: 'transparent' },
        ticks: { color: darkText, font: { size: 11 }, maxRotation: 0 },
      },
      y: {
        grid: { color: showGrid ? gridColor : 'transparent' },
        border: { color: 'transparent' },
        ticks: {
          color: darkText,
          font: { size: 11 },
          callback: (val) => `${val} ${unit}`,
        },
      },
    },
  }), [showLegend, title, showGrid, unit])

  // ── Doughnut chart ──────────────────────────────────────────────────────────
  const doughnutData: ChartData<'doughnut'> = useMemo(() => ({
    labels,
    datasets: [{
      data: datasets[0]?.data ?? [],
      backgroundColor: datasets[0]?.data.map((_, i) =>
        `${(PALETTE[i % PALETTE.length].solid)}CC`
      ) ?? [],
      borderColor: datasets[0]?.data.map((_, i) =>
        PALETTE[i % PALETTE.length].solid
      ) ?? [],
      borderWidth: 2,
      hoverOffset: 8,
    }],
  }), [labels, datasets])

  const doughnutOptions: ChartOptions<'doughnut'> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    plugins: {
      legend: {
        display: showLegend,
        position: 'right',
        labels: {
          color: darkText,
          boxWidth: 12,
          boxHeight: 12,
          padding: 14,
          font: { size: 12 },
          generateLabels: (chart) => {
            const data = chart.data
            if (!data.labels || !data.datasets[0]) return []
            return (data.labels as string[]).map((label, i) => ({
              text: `${label}: ${data.datasets[0].data[i]} ${unit}`,
              fillStyle: (data.datasets[0].backgroundColor as string[])[i],
              strokeStyle: (data.datasets[0].borderColor as string[])[i],
              lineWidth: 1,
              hidden: false,
              index: i,
              datasetIndex: 0,
              fontColor: darkText,
            }))
          },
        },
      },
      title: {
        display: !!title,
        text: title,
        color: '#e2e8f0',
        font: { size: 14, weight: 'bold' },
        padding: { bottom: 16 },
      },
      tooltip: buildTooltipOptions(),
    },
  }), [showLegend, title, unit])

  // ─ Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ height, position: 'relative' }}>
      {type === 'line' && <Line data={lineData} options={lineOptions} />}
      {type === 'bar' && <Bar data={barData} options={barOptions} />}
      {type === 'doughnut' && <Doughnut data={doughnutData} options={doughnutOptions} />}
    </div>
  )
}
