import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
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

// Fallback defaults — used for built-ins and for shared surfaces whose admin
// hasn't pinned a view_config yet.
const VIEW_PALETTE = 'viridis'
const VIEW_BACKGROUND = 'renaissance'
const VIEW_MOTION = 0.35
const VIEW_RENDER = 'solid'

// Pull per-surface overrides if the admin saved any; otherwise hand back
// the global defaults so built-ins behave identically to old behaviour.
function viewSettingsFor(surface) {
  const cfg = surface?.viewConfig || {}
  return {
    paletteId:    cfg.palette    || VIEW_PALETTE,
    backgroundId: cfg.background || VIEW_BACKGROUND,
    motion:       cfg.motion     != null ? cfg.motion     : VIEW_MOTION,
    renderMode:   cfg.mode       || VIEW_RENDER
  }
}

// Visitor-controllable motion preset (the only chip group public users see).
// Each preset bundles motion kind + intensity + auto-rotation speed.
const MOTION_PRESETS = [
  { id: 'pause', kind: 'idle',  intensity: 0,    speed: 0,   glyph: '⏸' },
  { id: 'calm',  kind: 'idle',  intensity: 0.35, speed: 0.5, glyph: '○' },
  { id: 'swim',  kind: 'swim',  intensity: 0.7,  speed: 0.3, glyph: '🐟' },
  { id: 'fly',   kind: 'fly',   intensity: 0.7,  speed: 0.5, glyph: '🦋' },
  { id: 'orbit', kind: 'orbit', intensity: 0.7,  speed: 0.4, glyph: '🌀' },
  { id: 'wild',  kind: 'idle',  intensity: 1.0,  speed: 1.6, glyph: '⏩' }
]
const SPEED_LS_KEY = 'stp-gallery-motion-preset'
const PARAMS_LS_KEY = 'stp-gallery-params' // map: surface.id -> { paramKey: value }

function defaultParams(surface) {
  const out = {}
  if (surface?.params) {
    for (const p of surface.params) out[p.key] = p.default
  }
  return out
}

