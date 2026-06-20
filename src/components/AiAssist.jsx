import { useState } from 'react'
import { useTranslation } from 'react-i18next'

const LANGS = ['en', 'it', 'zh']

/**
 * Small ✨AI button used inside trilingual editor blocks.
 * Click it on the source-language input to translate into the other two.
 *
 * Props:
 *   field        — 'title' | 'name' | 'desc' | 'bio' (controls Claude's length hint)
 *   sourceLang   — 'en' | 'it' | 'zh'
 *   sourceText   — current value of the source field
 *   onResult({en, it, zh}) — called with the model's translations; only the
 *                            target-lang keys are present
 */
export default function AiAssist({ field, sourceLang, sourceText, onResult }) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleClick() {
    const text = (sourceText || '').trim()
    if (!text) {
      setError(t('admin.ai.needsSource'))
      setTimeout(() => setError(null), 2500)
      return
    }
    const targetLangs = LANGS.filter((l) => l !== sourceLang)
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ai-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'translate',
          sourceLang,
          sourceText: text,
          targetLangs,
          field
        })
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`)
      onResult(body?.translations || {})
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      className="ai-assist-btn"
      onClick={handleClick}
      disabled={loading}
      title={error || t('admin.ai.translateOthers')}
    >
      ✨ {loading ? '…' : t('admin.ai.label')}
    </button>
  )
}
