import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CATEGORIES } from '../lib/categories'

// The three ways to explore the same dataset (secondary nav on the Home page).
const EXPLORE_MODES = [
  { key: 'timeline', to: '/timeline', emoji: '🕰️', cls: 'tile-timeline' },
  { key: 'fields', to: '/fields', emoji: '🧪', cls: 'tile-fields' },
  { key: 'map', to: '/map', emoji: '🗺️', cls: 'tile-map' }
]

export default function Home() {
  const { t } = useTranslation()
  return (
    <div className="page">
      <h1 className="page-title">{t('home.title')}</h1>
      <p className="page-subtitle">{t('home.subtitle')}</p>

      {/* Primary: pick a super-category. Each tile lands on the Timeline
          pre-filtered to that domain via the ?cat= query param. */}
      <h2 className="section-heading">{t('home.browseDomain')}</h2>
      <div className="cat-tiles">
        {CATEGORIES.map((c) => (
          <Link
            key={c.key}
            to={`/timeline?cat=${c.key}`}
            className="cat-tile"
            style={{ background: c.gradient }}
          >
            <span className="cat-tile-emoji" aria-hidden="true">{c.emoji}</span>
            <h3>{t(`categories.${c.key}.title`)}</h3>
            <p>{t(`categories.${c.key}.desc`)}</p>
          </Link>
        ))}
      </div>

      {/* Secondary: the three explore views (also in the header nav). */}
      <h2 className="section-heading">{t('home.exploreBy')}</h2>
      <div className="mode-tiles">
        {EXPLORE_MODES.map((m) => (
          <Link key={m.key} to={m.to} className={`mode-tile ${m.cls}`}>
            <span className="tile-emoji" aria-hidden="true">{m.emoji}</span>
            <h3>{t(`home.modes.${m.key}.title`)}</h3>
            <p>{t(`home.modes.${m.key}.desc`)}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
