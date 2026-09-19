import { useLanguage } from '../../context/LanguageContext'
import LanguageSelector from '../ui/LanguageSelector'

const TABS = [
  { id: 'dashboard', key: 'dashboard', short: 'Дашборд' },
  { id: 'analytics', key: 'analytics', short: 'Analytics' },
  { id: 'simulator', key: 'simulator', short: 'Live' },
]

export default function Header({ activeTab, onTabChange }) {
  const { t } = useLanguage()

  return (
    <header className="sticky top-0 z-40 h-16 border-b border-zinc-100 bg-white/85 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-4 h-full px-4 sm:px-6 lg:px-8 max-w-[1200px] mx-auto">
        <a href="#" className="flex items-center gap-2.5 shrink-0" aria-label="FraudSeeker">
          <span className="flex items-center justify-center w-9 h-9 rounded-full bg-zinc-950 text-white">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M13 2 4.8 13.2c-.4.5.1 1.2.7 1.2H11l-1 7.6c-.08.6.68.9 1 .5L19.2 11c.4-.5-.1-1.2-.7-1.2H13l1-7.6c.08-.6-.68-.9-1-.5Z"
                fill="currentColor"
              />
            </svg>
          </span>
          <span className="text-[19px] font-extrabold tracking-tight text-zinc-950 leading-none">
            {t.appTitle}
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
{tab.key ? t[tab.key] : 'Дашборд'}
            </button>
          ))}
        </nav>

        <nav className="md:hidden flex items-center gap-1 rounded-full bg-zinc-100 p-0.5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange?.(tab.id)}
              aria-label={tab.key ? t[tab.key] : 'Дашборд'}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-zinc-950 shadow-sm'
                  : 'text-zinc-500'
              }`}
            >
              {tab.short}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:block">
            <LanguageSelector />
          </div>
        </div>
      </div>
    </header>
  )
}