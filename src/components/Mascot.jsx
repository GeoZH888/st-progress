import { lazy, Suspense, useState } from 'react'
import { useTranslation } from 'react-i18next'
import './Mascot.css'

// Lazy: the chat panel pulls its own CSS and is only mounted once the user
// clicks Leonardo. Saves ~5 KB from the initial bundle.
const LeonardoChat = lazy(() => import('./LeonardoChat'))

/*
 * Mascot / AI-assistant: Leonardo
 * --------------------------------
 * One Renaissance polymath as the guide across all three UI languages.
 * Clicking the avatar opens the LeonardoChat side panel (text + camera + file
 * + voice). The avatar art lives at public/mascots/leonardo.png and is
 * rendered free of any container circle so it reads as a standalone figure.
 *
 * `tipKey` is still accepted for backwards compatibility but is no longer
 * used to render a passive bubble — the chat greeting plays that role now.
 */

export default function Mascot() {
  const { t } = useTranslation()
  const [chatOpen, setChatOpen] = useState(false)
  const name = t('mascot.name')

  return (
    <>
      <div className="mascot" data-mascot="leonardo">
        <button
          className="mascot-avatar"
          title={name}
          aria-label={t('leo.openChat', { name })}
          onClick={() => setChatOpen(true)}
        >
          <img src="/mascots/leonardo.png" alt={name} className="mascot-figure" />
        </button>
      </div>
      {chatOpen && (
        <Suspense fallback={null}>
          <LeonardoChat open={chatOpen} onClose={() => setChatOpen(false)} />
        </Suspense>
      )}
    </>
  )
}
