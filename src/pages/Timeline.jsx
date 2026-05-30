import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getMilestones } from '../lib/queries'
import { useFetch } from '../lib/useFetch'
import { Loading, ErrorState, Empty } from '../components/Status'
import MilestoneCard from '../components/MilestoneCard'
import { FIELDS, fieldsForCategory } from '../lib/fields'
import { CATEGORIES } from '../lib/categories'
import { eraMeta, eraForYear, eraIndex } from '../lib/eras'
import './Timeline.css'

export default function Timeline() {
  const { t } = useTranslation()
  const { data, loading, error } = useFetch(getMilestones, [])

  // Active super-category lives in the URL (?cat=science_tech), so deep links
  // and the Home tiles can preselect it.
  const [searchParams, setSearchParams] = useSearchParams()
  const activeCat = searchParams.get('cat') || 'all'

  const [activeFields, setActiveFields] = useState(() => new Set())
  const bandRefs = useRef({})

  function setActiveCat(cat) {
    const next = new URLSearchParams(searchParams)
    if (cat === 'all') next.delete('cat')
    else next.set('cat', cat)
    setSearchParams(next, { replace: true })
  }

  // Switching category invalidates any field chips (the visible chip set changes).
  useEffect(() => {
    setActiveFields(new Set())
  }, [activeCat])

  const milestones = data ?? []
  const visibleFields = activeCat === 'all' ? FIELDS : fieldsForCategory(activeCat)

  const toggleField = (key) =>
    setActiveFields((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })

  const filtered = useMemo(() => {
    let list = milestones
    if (activeCat !== 'all') list = list.filter((m) => m.category === activeCat)
    if (activeFields.size > 0) list = list.filter((m) => activeFields.has(m.field))
    return list
  }, [milestones, activeCat, activeFields])

  // Group milestones into era bands, ordered antiquity -> present.
  const bands = useMemo(() => {
    const groups = {}
    for (const m of filtered) {
      const era = m.era || eraForYear(m.year ?? 0)
      ;(groups[era] ||= []).push(m)
    }
    return Object.entries(groups)
      .map(([era, items]) => ({
        era,
        items: items.slice().sort((a, b) => (a.year ?? 0) - (b.year ?? 0))
      }))
      .sort((a, b) => eraIndex(a.era) - eraIndex(b.era))
  }, [filtered])

  function jumpToEra(era) {
    bandRefs.current[era]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (loading) return <div className="page"><Loading /></div>
  if (error) return <div className="page"><ErrorState error={error} /></div>
  if (milestones.length === 0) return <div className="page"><Empty /></div>

  return (
    <div className="page timeline-page">
      <h1 className="page-title">{t('timeline.title')}</h1>
      <p className="page-subtitle">{t('timeline.subtitle')}</p>

      {/* ---- super-category tabs ---- */}
      <div className="cat-tabs" role="group" aria-label="Domain">
        <button
          type="button"
          className={`cat-tab${activeCat === 'all' ? ' on' : ''}`}
          onClick={() => setActiveCat('all')}
        >
          {t('categories.all')}
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            className={`cat-tab${activeCat === c.key ? ' on' : ''}`}
            style={{ '--cat-color': c.color }}
            onClick={() => setActiveCat(c.key)}
          >
            <span aria-hidden="true">{c.emoji}</span> {t(`categories.${c.key}.title`)}
          </button>
        ))}
      </div>

      {/* ---- field filter chips (scoped to active category) ---- */}
      <div className="tl-filters" role="group" aria-label={t('timeline.filterByField')}>
        <button
          type="button"
          className={`chip${activeFields.size === 0 ? ' chip-on' : ''}`}
          onClick={() => setActiveFields(new Set())}
        >
          {t('timeline.allFields')}
        </button>
        {visibleFields.map((f) => {
          const on = activeFields.has(f.key)
          return (
            <button
              key={f.key}
              type="button"
              className={`chip${on ? ' chip-on' : ''}`}
              style={on ? { background: f.color, borderColor: f.color, color: '#fff' } : { borderColor: f.color }}
              onClick={() => toggleField(f.key)}
            >
              <span aria-hidden="true">{f.emoji}</span> {t(`fields.${f.key}`)}
            </button>
          )
        })}
      </div>

      {/* ---- jump-to-era + count ---- */}
      <div className="tl-eras">
        <span className="tl-eras-label">{t('timeline.jumpToEra')}:</span>
        {bands.map((b) => (
          <button
            key={b.era}
            type="button"
            className="era-pill"
            style={{ '--era-accent': eraMeta(b.era).accent }}
            onClick={() => jumpToEra(b.era)}
          >
            {t(`eras.${b.era}`)}
          </button>
        ))}
        <span className="tl-count">{t('timeline.count', { count: filtered.length })}</span>
      </div>

      {/* ---- era bands ---- */}
      {bands.map((band) => {
        const accent = eraMeta(band.era).accent
        return (
          <section
            key={band.era}
            className="era-band"
            ref={(el) => (bandRefs.current[band.era] = el)}
          >
            <div className="era-band-head" style={{ '--era-accent': accent }}>
              <div>
                <span className="era-name">{t(`eras.${band.era}`)}</span>
                <span className="era-range">{t(`eraRange.${band.era}`)}</span>
              </div>
              <span className="era-band-count">{band.items.length}</span>
            </div>

            <div className="era-rail" style={{ '--era-accent': accent }}>
              {band.items.map((m) => (
                <MilestoneCard key={m.id} m={m} />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
