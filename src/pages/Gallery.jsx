import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { SURFACES, DEFAULT_SURFACE_ID, getSurface, localizedName } from '../lib/surfaces'
import {
  loadCustomSurfaces, addCustomSurface, removeCustomSurface,
  customToSurface, compileExpr
} from '../lib/customSurfaces'
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
const MOTION_LEVELS = [
  { id: 'off',    value: 0    },
  { id: 'gentle', value: 0.35 },
  { id: 'lively', value: 0.7  },
  { id: 'wild',   value: 1.0  }
]
const LS_KEYS = {
  palette: 'stp-gallery-palette',
  background: 'stp-gallery-bg',
  mode: 'stp-gallery-mode',
  motion: 'stp-gallery-motion'
}

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

// --- Custom surface form ---
const CUSTOM_TEMPLATES = {
  helicoid:    { name: 'Helicoid (custom)', xExpr: 'v*cos(u)', yExpr: 'v*sin(u)', zExpr: '0.3*u', equation: 'x=v\\cos u,\\;y=v\\sin u,\\;z=0.3u' },
  rose:        { name: 'Rose surface',      xExpr: 'cos(3*u)*cos(v)', yExpr: 'cos(3*u)*sin(v)', zExpr: 'sin(3*u)', equation: 'r=\\cos(3u)' },
  shell:       { name: 'Spiral shell',      xExpr: '(1+0.5*cos(v))*cos(u)*exp(0.1*u)', yExpr: '(1+0.5*cos(v))*sin(u)*exp(0.1*u)', zExpr: '0.5*sin(v)*exp(0.1*u)', equation: 'r=(1+\\tfrac12\\cos v)e^{u/10}' }
}

