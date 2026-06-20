import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import './MathSearch.css'

// Splits a chunk into plain-text + $$block$$ + $inline$ pieces and renders
// each math piece through KaTeX. Falls back to raw text on parse errors.
const MATH_RE = /\$\$([\s\S]*?)\$\$|\$([^$\n]+?)\$/g

function renderLatex(tex, displayMode) {
  try {
    return katex.renderToString(tex, { displayMode, throwOnError: false })
  } catch {
    return tex
  }
}

function MathContent({ text }) {
  const parts = []
  let last = 0
  let m
  MATH_RE.lastIndex = 0
  while ((m = MATH_RE.exec(text)) !== null) {
    if (m.index > last) parts.push({ kind: 'text', value: text.slice(last, m.index) })
    if (m[1] !== undefined) parts.push({ kind: 'block', value: m[1].trim() })
    else parts.push({ kind: 'inline', value: m[2].trim() })
    last = MATH_RE.lastIndex
  }
  if (last < text.length) parts.push({ kind: 'text', value: text.slice(last) })

  return (
    <div className="math-content">
      {parts.map((p, i) => {
        if (p.kind === 'text') {
          return (
            <span key={i} className="math-text">
              {p.value}
            </span>
          )
        }
        return (
          <span
            key={i}
            className={p.kind === 'block' ? 'math-block' : 'math-inline'}
            dangerouslySetInnerHTML={{ __html: renderLatex(p.value, p.kind === 'block') }}
          />
        )
      })}
    </div>
  )
}

export default function MathSearch() {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function onSubmit(e) {
    e.preventDefault()
    const q = query.trim()
    if (!q || loading) return
    setLoading(true)
    setError(null)
    setResults(null)
    try {
      const res = await fetch('/api/math-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q, k: 8 })
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok) {
        const msg = payload?.error || `HTTP ${res.status}`
        // Heuristic: if the function isn't configured, point users at the README.
        setError(msg.includes('env') ? 'env' : 'generic')
        return
      }
      setResults(payload?.results ?? [])
    } catch {
      setError('generic')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page math-page">
      <h1 className="page-title">{t('math.title')}</h1>
      <p className="page-subtitle">{t('math.subtitle')}</p>

      <form className="math-search" onSubmit={onSubmit} role="search">
        <input
          type="search"
          className="math-input"
          placeholder={t('math.searchPlaceholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={t('math.searchPlaceholder')}
          autoFocus
        />
        <button type="submit" className="math-submit" disabled={loading || !query.trim()}>
          {loading ? t('math.searching') : t('math.searchButton')}
        </button>
      </form>

      {error === 'env' && (
        <div className="math-error">{t('math.errorEnv')}</div>
      )}
      {error === 'generic' && (
        <div className="math-error">{t('math.errorGeneric')}</div>
      )}

      {results !== null && !error && (
        results.length === 0 ? (
          <p className="math-empty">{t('math.noResults')}</p>
        ) : (
          <>
            <p className="math-count">{t('math.results', { count: results.length })}</p>
            <ol className="math-results">
              {results.map((r) => (
                <li key={r.id} className="math-card">
                  <header className="math-card-head">
                    <span className="math-card-title">{r.doc_title || r.doc_filename}</span>
                    {r.page_start != null && (
                      <span className="math-card-page">
                        {t('math.page')} {r.page_start}
                        {r.page_end && r.page_end !== r.page_start ? `–${r.page_end}` : ''}
                      </span>
                    )}
                    <span className="math-card-sim">
                      {Math.round((r.similarity ?? 0) * 100)}%
                    </span>
                  </header>
                  <MathContent text={r.content} />
                </li>
              ))}
            </ol>
          </>
        )
      )}
    </div>
  )
}
