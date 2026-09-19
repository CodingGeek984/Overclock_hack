import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { TRANSLATIONS } from '../utils/translations.js'

const STORAGE_KEY = 'app_lang'

const LanguageContext = createContext(null)

function readInitialLang() {
  try {
    return localStorage.getItem(STORAGE_KEY) || 'ru'
  } catch {
    return 'ru'
  }
}

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(readInitialLang)

  const setLanguage = useCallback((newLang) => {
    if (!TRANSLATIONS[newLang]) return
    setLang(newLang)
    try {
      localStorage.setItem(STORAGE_KEY, newLang)
    } catch {
      /* storage unavailable */
    }
    window.location.reload()
  }, [])

  const t = useMemo(() => TRANSLATIONS[lang] ?? TRANSLATIONS.ru, [lang])

  const value = useMemo(() => ({ lang, setLanguage, t }), [lang, setLanguage, t])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return ctx
}