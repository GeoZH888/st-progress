import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getMilestones } from '../lib/queries'
import { localized } from '../lib/supabase'
import { useFetch } from '../lib/useFetch'
import { Loading, ErrorState } from '../components/Status'
import { fieldMeta } from '../lib/fields'
import { formatYear, lifespan } from '../lib/format'
import BackLink from '../components/BackLink'
import './MilestonePage.css'

// A row of clickable related-milestone chips (forward "led to" / back "came from").
function RelatedRow({ label, items, lang }) {
  return (
    <div className="rel-row">
      <span className="rel-label">{label}:</span>
      {items.map((rel) => (
        <Link
          key={rel.id}
          to={`/milestone/${rel.id}`}
          className="rel-chip"
          style={{ '--field-color': fieldMeta(rel.field).color }}
        >
          {localized(rel, 'title', lang)}
        </Link>
      ))}
    </div>
  )
}

export default function MilestonePage() {
  const { id } = useParams()
  const { t, i18n } = useTranslation()
  const lang = i18n.language

  // The dataset is small, so we fetch all milestones once and resolve relations
  // (and figure/location joins come along for free).
  const { data, loading, error } = useFetch(getMilestones, [])

  if (loading) return <div className="page"><Loading /></div>
  if (error) return <div className="page"><ErrorState error={error} /></div>

  const all = data ?? []
  const m = all.find((x) => x.id === id)
  if (!m) {
    return (
      <div className="page">
        <BackLink />
        <p className="muted center" style={{ padding: '2rem' }}>{t('detail.notFound')}</p>
      </div>
    )
  }

  const fm = fieldMeta(m.field)
  const figure = m.figure
  const loc = m.location
  const byId = Object.fromEntries(all.map((x) => [x.id, x]))
  const ledTo = (m.led_to || []).map((i) => byId[i]).filter(Boolean)
  const cameFrom = all.filter((x) => (x.led_to || []).includes(m.id))

  return (
    <div className="page detail-page">
      <BackLink />

      <span className="field-tag detail-tag" style={{ background: fm.color }}>
        <span aria-hidden="true">{fm.emoji}</span> {t(`fields.${m.field}`)}
      </span>
      <h1 className="page-title detail-title">{localized(m, 'title', lang)}</h1>
      <p className="detail-when">
        {formatYear(m.year, t)} · {t(`eras.${m.era}`)}
      </p>

      <section className="detail-section">
        <h2 className="detail-h">{t('detail.about')}</h2>
        <p className="detail-desc">{localized(m, 'desc', lang)}</p>
      </section>

      {figure && (
        <section className="detail-section figure-card">
          {figure.portrait_url ? (
            // >>> Final portrait art can be stored in stp_figures.portrait_url <<<
            <img className="figure-portrait" src={figure.portrait_url} alt="" />
          ) : (
            <div className="figure-portrait placeholder" aria-hidden="true">👤</div>
          )}
          <div className="figure-info">
            <h2 className="detail-h">{t('timeline.figure')}</h2>
            <strong className="figure-name">{localized(figure, 'name', lang)}</strong>
            <div className="figure-sub muted">
              {[lifespan(figure, t), figure.nationality].filter(Boolean).join(' · ')}
            </div>
            <p className="figure-bio">{localized(figure, 'bio', lang)}</p>
          </div>
        </section>
      )}

      {loc && (
        <section className="detail-section">
          <h2 className="detail-h">{t('timeline.place')}</h2>
          <p className="detail-place">
            📍 {localized(loc, 'name', lang)}
            {loc.city ? `, ${loc.city}` : ''}
            {loc.country ? `, ${loc.country}` : ''}
          </p>
          <Link to="/map" className="btn btn-gold detail-mapbtn">🗺️ {t('detail.viewOnMap')}</Link>
        </section>
      )}

      {(cameFrom.length > 0 || ledTo.length > 0) && (
        <section className="detail-section detail-related">
          {cameFrom.length > 0 && (
            <RelatedRow label={t('detail.cameFrom')} items={cameFrom} lang={lang} />
          )}
          {ledTo.length > 0 && (
            <RelatedRow label={t('timeline.ledTo')} items={ledTo} lang={lang} />
          )}
        </section>
      )}
    </div>
  )
}
