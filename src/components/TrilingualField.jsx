import AiAssist from './AiAssist'

const LANGS = ['en', 'it', 'zh']

/**
 * Shared trilingual editor block used in Milestones / Figures / Locations admin
 * forms. Renders three inputs (one per language) plus a ✨AI button on each that
 * translates from its language into the other two.
 *
 * Props:
 *   field      — 'title' | 'desc' | 'name' | 'bio'  (controls AI length hint)
 *   values     — { en, it, zh } current values
 *   onChange(lang, value) — called for any per-language input change
 *   multiline  — render <textarea> instead of <input>
 */
export default function TrilingualField({ field, values, onChange, multiline = false }) {
  const Input = multiline ? 'textarea' : 'input'

  function handleAiResult(translations) {
    for (const [lang, value] of Object.entries(translations)) {
      if (LANGS.includes(lang)) onChange(lang, value)
    }
  }

  return (
    <div className="admin-trilingual">
      {LANGS.map((lang) => (
        <div key={lang} className="admin-trilingual-block">
          <header>
            <span>{lang.toUpperCase()}</span>
            <AiAssist
              field={field}
              sourceLang={lang}
              sourceText={values?.[lang]}
              onResult={handleAiResult}
            />
          </header>
          <Input
            {...(multiline ? {} : { type: 'text' })}
            value={values?.[lang] ?? ''}
            onChange={(e) => onChange(lang, e.target.value)}
          />
        </div>
      ))}
    </div>
  )
}
