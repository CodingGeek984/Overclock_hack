import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const NEG = '#fb7185'
const POS = '#34d399'

function ShapTooltip({ active, payload, label: _label }) {
  if (!active || !payload?.length) return null
  const item = payload[0].payload
  return (
    <div className="bg-white border border-zinc-200 rounded-2xl px-4 py-3 shadow-lg text-xs">
      <p className="text-zinc-900 font-semibold mb-1">{item.name}</p>
      <p className="font-bold" style={{ color: item.effect >= 0 ? NEG : POS }}>
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
          tick={{ fill: '#a1a1aa', fontSize: 10, fontFamily: 'monospace' }}
          tickLine={false}
          axisLine={{ stroke: '#e4e4e7' }}
          tickFormatter={(v) => (v === 0 ? '0' : v.toFixed(2))}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={132}
          tick={{ fill: '#52525b', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<ShapTooltip />} cursor={{ fill: '#f4f4f5' }} />
        <Bar dataKey="effect" isAnimationActive={false} radius={[4, 4, 4, 4]}>
          {data.map((entry) => (
            <Cell
              key={entry.name}
              fill={entry.effect >= 0 ? NEG : POS}
              fillOpacity={0.9}
              radius={[4, 4, 4, 4]}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}