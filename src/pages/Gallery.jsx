import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { SURFACES, DEFAULT_SURFACE_ID, getSurface, localizedName } from '../lib/surfaces'
import {
  PALETTES, BACKGROUNDS,
  DEFAULT_PALETTE, DEFAULT_BACKGROUND,
  paletteById, backgroundById, localizedThemeName, paletteGradientCss
} from '../lib/themes'

const LIGHT_BG_IDS = new Set(['parchment', 'paper'])
import { Loading } from '../components/Status'
import './Gallery.css'

const SurfaceViewer = lazy(() => import('../components/SurfaceViewer'))

const RENDER_MODES = ['solid', 'wireframe', 'both', 'points']
const LS_KEYS = { palette: 'stp-gallery-palette', background: 'stp-gallery-bg', mode: 'stp-gallery-mode' }

function supportsRenderMode(surface) {
  return surface.kind === 'morph' || surface.kind === 'builtin'
    || surface.kind === 'parametric' || !surface.kind
}

function Equation({ latex }) {
  const html = katex.renderToString(latex, { displayMode: true, throwOnError: false })
  return <div className="gallery-equation" dangerouslySetInnerHTML={{ __html: html }} />
}

function askLeonardo(prompt) {
  window.dispatchEvent(new CustomEvent('leonardo-open', { detail: { prompt } }))
}

function getLS(key, fallback) {
  try {
    const v = localStorage.getItem(key)
    return v ?? fallback
  } catch { return fallback }
}
function setLS(key, value) {
  try { localStorage.setItem(key, value) } catch { /* ignore */ }
}

function defaultParams(surface) {
  const out = {}
  if (surface.params) {
    for (const p of surface.params) out[p.key] = p.default
  }
  return out
}

export default function Gallery() {
  const { t, i18n } = useTranslation()
  const [activeId, setActiveId] = useState(DEFAULT_SURFACE_ID)
  const [renderMode, setRenderMode] = useState(() => getLS(LS_KEYS.mode, 'solid'))
  const [paletteId, setPaletteId] = useState(() => getLS(LS_KEYS.palette, DEFAULT_PALETTE))
  const [backgroundId, setBackgroundId] = useState(() => getLS(LS_KEYS.background, DEFAULT_BACKGROUND))

  const surface = getSurface(activeId)
  const lang = i18n.language
  const surfaceName = localizedName(surface, lang)
  const palette = paletteById(paletteId)
  const bg = backgroundById(backgroundId)

  // Per-surface params: keyed by surface id so each surface remembers its tweaks.
  const [paramsBySurface, setParamsBySurface] = useState({})
  const params = useMemo(() => {
    if (!surface.params) return null
    return paramsBySurface[surface.id] ?? defaultParams(surface)
  }, [surface, paramsBySurface])

  useEffect(() => { setLS(LS_KEYS.mode, renderMode) }, [renderMode])
  useEffect(() => { setLS(LS_KEYS.palette, paletteId) }, [paletteId])
  useEffect(() => { setLS(LS_KEYS.background, backgroundId) }, [backgroundId])

  function updateParam(key, value) {
    setParamsBySurface((m) => ({
      ...m,
      [surface.id]: { ...(m[surface.id] ?? defaultParams(surface)), [key]: value }
    }))
  }
  function resetParams() {
    setParamsBySurface((m) => ({ ...m, [surface.id]: defaultParams(surface) }))
  }

  // Force the canvas to re-mount when these change — cheapest way to make
  // SurfaceViewer pick up the new background colour without prop-drilling.
  const viewerKey = `${surface.id}:${renderMode}:${paletteId}:${backgroundId}`

  return (
    <div className="page gallery-page">
      <h1 className="page-title">{t('gallery.title')}</h1>
      <p className="page-subtitle">{t('gallery.subtitle')}</p>

      <div className="gallery-layout">
        <aside className="gallery-picker" aria-label={t('gallery.pickerLabel')}>
          <ul>
            {SURFACES.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className={`gallery-pick${s.id === activeId ? ' on' : ''}`}
                  onClick={() => setActiveId(s.id)}
                >
                  <span className="gallery-pick-dot" aria-hidden="true" />
                  {localizedName(s, lang)}
                </button>
              </li>
            ))}
          </ul>
          <p className="gallery-hint">{t('gallery.hint')}</p>
        </aside>

        <div className="gallery-viewport-wrap">
          {/* --- style + theme bars --- */}
          {supportsRenderMode(surface) && (
            <div className="gallery-style-bar" role="group" aria-label={t('gallery.style')}>
              <span className="gallery-style-label">{t('gallery.style')}:</span>
              {RENDER_MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`gallery-style-chip${renderMode === mode ? ' on' : ''}`}
                  onClick={() => setRenderMode(mode)}
                >
                  {t(`gallery.styles.${mode}`)}
                </button>
              ))}
            </div>
          )}

          <div className="gallery-theme-bar">
            <div className="gallery-theme-row">
              <span className="gallery-style-label">{t('gallery.palette')}:</span>
              {PALETTES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`gallery-swatch palette-swatch${paletteId === p.id ? ' on' : ''}`}
                  style={{ background: paletteGradientCss(p) }}
                  onClick={() => setPaletteId(p.id)}
                  title={localizedThemeName(p, lang)}
                  aria-label={localizedThemeName(p, lang)}
                />
              ))}
            </div>
            <div className="gallery-theme-row">
              <span className="gallery-style-label">{t('gallery.background')}:</span>
              {BACKGROUNDS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className={`gallery-swatch bg-swatch${backgroundId === b.id ? ' on' : ''}`}
                  style={{ background: b.color, borderColor: LIGHT_BG_IDS.has(b.id) ? '#c9a85a' : undefined }}
                  onClick={() => setBackgroundId(b.id)}
                  title={localizedThemeName(b, lang)}
                  aria-label={localizedThemeName(b, lang)}
                />
              ))}
            </div>
          </div>

          <div className="gallery-viewport" key={viewerKey}>
            <Suspense fallback={<Loading />}>
              <SurfaceViewer
                surface={surface}
                renderMode={renderMode}
                paletteId={paletteId}
                backgroundId={backgroundId}
                params={params}
              />
            </Suspense>
          </div>

          {/* --- per-surface parameter sliders --- */}
          {surface.params && (
            <div className="gallery-params-bar">
              <div className="gallery-params-head">
                <span className="gallery-style-label">{t('gallery.params')}</span>
                <button type="button" className="gallery-params-reset" onClick={resetParams}>
                  ↺ {t('gallery.reset')}
                </button>
              </div>
              <div className="gallery-params-grid">
                {surface.params.map((p) => {
                  const val = params[p.key]
                  const label = p[`label_${lang}`] || p.label || p.key
                  const display = p.step < 1 ? val.toFixed(p.precision ?? 3) : val
                  return (
                    <label key={p.key} className="gallery-param">
                      <span className="gallery-param-label">
                        {label} <code>{display}</code>
                      </span>
                      <input
                        type="range"
                        min={p.min}
                        max={p.max}
                        step={p.step}
                        value={val}
                        onChange={(e) => updateParam(p.key, p.step < 1 ? parseFloat(e.target.value) : parseInt(e.target.value, 10))}
                      />
                    </label>
                  )
                })}
              </div>
            </div>
          )}
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