function loadParamsMap() {
  try {
    const raw = localStorage.getItem(PARAMS_LS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}
function saveParamsMap(map) {
  try { localStorage.setItem(PARAMS_LS_KEY, JSON.stringify(map)) } catch { /* ignore */ }
}

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
  const [presetId, setPresetId] = useState(() => {
    try { return localStorage.getItem(SPEED_LS_KEY) || 'calm' } catch { return 'calm' }
  })
  const preset = MOTION_PRESETS.find((s) => s.id === presetId) || MOTION_PRESETS[1]
  useEffect(() => { try { localStorage.setItem(SPEED_LS_KEY, presetId) } catch { /* ignore */ } }, [presetId])

  // Per-surface parameter values (only meaningful for built-ins with a
  // surface.params schema). Loaded once from localStorage, persisted on change.
  const [paramsMap, setParamsMap] = useState(() => loadParamsMap())
  useEffect(() => { saveParamsMap(paramsMap) }, [paramsMap])

  // Immersive (fullscreen) viewport. Two layers: a CSS-driven "is-fullscreen"
  // class that always works, and an optional browser Fullscreen API call so
  // the OS chrome / URL bar hides too on desktops that allow it. The CSS
  // layer is what we toggle off of so iOS Safari (no element fullscreen) still
  // gets the immersive experience.
  const viewportRef = useRef(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  function toggleFullscreen() {
    const el = viewportRef.current
    const next = !isFullscreen
    setIsFullscreen(next)
    if (next) {
      const req = el?.requestFullscreen || el?.webkitRequestFullscreen
      if (req) { try { req.call(el) } catch { /* ignore */ } }
    } else if (document.fullscreenElement || document.webkitFullscreenElement) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen
      if (exit) { try { exit.call(document) } catch { /* ignore */ } }
    }
  }
  useEffect(() => {
    function onChange() {
      const inApi = !!(document.fullscreenElement || document.webkitFullscreenElement)
      // If the user pressed Esc / used the OS gesture, the browser leaves
      // fullscreen without going through our toggle — sync the CSS layer.
      if (!inApi) setIsFullscreen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape' && isFullscreen) setIsFullscreen(false)
    }
    document.addEventListener('fullscreenchange', onChange)
    document.addEventListener('webkitfullscreenchange', onChange)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      document.removeEventListener('webkitfullscreenchange', onChange)
      window.removeEventListener('keydown', onKey)
    }
  }, [isFullscreen])

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

  // Dedupe by id: when a shared DB row has a slug that matches a built-in's
  // id (e.g. 'klein', 'lorenz'), the DB row wins and the code-side built-in
  // is hidden. This is how the built-ins-in-DB migration cuts over without
  // visitors seeing every surface twice.
  const allSurfaces = useMemo(() => {
    const sharedIds = new Set(compiledShared.map((s) => s.id))
    return [...SURFACES.filter((s) => !sharedIds.has(s.id)), ...compiledShared]
  }, [compiledShared])
  const surface = allSurfaces.find((s) => s.id === activeId) || allSurfaces[0]
  const lang = i18n.language
  const surfaceName = localizedName(surface, lang)
  // Per-surface view defaults set by the admin, falling back to the global
  // VIEW_* constants for built-ins / surfaces with no view_config yet.
  const view = viewSettingsFor(surface)
  // Speed is a visitor-controlled setting (separate from admin view_config);
  // start it from the saved view_config if present, then let the user override.
  const adminSpeed = surface?.viewConfig?.speed

  // Resolve params for the current surface — visitor's tweaks override the
  // schema defaults. Shared surfaces don't have a params schema → null.
  const currentParams = useMemo(() => {
    if (!surface?.params) return null
    return { ...defaultParams(surface), ...(paramsMap[surface.id] || {}) }
  }, [surface, paramsMap])

  function updateParam(key, value) {
    setParamsMap((m) => ({
      ...m,
      [surface.id]: { ...(m[surface.id] || defaultParams(surface)), [key]: value }
    }))
  }
  function resetParams() {
    setParamsMap((m) => {
      const next = { ...m }
      delete next[surface.id]
      return next
    })
  }

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
          <div
            ref={viewportRef}
            className={`gallery-viewport${isFullscreen ? ' is-fullscreen' : ''}`}
            key={surface.id}
          >
            <Suspense fallback={<Loading />}>
              <SurfaceViewer
                surface={surface}
                renderMode={view.renderMode}
                paletteId={view.paletteId}
                backgroundId={view.backgroundId}
                motion={preset.intensity}
                motionKind={preset.kind}
                rotationSpeed={preset.speed}
                params={currentParams}
              />
            </Suspense>
            <button
              type="button"
              className="gallery-fullscreen-btn"
              onClick={toggleFullscreen}
              title={t(isFullscreen ? 'gallery.fullscreen.exit' : 'gallery.fullscreen.enter')}
              aria-label={t(isFullscreen ? 'gallery.fullscreen.exit' : 'gallery.fullscreen.enter')}
              aria-pressed={isFullscreen}
            >
              {isFullscreen ? '⤡' : '⤢'}
            </button>
            <div
              className="gallery-speed-overlay"
              role="group"
              aria-label={t('gallery.motionPreset')}
            >
              {MOTION_PRESETS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`gallery-speed-chip${presetId === s.id ? ' on' : ''}`}
                  onClick={() => setPresetId(s.id)}
                  title={t(`gallery.motionPresets.${s.id}`)}
                  aria-label={t(`gallery.motionPresets.${s.id}`)}
                  aria-pressed={presetId === s.id}
                >
                  {s.glyph}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* --- per-surface parameter sliders (only built-ins with a params schema) --- */}
      {surface.params && currentParams && (
        <div className="gallery-params-bar" style={{ marginTop: '0.6rem' }}>
          <div className="gallery-params-head">
            <span className="gallery-style-label">{t('gallery.params')}</span>
            <button type="button" className="gallery-params-reset" onClick={resetParams}>
              ↺ {t('gallery.reset')}
            </button>
          </div>
          <div className="gallery-params-grid">
            {surface.params.map((p) => {
              const val = currentParams[p.key]
              const label = p[`label_${lang}`] || p.label || p.key
              const display = p.step < 1 ? Number(val).toFixed(p.precision ?? 3) : val
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
