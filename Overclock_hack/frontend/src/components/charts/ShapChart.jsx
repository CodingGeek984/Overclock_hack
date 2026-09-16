import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const NEG = '#9f1239'
const POS = '#166534'

function ShapTooltip({ active, payload, label: _label }) {
  if (!active || !payload?.length) return null
  const item = payload[0].payload
  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 shadow-lg text-xs font-mono">
      <p className="text-zinc-300 font-medium mb-1">{item.name}</p>
      <p style={{ color: item.effect >= 0 ? '#fb7185' : '#34d399' }}>
        SHAP {item.effect >= 0 ? '+' : ''}{item.effect.toFixed(3)}
      </p>
      <p className="text-zinc-500 mt-0.5">{item.detail}</p>
    </div>
  )
}

export default function ShapChart({ data }) {
  if (!data?.length) return null
  return (
    <ResponsiveContainer width="100%" height={Math.max(data.length * 44, 180)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 34, left: 8, bottom: 4 }}
        barCategoryGap="30%"
      >
        <XAxis
          type="number"
          domain={[-0.5, 0.5]}
          tick={{ fill: '#52525b', fontSize: 10, fontFamily: 'monospace' }}
          tickLine={false}
          axisLine={{ stroke: '#3f3f46' }}
          tickFormatter={(v) => (v === 0 ? '0' : v.toFixed(2))}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={132}
          tick={{ fill: '#a1a1aa', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<ShapTooltip />} cursor={{ fill: 'rgba(113,113,122,0.06)' }} />
        <Bar dataKey="effect" isAnimationActive={false}>
          {data.map((entry) => (
            <Cell
              key={entry.name}
              fill={entry.effect >= 0 ? NEG : POS}
              fillOpacity={0.85}
              radius={[3, 3, 3, 3]}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}