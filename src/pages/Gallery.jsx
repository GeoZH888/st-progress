import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { SURFACES, DEFAULT_SURFACE_ID, getSurface, localizedName } from '../lib/surfaces'
import { fetchSharedSurfaces, sharedRowToSurface } from '../lib/surfacesDb'
import { Loading } from '../components/Status'
import './Gallery.css'

// Public /gallery is now view-only — the heavy controls (palette, background,
// motion, render mode, parameters, code editor) live in /admin/surfaces. Public
// visitors see a clean, curated experience: pick a surface from the list, watch
// it run, ask Leonardo about it.
const SurfaceViewer = lazy(() => import('../components/SurfaceViewer'))

// Locked-in defaults — what admins will see if they don't override per-surface
// (per-surface admin overrides are a separate enhancement).
const VIEW_PALETTE = 'viridis'
const VIEW_BACKGROUND = 'renaissance'
const VIEW_MOTION = 0.35
const VIEW_RENDER = 'solid'

// Visitor-controllable rotation speed (the only chip group public users see).
const SPEED_PRESETS = [
  { id: 'off',    value: 0,    glyph: '⏸' },
  { id: 'slow',   value: 0.4,  glyph: '◐' },
  { id: 'normal', value: 1.0,  glyph: '●' },
  { id: 'fast',   value: 2.2,  glyph: '⏩' }
]
const SPEED_LS_KEY = 'stp-gallery-rspeed'

function Equation({ latex }) {
  const html = katex.renderToString(latex, { displayMode: true, throwOnError: false })
  return <div className="gallery-equation" dangerouslySetInnerHTML={{ __html: html }} />
}

function askLeonardo(prompt) {
  window.dispatchEvent(new CustomEvent('leonardo-open', { detail: { prompt } }))
}

export default function Gallery() {
  const { t, i18n } = useTranslation()
  const [activeId, setActiveId] = useState(DEFAULT_SURFACE_ID)
  const [speedId, setSpeedId] = useState(() => {
    try { return localStorage.getItem(SPEED_LS_KEY) || 'normal' } catch { return 'normal' }
  })
  const rotationSpeed = (SPEED_PRESETS.find((s) => s.id === speedId) || SPEED_PRESETS[2]).value
  useEffect(() => { try { localStorage.setItem(SPEED_LS_KEY, speedId) } catch { /* ignore */ } }, [speedId])

  // Shared site-wide surfaces fetched from Supabase (published only, enforced
  // by RLS so we don't have to filter client-side).
  const [sharedRows, setSharedRows] = useState([])
  useEffect(() => {
    let active = true
    fetchSharedSurfaces()
      .then((rows) => { if (active) setSharedRows(rows) })
      .catch(() => { /* table missing or RLS issue → just skip */ })
    return () => { active = false }
  }, [])

  const compiledShared = useMemo(() => {
    const out = []
    for (const row of sharedRows) {
      try { out.push(sharedRowToSurface(row)) } catch { /* broken, skip */ }
    }
    return out
  }, [sharedRows])

  const allSurfaces = useMemo(() => [...SURFACES, ...compiledShared], [compiledShared])
  const surface = allSurfaces.find((s) => s.id === activeId) || allSurfaces[0]
  const lang = i18n.language
  const surfaceName = localizedName(surface, lang)

  return (
    <div className="page gallery-page">
      <h1 className="page-title">{t('gallery.title')}</h1>
      <p className="page-subtitle">{t('gallery.subtitle')}</p>

      <div className="gallery-layout">
        <aside className="gallery-picker" aria-label={t('gallery.pickerLabel')}>
          <ul>
            {allSurfaces.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className={`gallery-pick${s.id === activeId ? ' on' : ''}`}
                  onClick={() => setActiveId(s.id)}
                >
                  <span className="gallery-pick-dot" aria-hidden="true" />
                  <span>{localizedName(s, lang)}</span>
                  {s.isShared && (
                    <span className="gallery-pick-star" title={t('gallery.shared.badge')}>🌐</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          <p className="gallery-hint">{t('gallery.hint')}</p>
        </aside>

        <div className="gallery-viewport-wrap">
          <div className="gallery-viewport" key={surface.id}>
            <Suspense fallback={<Loading />}>
              <SurfaceViewer
                surface={surface}
                renderMode={VIEW_RENDER}
                paletteId={VIEW_PALETTE}
                backgroundId={VIEW_BACKGROUND}
                motion={VIEW_MOTION}
                rotationSpeed={rotationSpeed}
              />
            </Suspense>
            <div
              className="gallery-speed-overlay"
              role="group"
              aria-label={t('gallery.speed')}
            >
              {SPEED_PRESETS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`gallery-speed-chip${speedId === s.id ? ' on' : ''}`}
                  onClick={() => setSpeedId(s.id)}
                  title={t(`gallery.speeds.${s.id}`)}
                  aria-label={t(`gallery.speeds.${s.id}`)}
                  aria-pressed={speedId === s.id}
                >
                  {s.glyph}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <section className="gallery-detail">
        <div className="gallery-detail-head">
          <h2 className="gallery-name">{surfaceName}</h2>
          <button
            type="button"
            className="gallery-ask-btn"
            onClick={() => askLeonardo(t('gallery.askLeoPrompt', { name: surfaceName }))}
            title={t('gallery.askLeoTooltip')}
          >
            ✨ {t('gallery.askLeo')}
          </button>
        </div>
        <Equation latex={surface.equation} />
      </section>
    </div>
  )
}
