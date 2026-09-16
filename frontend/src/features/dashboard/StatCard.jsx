import { ArrowDownRight, ArrowUpRight } from 'lucide-react'

export default function StatCard({ label, value, unit = '', delta = '', trend = 'up', sub = '' }) {
  const up = trend !== 'down'
  return (
    <section className="bg-zinc-900/50 border border-zinc-800 rounded-lg px-4 py-4">
      <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-1.5 font-mono text-2xl font-medium tracking-tight text-zinc-100">
        {value}
        {unit && <span className="text-base text-zinc-500">{unit}</span>}
      </div>
      <div className="mt-2 flex items-center gap-2">
        {delta && (
          <span
            className={`inline-flex items-center gap-0.5 text-[11px] font-mono ${
              up ? 'text-emerald-400/80' : 'text-zinc-500'
            }`}
          >
            {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {delta}
          </span>
        )}
        {sub && <span className="text-[11px] text-zinc-600 truncate">{sub}</span>}
      </div>
    </section>
  )
}