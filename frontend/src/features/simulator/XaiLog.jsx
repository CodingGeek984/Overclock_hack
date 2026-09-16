import { formatTime } from '../../utils/formatters'

const LEVEL_BADGE = {
  info: 'bg-zinc-400/10 text-zinc-300',
  warn: 'bg-amber-400/10 text-amber-300',
  danger: 'bg-rose-400/10 text-rose-300',
  success: 'bg-emerald-400/10 text-emerald-300',
}

export default function XaiLog({ steps = [], thinking = false }) {
  return (
    <div className="rounded-2xl bg-white/[0.05] p-4 font-mono text-xs leading-relaxed text-zinc-400 max-h-60 overflow-y-auto">
      <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-white/10">
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
          LLM-assistant log
        </span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
          {thinking ? 'thinking' : `trace:${steps.length}`}
        </span>
      </div>

      {thinking && (
        <div className="text-zinc-500">
          {['feature_extract', 'model_inference', 'shap_analyze'].map((step, i) => (
            <div key={step} className="opacity-60 animate-pulse">
              {i + 1}. {step} ...
            </div>
          ))}
        </div>
      )}

      {steps.map((step, i) => {
        const badge = LEVEL_BADGE[step.level] ?? LEVEL_BADGE.info
        return (
          <div key={`${step.time?.getTime() ?? i}-${i}`} className="flex gap-2 animate-fade-in">
            <span className="text-zinc-600 shrink-0">{formatTime(step.time ?? new Date())}</span>
            <span className={`shrink-0 px-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide self-start ${badge}`}>
              {step.level}
            </span>
            <span className="text-zinc-300 min-w-0">{step.text}</span>
          </div>
        )
      })}

      {!thinking && steps.length === 0 && (
        <div className="text-zinc-600 text-center py-5">ожидание анализа</div>
      )}
    </div>
  )
}