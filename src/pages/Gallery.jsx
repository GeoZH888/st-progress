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

function Equation({ latex }) {
  const html = katex.renderToString(latex, { displayMode: true, throwOnError: false })
  return <div className="gallery-equation" dangerouslySetInnerHTML={{ __html: html }} />
}

export default function Gallery() {
  const { t, i18n } = useTranslation()
  const [activeId, setActiveId] = useState(DEFAULT_SURFACE_ID)
  const surface = getSurface(activeId)
  const lang = i18n.language

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

        <div className="gallery-viewport" key={surface.id}>
          <Suspense fallback={<Loading />}>
            <SurfaceViewer surface={surface} />
          </Suspense>
        </div>
      </div>

      <section className="gallery-detail">
        <h2 className="gallery-name">{localizedName(surface, lang)}</h2>
        <Equation latex={surface.equation} />
      </section>
    </div>
  )
}
