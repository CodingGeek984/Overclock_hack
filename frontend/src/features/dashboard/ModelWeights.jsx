import { RotateCcw } from 'lucide-react'
import Slider from '../../components/ui/Slider.jsx'
import Spinner from '../../components/ui/Spinner.jsx'

export const DEFAULT_WEIGHTS = { amount: 19, geo: 15, vpn: 17, device: 11, velocity: 14 }

const WEIGHT_META = [
  { key: 'amount', color: '#f59e0b' },
  { key: 'geo', color: '#ef4444' },
  { key: 'vpn', color: '#8b5cf6' },
  { key: 'device', color: '#06b6d4' },
  { key: 'velocity', color: '#ec4899' },
]

export default function ModelWeights({ weights, saving, onChange, onReset, t }) {
  return (
    <div className="rounded-[32px] bg-white border border-zinc-200 p-6 sm:p-8">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-zinc-950">{t.modelTitle}</h3>
          <p className="text-sm text-zinc-500 mt-1">{t.modelSub}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-600 shrink-0">
          {saving ? (
            <>
              <Spinner size={12} label="" />
              {t.modelSaving}
            </>
          ) : (
            t.modelSaved
          )}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 mt-6">
        {WEIGHT_META.map(({ key, color }) => (
          <div key={key} className="py-1">
            <Slider
              label={t[`weight${key[0].toUpperCase()}${key.slice(1)}`]}
              value={weights[key] ?? 0}
              onChange={(v) => onChange(key, v)}
              min={0}
              max={30}
              format={(v) => `+${v} pts`}
              accent={color}
            />
          </div>
        ))}
      </div>

      <div className="mt-5 pt-5 border-t border-zinc-100 flex items-center justify-between gap-3">
        <span className="text-[11px] font-mono text-zinc-400">
          {t.weightHint}
        </span>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3.5 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-200 transition-colors"
        >
          <RotateCcw size={12} />
          {t.modelReset}
        </button>
      </div>
    </div>
  )
}