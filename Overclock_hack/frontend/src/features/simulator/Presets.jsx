import { PRESETS } from '../../services/mockData'

const TONE_DOT = {
  emerald: 'bg-emerald-400',
  amber: 'bg-amber-400',
  rose: 'bg-rose-400',
}

export default function Presets({ onSelect }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      {PRESETS.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onSelect?.(p)}
          className="flex items-center justify-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-mono text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 hover:border-zinc-700 transition-colors active:scale-[0.99]"
        >
          <span className={`w-1.5 h-1.5 rounded-full ${TONE_DOT[p.tone]}`} />
          <span>{p.label}</span>
        </button>
      ))}
    </div>
  )
}