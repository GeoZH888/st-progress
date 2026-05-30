import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getMilestones } from '../lib/queries'
import { useFetch } from '../lib/useFetch'
import { Loading, ErrorState } from '../components/Status'
import { fieldsForCategory } from '../lib/fields'
import { CATEGORIES } from '../lib/categories'

export default function FieldsIndex() {
  const { t } = useTranslation()
  const { data, loading, error } = useFetch(getMilestones, [])

  if (loading) return <div className="page"><Loading /></div>
  if (error) return <div className="page"><ErrorState error={error} /></div>

  const counts = {}
  for (const m of data) counts[m.field] = (counts[m.field] || 0) + 1

  return (
    <div className="page">
      <h1 className="page-title">{t('fieldsIndex.title')}</h1>
      <p className="page-subtitle">{t('fieldsIndex.subtitle')}</p>

      {CATEGORIES.map((c) => (
        <section key={c.key} className="cat-section">
          <h2 className="cat-section-h" style={{ '--cat-color': c.color }}>
            <span aria-hidden="true">{c.emoji}</span> {t(`categories.${c.key}.title`)}
          </h2>
          <p className="cat-section-desc muted">{t(`categories.${c.key}.desc`)}</p>

          <div className="field-grid">
            {fieldsForCategory(c.key).map((f) => (
              <Link
                key={f.key}
                to={`/field/${f.key}`}
                className="field-tile"
                style={{ '--field-color': f.color }}
              >
                <span className="field-tile-emoji" aria-hidden="true">{f.emoji}</span>
                <h3 className="field-tile-name">{t(`fields.${f.key}`)}</h3>
                <span className="field-tile-count">
                  {t('timeline.count', { count: counts[f.key] || 0 })}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
