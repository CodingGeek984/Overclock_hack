import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import { scoreHex, scoreToStatus, STATUS_META } from '../../utils/riskColors.js'

export default function RiskDonut({ value = 0, label = 'Risk Score', format = (v) => `${v}%`, showStatus = true }) {
  const score = Math.min(100, Math.max(0, Math.round(value)))
  const hex = scoreHex(score)
  const status = STATUS_META[scoreToStatus(score)]

  const data = [{ name: 'score', value: score }, { name: 'rest', value: 100 - score }]

  const glow =
    score >= 80
      ? 'rgba(244,63,94,0.45)'
      : score >= 50
        ? 'rgba(245,158,11,0.4)'
        : 'rgba(34,197,94,0.4)'

  return (
    <div className="relative w-[224px] h-[224px] mx-auto">
      <div
        className="absolute inset-4 rounded-full blur-2xl opacity-60 transition-colors duration-500"
        style={{ backgroundColor: glow }}
      />

      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            startAngle={90}
            endAngle={-270}
            innerRadius={84}
            outerRadius={104}
            paddingAngle={0}
            cornerRadius={22}
            isAnimationActive
            animationDuration={600}
            stroke="none"
          >
            <Cell fill={hex} />
            <Cell fill="#ffffff" fillOpacity={0.08} />
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">
          {label}
        </span>
        <span
          className="mt-1 text-5xl font-extrabold tracking-tight transition-colors duration-500"
          style={{ color: hex }}
        >
          {format(score)}
        </span>
        {showStatus && (
          <span
            className="mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold"
            style={{ backgroundColor: `${hex}1f`, color: hex }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: hex }} />
            {status?.label}
          </span>
        )}
      </div>
    </div>
  )
}