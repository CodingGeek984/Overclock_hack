import { PRESETS } from '../../services/mockData'
import { useLanguage } from '../../context/LanguageContext'

const PRESET_KEY = {
  legit: 'presetLegit',
  borderline: 'presetBorderline',
  fraud: 'presetFraud',
}

const TONE_BY_ID = {
  legit: 'emerald',
  borderline: 'amber',
  fraud: 'rose',
}

const TONE = {
  emerald: {
    active: 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/25',
    idle: 'bg-white border-zinc-200 text-zinc-700 hover:border-emerald-300 hover:bg-emerald-50/50',
  },
  amber: {
    active: 'bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-500/25',
    idle: 'bg-white border-zinc-200 text-zinc-700 hover:border-amber-300 hover:bg-amber-50/50',
  },
  rose: {
    active: 'bg-rose-500 border-rose-500 text-white shadow-lg shadow-rose-500/25',
    idle: 'bg-white border-zinc-200 text-zinc-700 hover:border-rose-300 hover:bg-rose-50/50',
  },
}

export default function Presets({ onSelect, activeId = null, presets = PRESETS }) {
  const { t } = useLanguage()

  const rows = presets.length > 0 ? presets : PRESETS

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
      {rows.map((p) => {
        const toneName = p.tone ?? TONE_BY_ID[p.id] ?? 'emerald'
        const tone = TONE[toneName] ?? TONE.emerald
        const active = activeId === p.id
        const label = t[PRESET_KEY[p.id] ?? 'presetLegit']
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect?.(p)}
            className={`flex items-center justify-center gap-2 rounded-full border px-4 py-3 text-sm font-semibold transition-all active:scale-[0.98] ${
              active ? tone.active : tone.idle
            }`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}