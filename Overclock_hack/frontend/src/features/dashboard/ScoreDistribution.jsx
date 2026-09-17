import { useMemo } from 'react'
import {
  Bar, BarChart, CartesianGrid, Cell, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis, Legend
} from 'recharts'
import Card from '../../components/ui/Card'

function ScoreTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const safe  = payload.find((p) => p.dataKey === 'safe')?.value  ?? 0
  const fraud = payload.find((p) => p.dataKey === 'fraud')?.value ?? 0
  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 shadow-xl text-xs font-mono">
      <p className="text-zinc-400 mb-1.5">Диапазон {label}</p>
      <p className="text-emerald-400">safe  {safe.toLocaleString()}</p>
      <p className="text-rose-400">  fraud {fraud.toLocaleString()}</p>
    </div>
  )
}

export default function ScoreDistribution({ data = [], threshold = 60 }) {
  // Convert threshold 0–100 to bin label
  const thresholdBin = useMemo(() => {
    const lo = Math.floor(threshold / 10) * 10
    const hi = lo + 10
    return `${lo}–${hi}`
  }, [threshold])

  return (
    <Card
      title="Score Distribution"
      subtitle="Распределение риск-скора по потоку транзакций"
    >
      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={data}
          margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
          barCategoryGap="15%"
          barGap={2}
        >
          <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="bin"
            tick={{ fill: '#52525b', fontSize: 10, fontFamily: 'monospace' }}
            tickLine={false}
            axisLine={{ stroke: '#3f3f46' }}
          />
          <YAxis
            tick={{ fill: '#52525b', fontSize: 10, fontFamily: 'monospace' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}
          />
          <Tooltip content={<ScoreTooltip />} cursor={{ fill: 'rgba(113,113,122,0.06)' }} />
          <Legend
            wrapperStyle={{ fontSize: 10, fontFamily: 'monospace', paddingTop: 4 }}
            formatter={(val) => <span style={{ color: '#a1a1aa' }}>{val}</span>}
          />
          <ReferenceLine
            x={thresholdBin}
            stroke="#71717a"
            strokeDasharray="4 4"
            strokeWidth={1.5}
            label={{
              value: `threshold`,
              position: 'top',
              fill: '#a1a1aa',
              fontSize: 9,
              fontFamily: 'monospace',
            }}
          />
          <Bar dataKey="safe" name="safe" stackId="a" radius={[0, 0, 0, 0]}>
            {data.map((entry) => (
              <Cell
                key={entry.bin}
                fill={entry.bin === thresholdBin ? 'rgba(52,211,153,0.6)' : 'rgba(52,211,153,0.25)'}
              />
            ))}
          </Bar>
          <Bar dataKey="fraud" name="fraud" stackId="a" radius={[3, 3, 0, 0]}>
            {data.map((entry) => (
              <Cell
                key={entry.bin}
                fill={entry.bin === thresholdBin ? 'rgba(244,63,94,0.8)' : 'rgba(244,63,94,0.4)'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  )
}
