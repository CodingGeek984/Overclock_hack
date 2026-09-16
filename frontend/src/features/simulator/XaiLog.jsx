import { formatTime } from '../../utils/formatters'

const LEVEL_TEXT = {
  info: 'text-zinc-400',
  warn: 'text-amber-400/90',
  danger: 'text-rose-400/90',
  success: 'text-emerald-400/90',
}

export default function XaiLog({ steps = [], thinking = false }) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs leading-relaxed text-zinc-400 max-h-64 overflow-y-auto">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-800/70">
        <span className="text-[10px] uppercase tracking-wider text-zinc-600">xai_reasoning</span>
        <span className="text-[10px] text-zinc-600">{thinking ? 'thinking' : `trace:${steps.length}`}</span>
      </div>

      {thinking && (
        <div className="text-zinc-500">
          {['feature_extract', 'model_inference', 'shap_analyze'].map((step, i) => (
            <div key={step} className="opacity-60">
              {i + 1}. {step} ...
            </div>
          ))}
        </div>
      )}

      {steps.map((step, i) => {
        const level = LEVEL_TEXT[step.level] ?? LEVEL_TEXT.info
        return (
          <div key={`${step.time?.getTime() ?? i}-${i}`} className="flex gap-2 animate-fade-in">
            <span className="text-zinc-600 shrink-0">{formatTime(step.time ?? new Date())}</span>
            <span className={`shrink-0 ${level}`}>{step.level}</span>
            <span className="text-zinc-300 min-w-0">{step.text}</span>
          </div>
        )
      })}

      {!thinking && steps.length === 0 && (
        <div className="text-zinc-600 text-center py-4">ожидание анализа</div>
      )}
    </div>
  )
}