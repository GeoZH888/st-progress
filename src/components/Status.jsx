import { useTranslation } from 'react-i18next'
import { isSupabaseConfigured } from '../lib/supabase'

// Shared loading / error / empty states used by the data pages.
export function Loading() {
  const { t } = useTranslation()
  return <p className="muted center" style={{ padding: '2rem' }}>{t('common.loading')}</p>
}

export function ErrorState({ error }) {
  const { t } = useTranslation()
  const notConfigured =
    !isSupabaseConfigured || error?.message === 'SUPABASE_NOT_CONFIGURED'
  return (
    <div className="center" style={{ padding: '2rem' }}>
      <p>⚠️ {t('status.loadError')}</p>
      {notConfigured && (
        <p className="muted" style={{ fontSize: '0.85rem' }}>
          Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in <code>.env</code>,
          then run <code>db/schema.sql</code> + <code>db/seed.sql</code> in the Supabase SQL editor.
        </p>
      )}
    </div>
  )
}

export function Empty() {
  const { t } = useTranslation()
  return <p className="muted center" style={{ padding: '2rem' }}>{t('status.empty')}</p>
}
