import { Suspense, lazy, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CATEGORIES } from '../lib/categories'
import { fetchFeaturedSurfaces, sharedRowToSurface } from '../lib/surfacesDb'
import { localizedName } from '../lib/surfaces'

// Lazy: only pulls in three.js if there are any featured surfaces to show.
const SurfaceViewer = lazy(() => import('../components/SurfaceViewer'))

// The three ways to explore the same dataset (secondary nav on the Home page).
const EXPLORE_MODES = [
  { key: 'timeline', to: '/timeline', emoji: '🕰️', cls: 'tile-timeline' },
  { key: 'fields', to: '/fields', emoji: '🧪', cls: 'tile-fields' },
  { key: 'map', to: '/map', emoji: '🗺️', cls: 'tile-map' }
]

function FeaturedCard({ row, lang }) {
  const compiled = (() => {
    try { return sharedRowToSurface(row) } catch { return null }
  })()
  if (!compiled) return null
  const isStatic = row.display_mode === 'static'
  return (
    <Link to="/gallery" className="featured-card" aria-label={localizedName(compiled, lang)}>
      <div className="featured-viewport">
        <Suspense fallback={<div className="featured-loading">…</div>}>
          <SurfaceViewer
            surface={compiled}
            paletteId="viridis"
            backgroundId="renaissance"
            renderMode="solid"
            motion={isStatic ? 0 : 0.4}
            autoRotate={!isStatic}
            interactive={false}
          />
        </Suspense>
      </div>
      <div className="featured-name">{localizedName(compiled, lang)}</div>
    </Link>
  )
}

export default function Home() {
  const { t, i18n } = useTranslation()
  const [featured, setFeatured] = useState([])

  useEffect(() => {
    let active = true
    fetchFeaturedSurfaces(4)
      .then((rows) => { if (active) setFeatured(rows) })
      .catch(() => { /* no table yet → just skip the section */ })
    return () => { active = false }
  }, [])

  const lang = i18n.language

  return (
    <div className="page">
      <h1 className="page-title">{t('home.title')}</h1>
      <p className="page-subtitle">{t('home.subtitle')}</p>

      {/* Primary: pick a super-category. */}
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

      {/* From the 3D Gallery (only when admin has featured something) */}
      {featured.length > 0 && (
        <>
          <h2 className="section-heading">{t('home.fromGallery')}</h2>
          <div className="featured-grid">
            {featured.map((row) => (
              <FeaturedCard key={row.id} row={row} lang={lang} />
            ))}
          </div>
        </>
      )}

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
