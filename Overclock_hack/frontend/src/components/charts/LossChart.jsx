import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatCompactKZT } from '../../utils/formatters'

const FRAUD = '#fb7185'
const FRICTION = '#a1a1aa'

function LossTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const loss = payload.find((p) => p.dataKey === 'fraudLoss')?.value ?? 0
  const friction = payload.find((p) => p.dataKey === 'friction')?.value ?? 0
  const fpr = payload.find((p) => p.dataKey === 'fpr')?.value ?? 0
  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 shadow-lg text-xs font-mono">
      <p className="text-zinc-400 mb-1">threshold {label}%</p>
      <p style={{ color: FRAUD }}>fraud_loss {formatCompactKZT(loss)}</p>
      <p style={{ color: FRICTION }}>friction {Number(friction).toFixed(2)}</p>
      <p className="text-zinc-500 mt-0.5">fpr {Number(fpr).toFixed(2)}%</p>
    </div>
  )
}

export default function LossChart({ data, threshold = 60 }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="threshold"
          tick={{ fill: '#52525b', fontSize: 10, fontFamily: 'monospace' }}
          tickLine={false}
          axisLine={{ stroke: '#3f3f46' }}
          tickFormatter={(v) => `${v}%`}
        />
        <YAxis
          yAxisId="loss"
          tick={{ fill: '#52525b', fontSize: 10, fontFamily: 'monospace' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => formatCompactKZT(v)}
        />
        <YAxis
          yAxisId="friction"
          orientation="right"
          tick={{ fill: '#52525b', fontSize: 10, fontFamily: 'monospace' }}
          tickLine={false}
          axisLine={false}
          domain={[0, 8]}
        />
        <Tooltip content={<LossTooltip />} />
        <ReferenceLine
          yAxisId="loss"
          x={threshold}
          stroke="#71717a"
          strokeDasharray="4 4"
          strokeWidth={1.2}
          label={{
            value: `op ${threshold}`,
            position: 'top',
            fill: '#a1a1aa',
            fontSize: 10,
            fontFamily: 'monospace',
          }}
        />
        <Area
          yAxisId="loss"
          type="monotone"
          dataKey="fraudLoss"
          name="Потери от фрода"
          stroke={FRAUD}
          strokeWidth={1.5}
          fill="none"
        />
        <Area
          yAxisId="friction"
          type="monotone"
          dataKey="friction"
          name="Фрикции клиентов"
          stroke={FRICTION}
          strokeWidth={1.5}
          fill="none"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}