function CustomSurfaceForm({ onSave, onCancel, t }) {
  const [form, setForm] = useState({
    name: '', xExpr: 'sin(u)*cos(v)', yExpr: 'sin(u)*sin(v)', zExpr: 'cos(u)', equation: ''
  })
  const [error, setError] = useState(null)

  function patch(k, v) { setForm((f) => ({ ...f, [k]: v })) }
  function loadTemplate(key) {
    const tpl = CUSTOM_TEMPLATES[key]
    if (tpl) { setForm((f) => ({ ...f, ...tpl })); setError(null) }
  }

  function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    const name = form.name.trim()
    if (!name) { setError(t('gallery.custom.errNoName')); return }
    try {
      // Sanity-compile each expression — surfaces the error in the form
      // rather than after save when rendering would silently fail.
      compileExpr(form.xExpr)
      compileExpr(form.yExpr)
      compileExpr(form.zExpr)
    } catch (e) {
      setError(e.message); return
    }
    onSave({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name,
      xExpr: form.xExpr.trim(),
      yExpr: form.yExpr.trim(),
      zExpr: form.zExpr.trim(),
      equation: form.equation.trim(),
      createdAt: new Date().toISOString()
    })
  }

  function askForFormula() {
    const prompt = `Give me a parametric surface for a beautiful shape (e.g. helicoid, trefoil knot, spiral seashell, conic spiral, etc.).
Return ONLY a JSON object with these keys, where x/y/z are JavaScript expressions in u and v (u, v ∈ [0, 2π]) using only sin, cos, sinh, cosh, sqrt, exp, log, pow, abs, PI:
{
  "name": "<a short name>",
  "xExpr": "<expression>",
  "yExpr": "<expression>",
  "zExpr": "<expression>",
  "equation": "<LaTeX equation>"
}`
    window.dispatchEvent(new CustomEvent('leonardo-open', { detail: { prompt } }))
  }

  return (
    <form className="gallery-custom-form" onSubmit={handleSubmit}>
      <h3>{t('gallery.custom.title')}</h3>
      <p className="gallery-custom-hint">{t('gallery.custom.hint')}</p>
      <div className="gallery-custom-actions" style={{ justifyContent: 'flex-start' }}>
        <button type="button" onClick={() => loadTemplate('helicoid')}>{t('gallery.custom.tplHelicoid')}</button>
        <button type="button" onClick={() => loadTemplate('rose')}>{t('gallery.custom.tplRose')}</button>
        <button type="button" onClick={() => loadTemplate('shell')}>{t('gallery.custom.tplShell')}</button>
        <button type="button" onClick={askForFormula}>✨ {t('gallery.custom.askLeo')}</button>
      </div>
      <label>
        {t('gallery.custom.name')}
        <input className="gallery-custom-name" value={form.name} onChange={(e) => patch('name', e.target.value)} placeholder={t('gallery.custom.namePlaceholder')} />
      </label>
      <label>x(u, v)
        <input value={form.xExpr} onChange={(e) => patch('xExpr', e.target.value)} />
      </label>
      <label>y(u, v)
        <input value={form.yExpr} onChange={(e) => patch('yExpr', e.target.value)} />
      </label>
      <label>z(u, v)
        <input value={form.zExpr} onChange={(e) => patch('zExpr', e.target.value)} />
      </label>
      <label>{t('gallery.custom.equation')}
        <input value={form.equation} onChange={(e) => patch('equation', e.target.value)} placeholder="x = \sin u \cos v, …" />
      </label>
      {error && <div className="gallery-custom-error">{error}</div>}
      <div className="gallery-custom-actions">
        <button type="button" onClick={onCancel}>{t('admin.cancel')}</button>
        <button type="submit" className="gallery-custom-save">{t('gallery.custom.save')}</button>
      </div>
    </form>
  )
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
  const [motionId, setMotionId] = useState(() => getLS(LS_KEYS.motion, 'gentle'))
  const motionValue = (MOTION_LEVELS.find((m) => m.id === motionId) || MOTION_LEVELS[1]).value

  // ---- Custom user-added surfaces (localStorage) ----
  const [customs, setCustoms] = useState(() => loadCustomSurfaces())
  const [addOpen, setAddOpen] = useState(false)

  // Compile each custom record into a surface object; skip the broken ones
  // (they stay in storage but don't show up in the picker — user can delete).
  const compiledCustoms = useMemo(() => {
    const out = []
    for (const c of customs) {
      try { out.push(customToSurface(c)) } catch { /* surface broken, skip */ }
    }
    return out
  }, [customs])

  const allSurfaces = useMemo(() => [...SURFACES, ...compiledCustoms], [compiledCustoms])

  function findActive() {
    return allSurfaces.find((s) => s.id === activeId) || allSurfaces[0]
  }
  const lang = i18n.language
  const surfaceName = localizedName(surface, lang)
  const palette = paletteById(paletteId)
  const bg = backgroundById(backgroundId)

  function handleSaveCustom(entry) {
    setCustoms(addCustomSurface(entry))
    setAddOpen(false)
    setActiveId(`custom-${entry.id}`)
  }
  function handleDeleteCustom(customId, e) {
    e?.stopPropagation()
    if (!window.confirm(t('gallery.custom.confirmDelete'))) return
    setCustoms(removeCustomSurface(customId))
    if (activeId === `custom-${customId}`) setActiveId(DEFAULT_SURFACE_ID)
  }

  // Per-surface params: keyed by surface id so each surface remembers its tweaks.
  const [paramsBySurface, setParamsBySurface] = useState({})
  const params = useMemo(() => {
    if (!surface.params) return null
    return paramsBySurface[surface.id] ?? defaultParams(surface)
  }, [surface, paramsBySurface])

  useEffect(() => { setLS(LS_KEYS.mode, renderMode) }, [renderMode])
  useEffect(() => { setLS(LS_KEYS.palette, paletteId) }, [paletteId])
  useEffect(() => { setLS(LS_KEYS.background, backgroundId) }, [backgroundId])
  useEffect(() => { setLS(LS_KEYS.motion, motionId) }, [motionId])

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
            {allSurfaces.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className={`gallery-pick${s.id === activeId ? ' on' : ''}`}
                  onClick={() => setActiveId(s.id)}
                >
                  <span className="gallery-pick-dot" aria-hidden="true" />
                  <span>{localizedName(s, lang)}</span>
                  {s.isCustom && (
                    <>
                      <span className="gallery-pick-star" title={t('gallery.custom.badge')}>★</span>
                      <span
                        role="button"
                        tabIndex={0}
                        className="gallery-pick-delete"
                        aria-label={t('gallery.custom.delete')}
                        onClick={(e) => handleDeleteCustom(s.customId, e)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleDeleteCustom(s.customId, e) }}
                      >
                        ×
                      </span>
                    </>
                  )}
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="gallery-add-btn"
            onClick={() => setAddOpen((v) => !v)}
          >
            {addOpen ? `× ${t('gallery.custom.close')}` : `+ ${t('gallery.custom.add')}`}
          </button>
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

          <div className="gallery-style-bar" role="group" aria-label={t('gallery.motion')}>
            <span className="gallery-style-label">{t('gallery.motion')}:</span>
            {MOTION_LEVELS.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`gallery-style-chip${motionId === m.id ? ' on' : ''}`}
                onClick={() => setMotionId(m.id)}
              >
                {t(`gallery.motions.${m.id}`)}
              </button>
            ))}
          </div>

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
                motion={motionValue}
              />
            </Suspense>
          </div>

          {addOpen && <CustomSurfaceForm onSave={handleSaveCustom} onCancel={() => setAddOpen(false)} t={t} />}

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
