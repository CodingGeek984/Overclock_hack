import { Languages } from 'lucide-react'
import { LANGUAGES } from '../../utils/translations'
import { useLanguage } from '../../context/LanguageContext'

export default function LanguageSelector({ className = '' }) {
  const { lang, setLanguage } = useLanguage()

  return (
    <div
      className={`flex items-center gap-0.5 rounded-full bg-zinc-100 p-1 ${className}`}
      role="group"
      aria-label="Language / Язык / Тіл"
    >
      <Languages size={13} className="text-zinc-400 ml-1.5 mr-0.5 shrink-0" />
      {LANGUAGES.map((option) => {
        const active = lang === option.code
        return (
          <button
            key={option.code}
            type="button"
            onClick={() => setLanguage(option.code)}
            aria-pressed={active}
            className={`relative px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
              active
                ? 'bg-white text-zinc-950 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
          >
            {option.label}
            {active && (
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-cyan-500 ring-2 ring-white" />
            )}
          </button>
        )
      })}
    </div>
  )
}