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
import { formatCompactKZT } from '../../utils/formatters.js'

const FRAUD = '#60a5fa'
const FRICTION = '#c084fc'
const TRACK = '#3f3f46'

function LossTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const loss = payload.find((p) => p.dataKey === 'fraudLoss')?.value ?? 0
  const friction = payload.find((p) => p.dataKey === 'friction')?.value ?? 0
  const fpr = payload.find((p) => p.dataKey === 'fpr')?.value ?? 0
  return (
    <div className="bg-zinc-900 border border-white/10 rounded-2xl px-4 py-3 shadow-xl text-xs">
      <p className="text-zinc-400 font-medium mb-1.5">порог {label}%</p>
      <p className="font-bold" style={{ color: FRAUD }}>
        fraud_loss {formatCompactKZT(loss)}
      </p>
      <p className="font-bold" style={{ color: FRICTION }}>
        friction {Number(friction).toFixed(2)}
      </p>
      <p className="text-zinc-500 mt-1">fpr {Number(fpr).toFixed(2)}%</p>
    </div>
  )
}

export default function LossChart({ data, threshold = 60 }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="none" vertical={false} />
        <XAxis
          dataKey="threshold"
          tick={{ fill: '#71717a', fontSize: 10, fontFamily: 'monospace' }}
          tickLine={false}
          axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
          tickFormatter={(v) => `${v}%`}
        />
        <YAxis
          yAxisId="loss"
          tick={{ fill: '#71717a', fontSize: 10, fontFamily: 'monospace' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => formatCompactKZT(v)}
        />
        <YAxis
          yAxisId="friction"
          orientation="right"
          tick={{ fill: '#3f3f46', fontSize: 0 }}
          tickLine={false}
          axisLine={false}
          domain={[0, 8]}
        />
        <Tooltip content={<LossTooltip />} cursor={{ stroke: '#52525b', strokeDasharray: '4 4' }} />
        <ReferenceLine
          yAxisId="loss"
          x={threshold}
          stroke={TRACK}
          strokeDasharray="5 5"
          strokeWidth={1}
          label={{
            value: `op ${threshold}`,
            position: 'top',
            fill: '#a1a1aa',
            fontSize: 10,
            fontFamily: 'monospace',
          }}
        />
        <Area
          yAxisId="friction"
          type="monotone"
          dataKey="friction"
          name="Фрикции клиентов"
          stroke={FRICTION}
          strokeWidth={2}
          fill="none"
          dot={false}
        />
        <Area
          yAxisId="loss"
          type="monotone"
          dataKey="fraudLoss"
          name="Потери от фрода"
          stroke={FRAUD}
          strokeWidth={2}
          fill="none"
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}