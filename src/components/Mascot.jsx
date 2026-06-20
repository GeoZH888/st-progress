import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import './Mascot.css'

/*
 * Mascot / AI-assistant: Leonardo
 * --------------------------------
 * One guide for all three UI languages — a Renaissance polymath fits the site
 * theme (history of progress) and the math features (scroll + flask in his
 * hands map straight to /math and /gallery).
 *
 * Avatar art lives at public/mascots/leonardo.png and is rendered free of
 * any container circle / border so the figure reads as a standalone character.
 *
 * The speech-bubble tip is trilingual and pulled from i18n
 * (mascot.tips.<tipKey>), so pass a `tipKey` matching the current page
 * (e.g. "home", "timeline", "map", "math", "gallery").
 */

export default function Mascot({ tipKey = 'home' }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(true)

  const name = t('mascot.name') // "Leonardo" / "莱昂纳多"
  const tip = t(`mascot.tips.${tipKey}`, { defaultValue: t('mascot.tips.home') })

  return (
    <div className="mascot" data-mascot="leonardo">
      {open && (
        <div className="mascot-bubble" role="status">
          <button
            className="mascot-close"
            aria-label="Close"
            onClick={() => setOpen(false)}
          >
            ×
          </button>
          <strong className="mascot-name">{name}</strong>
          <p>{tip}</p>
        </div>
      )}
      <button
        className="mascot-avatar"
        title={name}
        aria-label={name}
        onClick={() => setOpen((v) => !v)}
      >
        <img src="/mascots/leonardo.png" alt={name} className="mascot-figure" />
      </button>
    </div>
  )
}
