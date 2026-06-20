import { lazy, Suspense, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import './Mascot.css'

// Lazy: the chat panel pulls its own CSS and is only mounted once the user
// clicks Leonardo (or another component dispatches `leonardo-open`).
const LeonardoChat = lazy(() => import('./LeonardoChat'))

/*
 * Mascot / AI-assistant: Leonardo
 * --------------------------------
 * Clicking the avatar opens the LeonardoChat side panel. Other components
 * (e.g. the /gallery Ask Leonardo button) can also open the panel with a
 * pre-filled question by dispatching:
 *   window.dispatchEvent(new CustomEvent('leonardo-open', { detail: { prompt } }))
 */

export default function Mascot() {
  const { t } = useTranslation()
  const [chatOpen, setChatOpen] = useState(false)
  const [initialPrompt, setInitialPrompt] = useState(null)
  const name = t('mascot.name')

  // Listen for external "open the chat" requests.
  useEffect(() => {
    const handler = (e) => {
      const prompt = e?.detail?.prompt
      if (prompt) setInitialPrompt(prompt)
      setChatOpen(true)
    }
    window.addEventListener('leonardo-open', handler)
    return () => window.removeEventListener('leonardo-open', handler)
  }, [])

  function handleClose() {
    setChatOpen(false)
    setInitialPrompt(null)
  }

  return (
    <>
      <div className="mascot" data-mascot="leonardo">
        <button
          className="mascot-avatar"
          title={name}
          aria-label={t('leo.openChat', { name })}
          onClick={() => { setInitialPrompt(null); setChatOpen(true) }}
        >
          <img src="/mascots/leonardo.png" alt={name} className="mascot-figure" />
        </button>
      </div>
      {chatOpen && (
        <Suspense fallback={null}>
          <LeonardoChat open={chatOpen} onClose={handleClose} initialPrompt={initialPrompt} />
        </Suspense>
      )}
    </>
  )
}
