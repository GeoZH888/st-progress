import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import zh from './locales/zh.json'
import it from './locales/it.json'
import en from './locales/en.json'

export const SUPPORTED_LANGS = [
  { code: 'zh', label: 'ZH', flag: '🇨🇳', name: '中文' },
  { code: 'it', label: 'IT', flag: '🇮🇹', name: 'Italiano' },
  { code: 'en', label: 'EN', flag: '🇬🇧', name: 'English' }
]

const STORAGE_KEY = 'stp-lang'

// Default to English, but honor a persisted choice from localStorage.
function getInitialLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && SUPPORTED_LANGS.some((l) => l.code === saved)) return saved
  } catch {
    /* localStorage unavailable (private mode, etc.) — fall through */
  }
  return 'en'
}

i18n.use(initReactI18next).init({
  resources: {
    zh: { translation: zh },
    it: { translation: it },
    en: { translation: en }
  },
  lng: getInitialLang(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false }, // React already escapes
  returnNull: false
})

// Persist whenever the language changes, and keep <html lang> in sync.
i18n.on('languageChanged', (lng) => {
  try {
    localStorage.setItem(STORAGE_KEY, lng)
  } catch {
    /* ignore */
  }
  document.documentElement.lang = lng
})

document.documentElement.lang = i18n.language

export default i18n
