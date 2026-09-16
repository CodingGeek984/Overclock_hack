import { UserRound } from 'lucide-react'

const TABS = [
  { id: 'dashboard', label: 'Дашборд' },
  { id: 'simulator', label: 'Live-Симулятор' },
  { id: 'batch', label: 'Batch 100k' },
]

const LANGS = ['RU', 'KZ', 'EN']

export default function Header({ activeTab, onTabChange, lang, onLangChange }) {
  return (
    <header className="sticky top-0 z-40 h-16 border-b border-zinc-100 bg-white/85 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-4 h-full px-4 sm:px-6 lg:px-8 max-w-[1200px] mx-auto">
        <a href="#" className="flex items-center gap-2.5 shrink-0" aria-label="FraudHunter">
          <span className="flex items-center justify-center w-9 h-9 rounded-full bg-zinc-950 text-white">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M13 2 4.8 13.2c-.4.5.1 1.2.7 1.2H11l-1 7.6c-.08.6.68.9 1 .5L19.2 11c.4-.5-.1-1.2-.7-1.2H13l1-7.6c.08-.6-.68-.9-1-.5Z"
                fill="currentColor"
              />
            </svg>
          </span>
          <span className="text-[19px] font-extrabold tracking-tight text-zinc-950 leading-none">
            FraudHunter
          </span>
        </a>

        <nav className="hidden md:flex items-center gap-1 rounded-full bg-zinc-100 p-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange?.(tab.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-zinc-950 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <nav className="md:hidden flex items-center gap-1 rounded-full bg-zinc-100 p-0.5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange?.(tab.id)}
              aria-label={tab.label}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-zinc-950 shadow-sm'
                  : 'text-zinc-500'
              }`}
            >
              {tab.label.split(' ')[0]}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-0.5 rounded-full bg-zinc-100 p-1">
            {LANGS.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => onLangChange?.(l)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                  lang === l ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-500'
                }`}
              >
                {l}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-950 text-white text-sm font-semibold hover:bg-zinc-800 transition-colors active:scale-[0.98]"
          >
            <UserRound size={15} strokeWidth={2.2} />
            <span className="hidden lg:inline">Аналитик профиль</span>
            <span className="lg:hidden">Профиль</span>
          </button>
        </div>
      </div>
    </header>
  )
}