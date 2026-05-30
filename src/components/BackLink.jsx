import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export default function BackLink() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  return (
    <button
      type="button"
      className="btn btn-gold"
      style={{ marginBottom: '1rem' }}
      onClick={() => navigate(-1)}
    >
      ← {t('common.back')}
    </button>
  )
}
