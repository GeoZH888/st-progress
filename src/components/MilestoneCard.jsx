import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { localized } from '../lib/supabase'
import { fieldMeta } from '../lib/fields'
import { formatYear } from '../lib/format'
import './MilestoneCard.css'

// Compact, clickable milestone card shared by the Timeline and By-Field views.
// The whole card links to the full detail page; the teaser is clamped to 2 lines.
export default function MilestoneCard({ m }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const fm = fieldMeta(m.field)
  const figure = m.figure
  const loc = m.location

  return (
    <Link to={`/milestone/${m.id}`} className="ms-card" style={{ '--field-color': fm.color }}>
      <div className="ms-year">{formatYear(m.year, t)}</div>
      <div className="ms-content">
        <span className="field-tag" style={{ background: fm.color }}>
          <span aria-hidden="true">{fm.emoji}</span> {t(`fields.${m.field}`)}
        </span>
        <h3 className="ms-title">{localized(m, 'title', lang)}</h3>
        <div className="ms-meta">
          {figure && <span>👤 {localized(figure, 'name', lang)}</span>}
          {loc && (
            <span>📍 {localized(loc, 'name', lang)}{loc.city ? `, ${loc.city}` : ''}</span>
          )}
        </div>
        <p className="ms-teaser">{localized(m, 'desc', lang)}</p>
      </div>
    </Link>
  )
}
