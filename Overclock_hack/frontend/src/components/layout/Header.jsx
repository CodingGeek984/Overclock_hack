import { ShieldHalf } from 'lucide-react'

const TABS = [
  { id: 'dashboard', label: 'Дашборд' },
  { id: 'simulator', label: 'Симулятор' },
  { id: 'batch', label: 'Batch 100k' },
]

const LANGS = ['RU', 'KZ', 'EN']

export default function Header({ activeTab, onTabChange, lang, onLangChange }) {
  return (
    <header className="sticky top-0 z-40 h-14 border-b border-zinc-800 bg-zinc-950/95">
      <div className="flex items-center justify-between gap-3 h-full px-4 max-w-[1200px] mx-auto">
        <div className="flex items-center gap-2.5 shrink-0">
          <span className="flex items-center justify-center w-7 h-7 rounded-md border border-zinc-800 bg-zinc-900 text-zinc-300">
            <ShieldHalf size={15} />
          </span>
          <div className="leading-tight">
            <div className="text-[13px] font-semibold tracking-tight text-zinc-100">Fraud Hunter</div>
            <div className="text-[10px] font-mono text-zinc-500 tracking-widest">SYS_v2.6</div>
          </div>
        </div>

        <nav className="flex items-center bg-zinc-900 p-1 rounded-md border border-zinc-800">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange?.(tab.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-4 shrink-0">
          <div className="hidden md:flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-[10px] font-mono text-zinc-500 tracking-wide">ENGINE: ONLINE</span>
          </div>

          <div className="hidden sm:flex items-center bg-zinc-900 p-0.5 rounded-md border border-zinc-800">
            {LANGS.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => onLangChange?.(l)}
                className={`px-2 py-1 rounded text-[10px] font-mono transition-colors ${
                  lang === l ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>
    </header>
  )
}