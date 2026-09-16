import { scoreHex, scoreToStatus, STATUS_META } from '../../utils/riskColors'

export default function RiskGauge({ value = 0, label = 'RISK SCORE', format = (v) => `${v}%` }) {
  const displayValue = Math.min(100, Math.max(0, value))
  const hex = scoreHex(displayValue)
  const meta = STATUS_META[scoreToStatus(displayValue)]

  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between">
        <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">{label}</span>
        <span className="font-mono text-xl font-semibold tracking-tight" style={{ color: hex }}>
          {format(displayValue)}
        </span>
      </div>

      <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${displayValue}%`, backgroundColor: hex }}
        />
      </div>

      <div className="flex justify-between text-[10px] font-mono text-zinc-600">
        <span>0</span>
        <span className={meta ? meta.text : undefined}>{meta?.label}</span>
        <span>100</span>
      </div>
    </div>
  )
}