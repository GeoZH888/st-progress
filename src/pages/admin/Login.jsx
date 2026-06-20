import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { signIn, useSession } from '../../lib/auth'
import './Admin.css'

export default function Login() {
  const { t } = useTranslation()
  const { session, loading: sessionLoading } = useSession()
  const location = useLocation()
  const from = location.state?.from?.pathname || '/admin'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  if (session) return <Navigate to={from} replace />

  async function onSubmit(e) {
    e.preventDefault()
    if (loading) return
    setError(null)
    setLoading(true)
    try {
      await signIn(email.trim(), password)
    } catch (err) {
      setError(err.message || 'Sign in failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page admin-login-page">
      <div className="admin-login-card">
        <h1>{t('admin.login.title')}</h1>
        <p className="admin-login-sub">{t('admin.login.subtitle')}</p>
        <form onSubmit={onSubmit} className="admin-login-form">
          <label className="admin-field">
            <span>{t('admin.login.email')}</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
          </label>
          <label className="admin-field">
            <span>{t('admin.login.password')}</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && <div className="admin-error">{error}</div>}
          <button type="submit" className="admin-btn admin-btn-primary" disabled={loading || sessionLoading}>
            {loading ? t('admin.login.signingIn') : t('admin.login.signIn')}
          </button>
        </form>
      </div>
    </div>
  )
}
