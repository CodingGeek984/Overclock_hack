import { ArrowDownRight, ArrowUpRight } from 'lucide-react'

export default function StatCard({ label, value, unit = '', delta = '', trend = 'up', sub = '', tone = 'light' }) {
  const up = trend !== 'down'
  const dark = tone === 'dark'

  return (
    <section
      className={`rounded-3xl p-6 ${
        dark ? 'bg-zinc-950 text-white' : 'bg-white border border-zinc-200'
      }`}
    >
      <div
        className={`text-xs font-semibold uppercase tracking-wider ${
          dark ? 'text-zinc-500' : 'text-zinc-500'
        }`}
      >
        {label}
      </div>
      <div className="mt-2 text-[40px] font-extrabold tracking-tight leading-none">
        {value}
        {unit && <span className={`text-xl font-bold ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>{unit}</span>}
      </div>
      <div className="mt-3 flex items-center gap-2">
        {delta && (
          <span
            className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
              up ? 'text-emerald-600' : 'text-zinc-400'
            }`}
          >
            {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            {delta}
          </span>
        )}
        {sub && (
          <span className={`text-xs truncate ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>{sub}</span>
        )}
      </div>
    </section>
  )
}