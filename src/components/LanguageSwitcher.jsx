import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGS } from '../i18n'

// Flag switcher: 🇨🇳 ZH / 🇮🇹 IT / 🇬🇧 EN.
// Changing language persists to localStorage (handled in i18n/index.js) and
// drives both the UI strings and which Supabase *_lang column is rendered.
export default function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const current = i18n.language

  return (
    <div className="lang-switcher" role="group" aria-label="Language">
      {SUPPORTED_LANGS.map((lang) => (
        <button
          key={lang.code}
          type="button"
          className={`lang-btn${current === lang.code ? ' active' : ''}`}
          aria-pressed={current === lang.code}
          title={lang.name}
          onClick={() => i18n.changeLanguage(lang.code)}
        >
          <span className="flag" aria-hidden="true">{lang.flag}</span>
          <span>{lang.label}</span>
        </button>
      ))}
    </div>
  )
}
