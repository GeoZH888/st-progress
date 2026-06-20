import { Suspense, lazy, useState } from 'react'
import { useTranslation } from 'react-i18next'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { SURFACES, DEFAULT_SURFACE_ID, getSurface, localizedName } from '../lib/surfaces'
import { Loading } from '../components/Status'
import './Gallery.css'

// Keep three.js out of the gallery's own chunk header so the picker/UI
// shows immediately while the 3D viewer streams in.
const SurfaceViewer = lazy(() => import('../components/SurfaceViewer'))

const RENDER_MODES = ['solid', 'wireframe', 'both', 'points']

// Which surface kinds respect the render-mode picker. (Lines + point clouds
// are already in a fixed form, so we hide the picker for them.)
function supportsRenderMode(surface) {
  return surface.kind === 'morph' || surface.kind === 'builtin'
    || surface.kind === 'parametric' || !surface.kind
}

function Equation({ latex }) {
  const html = katex.renderToString(latex, { displayMode: true, throwOnError: false })
  return <div className="gallery-equation" dangerouslySetInnerHTML={{ __html: html }} />
}

// Open the Leonardo chat panel pre-filled with a question about the current
// surface. Mascot listens for this CustomEvent so we don't need prop-drilling
// from App -> Gallery.
function askLeonardo(prompt) {
  window.dispatchEvent(new CustomEvent('leonardo-open', { detail: { prompt } }))
}

export default function Gallery() {
  const { t, i18n } = useTranslation()
  const [activeId, setActiveId] = useState(DEFAULT_SURFACE_ID)
  const [renderMode, setRenderMode] = useState('solid')
  const surface = getSurface(activeId)
  const lang = i18n.language
  const surfaceName = localizedName(surface, lang)

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
          <div className="gallery-viewport" key={surface.id + ':' + renderMode}>
            <Suspense fallback={<Loading />}>
              <SurfaceViewer surface={surface} renderMode={renderMode} />
            </Suspense>
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
