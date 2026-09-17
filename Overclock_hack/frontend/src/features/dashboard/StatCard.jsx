import { ArrowDownRight, ArrowUpRight, TrendingUp, TrendingDown, Minus } from 'lucide-react'

// Color accent per card id
const ACCENT = {
  saved:     { top: 'from-emerald-500/60 to-emerald-400/30', glow: 'hover:shadow-emerald-500/10', icon: TrendingUp,   iconColor: 'text-emerald-400', badge: 'text-emerald-400/90 bg-emerald-400/10' },
  processed: { top: 'from-sky-500/60 to-sky-400/30',         glow: 'hover:shadow-sky-500/10',     icon: Minus,        iconColor: 'text-sky-400',     badge: 'text-sky-400/90 bg-sky-400/10' },
  fpr:       { top: 'from-amber-500/60 to-amber-400/30',      glow: 'hover:shadow-amber-500/10',   icon: TrendingDown, iconColor: 'text-amber-400',   badge: 'text-amber-400/90 bg-amber-400/10' },
  precision: { top: 'from-indigo-500/60 to-indigo-400/30',    glow: 'hover:shadow-indigo-500/10',  icon: TrendingUp,   iconColor: 'text-indigo-400',  badge: 'text-indigo-400/90 bg-indigo-400/10' },
}

const DEFAULT_ACCENT = {
  top: 'from-zinc-500/40 to-zinc-400/20',
  glow: 'hover:shadow-zinc-500/10',
  icon: Minus,
  iconColor: 'text-zinc-400',
  badge: 'text-zinc-400 bg-zinc-800',
}

export default function StatCard({ id, label, value, unit = '', delta = '', trend = 'up', sub = '' }) {
  const accent = ACCENT[id] ?? DEFAULT_ACCENT
  const AccentIcon = accent.icon
  const isUp = trend !== 'down'

  return (
    <section
      className={`relative overflow-hidden bg-zinc-900/60 border border-zinc-800 rounded-xl px-5 py-4 
        transition-all duration-300 hover:border-zinc-700 hover:bg-zinc-900/80 
        hover:shadow-lg ${accent.glow} hover:-translate-y-0.5 cursor-default`}
    >
      {/* Gradient top accent bar */}
      <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${accent.top}`} />

      {/* Background icon watermark */}
      <div className="absolute right-3 top-3 opacity-[0.06] pointer-events-none">
        <AccentIcon size={52} className={accent.iconColor} />
      </div>

      {/* Label */}
      <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-2">
        {label}
      </div>

      {/* Main value */}
      <div className="font-mono text-[26px] font-semibold tracking-tight text-zinc-100 leading-none mb-2.5">
        {value}
        {unit && <span className="text-base text-zinc-500 ml-1">{unit}</span>}
      </div>

      {/* Delta + sub */}
      <div className="flex items-center gap-2 flex-wrap">
        {delta && (
          <span
            className={`inline-flex items-center gap-0.5 text-[11px] font-mono rounded-full px-1.5 py-0.5 ${
              isUp ? 'text-emerald-400 bg-emerald-400/10' : 'text-zinc-500 bg-zinc-800'
            }`}
          >
            {isUp ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
            {delta}
          </span>
        )}
        {sub && (
          <span className="text-[10px] text-zinc-600 truncate max-w-[140px]">{sub}</span>
        )}
      </div>

      {/* Live pulse indicator */}
      <div className="absolute bottom-3 right-4 flex items-center gap-1">
        <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
      </div>
    </section>
  )
}