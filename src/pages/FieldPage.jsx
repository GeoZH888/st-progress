import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getMilestonesByField } from '../lib/queries'
import { useFetch } from '../lib/useFetch'
import { Loading, ErrorState, Empty } from '../components/Status'
import { FIELDS, fieldMeta } from '../lib/fields'
import MilestoneCard from '../components/MilestoneCard'
import BackLink from '../components/BackLink'

const VALID = FIELDS.map((f) => f.key)

export default function FieldPage() {
  const { field } = useParams()
  const { t } = useTranslation()
  const valid = VALID.includes(field)
  const fm = fieldMeta(field)

  const { data, loading, error } = useFetch(() => getMilestonesByField(field), [field])

  return (
    <div className="page">
      <BackLink />
      <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span aria-hidden="true">{fm.emoji}</span>
        {valid ? t(`fields.${field}`) : field}
      </h1>

      {!valid ? (
        <Empty />
      ) : loading ? (
        <Loading />
      ) : error ? (
        <ErrorState error={error} />
      ) : data.length === 0 ? (
        <Empty />
      ) : (
        <>
          <p className="page-subtitle">{t('timeline.count', { count: data.length })}</p>
          <div className="ms-list">
            {data.map((m) => (
              <MilestoneCard key={m.id} m={m} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
