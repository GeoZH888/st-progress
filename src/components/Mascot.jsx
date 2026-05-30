import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import './Mascot.css'

/*
 * Mascot system (shared concept with the sibling "Travel in Italia" app)
 * ---------------------------------------------------------------------
 * Two guides that switch by active UI language:
 *   - 巧巧 (Qiǎoqiǎo), female, shown when language is `zh`
 *   - Claudio,        male,   shown when language is `it` or `en`
 *
 * The speech-bubble tip is trilingual and pulled from i18n (mascot.tips.<tipKey>),
 * so pass a `tipKey` matching the current page (e.g. "home", "timeline", "map").
 *
 * >>> REPLACE PLACEHOLDER ART HERE <<<
 * The avatars below are inline placeholder SVGs (clearly-female / clearly-male
 * friendly characters, given a science/explorer accent). To use final artwork,
 * drop files into /public/mascots/ (e.g. qiaoqiao.png, claudio.png) and swap the
 * <…Avatar/> calls for:
 *   <img src={`/mascots/${isZh ? 'qiaoqiao' : 'claudio'}.png`} alt={name} />
 */

function QiaoqiaoAvatar() {
  // Placeholder: friendly female guide — bob haircut, science accent.
  return (
    <svg viewBox="0 0 80 80" width="56" height="56" aria-hidden="true">
      <circle cx="40" cy="40" r="38" fill="#e6c069" />
      {/* hair back */}
      <path d="M16 44a24 24 0 0 1 48 0c0 6-4 6-4 6H20s-4 0-4-6z" fill="#33271c" />
      {/* face */}
      <circle cx="40" cy="40" r="17" fill="#ffe0c2" />
      {/* fringe */}
      <path d="M23 36c2-9 9-14 17-14s15 5 17 14c-5-3-11-4-17-4s-12 1-17 4z" fill="#33271c" />
      {/* eyes */}
      <circle cx="34" cy="40" r="2.2" fill="#2e211a" />
      <circle cx="46" cy="40" r="2.2" fill="#2e211a" />
      {/* smile */}
      <path d="M35 47c2 2.5 8 2.5 10 0" stroke="#1f3a5f" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* cheeks */}
      <circle cx="31" cy="45" r="2" fill="#f3a98e" opacity="0.7" />
      <circle cx="49" cy="45" r="2" fill="#f3a98e" opacity="0.7" />
      {/* little star accent (feminine + science cue) */}
      <path d="M55 27l1.3 2.7 3 .4-2.2 2.1.5 3-2.6-1.4-2.6 1.4.5-3-2.2-2.1 3-.4z" fill="#1f3a5f" />
    </svg>
  )
}

function ClaudioAvatar() {
  // Placeholder: friendly male guide — short hair, moustache.
  return (
    <svg viewBox="0 0 80 80" width="56" height="56" aria-hidden="true">
      <circle cx="40" cy="40" r="38" fill="#9fb0d6" />
      {/* hair */}
      <path d="M24 34c0-9 7-15 16-15s16 6 16 15c-4-3-9-4-16-4s-12 1-16 4z" fill="#2a2118" />
      {/* face */}
      <circle cx="40" cy="40" r="17" fill="#ffe0c2" />
      {/* eyebrows */}
      <path d="M31 35h6M43 35h6" stroke="#2a2118" strokeWidth="2" strokeLinecap="round" />
      {/* eyes */}
      <circle cx="34" cy="40" r="2.2" fill="#2e211a" />
      <circle cx="46" cy="40" r="2.2" fill="#2e211a" />
      {/* moustache (masculine cue) */}
      <path d="M33 49c2 2 5 2 7 0 2 2 5 2 7 0" stroke="#2a2118" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      {/* smile */}
      <path d="M36 52c2 2 6 2 8 0" stroke="#1f3a5f" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </svg>
  )
}

export default function Mascot({ tipKey = 'home' }) {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(true)

  const isZh = i18n.language === 'zh'
  const name = t('mascot.name') // 巧巧 or Claudio
  const tip = t(`mascot.tips.${tipKey}`, { defaultValue: t('mascot.tips.home') })

  return (
    <div className="mascot" data-mascot={isZh ? 'qiaoqiao' : 'claudio'}>
      {open && (
        <div className="mascot-bubble" role="status">
          <button className="mascot-close" aria-label="Close" onClick={() => setOpen(false)}>
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
        {isZh ? <QiaoqiaoAvatar /> : <ClaudioAvatar />}
      </button>
    </div>
  )
}
