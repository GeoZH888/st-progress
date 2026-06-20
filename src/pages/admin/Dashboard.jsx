import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const TABLES = [
  { key: 'milestones',     table: 'stp_milestones',   to: '/admin/milestones', emoji: '🏛️' },
  { key: 'figures',        table: 'stp_figures',      to: '/admin/figures',    emoji: '🧑‍🔬' },
  { key: 'locations',      table: 'stp_locations',    to: '/admin/locations',  emoji: '📍' },
  { key: 'pdfs',           table: 'stp_math_docs',    to: '/admin/rag',        emoji: '📄' },
  { key: 'chunks',         table: 'stp_math_chunks',  to: '/admin/rag',        emoji: '🧩' }
]

export default function Dashboard() {
  const { t } = useTranslation()
  const [counts, setCounts] = useState({})
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    Promise.all(
      TABLES.map(({ table }) =>
        supabase.from(table).select('*', { count: 'exact', head: true })
      )
    )
      .then((results) => {
        if (!active) return
        const next = {}
        results.forEach((r, i) => {
          next[TABLES[i].key] = r.error ? null : r.count
        })
        setCounts(next)
      })
      .catch((e) => active && setError(e.message))
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="admin-page">
      <h1 className="admin-h1">{t('admin.dashboard.title')}</h1>
      <p className="admin-sub">{t('admin.dashboard.subtitle')}</p>
      {error && <div className="admin-error">{error}</div>}

      <div className="admin-stat-grid">
        {TABLES.map(({ key, to, emoji }) => (
          <Link key={key} to={to} className="admin-stat">
            <span className="admin-stat-emoji" aria-hidden="true">{emoji}</span>
            <div className="admin-stat-body">
              <div className="admin-stat-count">{counts[key] ?? '…'}</div>
              <div className="admin-stat-label">{t(`admin.dashboard.${key}`)}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
