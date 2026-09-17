import Card from '../../components/ui/Card'

const STATUS_META = {
  stable:   { label: '✅ Stable',   bar: 'bg-emerald-500', text: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  warning:  { label: '⚠️ Warning',  bar: 'bg-amber-500',   text: 'text-amber-400',   bg: 'bg-amber-500/10'  },
  critical: { label: '🔴 Critical', bar: 'bg-rose-500',    text: 'text-rose-400',    bg: 'bg-rose-500/10'   },
}

const PSI_THRESHOLD_WARN = 0.1
const PSI_THRESHOLD_CRIT = 0.2

function getPsi(feature) {
  if (feature.psi >= PSI_THRESHOLD_CRIT) return 'critical'
  if (feature.psi >= PSI_THRESHOLD_WARN) return 'warning'
  return 'stable'
}

export default function DriftHeatmap({ data = [] }) {
  const hasAlert = data.some((d) => d.psi >= PSI_THRESHOLD_WARN)
  const hasCritical = data.some((d) => d.psi >= PSI_THRESHOLD_CRIT)

  return (
    <Card
      title="Feature Drift Monitor"
      subtitle="PSI — Population Stability Index по ключевым признакам"
    >
      {/* Alert banner */}
      {hasCritical && (
        <div className="mb-4 flex items-start gap-2 rounded-md bg-rose-500/10 border border-rose-800/50 px-3 py-2.5">
          <span className="text-rose-400 text-sm shrink-0">🔴</span>
          <p className="text-[11px] font-mono text-rose-300 leading-relaxed">
            Критический дрейф: <strong>country_risk</strong>. PSI = 0.23 (порог 0.20).
            Рекомендуем срочное переобучение модели.
          </p>
        </div>
      )}
      {!hasCritical && hasAlert && (
        <div className="mb-4 flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-800/50 px-3 py-2.5">
          <span className="text-amber-400 text-sm shrink-0">⚠️</span>
          <p className="text-[11px] font-mono text-amber-300 leading-relaxed">
            Обнаружен дрейф признаков. Рекомендуем мониторинг и плановое переобучение.
          </p>
        </div>
      )}

      {/* Feature rows */}
      <div className="space-y-2.5">
        {data.map((feature) => {
          const st = getPsi(feature)
          const meta = STATUS_META[st]
          const barPct = Math.min((feature.psi / 0.3) * 100, 100)
          return (
            <div key={feature.feature} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-zinc-300">{feature.feature}</span>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-mono text-zinc-500">
                    baseline {feature.baseline.toFixed(2)} → {feature.current.toFixed(2)}
                  </span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${meta.bg} ${meta.text}`}>
                    {meta.label}
                  </span>
                  <span className={`text-[11px] font-mono font-medium ${meta.text}`}>
                    PSI {feature.psi.toFixed(2)}
                  </span>
                </div>
              </div>
              {/* Bar */}
              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${meta.bar}`}
                  style={{ width: `${barPct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center gap-4 text-[10px] font-mono text-zinc-500">
        <span>PSI &lt; 0.10 → Stable</span>
        <span>0.10–0.20 → Warning</span>
        <span>&gt; 0.20 → Critical (retraining required)</span>
      </div>
    </Card>
  )
}
