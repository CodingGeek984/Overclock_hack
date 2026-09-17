import { useMemo } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

// Waterfall chart: shows base score + each SHAP factor contributing up/down
export default function ShapWaterfall({ factors = [], score = 0 }) {
  const BASE = 0.5 // model base value

  // Build waterfall segments
  const segments = useMemo(() => {
    let running = BASE
    return factors.map((f) => {
      const start = running
      running = Math.max(0, Math.min(1, running + f.effect))
      return { ...f, start, end: running, isPositive: f.effect > 0 }
    })
  }, [factors])

  const maxAbs = Math.max(...factors.map((f) => Math.abs(f.effect)), 0.01)
  const BAR_W = 220 // max px width for bars

  // Natural language summary
  const topFactor = factors[0]
  const positives = factors.filter((f) => f.effect > 0)
  const negatives = factors.filter((f) => f.effect < 0)

  return (
    <div className="space-y-5">
      {/* Natural language summary */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-4 py-3 space-y-1.5">
        <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-2">
          Объяснение решения
        </p>
        {topFactor && (
          <p className="text-sm text-zinc-200 leading-relaxed">
            <span className="text-rose-400 font-medium">Основной фактор риска:</span>{' '}
            <span className="font-medium text-zinc-100">{topFactor.name}</span>{' '}
            <span className="text-zinc-400">— {topFactor.detail}.</span>
          </p>
        )}
        {positives.length > 1 && (
          <p className="text-xs text-zinc-400 leading-relaxed">
            <span className="text-rose-400/80">Повышают риск:</span>{' '}
            {positives.slice(1).map((f) => f.name).join(', ')}.
          </p>
        )}
        {negatives.length > 0 && (
          <p className="text-xs text-zinc-500 leading-relaxed">
            <span className="text-emerald-400/80">Снижают риск:</span>{' '}
            {negatives.map((f) => f.name).join(', ')}.
          </p>
        )}
      </div>

      {/* Waterfall bars */}
      <div>
        <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-3">
          SHAP Waterfall — вклад факторов
        </p>
        <div className="space-y-2">
          {/* Base value row */}
          <div className="flex items-center gap-3 group">
            <div className="w-36 shrink-0 text-right">
              <span className="text-[11px] font-mono text-zinc-500">base_value</span>
            </div>
            <div className="flex-1 flex items-center gap-2">
              <div
                className="h-6 rounded-sm bg-zinc-700/50 border border-zinc-700 flex items-center justify-end pr-2"
                style={{ width: `${(BASE / 1) * BAR_W}px` }}
              >
                <span className="text-[10px] font-mono text-zinc-400">0.50</span>
              </div>
            </div>
          </div>

          {/* Factor rows */}
          {segments.map((seg, i) => {
            const absEffect = Math.abs(seg.effect)
            const barPx = Math.round((absEffect / maxAbs) * 100)
            const isPos = seg.isPositive
            return (
              <div key={seg.name} className="flex items-center gap-3 group">
                <div className="w-36 shrink-0 text-right">
                  <span className="text-[11px] font-mono text-zinc-300 group-hover:text-zinc-100 transition-colors truncate block">
                    {seg.name}
                  </span>
                </div>
                <div className="flex-1 flex items-center gap-2">
                  {/* Indented start offset */}
                  <div style={{ width: `${(Math.min(seg.start, seg.end) / 1) * BAR_W}px` }} />
                  {/* Effect bar */}
                  <div
                    className={`h-6 rounded-sm flex items-center justify-center relative transition-all duration-300 ${
                      isPos
                        ? 'bg-rose-500/25 border border-rose-500/50'
                        : 'bg-emerald-500/25 border border-emerald-500/50'
                    }`}
                    style={{ width: `${Math.max(barPx * 1.2, 28)}px` }}
                    title={seg.detail}
                  >
                    <span
                      className={`text-[10px] font-mono font-medium ${
                        isPos ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    >
                      {isPos ? '+' : ''}{seg.effect.toFixed(2)}
                    </span>
                  </div>
                  {/* End value */}
                  <span className="text-[10px] font-mono text-zinc-500">
                    → {seg.end.toFixed(2)}
                  </span>
                </div>
                {/* Icon */}
                <div className="shrink-0">
                  {isPos ? (
                    <TrendingUp size={12} className="text-rose-400" />
                  ) : (
                    <TrendingDown size={12} className="text-emerald-400" />
                  )}
                </div>
              </div>
            )
          })}

          {/* Final score row */}
          <div className="flex items-center gap-3 pt-1 border-t border-zinc-800">
            <div className="w-36 shrink-0 text-right">
              <span className="text-[11px] font-mono text-zinc-300 font-medium">risk_score</span>
            </div>
            <div className="flex-1 flex items-center gap-2">
              <div
                className="h-7 rounded-md flex items-center justify-center"
                style={{
                  width: `${(score / 100) * BAR_W}px`,
                  background: score >= 80
                    ? 'linear-gradient(90deg, rgba(244,63,94,0.2), rgba(244,63,94,0.4))'
                    : score >= 50
                    ? 'linear-gradient(90deg, rgba(251,191,36,0.2), rgba(251,191,36,0.4))'
                    : 'linear-gradient(90deg, rgba(52,211,153,0.2), rgba(52,211,153,0.4))',
                  border: `1px solid ${score >= 80 ? 'rgba(244,63,94,0.5)' : score >= 50 ? 'rgba(251,191,36,0.5)' : 'rgba(52,211,153,0.5)'}`,
                }}
              >
                <span
                  className={`text-sm font-mono font-bold ${
                    score >= 80 ? 'text-rose-400' : score >= 50 ? 'text-amber-400' : 'text-emerald-400'
                  }`}
                >
                  {score}%
                </span>
              </div>
            </div>
            <Minus size={12} className="text-zinc-600 shrink-0" />
          </div>
        </div>
      </div>

      {/* Factor detail table */}
      <div className="rounded-md border border-zinc-800 overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-zinc-950/60 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
              <th className="px-3 py-2">Фактор</th>
              <th className="px-3 py-2">SHAP</th>
              <th className="px-3 py-2">Деталь</th>
            </tr>
          </thead>
          <tbody>
            {factors.map((f) => (
              <tr key={f.name} className="border-t border-zinc-800/60 hover:bg-zinc-900/30">
                <td className="px-3 py-2 font-mono text-zinc-300">{f.name}</td>
                <td className={`px-3 py-2 font-mono font-medium ${f.effect >= 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {f.effect >= 0 ? '+' : ''}{f.effect.toFixed(3)}
                </td>
                <td className="px-3 py-2 text-zinc-500">{f.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
