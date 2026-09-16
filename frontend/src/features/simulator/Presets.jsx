import { PRESETS } from '../../services/mockData'

const TONE = {
  emerald: {
    dot: 'bg-emerald-500',
    ring: 'text-emerald-600',
    active: 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/25',
    idle: 'bg-white border-zinc-200 text-zinc-700 hover:border-emerald-300 hover:bg-emerald-50/50',
  },
  amber: {
    dot: 'bg-amber-500',
    ring: 'text-amber-600',
    active: 'bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-500/25',
    idle: 'bg-white border-zinc-200 text-zinc-700 hover:border-amber-300 hover:bg-amber-50/50',
  },
  rose: {
    dot: 'bg-rose-500',
    ring: 'text-rose-600',
    active: 'bg-rose-500 border-rose-500 text-white shadow-lg shadow-rose-500/25',
    idle: 'bg-white border-zinc-200 text-zinc-700 hover:border-rose-300 hover:bg-rose-50/50',
  },
}

export default function Presets({ onSelect, activeId = null }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
      {PRESETS.map((p) => {
        const tone = TONE[p.tone]
        const active = activeId === p.id
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect?.(p)}
            className={`flex items-center justify-center gap-2 rounded-full border px-4 py-3 text-sm font-semibold transition-all active:scale-[0.98] ${
              active ? tone.active : tone.idle
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${tone.dot}`} />
            {p.label}
          </button>
        )
      })}
    </div>
  )
}