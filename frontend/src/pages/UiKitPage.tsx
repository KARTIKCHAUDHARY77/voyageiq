import React, { useMemo, useState } from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler,
} from 'chart.js'
import { Plus } from 'lucide-react'
import {
  Badge, Button, DataTable, EmptyState, ErrorState, Field, Input, PageHeader, Panel, Select, Skeleton, Stat, Tabs,
} from '../components/kit'
import { baseChartOptions, chartColors, referenceLine } from '../design/chartTheme'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

/** Development-only reference for the component kit. Reached at /ui when running `npm run dev`. */
export default function UiKitPage() {
  const [tab, setTab] = useState('speed')
  const c = chartColors()

  // Illustrative values for the kit demo only. Real screens must use API data.
  const chart = useMemo(() => {
    const labels = ['1', '2', '3', '4', '5', '6', '7', '8']
    const values = [13.2, 13.8, 14.1, 13.4, 12.9, 13.6, 14.0, 13.7]
    return {
      data: {
        labels,
        datasets: [
          { label: 'Speed over ground', data: values, borderColor: c.accent, backgroundColor: c.accentFill, borderWidth: 2, tension: 0.25, pointRadius: 2 },
          referenceLine('Warranted', 14, labels.length),
        ],
      },
      options: baseChartOptions({ unit: 'kn' }),
    }
  }, [c.accent, c.accentFill])

  const rows = [
    { id: '1', day: '12 Mar', speed: '13.2', burn: '28.4', bft: 3 },
    { id: '2', day: '13 Mar', speed: '12.9', burn: '29.1', bft: 5 },
    { id: '3', day: '14 Mar', speed: '13.7', burn: '27.8', bft: 2 },
  ]

  return (
    <div className="max-w-5xl">
      <PageHeader title="Component kit" description="Development reference. The same primitives are used on every screen." actions={<Button variant="primary" icon={<Plus size={14} />}>Primary action</Button>} />

      <div className="grid gap-6">
        <Panel title="Buttons">
          <div className="flex flex-wrap gap-3">
            <Button variant="primary">Primary</Button>
            <Button>Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="primary" loading>Saving</Button>
            <Button disabled>Disabled</Button>
            <Button size="sm">Small</Button>
          </div>
        </Panel>

        <Panel title="Stats">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Average speed" value="13.6" unit="kn" delta={{ value: '−0.4 kn', tone: 'bad', label: 'vs warranted' }} />
            <Stat label="ME consumption" value="28.4" unit="MT/day" delta={{ value: '−0.6', tone: 'good', label: 'vs warranted' }} />
            <Stat label="Rough-weather days" value={null} />
            <Stat label="Loading" value="" loading />
          </div>
        </Panel>

        <Panel title="Speed against warranted" actions={<Badge tone="warn">Below warranted</Badge>}>
          <Tabs label="Measure" value={tab} onChange={setTab} items={[{ key: 'speed', label: 'Speed' }, { key: 'fuel', label: 'Fuel' }, { key: 'weather', label: 'Weather' }]} />
          <div className="h-56 mt-4"><Line data={chart.data} options={chart.options} /></div>
        </Panel>

        <Panel title="Noon reports" flush>
          <DataTable
            caption="Recent noon reports"
            rows={rows}
            rowKey={r => r.id}
            columns={[
              { key: 'day', header: 'Date' },
              { key: 'speed', header: 'Speed (kn)', numeric: true },
              { key: 'burn', header: 'ME burn (MT)', numeric: true },
              { key: 'bft', header: 'Weather', render: r => <Badge tone={r.bft >= 5 ? 'warn' : 'ok'}>Bft {r.bft}</Badge> },
            ]}
          />
        </Panel>

        <Panel title="Form fields">
          <div className="grid md:grid-cols-3 gap-4">
            <Field label="Vessel" hint="Pick the vessel to analyse">{a11y => <Select {...a11y}><option>Atlantic Carrier</option></Select>}</Field>
            <Field label="Speed over ground (kn)">{a11y => <Input type="number" placeholder="13.5" {...a11y} />}</Field>
            <Field label="Fuel burned (MT)" error="Enter a number between 0 and 300">{a11y => <Input defaultValue="-4" {...a11y} />}</Field>
          </div>
        </Panel>

        <div className="grid md:grid-cols-3 gap-6">
          <Panel title="Empty"><EmptyState title="No noon reports yet" action={<Button variant="primary">Add report</Button>}>Upload a CSV or add one by hand and the charts will fill in.</EmptyState></Panel>
          <Panel title="Error"><ErrorState onRetry={() => undefined} /></Panel>
          <Panel title="Loading"><div className="grid gap-3"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-5 w-1/2" /><Skeleton className="h-24" /></div></Panel>
        </div>
      </div>
    </div>
  )
}
