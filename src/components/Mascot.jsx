import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import './Mascot.css'

/*
 * Mascot / AI-assistant: Leonardo
 * --------------------------------
 * One guide for all three UI languages — a Renaissance polymath fits the site
 * theme (history of progress) and avoids picking one culture's avatar over
 * the others. Replaced the prior dual 巧巧 / Claudio system on 2026-06-20.
 *
 * The speech-bubble tip is trilingual and pulled from i18n
 * (mascot.tips.<tipKey>), so pass a `tipKey` matching the current page
 * (e.g. "home", "timeline", "map", "math", "gallery").
 *
 * >>> REPLACE PLACEHOLDER ART HERE <<<
 * The avatar below is an inline placeholder SVG. To use final artwork, drop a
 * file into /public/mascots/ (e.g. leonardo.png) and swap the <LeonardoAvatar />
 * call for:
 *   <img src="/mascots/leonardo.png" alt={name} />
 */

function LeonardoAvatar() {
  return (
    <svg viewBox="0 0 80 80" width="56" height="56" aria-hidden="true">
      {/* parchment background */}
      <circle cx="40" cy="40" r="38" fill="#e8d9b5" />

      {/* beard back fill (lighter, behind the face) */}
      <path
        d="M22 48c0 14 8 24 18 24s18-10 18-24c-3 4-9 6-18 6s-15-2-18-6z"
        fill="#f0ebe0"
      />

      {/* face */}
      <circle cx="40" cy="42" r="16" fill="#f5d4ad" />

      {/* cap: soft floppy Renaissance beret in deep red */}
      <path
        d="M22 30c0-8 8-14 18-14s18 6 18 14c-2-2-7-3-18-3s-16 1-18 3z"
        fill="#8a2424"
      />
      <ellipse cx="40" cy="23" rx="14" ry="3" fill="#a83232" />
      <path
        d="M22 30c2-1 8-2 18-2s16 1 18 2c0 1-2 2-3 3-2-1-7-2-15-2s-13 1-15 2c-1-1-3-2-3-3z"
        fill="#651818"
      />

      {/* hair tufts peeking out under the cap */}
      <path
        d="M23 34c1 3 1 5 0 8 M57 34c-1 3 -1 5 0 8"
        stroke="#cfc7b3"
        strokeWidth="2.2"
        fill="none"
        strokeLinecap="round"
      />

      {/* eyebrows (scholarly) */}
      <path d="M30 37c2-1 6-1 8 0" stroke="#7a6b58" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <path d="M42 37c2-1 6-1 8 0" stroke="#7a6b58" strokeWidth="1.6" strokeLinecap="round" fill="none" />

      {/* eyes + highlights */}
      <circle cx="34" cy="41" r="1.9" fill="#2e211a" />
      <circle cx="46" cy="41" r="1.9" fill="#2e211a" />
      <circle cx="34.7" cy="40.4" r="0.55" fill="#fff" />
      <circle cx="46.7" cy="40.4" r="0.55" fill="#fff" />

      {/* nose hint */}
      <path d="M40 43c-1 2-1 4 0 5 1 0 2 0 2 0" stroke="#c4977a" strokeWidth="1" fill="none" strokeLinecap="round" />

      {/* moustache */}
      <path
        d="M30 51c3 2 7 2 10 0 3 2 7 2 10 0"
        stroke="#cfc7b3"
        strokeWidth="2.4"
        fill="none"
        strokeLinecap="round"
      />

      {/* beard cascade (the iconic signature) */}
      <path
        d="M28 53c1 5 3 9 4 12 1 3 0 5-1 7 4-1 6-1 9-1s5 0 9 1c-1-2-2-4-1-7 1-3 3-7 4-12 -3 2-7 3-12 3s-9-1-12-3z"
        fill="#ece5d2"
        stroke="#cfc7b3"
        strokeWidth="0.5"
      />
      <path
        d="M33 58c0 4 0 7 1 10 M40 60c0 4 0 7 0 10 M47 58c0 4 0 7 -1 10"
        stroke="#cfc7b3"
        strokeWidth="0.6"
        fill="none"
      />

      {/* subtle warm smile beneath the moustache */}
      <path d="M36 50c2 1 6 1 8 0" stroke="#a8836a" strokeWidth="0.8" fill="none" strokeLinecap="round" />
    </svg>
  )
}

export default function Mascot({ tipKey = 'home' }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(true)

  const name = t('mascot.name') // "Leonardo" in all three locales
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
        <LeonardoAvatar />
      </button>
    </div>
  )
}
